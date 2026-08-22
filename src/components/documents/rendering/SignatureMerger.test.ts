import { describe, expect, it } from 'vitest';
import { adjustPdfPositionForRotation, normalizePdfRotation } from './SignatureMerger';

describe('SignatureMerger PDF rotation mapping', () => {
  it('normalizes arbitrary page rotations to quarter turns', () => {
    expect(normalizePdfRotation(0)).toBe(0);
    expect(normalizePdfRotation(89)).toBe(90);
    expect(normalizePdfRotation(181)).toBe(180);
    expect(normalizePdfRotation(269)).toBe(270);
    expect(normalizePdfRotation(-90)).toBe(270);
  });

  it('preserves the visual position for an unrotated page', () => {
    expect(adjustPdfPositionForRotation(600, 800, 120, 450, 0)).toEqual({
      xPos: 120,
      yPos: 450,
    });
  });

  it('matches the Documenso-style quarter-turn transforms', () => {
    expect(adjustPdfPositionForRotation(800, 600, 120, 450, 90)).toEqual({
      xPos: 150,
      yPos: 120,
    });
    expect(adjustPdfPositionForRotation(800, 600, 120, 450, 270)).toEqual({
      xPos: 450,
      yPos: 680,
    });
    expect(adjustPdfPositionForRotation(800, 600, 120, 450, 180)).toEqual({
      xPos: 680,
      yPos: 150,
    });
  });
});
