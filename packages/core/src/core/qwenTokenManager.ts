/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { IQwenOAuth2Client } from '../code_assist/qwenOauth2.js';

/**
 * Manages Qwen OAuth access tokens with automatic refresh capability
 */
export class QwenTokenManager {
  private currentToken: string | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor(private qwenClient: IQwenOAuth2Client) {}

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getValidToken(): Promise<string> {
    // If there's already a refresh in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    try {
      const { token } = await this.qwenClient.getAccessToken();
      if (token) {
        this.currentToken = token;
        return token;
      }
    } catch (error) {
      console.warn('Failed to get access token, attempting refresh:', error);
    }

    // Start a new refresh operation
    this.refreshPromise = this.performTokenRefresh();

    try {
      const newToken = await this.refreshPromise;
      return newToken;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Force refresh the access token
   */
  async refreshToken(): Promise<string> {
    this.refreshPromise = this.performTokenRefresh();

    try {
      const newToken = await this.refreshPromise;
      return newToken;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<string> {
    try {
      console.log('Refreshing Qwen access token...');
      const { credentials } = await this.qwenClient.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token: no token returned');
      }

      this.currentToken = credentials.access_token;
      console.log('Qwen access token refreshed successfully');
      return credentials.access_token;
    } catch (error) {
      console.error('Failed to refresh Qwen access token:', error);
      throw new Error(
        `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get the current cached token (may be expired)
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * Clear the cached token
   */
  clearToken(): void {
    this.currentToken = null;
    this.refreshPromise = null;
  }
}
