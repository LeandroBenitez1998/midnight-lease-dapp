import { createConstructorContext, CostModel, CircuitContext, CircuitResults, CoinPublicKey, ContractAddress, QueryContext, emptyZswapLocalState, sampleContractAddress } from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger, type Ledger, LeaseState } from "../../managed/lease/contract/index.js";
import { createPrivateState, type LeasePrivateState, witnesses } from "../../witnesses.js";
import { bytesFromLabel, toHexPadded } from "../utils/utils.js";

type Participant = {
  sender: CoinPublicKey;
  privateState: LeasePrivateState;
};

export class LeaseSimulator {
  readonly contract: Contract<LeasePrivateState>;
  circuitContext: CircuitContext<LeasePrivateState>;
  participants: Record<string, Participant>;
  updateParticipantState: (newPrivateState: LeasePrivateState) => void;
  contractAddress: ContractAddress;

  constructor(
    private readonly leaseId: Uint8Array,
    private readonly propertyHash: Uint8Array,
    private readonly agreementHash: Uint8Array,
    private readonly monthlyRent: bigint,
    private readonly depositAmount: bigint,
    private readonly termMonths: bigint,
    landlordName = "landlord",
  ) {
    this.contract = new Contract<LeasePrivateState>(witnesses);
    const sender = toHexPadded(landlordName);
    const landlordPrivateState = createPrivateState(Buffer.from(sender, "hex"));
    this.contractAddress = sampleContractAddress();
    const constructorResult = this.contract.initialState(
      createConstructorContext(landlordPrivateState, sender),
      leaseId,
      propertyHash,
      agreementHash,
      monthlyRent,
      depositAmount,
      termMonths,
    );

    this.circuitContext = {
      currentPrivateState: constructorResult.currentPrivateState,
      currentZswapLocalState: constructorResult.currentZswapLocalState,
      currentQueryContext: new QueryContext(constructorResult.currentContractState.data, this.contractAddress),
      costModel: CostModel.initialCostModel(),
    };

    this.participants = {
      landlord: {
        sender,
        privateState: landlordPrivateState,
      },
    };
    this.updateParticipantState = (newPrivateState: LeasePrivateState) => {
      this.participants.landlord.privateState = newPrivateState;
    };
  }

  createParticipant(name: string, label: string): void {
    const sender = toHexPadded(label);
    this.participants[name] = {
      sender,
      privateState: createPrivateState(Buffer.from(sender, "hex")),
    };
  }

  private buildTurnContext(currentPrivateState: LeasePrivateState, sender: CoinPublicKey): CircuitContext<LeasePrivateState> {
    return {
      ...this.circuitContext,
      currentPrivateState,
      currentZswapLocalState: emptyZswapLocalState(sender),
    };
  }

  private updateParticipantStateByName =
    (name: string) =>
    (newPrivateState: LeasePrivateState): void => {
      this.participants[name].privateState = newPrivateState;
    };

  as(name: string): LeaseSimulator {
    const participant = this.participants[name];
    if (!participant) {
      throw new Error(`No private state found for user '${name}'. Did you register it?`);
    }

    this.circuitContext = this.buildTurnContext(participant.privateState, participant.sender);
    this.updateParticipantState = this.updateParticipantStateByName(name);
    return this;
  }

  getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  getState(): LeaseState {
    return this.getLedger().state;
  }

  updateStateAndGetLedger<T>(circuitResults: CircuitResults<LeasePrivateState, T>): Ledger {
    this.circuitContext = circuitResults.context;
    this.updateParticipantState(circuitResults.context.currentPrivateState);
    return this.getLedger();
  }

  claimLease(): Ledger {
    return this.updateStateAndGetLedger(this.contract.impureCircuits.claimLease(this.circuitContext));
  }

  confirmDeposit(receiptLabel = "deposit-receipt"): Ledger {
    return this.updateStateAndGetLedger(
      this.contract.impureCircuits.confirmDeposit(this.circuitContext, bytesFromLabel(receiptLabel)),
    );
  }

  activateLease(): Ledger {
    return this.updateStateAndGetLedger(this.contract.impureCircuits.activateLease(this.circuitContext));
  }

  recordPayment(paymentLabel = "payment-receipt"): Ledger {
    return this.updateStateAndGetLedger(
      this.contract.impureCircuits.recordPayment(this.circuitContext, bytesFromLabel(paymentLabel)),
    );
  }

  markInArrears(): Ledger {
    return this.updateStateAndGetLedger(this.contract.impureCircuits.markInArrears(this.circuitContext));
  }

  terminateByLandlord(reasonLabel = "landlord-termination"): Ledger {
    return this.updateStateAndGetLedger(
      this.contract.impureCircuits.terminateByLandlord(this.circuitContext, bytesFromLabel(reasonLabel)),
    );
  }

  terminateByTenant(reasonLabel = "tenant-termination"): Ledger {
    return this.updateStateAndGetLedger(
      this.contract.impureCircuits.terminateByTenant(this.circuitContext, bytesFromLabel(reasonLabel)),
    );
  }

  releaseDeposit(): Ledger {
    return this.updateStateAndGetLedger(this.contract.impureCircuits.releaseDeposit(this.circuitContext));
  }
}
