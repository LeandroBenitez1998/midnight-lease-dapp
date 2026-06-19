#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const managedLeaseDir = path.join(rootDir, 'contracts/lease/managed/lease')

const networkDefaults = {
  undeployed: {
    indexerHttp: 'http://localhost:8088/api/v3/graphql',
    indexerWs: 'ws://localhost:8088/api/v3/graphql/ws',
    rpc: 'ws://localhost:9944',
  },
  preprod: {
    indexerHttp: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWs: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    rpc: 'https://rpc.preprod.midnight.network',
  },
  preview: {
    indexerHttp: 'https://indexer.preview.midnight.network/api/v4/graphql',
    indexerWs: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
    rpc: 'wss://rpc.preview.midnight.network',
  },
  mainnet: {
    indexerHttp: 'https://indexer.mainnet.midnight.network/api/v4/graphql',
    indexerWs: 'wss://indexer.mainnet.midnight.network/api/v4/graphql/ws',
    rpc: 'https://rpc.mainnet.midnight.network',
  },
}

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const networkId = process.env.MIDNIGHT_NETWORK_ID ?? 'preprod'
const defaults = networkDefaults[networkId]

if (!defaults) {
  throw new Error(`MIDNIGHT_NETWORK_ID inválido: ${networkId}. Usá undeployed, preprod, preview o mainnet.`)
}

const config = {
  networkId,
  indexerHttp: process.env.MIDNIGHT_INDEXER_HTTP ?? defaults.indexerHttp,
  indexerWs: process.env.MIDNIGHT_INDEXER_WS ?? defaults.indexerWs,
  rpc: process.env.MIDNIGHT_RPC_URL ?? defaults.rpc,
  proofServer: process.env.MIDNIGHT_PROOF_SERVER_URL ?? 'http://127.0.0.1:6300',
  seedHex: process.env.MIDNIGHT_WALLET_SEED_HEX,
  managedLeaseDir,
}

function relayUrlFromRpc(rpcUrl) {
  if (rpcUrl.startsWith('https://')) return `wss://${rpcUrl.slice('https://'.length)}`
  if (rpcUrl.startsWith('http://')) return `ws://${rpcUrl.slice('http://'.length)}`
  return rpcUrl
}

function requiredEnv(name, value) {
  if (!value) {
    throw new Error(
      `Falta ${name}. Definilo sin hardcodear secretos, por ejemplo: ${name}=<valor> pnpm deploy:lease`,
    )
  }
}

