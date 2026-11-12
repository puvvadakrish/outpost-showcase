import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const preflightScript = readFileSync("scripts/preflight-owner-beta-access-request.mjs", "utf8");
const fulfillmentScript = readFileSync("scripts/fulfill-owner-beta-access-request.mjs", "utf8");
const ownerAccessScript = readFileSync("scripts/provision-owner-beta-access.mjs", "utf8");
const fulfillmentMigration = readFileSync(
  "neon/migrations/20260622050000_owner_beta_access_request_fulfillment.sql",
  "utf8"
);
const runbook = readFileSync("docs/setup/hosted-beta-operator-access.md", "utf8");

describe("beta request fulfillment", () => {
  it("registers an operator-only dry-run preflight command", () => {
    expect(packageJson).toContain('"beta:operator:request-preflight": "node scripts/preflight-owner-beta-access-request.mjs"');
    expect(preflightScript).toContain('requireEnv("OUTPOST_OWNER_BETA_REQUEST_EMAIL")');
    expect(preflightScript).toContain("NEON_API_KEY is required for beta request fulfillment preflight");
    expect(preflightScript).toContain("Refusing beta request preflight on Neon production");
    expect(preflightScript).toContain("Refusing beta request preflight on the Neon migration spike branch");
    expect(preflightScript).toContain("Dry-run complete; no hosted rows were written.");
    expect(preflightScript).not.toMatch(/\binsert\s+into\b/iu);
    expect(preflightScript).not.toMatch(/\bupdate\s+[\w."]+\s+set\b/iu);
    expect(preflightScript).not.toMatch(/\bdelete\s+from\b/iu);
  });

  it("registers an operator-only fulfillment command", () => {
    expect(packageJson).toContain('"beta:operator:request-fulfillment": "node scripts/fulfill-owner-beta-access-request.mjs"');
    expect(fulfillmentScript).toContain('requireEnv("OUTPOST_OWNER_BETA_REQUEST_EMAIL")');
    expect(fulfillmentScript).toContain('requireEnv("OUTPOST_OWNER_BETA_PASSWORD")');
    expect(fulfillmentScript).toContain("NEON_API_KEY is required for beta request fulfillment");
    expect(fulfillmentScript).toContain("Refusing to fulfill beta access requests on Neon production");
    expect(fulfillmentScript).toContain("Refusing to fulfill beta access requests on the Neon migration spike branch");
  });

  it("executes preflight as a read-only request report", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "outpost-beta-request-preflight-test-"));
    const binDir = join(tempDir, "bin");
    const neonLogPath = join(tempDir, "neon-args.log");

    try {
      mkdirSync(binDir);
      const fakeNeon = join(binDir, "neon");
      writeFileSync(
        fakeNeon,
        `#!/bin/sh
set -eu
printf '%s\\n' "$@" >> "$OUTPOST_FAKE_NEON_LOG"
sql=''
previous=''
for arg in "$@"; do
  if [ "$previous" = "-c" ]; then
    sql="$arg"
  fi
  previous="$arg"
done

case "$sql" in
  *"from owner_beta_access_requests"*)
    printf '%s\\n' '{"id":"req_123","email":"beta-owner@example.com","owner_name":"Beta Owner","gym_name":"Beta Gym","location_hint":"Front desk","status":"new","request_count":1,"last_requested_at":"2026-06-22T05:00:00Z","fulfilled_at":null,"fulfilled_grant_id":null,"note_present":true,"fulfillment_note_present":false,"grant_id":null,"grant_status":null,"user_id":null,"auth_linked":false,"tenant_id":null,"tenant_name":null,"unexpected_live_provider_records":0}'
    ;;
  *)
    printf '%s\\n' '{}'
    ;;
esac
`,
        "utf8"
      );
      chmodSync(fakeNeon, 0o755);

      const result = spawnSync(process.execPath, ["scripts/preflight-owner-beta-access-request.mjs"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          NEON_API_KEY: "napi_test_operator_key_value_1234567890",
          NEXT_PUBLIC_NEON_AUTH_URL: "https://ep-test.neonauth.us-east-1.aws.neon.tech/neondb/auth",
          NEXT_PUBLIC_NEON_DATA_API_URL: "https://ep-test.apirest.us-east-1.aws.neon.tech/neondb/rest/v1",
          OUTPOST_FAKE_NEON_LOG: neonLogPath,
          OUTPOST_NEON_BRANCH_NAME: "outpost-beta-access-scoped-test",
          OUTPOST_NEON_PROJECT_ID: "outpost-test-project",
          OUTPOST_NEON_SEED_PASSWORD: "rotated-hosted-seed-password",
          OUTPOST_OWNER_BETA_REQUEST_EMAIL: "beta-owner@example.com",
          PATH: `${binDir}:${process.env.PATH}`
        }
      });

      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(result.stdout).toContain("Outpost beta access request preflight");
      expect(result.stdout).toContain("Ready for CLI fulfillment");
      expect(result.stdout).toContain("State: ready");
      expect(result.stdout).toContain("Dry-run complete; no hosted rows were written.");
      expect(result.stdout).toContain("npm run beta:operator:request-fulfillment");
      expect(result.stdout).not.toMatch(/temporary-owner-password|napi_test_operator_key|token|cookie|service_role/iu);

      const neonArgs = readFileSync(neonLogPath, "utf8");
      expect(neonArgs).toMatch(/--\n-t\n-A\n-c\n/u);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("returns a blocked preflight exit for archived requests without running provisioning", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "outpost-beta-request-preflight-blocked-test-"));
    const binDir = join(tempDir, "bin");
    const neonLogPath = join(tempDir, "neon-args.log");

    try {
      mkdirSync(binDir);
      const fakeNeon = join(binDir, "neon");
      writeFileSync(
        fakeNeon,
        `#!/bin/sh
set -eu
printf '%s\\n' "$@" >> "$OUTPOST_FAKE_NEON_LOG"
printf '%s\\n' '{"id":"req_123","email":"beta-owner@example.com","owner_name":"Beta Owner","gym_name":"Beta Gym","location_hint":"Front desk","status":"superseded","request_count":1,"last_requested_at":"2026-06-22T05:00:00Z","fulfilled_at":null,"fulfilled_grant_id":null,"note_present":true,"fulfillment_note_present":false,"grant_id":null,"grant_status":null,"user_id":null,"auth_linked":false,"tenant_id":null,"tenant_name":null,"unexpected_live_provider_records":0}'
`,
        "utf8"
      );
      chmodSync(fakeNeon, 0o755);

      const result = spawnSync(process.execPath, ["scripts/preflight-owner-beta-access-request.mjs"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          NEON_API_KEY: "napi_test_operator_key_value_1234567890",
          NEXT_PUBLIC_NEON_AUTH_URL: "https://ep-test.neonauth.us-east-1.aws.neon.tech/neondb/auth",
          NEXT_PUBLIC_NEON_DATA_API_URL: "https://ep-test.apirest.us-east-1.aws.neon.tech/neondb/rest/v1",
          OUTPOST_FAKE_NEON_LOG: neonLogPath,
          OUTPOST_NEON_BRANCH_NAME: "outpost-beta-access-scoped-test",
          OUTPOST_NEON_PROJECT_ID: "outpost-test-project",
          OUTPOST_NEON_SEED_PASSWORD: "rotated-hosted-seed-password",
          OUTPOST_OWNER_BETA_REQUEST_EMAIL: "beta-owner@example.com",
          PATH: `${binDir}:${process.env.PATH}`
        }
      });

      expect(result.status).toBe(2);
      expect(result.stdout).toContain("Preflight blocked");
      expect(result.stdout).toContain("Request is superseded");
      expect(result.stdout).toContain("Dry-run complete; no hosted rows were written.");
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("loads one queued request and delegates provisioning to the existing owner-access script", () => {
    expect(fulfillmentScript).toContain("from owner_beta_access_requests");
    expect(fulfillmentScript).toContain("where email = ${sqlLiteral(REQUEST_EMAIL)}::citext");
    expect(fulfillmentScript).toContain('spawnSync("node", ["scripts/provision-owner-beta-access.mjs"]');
    expect(fulfillmentScript).toContain("OUTPOST_OWNER_BETA_EMAIL: request.email");
    expect(fulfillmentScript).toContain("OUTPOST_OWNER_BETA_NAME: request.owner_name");
    expect(ownerAccessScript).toContain("assertGrantIsCallerScoped");
    expect(ownerAccessScript).toContain("assertLiveProvidersBlocked");
  });

  it("records only secret-free fulfillment metadata after provisioning succeeds", () => {
    expect(fulfillmentMigration).toContain("fulfilled_at timestamptz");
    expect(fulfillmentMigration).toContain("fulfilled_grant_id text references owner_beta_access_grants(id)");
    expect(fulfillmentMigration).toContain("fulfillment_note text not null default ''");
    expect(fulfillmentMigration).toContain("owner_beta_access_requests_fulfillment_state");
    expect(fulfillmentMigration).toContain("owner_beta_access_requests_fulfillment_note_no_secret");
    expect(fulfillmentMigration).toContain("preserve_fulfilled_owner_beta_access_request_details");
    expect(fulfillmentMigration).toContain("new.gym_name := old.gym_name");
    expect(fulfillmentScript).toContain("set status = 'reviewing'");
    expect(fulfillmentScript).toContain('runNeonPsql(["-t", "-A", "-q", "-v", "ON_ERROR_STOP=1", "-f", scriptPath])');
    expect(fulfillmentScript).toContain("Unable to mark beta access request reviewing");
    expect(fulfillmentScript).toContain("set status = 'approved'");
    expect(fulfillmentScript).toContain("fulfilled_at = now()");
    expect(fulfillmentScript).toContain("fulfilled_grant_id = (select id from target_grant)");
    expect(fulfillmentScript).toContain("Unable to link the fulfilled request to an active owner beta access grant");
  });

  it("keeps support web UI read-only and preserves no-live-provider gates", () => {
    expect(fulfillmentScript).toContain("No owner beta access request found");
    expect(fulfillmentScript).toContain("Refusing to fulfill a declined beta access request");
    expect(fulfillmentScript).toContain("Refusing to fulfill a superseded beta access request");
    expect(fulfillmentScript).toContain("This beta access request is already fulfilled");
    expect(fulfillmentScript).not.toMatch(/send.*invite|invite.*send|email.*delivery/iu);
    expect(fulfillmentScript).not.toMatch(/provider_connections\s+set|insert\s+into\s+provider_connections|member_ledger/iu);
    expect(runbook).toContain("Fulfill A Queued Request");
    expect(runbook).toContain("does not send invites");
    expect(runbook).toContain("web approval button");
    expect(runbook).toContain("enable live providers");
  });

  it("executes fulfillment with raw psql script output after provisioning", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "outpost-beta-request-fulfillment-test-"));
    const binDir = join(tempDir, "bin");
    const neonLogPath = join(tempDir, "neon-args.log");
    const nodeLogPath = join(tempDir, "node-args.log");

    try {
      mkdirSync(binDir);
      const fakeNeon = join(binDir, "neon");
      writeFileSync(
        fakeNeon,
        `#!/bin/sh
set -eu
printf '%s\\n' "$@" >> "$OUTPOST_FAKE_NEON_LOG"
sql=''
previous=''
for arg in "$@"; do
  if [ "$previous" = "-c" ]; then
    sql="$arg"
  fi
  if [ "$previous" = "-f" ]; then
    sql="$(cat "$arg")"
  fi
  previous="$arg"
done

case "$sql" in
  *"from owner_beta_access_requests"*)
    printf '%s\\n' '{"id":"req_123","email":"beta-owner@example.com","owner_name":"Beta Owner","gym_name":"Beta Gym","location_hint":"Front desk","status":"new","request_count":1,"fulfilled_at":null,"fulfilled_grant_id":null}'
    ;;
  *"set status = 'reviewing'"*)
    printf '%s\\n' '{"id":"req_123"}'
    ;;
  *"fulfilled_at = now()"*)
    printf '%s\\n' '{"id":"req_123","email":"beta-owner@example.com","status":"approved","fulfilled_at":"2026-06-22T05:00:00Z","fulfilled_grant_id":"grant_123"}'
    ;;
  *)
    printf '%s\\n' '{}'
    ;;
esac
`,
        "utf8"
      );
      chmodSync(fakeNeon, 0o755);

      const fakeNode = join(binDir, "node");
      writeFileSync(
        fakeNode,
        `#!/bin/sh
set -eu
printf '%s\\n' "$@" >> "$OUTPOST_FAKE_NODE_LOG"
printf '%s\\n' 'Fake owner beta access provisioned'
`,
        "utf8"
      );
      chmodSync(fakeNode, 0o755);

      const result = spawnSync(process.execPath, ["scripts/fulfill-owner-beta-access-request.mjs"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          NEON_API_KEY: "napi_test_operator_key_value_1234567890",
          NEXT_PUBLIC_NEON_AUTH_URL: "https://ep-test.neonauth.us-east-1.aws.neon.tech/neondb/auth",
          NEXT_PUBLIC_NEON_DATA_API_URL: "https://ep-test.apirest.us-east-1.aws.neon.tech/neondb/rest/v1",
          OUTPOST_FAKE_NEON_LOG: neonLogPath,
          OUTPOST_FAKE_NODE_LOG: nodeLogPath,
          OUTPOST_NEON_BRANCH_NAME: "outpost-beta-access-scoped-test",
          OUTPOST_NEON_PROJECT_ID: "outpost-test-project",
          OUTPOST_NEON_SEED_PASSWORD: "rotated-hosted-seed-password",
          OUTPOST_OWNER_BETA_PASSWORD: "temporary-owner-password-123",
          OUTPOST_OWNER_BETA_REQUEST_EMAIL: "beta-owner@example.com",
          PATH: `${binDir}:${process.env.PATH}`
        }
      });

      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(result.stdout).toContain("Request marked reviewing.");
      expect(result.stdout).toContain("Fake owner beta access provisioned");
      expect(result.stdout).toContain("Grant linkage recorded without exposing temporary credentials.");

      const neonArgs = readFileSync(neonLogPath, "utf8");
      expect(neonArgs).toMatch(/--\n-t\n-A\n-c\n/u);
      expect(neonArgs).toMatch(/--\n-t\n-A\n-q\n-v\nON_ERROR_STOP=1\n-f\n/u);
      expect(readFileSync(nodeLogPath, "utf8")).toContain("scripts/provision-owner-beta-access.mjs");
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("refuses runtime fulfillment on the Neon production branch before provisioning", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "outpost-beta-request-production-guard-test-"));
    const binDir = join(tempDir, "bin");
    const nodeLogPath = join(tempDir, "node-args.log");

    try {
      mkdirSync(binDir);
      const fakeNode = join(binDir, "node");
      writeFileSync(
        fakeNode,
        `#!/bin/sh
set -eu
printf '%s\\n' "$@" >> "$OUTPOST_FAKE_NODE_LOG"
printf '%s\\n' 'Fake owner beta access provisioned'
`,
        "utf8"
      );
      chmodSync(fakeNode, 0o755);

      const result = spawnSync(process.execPath, ["scripts/fulfill-owner-beta-access-request.mjs"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          NEON_API_KEY: "napi_test_operator_key_value_1234567890",
          NEXT_PUBLIC_NEON_AUTH_URL: "https://ep-test.neonauth.us-east-1.aws.neon.tech/neondb/auth",
          NEXT_PUBLIC_NEON_DATA_API_URL: "https://ep-test.apirest.us-east-1.aws.neon.tech/neondb/rest/v1",
          OUTPOST_FAKE_NODE_LOG: nodeLogPath,
          OUTPOST_NEON_BRANCH_NAME: "production",
          OUTPOST_NEON_PROJECT_ID: "outpost-test-project",
          OUTPOST_NEON_SEED_PASSWORD: "rotated-hosted-seed-password",
          OUTPOST_OWNER_BETA_PASSWORD: "temporary-owner-password-123",
          OUTPOST_OWNER_BETA_REQUEST_EMAIL: "beta-owner@example.com",
          PATH: `${binDir}:${process.env.PATH}`
        }
      });

      expect(result.status).not.toBe(0);
      expect(`${result.stderr}\n${result.stdout}`).toContain("Refusing to fulfill beta access requests on Neon production");

      expect(() => readFileSync(nodeLogPath, "utf8")).toThrow();
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});
