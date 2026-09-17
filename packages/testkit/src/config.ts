/** Locating and loading the project's adapter. */

import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { JapanReadyAdapter } from "@japanready/core";

const CONFIG_BASENAMES = [
  "japanready.config.ts",
  "japanready.config.mts",
  "japanready.config.mjs",
  "japanready.config.js",
  "japanready.config.cjs",
  "japanready.config.json",
];

export function findConfig(cwd = process.cwd()): string | undefined {
  for (const name of CONFIG_BASENAMES) {
    const candidate = resolve(cwd, name);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Unwrap whatever the config module exported.
 *
 * Accepts the adapter directly, `{ adapter }`, or a factory returning either —
 * a config file usually needs to import the product's own modules first.
 */
async function unwrap(loaded: unknown): Promise<JapanReadyAdapter> {
  let value = loaded;

  if (value && typeof value === "object" && "default" in value) {
    value = (value as { default: unknown }).default;
  }
  if (typeof value === "function") {
    value = await (value as () => unknown)();
  }
  if (value && typeof value === "object" && "adapter" in value) {
    value = (value as { adapter: unknown }).adapter;
  }
  if (!value || typeof value !== "object") {
    throw new Error(
      "The JapanReady config must export an adapter object, an object with an `adapter` " +
        "property, or a function returning one.",
    );
  }
  return value as JapanReadyAdapter;
}

/** Load an adapter from an explicit path or from the nearest config file. */
export async function loadAdapter(configPath?: string): Promise<{
  adapter: JapanReadyAdapter;
  path: string;
}> {
  const path = configPath
    ? isAbsolute(configPath)
      ? configPath
      : resolve(process.cwd(), configPath)
    : findConfig();

  if (!path) {
    throw new Error(
      "No JapanReady config found. Create a japanready.config.ts that exports your " +
        "adapter, or run with --reference to score the bundled reference implementation.\n" +
        "Run `japanready init` to write a starter config.",
    );
  }
  if (!existsSync(path)) {
    throw new Error(`Config not found: ${path}`);
  }

  if (path.endsWith(".ts") || path.endsWith(".mts")) {
    // Node has stripped TypeScript types natively since 22.18. Anything older
    // needs a loader, and the error below says so rather than failing opaquely.
    try {
      const loaded = (await import(pathToFileURL(path).href)) as unknown;
      return { adapter: await unwrap(loaded), path };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to load ${path}: ${message}\n` +
          "A TypeScript config needs Node 22.18+ (native type stripping) or a loader such " +
          "as tsx. Alternatively point --config at a .mjs file.",
      );
    }
  }

  const loaded = (await import(pathToFileURL(path).href)) as unknown;
  return { adapter: await unwrap(loaded), path };
}

/** The starter config `japanready init` writes. */
export const STARTER_CONFIG = `import type { JapanReadyAdapter } from "@japanready/testkit";

// Point each operation at the function your product already uses. Anything you
// leave out is reported as uncovered rather than failed, so start with the two
// or three fields you actually store and grow from there.
const adapter: JapanReadyAdapter = {
  name: "my-product",

  // normalizeText: (input) => myNormalize(input),
  // validateName: (input) => myNameSchema.safeParse(input).success,
  // normalizePhone: (input) => myPhone.toE164(input),
  // normalizePostalCode: (input) => myPostal.normalize(input),
  // validateCorporateNumber: (input) => myTax.isCorporateNumber(input),
};

export default adapter;
`;
