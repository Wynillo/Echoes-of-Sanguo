// ============================================================
// ECHOES OF SANGUO — Debug Logger
// ============================================================
//
// Toggle with:  EchoesOfSanguo.debug = true   (in browser console)
// Categories:   PHASE | AI | BATTLE | EFFECT | SUMMON | SPELL | ERROR
// Each category has its own color; errors always show regardless of flag.
//
import type { Owner } from './types.js';
import { Owner as OwnerFactory } from './types.js';

export const ownerLabel = (owner: Owner): string => owner === OwnerFactory.PLAYER ? 'Player' : 'Opponent';

export const EchoesOfSanguo = {
  debug: false,

  // ── Log buffer (always active, independent of debug flag) ──
  _entries: [] as Array<{ ts: string; category: string; msg: string; dataStr: string }>,
  _sessionStart: null as string | null, // ISO timestamp of session start

  _colors: {
    PHASE:  '#7ecfff',
    AI:     '#b8ff7e',
    BATTLE: '#ff9f4a',
    EFFECT: '#e07eff',
    SUMMON: '#7effc3',
    SPELL:  '#ffe07e',
    TRAP:   '#ff7eb8',
    GAME:   '#ffffff',
    ERROR:  '#ff4444',
  } as Record<string, string>,

  // Called by GameEngine.addLog() to buffer game events
  gameEvent(msg: string){
    this._push('GAME', msg);
  },

  log(category: string, msg: string, data: unknown = undefined){
    this._push(category, msg, data);
    if(!this.debug && category !== 'ERROR') return;
    const color  = this._colors[category] || '#aaa';
    const prefix = `%c[${category}]`;
    const style  = `color:${color};font-weight:bold;font-family:monospace`;
    if(data !== undefined){
      console.log(prefix, style, msg, data);
    } else {
      console.log(prefix, style, msg);
    }
  },

  _push(category: string, msg: string, data: unknown = undefined){
    const ts = new Date().toISOString();
    const dataStr = data !== undefined
      ? (typeof data === 'object' ? JSON.stringify(data) : String(data))
      : '';
    this._entries.push({ ts, category, msg, dataStr });
  },

  group(label: string){
    this._push('PHASE', `>>> ${label}`);
    if(!this.debug) return;
    console.group(`%c${label}`, 'color:#ffd700;font-weight:bold;font-family:monospace');
  },

  groupEnd(){
    if(!this.debug) return;
    console.groupEnd();
  },

  // Starts a new session (clears old buffer)
  startSession(){
    this._entries  = [];
    this._sessionStart = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this._push('GAME', `=== Session started: ${new Date().toLocaleString()} ===`);
  },

  // Builds log content as text
  _buildLogText(){
    const lines = this._entries.map(e => {
      const base = `[${e.ts}] [${e.category.padEnd(6)}] ${e.msg}`;
      return e.dataStr ? `${base}  ${e.dataStr}` : base;
    });
    return lines.join('\n');
  },

  // Downloads the log file
  // filename: e.g. "echoes_of_sanguo_2026-03-17_14-30-00.log"
  downloadLog(reason = 'manual'){
    const ts       = this._sessionStart || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `echoes_of_sanguo_${ts}_${reason}.log`;
    const text     = this._buildLogText();
    if(typeof document === 'undefined') return; // guard: no DOM in Node/test environment
    const blob     = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = filename;
    a.click();
    URL.revokeObjectURL(url);
    console.info(`[EchoesOfSanguo] Log saved: ${filename} (${this._entries.length} entries)`);
  },
};
