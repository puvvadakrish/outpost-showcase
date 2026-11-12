#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  invariant(!secretValue, `${label} contains a secret-shaped value.`);
}

function assertEmailShape(value, label) {
  invariant(/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value), `${label} must be an email address.`);
}

function normalizePreviewOrigin(rawOrigin) {
  invariant(rawOrigin?.trim(), "OUTPOST_VERCEL_DEPLOYMENT_URL or NEXT_PUBLIC_OUTPOST_APP_URL is required.");
  assertNoSecretShapedValue(rawOrigin, "hosted launch package Preview URL");

  const value = rawOrigin.trim().startsWith("http") ? rawOrigin.trim() : `https://${rawOrigin.trim()}`;
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Hosted launch package Preview URL must be a valid URL.");
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  invariant(url.protocol === "https:", "Hosted launch package proof must use an HTTPS Vercel Preview URL.");
  invariant(!localHosts.has(url.hostname), "Hosted launch package proof refuses local app origins.");
  invariant(url.hostname.endsWith(".vercel.app"), "Hosted launch package proof must target a Vercel Preview URL.");
  invariant(
    url.hostname !== "outpost-preview-20260610.vercel.app" && url.hostname !== "outpost.vercel.app",
    "Hosted launch package proof refuses production-like Vercel origins."
  );
  invariant(!url.username && !url.password, "Hosted launch package Preview URL must not include credentials.");
  url.pathname = "";
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/u, "");
}

function slugify(value) {
  return (
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
      .slice(0, 80) || "hosted-launch-package"
  );
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runCommand(command, env, label) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env
    },
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
    ["neon", ...withNeonApiKey([
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
    ])],
    {},
    "Neon hosted launch package proof query"
  );
}

