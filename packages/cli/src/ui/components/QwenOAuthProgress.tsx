/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import qrcode from 'qrcode-terminal';
import { Colors } from '../colors.js';
import { DeviceAuthorizationInfo } from '../hooks/useQwenAuth.js';

interface QwenOAuthProgressProps {
  onTimeout: () => void;
  onCancel: () => void;
  deviceAuth?: DeviceAuthorizationInfo;
}

export function QwenOAuthProgress({
  onTimeout,
  onCancel,
  deviceAuth,
}: QwenOAuthProgressProps): React.JSX.Element {
  const [timeRemaining, setTimeRemaining] = useState<number>(
    deviceAuth?.expires_in || 300, // Default 5 minutes
  );
  const [dots, setDots] = useState<string>('');
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);

  useInput((_, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  // Generate QR code when device auth is available
  useEffect(() => {
    if (!deviceAuth) {
      setQrCodeData(null);
      return;
    }

    // Generate QR code string
    const generateQR = () => {
      try {
        qrcode.generate(
          deviceAuth.verification_uri_complete,
          { small: true },
          (qrcode: string) => {
            setQrCodeData(qrcode);
          },
        );
      } catch (error) {
        console.error('Failed to generate QR code:', error);
        setQrCodeData(null);
      }
    };

    generateQR();
  }, [deviceAuth]);

  // Countdown timer
  useEffect(() => {
    if (!deviceAuth) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [deviceAuth, onTimeout]);

  // Animated dots
  useEffect(() => {
    const dotsTimer = setInterval(() => {
      setDots((prev) => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(dotsTimer);
  }, []);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!deviceAuth) {
    return (
      <Box
        borderStyle="round"
        borderColor={Colors.Gray}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Box>
          <Text>
            <Spinner type="dots" /> Waiting for Qwen OAuth authentication...
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color={Colors.AccentPurple}>(Press ESC to cancel)</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.AccentBlue}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={Colors.AccentBlue}>
        Qwen OAuth Authentication
      </Text>

      <Box marginTop={1}>
        <Text>Please visit this URL to authorize:</Text>
      </Box>

      <Box
        marginTop={1}
        borderStyle="single"
        borderColor={Colors.Gray}
        padding={1}
      >
        <Text color={Colors.AccentGreen} bold>
          {deviceAuth.verification_uri_complete}
        </Text>
      </Box>

      {qrCodeData && (
        <>
          <Box marginTop={1}>
            <Text>Or scan the QR code below:</Text>
          </Box>
          <Box marginTop={1}>
            <Text>{qrCodeData}</Text>
          </Box>
        </>
      )}

      <Box marginTop={1}>
        <Text>
          <Spinner type="dots" /> Waiting for authorization{dots}
        </Text>
      </Box>

      <Box marginTop={1} justifyContent="space-between">
        <Text color={Colors.Gray}>
          Time remaining: {formatTime(timeRemaining)}
        </Text>
        <Text color={Colors.AccentPurple}>(Press ESC to cancel)</Text>
      </Box>
    </Box>
  );
}
