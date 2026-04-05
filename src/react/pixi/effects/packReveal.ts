import { Application, BlurFilter, Container, Graphics } from 'pixi.js';
import { Rarity } from '../../../types.js';

export interface RarityConfig {
  particleCount: number;
  beamCount: number;
  palette: number[];
  bloomStrength: number;
  spiral: boolean;
}

export const RARITY_CONFIG: Record<number, RarityConfig> = {
  [Rarity.Rare]: {
    particleCount: 60,
    beamCount: 4,
    palette: [0x7090ff, 0x4060cc, 0xa0c0ff, 0xffffff, 0x8888ff],
    bloomStrength: 0,
    spiral: false,
  },
  [Rarity.SuperRare]: {
    particleCount: 120,
    beamCount: 6,
    palette: [0xffd700, 0xffaa00, 0xfff0a0, 0xffffff, 0xff8800],
    bloomStrength: 15,
    spiral: false,
  },
  [Rarity.UltraRare]: {
    particleCount: 180,
    beamCount: 8,
    palette: [0xe070ff, 0x9030cc, 0xff80ff, 0xffffff, 0xc040ff, 0xff60ff],
    bloomStrength: 30,
    spiral: true,
  },
};

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  color: number;
  alpha: number;
  decay: number;
  shape: 'square' | 'cross' | 'diamond';
}

interface Beam {
  angle: number;
  alpha: number;
  decay: number;
  color: number;
  length: number;
  halfWidth: number;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function runPackReveal(
  app: Application,
  container: Container,
  rarity: number,
  cardEl: HTMLElement,
  onDone: () => void,
): void {
  const cfg = RARITY_CONFIG[rarity];
  if (!cfg) { onDone(); return; }

  const rect = cardEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const W = app.screen.width;
  const H = app.screen.height;

  const flash = new Graphics();
  flash.rect(0, 0, W, H).fill({ color: 0xfffee8 });
  flash.alpha = 0.8;
  container.addChild(flash);

  let bloom: Graphics | null = null;
  let bloomAlpha = 0;
  if (cfg.bloomStrength > 0) {
    bloom = new Graphics();
    bloom.circle(cx, cy, 100).fill({ color: cfg.palette[0] });
    bloom.alpha = 0.6;
    bloom.filters = [new BlurFilter({ strength: cfg.bloomStrength })];
    container.addChild(bloom);
    bloomAlpha = 0.6;
  }

  const beamContainer = new Container();
  beamContainer.blendMode = 'add';
  container.addChild(beamContainer);
  const beamG = new Graphics();
  beamContainer.addChild(beamG);

  const beams: Beam[] = Array.from({ length: cfg.beamCount }, (_, i) => ({
    angle: (i / cfg.beamCount) * Math.PI * 2 + Math.random() * 0.4,
    alpha: 0.7,
    decay: 0.01 + Math.random() * 0.005,
    color: pick(cfg.palette),
    length: 320 + Math.random() * 120,
    halfWidth: 12 + Math.random() * 14,
  }));

  const SIZES = [2, 3, 3, 4, 4, 6];
  const SHAPES: Particle['shape'][] = ['square', 'square', 'square', 'cross', 'diamond'];

  const particles: Particle[] = Array.from({ length: cfg.particleCount }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    return {
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      size: pick(SIZES),
      color: pick(cfg.palette),
      alpha: 1,
      decay: 0.008 + Math.random() * 0.009,
      shape: pick(SHAPES),
    };
  });

  const SPIRAL_PALETTE = [0xff6060, 0xffcc00, 0x60ff60, 0x60a0ff, 0xe070ff];
  const spiralParticles: Particle[] = cfg.spiral
    ? Array.from({ length: 40 }, (_, i) => {
        const angle = (i / 40) * Math.PI * 2;
        const r = 55 + Math.random() * 20;
        const tangent = angle + Math.PI / 2;
        const speed = 2.5 + Math.random() * 2;
        return {
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          vx: Math.cos(tangent) * speed,
          vy: Math.sin(tangent) * speed,
          size: 4,
          color: SPIRAL_PALETTE[i % SPIRAL_PALETTE.length],
          alpha: 1,
          decay: 0.007,
          shape: 'square' as const,
        };
      })
    : [];

  const particleG = new Graphics();
  container.addChild(particleG);

  const allParticles = [...particles, ...spiralParticles];
  let flashAlpha = 0.8;

  function tick() {
    // Flash decay
    flashAlpha = Math.max(0, flashAlpha - 0.07);
    flash.alpha = flashAlpha;

    // Bloom decay
    if (bloom) {
      bloomAlpha = Math.max(0, bloomAlpha - 0.008);
      bloom.alpha = bloomAlpha;
    }

    // Beams
    beamG.clear();
    for (const b of beams) {
      if (b.alpha <= 0) continue;
      b.angle += 0.006;
      b.alpha -= b.decay;
      const a = Math.max(0, b.alpha);
      const cos = Math.cos(b.angle);
      const sin = Math.sin(b.angle);
      const hw = b.halfWidth;
      const len = b.length;
      beamG.poly([
        cx, cy,
        cx + cos * len - sin * hw, cy + sin * len + cos * hw,
        cx + cos * len + sin * hw, cy + sin * len - cos * hw,
      ]).fill({ color: b.color, alpha: a * 0.45 });
    }

    // Particles
    particleG.clear();
    let anyAlive = false;
    for (const p of allParticles) {
      if (p.alpha <= 0) continue;
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.12;
      p.vx *= 0.97;
      p.alpha = Math.max(0, p.alpha - p.decay);
      if (p.alpha <= 0) continue;
      anyAlive = true;
      const a = p.alpha;
      const rx = Math.round(p.x);
      const ry = Math.round(p.y);
      const s = p.size;
      if (p.shape === 'cross') {
        particleG.rect(rx - Math.floor(s / 2), ry - 1, s, 2).fill({ color: p.color, alpha: a });
        particleG.rect(rx - 1, ry - Math.floor(s / 2), 2, s).fill({ color: p.color, alpha: a });
      } else if (p.shape === 'diamond') {
        const h = s / 2;
        particleG.poly([p.x, p.y - h, p.x + h, p.y, p.x, p.y + h, p.x - h, p.y])
          .fill({ color: p.color, alpha: a });
      } else {
        particleG.rect(rx, ry, s, s).fill({ color: p.color, alpha: a });
      }
    }

    const beamsAlive = beams.some(b => b.alpha > 0);
    if (!anyAlive && !beamsAlive && flashAlpha <= 0 && bloomAlpha <= 0) {
      app.ticker.remove(tick);
      onDone();
    }
  }

  app.ticker.add(tick);
}
