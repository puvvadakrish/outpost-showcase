#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const PACKET_PATH =
  process.env.OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH ??
  "artifacts/admin-launch-readiness/admin-handoff-readiness-packet.json";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
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
  if (!value || typeof value !== "object") return;
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
    invariant(!secretKey, `${path}.${key} is secret-shaped.`);
    assertNoSecretShapedKeys(nested, `${path}.${key}`);
  }
}

function normalizeArtifactPath(artifactPath, envName) {
  assertNoSecretShapedValue(artifactPath, envName);
  invariant(!isAbsolute(artifactPath), `${envName} must be repo-relative.`);
  const resolvedPath = resolve(process.cwd(), artifactPath);
  const repoRoot = resolve(process.cwd());
  const relativePath = relative(repoRoot, resolvedPath);
  invariant(relativePath && !relativePath.startsWith("..") && !relativePath.includes(`..${sep}`), `${envName} must stay inside repo.`);
  invariant(relativePath.startsWith(`artifacts${sep}`) || relativePath === "artifacts", `${envName} must stay under artifacts/.`);
  invariant(existsSync(resolvedPath), `${envName} not found: ${artifactPath}.`);
  return { relativePath: relativePath.split(sep).join("/"), resolvedPath };
}

function readArtifact(artifactPath, envName) {
  const normalized = normalizeArtifactPath(artifactPath, envName);
  const raw = readFileSync(normalized.resolvedPath, "utf8");
  assertNoSecretShapedValue(raw, envName);
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, envName);
  return {
    ...normalized,
    artifact,
    sha256: createHash("sha256").update(raw).digest("hex")
  };
}

function normalizedPreviewOrigin(value, label) {
  invariant(typeof value === "string" && value.trim(), `${label} required.`);
  assertNoSecretShapedValue(value, label);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  invariant(parsed.protocol === "https:", `${label} must use https.`);
  invariant(!parsed.username && !parsed.password, `${label} must not include credentials.`);
  const hostname = parsed.hostname.replace(/^\[|\]$/gu, "");
  invariant(!["localhost", "127.0.0.1", "::1"].includes(hostname), `${label} must not be local.`);
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/u, "");
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
  const packet = readArtifact(PACKET_PATH, "OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH");
  const artifact = packet.artifact;
  invariant(artifact.artifact_kind === "admin_handoff_readiness_packet", "Packet kind mismatch.");
  invariant(artifact.status === "admin_handoff_readiness_packet_exported", "Packet status mismatch.");
  invariant(["action_required", "ready"].includes(artifact.readiness_state), "Packet readiness state invalid.");
  invariant(artifact.public_self_serve_launch_allowed === false, "Packet public self-serve must stay blocked.");
  invariant(artifact.live_provider_enablement_allowed === false, "Packet live providers must stay blocked.");
  invariant(!/^production$/iu.test(artifact.neon_branch_name), "Packet must not target production branch.");
  invariant(!/outpost-neon-spike/iu.test(artifact.neon_branch_name), "Packet must not target migration spike branch.");

  const previewUrl = normalizedPreviewOrigin(artifact.preview_url, "Packet Preview URL");
  const branchName = artifact.neon_branch_name;
  const proofFreshness = readArtifact(requireEnv("OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH"), "OUTPOST_ADMIN_PROOF_FRESHNESS_EXPORT_PATH");
  const nextActions = readArtifact(requireEnv("OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH"), "OUTPOST_ADMIN_NEXT_ACTIONS_EXPORT_PATH");
  const launchReadiness = readArtifact(requireEnv("OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH"), "OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH");

  invariant(artifact.packet_inputs?.proof_freshness_export === proofFreshness.relativePath, "Packet proof freshness input path mismatch.");
  invariant(artifact.packet_inputs?.next_actions_export === nextActions.relativePath, "Packet next-actions input path mismatch.");
  invariant(artifact.packet_inputs?.launch_readiness_export === launchReadiness.relativePath, "Packet launch-readiness input path mismatch.");
  assertContext(proofFreshness.artifact, { branchName, previewUrl }, "Proof freshness");
  assertContext(nextActions.artifact, { branchName, previewUrl }, "Next-actions");
  assertContext(launchReadiness.artifact, { branchName, previewUrl }, "Launch-readiness");
  invariant(proofFreshness.artifact.status === "admin_proof_freshness_exported", "Proof freshness artifact status invalid.");
  invariant(proofFreshness.artifact.overall_state === "fresh", "Proof freshness must be fresh.");
  invariant(nextActions.artifact.status === "admin_operator_next_action_queue_exported", "Next-actions artifact status invalid.");
  invariant(nextActions.artifact.proof_freshness?.state === "fresh", "Next-actions proof freshness must be fresh.");
  assertLaunchReadiness(launchReadiness.artifact);

  console.log("Admin handoff readiness packet replay");
  console.log(`Packet: ${packet.relativePath}`);
  console.log(`Packet SHA256: ${packet.sha256}`);
  console.log(`Proof freshness SHA256: ${proofFreshness.sha256}`);
  console.log(`Next-actions SHA256: ${nextActions.sha256}`);
  console.log(`Launch-readiness SHA256: ${launchReadiness.sha256}`);
  console.log("Public self-serve and live-provider gates: blocked");
}

main();
