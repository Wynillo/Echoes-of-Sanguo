import { shuffleSecure, shuffleArraySecure } from './random';

/**
 * Fisher-Yates shuffle - returns a new shuffled array.
 * O(n) time complexity with unbiased random distribution.
 * Uses crypto.getRandomValues() for secure randomness.
 */
export function shuffleArray<T>(arr: readonly T[]): T[] {
  return shuffleArraySecure(arr);
}

/**
 * Fisher-Yates shuffle - shuffles array in-place.
 * O(n) time complexity with unbiased random distribution.
 * Uses crypto.getRandomValues() for secure randomness.
 */
export function shuffleInPlace<T>(arr: T[]): void {
  shuffleSecure(arr);
}
