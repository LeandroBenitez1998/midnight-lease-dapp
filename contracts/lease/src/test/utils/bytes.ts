export function createFilledBytes(length: number, value: number): Uint8Array {
  return Uint8Array.from({ length }, () => value)
}
