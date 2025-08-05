/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import open from 'open';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import * as os from 'os';
import qrcode from 'qrcode-terminal';
import { Config } from '../config/config.js';

// OAuth Endpoints
const QWEN_OAUTH_BASE_URL = 'https://chat.qwen.ai';
const QWEN_OAUTH_DEVICE_CODE_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v2/oauth2/device/code`;
const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v2/oauth/oauth2/token`;

// OAuth Client Configuration
const QWEN_OAUTH_CLIENT_ID = 'qwen-code';
const QWEN_OAUTH_SCOPE = ['email']; // scope is optional

// File System Configuration
const QWEN_DIR = '.qwen';
const QWEN_CREDENTIAL_FILENAME = 'oauth_creds.json';

// Token Configuration
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

/**
 * PKCE (Proof Key for Code Exchange) utilities
 * Implements RFC 7636 - Proof Key for Code Exchange by OAuth Public Clients
 */

/**
 * Generate a random code verifier for PKCE
 * @returns A random string of 43-128 characters
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate a code challenge from a code verifier using SHA-256
 * @param codeVerifier The code verifier string
 * @returns The code challenge string
 */
export function generateCodeChallenge(codeVerifier: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(codeVerifier);
  return hash.digest('base64url');
}

/**
 * Generate PKCE code verifier and challenge pair
 * @returns Object containing code_verifier and code_challenge
 */
export function generatePKCEPair(): {
  code_verifier: string;
  code_challenge: string;
} {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  return { code_verifier: codeVerifier, code_challenge: codeChallenge };
}

/**
 * Qwen OAuth2 credentials interface
 */
export interface QwenCredentials {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expiry_date?: number;
  token_type?: string;
}

/**
 * Device authorization response interface
 */
export interface DeviceAuthorizationResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
}

/**
 * Device token response interface
 */
export interface DeviceTokenResponse {
  status: 'pending' | 'success';
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

/**
 * Qwen OAuth2 client interface
 */
export interface IQwenOAuth2Client {
  setCredentials(credentials: QwenCredentials): void;
  getCredentials(): QwenCredentials;
  getAccessToken(): Promise<{ token?: string }>;
  requestDeviceAuthorization(options: {
    scope: string[];
    code_challenge: string;
    code_challenge_method: string;
  }): Promise<DeviceAuthorizationResponse>;
  pollDeviceToken(options: {
    device_code: string;
    code_verifier: string;
  }): Promise<DeviceTokenResponse>;
  refreshAccessToken(): Promise<{ credentials: QwenCredentials }>;
}

/**
 * Qwen OAuth2 client implementation
 */
export class QwenOAuth2Client implements IQwenOAuth2Client {
  private credentials: QwenCredentials = {};
  private proxy?: string;

  constructor(options: { proxy?: string }) {
    this.proxy = options.proxy;
  }

  setCredentials(credentials: QwenCredentials): void {
    this.credentials = credentials;
  }

  getCredentials(): QwenCredentials {
    return this.credentials;
  }

  async getAccessToken(): Promise<{ token?: string }> {
    if (this.credentials.access_token && this.isTokenValid()) {
      return { token: this.credentials.access_token };
    }

    if (this.credentials.refresh_token) {
      const refreshedCreds = await this.refreshAccessToken();
      return { token: refreshedCreds.credentials.access_token };
    }

    return { token: undefined };
  }

  async requestDeviceAuthorization(options: {
    scope: string[];
    code_challenge: string;
    code_challenge_method: string;
  }): Promise<DeviceAuthorizationResponse> {
    const bodyData = {
      client_id: QWEN_OAUTH_CLIENT_ID,
      scope: options.scope.join(' '),
      code_challenge: options.code_challenge,
      code_challenge_method: options.code_challenge_method,
    };

    const response = await fetch(QWEN_OAUTH_DEVICE_CODE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(bodyData),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `Device authorization failed: ${response.status} ${response.statusText}. Response: ${errorData}`,
      );
    }

