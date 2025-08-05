/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as http from 'http';
import url from 'url';
import crypto from 'crypto';
import * as net from 'net';
import open from 'open';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import * as os from 'os';
import { Config } from '../config/config.js';
import readline from 'node:readline';

// OAuth Endpoints
const QWEN_OAUTH_AUTHORIZE_ENDPOINT = `http://localhost:5777/oauth/authorize`;
const QWEN_OAUTH_TOKEN_ENDPOINT = `http://localhost:5777/oauth/token`;

// OAuth Client Configuration
const QWEN_OAUTH_CLIENT_ID = 'qwen-code';
const QWEN_OAUTH_SCOPE = ['email']; // scope is optional

// File System Configuration
const QWEN_DIR = '.qwen';
const QWEN_CREDENTIAL_FILENAME = 'oauth_creds.json';

// Token Configuration
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

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
 * Qwen OAuth2 client interface
 */
export interface QwenOAuth2Client {
  setCredentials(credentials: QwenCredentials): void;
  getCredentials(): QwenCredentials;
  getAccessToken(): Promise<{ token?: string }>;
  generateAuthUrl(options: {
    redirect_uri: string;
    access_type: string;
    scope: string[];
    state: string;
    nonce?: string;
  }): string;
  getToken(options: {
    code: string;
    redirect_uri: string;
  }): Promise<{ tokens: QwenCredentials }>;
  refreshAccessToken(): Promise<{ credentials: QwenCredentials }>;
}

/**
 * Qwen OAuth2 client implementation
 */
class QwenOAuth2ClientImpl implements QwenOAuth2Client {
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

  generateAuthUrl(options: {
    redirect_uri: string;
    access_type: string;
    scope: string[];
    state: string;
    nonce?: string;
  }): string {
    const params = new URLSearchParams({
      client_id: QWEN_OAUTH_CLIENT_ID,
      redirect_uri: options.redirect_uri,
      response_type: 'code',
      scope: options.scope.join(' '),
      state: options.state,
    });

    // Add nonce if provided (recommended for OpenID Connect)
    if (options.nonce) {
      params.set('nonce', options.nonce);
    }

    return `${QWEN_OAUTH_AUTHORIZE_ENDPOINT}?${params.toString()}`;
  }

  async getToken(options: {
    code: string;
    redirect_uri: string;
  }): Promise<{ tokens: QwenCredentials }> {
    const tokenEndpoint = QWEN_OAUTH_TOKEN_ENDPOINT;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: options.code,
      client_id: QWEN_OAUTH_CLIENT_ID,
      redirect_uri: options.redirect_uri,
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `Token exchange failed: ${response.status} ${response.statusText}. Response: ${errorData}`,
      );
    }

    const tokens = (await response.json()) as QwenCredentials;

    // Set expiry date based on expires_in field or default
    if (!tokens.expiry_date && tokens.access_token) {
      // Mock service returns expires_in field, convert to expiry_date
      const expiresIn = (tokens as { expires_in?: number }).expires_in || 3600;
      tokens.expiry_date = Date.now() + expiresIn * 1000;
    }

    this.setCredentials(tokens);
    return { tokens };
  }

  async refreshAccessToken(): Promise<{ credentials: QwenCredentials }> {
    if (!this.credentials.refresh_token) {
      throw new Error('No refresh token available');
    }

    const tokenEndpoint = QWEN_OAUTH_TOKEN_ENDPOINT;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.credentials.refresh_token,
      client_id: QWEN_OAUTH_CLIENT_ID,
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `Token refresh failed: ${response.status} ${response.statusText}. Response: ${errorData}`,
      );
    }

    const tokens = (await response.json()) as QwenCredentials;

    // Preserve refresh token if not returned
    if (!tokens.refresh_token && this.credentials.refresh_token) {
      tokens.refresh_token = this.credentials.refresh_token;
    }

    // Set expiry date based on expires_in field or default
    if (!tokens.expiry_date && tokens.access_token) {
      const expiresIn = (tokens as { expires_in?: number }).expires_in || 3600;
      tokens.expiry_date = Date.now() + expiresIn * 1000;
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

/**
 * An Authentication URL for updating the credentials of a QwenOAuth2Client
 * as well as a promise that will resolve when the credentials have
 * been refreshed (or which throws error when refreshing credentials failed).
 */
export interface QwenOauthWebLogin {
  authUrl: string;
  loginCompletePromise: Promise<void>;
}

let tokenUpdateCallback: ((tokens: QwenCredentials) => Promise<void>) | null =
  null;

export async function getQwenOauthClient(
  config: Config,
): Promise<QwenOAuth2Client> {
  const client = new QwenOAuth2ClientImpl({
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

  if (config.isBrowserLaunchSuppressed()) {
    let success = false;
    const maxRetries = 2;
    for (let i = 0; !success && i < maxRetries; i++) {
      success = await authWithQwenUserCode(client);
      if (!success) {
        console.error(
          '\nFailed to authenticate with Qwen user code.',
          i === maxRetries - 1 ? '' : 'Retrying...\n',
        );
      }
    }
    if (!success) {
      process.exit(1);
    }
  } else {
    const webLogin = await authWithQwenWeb(client);

    console.log(
      `\n\nQwen OAuth login required.\n` +
        `Attempting to open authentication page in your browser.\n` +
        `Otherwise navigate to:\n\n${webLogin.authUrl}\n\n`,
    );
    try {
      const childProcess = await open(webLogin.authUrl);

      childProcess.on('error', (_) => {
        console.error(
          'Failed to open browser automatically. Please try running again with NO_BROWSER=true set.',
        );
        process.exit(1);
      });
    } catch (err) {
      console.error(
        'An unexpected error occurred while trying to open the browser:',
        err,
        '\nPlease try running again with NO_BROWSER=true set.',
      );
      process.exit(1);
    }
    console.log('Waiting for authentication...');

    await webLogin.loginCompletePromise;
  }

  return client;
}

async function authWithQwenUserCode(
  client: QwenOAuth2Client,
): Promise<boolean> {
  // For mock service, use a simple callback URL that doesn't exist
  const redirectUri = 'http://localhost:3000/callback';
  const state = crypto.randomBytes(32).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');

  const authUrl: string = client.generateAuthUrl({
    redirect_uri: redirectUri,
    access_type: 'offline',
    scope: QWEN_OAUTH_SCOPE,
    state,
    nonce,
  });

  console.log('Please visit the following URL to authorize the application:');
  console.log('');
  console.log(authUrl);
  console.log('');
  console.log(
    'After authorization, the browser will redirect to the callback URL. Please copy the authorization code (value of the code parameter) from the URL.',
  );

  const code = await new Promise<string>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Please enter the authorization code: ', (code) => {
      rl.close();
      resolve(code.trim());
    });
  });

  if (!code) {
    console.error('Authorization code is required.');
    return false;
  }

  try {
    const { tokens } = await client.getToken({
      code,
      redirect_uri: redirectUri,
    });
    client.setCredentials(tokens);
    if (tokenUpdateCallback) {
      await tokenUpdateCallback(tokens);
    }
    console.log('Authentication successful! Access token obtained.');
  } catch (error) {
    console.error('Token exchange failed:', error);
    return false;
  }
  return true;
}

