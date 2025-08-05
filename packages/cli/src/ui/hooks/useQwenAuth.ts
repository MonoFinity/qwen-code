/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import { LoadedSettings } from '../../config/settings.js';
import { AuthType, Config } from '@qwen-code/qwen-code-core';

interface DeviceAuthorizationInfo {
  verification_uri: string;
  verification_uri_complete: string;
  user_code: string;
  expires_in: number;
}

interface QwenAuthState {
  isQwenAuthenticating: boolean;
  deviceAuth: DeviceAuthorizationInfo | null;
  authStatus: 'idle' | 'polling' | 'success' | 'error';
  authMessage: string | null;
  qrCodeData: string | null;
}

export const useQwenAuth = (
  settings: LoadedSettings,
  config: Config,
  isAuthenticating: boolean,
) => {
  const [qwenAuthState, setQwenAuthState] = useState<QwenAuthState>({
    isQwenAuthenticating: false,
    deviceAuth: null,
    authStatus: 'idle',
    authMessage: null,
    qrCodeData: null,
  });

  const isQwenAuth = settings.merged.selectedAuthType === AuthType.QWEN_OAUTH;

  // Set up callbacks when authentication starts
  useEffect(() => {
    if (!isQwenAuth || !isAuthenticating) {
      // Reset state when not authenticating or not Qwen auth
      setQwenAuthState({
        isQwenAuthenticating: false,
        deviceAuth: null,
        authStatus: 'idle',
        authMessage: null,
        qrCodeData: null,
      });
      return;
    }

    setQwenAuthState((prev) => ({
      ...prev,
      isQwenAuthenticating: true,
      authStatus: 'idle',
    }));

    // Import and set up callbacks
    import('@qwen-code/qwen-code-core').then(
      ({
        setDeviceAuthCallback,
        setAuthProgressCallback,
        setQrCodeCallback,
      }) => {
        // Set device auth callback
        setDeviceAuthCallback(
          (deviceAuth: {
            verification_uri: string;
            verification_uri_complete: string;
            user_code: string;
            expires_in: number;
          }) => {
            setQwenAuthState((prev) => ({
              ...prev,
              deviceAuth: {
                verification_uri: deviceAuth.verification_uri,
                verification_uri_complete: deviceAuth.verification_uri_complete,
                user_code: deviceAuth.user_code,
                expires_in: deviceAuth.expires_in,
              },
              authStatus: 'polling',
            }));
          },
        );

        // Set progress callback
        setAuthProgressCallback(
          (status: 'success' | 'error' | 'polling', message?: string) => {
            setQwenAuthState((prev) => ({
              ...prev,
              authStatus: status,
              authMessage: message || null,
            }));
          },
        );

        // Set QR code callback
        setQrCodeCallback((qrCodeData: string, url: string) => {
          setQwenAuthState((prev) => ({
            ...prev,
            qrCodeData,
          }));
        });
      },
    );

    // Cleanup callbacks when component unmounts or auth finishes
    return () => {
      import('@qwen-code/qwen-code-core').then(
        ({
          setDeviceAuthCallback,
          setAuthProgressCallback,
          setQrCodeCallback,
        }) => {
          setDeviceAuthCallback(null);
          setAuthProgressCallback(null);
          setQrCodeCallback(null);
        },
      );
    };
  }, [isQwenAuth, isAuthenticating]);

  const cancelQwenAuth = useCallback(() => {
    setQwenAuthState({
      isQwenAuthenticating: false,
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
      qrCodeData: null,
    });

    // Clear callbacks
    import('@qwen-code/qwen-code-core').then(
      ({
        setDeviceAuthCallback,
        setAuthProgressCallback,
        setQrCodeCallback,
      }) => {
        setDeviceAuthCallback(null);
        setAuthProgressCallback(null);
        setQrCodeCallback(null);
      },
    );
  }, []);

  return {
    ...qwenAuthState,
    isQwenAuth,
    cancelQwenAuth,
  };
};
