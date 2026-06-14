import { type ContractAddress } from '@midnight-ntwrk/compact-runtime'
import { CompiledContract } from '@midnight-ntwrk/compact-js'
import { contracts, types } from '@midnight-ntwrk/midnight-js'
import * as Rx from 'rxjs'
import { type Logger } from 'pino'
import { Lease } from '@midnight-lease/lease-contract'

import {
  type DeployedLeaseContract,
  LeasePrivateStateId,
  type LeaseProviders,
  createLeasePrivateState,
} from './common-types'

const leaseCompiledContract = CompiledContract.make('lease', Lease.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(`${window.location.origin}/midnight/lease`),
)

export interface ClaimLeaseReceipt {
  readonly txHash: string
  readonly blockHeight: number | undefined
  readonly confirmedAt: string
}

export interface LeaseContractControllerInterface {
  readonly deployedContractAddress: ContractAddress
  readonly state$: Rx.Observable<Lease.Ledger>
  claimLease: () => Promise<ClaimLeaseReceipt>
}

export class LeaseContractController implements LeaseContractControllerInterface {
  readonly deployedContractAddress: ContractAddress
  readonly state$: Rx.Observable<Lease.Ledger>

  private constructor(
    public readonly contractPrivateStateId: typeof LeasePrivateStateId,
    public readonly deployedContract: DeployedLeaseContract,
    public readonly providers: LeaseProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress
    this.state$ = providers.publicDataProvider
      .contractStateObservable(this.deployedContractAddress, { type: 'all' })
      .pipe(
        Rx.map((contractState) => Lease.ledger(contractState.data)),
        Rx.retry({ delay: 500 }),
      )
  }

  async claimLease(): Promise<ClaimLeaseReceipt> {
    this.logger?.info('claiming lease')

    const txData = await this.deployedContract.callTx.claimLease()
    const receipt: ClaimLeaseReceipt = {
      txHash: txData.public.txHash,
      blockHeight: txData.public.blockHeight,
      confirmedAt: new Date().toISOString(),
    }

    this.logger?.trace(
      {
        claimLease: {
          txHash: receipt.txHash,
          blockHeight: receipt.blockHeight,
        },
      },
      'Lease claim submitted',
    )

    return receipt
  }

  static async join(
    contractPrivateStateId: typeof LeasePrivateStateId,
    providers: LeaseProviders,
    contractAddress: ContractAddress,
    logger?: Logger,
  ): Promise<LeaseContractController> {
    logger?.info(
      {
        joinContract: {
          action: 'Joining lease contract',
          contractPrivateStateId,
          contractAddress,
        },
      },
      'Joining lease contract',
    )

    const deployedContract = await contracts.findDeployedContract(providers, {
      contractAddress,
      compiledContract: leaseCompiledContract,
      privateStateId: contractPrivateStateId,
      initialPrivateState: await LeaseContractController.getPrivateState(
        contractPrivateStateId,
        providers.privateStateProvider,
        providers.walletProvider.getCoinPublicKey(),
      ),
    })

    logger?.trace(
      {
        contractJoined: {
          action: 'Lease contract joined',
          contractPrivateStateId,
          finalizedDeployTxData: deployedContract.deployTxData.public,
        },
      },
      'Lease contract joined successfully',
    )

    return new LeaseContractController(contractPrivateStateId, deployedContract, providers, logger)
  }

  private static async getPrivateState(
    contractPrivateStateId: typeof LeasePrivateStateId,
    privateStateProvider: types.PrivateStateProvider<typeof LeasePrivateStateId, ReturnType<typeof createLeasePrivateState>>,
    coinPublicKey: string,
  ): Promise<ReturnType<typeof createLeasePrivateState>> {
    const existingPrivateState = await privateStateProvider.get(contractPrivateStateId)

    if (existingPrivateState !== null) {
      return existingPrivateState
    }

    const initialState = createLeasePrivateState(coinPublicKey)
    await privateStateProvider.set(contractPrivateStateId, initialState)

    return initialState
  }
}