    const result = (await response.json()) as DeviceAuthorizationResponse;
    console.log('Device authorization result:', result);

    return result;
  }

  async pollDeviceToken(options: {
    device_code: string;
    code_verifier: string;
  }): Promise<DeviceTokenResponse> {
    const bodyData = {
      grant_type: 'device_code',
      client_id: QWEN_OAUTH_CLIENT_ID,
      device_code: options.device_code,
      code_verifier: options.code_verifier,
    };

    const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(bodyData),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `Device token poll failed: ${response.status} ${response.statusText}. Response: ${errorData}`,
      );
    }

    return (await response.json()) as DeviceTokenResponse;
  }

  async refreshAccessToken(): Promise<{ credentials: QwenCredentials }> {
    if (!this.credentials.refresh_token) {
      throw new Error('No refresh token available');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.credentials.refresh_token,
      client_id: QWEN_OAUTH_CLIENT_ID,
    });

    const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.text();
      // Handle 401 errors which might indicate refresh token expiry
      if (response.status === 401) {
        throw new Error(
          'Refresh token expired or invalid. Please re-authenticate.',
        );
      }
      throw new Error(
        `Token refresh failed: ${response.status} ${response.statusText}. Response: ${errorData}`,
      );
    }

    const responseData = await response.json();

    // Handle the API response format from api.md
    let tokens: QwenCredentials;
    if (responseData.success && responseData.data) {
      // Success response format
      tokens = {
        access_token: responseData.data.access_token,
        token_type: responseData.data.token_type,
        refresh_token: this.credentials.refresh_token, // Preserve existing refresh token
      };

      // Set expiry date based on expires_in field
      if (responseData.data.expires_in) {
        tokens.expiry_date = Date.now() + responseData.data.expires_in * 1000;
      }
    } else {
      // Direct token response (fallback)
      tokens = responseData as QwenCredentials;

      // Preserve refresh token if not returned
      if (!tokens.refresh_token && this.credentials.refresh_token) {
        tokens.refresh_token = this.credentials.refresh_token;
      }

      // Set expiry date based on expires_in field or default
      if (!tokens.expiry_date && tokens.access_token) {
        const expiresIn =
          (tokens as { expires_in?: number }).expires_in || 3600;
        tokens.expiry_date = Date.now() + expiresIn * 1000;
      }
    }

    this.setCredentials(tokens);
    return { credentials: tokens };
  }

  private isTokenValid(): boolean {
    if (!this.credentials.expiry_date) {
      return false;
    }
    // Check if token expires within the refresh buffer time
    return Date.now() < this.credentials.expiry_date - TOKEN_REFRESH_BUFFER_MS;
  }
}

let tokenUpdateCallback: ((tokens: QwenCredentials) => Promise<void>) | null =
  null;

export async function getQwenOAuthClient(
  config: Config,
): Promise<QwenOAuth2Client> {
  const client = new QwenOAuth2Client({
    proxy: config.getProxy(),
  });

  // Set up token update callback
  tokenUpdateCallback = async (tokens: QwenCredentials) => {
    await cacheQwenCredentials(tokens);
  };

  // If there are cached creds on disk, they always take precedence
  if (await loadCachedQwenCredentials(client)) {
    console.log('Loaded cached Qwen credentials.');
    return client;
  }

  // Use device authorization flow for authentication
  let success = false;
  const maxRetries = 2;
  for (let i = 0; !success && i < maxRetries; i++) {
    success = await authWithQwenDeviceFlow(client, config);
    if (!success) {
      console.error(
        '\nFailed to authenticate with Qwen device flow.',
        i === maxRetries - 1 ? '' : 'Retrying...\n',
      );
    }
  }
  if (!success) {
    process.exit(1);
  }

  return client;
}

