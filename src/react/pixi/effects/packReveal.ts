import type { Application, Container } from 'pixi.js';
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

export function runPackReveal(
  _app: Application,
  _container: Container,
  _rarity: number,
  _cardEl: HTMLElement,
  onDone: () => void,
): void {
  onDone();
}
