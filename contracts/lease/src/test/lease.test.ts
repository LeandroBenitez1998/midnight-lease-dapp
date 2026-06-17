import { describe, expect, it } from "vitest";
import { Lease } from "../index.js";
import { LeaseSimulator } from "./simulators/simulator.js";
import { createFilledBytes } from "./utils/bytes.js";

function createSimulator() {
  return new LeaseSimulator();
}

describe("Lease registry contract", () => {
  it("starts empty before any rental contract is registered", () => {
    const simulator = createSimulator();
    const ledger = simulator.getLedger();

    expect(ledger.contractIdHash).toBeDefined();
    expect(ledger.contractHash).toBeDefined();
    expect(ledger.landlordCommitment).toBeDefined();
    expect(ledger.tenantCommitment).toBeDefined();
    expect(ledger.status).toBe(Lease.RentalStatus.EMPTY);
  });

  it("registers the minimal rental contract hashes and commitments", () => {
    const simulator = createSimulator();
    const contractIdHash = createFilledBytes(32, 7);
    const contractHash = createFilledBytes(32, 11);
    const landlordCommitment = createFilledBytes(32, 13);
    const tenantCommitment = createFilledBytes(32, 17);

    const ledger = simulator.registerRentalContract(
      contractIdHash,
      contractHash,
      landlordCommitment,
      tenantCommitment,
    );

    expect(ledger.contractIdHash).toEqual(contractIdHash);
    expect(ledger.contractHash).toEqual(contractHash);
    expect(ledger.landlordCommitment).toEqual(landlordCommitment);
    expect(ledger.tenantCommitment).toEqual(tenantCommitment);
    expect(ledger.status).toBe(Lease.RentalStatus.REGISTERED);
  });

  it("rejects registering a second contract over the same registry slot", () => {
    const simulator = createSimulator();
    simulator.registerRentalContract(
      createFilledBytes(32, 1),
      createFilledBytes(32, 2),
      createFilledBytes(32, 3),
      createFilledBytes(32, 4),
    );

    expect(() =>
      simulator.registerRentalContract(
        createFilledBytes(32, 5),
        createFilledBytes(32, 6),
        createFilledBytes(32, 7),
        createFilledBytes(32, 8),
      ),
    ).toThrow(/registry already initialized/i);
  });

  it("tracks partial and complete signature progress by signer commitment", () => {
    const simulator = createSimulator();
    const contractIdHash = createFilledBytes(32, 21);
    const landlordCommitment = createFilledBytes(32, 22);
    const tenantCommitment = createFilledBytes(32, 23);

    simulator.registerRentalContract(
      contractIdHash,
      createFilledBytes(32, 24),
      landlordCommitment,
      tenantCommitment,
    );

    const firstLedger = simulator.markContractSigned(
      contractIdHash,
      landlordCommitment,
      createFilledBytes(32, 25),
    );
    const finalLedger = simulator.markContractSigned(
      contractIdHash,
      tenantCommitment,
      createFilledBytes(32, 26),
    );

    expect(firstLedger.status).toBe(Lease.RentalStatus.PARTIALLY_SIGNED);
    expect(finalLedger.status).toBe(Lease.RentalStatus.SIGNED);
  });

  it("rejects signatures from commitments that are not part of the contract", () => {
    const simulator = createSimulator();
    const contractIdHash = createFilledBytes(32, 31);

    simulator.registerRentalContract(
      contractIdHash,
      createFilledBytes(32, 32),
      createFilledBytes(32, 33),
      createFilledBytes(32, 34),
    );

    expect(() =>
      simulator.markContractSigned(
        contractIdHash,
        createFilledBytes(32, 35),
        createFilledBytes(32, 36),
      ),
    ).toThrow(/unknown signer commitment/i);
  });

  it("stores the payment hash after both signatures and then allows activation", () => {
    const simulator = createSimulator();
    const contractIdHash = createFilledBytes(32, 41);
    const landlordCommitment = createFilledBytes(32, 42);
    const tenantCommitment = createFilledBytes(32, 43);

    simulator.registerRentalContract(
      contractIdHash,
      createFilledBytes(32, 44),
      landlordCommitment,
      tenantCommitment,
    );
    simulator.markContractSigned(contractIdHash, landlordCommitment, createFilledBytes(32, 45));
    simulator.markContractSigned(contractIdHash, tenantCommitment, createFilledBytes(32, 46));

    const paidLedger = simulator.markContractPaid(contractIdHash, createFilledBytes(32, 47));
    const activeLedger = simulator.activateContract(contractIdHash);

    expect(paidLedger.paymentHash).toEqual(createFilledBytes(32, 47));
    expect(paidLedger.status).toBe(Lease.RentalStatus.PAID);
    expect(activeLedger.status).toBe(Lease.RentalStatus.ACTIVE);
  });
});
