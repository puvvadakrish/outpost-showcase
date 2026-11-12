#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

const SUMMARY_PATH =
  process.env.OUTPOST_BETA_PROOF_RUN_SUMMARY_PATH ??
  "artifacts/admin-launch-readiness/beta-proof-run-summary.json";
const ROLE_NAME = process.env.OUTPOST_NEON_ROLE_NAME ?? "neondb_owner";

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
      text
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretShapedKeys(item, label, [...trail, String(index)]));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    invariant(
      !/(password|token|cookie|apikey|authorization|credential|privatekey|secret|bypass|signature|jwt)/u.test(
        normalizedKey
      ),
      `${label} contains secret-shaped key ${[...trail, key].join(".")}.`
    );
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function readJsonArtifact(path, label) {
  const resolvedPath = resolve(path);
  invariant(existsSync(resolvedPath), `${label} not found at ${path}.`);
  const raw = readFileSync(resolvedPath, "utf8");
  assertNoSecretShapedValue(raw, label);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
  assertNoSecretShapedKeys(parsed, label);
  return { parsed, raw, resolvedPath, sha256: sha256(raw) };
}

function assertRepoRelativePath(rawPath, label) {
  invariant(typeof rawPath === "string" && rawPath.trim(), `${label} path is required.`);
  assertNoSecretShapedValue(rawPath, `${label} path`);
  invariant(!isAbsolute(rawPath), `${label} path must be repo-relative.`);
  const resolved = resolve(rawPath);
  const repoRoot = `${process.cwd()}${sep}`;
  invariant(
    resolved === process.cwd() || resolved.startsWith(repoRoot),
    `${label} path must stay inside repository.`
  );
  return relative(process.cwd(), resolved);
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} must include ${expected}.`);
}

function normalizePreviewOrigin(rawUrl, label) {
  invariant(typeof rawUrl === "string" && rawUrl.trim(), `${label} is required.`);
  assertNoSecretShapedValue(rawUrl, label);
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`${label} is not a valid URL.`);
  }
  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  invariant(url.protocol === "https:", `${label} must use https.`);
  invariant(url.hostname.endsWith(".vercel.app"), `${label} must be a Vercel Preview origin.`);
  invariant(!localHosts.has(url.hostname), `${label} must not be local.`);
  invariant(!url.username && !url.password, `${label} must not include embedded credentials.`);
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/u, "");
}

function verifySourceArtifact(proof, label) {
  invariant(proof && typeof proof === "object", `${label} metadata is required.`);
  const artifactPath = assertRepoRelativePath(proof.artifact_path, label);
  invariant(typeof proof.artifact_sha256 === "string", `${label} artifact hash is required.`);
  invariant(/^[a-f0-9]{64}$/u.test(proof.artifact_sha256), `${label} artifact hash must be sha256.`);
  const source = readJsonArtifact(artifactPath, label);
  invariant(source.sha256 === proof.artifact_sha256, `${label} artifact hash mismatch.`);
  return { path: artifactPath, sha256: source.sha256 };
}

function validateSummary(summary, config) {
  invariant(
    summary.summary_kind === "hosted_beta_request_proof_run_summary",
    "summary kind must be hosted beta request proof run summary."
  );
  invariant(summary.ready_for_next_slice === true, "summary must be ready for next slice.");
  const appOrigin = normalizePreviewOrigin(summary.app_origin, "summary Preview origin");
  const configuredOrigin = process.env.NEXT_PUBLIC_OUTPOST_APP_URL
    ? normalizePreviewOrigin(process.env.NEXT_PUBLIC_OUTPOST_APP_URL, "configured Preview origin")
    : appOrigin;
  invariant(appOrigin === configuredOrigin, "summary Preview origin must match NEXT_PUBLIC_OUTPOST_APP_URL when set.");
  invariant(summary.neon_branch_name === config.branchName, "summary Neon branch must match OUTPOST_NEON_BRANCH_NAME.");
  invariant(config.branchName !== "production", "Refusing to record hosted proof-run summary against production branch.");
  invariant(config.branchName !== "outpost-neon-spike", "Refusing to record hosted proof-run summary against spike branch.");
  invariant(summary.proofs?.browser_request?.status === "passed", "browser request proof must pass.");
  invariant(summary.proofs?.request_chain?.status === "passed", "request-chain proof must pass.");
  invariant(
    summary.cleanup?.browser_request === "cleanup_requested" || summary.cleanup?.browser_request === "retained",
    "browser request cleanup status is required."
  );
  invariant(
    summary.cleanup?.request_chain === "cleanup_requested" || summary.cleanup?.request_chain === "retained",
    "request-chain cleanup status is required."
  );
  assertIncludes(summary.blocked_gates, "Public self-serve launch", "blocked gates");
  assertIncludes(summary.blocked_gates, "Browser approval buttons", "blocked gates");
  assertIncludes(summary.blocked_gates, "Invite delivery", "blocked gates");
  assertIncludes(summary.blocked_gates, "Notification sending", "blocked gates");
  assertIncludes(summary.blocked_gates, "Phone/email providers", "blocked gates");
  assertIncludes(summary.blocked_gates, "Billing", "blocked gates");
  assertIncludes(summary.blocked_gates, "POS/access control/member-ledger writes", "blocked gates");

  return {
    appOrigin,
    browser: verifySourceArtifact(summary.proofs.browser_request, "browser request proof"),
    browserCleanup: summary.cleanup.browser_request,
    chain: verifySourceArtifact(summary.proofs.request_chain, "request-chain proof"),
    chainCleanup: summary.cleanup.request_chain
  };
}

function runNeonPsql(config, args, label) {
  const result = spawnSync(
    "neon",
    withNeonApiKey([
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
      ...args
    ]),
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${result.stderr || result.stdout}`);
  }

  return result.stdout;
}

