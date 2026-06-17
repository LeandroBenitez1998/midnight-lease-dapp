import { type ContractAddress } from '@midnight-ntwrk/compact-runtime'
import { CompiledContract } from '@midnight-ntwrk/compact-js'
import { contracts, types } from '@midnight-ntwrk/midnight-js'
import * as Rx from 'rxjs'
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

export interface VerifyAdultReceipt {
  readonly txHash: string
  readonly blockHeight: number | undefined
  readonly confirmedAt: string
}

export class LeaseContractController {
  readonly deployedContractAddress: ContractAddress
  readonly state$: Rx.Observable<Lease.Ledger>

  private constructor(
    public readonly contractPrivateStateId: typeof LeasePrivateStateId,
    public readonly deployedContract: DeployedLeaseContract,
    public readonly providers: LeaseProviders,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress
    this.state$ = providers.publicDataProvider
      .contractStateObservable(this.deployedContractAddress, { type: 'all' })
      .pipe(
        Rx.map((contractState) => Lease.ledger(contractState.data)),
        Rx.retry({ delay: 500 }),
      )
  }

  private async callTx(method: string, ...args: unknown[]): Promise<VerifyAdultReceipt> {
    const txData = await (this.deployedContract.callTx as Record<string, (...args: unknown[]) => Promise<{ public: { txHash: string; blockHeight?: number } }>>)[method](...args)
    return {
      txHash: txData.public.txHash,
      blockHeight: txData.public.blockHeight,
      confirmedAt: new Date().toISOString(),
    }
  }

  registerRentalContract(contractIdHash: Uint8Array, contractHash: Uint8Array, landlordCommitment: Uint8Array, tenantCommitment: Uint8Array): Promise<VerifyAdultReceipt> {
    return this.callTx('registerRentalContract', contractIdHash, contractHash, landlordCommitment, tenantCommitment)
  }

  markContractSigned(contractIdHash: Uint8Array, signerCommitment: Uint8Array, signatureHash: Uint8Array): Promise<VerifyAdultReceipt> {
    return this.callTx('markContractSigned', contractIdHash, signerCommitment, signatureHash)
  }

  markContractPaid(contractIdHash: Uint8Array, paymentHash: Uint8Array): Promise<VerifyAdultReceipt> {
    return this.callTx('markContractPaid', contractIdHash, paymentHash)
  }

  activateContract(contractIdHash: Uint8Array): Promise<VerifyAdultReceipt> {
    return this.callTx('activateContract', contractIdHash)
  }

  static async deploy(
    contractPrivateStateId: typeof LeasePrivateStateId,
    providers: LeaseProviders,
  ): Promise<LeaseContractController> {
    console.log('Deploying lease contract')

    const deployedContract = await contracts.deployContract(providers, {
      compiledContract: leaseCompiledContract,
      privateStateId: contractPrivateStateId,
      initialPrivateState: await LeaseContractController.getPrivateState(
        contractPrivateStateId,
        providers.privateStateProvider,
        providers.walletProvider.getCoinPublicKey(),
      ),
    })

    console.log('Lease contract deployed')

    return new LeaseContractController(contractPrivateStateId, deployedContract, providers)
  }

  static async join(
    contractPrivateStateId: typeof LeasePrivateStateId,
    providers: LeaseProviders,
    contractAddress: ContractAddress,
  ): Promise<LeaseContractController> {
    console.log('Joining lease contract')

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

    console.log('Lease contract joined')

    return new LeaseContractController(contractPrivateStateId, deployedContract, providers)
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
