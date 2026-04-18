/**
 * Escapes HTML special characters to prevent XSS attacks.
 * Use this function on all user-controllable text content from TCG mods.
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
  return str.replace(/[&<>"'/]/g, (char) => htmlEntities[char]);
}

export { highlightCardText } from './highlightCardText';
