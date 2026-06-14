import { describe, expect, it } from "vitest";
import { LeaseSimulator } from "./simulators/simulator.js";
import { bytesFromLabel } from "./utils/utils.js";
import { LeaseState } from "../../managed/lease/contract/index.js";

function createSimulator() {
  const simulator = new LeaseSimulator(
    bytesFromLabel("lease-001"),
    bytesFromLabel("property-palermo"),
    bytesFromLabel("agreement-001"),
    850n,
    1200n,
    2n,
  );
  simulator.createParticipant("tenant", "tenant");
  return simulator;
}

describe("Lease smart contract", () => {
  it("starts offered with immutable public terms", () => {
    const simulator = createSimulator();
    const ledger = simulator.getLedger();

    expect(ledger.state).toBe(LeaseState.OFFERED);
    expect(ledger.monthlyRent).toBe(850n);
    expect(ledger.depositAmount).toBe(1200n);
    expect(ledger.termMonths).toBe(2n);
    expect(ledger.tenantClaimed).toBe(false);
    expect(ledger.depositConfirmed).toBe(false);
    expect(ledger.paymentsMade).toBe(0n);
    expect(Buffer.from(ledger.leaseId).toString("hex")).toContain("6c656173652d303031");
  });

  it("moves through claim, activation, payment, completion, and deposit release", () => {
    const simulator = createSimulator();

    const claimed = simulator.as("tenant").claimLease();
    expect(claimed.state).toBe(LeaseState.CLAIMED);
    expect(claimed.tenantClaimed).toBe(true);

    const depositConfirmed = simulator.as("landlord").confirmDeposit("deposit-receipt-001");
    expect(depositConfirmed.depositConfirmed).toBe(true);
    expect(depositConfirmed.hasDepositReceiptHash).toBe(true);

    const active = simulator.as("landlord").activateLease();
    expect(active.state).toBe(LeaseState.ACTIVE);

    const firstPayment = simulator.as("tenant").recordPayment("payment-001");
    expect(firstPayment.paymentsMade).toBe(1n);
    expect(firstPayment.state).toBe(LeaseState.ACTIVE);

    const completed = simulator.as("tenant").recordPayment("payment-002");
    expect(completed.paymentsMade).toBe(2n);
    expect(completed.state).toBe(LeaseState.COMPLETED);

    const released = simulator.as("landlord").releaseDeposit();
    expect(released.depositReleased).toBe(true);
    expect(released.state).toBe(LeaseState.COMPLETED);
  });

  it("allows the tenant or landlord to terminate after activation", () => {
    const simulator = createSimulator();

    simulator.as("tenant").claimLease();
    simulator.as("landlord").confirmDeposit("deposit-receipt-002");
    simulator.as("landlord").activateLease();

    const terminated = simulator.as("tenant").terminateByTenant("tenant-quit");
    expect(terminated.state).toBe(LeaseState.TERMINATED);
    expect(terminated.hasTerminationReasonHash).toBe(true);
  });
});
