#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_REVIEW_PATH =
  "artifacts/admin-launch-readiness/admin-limited-beta-operator-review-packet.json";
const DEFAULT_PREFLIGHT_PATH =
  "artifacts/admin-launch-readiness/admin-public-self-serve-launch-preflight.json";

const REQUIRED_BLOCKED_GATES = [
  "Public owner self-signup",
  "Browser approval buttons",
  "Invite delivery",
  "Notification sending",
  "Phone/email provider activation",
  "Product Auth admin API",
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

function runLimitedBetaReviewInspect(path) {
  const result = spawnSync("node", ["scripts/inspect-admin-limited-beta-operator-review-packet.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_ADMIN_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH: path,
    },
  });
  if (result.status !== 0) {
    throw new Error(`Limited beta operator review inspection failed.\n${result.stderr || result.stdout}`);
  }
}

function assertFalse(object, key, message) {
  invariant(object?.[key] === false, message);
}

function validateReview(packet) {
  invariant(packet.artifact_kind === "admin_limited_beta_operator_review_packet", "Limited beta review kind mismatch.");
  invariant(packet.status === "admin_limited_beta_operator_review_packet_prepared", "Limited beta review status mismatch.");
  invariant(packet.limited_beta_operator_review_ready === true, "Limited beta review must be ready.");
  invariant(packet.owner_access_mode === "operator_managed", "Owner access must remain operator-managed.");
  assertFalse(packet, "public_self_serve_launch_allowed", "Public self-serve must remain blocked.");
  assertFalse(packet, "invite_delivery_allowed", "Invite delivery must remain blocked.");
  assertFalse(packet, "notification_sending_allowed", "Notifications must remain blocked.");
  assertFalse(packet, "live_provider_enablement_allowed", "Live providers must remain blocked.");
  assertFalse(packet, "billing_pos_member_writes_allowed", "Billing/POS/member writes must remain blocked.");
}

function main() {
  const reviewPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH ?? DEFAULT_REVIEW_PATH,
    "OUTPOST_ADMIN_LIMITED_BETA_OPERATOR_REVIEW_PACKET_PATH",
    { mustExist: true },
  );
  const preflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_PUBLIC_SELF_SERVE_LAUNCH_PREFLIGHT_PATH ?? DEFAULT_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_PUBLIC_SELF_SERVE_LAUNCH_PREFLIGHT_PATH",
  );
  const { artifact: review, sha256: reviewSha256 } = readJsonArtifact(
    reviewPath.resolved,
    "limited beta operator review packet",
  );
  runLimitedBetaReviewInspect(reviewPath.relativePath);
  validateReview(review);

  const preflight = {
    artifact_kind: "admin_public_self_serve_launch_preflight",
    status: "admin_public_self_serve_launch_preflight_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_limited_beta_operator_review_packet",
    limited_beta_operator_review_packet_path: reviewPath.relativePath,
    limited_beta_operator_review_packet_sha256: reviewSha256,
    candidate_gym_label: review.candidate_gym_label,
    owner_access_mode: "operator_managed_until_public_launch_gate_green",
    public_self_serve_launch_preflight_ready: true,
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
    blocked_gates: REQUIRED_BLOCKED_GATES,
    required_green_before_public_launch: [
      "At least one limited operator-assisted beta onboarding completed and reviewed.",
      "Owner access fulfillment remains operator-managed until launch gate approval.",
      "Public request intake is request-only and human-reviewed, not browser-approved.",
      "Invite delivery has no-send preflight plus separate send-provider proof.",
      "Phone/email providers, billing, POS, access control, and member-ledger writes have separate proof tracks.",
    ],
    allowed_next_work: [
      "Design public request intake as pending review only.",
      "Prepare invite-delivery no-send preflight.",
      "Prepare Auth admin dry-run without creating users.",
      "Prepare live-provider/revenue gate documents without enabling providers.",
    ],
  };

  assertNoSecretShapedKeys(preflight, "public self-serve launch preflight");
  mkdirSync(dirname(preflightPath.resolved), { recursive: true });
  writeFileSync(preflightPath.resolved, `${JSON.stringify(preflight, null, 2)}\n`);

  console.log("Admin public self-serve launch preflight prepared");
  console.log(`Artifact: ${preflightPath.relativePath}`);
  console.log("Public self-serve launch: blocked");
  console.log("Invite delivery/live-provider/revenue gates: blocked");
}

main();
