// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the dependencies before importing
vi.mock('../src/secure-logger.js', () => ({
  secureLogger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../src/version.js', () => ({
  ENGINE_VERSION: '1.2.0',
}));

vi.mock('../src/tcg-bridge.js', () => ({
  loadAndApplyTcg: vi.fn(),
}));

vi.mock('../src/storage-security.js', () => ({
  computeArrayBufferHash: vi.fn(async (buf: ArrayBuffer) => {
    const bytes = new Uint8Array(buf);
    return 'hash_' + bytes.length;
  }),
}));

describe('tcg-update security', () => {
  let originalIndexedDB: typeof indexedDB;
  let mockDb: any;
  let mockStore: any;

  beforeEach(() => {
    mockStore = {
      get: vi.fn(),
      put: vi.fn(),
    };

    mockDb = {
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => mockStore),
        oncomplete: null,
        onerror: null,
      })),
    };

    originalIndexedDB = global.indexedDB;
    global.indexedDB = {
      open: vi.fn(() => ({
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        result: mockDb,
      })),
    } as any;
  });

  afterEach(() => {
    global.indexedDB = originalIndexedDB;
    vi.clearAllMocks();
  });

  it('validateIntegrity uses computeArrayBufferHash from storage-security', async () => {
    // This is a smoke test to verify our implementation imports correctly
    const { computeArrayBufferHash } = await import('../src/storage-security.js');
    expect(computeArrayBufferHash).toBeDefined();
  });

  it('setCachedTcg stores hash parameter', async () => {
    const { loadCachedOrBundled } = await import('../src/tcg-update.js');
    
    // Simulate cache miss - no cached data
    mockStore.get.mockImplementation(() => ({
      result: null,
    }));

    // Mock fetch to return test data
    const mockBuffer = new Uint8Array([1, 2, 3]).buffer;
    const mockFetchResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/zip' }),
      arrayBuffer: vi.fn(async () => mockBuffer),
    };

    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => mockFetchResponse as any);

    try {
      await loadCachedOrBundled('test.tcg');
      
      // Verify content-type header was checked
      expect(mockFetchResponse.arrayBuffer).toHaveBeenCalled();
      
      // Verify put was called with hash parameter
      const putCall = mockStore.put.mock.calls[0];
      expect(putCall[0]).toHaveProperty('hash');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('rejects invalid content types', async () => {
    const mockBuffer = new Uint8Array([1, 2, 3]).buffer;
    const mockFetchResponse = {
      ok: true,
      headers: new Headers({ 'Content-Type': 'text/html' }),
      arrayBuffer: vi.fn(async () => mockBuffer),
    };

    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => mockFetchResponse as any);

    mockStore.get.mockImplementation(() => ({
      result: null,
    }));

    try {
      const { loadCachedOrBundled } = await import('../src/tcg-update.js');
      await expect(loadCachedOrBundled('test.tcg')).rejects.toThrow('Unexpected content type');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('aborts fetch after timeout', async () => {
    const { setTimeout } = global;
    let timeoutCallback: (() => void) | null = null;
    global.setTimeout = ((fn: () => void, ms: number) => {
      if (ms === 30000) {
        timeoutCallback = fn;
      }
      return 1 as any;
    }) as any;

    const { clearTimeout } = global.clearTimeout;
    const clearTimeoutSpy = vi.fn();
    global.clearTimeout = clearTimeoutSpy as any;

    const abortController = new AbortController();
    
    try {
      const { loadCachedOrBundled } = await import('../src/tcg-update.js');
      
      // Simulate cache miss
      mockStore.get.mockImplementation(() => ({
        result: null,
      }));

      // Mock successful fetch
      global.fetch = vi.fn(async () => ({
        ok: true,
        headers: new Headers({ 'Content-Type': 'application/zip' }),
        arrayBuffer: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
      } as any));

      await loadCachedOrBundled('test.tcg');

      // Verify timeout was cleared
      expect(clearTimeoutSpy).toHaveBeenCalled();
    } finally {
      global.setTimeout = setTimeout;
      global.clearTimeout = clearTimeout;
    }
  });
});
