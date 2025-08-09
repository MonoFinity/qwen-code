/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode';
import { IDEServer } from './ide-server';
import { createLogger } from './utils/logger';

let ideServer: IDEServer;
let logger: vscode.OutputChannel;
let log: (message: string) => void = () => {};

export async function activate(context: vscode.ExtensionContext) {
  logger = vscode.window.createOutputChannel('Qwen Code IDE Companion');
  log = createLogger(context, logger);
  log('Extension activated');
  ideServer = new IDEServer(log);
  try {
    await ideServer.start(context);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Failed to start IDE server: ${message}`);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('qwen-code.runQwenCode', async () => {
      const prompt = await vscode.window.showInputBox({
        prompt: 'Ask Qwen 3 Coder Plus',
      });
      if (!prompt) {
        return;
      }
      const apiKey = process.env.QWEN_API_KEY;
      if (!apiKey) {
        vscode.window.showErrorMessage('QWEN_API_KEY environment variable not set');
        return;
      }
      try {
        const res = await fetch(
          'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'qwen3-coder-plus',
              messages: [{ role: 'user', content: prompt }],
            }),
          },
        );
        const data = await res.json();
        const answer = data.choices?.[0]?.message?.content;
        if (typeof answer === 'string') {
          logger.appendLine(answer);
          logger.show();
        } else {
          logger.appendLine(JSON.stringify(data, null, 2));
          logger.show();
          vscode.window.showErrorMessage('Unexpected response from Qwen API');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Qwen request failed: ${message}`);
      }
    }),
  );
}

export async function deactivate(): Promise<void> {
  log('Extension deactivated');
  try {
    if (ideServer) {
      await ideServer.stop();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Failed to stop IDE server during deactivation: ${message}`);
  } finally {
    if (logger) {
      logger.dispose();
    }
  }
}
