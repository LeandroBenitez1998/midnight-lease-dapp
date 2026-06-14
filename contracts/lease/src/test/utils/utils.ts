export const toHexPadded = (str: string, len = 64) =>
  Buffer.from(str, "ascii").toString("hex").padStart(len, "0");

export const bytesFromLabel = (label: string): Uint8Array => {
  return Buffer.from(toHexPadded(label), "hex");
};
