#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

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

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretShapedKeys(item, label, [...trail, String(index)]));
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

    invariant(!secretKey, `${label} contains a secret-shaped key at ${path}.`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function normalizeArtifactPath(rawPath, label) {
  invariant(rawPath?.trim(), `${label} is required.`);
  invariant(!rawPath.includes("\0"), `${label} cannot contain null bytes.`);
  assertNoSecretShapedValue(rawPath, label);

  const artifactPath = rawPath.trim();
  const resolvedPath = resolve(artifactPath);
  const repoRelativePath = relative(process.cwd(), resolvedPath);
  const isInsideRepo =
    repoRelativePath.length > 0 && !repoRelativePath.startsWith("..") && !isAbsolute(repoRelativePath);
  const isIgnoredArtifactPath = repoRelativePath === "artifacts" || repoRelativePath.startsWith(`artifacts${sep}`);

  invariant(!isInsideRepo || isIgnoredArtifactPath, `${label} must live under gitignored artifacts/ when repo-local.`);
  return artifactPath;
}

function readPacket(path) {
  invariant(existsSync(path), `Admin launch decision packet was not found at ${path}.`);
  const content = readFileSync(path, "utf8");
  assertNoSecretShapedValue(content, "admin launch decision packet");

  try {
    const parsed = JSON.parse(content);
    assertNoSecretShapedKeys(parsed, "admin launch decision packet");
    assertNoSecretShapedValue(JSON.stringify(parsed), "admin launch decision packet");
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Admin launch decision packet must be valid JSON.");
    }
    throw error;
  }
}

function assertIncludes(values, expected, label) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.includes(expected), `${label} must include ${expected}.`);
}

function assertHttpsNonLocal(value, label) {
  invariant(typeof value === "string" && value.trim(), `${label} is required.`);

  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  invariant(url.protocol === "https:", `${label} must use https.`);
  invariant(!localHosts.has(url.hostname), `${label} must not be local.`);
  invariant(url.hostname.endsWith(".vercel.app"), `${label} must be a Vercel Preview URL.`);
  invariant(
    url.hostname !== "outpost-preview-20260610.vercel.app" && url.hostname !== "outpost.vercel.app",
    `${label} must not target a production-like Vercel origin.`
  );
  invariant(!url.username && !url.password, `${label} must not include embedded credentials.`);
}

function assertPacketShape(packet, path) {
  invariant(packet.status === "admin_launch_decision_packet_prepared", "packet status is not admin_launch_decision_packet_prepared.");
  invariant(packet.packet_kind === "manual_launch_review_packet", "packet kind must be manual_launch_review_packet.");
  invariant(packet.public_self_serve_launch_allowed === false, "public self-serve must not be launch-allowed.");
  invariant(packet.launch_enablement_allowed === false, "launch enablement must remain blocked.");
  invariant(packet.requires_human_review === true, "packet must require human review.");
  invariant(packet.launch_package_recorded === true, "packet requires a matching launch package record.");
  assertHttpsNonLocal(packet.preview_url, "packet Preview URL");
  invariant(typeof packet.neon_proof_branch === "string" && packet.neon_proof_branch.trim(), "packet Neon proof branch is required.");
  invariant(packet.neon_proof_branch !== "production", "packet Neon proof branch must not be production.");
  invariant(packet.neon_proof_branch !== "outpost-neon-spike", "packet Neon proof branch must not be the migration spike branch.");
  invariant(/^[a-f0-9]{64}$/u.test(packet.launch_bundle_sha256), "packet launch bundle sha256 must be a hex digest.");
  invariant(packet.artifacts?.packet_path === path, "packet artifact path must match the inspected path.");
  invariant(typeof packet.artifacts?.launch_bundle_path === "string" && packet.artifacts.launch_bundle_path.trim(), "packet launch bundle path is required.");
  invariant(typeof packet.launch_package_record?.id === "string" && packet.launch_package_record.id.trim(), "packet launch package record id is required.");
  invariant(packet.launch_package_record?.public_self_serve_launch_allowed === false, "packet package row must keep public self-serve blocked.");
  invariant(packet.launch_package_record?.customer_handoff_recorded === true, "packet package row must record customer handoff.");

  for (const ready of [
    "Protected Preview proof",
    "Admin portal proof",
    "Customer-observed handoff",
    "Operator fulfillment path",
    "Reset and rollback readiness",
    "Launch package record"
  ]) {
    assertIncludes(packet.ready_evidence, ready, "packet ready evidence");
  }

  for (const blocked of [
    "Public self-serve launch",
    "Browser approval buttons",
    "Invite delivery",
    "Notification sending",
    "Phone provider activation",
    "Email provider activation",
    "Billing",
    "POS",
    "Access control",
    "Member-ledger writes"
  ]) {
    assertIncludes(packet.blocked_gates, blocked, "packet blocked gates");
  }

  for (const nonGoal of [
    "public_self_signup",
    "browser_approval_buttons",
    "invite_delivery",
    "notification_sending",
    "phone_provider_activation",
    "email_provider_activation",
    "billing",
    "pos",
    "access_control",
    "member_ledger_writes"
  ]) {
    assertIncludes(packet.non_goals, nonGoal, "packet non-goals");
  }

  invariant(
    typeof packet.review_boundary === "string" && packet.review_boundary.includes("does not approve launch"),
    "packet review boundary must keep this artifact manual-review-only."
  );
}

const packetPath = normalizeArtifactPath(
  process.env.OUTPOST_ADMIN_LAUNCH_DECISION_PACKET_PATH,
  "OUTPOST_ADMIN_LAUNCH_DECISION_PACKET_PATH"
);
const packet = readPacket(packetPath);
assertPacketShape(packet, packetPath);

console.log("Admin launch decision packet inspection");
console.log(`Status: ${packet.status}`);
console.log(`Preview: ${packet.preview_url}`);
console.log(`Neon branch: ${packet.neon_proof_branch}`);
console.log("Manual launch review: required");
console.log("Public self-serve launch: blocked");
console.log("Live-provider and billing gates: blocked");
