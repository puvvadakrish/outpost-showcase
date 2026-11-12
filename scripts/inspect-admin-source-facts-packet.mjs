#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const PACKET_PATH =
  process.env.OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH ??
  "artifacts/admin-launch-readiness/admin-source-facts-packet.json";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
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

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretShapedKeys(item, label, [...trail, String(index)]));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const path = [...trail, key].join(".");
    const secretKey =
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("cookie") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("credential") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("bypass") ||
      normalizedKey.includes("jwt");
    invariant(!secretKey, `${label} contains secret-shaped key ${path}.`);
    assertNoSecretShapedKeys(nested, label, [...trail, key]);
  }
}

function normalizeArtifactPath(rawPath) {
  const resolved = resolve(process.cwd(), rawPath);
  const relativePath = isAbsolute(rawPath) ? rawPath : relative(process.cwd(), resolved);
  const normalizedRelative = relative(process.cwd(), resolved).split(sep).join("/");
  invariant(!normalizedRelative.startsWith("..") && normalizedRelative.startsWith("artifacts/"), "Source facts packet must live under artifacts/.");
  invariant(existsSync(resolved), `Source facts packet not found at ${relativePath}.`);
  return { relativePath, resolved };
}

function assertArtifactShape(artifact) {
  invariant(artifact.artifact_kind === "admin_source_facts_packet", "Artifact kind mismatch.");
  invariant(artifact.status === "source_facts_packet_prepared", "Artifact status mismatch.");
  invariant(/^[a-f0-9]{64}$/u.test(artifact.preflight_sha256 ?? ""), "Preflight digest required.");
  invariant(Array.isArray(artifact.facts) && artifact.facts.length > 0 && artifact.facts.length <= 20, "Facts must be present.");
  invariant(artifact.public_self_serve_launch_allowed === false, "Public self-serve must remain blocked.");
  invariant(artifact.source_runtime_write_allowed === false, "Source runtime write must remain blocked.");
  invariant(artifact.automatic_answer_approval_allowed === false, "Automatic answer approval must remain blocked.");
  invariant(artifact.task_generation_allowed === false, "Task generation must remain blocked.");
  for (const fact of artifact.facts) {
    invariant(typeof fact.topic === "string" && fact.topic.trim(), "Fact topic required.");
    invariant(typeof fact.value === "string" && fact.value.trim(), "Fact value required.");
    invariant(Number.isFinite(fact.confidence) && fact.confidence >= 0 && fact.confidence <= 1, "Fact confidence must be 0..1.");
  }
  for (const gate of [
    "public_owner_self_signup",
    "website_scraping",
    "google_profile_api_import",
    "automatic_answer_approval",
    "task_generation",
    "notification_sending",
    "phone_email_provider_activation",
    "billing",
    "pos_access_control_member_ledger_writes"
  ]) {
    invariant(artifact.blocked_gates?.includes(gate), `${gate} gate must be blocked.`);
  }
}

function main() {
  const { relativePath, resolved } = normalizeArtifactPath(PACKET_PATH);
  const raw = readFileSync(resolved, "utf8");
  assertNoSecretShapedValue(raw, "source facts packet");
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, "source facts packet");
  assertArtifactShape(artifact);
  console.log("Admin source facts packet inspection");
  console.log(`Artifact: ${relativePath}`);
  console.log(`SHA256: ${createHash("sha256").update(raw).digest("hex")}`);
  console.log("Source runtime writes and automatic answer approval remain blocked.");
}

main();