async function authWithQwenWeb(
  client: QwenOAuth2Client,
): Promise<QwenOauthWebLogin> {
  const port = await getAvailablePort();
  const host = process.env.OAUTH_CALLBACK_HOST || 'localhost';
  const redirectUri = `http://localhost:${port}/oauth2callback`;
  const state = crypto.randomBytes(32).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');

  const authUrl = client.generateAuthUrl({
    redirect_uri: redirectUri,
    access_type: 'offline',
    scope: QWEN_OAUTH_SCOPE,
    state,
    nonce,
  });

  const loginCompletePromise = new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url!.indexOf('/oauth2callback') === -1) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(
            '<html><body><h1>Authentication Failed</h1><p>Unexpected request path</p></body></html>',
          );
          reject(new Error('Unexpected request: ' + req.url));
        }

        const qs = new url.URL(req.url!, 'http://localhost:3000').searchParams;
        if (qs.get('error')) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(
            '<html><body><h1>Authentication Failed</h1><p>Error: ' +
              qs.get('error') +
              '</p></body></html>',
          );
          reject(new Error(`Error during authentication: ${qs.get('error')}`));
        } else if (qs.get('state') !== state) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(
            '<html><body><h1>Security Error</h1><p>State parameter mismatch</p></body></html>',
          );
          reject(new Error('State mismatch. Possible CSRF attack'));
        } else if (qs.get('code')) {
          try {
            const { tokens } = await client.getToken({
              code: qs.get('code')!,
              redirect_uri: redirectUri,
            });
            client.setCredentials(tokens);

            // Cache the new tokens
            if (tokenUpdateCallback) {
              await tokenUpdateCallback(tokens);
            }

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(
              '<html><body><h1>Authentication Successful</h1><p>You can close this page</p></body></html>',
            );
            resolve();
          } catch (tokenError) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(
              '<html><body><h1>Token Exchange Failed</h1><p>Error: ' +
                tokenError +
                '</p></body></html>',
            );
            reject(tokenError);
          }
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(
            '<html><body><h1>Authentication Failed</h1><p>No authorization code found</p></body></html>',
          );
          reject(new Error('No code found in request'));
        }
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html><body><h1>Internal Error</h1><p>${e}</p></body></html>`);
        reject(e);
      } finally {
        server.close();
      }
    });
    server.listen(port, host);
    console.log('Callback server started on port:', port);
  });

  return {
    authUrl,
    loginCompletePromise,
  };
}

export function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    let port = 8888;
    try {
      const portStr = process.env.OAUTH_CALLBACK_PORT;
      if (portStr) {
        port = parseInt(portStr, 10);
        if (isNaN(port) || port <= 0 || port > 65535) {
          return reject(
            new Error(`Invalid value for OAUTH_CALLBACK_PORT: "${portStr}"`),
          );
        }
        return resolve(port);
      }
      const server = net.createServer();
      server.listen(0, () => {
        const address = server.address()! as net.AddressInfo;
        port = address.port;
      });
      server.on('listening', () => {
        server.close();
        server.unref();
      });
      server.on('error', (e) => reject(e));
      server.on('close', () => resolve(port));
    } catch (e) {
      reject(e);
    }
  });
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

export async function clearQwenCachedCredentialFile() {
  try {
    await fs.rm(getQwenCachedCredentialPath(), { force: true });
  } catch (_) {
    /* empty */
  }
}
