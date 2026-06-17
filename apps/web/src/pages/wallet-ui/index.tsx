import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCallback, useState } from "react";
import { Check, Copy, ExternalLink, Link2, RefreshCw, Rocket, Server, Wifi, WifiOff, Wallet } from "lucide-react";
import { MidnightWallet } from "@/modules/midnight/wallet-widget/ui/midnightWallet";
import { useWallet } from "@/modules/midnight/wallet-widget/hooks/useWallet";
import { LeaseContractController } from "@/modules/midnight/lease-sdk/api/contractController";
import { LeasePrivateStateId } from "@/modules/midnight/lease-sdk/api/common-types";
import {
  LEASE_PROVIDER_ACTION_MESSAGES,
  useLeaseProviders,
} from "@/modules/midnight/lease-sdk/hooks/useLeaseProviders";

function AddressField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="bg-muted/50 border border-border/60 px-3 py-2 rounded-md">
        <p className="text-xs font-mono break-all text-foreground/80">
          {value || "Not connected"}
        </p>
      </div>
    </div>
  );
}

function StatusIndicator({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${active ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function WalletUI() {
  const {
    disconnect,
    setOpen,
    refresh,
    status,
    proofServerOnline,
    initialAPI,
    unshieldedAddress,
    shieldedAddresses,
    serviceUriConfig,
    dustAddress,
    dustBalance,
    unshieldedBalances,
  } = useWallet();
  const [deploying, setDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const handleProviderAction = useCallback((action: keyof typeof LEASE_PROVIDER_ACTION_MESSAGES) => {
    const nextMessage = LEASE_PROVIDER_ACTION_MESSAGES[action];
    if (nextMessage) {
      setDeployMessage(nextMessage);
    }
  }, []);
  const { providers } = useLeaseProviders({ onProviderAction: handleProviderAction });

  const endpoints = [
    { label: 'Substrate Node', value: serviceUriConfig?.substrateNodeUri },
    { label: 'Indexer (REST)', value: serviceUriConfig?.indexerUri },
    { label: 'Indexer (WebSocket)', value: serviceUriConfig?.indexerWsUri },
    { label: 'Proof Server', value: serviceUriConfig?.proverServerUri },
  ];

  const deployLease = async () => {
    if (status?.status !== "connected") {
      setOpen(true);
      return;
    }

    if (!providers) {
      setDeployError("No pude inicializar los providers de Midnight. Verificá la wallet y el proof server.");
      return;
    }

    setDeploying(true);
    setDeployError(null);
    setDeployMessage("Preparando deploy del contrato lease...");
    setCopiedAddress(false);

    try {
      const controller = await LeaseContractController.deploy(LeasePrivateStateId, providers);
      const nextAddress = controller.deployedContractAddress;
      setDeployedAddress(nextAddress);
      setDeployMessage("Contrato desplegado correctamente.");
    } catch (error) {
      setDeployError(error instanceof Error ? error.message : String(error));
      setDeployMessage(null);
    } finally {
      setDeploying(false);
    }
  };

  const copyDeployedAddress = async () => {
    if (!deployedAddress) {
      return;
    }

    await navigator.clipboard.writeText(deployedAddress);
    setCopiedAddress(true);
    window.setTimeout(() => setCopiedAddress(false), 2000);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
            Wallet Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage your wallet and view connection details
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Wallet */}
          <div className="lg:col-span-2 space-y-6">
            {/* Connection Card */}
            <Card className="border-border/60">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Wallet className="h-4 w-4" />
                      Wallet Connection
                    </CardTitle>
                    <CardDescription>Connect and manage your Midnight wallet</CardDescription>
                  </div>
                  <StatusIndicator
                    active={status?.status === "connected"}
                    label={status?.status === "connected" ? "Connected" : "Disconnected"}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3">
                  <MidnightWallet />
                  <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </Button>
                  <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={disconnect} className="gap-1.5 text-destructive hover:text-destructive">
                    <Link2 className="h-3.5 w-3.5" />
                    Disconnect
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Addresses Card */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Addresses</CardTitle>
                <CardDescription>Your wallet addresses and keys</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <AddressField
                  label="Unshielded Address"
                  value={unshieldedAddress?.unshieldedAddress || ""}
                />
                <AddressField
                  label="Shielded Address"
                  value={shieldedAddresses?.shieldedAddress || ""}
                />
                <AddressField
                  label="Coin Public Key"
                  value={shieldedAddresses?.shieldedCoinPublicKey || ""}
                />
                <AddressField
                  label="Encryption Public Key"
                  value={shieldedAddresses?.shieldedEncryptionPublicKey || ""}
                />
                <AddressField
                  label="Dust Address"
                  value={dustAddress?.dustAddress || ""}
                />
              </CardContent>
            </Card>

            {/* Balances Card */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Balances</CardTitle>
                <CardDescription>Current token balances</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-muted/50 border border-border/60 rounded-lg p-4">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Dust Balance</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {dustBalance?.balance
                        ? Math.floor(Number(dustBalance.balance) / 1000000000000000).toLocaleString()
                        : "--"}
                    </p>
                  </div>
                  <div className="bg-muted/50 border border-border/60 rounded-lg p-4">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Dust Cap</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {dustBalance?.cap
                        ? Math.floor(Number(dustBalance.cap) / 1000000000000000).toLocaleString()
                        : "--"}
                    </p>
                  </div>
                  <div className="bg-muted/50 border border-border/60 rounded-lg p-4">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Night Balance</p>
                    <div className="text-xl font-semibold tabular-nums">
                      {unshieldedBalances
                        ? Object.entries(unshieldedBalances).map(([token, balance]) => (
                            <div key={token}>
                              {Math.floor(Number(balance) / 1000000).toLocaleString()}
                            </div>
                          ))
                        : "--"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Rocket className="h-4 w-4" />
                  Deploy manual del lease
                </CardTitle>
                <CardDescription>
                  Este flujo usa la wallet conectada para desplegar el contrato lease. El script headless sigue disponible para automatizacion.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
                  1. Conectá la wallet con NIGHT y DUST disponible.
                  <br />
                  2. Confirmá la firma cuando la extension lo pida.
                  <br />
                  3. Copiá la direccion resultante para usarla como <code>VITE_CONTRACT_ADDRESS</code>.
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={deployLease} disabled={deploying} className="gap-2">
                    <Rocket className="h-4 w-4" />
                    {status?.status === "connected" ? "Desplegar contrato lease" : "Conectar wallet para desplegar"}
                  </Button>
                  <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
                    <Wallet className="h-4 w-4" />
                    Abrir selector de wallet
                  </Button>
                </div>

                {deployMessage && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                    {deployMessage}
                  </div>
                )}

                {deployError && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {deployError}
                  </div>
                )}

                {deployedAddress && (
                  <div className="rounded-lg border border-border/60 bg-background p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">Direccion del contrato</p>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={copyDeployedAddress}>
                        {copiedAddress ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedAddress ? "Copiada" : "Copiar"}
                      </Button>
                    </div>
                    <p className="select-all break-all font-mono text-xs text-foreground/80">{deployedAddress}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Status */}
          <div className="space-y-6">
            {/* Status Card */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Server className="h-4 w-4" />
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Wallet</span>
                    <StatusIndicator
                      active={status?.status === "connected"}
                      label={status?.status === "connected" ? "Connected" : "Offline"}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Proof Server</span>
                    <div className="flex items-center gap-1.5">
                      {proofServerOnline ? (
                        <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <WifiOff className="h-3.5 w-3.5 text-muted-foreground/50" />
                      )}
                      <span className="text-sm">{proofServerOnline ? "Online" : "Offline"}</span>
                    </div>
                  </div>
                  {status?.status === "connected" && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Network</span>
                      <span className="text-sm font-mono">{status?.networkId}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Wallet Name</span>
                    <span className="text-sm">{initialAPI?.name || "--"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Endpoints Card */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Endpoints</CardTitle>
                <CardDescription>Network configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {endpoints.map((ep) => (
                  <div key={ep.label} className="space-y-0.5">
                    <p className="text-xs font-medium text-muted-foreground">{ep.label}</p>
                    <p className="text-xs font-mono text-foreground/70 break-all">
                      {ep.value || "Not available"}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
