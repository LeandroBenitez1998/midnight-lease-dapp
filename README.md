# midnight-lease-dapp

Standalone Midnight Lease DApp scaffold built for Midnight.

## Structure

- `apps/web` - Vite + React frontend for the lease flow
- `contracts/lease` - placeholder Compact package for the lease contract
- `counter-contract` - inherited demo contract package kept for workspace compatibility during the split

## Start

```bash
pnpm install
pnpm dev:web
```

## Notes

- The lease screen already lives in `apps/web/src/pages/lease`.
- Lease contract assets should be published under `contracts/lease/managed/lease` and synced into `apps/web/public/midnight/lease`.
