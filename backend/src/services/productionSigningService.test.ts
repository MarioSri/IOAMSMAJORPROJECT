import { createArtifactHash, normalizeSignatureMetadata } from './productionSigningService';

describe('productionSigningService', () => {
  const signature = (overrides: Record<string, unknown> = {}) => ({
    id: 'signature-1',
    xPercent: 10,
    yPercent: 20,
    widthPercent: 25,
    heightPercent: 10,
    rotation: 90,
    data: 'data:image/png;base64,AAAA',
    pageNumber: 2,
    fileIndex: 1,
    ...overrides,
  });

  it('normalizes an in-bounds signature and records exact page/file location', () => {
    const [result] = normalizeSignatureMetadata([signature()], 'signer@example.com');

    expect(result).toMatchObject({
      id: 'signature-1',
      rotation: 90,
      signedBy: 'signer@example.com',
      location: {
        fileIndex: 1,
        pageNumber: 2,
        xPercent: 10,
        yPercent: 20,
        widthPercent: 25,
        heightPercent: 10,
      },
    });
  });

  it('rejects duplicate IDs and out-of-bounds rectangles', () => {
    expect(() => normalizeSignatureMetadata([signature(), signature()], 'signer')).toThrow(/duplicate id/i);
    expect(() => normalizeSignatureMetadata([signature({ xPercent: 80, widthPercent: 25 })], 'signer')).toThrow(/inside/i);
    expect(() => normalizeSignatureMetadata([signature({ pageNumber: 0 })], 'signer')).toThrow(/positive/i);
  });

  it('hashes file ordering, names, MIME types, lengths, and bytes', () => {
    const first = createArtifactHash([
      { name: 'a.pdf', mimetype: 'application/pdf', buffer: Buffer.from('A') },
      { name: 'b.pdf', mimetype: 'application/pdf', buffer: Buffer.from('B') },
    ]);
    const reordered = createArtifactHash([
      { name: 'b.pdf', mimetype: 'application/pdf', buffer: Buffer.from('B') },
      { name: 'a.pdf', mimetype: 'application/pdf', buffer: Buffer.from('A') },
    ]);
    const altered = createArtifactHash([
      { name: 'a.pdf', mimetype: 'application/pdf', buffer: Buffer.from('X') },
      { name: 'b.pdf', mimetype: 'application/pdf', buffer: Buffer.from('B') },
    ]);

    expect(first).toHaveLength(64);
    expect(reordered).not.toBe(first);
    expect(altered).not.toBe(first);
  });
});
