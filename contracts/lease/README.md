# Lease contract

This package contains the Midnight lease Compact contract.

## Layout

- `src/lease.compact` - lease state machine and public terms
- `src/witnesses.ts` - caller witness used to bind public keys privately
- `managed/lease/keys` - compiled prover/verifier keys
- `managed/lease/zkir` - compiled ZKIR artifacts

## State machine

- `OFFERED` -> `CLAIMED` -> `ACTIVE` -> `COMPLETED`
- `ACTIVE` can move to `IN_ARREARS` or `TERMINATED`
- Landlord and tenant actions are authenticated by private caller witness commitments
