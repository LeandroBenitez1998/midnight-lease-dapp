import type { ConnectedAPI, DesiredOutput } from '@midnight-ntwrk/dapp-connector-api'
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8'

export const LANDLORD_ADDRESS = '171603898df1cfa7f10164c921c20b016a418f88b2b7d19273ae9a3941d6e73b'


export async function sendNightViaZswap(
  connectedAPI: ConnectedAPI,
  amountStars: bigint,
  recipientAddress: string,
): Promise<{ txProofHex: string; txId: string }> {
  const { tx: txHex } = await connectedAPI.makeTransfer([
    {
      kind: 'unshielded',
      type: unshieldedToken().raw,
      value: amountStars,
      recipient: recipientAddress,
    } satisfies DesiredOutput,
  ])

  const txHash = await sha256Hex(txHex)
  await connectedAPI.submitTransaction(txHex)

  return { txProofHex: txHash, txId: txHash }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return `0x${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}
