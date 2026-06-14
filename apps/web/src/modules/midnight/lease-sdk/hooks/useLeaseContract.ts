import { useCallback, useEffect, useMemo, useState } from 'react'
import { useWallet } from '@/modules/midnight/wallet-widget/hooks/useWallet'
import { type ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api'
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider'
import { CachedFetchZkConfigProvider } from '@/modules/midnight/wallet-widget/utils/providersWrappers/zkConfigProvider'
import { proofClient, noopProofClient } from '@/modules/midnight/wallet-widget/utils/providersWrappers/proofClient'
import { WrappedPublicDataProvider } from '@/modules/midnight/wallet-widget/utils/providersWrappers/publicDataProvider'
import { inMemoryPrivateStateProvider } from '@/modules/midnight/wallet-widget/utils/customImplementations/in-memory-private-state-provider'
import * as ledger from '@midnight-ntwrk/ledger-v8'
import { fromHex, toHex } from '@midnight-ntwrk/compact-runtime'
import { Lease } from '@midnight-lease/lease-contract'
import { LeaseContractController, type ClaimLeaseReceipt } from '../api/contractController'
import {
  type LeaseCircuits,
  LeasePrivateStateId,
  type LeaseProviders,
  createLeasePrivateState,
} from '../api/common-types'

type LeaseConnectedAPI = ConnectedAPI & {
  balanceUnsealedTransaction: (tx: string, options: Record<string, never>) => Promise<{ tx: string }>
}

type LeaseContractState = {
  controller: LeaseContractController | null
  leaseLedger: Lease.Ledger | null
  claimReceipt: ClaimLeaseReceipt | null
  isLoading: boolean
  isClaiming: boolean
  error: string | null
  claimLease: () => Promise<void>
  contractAddress: string
  hasContractAddress: boolean
}

export function useLeaseContract(): LeaseContractState {
  const { connectedAPI, serviceUriConfig, shieldedAddresses, status } = useWallet()
  const contractAddress = (import.meta.env.VITE_CONTRACT_ADDRESS ?? '').trim()
  const hasContractAddress = contractAddress.length > 0

  const privateStateProvider = useMemo(
    () => inMemoryPrivateStateProvider<typeof LeasePrivateStateId, ReturnType<typeof createLeasePrivateState>>(),
    [],
  )

  useEffect(() => {
    if (!shieldedAddresses?.shieldedCoinPublicKey) {
      return
    }

    void privateStateProvider.set(
      LeasePrivateStateId,
      createLeasePrivateState(shieldedAddresses.shieldedCoinPublicKey),
    )
  }, [privateStateProvider, shieldedAddresses?.shieldedCoinPublicKey])

  const providers = useMemo<LeaseProviders | null>(() => {
    if (!connectedAPI || !serviceUriConfig || !shieldedAddresses || !status) {
      return null
    }

    const publicDataProvider = new WrappedPublicDataProvider(
      indexerPublicDataProvider(serviceUriConfig.indexerUri, serviceUriConfig.indexerWsUri),
      () => undefined,
    )

    const zkConfigProvider = new CachedFetchZkConfigProvider<LeaseCircuits>(
      `${window.location.origin}/midnight/lease`,
      fetch.bind(window),
      () => undefined,
    )

    const proofProvider = serviceUriConfig.proverServerUri
      ? proofClient(serviceUriConfig.proverServerUri, zkConfigProvider, () => undefined)
      : noopProofClient()

    const walletProvider: LeaseProviders['walletProvider'] = {
      getCoinPublicKey() {
        return shieldedAddresses.shieldedCoinPublicKey as unknown as ledger.CoinPublicKey
      },
      getEncryptionPublicKey() {
        return shieldedAddresses.shieldedEncryptionPublicKey as unknown as ledger.EncPublicKey
      },
      async balanceTx(tx: ledger.Transaction<ledger.SignatureEnabled, ledger.Proof, ledger.PreBinding>): Promise<ledger.FinalizedTransaction> {
        const serializedTx = toHex(tx.serialize())
        const received = await (connectedAPI as LeaseConnectedAPI).balanceUnsealedTransaction(serializedTx, {})

        return ledger.Transaction.deserialize<ledger.SignatureEnabled, ledger.Proof, ledger.Binding>(
          'signature',
          'proof',
          'binding',
          fromHex(received.tx),
        )
      },
    }

    const midnightProvider: LeaseProviders['midnightProvider'] = {
      submitTx: async (tx: ledger.FinalizedTransaction): Promise<ledger.TransactionId> => {
        const txHex = toHex(tx.serialize())
        const received = await connectedAPI.submitTransaction(txHex)

        if (typeof received === 'string' && received.length > 0) {
          return received
        }

        return tx.identifiers()[0]
      },
    }

    return {
      privateStateProvider,
      publicDataProvider,
      zkConfigProvider,
      proofProvider,
      walletProvider,
      midnightProvider,
    }
  }, [connectedAPI, privateStateProvider, serviceUriConfig, shieldedAddresses, status])

  const [controller, setController] = useState<LeaseContractController | null>(null)
  const [leaseLedger, setLeaseLedger] = useState<Lease.Ledger | null>(null)
  const [claimReceipt, setClaimReceipt] = useState<ClaimLeaseReceipt | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isClaiming, setIsClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let subscription: { unsubscribe: () => void } | undefined

    setController(null)
    setLeaseLedger(null)
    setClaimReceipt(null)
    setError(null)
    setIsLoading(true)

    if (!hasContractAddress) {
      setError('Definí VITE_CONTRACT_ADDRESS para conectar el lease desplegado.')
      setIsLoading(false)
      return () => undefined
    }

    if (!providers) {
      setIsLoading(false)
      return () => undefined
    }

    void LeaseContractController.join(
      LeasePrivateStateId,
      providers,
      contractAddress,
    )
      .then((nextController) => {
        if (cancelled) {
          return
        }

        setController(nextController)
        subscription = nextController.state$.subscribe(setLeaseLedger)
      })
      .catch((joinError: unknown) => {
        if (cancelled) {
          return
        }

        setError(joinError instanceof Error ? joinError.message : String(joinError))
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
      subscription?.unsubscribe()
    }
  }, [contractAddress, hasContractAddress, providers])

  const claimLease = useCallback(async () => {
    if (!controller) {
      throw new Error('El contrato del lease todavía no está listo.')
    }

    setIsClaiming(true)
    setError(null)

    try {
      const receipt = await controller.claimLease()
      setClaimReceipt(receipt)
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : String(claimError))
      throw claimError
    } finally {
      setIsClaiming(false)
    }
  }, [controller])

  return {
    controller,
    leaseLedger,
    claimReceipt,
    isLoading,
    isClaiming,
    error,
    claimLease,
    contractAddress,
    hasContractAddress,
  }
}
