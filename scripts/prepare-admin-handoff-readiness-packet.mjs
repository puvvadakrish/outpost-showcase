#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const PACKET_PATH =
  process.env.OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH ??
  "artifacts/admin-launch-readiness/admin-handoff-readiness-packet.json";

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

function assertNoSecretShapedKeys(value, path = "artifact") {
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
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
    invariant(!secretKey, `${path}.${key} is a secret-shaped key.`);
    assertNoSecretShapedKeys(nested, `${path}.${key}`);
  }
}

function normalizeArtifactPath(rawPath, envName, { mustExist } = { mustExist: true }) {
  const artifactPath = rawPath.trim();
  invariant(artifactPath, `${envName} required.`);
  const resolvedPath = resolve(artifactPath);
  const relativePath = relative(process.cwd(), resolvedPath);
  const insideRepo = !relativePath.startsWith("..") && !isAbsolute(relativePath);
  const insideArtifacts = relativePath === "artifacts" || relativePath.startsWith(`artifacts${sep}`);
  invariant(!insideRepo || insideArtifacts, `${envName} must live under gitignored artifacts/.`);
  invariant(!mustExist || existsSync(resolvedPath), `${envName} not found: ${artifactPath}.`);
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

function readArtifact(rawPath, envName) {
  const { relativePath, resolvedPath } = normalizeArtifactPath(rawPath, envName);
  const raw = readFileSync(resolvedPath, "utf8");
  assertNoSecretShapedValue(raw, envName);
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, envName);
  return { artifact, raw, relativePath };
}

function assertContext(artifact, { branchName, previewUrl }, label) {
  const artifactPreview = artifact.preview_url ?? artifact.previewUrl;
  const artifactBranch = artifact.neon_branch_name ?? artifact.neon_proof_branch;
  invariant(normalizedPreviewOrigin(artifactPreview, `${label} Preview URL`) === previewUrl, `${label} Preview URL mismatch.`);
  invariant(artifactBranch === branchName, `${label} Neon branch mismatch.`);
}

function assertLaunchReadiness(artifact) {
  invariant(artifact.status === "admin_launch_readiness_exported", "Launch-readiness artifact status invalid.");
  invariant(artifact.public_self_serve_launch_allowed === false, "Launch-readiness public self-serve must stay blocked.");
  const liveGate = artifact.gates?.find((gate) => /live-provider/iu.test(gate.label ?? ""));
  const selfServeGate = artifact.gates?.find((gate) => gate.label === "Public self-serve launch");
  invariant(liveGate?.state === "blocked", "Launch-readiness live-provider gate must stay blocked.");
  invariant(selfServeGate?.state === "blocked", "Launch-readiness public self-serve gate must stay blocked.");
}

function main() {
  const packetPath = normalizeArtifactPath(PACKET_PATH, "OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH", { mustExist: false });
  const previewUrl = normalizedPreviewOrigin(
    requireEnv("OUTPOST_ADMIN_HANDOFF_READINESS_PREVIEW_URL"),
    "OUTPOST_ADMIN_HANDOFF_READINESS_PREVIEW_URL"
  );
  const branchName = requireEnv("OUTPOST_NEON_BRANCH_NAME");
invariant(!/^production$/iu.test(branchName), "Refusing Admin handoff packet against production branch.");
invariant(!/outpost-neon-spike/iu.test(branchName), "Refusing Admin handoff packet against migration spike branch.");

  const proofFreshness = readArtifact(requireEnv("OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH"), "OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH");
  const nextActions = readArtifact(requireEnv("OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH"), "OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH");
  const launchReadiness = readArtifact(
    requireEnv("OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH"),
    "OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH"
  );

  assertContext(proofFreshness.artifact, { branchName, previewUrl }, "Proof freshness");
  assertContext(nextActions.artifact, { branchName, previewUrl }, "Next-actions");
  assertContext(launchReadiness.artifact, { branchName, previewUrl }, "Launch-readiness");
  invariant(proofFreshness.artifact.status === "admin_proof_freshness_exported", "Proof freshness artifact status invalid.");
  invariant(proofFreshness.artifact.overall_state === "fresh", "Proof freshness must be fresh before handoff packet.");
  invariant(nextActions.artifact.status === "admin_operator_next_action_queue_exported", "Next-actions artifact status invalid.");
  invariant(nextActions.artifact.proof_freshness?.state === "fresh", "Next-actions proof freshness must be fresh.");
  assertLaunchReadiness(launchReadiness.artifact);

  const nextAction = nextActions.artifact.next_action;
  const readinessState = nextAction?.state === "done" ? "ready" : "action_required";
  const blockedGates = [
    "browser_approval_buttons",
    "public_owner_self_signup",
    "invite_delivery",
    "notification_sending",
    "phone_email_provider_activation",
    "billing",
    "pos_access_control_member_ledger_writes"
  ];
  const artifact = {
    artifact_kind: "admin_handoff_readiness_packet",
    blocked_gates: blockedGates,
    generated_at: new Date().toISOString(),
    live_provider_enablement_allowed: false,
    neon_branch_name: branchName,
    next_action: nextAction,
    packet_inputs: {
      launch_readiness_export: launchReadiness.relativePath,
      next_actions_export: nextActions.relativePath,
      proof_freshness_export: proofFreshness.relativePath
    },
    preview_url: previewUrl,
    public_self_serve_launch_allowed: false,
    readiness_state: readinessState,
    status: "admin_handoff_readiness_packet_exported",
    summary:
      readinessState === "ready"
        ? "All composed Admin artifacts are current; public launch and live providers remain blocked."
        : `Action required before handoff readiness can be marked ready: ${nextAction?.label ?? "unavailable"}.`
  };
  const raw = `${JSON.stringify(artifact, null, 2)}\n`;
  assertNoSecretShapedValue(raw, "Admin handoff readiness packet");
  assertNoSecretShapedKeys(artifact, "Admin handoff readiness packet");

  mkdirSync(dirname(packetPath.resolvedPath), { recursive: true });
  writeFileSync(packetPath.resolvedPath, raw, "utf8");
  const sha256 = createHash("sha256").update(raw).digest("hex");
  console.log("Admin handoff readiness packet export");
  console.log(`Artifact: ${packetPath.relativePath}`);
  console.log(`SHA256: ${sha256}`);
  console.log(`Readiness: ${readinessState}`);
  console.log("Public self-serve and live-provider gates: blocked");
}

main();
