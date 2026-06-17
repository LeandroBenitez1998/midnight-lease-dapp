export type RentalContractPayloadInput = {
  landlordName: string
  landlordDocument: string
  landlordWallet: string
  tenantName: string
  tenantDocument: string
  tenantWallet: string
  propertyAddress: string
  monthlyRent: string
  currency: string
  durationMonths: string
  deposit: string
  totalDue: string
  createdAt: string
}

export type RentalContractPayload = RentalContractPayloadInput

export type RentalContractArtifacts = {
  payload: RentalContractPayload
  payloadJson: string
  contractIdHashHex: string
  contractHashHex: string
  landlordCommitmentHex: string
  tenantCommitmentHex: string
}

export type LeaseSignaturePayloadInput = {
  contractIdHash: string
  signerRole: 'landlord' | 'tenant'
  signerName: string
  signerDocument: string
  signerWallet: string
  signatureDataUrl: string
  signedAt: string
}

export type LeaseSignaturePayload = {
  contractIdHash: string
  signerRole: 'landlord' | 'tenant'
  signerName: string
  signerDocument: string
  signerWallet: string
  signatureDataUrlHash: string
  signedAt: string
}

export type LeaseSignatureArtifacts = {
  payload: LeaseSignaturePayload
  payloadJson: string
  payloadHashHex: string
}

export type LeasePaymentPayloadInput = {
  contractIdHash: string
  amount: string
  currency: string
  payerWallet: string
  payeeWallet: string
  paidAt: string
}

export type LeasePaymentPayload = LeasePaymentPayloadInput

export type LeasePaymentArtifacts = {
  payload: LeasePaymentPayload
  payloadJson: string
  paymentHashHex: string
}

export async function buildRentalContractArtifacts(input: RentalContractPayloadInput): Promise<RentalContractArtifacts> {
  const payload: RentalContractPayload = {
    landlordName: normalizeRequiredValue(input.landlordName, 'landlordName'),
    landlordDocument: normalizeRequiredValue(input.landlordDocument, 'landlordDocument'),
    landlordWallet: normalizeRequiredValue(input.landlordWallet, 'landlordWallet'),
    tenantName: normalizeRequiredValue(input.tenantName, 'tenantName'),
    tenantDocument: normalizeRequiredValue(input.tenantDocument, 'tenantDocument'),
    tenantWallet: normalizeRequiredValue(input.tenantWallet, 'tenantWallet'),
    propertyAddress: normalizeRequiredValue(input.propertyAddress, 'propertyAddress'),
    monthlyRent: normalizeRequiredValue(input.monthlyRent, 'monthlyRent'),
    currency: normalizeRequiredValue(input.currency, 'currency').toUpperCase(),
    durationMonths: normalizeRequiredValue(input.durationMonths, 'durationMonths'),
    deposit: normalizeRequiredValue(input.deposit, 'deposit'),
    totalDue: normalizeRequiredValue(input.totalDue, 'totalDue'),
    createdAt: normalizeRequiredValue(input.createdAt, 'createdAt'),
  }

  const payloadJson = JSON.stringify(payload)
  const contractIdSeed = JSON.stringify({
    propertyAddress: payload.propertyAddress,
    landlordWallet: payload.landlordWallet,
    tenantWallet: payload.tenantWallet,
    createdAt: payload.createdAt,
  })

  return {
    payload,
    payloadJson,
    contractIdHashHex: await sha256Hex(contractIdSeed),
    contractHashHex: await sha256Hex(payloadJson),
    landlordCommitmentHex: await sha256Hex(
      JSON.stringify({
        role: 'landlord',
        name: payload.landlordName,
        document: payload.landlordDocument,
        wallet: payload.landlordWallet,
      }),
    ),
    tenantCommitmentHex: await sha256Hex(
      JSON.stringify({
        role: 'tenant',
        name: payload.tenantName,
        document: payload.tenantDocument,
        wallet: payload.tenantWallet,
      }),
    ),
  }
}

export async function buildLeaseSignatureArtifacts(input: LeaseSignaturePayloadInput): Promise<LeaseSignatureArtifacts> {
  const payload: LeaseSignaturePayload = {
    contractIdHash: normalizeRequiredValue(input.contractIdHash, 'contractIdHash').toLowerCase(),
    signerRole: input.signerRole,
    signerName: normalizeRequiredValue(input.signerName, 'signerName'),
    signerDocument: normalizeRequiredValue(input.signerDocument, 'signerDocument'),
    signerWallet: normalizeRequiredValue(input.signerWallet, 'signerWallet'),
    signatureDataUrlHash: await sha256Hex(normalizeRequiredValue(input.signatureDataUrl, 'signatureDataUrl')),
    signedAt: normalizeRequiredValue(input.signedAt, 'signedAt'),
  }

  const payloadJson = JSON.stringify(payload)

  return {
    payload,
    payloadJson,
    payloadHashHex: await sha256Hex(payloadJson),
  }
}

export async function buildLeasePaymentArtifacts(input: LeasePaymentPayloadInput): Promise<LeasePaymentArtifacts> {
  const payload: LeasePaymentPayload = {
    contractIdHash: normalizeRequiredValue(input.contractIdHash, 'contractIdHash').toLowerCase(),
    amount: normalizeRequiredValue(input.amount, 'amount'),
    currency: normalizeRequiredValue(input.currency, 'currency').toUpperCase(),
    payerWallet: normalizeRequiredValue(input.payerWallet, 'payerWallet'),
    payeeWallet: normalizeRequiredValue(input.payeeWallet, 'payeeWallet'),
    paidAt: normalizeRequiredValue(input.paidAt, 'paidAt'),
  }

  const payloadJson = JSON.stringify(payload)

  return {
    payload,
    payloadJson,
    paymentHashHex: await sha256Hex(payloadJson),
  }
}

function normalizeRequiredValue(value: string, fieldName: string): string {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error(`Falta ${fieldName} para firmar el lease.`)
  }

  return normalized
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}
