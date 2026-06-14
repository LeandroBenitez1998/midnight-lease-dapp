import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import * as Rx from 'rxjs'
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Loader2,
  Lock,
  Network,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CompiledContract } from '@midnight-ntwrk/compact-js'
import { fromHex, toHex, type ContractAddress } from '@midnight-ntwrk/compact-runtime'
import { contracts, type types } from '@midnight-ntwrk/midnight-js'
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider'
import * as ledger from '@midnight-ntwrk/ledger-v8'
import {
  Lease,
  type LeasePrivateState,
  createPrivateState,
} from '@midnight-lease/lease-contract'
import { formatHex } from '@/modules/midnight/lease-sdk/api/common-types'
import { useWallet } from '@/modules/midnight/wallet-widget/hooks/useWallet'
import { inMemoryPrivateStateProvider } from '@/modules/midnight/wallet-widget/utils/customImplementations/in-memory-private-state-provider'
import { proofClient } from '@/modules/midnight/wallet-widget/utils/providersWrappers/proofClient'
import { CachedFetchZkConfigProvider } from '@/modules/midnight/wallet-widget/utils/providersWrappers/zkConfigProvider'
import ScreenMain from '@/modules/midnight/wallet-widget/ui/screen-main'
import { networkID } from '@/modules/midnight/wallet-widget/ui/common/common-values'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/modules/midnight/wallet-widget/ui/common/dialog'
import { cn } from '@/lib/utils'

const stepLabels = [
  'Conectar wallet',
  'Completar identidad',
  'Revelar datos públicos',
  'Generar prueba ZK',
  'Firmar contrato',
] as const

const privacyPrivate = [
  ['Nombre Completo', 'Oculto'],
  ['DNI / ID', 'Oculto'],
  ['Fecha de nacimiento', 'Oculta'],
  ['Edad calculada', 'Oculta'],
] as const

const signatureRevealItems = [
  'Hash del contrato',
  'Monto',
  'Fecha',
  'Prueba local de edad',
] as const

const leaseStateLabels: Record<Lease.LeaseState, string> = {
  [Lease.LeaseState.OFFERED]: 'Pendiente de firma',
  [Lease.LeaseState.CLAIMED]: 'Firmado por inquilino',
  [Lease.LeaseState.ACTIVE]: 'Activo',
  [Lease.LeaseState.IN_ARREARS]: 'En mora',
  [Lease.LeaseState.TERMINATED]: 'Terminado',
  [Lease.LeaseState.COMPLETED]: 'Completado',
}

function formatShortText(value: string | null, visible = 8): string {
  if (!value) {
    return 'Pendiente'
  }

  if (value.length <= visible * 2 + 3) {
    return value
  }

  return `${value.slice(0, visible)}...${value.slice(-visible)}`
}

function formatLeaseMoney(value: bigint | null, fallback: string): string {
  return value === null ? fallback : `USD ${value.toString()}`
}

function sanitizeArgentinianDni(value: string): string {
  return value.replace(/\D+/g, '')
}

function isValidArgentinianDni(value: string): boolean {
  return /^\d{7,8}$/.test(value)
}

function calculateAgeFromBirthDate(value: string): number | null {
  if (!value) {
    return null
  }

  const [yearText, monthText, dayText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (!year || !month || !day) {
    return null
  }

  const birthDate = new Date(year, month - 1, day)

  if (
    Number.isNaN(birthDate.getTime()) ||
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return null
  }

  const today = new Date()
  let age = today.getFullYear() - year
  const monthDifference = today.getMonth() - (month - 1)

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < day)) {
    age -= 1
  }

  return age
}

