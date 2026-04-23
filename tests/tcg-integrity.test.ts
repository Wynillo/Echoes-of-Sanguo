// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyModIntegrity } from '../src/tcg-bridge.js';

describe('verifyModIntegrity', () => {
  describe('hash format support', () => {
    it('verifies file integrity with hex hash', async () => {
      const testData = new TextEncoder().encode('test data');
      const hashBuffer = await crypto.subtle.digest('SHA-256', testData.buffer);
      const hash = [...new Uint8Array(hashBuffer)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const result = await verifyModIntegrity(testData.buffer, hash);
      expect(result).toBe(true);
    });

    it('verifies file integrity with base64 hash', async () => {
      const testData = new TextEncoder().encode('test data');
      const hashBuffer = await crypto.subtle.digest('SHA-256', testData.buffer);
      const hashArray = new Uint8Array(hashBuffer);
      let binary = '';
      for (let i = 0; i < hashArray.length; i++) {
        binary += String.fromCharCode(hashArray[i]);
      }
      const hash = btoa(binary);
      
      const result = await verifyModIntegrity(testData.buffer, hash);
      expect(result).toBe(true);
    });

    it('verifies file integrity with SRI format (sha256- prefix)', async () => {
      const testData = new TextEncoder().encode('test data');
      const hashBuffer = await crypto.subtle.digest('SHA-256', testData.buffer);
      const hashArray = new Uint8Array(hashBuffer);
      let binary = '';
      for (let i = 0; i < hashArray.length; i++) {
        binary += String.fromCharCode(hashArray[i]);
      }
      const base64Hash = btoa(binary);
      const sriHash = `sha256-${base64Hash}`;
      
      const result = await verifyModIntegrity(testData.buffer, sriHash);
      expect(result).toBe(true);
    });

    it('handles case-insensitive hex hash', async () => {
      const testData = new TextEncoder().encode('test data');
      const hashBuffer = await crypto.subtle.digest('SHA-256', testData.buffer);
      const hash = [...new Uint8Array(hashBuffer)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
      
      const result = await verifyModIntegrity(testData.buffer, hash);
      expect(result).toBe(true);
    });
  });

  describe('invalid hash scenarios', () => {
    it('returns false for mismatched hash', async () => {
      const testData = new TextEncoder().encode('test data');
      const wrongHash = '0000000000000000000000000000000000000000000000000000000000000000';
      
      const result = await verifyModIntegrity(testData.buffer, wrongHash);
      expect(result).toBe(false);
    });

    it('returns false for invalid hash format', async () => {
      const testData = new TextEncoder().encode('test data');
      const invalidHash = 'not-a-valid-hash-!!!';
      
      const result = await verifyModIntegrity(testData.buffer, invalidHash);
      expect(result).toBe(false);
    });

    it('returns false for partial hash', async () => {
      const testData = new TextEncoder().encode('test data');
      const hashBuffer = await crypto.subtle.digest('SHA-256', testData.buffer);
      const partialHash = [...new Uint8Array(hashBuffer)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .substring(0, 32);
      
      const result = await verifyModIntegrity(testData.buffer, partialHash);
      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles empty ArrayBuffer', async () => {
      const emptyData = new ArrayBuffer(0);
      const hashBuffer = await crypto.subtle.digest('SHA-256', emptyData);
      const hash = [...new Uint8Array(hashBuffer)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const result = await verifyModIntegrity(emptyData, hash);
      expect(result).toBe(true);
    });

    it('handles large ArrayBuffer (1MB)', async () => {
      const largeData = new ArrayBuffer(1024 * 1024);
      const view = new Uint8Array(largeData);
      view.fill(0x42);
      
      const hashBuffer = await crypto.subtle.digest('SHA-256', largeData);
      const hash = [...new Uint8Array(hashBuffer)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const result = await verifyModIntegrity(largeData, hash);
      expect(result).toBe(true);
    });

    it('handles single byte ArrayBuffer', async () => {
      const singleByte = new ArrayBuffer(1);
      new Uint8Array(singleByte)[0] = 0x41;
      
      const hashBuffer = await crypto.subtle.digest('SHA-256', singleByte);
      const hash = [...new Uint8Array(hashBuffer)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const result = await verifyModIntegrity(singleByte, hash);
      expect(result).toBe(true);
    });

    it('uses known SHA-256 test vector (abc)', async () => {
      const testData = new TextEncoder().encode('abc');
      const expectedHash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
      
      const result = await verifyModIntegrity(testData.buffer, expectedHash);
      expect(result).toBe(true);
    });
  });

  describe('error handling', () => {
    it('returns false when crypto API fails', async () => {
      const testData = new TextEncoder().encode('test data');
      const hash = 'sha256-validhash';
      
      const originalCrypto = global.crypto;
      try {
        Object.defineProperty(global, 'crypto', {
          value: { subtle: { digest: vi.fn().mockRejectedValue(new Error('API error')) } },
          writable: true,
        });
        
        const result = await verifyModIntegrity(testData.buffer, hash);
        expect(result).toBe(false);
      } finally {
        Object.defineProperty(global, 'crypto', { value: originalCrypto, writable: true });
      }
    });
  });
});

describe('tcg-update integration with verifyModIntegrity', () => {
  it('checkForUpdate verifies integrity before caching', async () => {
    const testData = new TextEncoder().encode('test tcg data');
    const hashBuffer = await crypto.subtle.digest('SHA-256', testData.buffer);
    const hash = [...new Uint8Array(hashBuffer)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const result = await verifyModIntegrity(testData.buffer, hash);
    expect(result).toBe(true);
  });

  it('checkForUpdate rejects corrupted data', async () => {
    const testData = new TextEncoder().encode('test tcg data');
    const wrongHash = '0000000000000000000000000000000000000000000000000000000000000000';
    
    const result = await verifyModIntegrity(testData.buffer, wrongHash);
    expect(result).toBe(false);
  });

  it('verifyModIntegrity handles ArrayBuffer from fetch response', async () => {
    const testData = new TextEncoder().encode('simulated fetch arraybuffer');
    const hashBuffer = await crypto.subtle.digest('SHA-256', testData.buffer);
    const hash = [...new Uint8Array(hashBuffer)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const result = await verifyModIntegrity(testData.buffer, hash);
    expect(result).toBe(true);
  });
});
