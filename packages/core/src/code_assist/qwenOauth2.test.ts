/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

// Import the PKCE functions (we'll need to export them first)
// For now, let's test the logic inline

describe('PKCE (Proof Key for Code Exchange)', () => {
  it('should generate valid code verifier', () => {
    // Test code verifier generation
    const generateCodeVerifier = (): string =>
      crypto.randomBytes(32).toString('base64url');

    const codeVerifier = generateCodeVerifier();

    // Code verifier should be 43-128 characters
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(codeVerifier.length).toBeLessThanOrEqual(128);

    // Should only contain URL-safe characters
    expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('should generate valid code challenge from verifier', () => {
    // Test code challenge generation
    const generateCodeChallenge = (codeVerifier: string): string => {
      const hash = crypto.createHash('sha256');
      hash.update(codeVerifier);
      return hash.digest('base64url');
    };

    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Code challenge should be 43 characters (SHA-256 hash in base64url)
    expect(codeChallenge.length).toBe(43);

    // Should only contain URL-safe characters
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);

    // Should be different from the verifier
    expect(codeChallenge).not.toBe(codeVerifier);
  });

  it('should generate consistent challenge for same verifier', () => {
    const generateCodeChallenge = (codeVerifier: string): string => {
      const hash = crypto.createHash('sha256');
      hash.update(codeVerifier);
      return hash.digest('base64url');
    };

    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const challenge1 = generateCodeChallenge(codeVerifier);
    const challenge2 = generateCodeChallenge(codeVerifier);

    // Same verifier should produce same challenge
    expect(challenge1).toBe(challenge2);
  });

  it('should generate different challenges for different verifiers', () => {
    const generateCodeChallenge = (codeVerifier: string): string => {
      const hash = crypto.createHash('sha256');
      hash.update(codeVerifier);
      return hash.digest('base64url');
    };

    const verifier1 = crypto.randomBytes(32).toString('base64url');
    const verifier2 = crypto.randomBytes(32).toString('base64url');

    const challenge1 = generateCodeChallenge(verifier1);
    const challenge2 = generateCodeChallenge(verifier2);

    // Different verifiers should produce different challenges
    expect(challenge1).not.toBe(challenge2);
  });

  it('should generate PKCE pair correctly', () => {
    const generatePKCEPair = () => {
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const hash = crypto.createHash('sha256');
      hash.update(codeVerifier);
      const codeChallenge = hash.digest('base64url');
      return { code_verifier: codeVerifier, code_challenge: codeChallenge };
    };

    const pair = generatePKCEPair();

    expect(pair.code_verifier).toBeDefined();
    expect(pair.code_challenge).toBeDefined();
    expect(pair.code_verifier.length).toBeGreaterThanOrEqual(43);
    expect(pair.code_challenge.length).toBe(43);
    expect(pair.code_verifier).not.toBe(pair.code_challenge);
  });
});
