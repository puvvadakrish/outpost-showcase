import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// @ts-expect-error Next config is intentionally authored as ESM JavaScript.
import nextConfig, { buildContentSecurityPolicy } from "../next.config.mjs";
import { reportServerFailure } from "@/server/observability";

describe("production foundation", () => {
  it("applies baseline security headers to every route", async () => {
    const rules = await nextConfig.headers?.();
    const headers = new Map(
      rules?.[0]?.headers.map((header: { key: string; value: string }) => [header.key, header.value])
    );

    expect(rules?.[0]?.source).toBe("/(.*)");
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("Content-Security-Policy")).toContain("object-src 'none'");
    expect(headers.get("Content-Security-Policy")).not.toContain("connect-src 'self' https:");
    expect(headers.get("Strict-Transport-Security")).toContain("includeSubDomains");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Permissions-Policy")).toContain("payment=()");
  });

  it("keeps production eval disabled and allows only configured HTTPS API origins", () => {
    const productionPolicy = buildContentSecurityPolicy("production", {
      NEXT_PUBLIC_NEON_AUTH_URL: "https://auth.example.test/v1",
      NEXT_PUBLIC_NEON_DATA_API_URL: "https://data.example.test/api",
      IGNORED_URL: "https://ignored.example.test"
    });
    const developmentPolicy = buildContentSecurityPolicy("development", {});

    expect(productionPolicy).toContain("connect-src 'self' https://auth.example.test https://data.example.test");
    expect(productionPolicy).not.toContain("ignored.example.test");
    expect(productionPolicy).not.toContain("'unsafe-eval'");
    expect(developmentPolicy).toContain("'unsafe-eval'");
  });

  it("logs a correlation-safe server failure without exception content", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    reportServerFailure("owner.workspace.load", new Error("owner@example.com secret note"));
    const payload = JSON.parse(String(consoleError.mock.calls[0]?.[0]));

    expect(payload).toMatchObject({
      errorType: "Error",
      event: "outpost.server_failure",
      operation: "owner.workspace.load"
    });
    expect(payload.incidentId).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(JSON.stringify(payload)).not.toContain("owner@example.com");
    expect(JSON.stringify(payload)).not.toContain("secret note");
    expect(JSON.stringify(payload)).not.toContain("stack");
    consoleError.mockRestore();
  });

  it("normalizes unsafe operation and error names", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    class CustomerNamedError extends Error {}

    reportServerFailure("customer@example.com", new CustomerNamedError("private"));
    const payload = JSON.parse(String(consoleError.mock.calls[0]?.[0]));

    expect(payload.operation).toBe("unknown_operation");
    expect(payload.errorType).toBe("Error");
    consoleError.mockRestore();
  });
});
