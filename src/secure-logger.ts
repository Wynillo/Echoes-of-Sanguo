// Secure logger wrapper for storage operations
// Provides namespaced logging with level-based filtering

export const secureLogger = {
  log(namespace: string, ...args: unknown[]): void {
    console.log(`[SECURE:${namespace}]`, ...args);
  },
  
  warn(namespace: string, ...args: unknown[]): void {
    console.warn(`[SECURE:${namespace}]`, ...args);
  },
  
  error(namespace: string, ...args: unknown[]): void {
    console.error(`[SECURE:${namespace}]`, ...args);
  },
  
  info(namespace: string, ...args: unknown[]): void {
    console.info(`[SECURE:${namespace}]`, ...args);
  },
};
