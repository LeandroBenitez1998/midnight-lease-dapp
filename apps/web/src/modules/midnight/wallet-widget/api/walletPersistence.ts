const RDNS_CONNECTED_KEY = "rdns-connected";
const NETWORK_ID_KEY = "network-id";

export interface PersistedWalletConnection {
  rdns: string;
  networkID: string;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function getPersistedWalletConnection(
  storage: StorageLike
): PersistedWalletConnection | null {
  const rdns = storage.getItem(RDNS_CONNECTED_KEY);
  const networkID = storage.getItem(NETWORK_ID_KEY);

  if (!rdns || !networkID) {
    return null;
  }

  return { rdns, networkID };
}

export function setPersistedWalletConnection(
  storage: StorageLike,
  { rdns, networkID }: PersistedWalletConnection
): void {
  storage.setItem(RDNS_CONNECTED_KEY, rdns);
  storage.setItem(NETWORK_ID_KEY, networkID);
}

export function clearPersistedWalletConnection(storage: StorageLike): void {
  storage.removeItem(RDNS_CONNECTED_KEY);
  storage.removeItem(NETWORK_ID_KEY);
}
