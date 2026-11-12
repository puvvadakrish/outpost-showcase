#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const PACKET_PATH =
  process.env.OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH ??
  "artifacts/admin-launch-readiness/admin-handoff-readiness-packet.json";

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

function normalizeArtifactPath(rawPath) {
  const artifactPath = rawPath.trim();
  invariant(artifactPath, "OUTPOST_ADMIN_HANDOFF_READINESS_PACKET_PATH required.");
  const resolvedPath = resolve(artifactPath);
  const relativePath = relative(process.cwd(), resolvedPath);
  const insideRepo = !relativePath.startsWith("..") && !isAbsolute(relativePath);
  const insideArtifacts = relativePath === "artifacts" || relativePath.startsWith(`artifacts${sep}`);
  invariant(!insideRepo || insideArtifacts, "Admin handoff readiness packet must live under gitignored artifacts/.");
  invariant(existsSync(resolvedPath), `Admin handoff readiness packet not found: ${artifactPath}.`);
  return { relativePath: insideRepo ? relativePath : artifactPath, resolvedPath };
}

function assertHttpsNonLocal(value, label) {
  invariant(typeof value === "string", `${label} must be a string.`);
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
}

function assertPacketShape(artifact) {
  invariant(artifact.artifact_kind === "admin_handoff_readiness_packet", "Admin handoff packet kind mismatch.");
  invariant(artifact.status === "admin_handoff_readiness_packet_exported", "Admin handoff packet status mismatch.");
  invariant(["action_required", "ready"].includes(artifact.readiness_state), "Admin handoff packet readiness state invalid.");
  assertHttpsNonLocal(artifact.preview_url, "Admin handoff packet Preview URL");
  invariant(typeof artifact.neon_branch_name === "string" && artifact.neon_branch_name, "Admin handoff packet branch required.");
invariant(!/^production$/iu.test(artifact.neon_branch_name), "Admin handoff packet must not target production branch.");
invariant(!/outpost-neon-spike/iu.test(artifact.neon_branch_name), "Admin handoff packet must not target migration spike branch.");
  invariant(artifact.public_self_serve_launch_allowed === false, "Public self-serve launch must stay blocked.");
  invariant(artifact.live_provider_enablement_allowed === false, "Live-provider enablement must stay blocked.");
  invariant(artifact.blocked_gates?.includes("public_owner_self_signup"), "Packet must block public owner self-signup.");
  invariant(artifact.blocked_gates?.includes("phone_email_provider_activation"), "Packet must block phone/email providers.");
  invariant(artifact.blocked_gates?.includes("pos_access_control_member_ledger_writes"), "Packet must block POS/member ledger.");
  invariant(typeof artifact.packet_inputs?.proof_freshness_export === "string", "Packet must include proof freshness input.");
  invariant(typeof artifact.packet_inputs?.next_actions_export === "string", "Packet must include next-actions input.");
  invariant(typeof artifact.packet_inputs?.launch_readiness_export === "string", "Packet must include launch-readiness input.");
}

function main() {
  const { relativePath, resolvedPath } = normalizeArtifactPath(PACKET_PATH);
  const raw = readFileSync(resolvedPath, "utf8");
  assertNoSecretShapedValue(raw, "Admin handoff readiness packet");
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, "Admin handoff readiness packet");
  assertPacketShape(artifact);
  const sha256 = createHash("sha256").update(raw).digest("hex");
  console.log("Admin handoff readiness packet inspection");
  console.log(`Artifact: ${relativePath}`);
  console.log(`SHA256: ${sha256}`);
  console.log(`Readiness: ${artifact.readiness_state}`);
  console.log("Public self-serve and live-provider gates: blocked");
}

main();
