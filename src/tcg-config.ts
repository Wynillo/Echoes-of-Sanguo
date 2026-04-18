/**
 * Maximum allowed size for TCG archive files.
 * Prevents resource exhaustion attacks via oversized .tcg files.
 * 50MB is sufficient for legitimate card packs with high-quality images.
 */
export const MAX_TCG_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * Formats a byte size into a human-readable string.
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "50.0 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
