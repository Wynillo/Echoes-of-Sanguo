/**
 * Escapes HTML special characters to prevent XSS attacks.
 * Used to sanitize untrusted card descriptions from TCG mod files.
 * 
 * Security: This function provides defense-in-depth for string-based HTML generation.
 * React components automatically escape content in JSX expressions, but when generating
 * HTML strings (e.g., for innerHTML injection), manual escaping is required.
 * 
 * @see https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html
 * @see https://cwe.mitre.org/data/definitions/116.html
 * 
 * @example
 * // Safe usage in highlightCardTextHTML:
 * const safeText = escapeHtml(userInput); // "&lt;script&gt;" instead of "<script>"
 * 
 * @param str - Untrusted string to escape
 * @returns HTML-escaped string safe for DOM insertion
 */
export function escapeHtml(str: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return str.replace(/[&<>"'/]/g, char => htmlEntities[char]);
}
