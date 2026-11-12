#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-public-self-serve-launch-preflight.json";
const DEFAULT_CURRENT_CHAIN_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-public-request-self-serve-launch-preflight.json";
const DEFAULT_BATCH_PATH =
  "artifacts/admin-launch-readiness/admin-public-launch-controls-batch.json";

const BLOCKED_GATES = [
  "Public owner self-signup",
  "Browser approval buttons",
  "Invite delivery",
  "Notification sending",
  "Phone/email provider activation",
  "Product Auth admin API",
  "Auth user creation",
  "Automatic owner/staff grants",
  "Billing, POS, access control, member-ledger writes",
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoSecretShapedValue(value, label) {
  if (typeof value !== "string") return;
  const secretLike =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(value) ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(value) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(value) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(value) ||
    value.includes("__Secure-neon-auth") ||
    value.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(
      value,
    );
  invariant(!secretLike, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoSecretShapedKeys(entry, label, [...trail, String(index)]),
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const path = [...trail, key].join(".");
    invariant(
      !/(password|token|cookie|apikey|authorization|credential|privatekey|secret|bypass|signature|jwt)/u.test(
        normalizedKey,
      ),
      `${label} contains secret-shaped key ${path}.`,
    );
    assertNoSecretShapedValue(entry, `${label}.${path}`);
    assertNoSecretShapedKeys(entry, label, [...trail, key]);
  }
}

function normalizeArtifactPath(value, label, options = {}) {
  invariant(value && typeof value === "string", `${label} required.`);
  invariant(!value.includes("\0"), `${label} cannot contain NUL.`);
  const resolved = resolve(value);
  const cwd = resolve(process.cwd());
  const relativePath = relative(cwd, resolved);
  invariant(
    !isAbsolute(relativePath) &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`),
    `${label} must stay inside repository.`,
  );
  invariant(
    relativePath.startsWith(`artifacts${sep}`) || relativePath === "artifacts",
    `${label} must be under artifacts/.`,
  );
  invariant(relativePath.endsWith(".json"), `${label} must point to JSON.`);
  if (options.mustExist) {
    invariant(existsSync(resolved), `${label} does not exist: ${relativePath}`);
  } else {
    invariant(!existsSync(resolved), `${label} already exists: ${relativePath}`);
  }
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

function runPreflightInspect(path, artifactKind) {
  const isCurrentChain =
    artifactKind === "admin_public_request_self_serve_launch_preflight";
  const script = isCurrentChain
    ? "scripts/inspect-admin-public-request-self-serve-launch-preflight.mjs"
    : "scripts/inspect-admin-public-self-serve-launch-preflight.mjs";
  const envKey = isCurrentChain
    ? "OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH"
    : "OUTPOST_ADMIN_PUBLIC_SELF_SERVE_LAUNCH_PREFLIGHT_PATH";
  const result = spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      [envKey]: path,
    },
  });
  if (result.status !== 0) {
    throw new Error(`Public self-serve launch preflight inspection failed.\n${result.stderr || result.stdout}`);
  }
}

function assertFalse(object, key, message) {
  invariant(object?.[key] === false, message);
}

function validatePreflight(preflight) {
  invariant(
    [
      "admin_public_self_serve_launch_preflight",
      "admin_public_request_self_serve_launch_preflight",
    ].includes(preflight.artifact_kind),
    "Public launch preflight kind mismatch.",
  );
  invariant(
    [
      "admin_public_self_serve_launch_preflight_prepared",
      "admin_public_request_self_serve_launch_preflight_prepared",
    ].includes(preflight.status),
    "Public launch preflight status mismatch.",
  );
  invariant(preflight.public_self_serve_launch_preflight_ready === true, "Public launch preflight must be ready.");
  assertFalse(preflight, "public_self_serve_launch_allowed", "Public self-serve launch must remain blocked.");
  assertFalse(preflight, "public_request_form_allowed", "Public request form must remain blocked.");
  assertFalse(preflight, "browser_approval_buttons_allowed", "Browser approvals must remain blocked.");
  assertFalse(preflight, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(preflight, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(preflight, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(preflight, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
}

function resolvePreflightPathInput() {
  if (process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH) {
    return {
      label: "OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH",
      value: process.env.OUTPOST_ADMIN_PUBLIC_REQUEST_SELF_SERVE_LAUNCH_PREFLIGHT_PATH,
    };
  }
  if (process.env.OUTPOST_ADMIN_PUBLIC_SELF_SERVE_LAUNCH_PREFLIGHT_PATH) {
    return {
      label: "OUTPOST_ADMIN_PUBLIC_SELF_SERVE_LAUNCH_PREFLIGHT_PATH",
      value: process.env.OUTPOST_ADMIN_PUBLIC_SELF_SERVE_LAUNCH_PREFLIGHT_PATH,
    };
  }
  if (existsSync(resolve(DEFAULT_CURRENT_CHAIN_PREFLIGHT_PATH))) {
    return {
      label: "default current-chain public request self-serve launch preflight",
      value: DEFAULT_CURRENT_CHAIN_PREFLIGHT_PATH,
    };
  }
  return {
    label: "default public self-serve launch preflight",
    value: DEFAULT_PREFLIGHT_PATH,
  };
}

function main() {
  const preflightInput = resolvePreflightPathInput();
  const preflightPath = normalizeArtifactPath(
    preflightInput.value,
    preflightInput.label,
    { mustExist: true },
  );
  const batchPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH ?? DEFAULT_BATCH_PATH,
    "OUTPOST_ADMIN_PUBLIC_LAUNCH_CONTROLS_BATCH_PATH",
  );
  const { artifact: preflight, sha256: preflightSha256 } = readJsonArtifact(
    preflightPath.resolved,
    "public self-serve launch preflight",
  );
  runPreflightInspect(preflightPath.relativePath, preflight.artifact_kind);
  validatePreflight(preflight);

  const batch = {
    artifact_kind: "admin_public_launch_controls_batch",
    status: "admin_public_launch_controls_batch_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: preflight.artifact_kind,
    public_self_serve_launch_preflight_path: preflightPath.relativePath,
    public_self_serve_launch_preflight_sha256: preflightSha256,
    candidate_gym_label: preflight.candidate_gym_label,
    owner_access_mode: "operator_managed_until_launch_gate_green",
    public_launch_controls_batch_ready: true,
    public_request_intake: {
      mode: "request_only_human_reviewed",
      request_form_allowed: false,
      browser_approval_buttons_allowed: false,
      automatic_approval_allowed: false,
      automatic_owner_staff_grants_allowed: false,
    },
    invite_auth_no_send: {
      mode: "no_send_no_create_dry_run",
      invite_delivery_allowed: false,
      staff_invite_delivery_allowed: false,
      outbound_email_allowed: false,
      notification_sending_allowed: false,
      product_auth_admin_api_allowed: false,
      auth_user_created: false,
    },
    live_provider_revenue_member_systems: {
      mode: "separate_blocked_proof_tracks",
      gmail_resend_smtp_provider_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
      access_control_writes_allowed: false,
      member_ledger_writes_allowed: false,
    },
    public_self_serve_launch_allowed: false,
    public_request_form_allowed: false,
    browser_approval_buttons_allowed: false,
    automatic_approval_allowed: false,
    product_auth_admin_api_allowed: false,
    auth_user_created: false,
    automatic_owner_staff_grants_allowed: false,
    invite_delivery_allowed: false,
    staff_invite_delivery_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    gmail_resend_smtp_provider_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    access_control_writes_allowed: false,
    member_ledger_writes_allowed: false,
    blocked_gates: BLOCKED_GATES,
    next_readiness_batches: [
      {
        command: "Implement public request intake as request-only and human-reviewed.",
        detail: "No browser approval, automatic provisioning, invite delivery, or Auth user creation.",
        id: "public_request_intake_dry_run",
        state: "pending",
        title: "Public request intake dry-run",
      },
      {
        command: "Prepare invite/Auth no-send and no-create dry-run artifacts.",
        detail: "No email sending, notifications, magic links, Auth users, or automatic grants.",
        id: "invite_auth_dry_run_gates",
        state: "blocked",
        title: "Invite/Auth no-send gates",
      },
      {
        command: "Prepare live-provider, revenue, POS, access-control, and member-ledger proof tracks separately.",
        detail: "No provider activation or account-system writes are allowed from this batch.",
        id: "live_provider_revenue_gates",
        state: "blocked",
        title: "Live-provider/revenue/member-system tracks",
      },
    ],
  };

  assertNoSecretShapedKeys(batch, "public launch controls batch");
  mkdirSync(dirname(batchPath.resolved), { recursive: true });
  writeFileSync(batchPath.resolved, `${JSON.stringify(batch, null, 2)}\n`);

  console.log("Admin public launch controls batch prepared");
  console.log(`Artifact: ${batchPath.relativePath}`);
  console.log(`Preflight artifact: ${preflightPath.relativePath}`);
  console.log(`Evidence basis: ${batch.evidence_basis}`);
  console.log("Public request intake: request-only/human-reviewed");
  console.log("Invite/Auth: no-send/no-create");
  console.log("Live-provider/revenue/member-system gates: blocked");
}

main();
