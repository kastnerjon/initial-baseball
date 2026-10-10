import { describe, expect, it } from 'vitest';
import { createCustomNineTerminalReceiptCodec } from './customNineTerminalReceipt';
const ID = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174000';
const OTHER = 'custom-nine-v1-123e4567-e89b-42d3-a456-426614174001';
const secret = 'a-long-configured-progression-signature-secret-for-testing';
const codec = createCustomNineTerminalReceiptCodec(secret);
const atBat = { pitchNumber: 2, initials: 'AB', outcome: '2B' as const,
  hintsRevealed: 2 as const, wrongGuesses: 1, resolution: 'correct' as const };
const input = { puzzleId: ID, atBat, predecessorToken: 'signed-before', successorToken: 'signed-after' };
describe('signed Custom Nine terminal receipt', () => {
  it('signs the exact challenge and terminal facts without answer IDs or progression tokens', () => {
    const receipt = codec.sign(input);
    const result = codec.verify(receipt);
    expect(result).toMatchObject({ puzzleId: ID, atBat });
    expect(result.predecessorDigest).toHaveLength(43);
    expect(result.successorDigest).toHaveLength(43);
    const payload = Buffer.from(receipt.split('.')[1]!, 'base64url').toString();
    expect(payload).not.toContain('signed-before');
    expect(payload).not.toContain('signed-after');
    expect(payload).not.toContain('canonicalPlayerId');
    expect(codec.sign({ ...input, puzzleId: OTHER })).not.toBe(receipt);
  });
  it('rejects tampering, different secrets and malformed tokens', () => {
    const receipt = codec.sign(input);
    expect(() => codec.verify(receipt + '=')).toThrow();
    expect(() => codec.verify(receipt + '.extra')).toThrow();
    expect(() => codec.verify('x'.repeat(2049))).toThrow();
    expect(() => codec.verify(null)).toThrow();
    expect(() => createCustomNineTerminalReceiptCodec('different-long-configuration-secret').verify(receipt)).toThrow();
    expect(() => createCustomNineTerminalReceiptCodec('short')).toThrow();
  });
  it('rejects inconsistent outcomes before signing', () => {
    expect(() => codec.sign({ ...input, atBat: { ...atBat, outcome: 'HR' } })).toThrow();
    expect(() => codec.sign({ ...input, atBat: { ...atBat, outcome: 'K', resolution: 'strikeout' } })).toThrow();
    expect(() => codec.sign({ ...input, atBat: { ...atBat, outcome: 'K', resolution: 'give_up', wrongGuesses: 3 } })).toThrow();
  });
});
