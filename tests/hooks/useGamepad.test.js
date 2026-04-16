import { test, expect, vi } from 'vitest';
import { readButtons, fireEdgeTriggered } from '../../src/react/contexts/GamepadContext.js';

const EMPTY_BUTTONS = { a: false, b: false, x: false, y: false, start: false, select: false, dpadUp: false, dpadDown: false, dpadLeft: false, dpadRight: false, leftBumper: false, rightBumper: false };

function mockGamepad(overrides = {}) {
  return {
    connected: true,
    id: 'Xbox Controller',
    buttons: Array(17).fill({ pressed: false, value: 0 }),
    axes: [0, 0, 0, 0],
    ...overrides,
  };
}

test('readButtons maps gamepad buttons correctly', () => {
  const gp = mockGamepad();
  gp.buttons[0] = { pressed: true, value: 1 };
  gp.buttons[9] = { pressed: true, value: 1 };
  gp.buttons[12] = { pressed: true, value: 1 };

  const btns = readButtons(gp);
  expect(btns.a).toBe(true);
  expect(btns.start).toBe(true);
  expect(btns.dpadUp).toBe(true);
  expect(btns.b).toBe(false);
  expect(btns.dpadDown).toBe(false);
});

test('readButtons defaults missing buttons to false', () => {
  const gp = mockGamepad();
  gp.buttons = [];
  const btns = readButtons(gp);
  expect(btns.a).toBe(false);
  expect(btns.start).toBe(false);
});

test('fireEdgeTriggered fires callback only on press edge', () => {
  const onA = vi.fn();
  const onB = vi.fn();

  const curr = { ...EMPTY_BUTTONS, a: true };

  fireEdgeTriggered(curr, EMPTY_BUTTONS, { onA, onB });
  expect(onA).toHaveBeenCalledTimes(1);
  expect(onB).not.toHaveBeenCalled();
});

test('fireEdgeTriggered does not fire on hold', () => {
  const onA = vi.fn();

  const held = { ...EMPTY_BUTTONS, a: true };

  fireEdgeTriggered(held, held, { onA });
  expect(onA).not.toHaveBeenCalled();
});

test('fireEdgeTriggered fires dpad callbacks with direction', () => {
  const onDpad = vi.fn();

  const curr = { ...EMPTY_BUTTONS, dpadUp: true };

  fireEdgeTriggered(curr, EMPTY_BUTTONS, { onDpad });
  expect(onDpad).toHaveBeenCalledWith('up');
});

test('fireEdgeTriggered fires LB and RB on edge', () => {
  const onLB = vi.fn();
  const onRB = vi.fn();

  const curr = { ...EMPTY_BUTTONS, leftBumper: true, rightBumper: true };

  fireEdgeTriggered(curr, EMPTY_BUTTONS, { onLB, onRB });
  expect(onLB).toHaveBeenCalledTimes(1);
  expect(onRB).toHaveBeenCalledTimes(1);
});
