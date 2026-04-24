import { Application, Container } from 'pixi.js';
import { Rarity } from '../../types.js';
import { runPackReveal } from './effects/packReveal.js';

let _app: Application | null = null;
let _mobile = false;
const _containers = new Set<Container>();
const _stopFns = new Set<() => void>();

const MAX_RESOLUTION = 2;

export const fxManager = {
  get mobile() { return _mobile; },

  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (_app) return;
    _mobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const resolution = Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION);
    _app = new Application();
    await _app.init({
      canvas,
      backgroundAlpha: 0,
      antialias: false,
      autoDensity: true,
      resolution,
      width: window.innerWidth,
      height: window.innerHeight,
    });
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      fxManager.clearAll();
    });
    window.addEventListener('resize', () => {
      _app?.renderer.resize(window.innerWidth, window.innerHeight);
    });
  },

  packReveal(rarity: number, cardEl: HTMLElement): void {
    if (!_app || rarity < Rarity.RARE) return;
    const c = new Container();
    _app.stage.addChild(c);
    _containers.add(c);
    const stop = runPackReveal(_app, c, rarity, cardEl, () => {
      _app?.stage.removeChild(c);
      c.destroy({ children: true });
      _containers.delete(c);
      _stopFns.delete(stop);
    });
    _stopFns.add(stop);
  },

  clearAll(): void {
    for (const fn of _stopFns) fn();
    _stopFns.clear();
    for (const c of _containers) {
      _app?.stage.removeChild(c);
      c.destroy({ children: true });
    }
    _containers.clear();
  },
};
