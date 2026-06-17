import { useEffect, useMemo } from 'react'
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api'
import { fromHex, toHex } from '@midnight-ntwrk/compact-runtime'
import * as ledger from '@midnight-ntwrk/ledger-v8'
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider'
import { useWallet } from '@/modules/midnight/wallet-widget/hooks/useWallet'
import { inMemoryPrivateStateProvider } from '@/modules/midnight/wallet-widget/utils/customImplementations/in-memory-private-state-provider'
import { proofClient } from '@/modules/midnight/wallet-widget/utils/providersWrappers/proofClient'
import {
  type ProviderAction,
  WrappedPublicDataProvider,
} from '@/modules/midnight/wallet-widget/utils/providersWrappers/publicDataProvider'
import { CachedFetchZkConfigProvider } from '@/modules/midnight/wallet-widget/utils/providersWrappers/zkConfigProvider'
import {
  type LeaseCircuits,
  LeasePrivateStateId,
  type LeaseProviders,
  createLeasePrivateState,
} from '../api/common-types'

type LeaseConnectedAPI = ConnectedAPI & {
  balanceUnsealedTransaction: (tx: string, options: Record<string, never>) => Promise<{ tx: string }>
}

export const LEASE_PROVIDER_ACTION_MESSAGES: Record<ProviderAction, string | undefined> = {
  proveTxStarted: 'Generando prueba ZK...',
  proveTxDone: undefined,
  balanceTxStarted: 'Esperando firma en la wallet...',
  balanceTxDone: undefined,
  downloadProverStarted: 'Descargando clave del prover...',
  downloadProverDone: undefined,
  submitTxStarted: 'Enviando transaccion a Midnight...',
  submitTxDone: undefined,
  watchForTxDataStarted: 'Esperando confirmacion on-chain...',
  watchForTxDataDone: undefined,
}

interface UseLeaseProvidersOptions {
  onProviderAction?: (action: ProviderAction) => void
}

interface UseLeaseProvidersResult {
  providers: LeaseProviders | null
  walletConnected: boolean
  proofServerUri?: string
}

export function useLeaseProviders(options?: UseLeaseProvidersOptions): UseLeaseProvidersResult {
  const { connectedAPI, serviceUriConfig, shieldedAddresses, status } = useWallet()
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
    // ponytail: override con env var para evitar CORS entre localhost y 127.0.0.1
    const proverServerUrl = import.meta.env.VITE_PROOF_SERVER_URL?.trim() || serviceUriConfig.proverServerUri

    if (
      !connectedAPI ||
      !serviceUriConfig ||
      !proverServerUrl ||
      !shieldedAddresses ||
      status?.status !== 'connected'
    ) {
      return null
    }

    const notify = (action: ProviderAction): void => {
      options?.onProviderAction?.(action)
    }

    const publicDataProvider = new WrappedPublicDataProvider(
      indexerPublicDataProvider(serviceUriConfig.indexerUri, serviceUriConfig.indexerWsUri),
      notify,
    )

    const zkConfigProvider = new CachedFetchZkConfigProvider<LeaseCircuits>(
      `${window.location.origin}/midnight/lease`,
      fetch.bind(window),
      () => undefined,
    )

    return {
      privateStateProvider,
      publicDataProvider,
      zkConfigProvider,
      proofProvider: proofClient(proverServerUrl, zkConfigProvider, notify),
      walletProvider: {
        getCoinPublicKey() {
          return shieldedAddresses.shieldedCoinPublicKey as unknown as ledger.CoinPublicKey
        },
        getEncryptionPublicKey() {
          return shieldedAddresses.shieldedEncryptionPublicKey as unknown as ledger.EncPublicKey
        },
        async balanceTx(tx: ledger.Transaction<ledger.SignatureEnabled, ledger.Proof, ledger.PreBinding>) {
          notify('balanceTxStarted')

          try {
            const serializedTx = toHex(tx.serialize())
            const received = await (connectedAPI as LeaseConnectedAPI).balanceUnsealedTransaction(serializedTx, {})

            return ledger.Transaction.deserialize<ledger.SignatureEnabled, ledger.Proof, ledger.Binding>(
              'signature',
              'proof',
              'binding',
              fromHex(received.tx),
            )
          } finally {
            notify('balanceTxDone')
          }
        },
      },
      midnightProvider: {
        async submitTx(tx: ledger.FinalizedTransaction) {
          notify('submitTxStarted')

          try {
            const txHex = toHex(tx.serialize())
            const received: unknown = await connectedAPI.submitTransaction(txHex)

            if (typeof received === 'string' && received.length > 0) {
              return received
            }

            return tx.identifiers()[0]
          } finally {
            notify('submitTxDone')
          }
        },
      },
    }
  }, [connectedAPI, options, privateStateProvider, serviceUriConfig, shieldedAddresses, status?.status])

  return {
    providers,
    walletConnected: status?.status === 'connected',
    proofServerUri: serviceUriConfig?.proverServerUri,
  }
}
