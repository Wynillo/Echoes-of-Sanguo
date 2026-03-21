// ============================================================
// AETHERIAL CLASH – Audio Manager
// Singleton-Modul für Musik und Sound-Effekte (Web Audio API)
// ============================================================

import { Progression } from './progression.js';

const MANIFEST: Record<string, string> = {
  // Music
  music_title:       'audio/music/title.mp3',
  music_battle:      'audio/music/battle.mp3',
  music_shop:        'audio/music/shop.mp3',
  music_victory:     'audio/music/victory.mp3',
  music_defeat:      'audio/music/defeat.mp3',
  // SFX
  sfx_card_play:     'audio/sfx/card-play.mp3',
  sfx_attack:        'audio/sfx/attack.mp3',
  sfx_damage:        'audio/sfx/damage.mp3',
  sfx_destroy:       'audio/sfx/destroy.mp3',
  sfx_draw:          'audio/sfx/draw.mp3',
  sfx_fusion:        'audio/sfx/fusion.mp3',
  sfx_spell:         'audio/sfx/spell.mp3',
  sfx_trap:          'audio/sfx/trap.mp3',
  sfx_button:        'audio/sfx/button.mp3',
  sfx_coin:          'audio/sfx/coin.mp3',
  sfx_pack_open:     'audio/sfx/pack-open.mp3',
  sfx_pack_reveal:   'audio/sfx/pack-reveal.mp3',
};

let _ctx: AudioContext | null = null;
let _masterGain: GainNode | null = null;
let _musicGain: GainNode | null = null;
let _sfxGain: GainNode | null = null;

const _bufferCache = new Map<string, AudioBuffer>();
let _currentMusic: { source: AudioBufferSourceNode; id: string } | null = null;

function _ensureContext(): AudioContext {
  if (!_ctx) {
    _ctx = new AudioContext();
    _masterGain = _ctx.createGain();
    _musicGain  = _ctx.createGain();
    _sfxGain    = _ctx.createGain();

    _musicGain.connect(_masterGain);
    _sfxGain.connect(_masterGain);
    _masterGain.connect(_ctx.destination);

    const s = Progression.getSettings();
    _applyVolumes(s.volMaster, s.volMusic, s.volSfx);
  }
  if (_ctx.state === 'suspended') {
    _ctx.resume();
  }
  return _ctx;
}

function _applyVolumes(master: number, music: number, sfx: number) {
  if (_masterGain) _masterGain.gain.value = master / 100;
  if (_musicGain)  _musicGain.gain.value  = music / 100;
  if (_sfxGain)    _sfxGain.gain.value    = sfx / 100;
}

async function _loadBuffer(id: string): Promise<AudioBuffer | null> {
  if (_bufferCache.has(id)) return _bufferCache.get(id)!;
  const path = MANIFEST[id];
  if (!path) return null;

  try {
    const ctx = _ensureContext();
    const resp = await fetch(path);
    if (!resp.ok) return null;
    const arrayBuf = await resp.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    _bufferCache.set(id, audioBuf);
    return audioBuf;
  } catch {
    return null;
  }
}

function init(): void {
  // Lazy — actual context creation happens on first user interaction
}

function setVolumes(master: number, music: number, sfx: number): void {
  _applyVolumes(master, music, sfx);
}

async function playMusic(trackId: string): Promise<void> {
  if (_currentMusic?.id === trackId) return;
  stopMusic();

  const buf = await _loadBuffer(trackId);
  if (!buf) return;

  const ctx = _ensureContext();
  const source = ctx.createBufferSource();
  source.buffer = buf;
  source.loop = true;
  source.connect(_musicGain!);
  source.start(0);

  _currentMusic = { source, id: trackId };
}

function stopMusic(): void {
  if (_currentMusic) {
    try { _currentMusic.source.stop(); } catch { /* already stopped */ }
    _currentMusic = null;
  }
}

async function playSfx(sfxId: string): Promise<void> {
  const buf = await _loadBuffer(sfxId);
  if (!buf) return;

  const ctx = _ensureContext();
  const source = ctx.createBufferSource();
  source.buffer = buf;
  source.connect(_sfxGain!);
  source.start(0);
}

async function preload(ids: string[]): Promise<void> {
  await Promise.all(ids.map(id => _loadBuffer(id)));
}

function suspend(): void {
  _ctx?.suspend();
}

function resume(): void {
  _ctx?.resume();
}

export const Audio = { init, setVolumes, playMusic, stopMusic, playSfx, preload, suspend, resume };
