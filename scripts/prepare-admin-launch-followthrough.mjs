#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { readHostedReadinessConfig } from "./hosted-preview-readiness-config.mjs";
import { withNeonApiKey } from "./neon-cli-auth.mjs";

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
    for (const item of value) {
      assertNoSecretShapedKeys(item, label, trail);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const path = [...trail, key].join(".");
    const secretKey =
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("cookie") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("credential") ||
      normalizedKey.includes("privatekey") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("bypass") ||
      normalizedKey.includes("signature") ||
      normalizedKey.includes("jwt");

    invariant(!secretKey, `${label} contains secret-shaped key at ${path}.`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function normalizePreviewOrigin(rawUrl, label) {
  invariant(typeof rawUrl === "string" && rawUrl.trim(), `${label} required.`);
  assertNoSecretShapedValue(rawUrl, label);

  const value = rawUrl.trim().startsWith("http") ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be valid URL.`);
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  invariant(url.protocol === "https:", `${label} must use https.`);
  invariant(!localHosts.has(url.hostname), `${label} must not be local.`);
  invariant(url.hostname.endsWith(".vercel.app"), `${label} must be Vercel Preview URL.`);
  invariant(
    url.hostname !== "outpost-preview-20260610.vercel.app" && url.hostname !== "outpost.vercel.app",
    `${label} must not target a production-like Vercel origin.`
  );
  invariant(!url.username && !url.password, `${label} must not include embedded credentials.`);

  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/u, "");
}

function normalizeOutputArtifactPath(rawPath, label) {
  invariant(rawPath?.trim(), `${label} required.`);
  invariant(!rawPath.includes("\0"), `${label} cannot contain null bytes.`);
  assertNoSecretShapedValue(rawPath, label);

  const artifactPath = rawPath.trim();
  const resolvedPath = resolve(artifactPath);
  const repoRelativePath = relative(process.cwd(), resolvedPath);
  const isInsideRepo = repoRelativePath.length > 0 && !repoRelativePath.startsWith("..") && !isAbsolute(repoRelativePath);
  const isIgnoredArtifactPath = repoRelativePath === "artifacts" || repoRelativePath.startsWith(`artifacts${sep}`);

  invariant(!isInsideRepo || isIgnoredArtifactPath, `${label} must live under gitignored artifacts/ when repo-local.`);
  invariant(!existsSync(artifactPath), `${label} already exists at ${artifactPath}. Choose a fresh path.`);
  return artifactPath;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runCommand(command, env, label) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assertNoSecretShapedValue(output, label);
  if (result.status !== 0) {
    throw new Error(`${label} failed.\n${output}`);
  }
  return output.trim();
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
        ...args
      ])
    ],
    {},
    "Neon admin launch follow-through query"
  );
}

function runPsqlJson(config, sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-admin-launch-followthrough-"));
  const scriptPath = join(tempDir, "query.sql");

  try {
    writeFileSync(scriptPath, sql);
    const output = runNeonPsql(config, ["-t", "-A", "-v", "ON_ERROR_STOP=1", "-f", scriptPath]);
    const line = output
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter((value) => value && !value.startsWith("INFO:") && value.startsWith("{"))[0];
    invariant(line, "Neon admin launch follow-through query returned no data.");
    assertNoSecretShapedValue(line, "Neon admin launch follow-through query output");
    return JSON.parse(line);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function followThroughQuery({ appOrigin, branchName }) {
  return `
    with matching_decision as (
      select *
      from admin_launch_decision_records
      where app_origin = ${sqlLiteral(appOrigin)}
        and neon_branch_name = ${sqlLiteral(branchName)}
        and status = 'admin_launch_decision_recorded'
        and decision = 'reviewed_for_next_launch_slice'
        and public_self_serve_launch_allowed = false
        and launch_enablement_allowed = false
      order by recorded_at desc, id desc
      limit 1
    )
    select jsonb_build_object(
      'decision_present', exists (select 1 from matching_decision),
      'decision', (
        select jsonb_build_object(
          'id', id,
          'recorded_at', recorded_at,
          'reviewer_label', reviewer_label,
          'launch_package_record_id', launch_package_record_id,
          'launch_bundle_sha256', launch_bundle_sha256,
          'decision_packet_sha256', decision_packet_sha256
        )
        from matching_decision
      ),
      'public_self_serve_anomaly_count', (
        select count(*)
        from admin_launch_decision_records
        where app_origin = ${sqlLiteral(appOrigin)}
          and neon_branch_name = ${sqlLiteral(branchName)}
          and public_self_serve_launch_allowed = true
      ),
      'unexpected_live_provider_records', (
        select count(*)
        from provider_connections
        where status not in ('not_configured', 'disabled', 'pending_review')
           or secret_ref is not null
           or external_account_label is not null
      )
    )::text;
  `;
}

function buildFollowThroughArtifact({ appOrigin, config, decision }) {
  return {
    status: "admin_launch_followthrough_prepared",
    generated_at: new Date().toISOString(),
    preview_url: appOrigin,
    neon_proof_branch: config.branchName,
    launch_decision_record: decision,
    public_self_serve_launch_allowed: false,
    launch_enablement_allowed: false,
    requires_human_review: true,
    recommended_next_slice: {
      id: "operator_assisted_self_serve_rehearsal",
      title: "Operator-assisted self-serve rehearsal",
      objective:
        "Design and prove the next customer-safe onboarding rehearsal before any public signup or live-provider promotion.",
      scope: [
        "derive checklist from reviewed launch decision evidence",
        "define operator-reviewed public request path",
        "keep owner workspace creation operator-mediated until a later reviewed slice",
        "preserve reset and rollback proof before customer expansion"
      ],
      blocked_until_separate_review: [
        "public owner self-signup",
        "browser approval buttons",
        "invite delivery or notification sending",
        "phone or email provider activation",
        "billing, POS, access control, member-ledger writes"
      ]
    },
    operator_next_steps: [
      "Review this artifact with the latest launch decision packet and record.",
      "Plan the operator-assisted self-serve rehearsal as a separate CE slice.",
      "Do not enable public signup, live providers, billing, POS, access control, or member-ledger writes from this artifact."
    ]
  };
}

function main() {
  const config = readHostedReadinessConfig();
  invariant(config.branchName !== "production", "Refusing launch follow-through against Neon production branch.");
  invariant(config.branchName !== "outpost-neon-spike", "Refusing launch follow-through against migration spike branch.");

  const appOrigin = normalizePreviewOrigin(
    process.env.OUTPOST_VERCEL_DEPLOYMENT_URL || process.env.OUTPOST_ADMIN_LAUNCH_FOLLOWTHROUGH_PREVIEW_URL,
    "OUTPOST_VERCEL_DEPLOYMENT_URL"
  );
  const outputPath = normalizeOutputArtifactPath(
    process.env.OUTPOST_ADMIN_LAUNCH_FOLLOWTHROUGH_PATH,
    "OUTPOST_ADMIN_LAUNCH_FOLLOWTHROUGH_PATH"
  );

  const queryResult = runPsqlJson(config, followThroughQuery({ appOrigin, branchName: config.branchName }));
  invariant(queryResult.decision_present === true, "No reviewed launch decision record exists for this Preview and Neon branch.");
  invariant(
    Number(queryResult.public_self_serve_anomaly_count) === 0,
    "A launch decision record unexpectedly allowed public self-serve for this Preview and branch."
  );
  invariant(
    Number(queryResult.unexpected_live_provider_records) === 0,
    "Hosted provider records unexpectedly include live-provider configuration."
  );

  const artifact = buildFollowThroughArtifact({
    appOrigin,
    config,
    decision: queryResult.decision
  });
  assertNoSecretShapedKeys(artifact, "admin launch follow-through artifact");
  assertNoSecretShapedValue(JSON.stringify(artifact), "admin launch follow-through artifact");

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);

  console.log(`Admin launch follow-through wrote ${outputPath}`);
  console.log(`Preview: ${artifact.preview_url}`);
  console.log(`Neon branch: ${artifact.neon_proof_branch}`);
  console.log(`Decision record: ${artifact.launch_decision_record.id}`);
  console.log(`Recommended next slice: ${artifact.recommended_next_slice.title}`);
  console.log("Public self-serve launch: blocked");
  console.log("Live-provider billing gates: blocked");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
