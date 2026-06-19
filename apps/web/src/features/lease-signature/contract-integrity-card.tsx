import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { RentalContractArtifacts, LeaseSignatureArtifacts } from './signature-payload'
import type { Lease } from '@midnight-lease/lease-contract'

type VerifyRow = {
  label: string
  local: string | null
  onChain: string | null
}

type Props = {
  leaseLedger: Lease.Ledger | null
  preparedContract: RentalContractArtifacts | null
  landlordSignatureArtifacts: LeaseSignatureArtifacts | null
  tenantSignatureArtifacts: LeaseSignatureArtifacts | null
}

function bytesToHex(value: Uint8Array | null | undefined): string | null {
  if (!value) return null
  const emptyHash = 'registry:empty'
  const hex = `0x${Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
  const decoded = new TextDecoder().decode(value).replace(/\0/g, '')
  if (decoded.startsWith(emptyHash)) return null
  return hex
}

function truncate(value: string | null, chars = 12): string {
  if (!value) return '—'
  if (value.length <= chars * 2 + 3) return value
  return `${value.slice(0, chars)}...${value.slice(-chars)}`
}

type Status = 'match' | 'mismatch' | 'pending'

function rowStatus(row: VerifyRow): Status {
  if (!row.local || !row.onChain) return 'pending'
  return row.local.toLowerCase() === row.onChain.toLowerCase() ? 'match' : 'mismatch'
}

function StatusIcon({ status }: { status: Status }) {
  if (status === 'match') return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
  if (status === 'mismatch') return <XCircle className="h-4 w-4 shrink-0 text-red-500" />
  return <MinusCircle className="h-4 w-4 shrink-0 text-black/25" />
}

function VerifyTable({ rows }: { rows: VerifyRow[] }) {
  return (
    <div className="divide-y divide-neutral-100">
      {rows.map((row) => {
        const status = rowStatus(row)
        return (
          <div key={row.label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <StatusIcon status={status} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-black/45">{row.label}</p>
              <div className="mt-1 grid gap-0.5 text-xs">
                <span className="text-black/60">
                  <span className="font-medium text-black/40">local </span>
                  <span className="font-mono break-all">{truncate(row.local)}</span>
                </span>
                <span className="text-black/60">
                  <span className="font-medium text-black/40">chain </span>
                  <span className="font-mono break-all">{truncate(row.onChain)}</span>
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ContractIntegrityCard({ leaseLedger, preparedContract, landlordSignatureArtifacts, tenantSignatureArtifacts }: Props) {
  const rows: VerifyRow[] = [
    {
      label: 'Contract ID hash',
      local: preparedContract?.contractIdHashHex ?? null,
      onChain: bytesToHex(leaseLedger?.contractIdHash),
    },
    {
      label: 'Contract hash',
      local: preparedContract?.contractHashHex ?? null,
      onChain: bytesToHex(leaseLedger?.contractHash),
    },
    {
      label: 'Landlord commitment',
      local: preparedContract?.landlordCommitmentHex ?? null,
      onChain: bytesToHex(leaseLedger?.landlordCommitment),
    },
    {
      label: 'Tenant commitment',
      local: preparedContract?.tenantCommitmentHex ?? null,
      onChain: bytesToHex(leaseLedger?.tenantCommitment),
    },
    {
      label: 'Landlord signature hash',
      local: landlordSignatureArtifacts?.payloadHashHex ?? null,
      onChain: bytesToHex(leaseLedger?.landlordSignatureHash),
    },
    {
      label: 'Tenant signature hash',
      local: tenantSignatureArtifacts?.payloadHashHex ?? null,
      onChain: bytesToHex(leaseLedger?.tenantSignatureHash),
    },
  ]

  const matched = rows.filter((r) => rowStatus(r) === 'match').length
  const mismatched = rows.filter((r) => rowStatus(r) === 'mismatch').length
  const pending = rows.filter((r) => rowStatus(r) === 'pending').length

  return (
    <Card className="rounded-[24px] border-neutral-200 bg-white shadow-none">
      <CardHeader>
        <CardTitle>Verificación de integridad</CardTitle>
        <CardDescription>
          Compara los hashes generados localmente contra el estado público on-chain.
          ✅ = coinciden · ❌ = discrepancia · — = pendiente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 text-sm">
          <span className="font-medium text-emerald-600">{matched} coinciden</span>
          {mismatched > 0 && <span className="font-medium text-red-500">{mismatched} discrepancias</span>}
          {pending > 0 && <span className="text-black/40">{pending} pendientes</span>}
        </div>
        <VerifyTable rows={rows} />
      </CardContent>
    </Card>
  )
}
