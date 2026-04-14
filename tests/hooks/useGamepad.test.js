// @vitest-environment jsdom
import { createElement } from 'react';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGamepad } from '../../src/react/hooks/useGamepad.js';
import { GamepadProvider } from '../../src/react/contexts/GamepadContext.js';
import { renderHook, act } from '@testing-library/react';

const wrapper = ({ children }) => createElement(GamepadProvider, null, children);

beforeEach(() => {
  vi.useFakeTimers();
  navigator.getGamepads = vi.fn().mockReturnValue([null]);
});

afterEach(() => {
  vi.useRealTimers();
});

test('returns disconnected state when no controller', () => {
  const { result } = renderHook(() => useGamepad(), { wrapper });
  expect(result.current.connected).toBe(false);
  expect(result.current.gamepadId).toBeNull();
});

test('detects connected controller', () => {
  const mockGamepad = {
    connected: true,
    id: 'Xbox Controller',
    buttons: Array(17).fill({ pressed: false, value: 0 }),
    axes: [0, 0, 0, 0],
  };
  navigator.getGamepads = vi.fn().mockReturnValue([mockGamepad]);
  
  const { result } = renderHook(() => useGamepad(), { wrapper });
  
  act(() => {
    vi.advanceTimersByTime(100);
  });
  
  expect(result.current.connected).toBe(true);
  expect(result.current.gamepadId).toContain('Xbox');
});

test('triggers onA callback when A button is pressed', () => {
  const mockGamepad = {
    connected: true,
    id: 'Xbox Controller',
    buttons: Array(17).fill({ pressed: false, value: 0 }),
    axes: [0, 0, 0, 0],
  };
  navigator.getGamepads = vi.fn().mockReturnValue([mockGamepad]);
  
  const onA = vi.fn();
  const { result } = renderHook(() => useGamepad(), { wrapper });
  
  act(() => {
    result.current.registerCallbacks({ onA });
    mockGamepad.buttons[0] = { pressed: true, value: 1 };
    vi.advanceTimersByTime(100);
  });
  
  expect(onA).toHaveBeenCalledTimes(1);
});

test('does not trigger callback on button hold (only press)', () => {
  const mockGamepad = {
    connected: true,
    id: 'Xbox Controller',
    buttons: Array(17).fill({ pressed: false, value: 0 }),
    axes: [0, 0, 0, 0],
  };
  navigator.getGamepads = vi.fn().mockReturnValue([mockGamepad]);
  
  const onA = vi.fn();
  const { result } = renderHook(() => useGamepad(), { wrapper });
  
  act(() => {
    result.current.registerCallbacks({ onA });
    
    mockGamepad.buttons[0] = { pressed: true, value: 1 };
    vi.advanceTimersByTime(100);
    
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);
  });
  
  expect(onA).toHaveBeenCalledTimes(1);
});
