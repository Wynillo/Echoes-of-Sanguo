import { Application, Container } from 'pixi.js';
import { Rarity } from '../../types.js';
import { runPackReveal } from './effects/packReveal.js';

let _app: Application | null = null;
const _containers = new Set<Container>();

export const fxManager = {
  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (_app) return;
    _app = new Application();
    await _app.init({
      canvas,
      backgroundAlpha: 0,
      antialias: false,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      width: window.innerWidth,
      height: window.innerHeight,
    });
    window.addEventListener('resize', () => {
      _app?.renderer.resize(window.innerWidth, window.innerHeight);
    });
  },

  packReveal(rarity: number, cardEl: HTMLElement): void {
    if (!_app || rarity < Rarity.Rare) return;
    const c = new Container();
    _app.stage.addChild(c);
    _containers.add(c);
    runPackReveal(_app, c, rarity, cardEl, () => {
      _app?.stage.removeChild(c);
      c.destroy({ children: true });
      _containers.delete(c);
    });
  },

  clearAll(): void {
    for (const c of _containers) {
      _app?.stage.removeChild(c);
      c.destroy({ children: true });
    }
    _containers.clear();
  },
};
