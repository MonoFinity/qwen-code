/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { Colors } from '../colors.js';

interface DeviceAuthorizationInfo {
  verification_uri: string;
  verification_uri_complete: string;
  user_code: string;
  expires_in: number;
}

interface QwenOAuthProgressProps {
  onTimeout: () => void;
  onCancel: () => void;
  deviceAuth?: DeviceAuthorizationInfo;
  qrCodeData?: string | null;
}

export function QwenOAuthProgress({
  onTimeout,
  onCancel,
  deviceAuth,
  qrCodeData,
}: QwenOAuthProgressProps): React.JSX.Element {
  const [timeRemaining, setTimeRemaining] = useState<number>(
    deviceAuth?.expires_in || 300, // Default 5 minutes
  );
  const [dots, setDots] = useState<string>('');

  useInput((_, key) => {
    if (key.escape) {
      onCancel();
    }
  });

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
            <Spinner type="dots" /> Initializing Qwen OAuth authentication...
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

      <Box marginTop={1} borderStyle="single" borderColor={Colors.Gray} padding={1}>
        <Text color={Colors.AccentGreen} bold>
          {deviceAuth.verification_uri_complete}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text>Or visit {deviceAuth.verification_uri} and enter code:</Text>
      </Box>

      <Box marginTop={1} borderStyle="single" borderColor={Colors.Gray} padding={1}>
        <Text color={Colors.AccentYellow} bold>
          {deviceAuth.user_code}
        </Text>
      </Box>

      {qrCodeData && (
        <Box marginTop={1}>
          <Text>Scan the QR code below:</Text>
          <Box
            marginTop={1}
            borderStyle="single"
            borderColor={Colors.AccentBlue}
            padding={1}
          >
            <Text>{qrCodeData}</Text>
          </Box>
        </Box>
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

      <Box marginTop={1}>
        <Text color={Colors.Gray} italic>
          After authorizing, you can close the browser tab.
        </Text>
      </Box>
    </Box>
  );
}
