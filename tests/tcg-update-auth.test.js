import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const originalEnv = import.meta.env;

describe('tcg-update authentication', () => {
  beforeEach(() => {
    Object.defineProperty(import.meta, 'env', {
      value: {},
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(import.meta, 'env', {
      value: originalEnv,
      writable: true,
    });
  });

  describe('getLatestCommitSha headers', () => {
    it('should include Authorization header when VITE_GITHUB_TOKEN is set', async () => {
      Object.defineProperty(import.meta, 'env', {
        value: { VITE_GITHUB_TOKEN: 'test_token_123' },
        writable: true,
      });

      const fetchMock = vi.fn();
      fetchMock.mockResolvedValue({
        ok: true,
        text: async () => 'abc123',
      });

      const originalFetch = global.fetch;
      global.fetch = fetchMock;

      try {
        const { loadCachedOrBundled } = await import('../src/tcg-update.js');
        
        await loadCachedOrBundled('data:application/octet-stream,test');
        
        expect(fetchMock).toHaveBeenCalled();
        const callArgs = fetchMock.mock.calls[0];
        const headers = callArgs[1]?.headers as Record<string, string>;
        expect(headers['Authorization']).toBe('Bearer test_token_123');
        expect(headers['Accept']).toBe('application/vnd.github.sha');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should not include Authorization header when token is not set', async () => {
      Object.defineProperty(import.meta, 'env', {
        value: {},
        writable: true,
      });

      const fetchMock = vi.fn();
      fetchMock.mockResolvedValue({
        ok: true,
        text: async () => 'abc123',
      });

      const originalFetch = global.fetch;
      global.fetch = fetchMock;

      try {
        const { loadCachedOrBundled } = await import('../src/tcg-update.js');
        await loadCachedOrBundled('data:application/octet-stream,test');
        
        const callArgs = fetchMock.mock.calls[0];
        const headers = callArgs[1]?.headers as Record<string, string>;
        expect(headers['Authorization']).toBeUndefined();
        expect(headers['Accept']).toBe('application/vnd.github.sha');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle fetch errors gracefully', async () => {
      Object.defineProperty(import.meta, 'env', {
        value: { VITE_GITHUB_TOKEN: 'test_token' },
        writable: true,
      });

      const fetchMock = vi.fn();
      fetchMock.mockRejectedValue(new Error('Network error'));

      const originalFetch = global.fetch;
      global.fetch = fetchMock;

      try {
        const { loadCachedOrBundled } = await import('../src/tcg-update.js');
        await expect(loadCachedOrBundled('data:application/octet-stream,test'))
          .resolves.not.toThrow();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle non-OK responses gracefully', async () => {
      const fetchMock = vi.fn();
      fetchMock.mockResolvedValue({ ok: false, status: 403 });

      const originalFetch = global.fetch;
      global.fetch = fetchMock;

      try {
        const { loadCachedOrBundled } = await import('../src/tcg-update.js');
        await expect(loadCachedOrBundled('data:application/octet-stream,test'))
          .resolves.not.toThrow();
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
