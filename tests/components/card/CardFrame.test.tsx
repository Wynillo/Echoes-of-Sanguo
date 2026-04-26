/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyTypeMeta } from '../../../src/type-metadata.js';
import { CardFrame } from '../../../src/react/components/card/CardFrame.js';
import type { CardData } from '../../../src/types.js';
import { CardType } from '../../../src/types.js';

// Initialize attribute metadata for tests
beforeAll(() => {
  applyTypeMeta({
    attributes: [
      { id: 1, key: 'dark', value: 'Dark', color: '#5B3A77' },
      { id: 2, key: 'earth', value: 'Earth', color: '#8B6F47' },
      { id: 3, key: 'fire', value: 'Fire', color: '#C1440E' },
      { id: 4, key: 'light', value: 'Light', color: '#F0E130' },
      { id: 5, key: 'water', value: 'Water', color: '#1E99D9' },
      { id: 6, key: 'wind', value: 'Wind', color: '#5AB9EA' },
    ],
  });
});

const mockMonster: CardData = {
  id: 1,
  name: 'Test Monster',
  type: CardType.Monster,
  attribute: 3, // Fire attribute
  level: 4,
  atk: 1800,
  def: 1200,
  effect: false,
  text: 'A test monster card.',
  illustration: '',
  race: 1,
  packId: 1,
};

function getRenderedHtml(element: React.ReactNode): string {
  return renderToStaticMarkup(element);
}

describe('CardFrame', () => {
  it('should render with correct dimensions for sm size', () => {
    const html = getRenderedHtml(<CardFrame card={mockMonster} size="sm" layout="compact" />);
    expect(html).toContain('width:104px');
    expect(html).toContain('height:144px');
  });

  it('should render card back with label A when layout is none', () => {
    const html = getRenderedHtml(<CardFrame card={mockMonster} size="sm" layout="none" />);
    expect(html).toContain('>A<');
  });

  it('should apply normal-card class for normal monster', () => {
    const html = getRenderedHtml(<CardFrame card={mockMonster} size="sm" layout="compact" />);
    expect(html).toMatch(/class="[^"]*normal-card/);
  });

  it('should apply attrFire class for Fire attribute', () => {
    const html = getRenderedHtml(<CardFrame card={mockMonster} size="sm" layout="compact" />);
    expect(html).toMatch(/class="[^"]*attrFire/);
  });
});
