import { describe, expect, it } from 'vitest'

const contractPayloadBase = {
  landlordName: 'Ada Lovelace',
  landlordDocument: '20123456',
  landlordWallet: 'mn_addr_test1landlord',
  tenantName: 'Grace Hopper',
  tenantDocument: '30987654',
  tenantWallet: 'mn_addr_test1tenant',
  propertyAddress: '742 Evergreen Terrace',
  monthlyRent: '1200',
  currency: 'USD',
  durationMonths: '12',
  deposit: '1200',
  totalDue: '2400',
  createdAt: '2026-06-15T12:00:00.000Z',
} as const

describe('lease local hashing helpers', () => {
  it('builds deterministic contract artifacts from the local-only payload', async () => {
    const signatureModule = await import('./signature-payload').catch(() => ({
      buildRentalContractArtifacts: undefined,
    }))

    expect(signatureModule.buildRentalContractArtifacts).toBeTypeOf('function')

    const first = await signatureModule.buildRentalContractArtifacts?.(contractPayloadBase)
    const second = await signatureModule.buildRentalContractArtifacts?.(contractPayloadBase)

    expect(first).toEqual(second)
    expect(first?.payload.landlordName).toBe(contractPayloadBase.landlordName)
    expect(first?.payload.tenantName).toBe(contractPayloadBase.tenantName)
    expect(first?.contractIdHashHex).toMatch(/^0x[0-9a-f]{64}$/)
    expect(first?.contractHashHex).toMatch(/^0x[0-9a-f]{64}$/)
    expect(first?.landlordCommitmentHex).toMatch(/^0x[0-9a-f]{64}$/)
    expect(first?.tenantCommitmentHex).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('hashes the raw signature locally before producing the signer payload hash', async () => {
    const signatureModule = await import('./signature-payload').catch(() => ({
      buildLeaseSignatureArtifacts: undefined,
    }))

    expect(signatureModule.buildLeaseSignatureArtifacts).toBeTypeOf('function')

    const original = await signatureModule.buildLeaseSignatureArtifacts?.({
      contractIdHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      signerRole: 'tenant',
      signerName: 'Grace Hopper',
      signerDocument: '30987654',
      signerWallet: 'mn_addr_test1tenant',
      signatureDataUrl: 'data:image/png;base64,tenant-signature',
      signedAt: '2026-06-15T12:00:00.000Z',
    })
    const renamed = await signatureModule.buildLeaseSignatureArtifacts?.({
      contractIdHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      signerRole: 'tenant',
      signerName: 'Another Tenant',
      signerDocument: '30987654',
      signerWallet: 'mn_addr_test1tenant',
      signatureDataUrl: 'data:image/png;base64,tenant-signature',
      signedAt: '2026-06-15T12:00:00.000Z',
    })

    expect(original?.payload.signatureDataUrlHash).toBe(renamed?.payload.signatureDataUrlHash)
    expect(original?.payloadHashHex).not.toBe(renamed?.payloadHashHex)
  })

  it('changes the payment hash when any economic input changes', async () => {
    const signatureModule = await import('./signature-payload').catch(() => ({
      buildLeasePaymentArtifacts: undefined,
    }))

    expect(signatureModule.buildLeasePaymentArtifacts).toBeTypeOf('function')

    const first = await signatureModule.buildLeasePaymentArtifacts?.({
      contractIdHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      amount: '2400',
      currency: 'USD',
      payerWallet: 'mn_addr_test1tenant',
      payeeWallet: 'mn_addr_test1landlord',
      paidAt: '2026-06-15T12:00:00.000Z',
    })
    const second = await signatureModule.buildLeasePaymentArtifacts?.({
      contractIdHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      amount: '2500',
      currency: 'USD',
      payerWallet: 'mn_addr_test1tenant',
      payeeWallet: 'mn_addr_test1landlord',
      paidAt: '2026-06-15T12:00:00.000Z',
    })

    expect(first?.paymentHashHex).toMatch(/^0x[0-9a-f]{64}$/)
    expect(first?.paymentHashHex).not.toBe(second?.paymentHashHex)
  })
})
