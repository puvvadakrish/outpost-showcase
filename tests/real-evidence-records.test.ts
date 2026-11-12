import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { readMigrationSource } from "./helpers/migration-source";

const migration = readFileSync("neon/migrations/20260707020000_real_evidence_records.sql", "utf8");
const schema = readMigrationSource();
const packageJson = readFileSync("package.json", "utf8");
const recordScript = readFileSync("scripts/record-real-evidence-record.mjs", "utf8");
const inspectScript = readFileSync("scripts/inspect-real-evidence-record.mjs", "utf8");
const repoRoot = process.cwd();

let tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("real evidence records", () => {
  it("adds one generic append-only evidence table with founder-admin projection", () => {
    expect(migration).toContain("create table real_evidence_records");
    expect(migration).toContain("artifact_sha256 text not null unique");
    expect(migration).toContain("parent_sha256 text check");
    expect(migration).toContain("payload jsonb not null default '{}'::jsonb");
    expect(migration).toContain("alter table real_evidence_records enable row level security");
    expect(migration).toContain("revoke all on real_evidence_records from public, anonymous, authenticated");
    expect(migration).toContain("create trigger real_evidence_records_append_only");
    expect(migration).toContain("prevent_real_evidence_record_mutation");
    expect(migration).toContain("create or replace function list_real_evidence_records()");
    expect(migration).toContain("grant execute on function list_real_evidence_records() to authenticated");
    expect(schema).toContain("create table real_evidence_records");
    expect(schema).not.toContain("create table hosted_rehearsal_evidence_records");
    expect(schema).not.toContain("create table retell_evidence_records");
  });

  it("keeps launch, delivery, provider, and member-system gates forced false", () => {
    for (const key of [
      "public_self_serve_launch_allowed",
      "invite_delivery_allowed",
      "live_provider_enablement_allowed",
      "billing_pos_member_writes_allowed"
    ]) {
      expect(migration).toContain(`${key} boolean not null default false`);
      expect(inspectScript).toContain(`assertFalse(artifact, "${key}")`);
    }
    expect(migration).toContain("constraint real_evidence_records_blocked_gates");
  });

  it("guards evidence payloads and script output against secret-shaped data", () => {
    expect(migration).toContain("real_evidence_records_no_secret_payload");
    expect(recordScript).toContain("assertNoSecretShapedValue(output");
    expect(inspectScript).toContain("assertNoSecretShapedKeys");
    expect(inspectScript).toContain("must be under artifacts/");
  });

  it("adds npm aliases without adding readiness-chain control artifacts", () => {
    expect(packageJson).toContain('"real-evidence:record": "node scripts/record-real-evidence-record.mjs"');
    expect(packageJson).toContain('"real-evidence:inspect": "node scripts/inspect-real-evidence-record.mjs"');
    expect(packageJson).not.toContain("real-evidence:prepare");
    expect(packageJson).not.toContain("real-evidence:coordinator");
  });

  it("inspects a sanitized artifact and computes its metadata", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "outpost-real-evidence-test-"));
    tempDirs.push(tempDir);
    const artifactDir = join(tempDir, "artifacts", "real-evidence");
    mkdirSync(artifactDir, { recursive: true });
    const artifactPath = join(artifactDir, "record.json");
    writeFileSync(
      artifactPath,
      JSON.stringify(
        {
          artifact_kind: "protected_preview_hosted_rehearsal",
          status: "real_evidence_recorded",
          parent_sha256: "a".repeat(64),
          public_self_serve_launch_allowed: false,
          invite_delivery_allowed: false,
          live_provider_enablement_allowed: false,
          billing_pos_member_writes_allowed: false,
          summary: {
            observed: true
          }
        },
        null,
        2
      ),
      "utf8"
    );

    const result = spawnSync("node", [join(repoRoot, "scripts/inspect-real-evidence-record.mjs")], {
      cwd: tempDir,
      encoding: "utf8",
      env: {
        ...process.env,
        OUTPOST_REAL_EVIDENCE_RECORD_PATH: "artifacts/real-evidence/record.json"
      }
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Real evidence record inspection passed");
    expect(result.stdout).toContain("Kind: protected_preview_hosted_rehearsal");
    expect(result.stdout).toMatch(/SHA256: [a-f0-9]{64}/u);
  });
});
