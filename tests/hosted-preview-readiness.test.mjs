import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertAllowedProjectId,
  assertHostedNeonBranchServiceUrls,
  assertHostedNeonEndpointPair,
  assertHostedNeonAuthUrl,
  assertHostedNeonUrl,
  readHostedReadinessConfig
} from "../scripts/hosted-preview-readiness-config.mjs";

const hostedReadinessScript = readFileSync("scripts/verify-hosted-preview-readiness.mjs", "utf8");

describe("hosted preview readiness verifier guardrails", () => {
  it("rejects existing non-Outpost Neon projects", () => {
    expect(() => assertAllowedProjectId("aaaaaaaaaaaaaaaaaaa3")).toThrow(
      "Refusing to use existing Neon project other-project-c"
    );
    expect(() => assertAllowedProjectId("aaaaaaaaaaaaaaaaaaa1")).toThrow("other-project-a");
  });

  it("requires clean hosted Neon Auth and Data API branch URLs", () => {
    expect(() => assertHostedNeonUrl("http://127.0.0.1:54331")).toThrow(
      "Refusing hosted readiness proof against local Neon"
    );
    expect(() => assertHostedNeonUrl("https://outpostpreviewref.neon.co:54321/neondb/rest/v1")).toThrow(
      "must not include a custom port"
    );
    expect(() => assertHostedNeonUrl("https://example.com/neondb/rest/v1")).toThrow("must use a Neon host");
    expect(() => assertHostedNeonUrl("https://ep-example.apirest.c-3.us-east-1.aws.neon.tech/")).toThrow(
      "must include the database /rest/v1 path"
    );
    expect(() => assertHostedNeonAuthUrl("https://ep-example.apirest.c-3.us-east-1.aws.neon.tech/neondb/auth")).toThrow(
      "must use a Neon Auth host"
    );

    expect(assertHostedNeonUrl("https://ep-example.apirest.c-3.us-east-1.aws.neon.tech/neondb/rest/v1").hostname).toBe(
      "ep-example.apirest.c-3.us-east-1.aws.neon.tech"
    );
  });

  it("requires Auth and Data API URLs to share one Neon endpoint and database", () => {
    const authUrl = assertHostedNeonAuthUrl("https://ep-example.neonauth.c-3.us-east-1.aws.neon.tech/neondb/auth");
    const dataApiUrl = assertHostedNeonUrl("https://ep-example.apirest.c-3.us-east-1.aws.neon.tech/neondb/rest/v1");

    expect(assertHostedNeonEndpointPair(authUrl, dataApiUrl)).toEqual({
      databaseName: "neondb",
      endpointId: "ep-example"
    });
    expect(() =>
      assertHostedNeonEndpointPair(
        authUrl,
        assertHostedNeonUrl("https://ep-other.apirest.c-3.us-east-1.aws.neon.tech/neondb/rest/v1")
      )
    ).toThrow("same Neon branch endpoint");
    expect(() =>
      assertHostedNeonEndpointPair(
        authUrl,
        assertHostedNeonUrl("https://ep-example.apirest.c-3.us-east-1.aws.neon.tech/otherdb/rest/v1")
      )
    ).toThrow("same Neon database");
  });

  it("requires configured URLs to match the configured Neon branch service status", () => {
    const config = {
      branchName: "outpost-hosted-proof",
      databaseName: "neondb",
      neonAuthUrl: "https://ep-example.neonauth.c-3.us-east-1.aws.neon.tech/neondb/auth",
      neonDataApiUrl: "https://ep-example.apirest.c-3.us-east-1.aws.neon.tech/neondb/rest/v1",
      projectId: "outpostpreviewref",
      seedPassword: "rotatedHostedPassword123"
    };
    const branch = {
      id: "br-outpost-proof",
      name: "outpost-hosted-proof"
    };
    const authStatus = {
      base_url: config.neonAuthUrl,
      branch_id: "br-outpost-proof"
    };
    const dataApiStatus = {
      url: config.neonDataApiUrl
    };

    expect(() => assertHostedNeonBranchServiceUrls(config, branch, authStatus, dataApiStatus)).not.toThrow();
    expect(() =>
      assertHostedNeonBranchServiceUrls(config, { ...branch, name: "other-branch" }, authStatus, dataApiStatus)
    ).toThrow("does not match OUTPOST_NEON_BRANCH_NAME");
    expect(() =>
      assertHostedNeonBranchServiceUrls(config, branch, { ...authStatus, branch_id: "br-other" }, dataApiStatus)
    ).toThrow("does not belong to the hosted proof branch");
    expect(() =>
      assertHostedNeonBranchServiceUrls(config, branch, { ...authStatus, base_url: "https://wrong.example/auth" }, dataApiStatus)
    ).toThrow("NEXT_PUBLIC_NEON_AUTH_URL must exactly match");
    expect(() =>
      assertHostedNeonBranchServiceUrls(config, branch, authStatus, { url: "https://wrong.example/rest/v1" })
    ).toThrow("NEXT_PUBLIC_NEON_DATA_API_URL must exactly match");
  });

  it("requires a rotated hosted seed password", () => {
    const baseEnv = {
      OUTPOST_NEON_BRANCH_NAME: "outpost-hosted-proof",
      OUTPOST_NEON_PROJECT_ID: "outpostpreviewref",
      NEXT_PUBLIC_NEON_AUTH_URL: "https://ep-example.neonauth.c-3.us-east-1.aws.neon.tech/neondb/auth",
      NEXT_PUBLIC_NEON_DATA_API_URL: "https://ep-example.apirest.c-3.us-east-1.aws.neon.tech/neondb/rest/v1"
    };

    expect(() => readHostedReadinessConfig(baseEnv)).toThrow("OUTPOST_NEON_SEED_PASSWORD is required");
    expect(() =>
      readHostedReadinessConfig({
        ...baseEnv,
        OUTPOST_NEON_BRANCH_NAME: "outpost-neon-spike",
        OUTPOST_NEON_SEED_PASSWORD: "rotatedHostedPassword123"
      })
    ).toThrow("Refusing to run hosted proof against the Neon migration spike branch");
    expect(() =>
      readHostedReadinessConfig({
        ...baseEnv,
        OUTPOST_NEON_SEED_PASSWORD: "outpost-local-password"
      })
    ).toThrow("Refusing the local seed password");

    expect(
      readHostedReadinessConfig({
        ...baseEnv,
        OUTPOST_NEON_SEED_PASSWORD: "rotatedHostedPassword123"
      })
    ).toMatchObject({
      branchName: "outpost-hosted-proof",
      databaseName: "neondb",
      neonAuthUrl: "https://ep-example.neonauth.c-3.us-east-1.aws.neon.tech/neondb/auth",
      neonDataApiUrl: "https://ep-example.apirest.c-3.us-east-1.aws.neon.tech/neondb/rest/v1",
      projectId: "outpostpreviewref",
      seedPassword: "rotatedHostedPassword123"
    });
  });

  it("loads hosted config before delegating to the Neon proof runner", () => {
    expect(hostedReadinessScript).toContain("readHostedReadinessConfig");
    expect(hostedReadinessScript).toContain("const config = readHostedReadinessConfig()");
    expect(hostedReadinessScript).toContain("assertHostedNeonBranchServiceUrls(config, branch, authStatus, dataApiStatus)");
    expect(hostedReadinessScript).toContain("process.env.OUTPOST_NEON_BRANCH_NAME = config.branchName");
    expect(hostedReadinessScript.indexOf("assertHostedNeonBranchServiceUrls")).toBeLessThan(
      hostedReadinessScript.indexOf('import("./verify-neon-spike-readiness.mjs")')
    );
  });
});
