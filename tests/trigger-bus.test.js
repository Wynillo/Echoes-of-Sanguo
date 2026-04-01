import { describe, it, expect, vi } from 'vitest';
import { TriggerBus } from '../src/trigger-bus.js';

// setup.js calls TriggerBus.clear() in afterEach, so each test starts clean.

describe('TriggerBus', () => {
  it('calls handler when event is emitted', () => {
    const handler = vi.fn();
    TriggerBus.on('onSummon', handler);
    const ctx = { engine: {}, owner: 'player' };
    TriggerBus.emit('onSummon', ctx);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(ctx);
  });

  it('does not call handler for a different event', () => {
    const handler = vi.fn();
    TriggerBus.on('onSummon', handler);
    TriggerBus.emit('onFlip', { engine: {}, owner: 'player' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple handlers on the same event', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    TriggerBus.on('onSummon', h1);
    TriggerBus.on('onSummon', h2);
    TriggerBus.emit('onSummon', { engine: {}, owner: 'player' });
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('unsubscribes via returned function', () => {
    const handler = vi.fn();
    const unsub = TriggerBus.on('onSummon', handler);
    unsub();
    TriggerBus.emit('onSummon', { engine: {}, owner: 'player' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('clear() removes all handlers', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    TriggerBus.on('onSummon', h1);
    TriggerBus.on('onFlip', h2);
    TriggerBus.clear();
    TriggerBus.emit('onSummon', { engine: {}, owner: 'player' });
    TriggerBus.emit('onFlip', { engine: {}, owner: 'opponent' });
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('supports custom trigger names (modder use case)', () => {
    const handler = vi.fn();
    TriggerBus.on('onEliteSummon', handler);
    // Simulate a modder's derived trigger
    TriggerBus.on('onSummon', (ctx) => {
      if (ctx.card && ctx.card.level >= 7) {
        TriggerBus.emit('onEliteSummon', ctx);
      }
    });
    TriggerBus.emit('onSummon', { engine: {}, owner: 'player', card: { level: 8, name: 'Dragon' } });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not fire derived trigger for low-level card', () => {
    const handler = vi.fn();
    TriggerBus.on('onEliteSummon', handler);
    TriggerBus.on('onSummon', (ctx) => {
      if (ctx.card && ctx.card.level >= 7) {
        TriggerBus.emit('onEliteSummon', ctx);
      }
    });
    TriggerBus.emit('onSummon', { engine: {}, owner: 'player', card: { level: 3, name: 'Goblin' } });
    expect(handler).not.toHaveBeenCalled();
  });

  it('emitting unknown event does nothing', () => {
    expect(() => {
      TriggerBus.emit('nonExistentEvent', { engine: {}, owner: 'player' });
    }).not.toThrow();
  });
});