function runPsqlJson(config, sql) {
  const tempDir = mkdtempSync(join(tmpdir(), "outpost-hosted-launch-package-proof-"));
  const scriptPath = join(tempDir, "query.sql");

  try {
    writeFileSync(scriptPath, sql);
    const output = runNeonPsql(config, ["-t", "-A", "-v", "ON_ERROR_STOP=1", "-f", scriptPath]);
    const line = output
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter((value) => value && !value.startsWith("INFO:"))[0];
    invariant(line, "Neon hosted launch package proof query returned no data.");
    assertNoSecretShapedValue(line, "Neon hosted launch package proof query output");
    return JSON.parse(line);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function readJson(path, label) {
  invariant(existsSync(path), `${label} was not found at ${path}.`);
  const content = readFileSync(path, "utf8");
  assertNoSecretShapedValue(content, label);
  return JSON.parse(content);
}

function readText(path, label) {
  invariant(existsSync(path), `${label} was not found at ${path}.`);
  const content = readFileSync(path, "utf8");
  assertNoSecretShapedValue(content, label);
  return content;
}

function evidenceQuery(appOrigin, branchName) {
  return `
    with latest_customer_handoff as (
      select *
      from customer_handoff_gate_records
      where app_origin = ${sqlLiteral(appOrigin)}
        and neon_branch_name = ${sqlLiteral(branchName)}
        and status = 'customer_observed_beta_handoff_gate_passed'
      order by recorded_at desc, id desc
      limit 1
    ),
    latest_fulfillment as (
      select *
      from owner_beta_access_fulfillment_receipts
      where neon_branch_name = ${sqlLiteral(branchName)}
        and status = 'recorded'
      order by completed_at desc, id desc
      limit 1
    ),
    rollback_ready_owner as (
      select
        lower(latest_fulfillment.owner_email::text) as owner_email,
        tenants.id as tenant_id,
        tenants.name as tenant_name
      from latest_fulfillment
      join users owner_users
        on lower(owner_users.email::text) = lower(latest_fulfillment.owner_email::text)
      join tenant_memberships owner_memberships
        on owner_memberships.user_id = owner_users.id
       and owner_memberships.role = 'owner'
       and owner_memberships.invite_status = 'active'
      join tenants
        on tenants.id = owner_memberships.tenant_id
      where tenants.id not in ('tenant_acme_fitness', 'tenant_crossfit_north')
        and tenants.name like '% Dry Run %'
        and (
          select count(*)
          from tenant_memberships all_memberships
          where all_memberships.user_id = owner_users.id
        ) = 1
      order by tenants.created_at desc, tenants.id desc
      limit 1
    )
    select jsonb_build_object(
      'preview_proof_ready', exists (
        select 1
        from hosted_proof_runs
        where proof_kind = 'vercel_preview_verify'
          and status = 'passed'
          and app_origin = ${sqlLiteral(appOrigin)}
          and neon_branch_name = ${sqlLiteral(branchName)}
      ),
      'admin_proof_ready', exists (
        select 1
        from hosted_proof_runs
        where proof_kind = 'hosted_founder_admin_readiness'
          and status = 'passed'
          and app_origin = ${sqlLiteral(appOrigin)}
          and neon_branch_name = ${sqlLiteral(branchName)}
      ),
      'customer_handoff_ready', exists (select 1 from latest_customer_handoff),
      'fulfillment_ready', exists (select 1 from latest_fulfillment),
      'rollback_ready', exists (select 1 from rollback_ready_owner),
      'customer_handoff', (
        select jsonb_build_object(
          'gym_name', gym_name,
          'beta_owner_label', beta_owner_label,
          'recorded_at', recorded_at,
          'source_artifact_sha256', source_artifact_sha256
        )
        from latest_customer_handoff
      ),
      'fulfillment', (
        select jsonb_build_object(
          'owner_email', owner_email,
          'completed_at', completed_at
        )
        from latest_fulfillment
      ),
      'rollback', (
        select jsonb_build_object(
          'owner_email', owner_email,
          'tenant_id', tenant_id,
          'tenant_name', tenant_name
        )
        from rollback_ready_owner
      )
    )::text;
  `;
}

function launchPackageQuery(appOrigin, branchName, launchBundlePath, ownerMessagePath) {
  const launchBundleSha256 = createHash("sha256").update(readText(launchBundlePath, "admin launch package bundle")).digest("hex");
  const ownerMessageSha256 = createHash("sha256").update(readText(ownerMessagePath, "admin launch package owner message")).digest("hex");

  return {
    launchBundleSha256,
    ownerMessageSha256,
    sql: `
      select jsonb_build_object(
        'record_present', exists (
          select 1
          from admin_launch_package_records
          where app_origin = ${sqlLiteral(appOrigin)}
            and neon_branch_name = ${sqlLiteral(branchName)}
            and launch_bundle_sha256 = ${sqlLiteral(launchBundleSha256)}
            and owner_message_sha256 = ${sqlLiteral(ownerMessageSha256)}
            and customer_handoff_recorded = true
            and public_self_serve_launch_allowed = false
        ),
        'matching_record_count', (
          select count(*)
          from admin_launch_package_records
          where app_origin = ${sqlLiteral(appOrigin)}
            and neon_branch_name = ${sqlLiteral(branchName)}
            and customer_handoff_recorded = true
            and public_self_serve_launch_allowed = false
        )
      )::text;
    `
  };
}

function assertEvidenceReady(evidence) {
  const missing = [];

  if (!evidence.preview_proof_ready) {
    missing.push("matching protected Preview proof run");
  }

  if (!evidence.admin_proof_ready) {
    missing.push("matching admin portal proof run");
  }

  if (!evidence.customer_handoff_ready) {
    missing.push("matching customer-observed handoff gate record");
  }

  if (!evidence.fulfillment_ready) {
    missing.push("owner beta access fulfillment receipt");
  }

  if (!evidence.rollback_ready) {
    missing.push("rollback-ready disposable owner workspace");
  }

  invariant(
    missing.length === 0,
    `Hosted launch package record proof is blocked: missing ${missing.join(", ")}.`
  );
}

async function main() {
  const config = readHostedReadinessConfig();
  invariant(config.branchName !== "production", "Refusing hosted launch package proof against the Neon production branch.");
  invariant(config.branchName !== "outpost-neon-spike", "Refusing hosted launch package proof against the migration spike branch.");
  const appOrigin = normalizePreviewOrigin(process.env.OUTPOST_VERCEL_DEPLOYMENT_URL ?? process.env.NEXT_PUBLIC_OUTPOST_APP_URL);
  const artifactSlug = slugify(config.branchName);
  const artifactBase = process.env.OUTPOST_HOSTED_LAUNCH_PACKAGE_PROOF_DIR?.trim() || `artifacts/admin-launch-readiness/${artifactSlug}`;
  assertNoSecretShapedValue(artifactBase, "OUTPOST_HOSTED_LAUNCH_PACKAGE_PROOF_DIR");

  const launchBundlePath =
    process.env.OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH?.trim() || `${artifactBase}-launch-bundle.json`;
  const ownerHandoffBundlePath =
    process.env.OUTPOST_BETA_HANDOFF_BUNDLE_PATH?.trim() || `${artifactBase}-owner-handoff-bundle.json`;
  const ownerMessagePath =
    process.env.OUTPOST_BETA_HANDOFF_MESSAGE_PATH?.trim() || `${artifactBase}-owner-message.md`;

  console.log("Outpost hosted launch package record proof");
  console.log(`Preview: ${appOrigin}`);
  console.log(`Neon branch: ${config.branchName}`);
  console.log("Mode: verify existing customer-observed proof, generate artifacts, import package record\n");

  console.log(runCommand(["npm", "run", "hosted:readiness"], {}, "hosted readiness"));
  console.log(runCommand(["npm", "run", "hosted:admin-portal-readiness"], {}, "hosted admin portal readiness"));

  const evidence = runPsqlJson(config, evidenceQuery(appOrigin, config.branchName));
  assertNoSecretShapedValue(JSON.stringify(evidence), "hosted launch package evidence");
  assertEvidenceReady(evidence);

  const gymName = String(evidence.customer_handoff?.gym_name ?? "");
  const ownerEmail = String(evidence.fulfillment?.owner_email ?? "");
  invariant(gymName, "Customer-observed handoff record did not include a gym name.");
  invariant(ownerEmail, "Fulfillment receipt did not include an owner email.");
  assertEmailShape(ownerEmail, "Fulfillment receipt owner email");
  invariant(
    String(evidence.rollback?.owner_email ?? "").toLowerCase() === ownerEmail.toLowerCase(),
    "Rollback-ready owner workspace did not match the fulfilled owner email."
  );

  console.log(
    runCommand(
      ["npm", "run", "hosted:owner-handoff:prepare"],
      {
        OUTPOST_BETA_HANDOFF_BUNDLE_PATH: ownerHandoffBundlePath,
        OUTPOST_BETA_HANDOFF_GYM_NAME: gymName,
        OUTPOST_BETA_HANDOFF_OWNER_EMAIL: ownerEmail,
        OUTPOST_VERCEL_DEPLOYMENT_URL: appOrigin
      },
      "hosted owner handoff preparation"
    )
  );
  console.log(
    runCommand(
      ["npm", "run", "beta:owner-handoff:message"],
      {
        OUTPOST_BETA_HANDOFF_BUNDLE_PATH: ownerHandoffBundlePath,
        OUTPOST_BETA_HANDOFF_MESSAGE_PATH: ownerMessagePath
      },
      "beta owner handoff message"
    )
  );
  console.log(
    runCommand(
      ["npm", "run", "admin:launch-readiness:bundle"],
      {
        OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH: launchBundlePath,
        OUTPOST_ADMIN_LAUNCH_READINESS_CUSTOMER_HANDOFF: "ready",
        OUTPOST_ADMIN_LAUNCH_READINESS_FULFILLMENT: "ready",
        OUTPOST_ADMIN_LAUNCH_READINESS_GYM_NAME: gymName,
        OUTPOST_ADMIN_LAUNCH_READINESS_OWNER_EMAIL: ownerEmail,
        OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_PROOF: "ready",
        OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_URL: appOrigin,
        OUTPOST_ADMIN_LAUNCH_READINESS_ROLLBACK: "ready",
        OUTPOST_NEON_BRANCH_NAME: config.branchName
      },
      "admin launch readiness bundle"
    )
  );

  const launchBundle = readJson(launchBundlePath, "admin launch readiness bundle");
  invariant(launchBundle.customer_observed_completion_claimed === true, "Launch bundle did not preserve customer-observed completion.");
  invariant(launchBundle.public_self_serve_launch_allowed === false, "Launch bundle unexpectedly allowed public self-serve.");

  console.log(
    runCommand(
      ["npm", "run", "admin:launch-package:record"],
      {
        OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH: launchBundlePath,
        OUTPOST_BETA_HANDOFF_MESSAGE_PATH: ownerMessagePath,
        NEXT_PUBLIC_OUTPOST_APP_URL: appOrigin,
        OUTPOST_NEON_BRANCH_NAME: config.branchName
      },
      "admin launch package record import"
    )
  );

  const packageQuery = launchPackageQuery(appOrigin, config.branchName, launchBundlePath, ownerMessagePath);
  const packageProof = runPsqlJson(config, packageQuery.sql);
  invariant(packageProof.record_present === true, "Admin launch package record was not found after import.");

  console.log("Hosted launch package record proof passed.");
  console.log(`Launch bundle sha256: ${packageQuery.launchBundleSha256}`);
  console.log(`Owner message sha256: ${packageQuery.ownerMessageSha256}`);
  console.log(`Matching package records: ${packageProof.matching_record_count}`);
  console.log("Public self-serve launch: blocked");
  console.log("Live-provider and billing gates: blocked");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