function insertRecord(config, record) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-beta-proof-run-record-"));
  const sqlPath = join(tempDir, "record.sql");

  try {
    writeFileSync(
      sqlPath,
      `
\\set ON_ERROR_STOP on

insert into hosted_beta_proof_run_summary_records (
  id,
  status,
  app_origin,
  neon_branch_name,
  summary_sha256,
  browser_artifact_sha256,
  chain_artifact_sha256,
  browser_cleanup,
  chain_cleanup,
  public_self_serve_launch_allowed,
  live_provider_enablement_allowed,
  recorded_at
) values (
  ${sqlLiteral(record.id)},
  'hosted_beta_proof_run_summary_recorded',
  ${sqlLiteral(record.appOrigin)},
  ${sqlLiteral(record.neonBranchName)},
  ${sqlLiteral(record.summarySha256)},
  ${sqlLiteral(record.browserArtifactSha256)},
  ${sqlLiteral(record.chainArtifactSha256)},
  ${sqlLiteral(record.browserCleanup)},
  ${sqlLiteral(record.chainCleanup)},
  false,
  false,
  now()
)
on conflict (summary_sha256) do nothing
returning id;
`,
      "utf8"
    );

    const output = runNeonPsql(
      config,
      ["-t", "-A", "-f", sqlPath],
      "Neon hosted beta proof-run summary record import"
    );
    return output.includes(record.id);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function main() {
  const config = readHostedReadinessConfig();
  const summaryArtifact = readJsonArtifact(SUMMARY_PATH, "hosted beta proof-run summary");
  const summary = summaryArtifact.parsed;
  const validated = validateSummary(summary, config);
  const record = {
    appOrigin: validated.appOrigin,
    browserArtifactSha256: validated.browser.sha256,
    browserCleanup: validated.browserCleanup,
    chainArtifactSha256: validated.chain.sha256,
    chainCleanup: validated.chainCleanup,
    id: `hosted_beta_proof_run_summary_${summaryArtifact.sha256.slice(0, 32)}`,
    neonBranchName: config.branchName,
    summarySha256: summaryArtifact.sha256
  };

  const inserted = insertRecord(config, record);

  console.log(inserted ? "Hosted beta proof-run summary recorded." : "Hosted beta proof-run summary already recorded.");
  console.log(`Preview: ${record.appOrigin}`);
  console.log(`Branch: ${record.neonBranchName}`);
  console.log(`Summary: ${record.summarySha256.slice(0, 16)}`);
  console.log(`Browser proof: ${record.browserArtifactSha256.slice(0, 16)} (${record.browserCleanup})`);
  console.log(`Request-chain proof: ${record.chainArtifactSha256.slice(0, 16)} (${record.chainCleanup})`);
  console.log("Public self-serve and live-provider gates: blocked");
}

main();
