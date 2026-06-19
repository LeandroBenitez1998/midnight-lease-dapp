import { useEffect, useState } from 'react'
import * as Rx from 'rxjs'
import { Download, FileText, Loader2, Network, PenTool, Receipt, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SignaturePad } from '@/components/signature-pad'
import { cn } from '@/lib/utils'
import {
  buildLeaseSignatureArtifacts,
  buildRentalContractArtifacts,
  type LeaseSignatureArtifacts,
  type RentalContractArtifacts,
} from '@/features/lease-signature/signature-payload'
import { ContractIntegrityCard } from '@/features/lease-signature/contract-integrity-card'
import { CompiledContract } from '@midnight-ntwrk/compact-js'
import { fromHex, type ContractAddress } from '@midnight-ntwrk/compact-runtime'
import { contracts } from '@midnight-ntwrk/midnight-js'
import { Lease, createPrivateState } from '@midnight-lease/lease-contract'
import { useWallet } from '@/modules/midnight/wallet-widget/hooks/useWallet'
import { useLeaseProviders } from '@/modules/midnight/lease-sdk/hooks/useLeaseProviders'
import { type DeployedLeaseContract } from '@/modules/midnight/lease-sdk/api/common-types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/modules/midnight/wallet-widget/ui/common/dialog'
import { networkID } from '@/modules/midnight/wallet-widget/ui/common/common-values'
import ScreenMain from '@/modules/midnight/wallet-widget/ui/screen-main'
import { sendNightViaZswap } from '@/modules/midnight/lease-sdk/api/nightTransfer'

const LEASE_PRIVATE_STATE_ID = 'leasePrivateState' as const

const leaseCompiledContract = CompiledContract.make('lease', Lease.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(`${window.location.origin}/midnight/lease`),
)

type ActionTxResult = {
  public?: {
    txHash?: string
    txId?: string
    blockHeight?: number
  }
}

type RentalFormState = {
  landlordName: string
  landlordDocument: string
  landlordWallet: string
  tenantName: string
  tenantDocument: string
  tenantWallet: string
  propertyAddress: string
  monthlyRent: string
  currency: string
  durationMonths: string
  deposit: string
  totalDue: string
  landlordSignatureDataUrl: string | null
  tenantSignatureDataUrl: string | null
}

const initialFormState: RentalFormState = {
  landlordName: '',
  landlordDocument: '',
  landlordWallet: '',
  tenantName: '',
  tenantDocument: '',
  tenantWallet: '',
  propertyAddress: '',
  monthlyRent: '',
  currency: 'USD',
  durationMonths: '12',
  deposit: '',
  totalDue: '',
  landlordSignatureDataUrl: null,
  tenantSignatureDataUrl: null,
}

function formatShort(value: string | null | undefined, visible = 10): string {
  if (!value) return 'Pendiente'
  if (value.length <= visible * 2 + 3) return value
  return `${value.slice(0, visible)}...${value.slice(-visible)}`
}

