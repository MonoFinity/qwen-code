/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generatePKCEPair,
  QwenOAuth2Client,
  type QwenCredentials,
  type DeviceAuthorizationResponse,
  type DeviceTokenResponse,
} from './qwenOauth2.js';

// Mock qrcode-terminal
vi.mock('qrcode-terminal', () => ({
  default: {
    generate: vi.fn(),
  },
}));

// Mock open
vi.mock('open', () => ({
  default: vi.fn(),
}));

describe('PKCE (Proof Key for Code Exchange)', () => {
  describe('generateCodeVerifier', () => {
    it('should generate valid code verifier', () => {
      const codeVerifier = generateCodeVerifier();

      // Code verifier should be 43-128 characters
      expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
      expect(codeVerifier.length).toBeLessThanOrEqual(128);

      // Should only contain URL-safe characters
      expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate different verifiers on each call', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();

      expect(verifier1).not.toBe(verifier2);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should generate valid code challenge from verifier', () => {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      // Code challenge should be 43 characters (SHA-256 hash in base64url)
      expect(codeChallenge.length).toBe(43);

      // Should only contain URL-safe characters
      expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);

      // Should be different from the verifier
      expect(codeChallenge).not.toBe(codeVerifier);
    });

    it('should generate consistent challenge for same verifier', () => {
      const codeVerifier = generateCodeVerifier();
      const challenge1 = generateCodeChallenge(codeVerifier);
      const challenge2 = generateCodeChallenge(codeVerifier);

      // Same verifier should produce same challenge
      expect(challenge1).toBe(challenge2);
    });

    it('should generate different challenges for different verifiers', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();

      const challenge1 = generateCodeChallenge(verifier1);
      const challenge2 = generateCodeChallenge(verifier2);

      // Different verifiers should produce different challenges
      expect(challenge1).not.toBe(challenge2);
    });
  });

  describe('generatePKCEPair', () => {
    it('should generate PKCE pair correctly', () => {
      const pair = generatePKCEPair();

      expect(pair.code_verifier).toBeDefined();
      expect(pair.code_challenge).toBeDefined();
      expect(pair.code_verifier.length).toBeGreaterThanOrEqual(43);
      expect(pair.code_challenge.length).toBe(43);
      expect(pair.code_verifier).not.toBe(pair.code_challenge);
    });

    it('should generate different pairs on each call', () => {
      const pair1 = generatePKCEPair();
      const pair2 = generatePKCEPair();

      expect(pair1.code_verifier).not.toBe(pair2.code_verifier);
      expect(pair1.code_challenge).not.toBe(pair2.code_challenge);
    });

    it('should generate valid challenge for generated verifier', () => {
      const pair = generatePKCEPair();
      const expectedChallenge = generateCodeChallenge(pair.code_verifier);

      expect(pair.code_challenge).toBe(expectedChallenge);
    });
  });
});

describe('QwenOAuth2Client', () => {
  let client: QwenOAuth2Client;

  beforeEach(() => {
    client = new QwenOAuth2Client({ proxy: undefined });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('credentials management', () => {
    it('should initialize with empty credentials', () => {
      const credentials = client.getCredentials();
      expect(credentials).toEqual({});
    });

    it('should set and get credentials correctly', () => {
      const testCredentials: QwenCredentials = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000, // 1 hour from now
      };

      client.setCredentials(testCredentials);
      const retrievedCredentials = client.getCredentials();

      expect(retrievedCredentials).toEqual(testCredentials);
    });
  });

  describe('getAccessToken', () => {
    it('should return valid token when not expired', async () => {
      const testCredentials: QwenCredentials = {
        access_token: 'valid-token',
        expiry_date: Date.now() + 3600000, // 1 hour from now
      };

      client.setCredentials(testCredentials);
      const result = await client.getAccessToken();

      expect(result.token).toBe('valid-token');
    });

    it('should return undefined when no token available', async () => {
      const result = await client.getAccessToken();
      expect(result.token).toBeUndefined();
    });

    it('should return undefined when token is expired and no refresh token', async () => {
      const testCredentials: QwenCredentials = {
        access_token: 'expired-token',
        expiry_date: Date.now() - 1000, // expired 1 second ago
      };

      client.setCredentials(testCredentials);
      const result = await client.getAccessToken();

      expect(result.token).toBeUndefined();
    });
  });

  describe('requestDeviceAuthorization', () => {
    beforeEach(() => {
      // Mock fetch globally
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should request device authorization successfully', async () => {
      const mockResponse: DeviceAuthorizationResponse = {
        device_code: 'test-device-code',
        user_code: 'TEST123',
        verification_uri: 'https://chat.qwen.ai/device',
        verification_uri_complete: 'https://chat.qwen.ai/device?code=TEST123',
        expires_in: 1800,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await client.requestDeviceAuthorization({
        scope: ['email'],
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256',
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://chat.qwen.ai/api/v2/oauth2/device/code',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }),
      );
    });

    it('should throw error on failed request', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid request'),
      } as Response);

      await expect(
        client.requestDeviceAuthorization({
          scope: ['email'],
          code_challenge: 'test-challenge',
          code_challenge_method: 'S256',
        }),
      ).rejects.toThrow('Device authorization failed: 400 Bad Request');
    });
  });

  describe('pollDeviceToken', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return pending status', async () => {
      const mockResponse: DeviceTokenResponse = {
        status: 'pending',
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await client.pollDeviceToken({
        device_code: 'test-device-code',
        code_verifier: 'test-verifier',
      });

      expect(result.status).toBe('pending');
    });

    it('should return success with tokens', async () => {
      const mockResponse: DeviceTokenResponse = {
        status: 'success',
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await client.pollDeviceToken({
        device_code: 'test-device-code',
        code_verifier: 'test-verifier',
      });

      expect(result).toEqual(mockResponse);
    });
  });
});