function createLocalProofId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `proof-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

function maskDni(value: string): string {
  if (!value) {
    return 'Pendiente'
  }

  if (value.length <= 4) {
    return `${value.slice(0, 2)}••`
  }

  return `${value.slice(0, 2)}••••${value.slice(-2)}`
}

const LEASE_PRIVATE_STATE_ID = 'leasePrivateState' as const

type BalanceUnsealedTransactionApi = {
  balanceUnsealedTransaction: (tx: string, options: Record<string, never>) => Promise<{ tx: string }>
}

type LeaseTxResult = {
  public?: {
    txHash?: string
    txId?: string
    blockHeight?: number
  }
}

type EligibilityFormState = {
  fullName: string
  dni: string
  birthDate: string
}

type EligibilityProofState = {
  proofId: string
  generatedAt: string
  age: number
}

const leaseCompiledContract = CompiledContract.make('lease', Lease.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(`${window.location.origin}/midnight/lease`),
)

type StepStatus = 'completed' | 'active' | 'pending'
type TimelineStatus = StepStatus

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.URL.revokeObjectURL(url)
}

function getStepStatus(
  index: number,
  walletConnected: boolean,
  proofGenerated: boolean,
  signed: boolean,
): StepStatus {
  if (signed) return 'completed'
  if (!walletConnected) return index === 0 ? 'active' : 'pending'
  if (proofGenerated) {
    if (index < 4) return 'completed'
    if (index === 4) return 'active'
  }
  if (index === 0) return 'completed'
  if (index === 1) return 'active'
  return 'pending'
}

function getTimelineStatus(
  index: number,
  walletConnected: boolean,
  proofGenerated: boolean,
  signed: boolean,
): TimelineStatus {
  if (signed) return 'completed'
  if (!walletConnected) return index === 0 ? 'active' : 'pending'
  if (proofGenerated) {
    if (index < 4) return 'completed'
    if (index === 4) return 'active'
  }
  if (index === 0) return 'completed'
  if (index === 1) return 'active'
  return 'pending'
}

function AppHeader({
  walletConnected,
  walletConnecting,
  walletAddress,
  onConnectWallet,
}: {
  walletConnected: boolean
  walletConnecting: boolean
  walletAddress: string | null
  onConnectWallet: () => void
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-4 lg:justify-start">
          <Link to="/" className="text-sm font-semibold tracking-[0.28em] text-black">
            MIDNIGHT LEASE
          </Link>

          <div className="flex items-center gap-3 lg:hidden">
            <NetworkBadge />
            <WalletConnectButton
              connected={walletConnected}
              connecting={walletConnecting}
              walletAddress={walletAddress}
              onClick={onConnectWallet}
            />
          </div>
        </div>

        <nav className="flex items-center gap-4 overflow-x-auto text-sm text-black/70 sm:gap-6">
          <Link to="/" className="whitespace-nowrap text-black transition-colors hover:text-black/70">
            Dashboard
          </Link>
          <a href="#contract-status" className="whitespace-nowrap transition-colors hover:text-black">
            Contracts
          </a>
          <a href="#proof-section" className="whitespace-nowrap transition-colors hover:text-black">
            Verifications
          </a>
          <a href="#signature-section" className="whitespace-nowrap transition-colors hover:text-black">
            Wallet
          </a>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <NetworkBadge />
          <WalletConnectButton
            connected={walletConnected}
            connecting={walletConnecting}
            walletAddress={walletAddress}
            onClick={onConnectWallet}
          />
        </div>
      </div>
    </header>
  )
}

function NetworkBadge() {
  return (
    <Badge variant="outline" className="gap-2 border-neutral-300 bg-white px-3 py-1.5 text-[11px] text-black">
      <span className="h-2 w-2 rounded-full bg-black" />
      Midnight Preprod
    </Badge>
  )
}

function WalletConnectButton({
  connected,
  connecting,
  walletAddress,
  onClick,
}: {
  connected: boolean
  connecting: boolean
  walletAddress: string | null
  onClick: () => void
}) {
  const label = connecting
    ? 'Conectando...'
    : connected
      ? walletAddress
        ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        : 'Wallet conectada'
      : 'Conectar wallet'

  return (
    <Button
      type="button"
      onClick={onClick}
      variant="default"
      aria-pressed={connected}
      className={cn(
        'border-neutral-300 shadow-none',
        connected ? 'bg-white text-black hover:bg-black hover:text-white' : 'bg-black text-white hover:bg-black/90',
      )}
    >
      {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {label}
    </Button>
  )
}

function StatusBadge({
  children,
  tone,
}: {
  children: string
  tone: 'solid' | 'outline' | 'subtle'
}) {
  return (
    <Badge variant={tone} className="min-w-0 whitespace-nowrap">
      {children}
    </Badge>
  )
}

function StepDot({ status }: { status: StepStatus }) {
  if (status === 'completed') {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-white">
        <Check className="h-4 w-4" />
      </span>
    )
  }

  if (status === 'active') {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-white">
        <span className="h-2.5 w-2.5 rounded-full bg-black" />
      </span>
    )
  }

  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100">
      <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
    </span>
  )
}

function TimelineDot({ status }: { status: TimelineStatus }) {
  if (status === 'completed') {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-black bg-white">
        <span className="h-2.5 w-2.5 rounded-full bg-black" />
      </span>
    )
  }

  if (status === 'active') {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-black bg-white">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-black" />
      </span>
    )
  }

  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300 bg-white">
      <span className="h-2 w-2 rounded-full bg-neutral-300" />
    </span>
  )
}

function SectionCard({
  title,
  description,
  children,
  id,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  id?: string
  className?: string
}) {
  return (
    <Card id={id} className={cn('rounded-[22px] border-neutral-200 bg-white shadow-none', className)}>
      <CardHeader className="gap-2 border-b border-neutral-200 pb-5">
        <CardTitle className="text-base font-semibold tracking-tight text-black">{title}</CardTitle>
        {description ? <CardDescription className="text-sm text-black/60">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  )
}

function LeaseHero({
  onConnectWallet,
  onReviewContract,
}: {
  onConnectWallet: () => void
  onReviewContract: () => void
}) {
  return (
    <Card className="rounded-[28px] border-neutral-200 bg-white shadow-none">
      <CardContent className="space-y-7 p-8 sm:p-10">
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-black/55">Legaltech · Privacy by design</p>
          <div className="space-y-3">
            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-black sm:text-5xl">
              Firmá tu contrato de alquiler preservando tu privacidad
            </h1>
            <p className="max-w-3xl text-base leading-7 text-black/70 sm:text-lg">
              Revelá solo los datos necesarios, generá una prueba verificable y firmá el contrato de forma segura en Midnight Network.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={onReviewContract}
            className="bg-black text-white shadow-none hover:bg-black/90"
          >
            Revisar contrato
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onConnectWallet}
            className="border-neutral-300 bg-white text-black shadow-none hover:bg-black hover:text-white"
          >
            Conectar wallet
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function LeaseStepper({
  walletConnected,
  proofGenerated,
  signed,
}: {
  walletConnected: boolean
  proofGenerated: boolean
  signed: boolean
}) {
  return (
    <Card className="rounded-[22px] border-neutral-200 bg-white shadow-none">
      <CardContent className="overflow-x-auto p-6">
        <div className="flex min-w-max items-center gap-4">
          {stepLabels.map((label, index) => {
            const status = getStepStatus(index, walletConnected, proofGenerated, signed)
            return (
              <div key={label} className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <StepDot status={status} />
                  <span
                    className={cn(
                      'whitespace-nowrap text-sm font-medium',
                      status === 'completed' || status === 'active' ? 'text-black' : 'text-black/45',
                    )}
                  >
                    {label}
                  </span>
                </div>
                {index < stepLabels.length - 1 ? (
                  <div
                    className={cn(
                      'h-px w-12',
                      status === 'completed' ? 'bg-black' : 'bg-neutral-300',
                    )}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function ContractStatusCard({
  signed,
  contractHash,
  monthlyRent,
  depositAmount,
  termMonths,
  leaseStateLabel,
}: {
  signed: boolean
  contractHash: string
  monthlyRent: string
  depositAmount: string
  termMonths: string
  leaseStateLabel: string
}) {
  const contractRows = [
    { label: 'Propiedad', value: 'Departamento en Palermo', badge: 'Público', tone: 'subtle' as const },
    { label: 'Locador', value: 'Verificado', badge: 'Verificado', tone: 'solid' as const },
    { label: 'Inquilino', value: 'Identidad privada', badge: 'Privado', tone: 'outline' as const },
    { label: 'Hash del contrato', value: contractHash, badge: 'Público', tone: 'subtle' as const },
    { label: 'Duración', value: termMonths, badge: 'Público', tone: 'subtle' as const },
    { label: 'Monto mensual público', value: monthlyRent, badge: 'Público', tone: 'outline' as const },
    { label: 'Depósito', value: depositAmount, badge: 'Verificado', tone: 'solid' as const },
    { label: 'Estado', value: leaseStateLabel, badge: signed ? 'Firmado' : 'Pendiente', tone: signed ? 'solid' : 'subtle' as const },
  ] as const

  return (
    <SectionCard
      id="contract-status"
      title="Estado del contrato"
      description="Resumen legal monocromático con el mínimo de datos públicos necesarios."
    >
      <div className="space-y-3">
        {contractRows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4 border-b border-neutral-200 py-3 last:border-b-0 last:pb-0">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-black/60">{row.label}</p>
              <p className="text-base font-medium text-black">{row.value}</p>
            </div>
            <StatusBadge tone={row.tone}>{row.badge}</StatusBadge>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function PrivacyPanel({
  walletAddress,
  monthlyRent,
  contractHash,
  proofGenerated,
}: {
  walletAddress: string | null
  monthlyRent: string
  contractHash: string
  proofGenerated: boolean
}) {
  const walletValue = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Pendiente'
  const privacyPublic = [
    ['Wallet Address', walletValue],
    ['Monto Mensual', monthlyRent],
    ['Hash del Contrato', contractHash],
    ['Prueba ZK Válida', proofGenerated ? 'Sí' : 'Pendiente'],
  ] as const

  return (
    <SectionCard
      id="privacy-panel"
      title="Esquema de Privacidad"
      description="La identidad completa y los datos financieros sensibles permanecen fuera de la cadena."
    >
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-neutral-200 pb-6 md:border-b-0 md:border-r md:pr-6">
          <div className="mb-4 flex items-center gap-2 text-black/70">
            <Lock className="h-4 w-4" />
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em]">Datos Privados (Off-chain)</h3>
          </div>
          <dl className="space-y-3">
            {privacyPrivate.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 border-b border-neutral-200 py-2 last:border-b-0">
                <dt className="text-sm text-black/60">{label}</dt>
                <dd className="text-sm font-medium text-black">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="pt-6 md:pl-6 md:pt-0">
          <div className="mb-4 flex items-center gap-2 text-black/70">
            <FileText className="h-4 w-4" />
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em]">Datos Públicos (On-chain)</h3>
          </div>
          <dl className="space-y-3">
            {privacyPublic.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 border-b border-neutral-200 py-2 last:border-b-0">
                <dt className="text-sm text-black/60">{label}</dt>
                <dd className="text-sm font-medium text-black text-right font-mono break-all">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-sm leading-6 text-black/65">
            Tu identidad completa y tus datos financieros sensibles no se publican.
          </p>
        </div>
      </div>
    </SectionCard>
  )
}

function ProofGenerationCard({
  walletConnected,
  proofGenerated,
  isGeneratingProof,
  signed,
  eligibilityForm,
  eligibilityProof,
  eligibilityError,
  onEligibilityFieldChange,
  onGenerateProof,
}: {
  walletConnected: boolean
  proofGenerated: boolean
  isGeneratingProof: boolean
  signed: boolean
  eligibilityForm: EligibilityFormState
  eligibilityProof: EligibilityProofState | null
  eligibilityError: string | null
  onEligibilityFieldChange: (field: keyof EligibilityFormState, value: string) => void
  onGenerateProof: () => void
}) {
  const eligibilityChecklist = [
    {
      label: 'Nombre completo cargado',
      done: eligibilityForm.fullName.trim().length > 1,
    },
    {
      label: 'DNI argentino válido',
      done: isValidArgentinianDni(sanitizeArgentinianDni(eligibilityForm.dni)),
    },
    {
      label: 'Fecha de nacimiento cargada',
      done: Boolean(eligibilityForm.birthDate),
    },
    {
      label: 'Mayor de edad verificado',
      done: Boolean(eligibilityProof),
    },
  ] as const

  const helperTone = eligibilityError
    ? 'border-red-200 bg-red-50 text-red-700'
    : isGeneratingProof || proofGenerated
      ? 'border-neutral-200 bg-white text-black'
      : 'border-neutral-200 bg-neutral-50 text-black/60'

  const helperIcon = eligibilityError ? (
    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-red-300 text-[10px] font-bold leading-none text-red-600">
      !
    </span>
  ) : isGeneratingProof ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : proofGenerated ? (
    <CheckCircle2 className="h-4 w-4" />
  ) : (
    <Clock3 className="h-4 w-4" />
  )

  const helperText = eligibilityError
    ? eligibilityError
    : isGeneratingProof
      ? 'Calculando la verificación local con tu DNI y fecha de nacimiento...'
      : proofGenerated
        ? 'Tu mayoría de edad quedó validada localmente. Ya podés continuar con la firma.'
        : walletConnected
          ? 'La verificación se calcula localmente en este navegador antes de habilitar la firma.'
          : 'Conectá tu wallet para continuar con la firma del lease después de validar tu edad.'

  return (
    <SectionCard
      id="proof-section"
      title="Prueba de elegibilidad"
      description="Cargá nombre, DNI argentino y fecha de nacimiento para calcular una verificación local de mayoría de edad."
    >
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Nombre completo</span>
            <input
              type="text"
              autoComplete="name"
              maxLength={80}
              value={eligibilityForm.fullName}
              onChange={(event) => onEligibilityFieldChange('fullName', event.currentTarget.value)}
              placeholder="Leandro Thomas"
              className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-black outline-none transition placeholder:text-black/30 focus:border-black focus:ring-2 focus:ring-black/10"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">DNI argentino</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={eligibilityForm.dni}
              onChange={(event) => onEligibilityFieldChange('dni', event.currentTarget.value)}
              placeholder="12345678"
              className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-black outline-none transition placeholder:text-black/30 focus:border-black focus:ring-2 focus:ring-black/10"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Fecha de nacimiento</span>
            <input
              type="date"
              value={eligibilityForm.birthDate}
              onChange={(event) => onEligibilityFieldChange('birthDate', event.currentTarget.value)}
              className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"
            />
          </label>
        </div>

        <p className="text-sm leading-6 text-black/60">
          Usamos estos datos solo para calcular la mayoría de edad en tu navegador. El nombre y el DNI no salen del flujo local de demo.
        </p>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Documento cargado</p>
          <p className="mt-2 text-sm font-medium text-black">{maskDni(sanitizeArgentinianDni(eligibilityForm.dni))}</p>
        </div>

        <ul className="space-y-3">
          {eligibilityChecklist.map((item) => (
            <li key={item.label} className="flex items-center gap-3 text-sm text-black/80">
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border',
                  item.done ? 'border-black bg-black text-white' : 'border-neutral-300 bg-white text-black/25',
                )}
              >
                {item.done ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              {item.label}
            </li>
          ))}
        </ul>

        {eligibilityProof ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Prueba local generada</p>
                <p className="text-sm text-black/65">La edad se verificó localmente sin enviar tu DNI fuera del navegador.</p>
              </div>
              <StatusBadge tone="solid">Mayor de edad</StatusBadge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ['Edad calculada', `${eligibilityProof.age} años`],
                ['Validada', eligibilityProof.generatedAt],
                ['Prueba local', formatShortText(eligibilityProof.proofId, 10)],
                ['Fuente', 'DNI + fecha de nacimiento'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-neutral-200 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/45">{label}</p>
                  <p className="mt-2 text-sm font-medium text-black break-all">{value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          <Button
            type="button"
            onClick={onGenerateProof}
            disabled={!walletConnected || isGeneratingProof || proofGenerated || signed}
            className="bg-black text-white shadow-none hover:bg-black/90 disabled:bg-black disabled:text-white"
          >
            {isGeneratingProof ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {proofGenerated ? 'Prueba generada' : 'Generar prueba ZK'}
          </Button>

          <div
            aria-live="polite"
            className={cn(
              'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm',
              helperTone,
            )}
          >
            {helperIcon}
            <span>{helperText}</span>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}

function SignatureCard({
  walletAddress,
  contractAddress,
  contractHash,
  proofGenerated,
  signed,
  signedAt,
  signingReady,
  leaseTxHash,
  onOpenConfirm,
  onDownloadCopy,
}: {
  walletAddress: string | null
  contractAddress: string | null
  contractHash: string
  proofGenerated: boolean
  signed: boolean
  signedAt: string | null
  signingReady: boolean
  leaseTxHash: string | null
  onOpenConfirm: () => void
  onDownloadCopy: () => void
}) {
  const timestamp = signed ? signedAt ?? 'Registrado en cadena' : 'Pendiente'

  return (
    <SectionCard
      id="signature-section"
      title="Firma del contrato"
      description="La firma final solo se habilita después de generar la prueba ZK."
    >
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['Hash del contrato', contractHash],
            ['Smart contract', contractAddress ?? 'Pendiente de contrato'],
            ['Wallet firmante', walletAddress ? formatShortText(walletAddress, 10) : 'Sin wallet'],
            ['Timestamp', timestamp],
            ['Tx Hash', formatShortText(leaseTxHash, 10)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-neutral-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">{label}</p>
              <p className="mt-2 text-sm font-medium text-black break-all font-mono">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={onOpenConfirm}
            disabled={!proofGenerated || signed || !contractAddress || !signingReady}
            className="bg-black text-white shadow-none hover:bg-black/90 disabled:bg-black/30"
          >
            Firmar con wallet
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onDownloadCopy}
            className="border-neutral-300 bg-white text-black shadow-none hover:bg-black hover:text-white"
          >
            <Download className="h-4 w-4" />
            Descargar copia verificable
          </Button>
        </div>

        <div className={cn(
          'rounded-2xl border p-4 text-sm',
          signed ? 'border-neutral-200 bg-white text-black' : 'border-neutral-200 bg-neutral-50 text-black/60',
        )}>
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4" />
            <span className="font-medium">Estado del contrato</span>
          </div>
          <p className="mt-2">{signed ? 'Firmado' : 'Sin firmar'}</p>
        </div>
      </div>
    </SectionCard>
  )
}

function ConfirmSignatureModal({
  open,
  onOpenChange,
  onConfirm,
  signing,
  contractHash,
  monthlyRent,
  walletAddress,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  signing: boolean
  contractHash: string
  monthlyRent: string
  walletAddress: string | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[28px] border-neutral-200 bg-white shadow-none">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-black">Confirmar firma privada</DialogTitle>
          <DialogDescription className="max-w-xl text-sm leading-6 text-black/65">
            Vas a firmar este contrato revelando únicamente los datos públicos autorizados. Tus datos sensibles permanecerán privados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Contrato', contractHash],
              ['Monto', monthlyRent],
              ['Wallet', walletAddress ?? 'Pendiente'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-neutral-200 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">{label}</p>
                <p className="mt-2 text-sm font-medium text-black break-all">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Datos revelados</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {signatureRevealItems.map((item) => (
                <StatusBadge key={item} tone="outline">
                  {item}
                </StatusBadge>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-neutral-300 bg-white text-black shadow-none hover:bg-black hover:text-white"
            disabled={signing}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={signing}
            className="bg-black text-white shadow-none hover:bg-black/90 disabled:bg-black/50"
          >
            {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirmar y firmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SuccessState({
  onViewContract,
  onDownloadReceipt,
  signedAt,
  transactionId,
  contractHash,
  blockHeight,
}: {
  onViewContract: () => void
  onDownloadReceipt: () => void
  signedAt: string | null
  transactionId: string | null
  contractHash: string
  blockHeight: number | null
}) {
  return (
    <Card className="rounded-[28px] border-neutral-300 bg-white shadow-none">
      <CardContent className="space-y-6 p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-black bg-white">
            <CheckCircle2 className="h-5 w-5 text-black" />
          </span>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-black">Contrato firmado exitosamente</h2>
            <p className="max-w-2xl text-sm leading-6 text-black/65">
              Firma verificada y registrada con un flujo privado. Los datos sensibles siguen fuera de la cadena.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ['Firma', 'Verificada'],
            ['Hash contrato', contractHash],
            ['Transaction ID', formatShortText(transactionId, 10)],
            ['Block Height', blockHeight?.toString() ?? 'Pendiente'],
            ['Fecha de firma', signedAt ?? 'Pendiente'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-neutral-200 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">{label}</p>
              <p className="mt-2 text-sm font-medium text-black break-all">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={onViewContract} className="border-neutral-300 bg-white text-black shadow-none hover:bg-black hover:text-white">
            Ver contrato
          </Button>
          <Button type="button" variant="outline" onClick={onDownloadReceipt} className="border-neutral-300 bg-white text-black shadow-none hover:bg-black hover:text-white">
            Descargar comprobante
          </Button>
          <Button asChild className="bg-black text-white shadow-none hover:bg-black/90">
            <Link to="/">Volver al dashboard</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ActivitySidebar({
  walletConnected,
  proofGenerated,
  signed,
}: {
  walletConnected: boolean
  proofGenerated: boolean
  signed: boolean
}) {
  const timelineItems = [
    'Wallet Conectada',
    'Verificando Datos',
    'Datos públicos seleccionados',
    'Prueba ZK generada',
    'Contrato firmado',
    'Registro enviado al ledger',
  ] as const

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <Card className="rounded-[22px] border-neutral-200 bg-white shadow-none">
        <CardContent className="space-y-6 p-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-black">Activity Timeline</h2>
            <p className="text-sm text-black/60">Private Verification Active</p>
          </div>

          <nav className="space-y-1">
            {[
              { label: 'Activity', icon: <Clock3 className="h-4 w-4" />, active: true },
              { label: 'Vault', icon: <Lock className="h-4 w-4" />, href: '#privacy-panel' },
              { label: 'Network', icon: <Network className="h-4 w-4" />, href: '#proof-section' },
              { label: 'Settings', icon: <Settings className="h-4 w-4" />, href: '#signature-section' },
            ].map((item) => {
              const classes = cn(
                'flex items-center gap-3 border-l-4 px-4 py-3 text-sm transition-colors',
                item.active
                  ? 'border-black bg-black text-white'
                  : 'border-transparent text-black/65 hover:border-neutral-300 hover:bg-neutral-50 hover:text-black',
              )

              if (item.active) {
                return (
                  <button key={item.label} type="button" className={classes} aria-current="page">
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                )
              }

              return (
                <a key={item.label} href={item.href} className={classes}>
                  {item.icon}
                  <span>{item.label}</span>
                </a>
              )
            })}
          </nav>

          <div className="border-t border-neutral-200 pt-6">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-black/50">Eventos Recientes</h3>
            <div className="relative space-y-4 before:absolute before:bottom-0 before:left-2.5 before:top-1 before:w-px before:bg-neutral-200">
              {timelineItems.map((label, index) => {
                const status = getTimelineStatus(index, walletConnected, proofGenerated, signed)
                return (
                  <div key={label} className="relative flex items-start gap-3">
                    <div className="relative z-10 mt-0.5">
                      <TimelineDot status={status} />
                    </div>
                    <div
                      className={cn(
                        'flex-1 rounded-2xl border p-3',
                        status === 'completed'
                          ? 'border-black bg-white text-black'
                          : status === 'active'
                            ? 'border-black bg-neutral-50 text-black'
                            : 'border-neutral-200 bg-white text-black/55',
                      )}
                    >
                      <p className={cn('text-sm font-medium', status === 'pending' && 'text-black/60')}>
                        {label}
                      </p>
                      <p className="mt-1 text-xs text-black/50">
                        {status === 'completed' ? 'Completado' : status === 'active' ? 'En progreso...' : 'Pendiente'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </aside>
  )
}

export function LeasePage() {
  const [eligibilityForm, setEligibilityForm] = useState<EligibilityFormState>({
    fullName: '',
    dni: '',
    birthDate: '',
  })
  const [eligibilityProof, setEligibilityProof] = useState<EligibilityProofState | null>(null)
  const [eligibilityError, setEligibilityError] = useState<string | null>(null)
  const [isGeneratingProof, setIsGeneratingProof] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const [leaseTxHash, setLeaseTxHash] = useState<string | null>(null)
  const [leaseBlockHeight, setLeaseBlockHeight] = useState<number | null>(null)
  const [signedAt, setSignedAt] = useState<string | null>(null)
  const [leaseLedger, setLeaseLedger] = useState<Lease.Ledger | null>(null)
  const eligibilityGenerationRef = useRef(0)
  const contractSectionRef = useRef<HTMLDivElement | null>(null)
  const {
    open,
    setOpen,
    connectingWallet,
    connectedAPI,
    serviceUriConfig,
    status,
    unshieldedAddress,
    shieldedAddresses,
    error,
  } = useWallet()

  const walletConnected = status?.status === 'connected'
  const walletAddress = unshieldedAddress?.unshieldedAddress ?? null
  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS?.trim() || ''
  const proofGenerated = Boolean(eligibilityProof)

  const leasePrivateStateProvider = useMemo(
    () => inMemoryPrivateStateProvider<typeof LEASE_PRIVATE_STATE_ID, LeasePrivateState>(),
    [],
  )

  const leaseZkConfigProvider = useMemo(() => {
    if (!serviceUriConfig) return undefined
    return new CachedFetchZkConfigProvider(
      `${window.location.origin}/midnight/lease`,
      fetch.bind(window),
      () => {},
    )
  }, [serviceUriConfig])

  const leasePublicDataProvider = useMemo(() => {
    if (!serviceUriConfig) return undefined
    return indexerPublicDataProvider(serviceUriConfig.indexerUri, serviceUriConfig.indexerWsUri)
  }, [serviceUriConfig])

  const leaseProofProvider = useMemo(() => {
    if (!serviceUriConfig?.proverServerUri || !leaseZkConfigProvider) return undefined
    return proofClient(serviceUriConfig.proverServerUri, leaseZkConfigProvider, () => {})
  }, [leaseZkConfigProvider, serviceUriConfig])

  const leaseWalletProvider = useMemo<types.WalletProvider | undefined>(() => {
    if (!connectedAPI || !shieldedAddresses) return undefined

    return {
      getCoinPublicKey() {
        return shieldedAddresses.shieldedCoinPublicKey
      },
      getEncryptionPublicKey() {
        return shieldedAddresses.shieldedEncryptionPublicKey
      },
      async balanceTx(tx: ledger.Transaction<ledger.SignatureEnabled, ledger.Proof, ledger.PreBinding>) {
        const serializedTx = toHex(tx.serialize())
        const received = await (connectedAPI as BalanceUnsealedTransactionApi).balanceUnsealedTransaction(serializedTx, {})
        return ledger.Transaction.deserialize<ledger.SignatureEnabled, ledger.Proof, ledger.Binding>(
          'signature',
          'proof',
          'binding',
          fromHex(received.tx),
        )
      },
    }
  }, [connectedAPI, shieldedAddresses])

  const leaseMidnightProvider = useMemo<types.MidnightProvider | undefined>(() => {
    if (!connectedAPI) return undefined

    return {
      async submitTx(tx: ledger.FinalizedTransaction) {
        await connectedAPI.submitTransaction(toHex(tx.serialize()))
        return tx.identifiers()[0]
      },
    }
  }, [connectedAPI])

  const leaseProviders = useMemo(() => {
    if (
      !leasePublicDataProvider ||
      !leaseZkConfigProvider ||
      !leaseProofProvider ||
      !leaseWalletProvider ||
      !leaseMidnightProvider
    ) {
      return undefined
    }

    return {
      privateStateProvider: leasePrivateStateProvider,
      publicDataProvider: leasePublicDataProvider,
      zkConfigProvider: leaseZkConfigProvider,
      proofProvider: leaseProofProvider,
      walletProvider: leaseWalletProvider,
      midnightProvider: leaseMidnightProvider,
    }
  }, [leaseMidnightProvider, leasePrivateStateProvider, leaseProofProvider, leasePublicDataProvider, leaseWalletProvider, leaseZkConfigProvider])

  useEffect(() => {
    const coinPublicKey = shieldedAddresses?.shieldedCoinPublicKey

    if (!coinPublicKey) {
      setLeaseLedger(null)
      setLeaseTxHash(null)
      setLeaseBlockHeight(null)
      setSignedAt(null)
      return
    }

    void leasePrivateStateProvider.set(
      LEASE_PRIVATE_STATE_ID,
      createPrivateState(fromHex(coinPublicKey)),
    )
  }, [leasePrivateStateProvider, shieldedAddresses?.shieldedCoinPublicKey])

  useEffect(() => {
    if (!leasePublicDataProvider || !contractAddress) {
      setLeaseLedger(null)
      setLeaseTxHash(null)
      setLeaseBlockHeight(null)
      return
    }

    const subscription = leasePublicDataProvider
      .contractStateObservable(contractAddress as ContractAddress, { type: 'all' })
      .pipe(
        Rx.map((contractState) => Lease.ledger(contractState.data)),
        Rx.retry({ delay: 500 }),
      )
      .subscribe({
        next: setLeaseLedger,
        error: (leaseStateError) => {
          console.error('Failed to follow lease contract state', leaseStateError)
          setLeaseLedger(null)
        },
      })

    return () => subscription.unsubscribe()
  }, [contractAddress, leasePublicDataProvider])

  useEffect(() => {
    if (!leaseLedger?.tenantClaimed && signedAt) {
      setSignedAt(null)
      setLeaseTxHash(null)
      setLeaseBlockHeight(null)
    }

    if (leaseLedger?.tenantClaimed && !signedAt) {
      setSignedAt(new Date().toLocaleDateString('es-AR'))
    }
  }, [leaseLedger?.tenantClaimed, signedAt])

  useEffect(() => {
    if (leaseLedger?.tenantClaimed) {
      setConfirmOpen(false)
      setIsSigning(false)
    }
  }, [leaseLedger?.tenantClaimed])

  useEffect(() => {
    if (walletConnected || !eligibilityProof) {
      return
    }

    eligibilityGenerationRef.current += 1
    setEligibilityProof(null)
    setEligibilityError(null)
    setIsGeneratingProof(false)
  }, [eligibilityProof, walletConnected])

  useEffect(() => {
    if (!proofGenerated && confirmOpen) {
      setConfirmOpen(false)
    }
  }, [confirmOpen, proofGenerated])

  const handleConnectWallet = () => {
    setOpen(true)
  }

  const handleEligibilityFieldChange = (field: keyof EligibilityFormState, value: string) => {
    const nextValue = field === 'dni' ? sanitizeArgentinianDni(value) : value

    setEligibilityForm((current) => ({
      ...current,
      [field]: nextValue,
    }))
    setEligibilityProof(null)
    setEligibilityError(null)
    setIsGeneratingProof(false)
    eligibilityGenerationRef.current += 1
  }

  const handleGenerateProof = async () => {
    if (!walletConnected || isGeneratingProof || proofGenerated || leaseLedger?.tenantClaimed) return

    const fullName = eligibilityForm.fullName.trim()
    const dni = sanitizeArgentinianDni(eligibilityForm.dni)
    const age = calculateAgeFromBirthDate(eligibilityForm.birthDate)

    if (fullName.length < 3) {
      setEligibilityError('Ingresá tu nombre completo.')
      return
    }

    if (!isValidArgentinianDni(dni)) {
      setEligibilityError('El DNI argentino debe tener 7 u 8 dígitos numéricos.')
      return
    }

    if (age === null || age < 0) {
      setEligibilityError('Elegí una fecha de nacimiento válida.')
      return
    }

    if (age < 18) {
      setEligibilityError('La demo local requiere ser mayor de 18 años.')
      return
    }

    const generationId = ++eligibilityGenerationRef.current

    setEligibilityError(null)
    setIsGeneratingProof(true)

    try {
      await delay(1200)

      if (eligibilityGenerationRef.current !== generationId) {
        return
      }

      setEligibilityProof({
        proofId: createLocalProofId(),
        generatedAt: new Date().toLocaleString('es-AR'),
        age,
      })
    } finally {
      if (eligibilityGenerationRef.current === generationId) {
        setIsGeneratingProof(false)
      }
    }
  }

  const handleOpenConfirm = () => {
    if (!proofGenerated || leaseLedger?.tenantClaimed || !leaseProviders || !contractAddress) return
    setConfirmOpen(true)
  }

  const handleConfirmSignature = async () => {
    if (
      !proofGenerated ||
      isSigning ||
      leaseLedger?.tenantClaimed ||
      !leaseProviders ||
      !contractAddress ||
      !shieldedAddresses?.shieldedCoinPublicKey
    ) {
      return
    }

    setIsSigning(true)
    try {
      const deployedContract = await contracts.findDeployedContract(
        leaseProviders,
        {
          contractAddress: contractAddress as ContractAddress,
          compiledContract: leaseCompiledContract,
          privateStateId: LEASE_PRIVATE_STATE_ID,
          initialPrivateState: createPrivateState(fromHex(shieldedAddresses.shieldedCoinPublicKey)),
        },
      )

      const txData = await deployedContract.callTx.claimLease()
      const finalizedTx = txData as LeaseTxResult
      setLeaseTxHash(finalizedTx.public?.txHash ?? finalizedTx.public?.txId ?? null)
      setLeaseBlockHeight(finalizedTx.public?.blockHeight ?? null)
      setSignedAt(new Date().toLocaleDateString('es-AR'))
      setConfirmOpen(false)
    } catch (error) {
      console.error('Failed to sign lease on-chain', error)
    } finally {
      setIsSigning(false)
    }
  }

  const signed = leaseLedger?.tenantClaimed ?? false
  const contractHash = leaseLedger ? formatHex(leaseLedger.agreementHash) : 'Pendiente'
  const monthlyRent = formatLeaseMoney(leaseLedger?.monthlyRent ?? null, 'Monto pendiente')
  const depositAmount = formatLeaseMoney(leaseLedger?.depositAmount ?? null, 'Monto pendiente')
  const termMonths = leaseLedger ? `${leaseLedger.termMonths.toString()} meses` : 'Plazo pendiente'
  const leaseStateLabel = leaseLedger ? leaseStateLabels[leaseLedger.state] : 'Pendiente de firma'

  const handleDownloadCopy = () => {
    downloadJson('midnight-lease-copia-verificable.json', {
      title: 'Midnight Lease - Contrato Privado',
      status: signed ? 'signed' : proofGenerated ? 'proof-ready' : 'draft',
      contractHash,
      smartContract: contractAddress || 'pending-contract-address',
      wallet: walletAddress ?? 'Pendiente',
      proofId: eligibilityProof?.proofId ?? null,
      eligibilityAge: eligibilityProof?.age ?? null,
      verificationMode: eligibilityProof ? 'local-demo' : 'pending',
      transactionId: leaseTxHash,
      blockHeight: leaseBlockHeight,
    })
  }

  const handleDownloadReceipt = () => {
    downloadJson('midnight-lease-comprobante.json', {
      signature: 'Verificada',
      contractHash,
      proofId: eligibilityProof?.proofId ?? null,
      eligibilityAge: eligibilityProof?.age ?? null,
      verificationMode: eligibilityProof ? 'local-demo' : 'pending',
      transactionId: leaseTxHash,
      blockHeight: leaseBlockHeight,
      signedAt: signedAt ?? 'Pendiente',
    })
  }

  const handleViewContract = () => {
    contractSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div id="top" className="min-h-screen bg-white text-black scroll-smooth">
      <AppHeader
        walletConnected={walletConnected}
        walletConnecting={connectingWallet}
        walletAddress={walletAddress}
        onConnectWallet={handleConnectWallet}
      />

      <main className="mx-auto grid max-w-[1280px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <LeaseHero onConnectWallet={handleConnectWallet} onReviewContract={handleViewContract} />

          <LeaseStepper walletConnected={walletConnected} proofGenerated={proofGenerated} signed={signed} />

          <div ref={contractSectionRef}>
            <ContractStatusCard
              signed={signed}
              contractHash={contractHash}
              monthlyRent={monthlyRent}
              depositAmount={depositAmount}
              termMonths={termMonths}
              leaseStateLabel={leaseStateLabel}
            />
          </div>

          <PrivacyPanel
            walletAddress={walletAddress}
            monthlyRent={monthlyRent}
            contractHash={contractHash}
            proofGenerated={proofGenerated || signed}
          />

          <ProofGenerationCard
            walletConnected={walletConnected}
            proofGenerated={proofGenerated}
            isGeneratingProof={isGeneratingProof}
            signed={signed}
            eligibilityForm={eligibilityForm}
            eligibilityProof={eligibilityProof}
            eligibilityError={eligibilityError}
            onEligibilityFieldChange={handleEligibilityFieldChange}
            onGenerateProof={handleGenerateProof}
          />

          <SignatureCard
            walletAddress={walletAddress}
            contractAddress={contractAddress || null}
            contractHash={contractHash}
            proofGenerated={proofGenerated}
            signed={signed}
            signedAt={signedAt}
            signingReady={Boolean(leaseProviders && contractAddress && shieldedAddresses?.shieldedCoinPublicKey)}
            leaseTxHash={leaseTxHash}
            onOpenConfirm={handleOpenConfirm}
            onDownloadCopy={handleDownloadCopy}
          />

          {signed ? (
            <SuccessState
              onViewContract={handleViewContract}
              onDownloadReceipt={handleDownloadReceipt}
              signedAt={signedAt}
              transactionId={leaseTxHash}
              contractHash={contractHash}
              blockHeight={leaseBlockHeight}
            />
          ) : null}
        </div>

        <ActivitySidebar walletConnected={walletConnected} proofGenerated={proofGenerated} signed={signed} />
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl rounded-[28px] border-neutral-200 bg-white shadow-none">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-xl font-semibold text-black">Conectar wallet</DialogTitle>
            <DialogDescription className="max-w-2xl text-sm leading-6 text-black/65">
              Elegí una wallet compatible para conectar con Midnight Preprod. El flujo actual usa el widget existente del proyecto.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <ScreenMain setOpen={setOpen} selectedNetwork={networkID.PREPROD} />
          </div>

          {error ? (
            <p className="text-sm text-black/60">No se pudo conectar la wallet. Probá de nuevo o revisá la extensión instalada.</p>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmSignatureModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleConfirmSignature}
        signing={isSigning}
        contractHash={contractHash}
        monthlyRent={monthlyRent}
        walletAddress={walletAddress}
      />
    </div>
  )
}
