import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  providerSecretEnvironmentKey,
  resolveProviderSecret
} from "@/server/providers/secrets";

const migration = readFileSync(
  new URL("../neon/migrations/20260713020000_provider_secret_reference_boundary.sql", import.meta.url),
  "utf8"
);
const repository = readFileSync(
  new URL("../src/infrastructure/neon/owner-context-repository.ts", import.meta.url),
  "utf8"
);

describe("provider secret boundary", () => {
  const secretRef =
    "outpost-secret://provider/provider_retell_acme_fitness/webhook-signing/v1";

  it("maps a validated reference to one deterministic environment key", () => {
    const key = providerSecretEnvironmentKey(secretRef);

    expect(key).toMatch(/^OUTPOST_PROVIDER_SECRET_[A-F0-9]{32}$/);
    expect(providerSecretEnvironmentKey(secretRef)).toBe(key);
    expect(resolveProviderSecret(secretRef, { [key]: "test-signing-value" })).toBe(
      "test-signing-value"
    );
  });

  it.each([
    "OUTPOST_PROVIDER_SECRET_ANYTHING",
    "outpost-secret://provider/short/webhook-signing/v1",
    "outpost-secret://provider/provider_valid/arbitrary-env/v1",
    "outpost-secret://provider/provider_valid/webhook-signing/v0",
    " outpost-secret://provider/provider_valid/webhook-signing/v1",
    "outpost-secret://provider/provider_valid/webhook-signing/v1 ",
    " outpost-secret://provider/provider_valid/webhook-signing/v1 trailing"
  ])("rejects an unsafe reference: %s", (value) => {
    expect(() => providerSecretEnvironmentKey(value)).toThrow(
      "Provider secret reference is invalid."
    );
  });

  it("fails without disclosing the reference, environment key, or value", () => {
    const key = providerSecretEnvironmentKey(secretRef);

    expect(() => resolveProviderSecret(secretRef, {})).toThrow(
      "Provider secret is not configured."
    );
    expect(() => resolveProviderSecret(secretRef, { [key]: "   " })).toThrow(
      "Provider secret is not configured."
    );
  });

  it("enforces credential presence as the only authenticated projection", () => {
    expect(migration).toContain("generated always as (secret_ref is not null) stored");
    expect(migration).toContain("revoke select on provider_connections from authenticated");
    expect(migration).toContain("credential_reference_configured");
    expect(repository).toContain("credential_reference_configured");
    expect(repository).not.toContain("secret_ref");
    expect(repository).not.toContain("secretRef");
  });
});