function bytesToHex(value: Uint8Array | null | undefined): string {
  if (!value) return ''
  return `0x${Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function formatBytes(value: Uint8Array | null | undefined): string {
  return value ? formatShort(bytesToHex(value), 8) : 'Pendiente'
}

function hexToBytes32(value: string): Uint8Array {
  return fromHex(value.replace(/^0x/, ''))
}

function formatRentalStatus(value: Lease.RentalStatus | null | undefined): string {
  switch (value) {
    case Lease.RentalStatus.EMPTY:
      return 'EMPTY'
    case Lease.RentalStatus.REGISTERED:
      return 'REGISTERED'
    case Lease.RentalStatus.PARTIALLY_SIGNED:
      return 'PARTIALLY_SIGNED'
    case Lease.RentalStatus.SIGNED:
      return 'SIGNED'
    case Lease.RentalStatus.PAID:
      return 'PAID'
    case Lease.RentalStatus.ACTIVE:
      return 'ACTIVE'
    default:
      return 'Pendiente'
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildContractPreviewHtml(artifacts: RentalContractArtifacts): string {
  const { payload } = artifacts
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Midnight Lease Draft</title>
    <style>
      body { font-family: "Times New Roman", serif; margin: 48px; color: #111; }
      h1 { font-size: 28px; margin-bottom: 8px; }
      p { line-height: 1.6; }
      .meta { margin: 24px 0; padding: 16px; border: 1px solid #d4d4d4; }
      .section { margin-top: 28px; }
      .line { border-bottom: 1px solid #111; height: 48px; margin-top: 20px; }
      small { color: #555; }
    </style>
  </head>
  <body>
    <h1>Rental Agreement Draft</h1>
    <p><small>Este documento queda local. On-chain sólo se registra el hash final y los commitments de las partes.</small></p>
    <div class="meta">
      <p><strong>Property:</strong> ${escapeHtml(payload.propertyAddress)}</p>
      <p><strong>Landlord:</strong> ${escapeHtml(payload.landlordName)} (${escapeHtml(payload.landlordDocument)})</p>
      <p><strong>Tenant:</strong> ${escapeHtml(payload.tenantName)} (${escapeHtml(payload.tenantDocument)})</p>
      <p><strong>Monthly rent:</strong> ${escapeHtml(payload.monthlyRent)} ${escapeHtml(payload.currency)}</p>
      <p><strong>Deposit:</strong> ${escapeHtml(payload.deposit)} ${escapeHtml(payload.currency)}</p>
      <p><strong>Duration:</strong> ${escapeHtml(payload.durationMonths)} months</p>
      <p><strong>Total due:</strong> ${escapeHtml(payload.totalDue)} ${escapeHtml(payload.currency)}</p>
      <p><strong>Contract ID hash:</strong> ${escapeHtml(artifacts.contractIdHashHex)}</p>
      <p><strong>Contract hash:</strong> ${escapeHtml(artifacts.contractHashHex)}</p>
    </div>
    <div class="section">
      <p>Las partes aceptan que el contenido completo del contrato se mantiene local en sus dispositivos o en una copia descargada, mientras que Midnight funciona como un registro mínimo de hashes, commitments y estado.</p>
    </div>
    <div class="section">
      <p><strong>Landlord signature</strong></p>
      <div class="line"></div>
    </div>
    <div class="section">
      <p><strong>Tenant signature</strong></p>
      <div class="line"></div>
    </div>
  </body>
</html>`
}

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function FlowStep({ active, done, title, detail }: { active?: boolean; done?: boolean; title: string; detail: string }) {
  return (
    <div className={cn('rounded-2xl border p-4', done ? 'border-black bg-white' : active ? 'border-black bg-neutral-50' : 'border-neutral-200 bg-white')}>
      <p className="text-sm font-semibold text-black">{title}</p>
      <p className="mt-3 text-sm leading-6 text-black/60">{detail}</p>
    </div>
  )
}

