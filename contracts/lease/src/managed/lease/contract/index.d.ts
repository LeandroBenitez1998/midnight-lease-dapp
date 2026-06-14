import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum LeaseState { OFFERED = 0,
                         CLAIMED = 1,
                         ACTIVE = 2,
                         IN_ARREARS = 3,
                         TERMINATED = 4,
                         COMPLETED = 5
}

export type Witnesses<PS> = {
  callerAddress(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  claimLease(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  confirmDeposit(context: __compactRuntime.CircuitContext<PS>,
                 receiptHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  activateLease(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  recordPayment(context: __compactRuntime.CircuitContext<PS>,
                paymentReference_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  markInArrears(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  terminateByLandlord(context: __compactRuntime.CircuitContext<PS>,
                      reasonHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  terminateByTenant(context: __compactRuntime.CircuitContext<PS>,
                    reasonHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  releaseDeposit(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  claimLease(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  confirmDeposit(context: __compactRuntime.CircuitContext<PS>,
                 receiptHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  activateLease(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  recordPayment(context: __compactRuntime.CircuitContext<PS>,
                paymentReference_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  markInArrears(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  terminateByLandlord(context: __compactRuntime.CircuitContext<PS>,
                      reasonHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  terminateByTenant(context: __compactRuntime.CircuitContext<PS>,
                    reasonHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  releaseDeposit(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  claimLease(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  confirmDeposit(context: __compactRuntime.CircuitContext<PS>,
                 receiptHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  activateLease(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  recordPayment(context: __compactRuntime.CircuitContext<PS>,
                paymentReference_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  markInArrears(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  terminateByLandlord(context: __compactRuntime.CircuitContext<PS>,
                      reasonHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  terminateByTenant(context: __compactRuntime.CircuitContext<PS>,
                    reasonHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  releaseDeposit(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly leaseId: Uint8Array;
  readonly propertyHash: Uint8Array;
  readonly agreementHash: Uint8Array;
  readonly monthlyRent: bigint;
  readonly depositAmount: bigint;
  readonly termMonths: bigint;
  readonly landlordCommitment: Uint8Array;
  readonly state: LeaseState;
  readonly tenantClaimed: boolean;
  readonly tenantCommitment: Uint8Array;
  readonly paymentsMade: bigint;
  readonly depositConfirmed: boolean;
  readonly depositReceiptHash: Uint8Array;
  readonly hasDepositReceiptHash: boolean;
  readonly depositReleased: boolean;
  readonly breachCount: bigint;
  readonly lastPaymentReference: Uint8Array;
  readonly hasLastPaymentReference: boolean;
  readonly terminationReasonHash: Uint8Array;
  readonly hasTerminationReasonHash: boolean;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               leaseIdArg_0: Uint8Array,
               propertyHashArg_0: Uint8Array,
               agreementHashArg_0: Uint8Array,
               monthlyRentArg_0: bigint,
               depositAmountArg_0: bigint,
               termMonthsArg_0: bigint): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
