/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  readPackageUp,
  type PackageJson as BasePackageJson,
} from 'read-package-up';
import { fileURLToPath } from 'url';
import path from 'path';

export type PackageJson = BasePackageJson & {
  config?: {
    sandboxImageUri?: string;
  };
};

// Support both ESM and CJS bundles
// In CJS, __dirname/__filename are defined; in ESM, we derive from import.meta.url
const __filenameESM = fileURLToPath(import.meta.url);
// Use a dynamic global check to avoid TypeScript errors in ESM
const __filenameFallback: string | undefined = (globalThis as any).__filename;
const __filenameEffective = __filenameFallback || __filenameESM;
const __dirnameEffective = path.dirname(__filenameEffective);

let packageJson: PackageJson | undefined;

export async function getPackageJson(): Promise<PackageJson | undefined> {
  if (packageJson) {
    return packageJson;
  }

  const result = await readPackageUp({ cwd: __dirnameEffective });
  if (!result) {
    // TODO: Maybe bubble this up as an error.
    return;
  }

  packageJson = result.packageJson;
  return packageJson;
}
