/**
 * Secure logging utilities for security-sensitive operations.
 * Provides structured logging with appropriate severity levels.
 */

export const secureLogger = {
  log(context: string, ...args: unknown[]): void {
    console.log(`[SECURE:${context}]`, ...args);
  },

  info(context: string, ...args: unknown[]): void {
    console.info(`[SECURE:${context}]`, ...args);
  },

  warn(context: string, ...args: unknown[]): void {
    console.warn(`[SECURE:${context}]`, ...args);
  },

  error(context: string, ...args: unknown[]): void {
    console.error(`[SECURE:${context}]`, ...args);
  },
};
