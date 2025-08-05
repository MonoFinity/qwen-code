/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpenAIContentGenerator } from './openaiContentGenerator.js';
import { QwenTokenManager } from './qwenTokenManager.js';
import { Config } from '../config/config.js';
import {
  GenerateContentParameters,
  GenerateContentResponse,
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
} from '@google/genai';

// const QWEN_BASE_URL = 'https://api.qwen.ai';
const QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

/**
 * OpenAI Content Generator wrapper that uses Qwen OAuth tokens with automatic refresh
 */
export class QwenOpenAIContentGenerator extends OpenAIContentGenerator {
  private tokenManager: QwenTokenManager;

  constructor(tokenManager: QwenTokenManager, model: string, config: Config) {
    // Initialize with empty API key, we'll override it dynamically
    super('', model, config);
    this.tokenManager = tokenManager;

    // Qwen OAuth only supports calling specified models at the specified endpoint
    this.client.baseURL = QWEN_BASE_URL;
  }

  /**
   * Override to use dynamic token
   */
  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    return this.withValidToken(async (token) => {
      // Temporarily update the API key
      const originalApiKey = this.client.apiKey;
      this.client.apiKey = token;

      try {
        return await super.generateContent(request);
      } finally {
        // Restore original API key
        this.client.apiKey = originalApiKey;
      }
    });
  }

  /**
   * Override to use dynamic token
   */
  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const token = await this.getTokenWithRetry();

    // Update the API key before streaming
    const originalApiKey = this.client.apiKey;
    this.client.apiKey = token;

    try {
      return await super.generateContentStream(request);
    } catch (error) {
      // Restore original API key on error
      this.client.apiKey = originalApiKey;
      throw error;
    }
    // Note: We don't restore the key in finally for streaming because
    // the generator may continue to be used after this method returns
  }

  /**
   * Override to use dynamic token
   */
  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    return this.withValidToken(async (token) => {
      const originalApiKey = this.client.apiKey;
      this.client.apiKey = token;

      try {
        return await super.countTokens(request);
      } finally {
        this.client.apiKey = originalApiKey;
      }
    });
  }

  /**
   * Override to use dynamic token
   */
  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    return this.withValidToken(async (token) => {
      const originalApiKey = this.client.apiKey;
      this.client.apiKey = token;

      try {
        return await super.embedContent(request);
      } finally {
        this.client.apiKey = originalApiKey;
      }
    });
  }

  /**
   * Execute operation with a valid token, with retry on auth failure
   */
  private async withValidToken<T>(
    operation: (token: string) => Promise<T>,
  ): Promise<T> {
    const token = await this.getTokenWithRetry();

    try {
      return await operation(token);
    } catch (error) {
      // Check if this is an authentication error
      if (this.isAuthError(error)) {
        console.log(
          'Authentication error detected, refreshing token and retrying...',
        );

        // Refresh token and retry once
        const newToken = await this.tokenManager.refreshToken();
        return await operation(newToken);
      }

      throw error;
    }
  }

  /**
   * Get token with retry logic
   */
  private async getTokenWithRetry(): Promise<string> {
    try {
      return await this.tokenManager.getValidToken();
    } catch (error) {
      console.error('Failed to get valid token:', error);
      throw new Error(
        'Failed to obtain valid Qwen access token. Please re-authenticate.',
      );
    }
  }

  /**
   * Check if an error is related to authentication/authorization
   */
  private isAuthError(error: unknown): boolean {
    if (!error) return false;

    const errorMessage =
      error instanceof Error
        ? error.message.toLowerCase()
        : String(error).toLowerCase();

    // Define a type for errors that might have status or code properties
    const errorWithCode = error as {
      status?: number | string;
      code?: number | string;
    };
    const errorCode = errorWithCode?.status || errorWithCode?.code;

    return (
      errorCode === 401 ||
      errorCode === 403 ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('forbidden') ||
      errorMessage.includes('invalid api key') ||
      errorMessage.includes('authentication') ||
      errorMessage.includes('access denied') ||
      (errorMessage.includes('token') && errorMessage.includes('expired'))
    );
  }
}
