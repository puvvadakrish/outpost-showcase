#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const PACKET_PATH =
  process.env.OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH ??
  "artifacts/admin-launch-readiness/admin-source-facts-packet.json";

const TOPIC_LIMIT = 120;
const VALUE_LIMIT = 1200;
const LABEL_LIMIT = 160;
const FACT_LIMIT = 20;

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

function normalizeArtifactPath(rawPath, label, { mustExist }) {
  const value = rawPath?.trim();
  invariant(value, `${label} required.`);
  assertNoSecretShapedValue(value, label);
  const resolved = resolve(process.cwd(), value);
  const relativePath = isAbsolute(value) ? value : relative(process.cwd(), resolved);
  const normalizedRelative = relative(process.cwd(), resolved).split(sep).join("/");
  invariant(!normalizedRelative.startsWith("..") && normalizedRelative.startsWith("artifacts/"), `${label} must be under artifacts/.`);
  invariant(relativePath.endsWith(".json"), `${label} must be a JSON artifact.`);
  invariant(mustExist ? existsSync(resolved) : !existsSync(resolved), `${label} ${mustExist ? "not found" : "already exists"} at ${relativePath}.`);
  return { relativePath, resolved };
}

function readJsonArtifact(path, label) {
  const raw = readFileSync(path, "utf8");
  assertNoSecretShapedValue(raw, label);
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, label);
  return { artifact, sha256: createHash("sha256").update(raw).digest("hex") };
}

function assertBlockedGates(artifact, gates, label) {
  for (const gate of gates) {
    invariant(artifact.blocked_gates?.includes(gate), `${label} must block ${gate}.`);
  }
}

function normalizeFact(rawFact, index) {
  const topic = String(rawFact?.topic ?? "").trim();
  const value = String(rawFact?.value ?? "").trim();
  const confidence = Number(rawFact?.confidence ?? 0.8);
  const conflictGroup = String(rawFact?.conflictGroup ?? rawFact?.conflict_group ?? "").trim();
  invariant(topic, `Fact ${index + 1} topic required.`);
  invariant(value, `Fact ${index + 1} value required.`);
  invariant(topic.length <= TOPIC_LIMIT, `Fact ${index + 1} topic too long.`);
  invariant(value.length <= VALUE_LIMIT, `Fact ${index + 1} value too long.`);
  invariant(Number.isFinite(confidence) && confidence >= 0 && confidence <= 1, `Fact ${index + 1} confidence must be 0..1.`);
  return {
    topic,
    value,
    confidence,
    ...(conflictGroup ? { conflict_group: conflictGroup } : {})
  };
}

function main() {
  const preflightPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_SOURCE_IMPORT_PREFLIGHT_PATH,
    "OUTPOST_ADMIN_SOURCE_IMPORT_PREFLIGHT_PATH",
    { mustExist: true }
  );
  const packetPath = normalizeArtifactPath(PACKET_PATH, "OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH", { mustExist: false });
  const { artifact: preflight, sha256: preflightSha256 } = readJsonArtifact(preflightPath.resolved, "source import preflight");
  invariant(preflight.artifact_kind === "admin_source_import_preflight", "Source import preflight kind mismatch.");
  invariant(preflight.public_self_serve_launch_allowed === false, "Preflight must keep public self-serve blocked.");
  invariant(preflight.source_import_allowed === false, "Preflight must keep source import blocked.");
  invariant(preflight.public_scraping_allowed === false, "Preflight must keep public scraping blocked.");
  invariant(preflight.live_provider_enablement_allowed === false, "Preflight must keep live providers blocked.");
  assertBlockedGates(
    preflight,
    [
      "public_owner_self_signup",
      "website_scraping",
      "google_profile_api_import",
      "automatic_answer_approval",
      "task_generation",
      "notification_sending",
      "phone_email_provider_activation",
      "billing",
      "pos_access_control_member_ledger_writes"
    ],
    "Source import preflight"
  );

  const sourceLabel = String(process.env.OUTPOST_ADMIN_SOURCE_FACTS_LABEL ?? "").trim();
  invariant(sourceLabel && sourceLabel.length <= LABEL_LIMIT, "OUTPOST_ADMIN_SOURCE_FACTS_LABEL required and must be short.");
  assertNoSecretShapedValue(sourceLabel, "OUTPOST_ADMIN_SOURCE_FACTS_LABEL");
  const factsJson = process.env.OUTPOST_ADMIN_SOURCE_FACTS_JSON?.trim();
  invariant(factsJson, "OUTPOST_ADMIN_SOURCE_FACTS_JSON required.");
  assertNoSecretShapedValue(factsJson, "OUTPOST_ADMIN_SOURCE_FACTS_JSON");
  const parsedFacts = JSON.parse(factsJson);
  invariant(Array.isArray(parsedFacts) && parsedFacts.length > 0 && parsedFacts.length <= FACT_LIMIT, "Source facts must be a non-empty array of at most 20 facts.");
  const facts = parsedFacts.map(normalizeFact);

  const packet = {
    artifact_kind: "admin_source_facts_packet",
    status: "source_facts_packet_prepared",
    generated_at: new Date().toISOString(),
    gym_name: preflight.gym_name,
    owner_email: preflight.owner_email,
    source_label: sourceLabel,
    preflight_path: preflightPath.relativePath,
    preflight_sha256: preflightSha256,
    facts,
    public_self_serve_launch_allowed: false,
    source_runtime_write_allowed: false,
    automatic_answer_approval_allowed: false,
    task_generation_allowed: false,
    checklist: [
      "Paste these facts into the existing owner manual source intake only after owner/operator review.",
      "Stage proposals into answer review before any answer can be approved.",
      "Keep scraping, Google API import, task generation, notifications, and providers blocked."
    ],
    blocked_gates: [
      "public_owner_self_signup",
      "website_scraping",
      "google_profile_api_import",
      "automatic_answer_approval",
      "task_generation",
      "notification_sending",
      "phone_email_provider_activation",
      "billing",
      "pos_access_control_member_ledger_writes"
    ]
  };

  assertNoSecretShapedKeys(packet, "source facts packet");
  const serialized = `${JSON.stringify(packet, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "source facts packet");
  mkdirSync(dirname(packetPath.resolved), { recursive: true });
  writeFileSync(packetPath.resolved, serialized);
  console.log("Admin source facts packet prepared");
  console.log(`Artifact: ${packetPath.relativePath}`);
  console.log(`SHA256: ${createHash("sha256").update(serialized).digest("hex")}`);
  console.log("Source runtime writes and automatic answer approval remain blocked.");
}

main();
