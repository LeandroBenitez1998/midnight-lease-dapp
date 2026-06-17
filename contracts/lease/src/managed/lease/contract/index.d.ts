import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum RentalStatus { EMPTY = 0,
                           REGISTERED = 1,
                           PARTIALLY_SIGNED = 2,
                           SIGNED = 3,
                           PAID = 4,
                           ACTIVE = 5
}

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  registerRentalContract(context: __compactRuntime.CircuitContext<PS>,
                         nextContractIdHash_0: Uint8Array,
                         nextContractHash_0: Uint8Array,
                         nextLandlordCommitment_0: Uint8Array,
                         nextTenantCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  markContractSigned(context: __compactRuntime.CircuitContext<PS>,
                     nextContractIdHash_0: Uint8Array,
                     signerCommitment_0: Uint8Array,
                     nextSignatureHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  markContractPaid(context: __compactRuntime.CircuitContext<PS>,
                   nextContractIdHash_0: Uint8Array,
                   nextPaymentHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  activateContract(context: __compactRuntime.CircuitContext<PS>,
                   nextContractIdHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  registerRentalContract(context: __compactRuntime.CircuitContext<PS>,
                         nextContractIdHash_0: Uint8Array,
                         nextContractHash_0: Uint8Array,
                         nextLandlordCommitment_0: Uint8Array,
                         nextTenantCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  markContractSigned(context: __compactRuntime.CircuitContext<PS>,
                     nextContractIdHash_0: Uint8Array,
                     signerCommitment_0: Uint8Array,
                     nextSignatureHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  markContractPaid(context: __compactRuntime.CircuitContext<PS>,
                   nextContractIdHash_0: Uint8Array,
                   nextPaymentHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  activateContract(context: __compactRuntime.CircuitContext<PS>,
                   nextContractIdHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  registerRentalContract(context: __compactRuntime.CircuitContext<PS>,
                         nextContractIdHash_0: Uint8Array,
                         nextContractHash_0: Uint8Array,
                         nextLandlordCommitment_0: Uint8Array,
                         nextTenantCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  markContractSigned(context: __compactRuntime.CircuitContext<PS>,
                     nextContractIdHash_0: Uint8Array,
                     signerCommitment_0: Uint8Array,
                     nextSignatureHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  markContractPaid(context: __compactRuntime.CircuitContext<PS>,
                   nextContractIdHash_0: Uint8Array,
                   nextPaymentHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  activateContract(context: __compactRuntime.CircuitContext<PS>,
                   nextContractIdHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly contractIdHash: Uint8Array;
  readonly contractHash: Uint8Array;
  readonly landlordCommitment: Uint8Array;
  readonly tenantCommitment: Uint8Array;
  readonly landlordSignatureHash: Uint8Array;
  readonly tenantSignatureHash: Uint8Array;
  readonly paymentHash: Uint8Array;
  readonly status: RentalStatus;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
