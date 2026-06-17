import { describe, expect, it } from "vitest";

import {
  clearPersistedWalletConnection,
  getPersistedWalletConnection,
  setPersistedWalletConnection,
} from "./walletPersistence";

function createStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));

  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
}

describe("wallet persistence helpers", () => {
  it("returns null when persisted reconnect state is incomplete", () => {
    const storage = createStorage({ "rdns-connected": "wallet.rdns" });

    expect(getPersistedWalletConnection(storage)).toBeNull();
  });

  it("persists and clears reconnect state together", () => {
    const storage = createStorage();

    setPersistedWalletConnection(storage, {
      rdns: "wallet.rdns",
      networkID: "preview",
    });

    expect(getPersistedWalletConnection(storage)).toEqual({
      rdns: "wallet.rdns",
      networkID: "preview",
    });

    clearPersistedWalletConnection(storage);

    expect(getPersistedWalletConnection(storage)).toBeNull();
  });
});
