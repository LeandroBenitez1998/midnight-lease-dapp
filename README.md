# midnight-lease-dapp

Minimal rental registry built on the [Midnight Network](https://midnight.network). Registers contract hashes and commitments on-chain via zero-knowledge proofs — sensitive data never leaves the browser.

## How it works

1. **Prepare** — fill in rental details locally, generate hashes
2. **Register** — push only hashes and commitments to Midnight (no personal data on-chain)
3. **Sign** — both parties draw handwritten signatures; only the hash goes on-chain
4. **Pay + Activate** — transfer NIGHT via Zswap, register payment proof, activate contract

The on-chain state machine enforces the sequence: you cannot pay without both signatures, and cannot activate without payment.

## Stack

- **Smart contract**: Compact language, compiled to ZK circuits
- **Frontend**: Vite + React + TailwindCSS
- **Network**: Midnight preprod
- **Wallet**: Lace / 1AM browser extension

## Structure

```
apps/web/          Vite + React frontend
contracts/lease/   Compact smart contract
```

## Setup

```bash
pnpm install
```

Copy the env template and fill in your values:

```bash
cp apps/web/.env_template apps/web/.env.local
```

Start the proof server (requires Docker):

```bash
docker run -d --name midnight-proof-server -p 6300:6300 \
  midnightntwrk/proof-server:8.1.0 -- midnight-proof-server -v
```

Run the frontend:

```bash
pnpm dev:web
```

Open [http://localhost:5174/lease](http://localhost:5174/lease) and connect your Midnight wallet.

## Environment variables

| Variable | Description |
|---|---|
| `VITE_CONTRACT_ADDRESS` | Deployed lease contract address on preprod |
| `MIDNIGHT_WALLET_SEED_HEX` | Seed for headless deploy script (never commit) |
| `MIDNIGHT_PROOF_SERVER_URL` | Proof server URL (default: `http://127.0.0.1:6300`) |

See `apps/web/.env_template` for the full list.
