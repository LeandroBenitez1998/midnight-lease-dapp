import { createConstructorContext, CostModel, CircuitContext, CircuitResults, CoinPublicKey, ContractAddress, QueryContext, emptyZswapLocalState, sampleContractAddress } from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger, type Ledger } from "../../managed/lease/contract/index.js";
import { createPrivateState, type LeasePrivateState, witnesses } from "../../witnesses.js";
import { toHexPadded } from "../utils/utils.js";

export class LeaseSimulator {
  readonly contract: Contract<LeasePrivateState>;
  circuitContext: CircuitContext<LeasePrivateState>;
  updatePrivateState: (newPrivateState: LeasePrivateState) => void;
  contractAddress: ContractAddress;

  constructor(userName = "user") {
    this.contract = new Contract<LeasePrivateState>(witnesses);
    const sender: CoinPublicKey = toHexPadded(userName);
    const privateState = createPrivateState(Buffer.from(sender, "hex"));
    this.contractAddress = sampleContractAddress();
    const constructorResult = this.contract.initialState(
      createConstructorContext(privateState, sender),
    );

    this.circuitContext = {
      currentPrivateState: constructorResult.currentPrivateState,
      currentZswapLocalState: emptyZswapLocalState(sender),
      currentQueryContext: new QueryContext(constructorResult.currentContractState.data, this.contractAddress),
      costModel: CostModel.initialCostModel(),
    };

    this.updatePrivateState = (newPrivateState: LeasePrivateState) => {
      this.circuitContext = {
        ...this.circuitContext,
        currentPrivateState: newPrivateState,
      };
    };
  }

  getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  updateStateAndGetLedger<T>(circuitResults: CircuitResults<LeasePrivateState, T>): Ledger {
    this.circuitContext = circuitResults.context;
    this.updatePrivateState(circuitResults.context.currentPrivateState);
    return this.getLedger();
  }

  registerRentalContract(
    contractIdHash: Uint8Array,
    contractHash: Uint8Array,
    landlordCommitment: Uint8Array,
    tenantCommitment: Uint8Array,
  ): Ledger {
    return this.updateStateAndGetLedger(
      this.contract.impureCircuits.registerRentalContract(
        this.circuitContext,
        contractIdHash,
        contractHash,
        landlordCommitment,
        tenantCommitment,
      ),
    );
  }

  markContractSigned(
    contractIdHash: Uint8Array,
    signerCommitment: Uint8Array,
    signatureHash: Uint8Array,
  ): Ledger {
    return this.updateStateAndGetLedger(
      this.contract.impureCircuits.markContractSigned(
        this.circuitContext,
        contractIdHash,
        signerCommitment,
        signatureHash,
      ),
    );
  }

  markContractPaid(contractIdHash: Uint8Array, paymentHash: Uint8Array): Ledger {
    return this.updateStateAndGetLedger(
      this.contract.impureCircuits.markContractPaid(
        this.circuitContext,
        contractIdHash,
        paymentHash,
      ),
    );
  }

  activateContract(contractIdHash: Uint8Array): Ledger {
    return this.updateStateAndGetLedger(
      this.contract.impureCircuits.activateContract(
        this.circuitContext,
        contractIdHash,
      ),
    );
  }
}
