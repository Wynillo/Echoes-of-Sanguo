import { describe, it, expect } from 'vitest';
import { CARD_TOKENS, getCardTokens, type CardSize } from '../../../src/react/components/card/CardTokens.js';

describe('CardTokens', () => {
  const sizes: CardSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

  const expectedDimensions: Record<CardSize, { width: number; height: number }> = {
    xs: { width: 68, height: 94 },
    sm: { width: 104, height: 144 },
    md: { width: 140, height: 195 },
    lg: { width: 180, height: 248 },
    xl: { width: 220, height: 307 },
  };

  it('should have all 5 sizes defined', () => {
    sizes.forEach((size) => {
      expect(CARD_TOKENS[size]).toBeDefined();
    });
  });

  it('should have correct width and height for each size', () => {
    sizes.forEach((size) => {
      const tokens = CARD_TOKENS[size];
      expect(tokens.width).toBe(expectedDimensions[size].width);
      expect(tokens.height).toBe(expectedDimensions[size].height);
    });
  });

  it('should return correct tokens from getCardTokens', () => {
    sizes.forEach((size) => {
      const tokens = getCardTokens(size);
      expect(tokens).toEqual(CARD_TOKENS[size]);
    });
  });

  it('should have aspect ratio between 0.70 and 0.73 for all sizes', () => {
    sizes.forEach((size) => {
      const tokens = CARD_TOKENS[size];
      const aspectRatio = tokens.width / tokens.height;
      expect(aspectRatio).toBeGreaterThanOrEqual(0.7);
      expect(aspectRatio).toBeLessThanOrEqual(0.73);
    });
  });
});
