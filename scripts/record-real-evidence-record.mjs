#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { inspectRealEvidenceRecord } from "./inspect-real-evidence-record.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoSecretShapedValue(value, label) {
  const text = String(value);
  const secretValue =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(text) ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(text) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(text) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)\s*[:=]/iu.test(
      text,
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonSqlLiteral(value) {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function runCommand(command, label) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assertNoSecretShapedValue(output, label);
  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${output}`);
  }
  return result.stdout;
}

function runNeonPsql(config, args) {
  return runCommand(
    [
      "neon",
      ...withNeonApiKey([
        "connection-string",
        config.branchName,
        "--project-id",
        config.projectId,
        "--database-name",
        config.databaseName,
        "--role-name",
        ROLE_NAME,
        "--psql",
        "--",
        ...args,
      ]),
    ],
    "Neon real evidence record insert",
  );
}

function runPsqlScript(config, sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-real-evidence-record-"));
  const sqlPath = join(tempDir, "record.sql");
  try {
    writeFileSync(sqlPath, sql, "utf8");
    return runNeonPsql(config, [
      "-t",
      "-A",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      sqlPath,
    ]).trim();
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function insertRecord(config, record) {
  return runPsqlScript(
    config,
    `
\\set ON_ERROR_STOP on
insert into real_evidence_records (
  id,
  kind,
  status,
  artifact_path,
  artifact_sha256,
  parent_sha256,
  payload,
  public_self_serve_launch_allowed,
  invite_delivery_allowed,
  live_provider_enablement_allowed,
  billing_pos_member_writes_allowed
) values (
  ${sqlLiteral(`real_evidence_${record.sha256.slice(0, 24)}`)},
  ${sqlLiteral(record.kind)},
  ${sqlLiteral(record.status)},
  ${sqlLiteral(record.path)},
  ${sqlLiteral(record.sha256)},
  ${record.parentSha256 ? sqlLiteral(record.parentSha256) : "null"},
  ${jsonSqlLiteral(record.artifact)},
  false,
  false,
  false,
  false
)
on conflict (artifact_sha256) do nothing
returning id;
`,
  );
}

function main() {
  const config = readHostedReadinessConfig();
  const record = inspectRealEvidenceRecord();
  const insertedId = insertRecord(config, record);
  invariant(insertedId, "Real evidence record already exists or insert returned no id.");
  console.log("Real evidence record inserted");
  console.log(`Record: ${insertedId}`);
  console.log(`Artifact: ${record.path}`);
  console.log(`SHA256: ${record.sha256}`);
}

main();
