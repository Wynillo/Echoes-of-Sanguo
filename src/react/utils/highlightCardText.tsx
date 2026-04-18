// ============================================================
// highlightCardText — keyword highlighting for card descriptions
// ============================================================
import React from 'react';
import { TYPE_META, getRaceByKey, getAttrByKey } from '../../type-metadata.js';

// ── Static keyword rules (checked before dynamic race/attr) ──

type StaticRule = { pattern: RegExp; className: string };

const STATIC_RULES: StaticRule[] = [
  // Tags
  { pattern: /\[Effect\]/g,           className: 'kw-effect' },
  { pattern: /\[Passive\]/g,          className: 'kw-passive' },
  { pattern: /\[Fusion\]/g,           className: 'kw-fusion' },
  // Stats
  { pattern: /\bATK\b/g,              className: 'kw-atk' },
  { pattern: /\bDEF\b/g,              className: 'kw-def' },
  // Signed numbers (+200, -500)
  { pattern: /[+-]\d+/g,              className: 'kw-number' },
  // Game terms (longer patterns first to avoid partial matches)
  { pattern: /\bSpecial Summon(?:ed)?\b/g, className: 'kw-term' },
  { pattern: /\bSummon\b/g,           className: 'kw-term' },
  { pattern: /\bGraveyard\b/g,        className: 'kw-term' },
  { pattern: /\bDraw\b/g,             className: 'kw-term' },
  { pattern: /\bDeck\b/g,             className: 'kw-term' },
  { pattern: /\bLP\b/g,               className: 'kw-term' },
];

// ── Build combined regex from all rules ──

type MatchRule = { className: string; color?: string };

function buildCombinedRegex(): { regex: RegExp; ruleMap: MatchRule[] } {
  const groups: string[] = [];
  const ruleMap: MatchRule[] = [];

  // Static rules first
  for (const r of STATIC_RULES) {
    groups.push(`(${r.pattern.source})`);
    ruleMap.push({ className: r.className });
  }

  // Dynamic race names (sorted longest-first)
  const races = [...TYPE_META.races].sort((a, b) => b.key.length - a.key.length);
  for (const race of races) {
    groups.push(`(\\b${race.key}\\b)`);
    ruleMap.push({ className: 'kw-race', color: race.color });
  }

  // Dynamic attribute names (sorted longest-first)
  const attrs = [...TYPE_META.attributes].sort((a, b) => b.key.length - a.key.length);
  for (const attr of attrs) {
    groups.push(`(\\b${attr.key}\\b)`);
    ruleMap.push({ className: 'kw-attr', color: attr.color });
  }

  return { regex: new RegExp(groups.join('|'), 'g'), ruleMap };
}

// Cache: rebuilt lazily when TYPE_META changes size
let _cache: { regex: RegExp; ruleMap: MatchRule[] } | null = null;
let _cacheKey = 0;

function getCompiledRules() {
  const key = TYPE_META.races.length + TYPE_META.attributes.length;
  if (!_cache || _cacheKey !== key) {
    _cache = buildCombinedRegex();
    _cacheKey = key;
  }
  return _cache;
}

// ── Tokeniser ──

type Token = { text: string; rule?: MatchRule };

function tokenize(desc: string): Token[] {
  const { regex, ruleMap } = getCompiledRules();
  const tokens: Token[] = [];
  let lastIndex = 0;

  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(desc)) !== null) {
    // Plain text before match
    if (match.index > lastIndex) {
      tokens.push({ text: desc.slice(lastIndex, match.index) });
    }
    // Find which capture group matched
    for (let i = 1; i < match.length; i++) {
      if (match[i] !== undefined) {
        tokens.push({ text: match[0], rule: ruleMap[i - 1] });
        break;
      }
    }
    lastIndex = match.index + match[0].length;
  }
  // Trailing text
  if (lastIndex < desc.length) {
    tokens.push({ text: desc.slice(lastIndex) });
  }
  return tokens;
}

// ── React output ──

export function highlightCardText(desc: string): React.ReactNode {
  const tokens = tokenize(desc);
  if (tokens.length === 1 && !tokens[0].rule) return desc;

  return (
    <>
      {tokens.map((tok, i) => {
        if (!tok.rule) return tok.text;
        const Tag = (tok.rule.className === 'kw-effect' || tok.rule.className === 'kw-passive') ? 'strong' : 'span';
        return <Tag key={i} className={tok.rule.className} style={tok.rule.color ? { color: tok.rule.color } : undefined}>{tok.text}</Tag>;
      })}
    </>
  );
}

// ── HTML string output (for cardInnerHTML) ──

function escapeHtml(str: string): string {
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

export function highlightCardTextHTML(desc: string): string {
  const tokens = tokenize(desc);
  if (tokens.length === 1 && !tokens[0].rule) return escapeHtml(desc);

  return tokens.map(tok => {
    if (!tok.rule) return escapeHtml(tok.text);
    const tag = (tok.rule.className === 'kw-effect' || tok.rule.className === 'kw-passive') ? 'strong' : 'span';
    const style = tok.rule.color ? ` style="color:${tok.rule.color}"` : '';
    return `<${tag} class="${tok.rule.className}"${style}>${escapeHtml(tok.text)}</${tag}>`;
  }).join('');
}