async function importRequired(packageName, hint) {
  try {
    return await import(packageName)
  } catch (error) {
    throw new Error(
      `No pude cargar ${packageName}. ${hint}\nDetalle original: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function createInMemoryPrivateStateProvider() {
  const states = new Map()
  const signingKeys = new Map()

  return {
    setContractAddress() {},
    async set(key, state) { states.set(key, state) },
    async get(key) { return states.get(key) ?? null },
    async remove(key) { states.delete(key) },
    async clear() { states.clear() },
    async setSigningKey(address, signingKey) { signingKeys.set(address, signingKey) },
    async getSigningKey(address) { return signingKeys.get(address) ?? null },
    async removeSigningKey(address) { signingKeys.delete(address) },
    async clearSigningKeys() { signingKeys.clear() },
    async exportPrivateStates() { throw new Error('Exportar private state no está soportado por este deploy script.') },
    async importPrivateStates() { throw new Error('Importar private state no está soportado por este deploy script.') },
    async exportSigningKeys() { throw new Error('Exportar signing keys no está soportado por este deploy script.') },
    async importSigningKeys() { throw new Error('Importar signing keys no está soportado por este deploy script.') },
  }
}

function coinPublicKeyToBytes(coinPublicKey) {
  const normalized = String(coinPublicKey).trim().replace(/^0x/, '')
  if (/^[0-9a-fA-F]+$/.test(normalized) && normalized.length % 2 === 0) {
    return Uint8Array.from(Buffer.from(normalized, 'hex'))
  }
  return new TextEncoder().encode(String(coinPublicKey))
}

function createLeasePrivateState(coinPublicKey) {
  return {
    callerAddress: coinPublicKeyToBytes(coinPublicKey),
  }
}

function signTransactionIntents(ledger, tx, signFn, proofMarker) {
  if (!tx.intents || tx.intents.size === 0) return

  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment)
    if (!intent) continue

    const cloned = ledger.Intent.deserialize('signature', proofMarker, 'pre-binding', intent.serialize())
    const signature = signFn(cloned.signatureData(segment))

    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_, index) => cloned.fallibleUnshieldedOffer.signatures.at(index) ?? signature,
      )
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs)
    }

    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_, index) => cloned.guaranteedUnshieldedOffer.signatures.at(index) ?? signature,
      )
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs)
    }

    tx.intents.set(segment, cloned)
  }
}

async function waitForWalletSync(Rx, wallet, timeoutMs) {
  return Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.filter((state) => state.isSynced),
      Rx.timeout({ first: timeoutMs }),
    ),
  )
}

async function waitForDust(Rx, wallet, timeoutMs) {
  return Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.filter((state) => state.isSynced),
      Rx.filter((state) => state.dust.walletBalance(new Date()) > 0n || state.dust.availableCoins.length > 0),
      Rx.timeout({ first: timeoutMs }),
    ),
  )
}

async function createHeadlessWalletProviders() {
  const [Rx, wsModule, ledger, hd, shielded, unshielded, dust, facade] = await Promise.all([
    importRequired('rxjs', 'Instalá dependencias con pnpm install.'),
    importRequired('ws', 'El deploy headless necesita ws para suscripciones del indexer en Node.'),
    importRequired('@midnight-ntwrk/ledger-v8', 'Instalá las dependencias Midnight headless documentadas en apps/web/.env_template.'),
    importRequired('@midnight-ntwrk/wallet-sdk-hd', 'Falta el SDK headless para derivar claves desde MIDNIGHT_WALLET_SEED_HEX.'),
    importRequired('@midnight-ntwrk/wallet-sdk-shielded', 'Falta el wallet shielded headless.'),
    importRequired('@midnight-ntwrk/wallet-sdk-unshielded-wallet', 'Falta el wallet unshielded headless.'),
    importRequired('@midnight-ntwrk/wallet-sdk-dust-wallet', 'Falta el wallet DUST headless.'),
    importRequired('@midnight-ntwrk/wallet-sdk-facade', 'Falta WalletFacade para componer los wallets headless.'),
  ])

  globalThis.WebSocket = wsModule.WebSocket

  const hdWalletResult = hd.HDWallet.fromSeed(Buffer.from(config.seedHex, 'hex'))
  if (hdWalletResult.type !== 'seedOk') {
    throw new Error('MIDNIGHT_WALLET_SEED_HEX no es una seed hexadecimal válida.')
  }

  const derivationResult = hdWalletResult.hdWallet
    .selectAccount(0)
    .selectRoles([hd.Roles.Zswap, hd.Roles.NightExternal, hd.Roles.Dust])
    .deriveKeysAt(0)

  if (derivationResult.type !== 'keysDerived') {
    throw new Error('No pude derivar claves Midnight desde MIDNIGHT_WALLET_SEED_HEX.')
  }

  hdWalletResult.hdWallet.clear()

  const keys = derivationResult.keys
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[hd.Roles.Zswap])
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[hd.Roles.Dust])
  const unshieldedKeystore = unshielded.createKeystore(keys[hd.Roles.NightExternal], config.networkId)
  const indexerClientConnection = { indexerHttpUrl: config.indexerHttp, indexerWsUrl: config.indexerWs }
  const relayURL = new URL(relayUrlFromRpc(config.rpc))

  const shieldedWallet = shielded.ShieldedWallet({
    networkId: config.networkId,
    indexerClientConnection,
    provingServerUrl: new URL(config.proofServer),
    relayURL,
  }).startWithSecretKeys(shieldedSecretKeys)

  const unshieldedWallet = unshielded.UnshieldedWallet({
    networkId: config.networkId,
    indexerClientConnection,
    txHistoryStorage: new unshielded.InMemoryTransactionHistoryStorage(),
  }).startWithPublicKey(unshielded.PublicKey.fromKeyStore(unshieldedKeystore))

  const dustWallet = dust.DustWallet({
    networkId: config.networkId,
    costParameters: {
      additionalFeeOverhead: 300_000_000_000_000n,
      feeBlocksMargin: 5,
    },
    indexerClientConnection,
    provingServerUrl: new URL(config.proofServer),
    relayURL,
  }).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust)

  const wallet = new facade.WalletFacade(shieldedWallet, unshieldedWallet, dustWallet)
  await wallet.start(shieldedSecretKeys, dustSecretKey)

  const syncTimeoutMs = Number(process.env.MIDNIGHT_WALLET_SYNC_TIMEOUT_MS ?? 120_000)
  const syncedState = await waitForWalletSync(Rx, wallet, syncTimeoutMs)
  const dustTimeoutMs = Number(process.env.MIDNIGHT_DUST_TIMEOUT_MS ?? 120_000)

  if (process.env.MIDNIGHT_SKIP_DUST_WAIT !== 'true') {
    try {
      await waitForDust(Rx, wallet, dustTimeoutMs)
    } catch (error) {
      throw new Error(
        `La wallet sincronizó, pero no encontré DUST disponible para pagar el deploy. Cargá NIGHT en la dirección unshielded, registrá DUST si corresponde y esperá generación. Dirección unshielded: ${syncedState.unshielded.address}. Detalle: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  const latestState = await waitForWalletSync(Rx, wallet, syncTimeoutMs)
  const signFn = (payload) => unshieldedKeystore.signData(payload)

  return {
    provider: {
      getCoinPublicKey() {
        return latestState.shielded.coinPublicKey.toHexString()
      },
      getEncryptionPublicKey() {
        return latestState.shielded.encryptionPublicKey.toHexString()
      },
      async balanceTx(tx, ttl) {
        const recipe = await wallet.balanceUnboundTransaction(
          tx,
          { shieldedSecretKeys, dustSecretKey },
          { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
        )

        signTransactionIntents(ledger, recipe.baseTransaction, signFn, 'proof')
        if (recipe.balancingTransaction) {
          signTransactionIntents(ledger, recipe.balancingTransaction, signFn, 'pre-proof')
        }

        return wallet.finalizeRecipe(recipe)
      },
      submitTx(tx) {
        return wallet.submitTransaction(tx)
      },
    },
    unshieldedAddress: latestState.unshielded.address,
  }
}

async function main() {
  console.log('Deploy lease Compact contract')
  console.log(`Network: ${config.networkId}`)
  console.log(`Indexer HTTP: ${config.indexerHttp}`)
  console.log(`Indexer WS: ${config.indexerWs}`)
  console.log(`RPC/relay: ${config.rpc}`)
  console.log(`Proof server: ${config.proofServer}`)
  console.log(`ZK assets: ${config.managedLeaseDir}`)

  if (dryRun) {
    console.log('Dry-run OK: configuración resuelta. No se conectó wallet ni se envió deploy.')
    return
  }

  requiredEnv('MIDNIGHT_WALLET_SEED_HEX', config.seedHex)

  const [network, compactJs, midnightJs, indexerProvider, proofProvider, nodeZkProvider, managedContract] = await Promise.all([
    importRequired('@midnight-ntwrk/midnight-js-network-id', 'Agregá @midnight-ntwrk/midnight-js-network-id a las dependencias del paquete web.'),
    importRequired('@midnight-ntwrk/compact-js', 'Instalá dependencias con pnpm install.'),
    importRequired('@midnight-ntwrk/midnight-js', 'Instalá dependencias con pnpm install.'),
    importRequired('@midnight-ntwrk/midnight-js-indexer-public-data-provider', 'Instalá dependencias con pnpm install.'),
    importRequired('@midnight-ntwrk/midnight-js-http-client-proof-provider', 'Instalá dependencias con pnpm install.'),
    importRequired('@midnight-ntwrk/midnight-js-node-zk-config-provider', 'El deploy CLI necesita cargar claves ZK desde filesystem.'),
    import(path.join(rootDir, 'contracts/lease/managed/lease/contract/index.js')),
  ])

  network.setNetworkId(config.networkId)

  const zkConfigProvider = new nodeZkProvider.NodeZkConfigProvider(config.managedLeaseDir)
  const compiledContract = compactJs.CompiledContract.make('lease', managedContract.Contract).pipe(
    compactJs.CompiledContract.withVacantWitnesses,
    compactJs.CompiledContract.withCompiledFileAssets(config.managedLeaseDir),
  )
  const { provider: walletAndMidnightProvider, unshieldedAddress } = await createHeadlessWalletProviders()

  const providers = {
    privateStateProvider: createInMemoryPrivateStateProvider(),
    publicDataProvider: indexerProvider.indexerPublicDataProvider(config.indexerHttp, config.indexerWs),
    zkConfigProvider,
    proofProvider: proofProvider.httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  }

  const coinPublicKey = walletAndMidnightProvider.getCoinPublicKey()
  const deployed = await midnightJs.contracts.deployContract(providers, {
    compiledContract,
    privateStateId: 'leasePrivateState',
    initialPrivateState: createLeasePrivateState(coinPublicKey),
  })

  const contractAddress = deployed.deployTxData.public.contractAddress
  console.log('')
  console.log('Contrato desplegado correctamente.')
  console.log(`Dirección unshielded usada para fees: ${unshieldedAddress}`)
  console.log(`Contract address: ${contractAddress}`)
  console.log(`VITE_CONTRACT_ADDRESS=${contractAddress}`)
}

main().catch((error) => {
  console.error('')
  console.error('No pude desplegar el contrato lease.')
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
