import { Lease, type LeasePrivateState } from '@midnight-lease/lease-contract'
import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js'
import { contracts, types } from '@midnight-ntwrk/midnight-js'

export type LeaseCircuits = ProvableCircuitId<Lease.Contract<LeasePrivateState>>

export const LeasePrivateStateId = 'leasePrivateState' as const

export type LeaseProviders = types.MidnightProviders<LeaseCircuits, typeof LeasePrivateStateId, LeasePrivateState>

export type LeaseContract = Lease.Contract<LeasePrivateState>

export type DeployedLeaseContract = contracts.DeployedContract<LeaseContract> | contracts.FoundContract<LeaseContract>

export const createLeasePrivateState = (coinPublicKey: string): LeasePrivateState => ({
  callerAddress: coinPublicKeyToBytes(coinPublicKey),
})

export function coinPublicKeyToBytes(coinPublicKey: string): Uint8Array {
  const normalized = coinPublicKey.trim().replace(/^0x/, '')

  if (/^[0-9a-fA-F]+$/.test(normalized) && normalized.length % 2 === 0) {
    return Uint8Array.from(Buffer.from(normalized, 'hex'))
  }

  return new TextEncoder().encode(coinPublicKey)
}

export function formatHex(bytes: Uint8Array, visiblePairs = 4): string {
  const hex = Buffer.from(bytes).toString('hex')

  if (hex.length <= visiblePairs * 2) {
    return `0x${hex}`
  }

  return `0x${hex.slice(0, visiblePairs * 2)}...${hex.slice(-visiblePairs * 2)}`
}
