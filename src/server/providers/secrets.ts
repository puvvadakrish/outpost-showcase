import "server-only";

import { createHash } from "node:crypto";

const PROVIDER_SECRET_REF =
  /^outpost-secret:\/\/provider\/[A-Za-z0-9][A-Za-z0-9._:-]{7,127}\/(webhook-signing|api)\/v[1-9][0-9]*$/;

export function providerSecretEnvironmentKey(secretRef: string) {
  const normalized = secretRef.trim();
  if (normalized !== secretRef || !PROVIDER_SECRET_REF.test(normalized)) {
    throw new Error("Provider secret reference is invalid.");
  }

  const digest = createHash("sha256").update(normalized, "utf8").digest("hex");
  return `OUTPOST_PROVIDER_SECRET_${digest.slice(0, 32).toUpperCase()}`;
}

export function resolveProviderSecret(
  secretRef: string,
  env: Record<string, string | undefined> = process.env
) {
  const environmentKey = providerSecretEnvironmentKey(secretRef);
  const value = env[environmentKey];

  if (!value?.trim()) {
    throw new Error("Provider secret is not configured.");
  }

  return value;
}