export function LeasePage() {
  const [form, setForm] = useState<RentalFormState>(initialFormState)
  const [preparedContract, setPreparedContract] = useState<RentalContractArtifacts | null>(null)
  const [landlordSignatureArtifacts, setLandlordSignatureArtifacts] = useState<LeaseSignatureArtifacts | null>(null)
  const [tenantSignatureArtifacts, setTenantSignatureArtifacts] = useState<LeaseSignatureArtifacts | null>(null)
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [txRef, setTxRef] = useState<string | null>(null)
  const [txBlock, setTxBlock] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nightAmount, setNightAmount] = useState('')
  const [zswapTxId, setZswapTxId] = useState<string | null>(null)
  const { open, setOpen, connectingWallet, disconnect, connectedAPI, unshieldedAddress, shieldedAddresses, error } = useWallet()
  const { providers } = useLeaseProviders()

  const walletConnected = providers !== null
  const walletAddress = unshieldedAddress?.unshieldedAddress ?? null
  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS?.trim() || ''

  const [leaseLedger, setLeaseLedger] = useState<Lease.Ledger | null>(null)

  useEffect(() => {
    if (!providers?.publicDataProvider || !contractAddress) {
      setLeaseLedger(null)
      return
    }

    const subscription = providers.publicDataProvider
      .contractStateObservable(contractAddress as ContractAddress, { type: 'all' })
      .pipe(
        Rx.map((contractState) => Lease.ledger(contractState.data)),
        Rx.retry({ delay: 500 }),
      )
      .subscribe({
        next: setLeaseLedger,
        error: (stateError) => {
          console.error('Failed to follow lease contract state', stateError)
          setLeaseLedger(null)
        },
      })

    return () => subscription.unsubscribe()
  }, [contractAddress, providers])

  const currentStatus = leaseLedger?.status ?? Lease.RentalStatus.EMPTY
  const registered = currentStatus >= Lease.RentalStatus.REGISTERED
  const fullySigned = currentStatus >= Lease.RentalStatus.SIGNED
  const paid = currentStatus >= Lease.RentalStatus.PAID
  const active = currentStatus >= Lease.RentalStatus.ACTIVE

  function resetMessages() {
    setActionError(null)
    setActionStatus(null)
  }

  function updateField<K extends keyof RentalFormState>(key: K, value: RentalFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    resetMessages()
  }

  async function getDeployedContract(): Promise<DeployedLeaseContract> {
    if (!providers || !shieldedAddresses?.shieldedCoinPublicKey) {
      throw new Error('Conectá una wallet compatible antes de enviar transacciones.')
    }

    if (!contractAddress) {
      throw new Error('Falta VITE_CONTRACT_ADDRESS con el contrato simplificado desplegado.')
    }

    // ponytail: private state already initialized by useLeaseProviders
    return contracts.findDeployedContract(providers, {
      contractAddress: contractAddress as ContractAddress,
      compiledContract: leaseCompiledContract,
      privateStateId: LEASE_PRIVATE_STATE_ID,
      initialPrivateState: createPrivateState(shieldedAddresses.shieldedCoinPublicKey),
    })
  }

  async function runTx(statusMessage: string, action: (deployedContract: DeployedLeaseContract) => Promise<ActionTxResult>) {
    if (isSubmitting) return null

    setIsSubmitting(true)
    setActionError(null)
    setActionStatus(statusMessage)

    try {
      const deployedContract = await getDeployedContract()
      const txData = await action(deployedContract)
      setTxRef(txData.public?.txHash ?? txData.public?.txId ?? null)
      setTxBlock(txData.public?.blockHeight ?? null)
      return txData
    } catch (submitError) {
      console.error('Lease registry action failed', submitError)
      setActionStatus(null)
      setActionError(submitError instanceof Error ? submitError.message : String(submitError))
      return null
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePrepareContract() {
    try {
      resetMessages()
      const artifacts = await buildRentalContractArtifacts({
        landlordName: form.landlordName,
        landlordDocument: form.landlordDocument,
        landlordWallet: form.landlordWallet,
        tenantName: form.tenantName,
        tenantDocument: form.tenantDocument,
        tenantWallet: form.tenantWallet,
        propertyAddress: form.propertyAddress,
        monthlyRent: form.monthlyRent,
        currency: form.currency,
        durationMonths: form.durationMonths,
        deposit: form.deposit,
        totalDue: form.totalDue,
        createdAt: new Date().toISOString(),
      })

      setPreparedContract(artifacts)
      setActionStatus('Contrato local preparado. Ya podés revisar, descargar y registrar sólo los hashes on-chain.')
    } catch (prepareError) {
      setActionError(prepareError instanceof Error ? prepareError.message : String(prepareError))
    }
  }

  async function handleDownloadPreview() {
    if (!preparedContract) {
      setActionError('Primero prepará el contrato local para generar la vista descargable.')
      return
    }

    downloadTextFile('midnight-lease-preview.html', buildContractPreviewHtml(preparedContract), 'text/html;charset=utf-8')
    setActionStatus('Se descargó una copia HTML local del contrato.')
  }

  async function handleRegisterOnChain() {
    if (!preparedContract) {
      setActionError('Primero prepará el contrato local para obtener los hashes del registro.')
      return
    }

    const txData = await runTx('Registrando hashes mínimos del contrato en Midnight...', (deployedContract) =>
      deployedContract.callTx.registerRentalContract(
        hexToBytes32(preparedContract.contractIdHashHex),
        hexToBytes32(preparedContract.contractHashHex),
        hexToBytes32(preparedContract.landlordCommitmentHex),
        hexToBytes32(preparedContract.tenantCommitmentHex),
      ),
    )

    if (txData) {
      setActionStatus(`Contrato registrado. On-chain quedaron ${formatShort(preparedContract.contractIdHashHex, 8)} y ${formatShort(preparedContract.contractHashHex, 8)}.`)
    }
  }

  async function handleSign(role: 'landlord' | 'tenant') {
    if (!preparedContract) {
      setActionError('Primero registrá o al menos prepará el contrato local.')
      return
    }

    const signatureDataUrl = role === 'landlord' ? form.landlordSignatureDataUrl : form.tenantSignatureDataUrl
    if (!signatureDataUrl) {
      setActionError(`Necesitamos la firma manuscrita de ${role === 'landlord' ? 'la parte propietaria' : 'la parte inquilina'}.`)
      return
    }

    const signatureArtifacts = await buildLeaseSignatureArtifacts({
      contractIdHash: preparedContract.contractIdHashHex,
      signerRole: role,
      signerName: role === 'landlord' ? form.landlordName : form.tenantName,
      signerDocument: role === 'landlord' ? form.landlordDocument : form.tenantDocument,
      signerWallet: role === 'landlord' ? (walletAddress ?? '') : form.tenantWallet,
      signatureDataUrl,
      signedAt: new Date().toISOString(),
    })

    const signerCommitmentHex = role === 'landlord' ? preparedContract.landlordCommitmentHex : preparedContract.tenantCommitmentHex
    const txData = await runTx(`Registrando firma ${role === 'landlord' ? 'del propietario' : 'del inquilino'}...`, (deployedContract) =>
      deployedContract.callTx.markContractSigned(
        hexToBytes32(preparedContract.contractIdHashHex),
        hexToBytes32(signerCommitmentHex),
        hexToBytes32(signatureArtifacts.payloadHashHex),
      ),
    )

    if (txData) {
      if (role === 'landlord') {
        setLandlordSignatureArtifacts(signatureArtifacts)
      } else {
        setTenantSignatureArtifacts(signatureArtifacts)
      }
      setActionStatus(`Firma ${role === 'landlord' ? 'del propietario' : 'del inquilino'} registrada. Sólo viajó el hash ${formatShort(signatureArtifacts.payloadHashHex, 8)}.`)
    }
  }

  async function handlePayRent() {
    if (!preparedContract) {
      setActionError('Primero prepará el contrato local.')
      return
    }

    const parsedAmount = Number.parseFloat(nightAmount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setActionError('Ingresá un monto válido de NIGHT a transferir.')
      return
    }

    // ponytail: 1 NIGHT = 1_000_000 Stars. parseFloat + round is fine for demo amounts.
    const amountStars = BigInt(Math.round(parsedAmount * 1_000_000))

    if (!preparedContract.payload.landlordWallet) {
      setActionError('Ingresá la wallet del landlord (recipient) antes de pagar.')
      return
    }

    if (!connectedAPI) {
      setActionError('Conectá una wallet compatible antes de enviar transacciones.')
      return
    }

    setIsSubmitting(true)
    setActionError(null)
    setActionStatus(`Enviando ${nightAmount} NIGHT a la wallet del landlord vía Zswap...`)

    try {
      const { txProofHex, txId } = await sendNightViaZswap(connectedAPI, amountStars, preparedContract.payload.landlordWallet)
      setZswapTxId(txId)

      setActionStatus('NIGHT enviado. Registrando comprobante on-chain...')

      const deployedContract = await getDeployedContract()
      const paidTx = await deployedContract.callTx.markContractPaid(
        hexToBytes32(preparedContract.contractIdHashHex),
        hexToBytes32(txProofHex),
      )
      setTxRef(paidTx.public?.txHash ?? paidTx.public?.txId ?? null)
      setTxBlock(paidTx.public?.blockHeight ?? null)

      setActionStatus('Pago registrado. Activando contrato...')

      const activatedTx = await deployedContract.callTx.activateContract(
        hexToBytes32(preparedContract.contractIdHashHex),
      )
      setTxRef(activatedTx.public?.txHash ?? activatedTx.public?.txId ?? null)
      setTxBlock(activatedTx.public?.blockHeight ?? null)
      setActionStatus(`¡Contrato activado! ${nightAmount} NIGHT enviados vía Zswap.`)
    } catch (payError) {
      console.error('Payment failed', payError)
      setActionError(payError instanceof Error ? payError.message : String(payError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
    <main className="mx-auto grid max-w-[1180px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-6">
          <Card className="rounded-[30px] border-neutral-200 bg-white shadow-none">
            <CardContent className="space-y-6 p-8 sm:p-10">
              <div className="max-w-3xl space-y-4">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-black/55">Minimal rental registry</p>
                <h1 className="text-3xl font-semibold tracking-tight text-black sm:text-5xl">
                  Contrato local, hashes on-chain, cero backend.
                </h1>
                <p className="text-base leading-7 text-black/70 sm:text-lg">
                  Esta versión deja TODO el contenido sensible en el navegador o en una copia descargable. Midnight sólo registra <code>contractIdHash</code>, <code>contractHash</code>, commitments, hashes de firma, pago y estado.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-black/70">
                Flujo demo: preparás el contrato local, lo revisás, registrás el hash, dibujás ambas firmas y confirmás el pago — la activación es automática. Nada de PDFs, Supabase ni persistencia adicional.
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-4">
            <FlowStep done={Boolean(preparedContract)} active={!preparedContract} title="1. Datos" detail="Completá los datos mínimos del alquiler y prepará el borrador local." />
            <FlowStep done={registered} active={Boolean(preparedContract) && !registered} title="2. Registro" detail="Subí sólo los hashes y commitments mínimos a Midnight." />
            <FlowStep done={fullySigned} active={registered && !fullySigned} title="3. Firmas" detail="Cada firma manuscrita se hashea localmente antes de la tx." />
            <FlowStep done={active} active={paid && !active} title="4. Pago + Active" detail="Registrá el pago hash y activá el contrato." />
          </div>

          <Card className="rounded-[24px] border-neutral-200 bg-white shadow-none">
            <CardHeader>
              <CardTitle>Datos mínimos del contrato</CardTitle>
              <CardDescription>Legaltech blanco/negro, sin workflow corporativo largo: cargás lo esencial y el resto queda local.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Landlord name</span>
                  <input type="text" value={form.landlordName} onChange={(event) => updateField('landlordName', event.currentTarget.value)} placeholder="Ada Lovelace" className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Landlord document</span>
                  <input type="text" value={form.landlordDocument} onChange={(event) => updateField('landlordDocument', event.currentTarget.value)} placeholder="20123456" className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Landlord wallet (recipient NIGHT)</span>
                  <input type="text" value={form.landlordWallet} onChange={(event) => updateField('landlordWallet', event.currentTarget.value)} placeholder="mn_addr_preprod1..." className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Tenant name</span>
                  <input type="text" value={form.tenantName} onChange={(event) => updateField('tenantName', event.currentTarget.value)} placeholder="Grace Hopper" className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Tenant document</span>
                  <input type="text" value={form.tenantDocument} onChange={(event) => updateField('tenantDocument', event.currentTarget.value)} placeholder="30987654" className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Tenant wallet</span>
                  <input type="text" value={form.tenantWallet} onChange={(event) => updateField('tenantWallet', event.currentTarget.value)} placeholder="mn_addr_preprod1..." className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Property address</span>
                  <input type="text" value={form.propertyAddress} onChange={(event) => updateField('propertyAddress', event.currentTarget.value)} placeholder="742 Evergreen Terrace" className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Monthly rent</span>
                  <input type="text" value={form.monthlyRent} onChange={(event) => updateField('monthlyRent', event.currentTarget.value)} placeholder="1200" className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Currency</span>
                  <input type="text" value={form.currency} onChange={(event) => updateField('currency', event.currentTarget.value)} placeholder="USD" className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm uppercase text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Duration months</span>
                  <input type="text" value={form.durationMonths} onChange={(event) => updateField('durationMonths', event.currentTarget.value)} placeholder="12" className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Deposit</span>
                  <input type="text" value={form.deposit} onChange={(event) => updateField('deposit', event.currentTarget.value)} placeholder="1200" className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Total due</span>
                  <input type="text" value={form.totalDue} onChange={(event) => updateField('totalDue', event.currentTarget.value)} placeholder="2400" className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10" />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={handlePrepareContract} disabled={isSubmitting} className="bg-black text-white shadow-none hover:bg-black/90">
                  <FileText className="h-4 w-4" />
                  Preparar contrato local
                </Button>
                <Button type="button" variant="outline" onClick={handleDownloadPreview} disabled={!preparedContract || isSubmitting} className="border-neutral-300 bg-white text-black shadow-none hover:bg-black hover:text-white">
                  <Download className="h-4 w-4" />
                  Descargar HTML local
                </Button>
                <Button type="button" variant="outline" onClick={handleRegisterOnChain} disabled={!preparedContract || isSubmitting} className="border-neutral-300 bg-white text-black shadow-none hover:bg-black hover:text-white">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Registrar hashes on-chain
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-neutral-200 bg-white shadow-none">
            <CardHeader>
              <CardTitle>Firmas manuscritas</CardTitle>
              <CardDescription>Las imágenes quedan locales; cada tx envía únicamente el hash final del payload firmado.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Landlord signature</p>
                  <p className="mt-2 text-sm text-black/55">La firma se hashea localmente junto con nombre, documento, wallet y contractIdHash.</p>
                </div>
                <SignaturePad value={form.landlordSignatureDataUrl} onChange={(value) => updateField('landlordSignatureDataUrl', value)} disabled={isSubmitting} />
                <Button type="button" variant="outline" onClick={() => void handleSign('landlord')} disabled={!preparedContract || isSubmitting} className="border-neutral-300 bg-white text-black shadow-none hover:bg-black hover:text-white">
                  <PenTool className="h-4 w-4" />
                  Firmar como propietario
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Tenant signature</p>
                  <p className="mt-2 text-sm text-black/55">Mismo criterio: sólo sube el hash final, no la imagen ni los datos personales.</p>
                </div>
                <SignaturePad value={form.tenantSignatureDataUrl} onChange={(value) => updateField('tenantSignatureDataUrl', value)} disabled={isSubmitting} />
                <Button type="button" variant="outline" onClick={() => void handleSign('tenant')} disabled={!preparedContract || isSubmitting} className="border-neutral-300 bg-white text-black shadow-none hover:bg-black hover:text-white">
                  <PenTool className="h-4 w-4" />
                  Firmar como inquilino
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-neutral-200 bg-white shadow-none">
            <CardHeader>
              <CardTitle>Pago con NIGHT</CardTitle>
              <CardDescription>El pago se hace con NIGHT real vía Zswap (shielded). El txId de la transferencia queda registrado on-chain como comprobante.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">Monto en NIGHT</span>
                <input
                  type="text"
                  value={nightAmount}
                  onChange={(e) => setNightAmount(e.currentTarget.value)}
                  placeholder="10"
                  className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={handlePayRent} disabled={!preparedContract || isSubmitting} className="bg-black text-white shadow-none hover:bg-black/90 disabled:bg-black/40">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                  {isSubmitting ? 'Procesando...' : 'Pagar y activar'}
                </Button>
              </div>

              {zswapTxId ? (
                <div className="rounded-2xl border border-black/10 bg-neutral-50 p-4 text-sm">
                  <p className="text-xs uppercase tracking-[0.14em] text-black/45">Zswap Transfer Tx ID</p>
                  <p className="mt-1 break-all font-medium text-black">{formatShort(zswapTxId, 16)}</p>
                </div>
              ) : null}

              {actionError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</div> : null}
              {actionStatus ? <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-black/70">{actionStatus}</div> : null}
            </CardContent>
          </Card>

          <ContractIntegrityCard
            leaseLedger={leaseLedger}
            preparedContract={preparedContract}
            landlordSignatureArtifacts={landlordSignatureArtifacts}
            tenantSignatureArtifacts={tenantSignatureArtifacts}
          />

          {preparedContract ? (
            <Card className="rounded-[24px] border-neutral-200 bg-white shadow-none">
              <CardHeader>
                <CardTitle>Preview local</CardTitle>
                <CardDescription>Todo esto vive en el navegador o en la copia descargada; no entra crudo a la chain.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-black/45">Contract ID hash</p>
                    <p className="mt-1 break-all font-medium text-black">{preparedContract.contractIdHashHex}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-black/45">Contract hash</p>
                    <p className="mt-1 break-all font-medium text-black">{preparedContract.contractHashHex}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-black/45">Landlord commitment</p>
                    <p className="mt-1 break-all font-medium text-black">{preparedContract.landlordCommitmentHex}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-black/45">Tenant commitment</p>
                    <p className="mt-1 break-all font-medium text-black">{preparedContract.tenantCommitmentHex}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm leading-7 text-black/75">
                  <p><strong>Property:</strong> {preparedContract.payload.propertyAddress}</p>
                  <p><strong>Landlord:</strong> {preparedContract.payload.landlordName} ({preparedContract.payload.landlordDocument})</p>
                  <p><strong>Tenant:</strong> {preparedContract.payload.tenantName} ({preparedContract.payload.tenantDocument})</p>
                  <p><strong>Economics:</strong> {preparedContract.payload.monthlyRent} {preparedContract.payload.currency}/month, deposit {preparedContract.payload.deposit}, total due {preparedContract.payload.totalDue}, duration {preparedContract.payload.durationMonths} months.</p>
                </div>

                {(landlordSignatureArtifacts || tenantSignatureArtifacts || zswapTxId) ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {landlordSignatureArtifacts ? (
                      <div className="rounded-2xl border border-neutral-200 p-4 text-sm">
                        <p className="text-xs uppercase tracking-[0.14em] text-black/45">Landlord signature hash</p>
                        <p className="mt-2 break-all font-medium text-black">{landlordSignatureArtifacts.payloadHashHex}</p>
                      </div>
                    ) : null}
                    {tenantSignatureArtifacts ? (
                      <div className="rounded-2xl border border-neutral-200 p-4 text-sm">
                        <p className="text-xs uppercase tracking-[0.14em] text-black/45">Tenant signature hash</p>
                        <p className="mt-2 break-all font-medium text-black">{tenantSignatureArtifacts.payloadHashHex}</p>
                      </div>
                    ) : null}
                    {zswapTxId ? (
                      <div className="rounded-2xl border border-neutral-200 p-4 text-sm">
                        <p className="text-xs uppercase tracking-[0.14em] text-black/45">Zswap payment proof</p>
                        <p className="mt-2 break-all font-medium text-black">{formatShort(zswapTxId, 16)}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </section>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card className="rounded-[24px] border-neutral-200 bg-white shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Network className="h-5 w-5" /> Estado on-chain</CardTitle>
              <CardDescription>Registro mínimo público del contrato.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                ['Contrato', contractAddress ? formatShort(contractAddress, 8) : 'Falta VITE_CONTRACT_ADDRESS'],
                ['Status', formatRentalStatus(leaseLedger?.status)],
                ['Contract ID hash', formatBytes(leaseLedger?.contractIdHash)],
                ['Contract hash', formatBytes(leaseLedger?.contractHash)],
                ['Landlord commitment', formatBytes(leaseLedger?.landlordCommitment)],
                ['Tenant commitment', formatBytes(leaseLedger?.tenantCommitment)],
                ['Landlord signature hash', formatBytes(leaseLedger?.landlordSignatureHash)],
                ['Tenant signature hash', formatBytes(leaseLedger?.tenantSignatureHash)],
                ['Payment hash', formatBytes(leaseLedger?.paymentHash)],
                ['Wallet conectada', walletAddress ? formatShort(walletAddress, 8) : 'No conectada'],
                ['Tx reciente', formatShort(txRef, 8)],
                ['Bloque', txBlock?.toString() ?? 'Pendiente'],
              ].map(([label, value]) => (
                <div key={label} className="border-b border-neutral-200 pb-3 last:border-b-0 last:pb-0">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">{label}</p>
                  <p className="mt-1 break-all text-sm font-medium text-black">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl rounded-[28px] border-neutral-200 bg-white shadow-none">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-xl font-semibold text-black">Conectar wallet</DialogTitle>
            <DialogDescription className="max-w-2xl text-sm leading-6 text-black/65">
              Elegí una wallet compatible para conectar con Midnight Preprod.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <ScreenMain setOpen={setOpen} selectedNetwork={networkID.PREPROD} />
          </div>
          {error ? <p className="text-sm text-black/60">No se pudo conectar la wallet. Probá de nuevo o revisá la extensión instalada.</p> : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
