#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, isAbsolute, relative, resolve, sep } from "node:path";

import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const RECORD_PATH =
  process.env.OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH ??
  "artifacts/admin-launch-readiness/admin-customer-observed-session-record.json";
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
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(
      text,
    ) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)\s*[:=]/iu.test(
      text,
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoSecretShapedKeys(entry, `${label}[${index}]`),
    );
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, entry] of Object.entries(value)) {
    invariant(
      !/(password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)/iu.test(
        key,
      ),
      `${label} contains secret-shaped key ${key}.`,
    );
    assertNoSecretShapedKeys(entry, `${label}.${key}`);
  }
}

function normalizeArtifactPath(rawPath, label) {
  const value = String(rawPath ?? "").trim();
  invariant(value, `${label} required.`);
  assertNoSecretShapedValue(value, label);
  invariant(!isAbsolute(value), `${label} must be relative.`);
  invariant(value.endsWith(".json"), `${label} must end with .json.`);

  const root = resolve(process.cwd(), "artifacts");
  const resolved = resolve(process.cwd(), value);
  const relativePath = relative(process.cwd(), resolved);
  const relativeToRoot = relative(root, resolved);
  invariant(
    relativeToRoot &&
      !relativeToRoot.startsWith("..") &&
      !relativeToRoot.split(sep).includes(".."),
    `${label} must stay under artifacts/.`,
  );
  invariant(relativePath === value, `${label} must be normalized.`);
  invariant(existsSync(resolved), `${label} does not exist.`);
  return { relativePath, resolved };
}

function readJsonArtifact(path, label) {
  const raw = readFileSync(path, "utf8");
  assertNoSecretShapedValue(raw, label);
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, label);
  return {
    artifact,
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
}

