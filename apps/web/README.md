# `@eddalabs/frontend-vite-react`

> Built on the [Midnight Network](https://midnight.network) — a data-protection blockchain by Input Output Global that enables privacy-preserving smart contracts via zero-knowledge proofs.

The React + Vite frontend for the [Midnight Starter Template](../README.md). It connects to the Lace wallet, talks to the deployed Lease contract, and demonstrates the dApp Connector flow against any Midnight network (standalone, Preview, Preprod, Mainnet).

> 💡 Most setup steps live in the **[root README](../README.md)**. This file documents what's specific to the frontend package.

## Stack

- React 19 + TypeScript
- Vite 6
- TanStack Router
- Tailwind CSS v4 + Radix UI
- pino for structured logging
- Midnight `dapp-connector-api` + `midnight-js-*` SDKs

## Local development

From the **project root** (recommended — Turbo will compile the contract and copy keys):

```bash
pnpm install
pnpm build
pnpm dev:frontend
```

Or from this directory:

```bash
pnpm dev      # Vite dev server
pnpm build    # Copies contract keys + bundles for production
pnpm preview  # Preview a production build
pnpm lint     # ESLint
```

## Environment

Create `.env` from [`.env_template`](./.env_template):

| Variable | Description |
|---|---|
| `VITE_CONTRACT_ADDRESS` | Address of the deployed Lease contract to connect to. |
| `MIDNIGHT_NETWORK_ID` | Red usada por `pnpm deploy:lease`; por defecto `preprod`. |
| `MIDNIGHT_INDEXER_HTTP` / `MIDNIGHT_INDEXER_WS` | Endpoints del indexer para deploy headless. |
| `MIDNIGHT_RPC_URL` | Endpoint RPC/relay de Midnight para enviar transacciones. |
| `MIDNIGHT_PROOF_SERVER_URL` | Proof server local o remoto usado por el deploy CLI. |
| `MIDNIGHT_WALLET_SEED_HEX` | Seed hex de la wallet headless con NIGHT/DUST disponible. No la commitees. |
| `MIDNIGHT_WALLET_SYNC_TIMEOUT_MS` / `MIDNIGHT_DUST_TIMEOUT_MS` | Timeouts del deploy headless. |

## Deploy del contrato AgeGate/lease

Primero compilá el contrato para generar `contracts/lease/managed/lease`:

```bash
pnpm compact
```

Después ejecutá un chequeo sin wallet ni transacciones:

```bash
pnpm deploy:lease -- --dry-run
```

Para desplegar de verdad, configurá una wallet headless con fondos y DUST disponible:

```bash
MIDNIGHT_WALLET_SEED_HEX="<seed-hex>" pnpm deploy:lease
```

El comando imprime `Contract address:` y la línea exacta `VITE_CONTRACT_ADDRESS=...` para pegar en `.env`.

Si preferís un deploy manual desde el navegador, la ruta `/wallet-ui` ahora incluye una tarjeta de "Deploy manual del lease" que usa la wallet conectada. Ese flujo está pensado para despliegues manuales; `pnpm deploy:lease` queda igual para automatización y CI.

## Project layout

```
src/
├── App.tsx              # Application shell
├── main.tsx             # Vite entrypoint
├── routes/              # TanStack Router route tree
├── pages/               # Page-level components (home, counter, wallet-ui)
├── components/          # Shared UI (theme provider, mode toggle, ui/*)
├── modules/midnight/    # Wallet widget + counter-sdk hooks/contexts
├── layouts/             # Layout wrappers
├── lib/                 # Utilities
└── globals.ts           # Network/runtime globals
```

The compiled contract artifacts are copied into `public/midnight/lease/{keys,zkir}` by `pnpm copy-contract-keys` (run automatically as part of `pnpm build`). They are gitignored — run a build before deploying.

## Deployment

Production deployment to Vercel is documented in [`DEPLOYMENT_PROCEDURE.md`](../DEPLOYMENT_PROCEDURE.md). Git LFS must be enabled in Vercel for the contract verifier/prover keys to be served correctly.