async function authWithQwenDeviceFlow(
  client: QwenOAuth2Client,
  config: Config,
): Promise<boolean> {
  try {
    // Generate PKCE code verifier and challenge
    const { code_verifier, code_challenge } = generatePKCEPair();

    // Request device authorization
    const deviceAuth = await client.requestDeviceAuthorization({
      scope: QWEN_OAUTH_SCOPE,
      code_challenge,
      code_challenge_method: 'S256',
    });

    console.log('\n=== Qwen OAuth Device Authorization ===');
    console.log(
      `Please visit the following URL on your phone or browser for authorization:`,
    );
    console.log(`\n${deviceAuth.verification_uri_complete}\n`);
    console.log(
      `Or visit ${deviceAuth.verification_uri} and enter user code: ${deviceAuth.user_code}`,
    );
    console.log('\nYou can also scan the following QR code:');
    console.log('(Display QR code in terminal, or copy the link to browser)');
    console.log(
      `\nAuthorization URL: ${deviceAuth.verification_uri_complete}\n`,
    );

    // If browser launch is not suppressed, try to open the URL
    if (!config.isBrowserLaunchSuppressed()) {
      try {
        console.log('Attempting to open browser...');
        const childProcess = await open(deviceAuth.verification_uri_complete);
        childProcess.on('error', () => {
          console.log('Visit this URL to authorize:');
          console.log(deviceAuth.verification_uri_complete);
          qrcode.generate(deviceAuth.verification_uri_complete, {
            small: true,
          });
        });
      } catch (_err) {
        console.log('Visit this URL to authorize:');
        console.log(deviceAuth.verification_uri_complete);
        qrcode.generate(deviceAuth.verification_uri_complete, { small: true });
      }
    }

    console.log('Waiting for authorization...\n');

    // Poll for the token
    const pollInterval = 5000; // 5 seconds
    const maxAttempts = Math.ceil(
      deviceAuth.expires_in / (pollInterval / 1000),
    );

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const tokenResponse = await client.pollDeviceToken({
          device_code: deviceAuth.device_code,
          code_verifier,
        });

        if (tokenResponse.status === 'success' && tokenResponse.access_token) {
          // Convert to QwenCredentials format
          const credentials: QwenCredentials = {
            access_token: tokenResponse.access_token,
            refresh_token: tokenResponse.refresh_token,
            token_type: tokenResponse.token_type,
          };

          // Set expiry date based on expires_in field
          if (tokenResponse.expires_in) {
            credentials.expiry_date =
              Date.now() + tokenResponse.expires_in * 1000;
          }

          client.setCredentials(credentials);

          // Cache the new tokens
          if (tokenUpdateCallback) {
            await tokenUpdateCallback(credentials);
          }

          console.log('Authentication successful! Access token obtained.');
          return true;
        }

        // If status is 'pending', continue polling
        if (tokenResponse.status === 'pending') {
          process.stdout.write('.');
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          continue;
        }
      } catch (error: unknown) {
        // Handle specific error cases
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('401')) {
          console.error(
            '\n Device code expired or invalid, please restart the authorization process.',
          );
          return false;
        }
        console.error('\n Error polling for token:', errorMessage);
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    console.error('\n Authorization timeout, please restart the process.');
    return false;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Device authorization flow failed:', errorMessage);
    return false;
  }
}

async function loadCachedQwenCredentials(
  client: QwenOAuth2Client,
): Promise<boolean> {
  try {
    const keyFile = getQwenCachedCredentialPath();
    const creds = await fs.readFile(keyFile, 'utf-8');
    const credentials = JSON.parse(creds) as QwenCredentials;
    client.setCredentials(credentials);

    // Verify that the credentials are still valid
    const { token } = await client.getAccessToken();
    if (!token) {
      return false;
    }

    return true;
  } catch (_) {
    return false;
  }
}

async function cacheQwenCredentials(credentials: QwenCredentials) {
  const filePath = getQwenCachedCredentialPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const credString = JSON.stringify(credentials, null, 2);
  await fs.writeFile(filePath, credString);
}

function getQwenCachedCredentialPath(): string {
  return path.join(os.homedir(), QWEN_DIR, QWEN_CREDENTIAL_FILENAME);
}