function normalizePreviewOrigin(rawUrl, label) {
  invariant(typeof rawUrl === "string" && rawUrl.trim(), `${label} required.`);
  assertNoSecretShapedValue(rawUrl, label);
  const url = new URL(rawUrl);
  invariant(url.protocol === "https:", `${label} must use https.`);
  invariant(
    url.hostname.endsWith(".vercel.app"),
    `${label} must be a Vercel Preview origin.`,
  );
  invariant(
    !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname),
    `${label} must not be local.`,
  );
  invariant(
    !url.username && !url.password,
    `${label} must not include credentials.`,
  );
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/u, "");
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonSqlLiteral(value) {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function runCommand(command, label, env = {}) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assertNoSecretShapedValue(output, label);
  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${output}`);
  }
  return result.stdout;
}

function runCustomerSessionInspect(recordPath) {
  return runCommand(
    ["node", "scripts/inspect-admin-customer-observed-session.mjs"],
    "Admin customer session record inspection",
    { OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH: recordPath },
  );
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
    "Neon admin customer session hosted record",
  );
}

function runPsqlScript(config, sql) {
  const tempDir = mkdtempSync(
    join(tmpdir(), "outpost-admin-customer-session-record-"),
  );
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

function assertRecordArtifact(artifact) {
  invariant(
    artifact.artifact_kind === "admin_customer_observed_session_record",
    "Customer session artifact kind mismatch.",
  );
  invariant(
    artifact.status === "admin_customer_observed_session_recorded",
    "Customer session artifact status mismatch.",
  );
  invariant(
    artifact.customer_observed_session_recorded === true,
    "Customer session must be recorded.",
  );
  invariant(
    artifact.customer_observed_handoff_claimed === true,
    "Customer handoff claim must be explicit.",
  );
  invariant(
    artifact.public_self_serve_launch_allowed === false,
    "Public self-serve must remain blocked.",
  );
  invariant(
    artifact.invite_delivery_allowed === false,
    "Invite delivery must remain blocked.",
  );
  invariant(
    artifact.live_provider_enablement_allowed === false,
    "Live providers must remain blocked.",
  );
  invariant(
    artifact.billing_pos_member_writes_allowed === false,
    "Billing/POS/member writes must remain blocked.",
  );
  invariant(
    /^[a-f0-9]{64}$/u.test(
      String(artifact.handoff_scheduling_packet_sha256 ?? ""),
    ),
    "Scheduling packet SHA256 missing.",
  );
  invariant(artifact.gym_name, "Gym name required.");
  invariant(artifact.owner_email, "Owner email required.");
  invariant(artifact.operator_label, "Operator label required.");
}

function insertRecord(config, record) {
  return runPsqlScript(
    config,
    `
\\set ON_ERROR_STOP on
insert into admin_customer_session_records (
  id,
  status,
  app_origin,
  neon_branch_name,
  gym_name,
  owner_email,
  owner_label,
  operator_label,
  session_record_path,
  session_record_sha256,
  handoff_scheduling_packet_sha256,
  customer_observed_session_recorded,
  customer_observed_handoff_claimed,
  public_self_serve_launch_allowed,
  invite_delivery_allowed,
  live_provider_enablement_allowed,
  billing_pos_member_writes_allowed,
  observed_checks,
  summary,
  recorded_at
) values (
  ${sqlLiteral(record.id)},
  'admin_customer_session_record_imported',
  ${sqlLiteral(record.appOrigin)},
  ${sqlLiteral(record.neonBranchName)},
  ${sqlLiteral(record.gymName)},
  ${sqlLiteral(record.ownerEmail)},
  ${sqlLiteral(record.ownerLabel)},
  ${sqlLiteral(record.operatorLabel)},
  ${sqlLiteral(record.sessionRecordPath)},
  ${sqlLiteral(record.sessionRecordSha256)},
  ${sqlLiteral(record.handoffSchedulingPacketSha256)},
  true,
  true,
  false,
  false,
  false,
  false,
  ${jsonSqlLiteral(record.observedChecks)},
  ${jsonSqlLiteral(record.summary)},
  now()
)
on conflict (session_record_sha256) do nothing
returning id;
`,
  );
}

function main() {
  const config = readHostedReadinessConfig();
  const appOrigin = normalizePreviewOrigin(
    process.env.NEXT_PUBLIC_OUTPOST_APP_URL,
    "NEXT_PUBLIC_OUTPOST_APP_URL",
  );
  const artifactPath = normalizeArtifactPath(
    RECORD_PATH,
    "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
  );

  runCustomerSessionInspect(artifactPath.relativePath);
  const { artifact, sha256 } = readJsonArtifact(
    artifactPath.resolved,
    "admin customer session record",
  );
  assertRecordArtifact(artifact);

  const record = {
    appOrigin,
    gymName: artifact.gym_name,
    handoffSchedulingPacketSha256: artifact.handoff_scheduling_packet_sha256,
    id: `admin_customer_session_${sha256.slice(0, 16)}`,
    neonBranchName: config.branchName,
    observedChecks: artifact.observed,
    operatorLabel: artifact.operator_label,
    ownerEmail: artifact.owner_email,
    ownerLabel: artifact.owner_label ?? "",
    sessionRecordPath: artifactPath.relativePath,
    sessionRecordSha256: sha256,
    summary: {
      evidence_basis: artifact.evidence_basis,
      scheduling_operator_label: artifact.scheduling_operator_label ?? "",
      still_blocked: [
        "public_self_serve",
        "invite_delivery",
        "live_providers",
        "billing_pos_member_writes",
      ],
    },
  };

  assertNoSecretShapedKeys(record, "admin customer session hosted record");
  const insertedId = insertRecord(config, record);
  console.log("Admin customer session hosted record import");
  console.log(`Artifact: ${record.sessionRecordPath}`);
  console.log(`Artifact SHA256: ${record.sessionRecordSha256}`);
  console.log(
    insertedId
      ? `Inserted: ${insertedId}`
      : "Already recorded: customer session digest",
  );
  console.log(
    "Public self-serve, invite delivery, providers, billing/POS/member writes remain blocked.",
  );
}

main();
