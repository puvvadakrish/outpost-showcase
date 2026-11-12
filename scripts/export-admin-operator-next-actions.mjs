#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const EXPORT_PATH =
  process.env.OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH ??
  "artifacts/admin-launch-readiness/admin-operator-next-actions.json";
const FRESHNESS_STATES = new Set(["blocked", "fresh", "missing", "stale"]);

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  invariant(value, `${name} required.`);
  return value;
}

function numberEnv(name) {
  const value = Number.parseInt(requireEnv(name), 10);
  invariant(Number.isInteger(value) && value >= 0, `${name} must be a non-negative integer.`);
  return value;
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
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(
      text
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function normalizeArtifactPath(rawPath) {
  const artifactPath = rawPath.trim();
  invariant(artifactPath, "OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH required.");
  const resolvedPath = resolve(artifactPath);
  const repoRoot = process.cwd();
  const relativePath = relative(repoRoot, resolvedPath);
  const insideRepo = !relativePath.startsWith("..") && !isAbsolute(relativePath);
  const insideArtifacts = relativePath === "artifacts" || relativePath.startsWith(`artifacts${sep}`);
  invariant(!insideRepo || insideArtifacts, "Admin next-action export must live under gitignored artifacts/.");
  return { relativePath: insideRepo ? relativePath : artifactPath, resolvedPath };
}

function normalizedPreviewOrigin(rawUrl, envName) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${envName} must be a valid URL.`);
  }
  invariant(parsed.protocol === "https:", `${envName} must use https.`);
  invariant(!parsed.username && !parsed.password, `${envName} must not include credentials.`);
  const hostname = parsed.hostname.replace(/^\[|\]$/gu, "");
  invariant(!["localhost", "127.0.0.1", "::1"].includes(hostname), `${envName} must not be local.`);
  return parsed.origin;
}

function assertFreshnessCounts(proofFreshness) {
  invariant(FRESHNESS_STATES.has(proofFreshness.state), "Admin proof freshness state invalid.");
  if (proofFreshness.state === "fresh") {
    invariant(
      proofFreshness.fresh > 0 && proofFreshness.stale === 0 && proofFreshness.missing === 0,
      "Fresh proof state requires only fresh counts."
    );
  } else if (proofFreshness.state === "missing") {
    invariant(proofFreshness.missing > 0 && proofFreshness.stale === 0, "Missing proof state requires missing count.");
  } else if (proofFreshness.state === "stale") {
    invariant(proofFreshness.stale > 0, "Stale proof state requires stale count.");
  }
}

function main() {
  const { relativePath, resolvedPath } = normalizeArtifactPath(EXPORT_PATH);
  const command = requireEnv("OUTPOST_ADMIN_NEXT_ACTIONS_COMMAND");
  const detail = requireEnv("OUTPOST_ADMIN_NEXT_ACTIONS_DETAIL");
  const label = requireEnv("OUTPOST_ADMIN_NEXT_ACTIONS_LABEL");
  const previewUrl = normalizedPreviewOrigin(
    requireEnv("OUTPOST_ADMIN_NEXT_ACTIONS_PREVIEW_URL"),
    "OUTPOST_ADMIN_NEXT_ACTIONS_PREVIEW_URL"
  );
  const state = requireEnv("OUTPOST_ADMIN_NEXT_ACTIONS_STATE");
  const branchName = requireEnv("OUTPOST_NEON_BRANCH_NAME");
  const proofFreshness = {
    fresh: numberEnv("OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_FRESH_COUNT"),
    missing: numberEnv("OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_MISSING_COUNT"),
    stale: numberEnv("OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_STALE_COUNT"),
    state: requireEnv("OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_STATE")
  };

  assertFreshnessCounts(proofFreshness);
  invariant(["blocked", "done", "next", "waiting"].includes(state), "Admin next-action state invalid.");
invariant(!/^production$/iu.test(branchName), "Refusing Admin next-action export against production branch.");
invariant(!/outpost-neon-spike/iu.test(branchName), "Refusing Admin next-action export against migration spike branch.");
  invariant(state === "done" || command !== "none", "Admin next-action export requires a command snapshot.");
  invariant(
    !/\b(?:approve|approval|sendInvite|sendEmail|enableProvider|billing|pos|memberLedger)\b/iu.test(command),
    "Command includes blocked browser/live-provider affordance."
  );

  const artifact = {
    artifact_kind: "admin_operator_next_action_queue",
    blocked_gates: [
      "Public self-serve launch",
      "Browser approval buttons",
      "Invite delivery",
      "Notification sending",
      "Phone/email providers",
      "Billing",
      "POS/access control/member-ledger writes"
    ],
    generated_at: new Date().toISOString(),
    live_provider_enablement_allowed: false,
    neon_branch_name: branchName,
    next_action: { command, detail, label, state },
    non_goals: [
      "browser_approval_buttons",
      "public_owner_self_signup",
      "invite_delivery",
      "notification_sending",
      "phone_email_provider_activation",
      "billing",
      "pos_access_control_member_ledger_writes"
    ],
    preview_url: previewUrl,
    proof_freshness: proofFreshness,
    public_self_serve_launch_allowed: false,
    status: "admin_operator_next_action_queue_exported"
  };
  const raw = `${JSON.stringify(artifact, null, 2)}\n`;
  assertNoSecretShapedValue(raw, "Admin next-action export artifact");

  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, raw, "utf8");
  const sha256 = createHash("sha256").update(raw).digest("hex");

  console.log("Admin operator next-action queue export");
  console.log(`Artifact: ${relativePath}`);
  console.log(`SHA256: ${sha256}`);
  console.log(`Next action: ${label}`);
  console.log("Public self-serve and live-provider gates: blocked");
}

main();
