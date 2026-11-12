import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FounderAdminReadinessConsole } from "../src/components/founder-admin/FounderAdminReadinessConsole";
import {
  founderAdminBetaRequestFollowThroughReadiness,
  founderAdminBetaRequestOperatorSequence,
  founderAdminBetaRequestTriageReadiness,
  founderAdminBetaFulfillmentPreflight,
  founderAdminBetaAccessRequestLifecycle,
  founderAdminLaunchFollowThroughReadiness,
  founderAdminLaunchDecisionPacketReadiness,
  founderAdminLaunchPackageReadiness,
  founderAdminOperatorSelfServeRehearsalReadiness,
  founderAdminLaunchPromotionGate,
  founderAdminLaunchReadinessExport,
  founderAdminHandoffReadinessPacket,
  founderAdminOperatorActionQueue,
  founderAdminOwnerOnboardingTimeline,
  founderAdminProofFreshnessSummary,
  founderAdminProofStatusLedger,
  founderAdminSelfServeReadiness,
  type FounderAdminBetaAccessRequestFollowThroughOutcomeReport,
  type FounderAdminBetaAccessRequestReport,
  type FounderAdminBetaAccessRequestTriageReceiptReport,
  type FounderAdminBetaProofRunSummaryRecordReport,
  type FounderAdminCustomerSessionRecord,
  type FounderAdminCustomerSessionRecordReport,
  type FounderAdminCustomerHandoffGateReport,
  type FounderAdminHandoffPacketRecordReport,
  type FounderAdminLaunchDecisionRecordReport,
  type FounderAdminLaunchPackageRecordReport,
  type FounderAdminOperatorSelfServeRehearsalReport,
  type FounderAdminProofRunReport,
  type FounderAdminOwnerReadinessReport,
} from "../src/domain/founder-admin-readiness";

const migration = readFileSync(
  "neon/migrations/20260622010000_founder_admin_owner_readiness.sql",
  "utf8",
);
const proofRunMigration = readFileSync(
  "neon/migrations/20260622020000_founder_admin_proof_runs.sql",
  "utf8",
);
const customerHandoffGateMigration = readFileSync(
  "neon/migrations/20260622030000_customer_handoff_gate_records.sql",
  "utf8",
);
const betaAccessRequestMigration = readFileSync(
  "neon/migrations/20260622040000_owner_beta_access_requests.sql",
  "utf8",
);
const betaAccessRequestHardeningMigration = readFileSync(
  "neon/migrations/20260712015000_harden_owner_beta_access_requests.sql",
  "utf8",
);
const betaAccessPreflightMigration = readFileSync(
  "neon/migrations/20260622060000_owner_beta_access_request_preflight.sql",
  "utf8",
);
const betaAccessReceiptMigration = readFileSync(
  "neon/migrations/20260622070000_owner_beta_access_fulfillment_receipts.sql",
  "utf8",
);
const betaAccessTriageReceiptMigration = readFileSync(
  "neon/migrations/20260624060000_owner_beta_access_request_triage_receipts.sql",
  "utf8",
);
const betaAccessFollowThroughOutcomeMigration = readFileSync(
  "neon/migrations/20260624070000_owner_beta_request_followthrough_outcomes.sql",
  "utf8",
);
const launchPackageRecordMigration = readFileSync(
  "neon/migrations/20260623010000_admin_launch_package_records.sql",
  "utf8",
);
const launchDecisionRecordMigration = readFileSync(
  "neon/migrations/20260624010000_admin_launch_decision_records.sql",
  "utf8",
);
const operatorSelfServeRehearsalMigration = readFileSync(
  "neon/migrations/20260624050000_operator_self_serve_rehearsal_records.sql",
  "utf8",
);
const adminPage = readFileSync("src/app/admin/page.tsx", "utf8");
const founderAdminRedirectPage = readFileSync(
  "src/app/founder-admin/page.tsx",
  "utf8",
);
const component = readFileSync(
  "src/components/founder-admin/FounderAdminReadinessConsole.tsx",
  "utf8",
);
const repository = readFileSync(
  "src/infrastructure/neon/founder-admin-readiness-repository.ts",
  "utf8",
);
const globals = readFileSync("src/app/globals.css", "utf8");

const sampleReport: FounderAdminOwnerReadinessReport = {
  authorized: true,
  generated_at: "2026-06-22T00:00:00.000Z",
  rows: [
    {
      grant: {
        created_at: "2026-06-22T00:00:00.000Z",
        display_name_present: true,
        note_present: true,
        present: true,
        status: "active",
        updated_at: "2026-06-22T00:00:00.000Z",
      },
      owner_account: {
        app_user_present: true,
        auth_linked: true,
        created_at: "2026-06-22T00:00:00.000Z",
      },
      owner_email: "owner-beta@example.com",
      provider_gate: {
        state: "blocked",
        unexpected_live_records: 0,
      },
      rollback_readiness: {
        reason:
          "Disposable dry-run tenant shape matches the guarded rollback path.",
        state: "dry_run_rollback_ready",
      },
      tenant_bootstrap: {
        billing_mode: "pilot",
        created_at: "2026-06-22T00:00:00.000Z",
        locations_count: 1,
        manual_sources_count: 2,
        open_tasks_count: 1,
        owner_membership_status: "active",
        review_answers_count: 3,
        tenant_id: "tenant_dry_run",
        tenant_name: "Example Dry Run Gym",
        tenant_status: "setup",
      },
    },
  ],
};

const sampleProofRunReport: FounderAdminProofRunReport = {
  authorized: true,
  generated_at: "2026-06-22T00:05:00.000Z",
  rows: [
    {
      app_origin: "https://outpost-preview.example.vercel.app",
      completed_at: "2026-06-22T00:04:00.000Z",
      id: "proof_vercel_preview_1",
      neon_branch_name: "outpost-beta-access-scoped-proof",
      proof_kind: "vercel_preview_verify",
      started_at: "2026-06-22T00:00:00.000Z",
      status: "passed",
      summary: {
        founder_admin_readiness: "passed",
        hosted_beta_workflow: "passed",
      },
    },
    {
      app_origin: "https://outpost-preview.example.vercel.app",
      completed_at: "2026-06-22T00:03:00.000Z",
      id: "proof_founder_admin_1",
      neon_branch_name: "outpost-beta-access-scoped-proof",
      proof_kind: "hosted_founder_admin_readiness",
      started_at: "2026-06-22T00:01:00.000Z",
      status: "passed",
      summary: {
        founder_admin_projection: "passed",
        route_smoke: "passed",
      },
    },
  ],
};

const sampleBetaProofRunSummaryRecordReport: FounderAdminBetaProofRunSummaryRecordReport =
  {
    authorized: true,
    generated_at: "2026-06-22T00:05:30.000Z",
    rows: [
      {
        app_origin: "https://outpost-preview.example.vercel.app",
        browser_artifact_sha256: "a".repeat(64),
        browser_cleanup: "cleanup_requested",
        chain_artifact_sha256: "b".repeat(64),
        chain_cleanup: "cleanup_requested",
        created_at: "2026-06-22T00:05:30.000Z",
        id: "hosted_beta_proof_run_summary_abc123",
        live_provider_enablement_allowed: false,
        neon_branch_name: "outpost-beta-access-scoped-proof",
        public_self_serve_launch_allowed: false,
        recorded_at: "2026-06-22T00:05:30.000Z",
        status: "hosted_beta_proof_run_summary_recorded",
        summary_sha256: "c".repeat(64),
      },
    ],
  };

const sampleCustomerSessionRecord: FounderAdminCustomerSessionRecord = {
  app_origin: "https://outpost-preview.example.vercel.app",
  billing_pos_member_writes_allowed: false,
  created_at: "2026-06-22T00:11:30.000Z",
  customer_observed_handoff_claimed: true,
  customer_observed_session_recorded: true,
  gym_name: "Summit Strength",
  handoff_scheduling_packet_sha256: "9".repeat(64),
  id: "admin_customer_session_record_abc123",
  invite_delivery_allowed: false,
  live_provider_enablement_allowed: false,
  neon_branch_name: "outpost-beta-access-scoped-proof",
  observed_checks: {
    live_provider_gates_reviewed: true,
    owner_workspace_observed: true,
  },
  operator_label: "Krish",
  owner_email: "owner@summitstrength.example",
  owner_label: "Northside Owner",
  public_self_serve_launch_allowed: false,
  recorded_at: "2026-06-22T00:11:30.000Z",
  session_record_path:
    "artifacts/admin-launch-readiness/admin-customer-observed-session-record.json",
  session_record_sha256: "a".repeat(64),
  status: "admin_customer_session_record_imported",
  summary: {
    no_live_provider_gates: true,
  },
};

const sampleCustomerSessionRecordReport: FounderAdminCustomerSessionRecordReport =
  {
    authorized: true,
    generated_at: "2026-06-22T00:11:30.000Z",
    rows: [sampleCustomerSessionRecord],
  };

const sampleCustomerHandoffGateReport: FounderAdminCustomerHandoffGateReport = {
  authorized: true,
  generated_at: "2026-06-22T00:06:00.000Z",
  rows: [
    {
      admin_handoff_packet_sha256: "6".repeat(64),
      app_origin: "https://outpost-preview.example.vercel.app",
      beta_owner_label: "Jordan Owner <owner@summitstrength.example>",
      gate_generated_at: "2026-06-22T00:05:30.000Z",
      gym_name: "Summit Strength",
      id: "customer_handoff_abc123",
      neon_branch_name: "outpost-beta-access-scoped-proof",
      observer_label: "Outpost operator",
      participant_label: "Summit Strength owner",
      recorded_at: "2026-06-22T00:06:00.000Z",
      session_at: "2026-06-22T00:02:00.000Z",
      source_artifact_sha256: "a".repeat(64),
      status: "customer_observed_beta_handoff_gate_passed",
      summary: {
        gates: {
          customer_observed: "passed",
          live_providers: "blocked",
        },
      },
    },
  ],
};

const sampleLaunchPackageRecordReport: FounderAdminLaunchPackageRecordReport = {
  authorized: true,
  generated_at: "2026-06-22T00:09:00.000Z",
  rows: [
    {
      app_origin: "https://outpost-preview.example.vercel.app",
      customer_handoff_recorded: true,
      gym_name: "Summit Strength",
      id: "admin_launch_package_abc123",
      launch_bundle_path:
        "artifacts/admin-launch-readiness/outpost-beta-access-scoped-proof-launch-bundle.json",
      launch_bundle_sha256: "b".repeat(64),
      neon_branch_name: "outpost-beta-access-scoped-proof",
      owner_label: "owner@summitstrength.example",
      owner_message_path:
        "artifacts/beta-owner-handoff/summit-strength-owner-message.md",
      owner_message_sha256: "c".repeat(64),
      public_self_serve_launch_allowed: false,
      recorded_at: "2026-06-22T00:08:30.000Z",
      status: "admin_launch_package_recorded",
      summary: {
        blocked_gates: [
          "Live-provider and billing gates",
          "Public self-serve launch",
        ],
        owner_message: "prepared",
      },
    },
  ],
};

const sampleLaunchDecisionRecordReport: FounderAdminLaunchDecisionRecordReport =
  {
    authorized: true,
    generated_at: "2026-06-22T00:10:00.000Z",
    rows: [
      {
        app_origin: "https://outpost-preview.example.vercel.app",
        decision: "reviewed_for_next_launch_slice",
        decision_packet_path:
          "artifacts/admin-launch-readiness/outpost-beta-access-scoped-proof-launch-decision-packet.json",
        decision_packet_sha256: "d".repeat(64),
        id: "admin_launch_decision_abc123",
        launch_bundle_sha256: "b".repeat(64),
        launch_enablement_allowed: false,
        launch_package_record_id: "admin_launch_package_abc123",
        neon_branch_name: "outpost-beta-access-scoped-proof",
        public_self_serve_launch_allowed: false,
        recorded_at: "2026-06-22T00:10:00.000Z",
        review_note_present: true,
        reviewer_label: "Krish",
        status: "admin_launch_decision_recorded",
        summary: {
          blocked_gates: [
            "Public self-serve launch",
            "Phone provider activation",
          ],
          launch_enablement_allowed: false,
        },
      },
      {
        app_origin: "https://outpost-preview.example.vercel.app",
        decision: "deferred",
        decision_packet_path:
          "artifacts/admin-launch-readiness/outpost-beta-access-scoped-proof-launch-decision-packet-old.json",
        decision_packet_sha256: "e".repeat(64),
        id: "admin_launch_decision_old_same_branch",
        launch_bundle_sha256: "b".repeat(64),
        launch_enablement_allowed: false,
        launch_package_record_id: "admin_launch_package_abc123",
        neon_branch_name: "outpost-beta-access-scoped-proof",
        public_self_serve_launch_allowed: false,
        recorded_at: "2026-06-22T00:09:00.000Z",
        review_note_present: true,
        reviewer_label: "Tina",
        status: "admin_launch_decision_recorded",
        summary: {
          blocked_gates: [
            "Public self-serve launch",
            "Phone provider activation",
          ],
          launch_enablement_allowed: false,
        },
      },
      {
        app_origin: "https://other-preview.example.vercel.app",
        decision: "changes_requested",
        decision_packet_path:
          "artifacts/admin-launch-readiness/other-launch-decision-packet.json",
        decision_packet_sha256: "f".repeat(64),
        id: "admin_launch_decision_other_branch",
        launch_bundle_sha256: "1".repeat(64),
        launch_enablement_allowed: false,
        launch_package_record_id: "admin_launch_package_other",
        neon_branch_name: "other-proof-branch",
        public_self_serve_launch_allowed: false,
        recorded_at: "2026-06-22T00:11:00.000Z",
        review_note_present: true,
        reviewer_label: "Other reviewer",
        status: "admin_launch_decision_recorded",
        summary: {
          blocked_gates: [
            "Public self-serve launch",
            "Phone provider activation",
          ],
          launch_enablement_allowed: false,
        },
      },
    ],
  };

const sampleHandoffPacketRecordReport: FounderAdminHandoffPacketRecordReport = {
  authorized: true,
  generated_at: "2026-06-22T00:11:30.000Z",
  rows: [
    {
      app_origin: "https://outpost-preview.example.vercel.app",
      created_at: "2026-06-22T00:11:30.000Z",
      id: "admin_handoff_packet_abc123",
      launch_readiness_sha256: "7".repeat(64),
      live_provider_enablement_allowed: false,
      neon_branch_name: "outpost-beta-access-scoped-proof",
      next_actions_sha256: "6".repeat(64),
      packet_path:
        "artifacts/admin-launch-readiness/outpost-beta-access-scoped-proof-handoff-readiness-packet.json",
      packet_sha256: "5".repeat(64),
      proof_freshness_sha256: "4".repeat(64),
      public_self_serve_launch_allowed: false,
      readiness_state: "action_required",
      recorded_at: "2026-06-22T00:11:30.000Z",
      replay_verified: true,
      review_note_present: true,
      reviewer_label: "Krish",
      status: "admin_handoff_packet_recorded",
    },
  ],
};

const sampleOperatorSelfServeRehearsalReport: FounderAdminOperatorSelfServeRehearsalReport =
  {
    authorized: true,
    generated_at: "2026-06-22T00:12:00.000Z",
    rows: [
      {
        app_origin: "https://outpost-preview.example.vercel.app",
        followthrough_artifact_sha256: "9".repeat(64),
        gym_name: "Summit Strength",
        id: "operator_self_serve_rehearsal_abc123",
        launch_decision_record_id: "admin_launch_decision_abc123",
        launch_enablement_allowed: false,
        neon_branch_name: "outpost-beta-access-scoped-proof",
        observed_at: "2026-06-22T00:11:00.000Z",
        operator_label: "Krish",
        owner_label: "Jordan Owner",
        public_self_serve_launch_allowed: false,
        recorded_at: "2026-06-22T00:12:00.000Z",
        rehearsal_packet_path:
          "artifacts/admin-launch-readiness/outpost-beta-access-scoped-proof-operator-self-serve-rehearsal.json",
        rehearsal_packet_sha256: "8".repeat(64),
        status: "operator_self_serve_rehearsal_recorded",
        summary: {
          completion_basis: "operator_observed_rehearsal_packet",
          still_blocked: [
            "public owner self-signup",
            "phone or email provider activation",
          ],
        },
      },
    ],
  };

const sampleFulfillmentReceipt = {
  command_name: "beta:operator:request-fulfillment",
  completed_at: "2026-06-22T00:08:00.000Z",
  id: "owner_beta_fulfillment_receipt_abc123",
  neon_branch_name: "outpost-beta-access-scoped-proof",
  present: true,
  status: "recorded",
};

const sampleBetaAccessRequestReport: FounderAdminBetaAccessRequestReport = {
  authorized: true,
  generated_at: "2026-06-22T00:07:00.000Z",
  rows: [
    {
      created_at: "2026-06-22T00:01:00.000Z",
      email: "owner@summitstrength.example",
      fulfillment: {
        fulfilled: false,
        fulfilled_at: null,
        grant_linked: false,
        note_present: false,
      },
      fulfillment_receipt: null,
      grant: {
        present: false,
        status: null,
      },
      gym_name: "Summit Strength",
      id: "owner_beta_request_abc123",
      last_requested_at: "2026-06-22T00:07:00.000Z",
      location_hint: "Austin, TX",
      note_present: true,
      owner_account: {
        app_user_present: false,
        auth_linked: false,
      },
      owner_name: "Jordan Owner",
      provider_gate: {
        unexpected_live_records: 0,
      },
      request_count: 2,
      status: "new",
      tenant_bootstrap: {
        tenant_id: null,
        tenant_name: null,
      },
      updated_at: "2026-06-22T00:07:00.000Z",
    },
  ],
};

const sampleBetaAccessRequestTriageReceiptReport: FounderAdminBetaAccessRequestTriageReceiptReport =
  {
    authorized: true,
    generated_at: "2026-06-22T00:07:30.000Z",
    rows: [
      {
        app_origin: "https://outpost-preview.example.vercel.app",
        created_at: "2026-06-22T00:07:30.000Z",
        decision: "ready_for_operator_fulfillment",
        id: "owner_beta_request_triage_abc123",
        launch_enablement_allowed: false,
        neon_branch_name: "outpost-beta-access-scoped-proof",
        owner_email: "owner@summitstrength.example",
        packet_path:
          "artifacts/admin-launch-readiness/owner-beta-request-abc123-beta-request-triage.json",
        packet_sha256: "7".repeat(64),
        public_self_serve_launch_allowed: false,
        recorded_at: "2026-06-22T00:07:30.000Z",
        request_id: "owner_beta_request_abc123",
        review_note_present: true,
        reviewer_label: "Krish",
        status: "owner_beta_request_triage_recorded",
        summary: {
          request_status: "new",
          launch_enablement_allowed: false,
        },
      },
    ],
  };

const sampleBetaAccessRequestFollowThroughOutcomeReport: FounderAdminBetaAccessRequestFollowThroughOutcomeReport =
  {
    authorized: true,
    generated_at: "2026-06-22T00:09:30.000Z",
    rows: [
      {
        app_origin: "https://outpost-preview.example.vercel.app",
        created_at: "2026-06-22T00:09:30.000Z",
        followthrough_packet_path:
          "artifacts/admin-launch-readiness/owner-beta-request-abc123-beta-request-followthrough.json",
        followthrough_packet_sha256: "8".repeat(64),
        id: "owner_beta_request_followthrough_abc123",
        launch_enablement_allowed: false,
        neon_branch_name: "outpost-beta-access-scoped-proof",
        outcome: "operator_handoff_completed",
        owner_email: "owner@summitstrength.example",
        public_self_serve_launch_allowed: false,
        recorded_at: "2026-06-22T00:09:30.000Z",
        request_id: "owner_beta_request_abc123",
        review_note_present: true,
        reviewer_label: "Krish",
        status: "owner_beta_request_followthrough_outcome_recorded",
        summary: {
          launch_enablement_allowed: false,
          public_self_serve_launch_allowed: false,
          triage_packet_sha256: "7".repeat(64),
          triage_receipt_id: "owner_beta_request_triage_abc123",
        },
      },
    ],
  };

describe("admin portal readiness console", () => {
  it("derives a secret-free hosted proof status ledger", () => {
    const ledger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      hostedNeonConfigured: true,
      mode: "hosted",
      report: sampleReport,
    });

    expect(ledger.previewUrl).toBe(
      "https://outpost-preview.example.vercel.app",
    );
    expect(ledger.branchName).toBe("outpost-beta-access-scoped-proof");
    expect(ledger.generatedAt).toBe(sampleReport.generated_at);
    expect(ledger.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Hosted beta workflow proof",
          state: "pending",
        }),
        expect.objectContaining({
          label: "Admin portal proof",
          state: "pending",
        }),
        expect.objectContaining({
          label: "Preview deployment URL",
          state: "pending",
        }),
        expect.objectContaining({
          label: "Customer-observed handoff",
          state: "pending",
        }),
        expect.objectContaining({
          label: "Live-provider gates",
          state: "blocked",
        }),
      ]),
    );
    expect(ledger.proofCommands.map((entry) => entry.command)).toEqual([
      "npm run vercel:preview:verify",
      "npm run hosted:admin-portal-readiness",
      "npm run hosted:beta-request-browser-proof",
      "npm run hosted:beta-request-chain-proof",
      "npm run hosted:beta-proof-run:summary",
      "npm run hosted:beta-proof-run:summary:inspect",
      "npm run hosted:beta-proof-run:record",
      "npm run hosted:beta-proof-run:record-proof",
      "npm run admin:customer-session:record-hosted",
      "npm run hosted:customer-session-record:proof",
      "npm run beta:owner-handoff:record",
      "npm run hosted:launch-package:record-proof",
      "npm run hosted:launch-decision:packet",
      "npm run admin:launch-decision:record",
      "npm run admin:launch-decision:followthrough",
      "npm run admin:self-serve-rehearsal:packet",
      "npm run admin:self-serve-rehearsal:record",
      "npm run admin:beta-request:triage-packet",
      "npm run admin:beta-request:triage-record",
      "npm run admin:beta-request:followthrough",
      "npm run admin:beta-request:followthrough-record",
      "npm run beta:owner-handoff:complete",
      "npm run beta:owner-handoff:gate",
    ]);
    expect(JSON.stringify(ledger)).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role/iu,
    );
  });

  it("derives ready hosted proof gates only from passed proof run records", () => {
    const ledger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      betaProofRunSummaryRecordReport: sampleBetaProofRunSummaryRecordReport,
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      launchDecisionRecordReport: sampleLaunchDecisionRecordReport,
      launchPackageRecordReport: sampleLaunchPackageRecordReport,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });

    expect(ledger.generatedAt).toBe(
      sampleLaunchDecisionRecordReport.generated_at,
    );
    expect(ledger.betaProofRunSummaryRecords).toHaveLength(1);
    expect(ledger.customerHandoffGateRecords).toHaveLength(1);
    expect(ledger.launchPackageRecords).toHaveLength(1);
    expect(ledger.launchDecisionRecords).toHaveLength(3);
    expect(ledger.launchPackageRecords[0]).toEqual(
      expect.objectContaining({
        customer_handoff_recorded: true,
        gym_name: "Summit Strength",
        public_self_serve_launch_allowed: false,
      }),
    );
    expect(ledger.proofRuns).toHaveLength(2);
    expect(ledger.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Hosted beta workflow proof",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Admin portal proof",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Preview deployment URL",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Customer-observed handoff",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Live-provider gates",
          state: "blocked",
        }),
      ]),
    );
    expect(JSON.stringify(ledger.proofRuns)).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|cookie|token/iu,
    );
  });

  it("only surfaces customer session records from authorized founder-admin reports", () => {
    const authorizedLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      customerSessionRecordReport: sampleCustomerSessionRecordReport,
      hostedNeonConfigured: true,
      mode: "hosted",
      report: sampleReport,
    });

    const unauthorizedLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      customerSessionRecordReport: {
        ...sampleCustomerSessionRecordReport,
        authorized: false,
      },
      hostedNeonConfigured: true,
      mode: "hosted",
      report: sampleReport,
    });

    expect(authorizedLedger.customerSessionRecords).toEqual([
      sampleCustomerSessionRecord,
    ]);
    expect(unauthorizedLedger.customerSessionRecords).toEqual([]);
  });

  it("derives a terminal-only Admin operator next-action queue", () => {
    const ledger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      betaProofRunSummaryRecordReport: sampleBetaProofRunSummaryRecordReport,
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      launchDecisionRecordReport: sampleLaunchDecisionRecordReport,
      launchPackageRecordReport: sampleLaunchPackageRecordReport,
      mode: "hosted",
      operatorSelfServeRehearsalReport: sampleOperatorSelfServeRehearsalReport,
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });
    const queue = founderAdminOperatorActionQueue({
      betaAccessRequestReport: sampleBetaAccessRequestReport,
      proofLedger: ledger,
      report: sampleReport,
    });

    expect(queue.title).toBe("Operator next-action queue");
    expect(queue.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "protected_preview_proof",
          state: "done",
        }),
        expect.objectContaining({ id: "beta_proof_digest", state: "done" }),
        expect.objectContaining({ id: "proof_freshness", state: "done" }),
        expect.objectContaining({
          id: "launch_readiness_export",
          state: "next",
        }),
      ]),
    );
    expect(queue.nextAction).toEqual(
      expect.objectContaining({
        command: expect.stringContaining("admin:launch-readiness:export"),
      }),
    );
    expect(queue.exportCommand.command).toContain(
      "npm run admin:next-actions:export",
    );
    expect(queue.inspectCommand.command).toContain(
      "npm run admin:next-actions:inspect",
    );
    expect(queue.blockedGates).toEqual(
      expect.arrayContaining([
        "Public self-serve launch",
        "Phone/email providers",
        "POS/access control/member-ledger writes",
      ]),
    );
    expect(
      `${queue.exportCommand.command}${JSON.stringify(queue)}`,
    ).not.toMatch(
      /sendInvite|sendEmail|enableProvider|NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role/iu,
    );
  });

  it("prioritizes proof freshness drift before downstream launch actions", () => {
    const staleOperatorSelfServeRehearsalReport: FounderAdminOperatorSelfServeRehearsalReport =
      {
        ...sampleOperatorSelfServeRehearsalReport,
        rows: [
          {
            ...sampleOperatorSelfServeRehearsalReport.rows[0],
            app_origin: "https://old-preview.example.vercel.app",
          },
        ],
      };
    const staleLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      betaProofRunSummaryRecordReport: sampleBetaProofRunSummaryRecordReport,
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      launchDecisionRecordReport: sampleLaunchDecisionRecordReport,
      launchPackageRecordReport: sampleLaunchPackageRecordReport,
      mode: "hosted",
      operatorSelfServeRehearsalReport: staleOperatorSelfServeRehearsalReport,
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });
    const queue = founderAdminOperatorActionQueue({
      betaAccessRequestReport: sampleBetaAccessRequestReport,
      proofLedger: staleLedger,
      report: sampleReport,
    });

    expect(queue.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "proof_freshness",
          label: "Resolve proof freshness",
          state: "next",
        }),
        expect.objectContaining({
          id: "launch_readiness_export",
          state: "next",
        }),
      ]),
    );
    expect(queue.nextAction).toEqual(
      expect.objectContaining({
        command: expect.stringContaining("admin:proof-freshness:export"),
        id: "proof_freshness",
      }),
    );
    expect(queue.exportCommand.command).toContain(
      "OUTPOST_ADMIN_NEXT_ACTIONS_FRESHNESS_STATE='stale'",
    );
  });

  it("derives terminal-only Admin handoff readiness packet commands", () => {
    const ledger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      betaProofRunSummaryRecordReport: sampleBetaProofRunSummaryRecordReport,
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      launchDecisionRecordReport: sampleLaunchDecisionRecordReport,
      launchPackageRecordReport: sampleLaunchPackageRecordReport,
      mode: "hosted",
      operatorSelfServeRehearsalReport: sampleOperatorSelfServeRehearsalReport,
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });
    const packet = founderAdminHandoffReadinessPacket({
      betaAccessRequestReport: sampleBetaAccessRequestReport,
      proofLedger: ledger,
      report: sampleReport,
    });

    expect(packet.title).toBe("Handoff readiness packet");
    expect(packet.packetPath).toContain(
      "outpost-beta-access-scoped-proof-handoff-readiness-packet.json",
    );
    expect(packet.exportCommand.command).toContain(
      "npm run admin:handoff-readiness:packet",
    );
    expect(packet.inspectCommand.command).toContain(
      "npm run admin:handoff-readiness:inspect",
    );
    expect(packet.hostedProofCommand.command).toContain(
      "npm run admin:handoff-readiness:hosted-proof",
    );
    expect(packet.prerequisites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Proof freshness", state: "ready" }),
        expect.objectContaining({
          label: "No-live-provider gates",
          state: "ready",
        }),
      ]),
    );
    expect(
      `${packet.exportCommand.command}${JSON.stringify(packet)}`,
    ).not.toMatch(
      /sendInvite|sendEmail|enableProvider|NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role/iu,
    );
  });

  it("derives beta request lifecycle state without adding a browser write path", () => {
    const pendingLifecycle = founderAdminBetaAccessRequestLifecycle(
      sampleBetaAccessRequestReport.rows[0],
    );

    expect(pendingLifecycle).toEqual([
      expect.objectContaining({ label: "Request queued", state: "ready" }),
      expect.objectContaining({ label: "Operator review", state: "pending" }),
      expect.objectContaining({ label: "Access fulfilled", state: "pending" }),
      expect.objectContaining({ label: "Owner signed in", state: "blocked" }),
      expect.objectContaining({
        label: "Workspace bootstrapped",
        state: "blocked",
      }),
      expect.objectContaining({ label: "Handoff ready", state: "blocked" }),
    ]);

    const fulfilledRequest = {
      ...sampleBetaAccessRequestReport.rows[0],
      fulfillment: {
        fulfilled: true,
        fulfilled_at: "2026-06-22T00:08:00.000Z",
        grant_linked: true,
        note_present: true,
      },
      fulfillment_receipt: sampleFulfillmentReceipt,
      grant: {
        present: true,
        status: "active",
      },
      owner_account: {
        app_user_present: true,
        auth_linked: true,
      },
      status: "approved" as const,
      tenant_bootstrap: {
        tenant_id: "tenant_northside",
        tenant_name: "Summit Strength",
      },
    };
    const readyLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app/",
      betaAccessRequestTriageReceiptReport:
        sampleBetaAccessRequestTriageReceiptReport,
      branchName: "outpost-beta-access-scoped-proof",
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      handoffPacketRecordReport: sampleHandoffPacketRecordReport,
      hostedNeonConfigured: true,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });

    expect(
      founderAdminBetaAccessRequestLifecycle(fulfilledRequest, readyLedger),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Access fulfilled", state: "ready" }),
        expect.objectContaining({ label: "Owner signed in", state: "ready" }),
        expect.objectContaining({
          label: "Workspace bootstrapped",
          state: "ready",
        }),
        expect.objectContaining({
          detail: expect.stringContaining("customer-observed proof"),
          label: "Handoff ready",
          state: "ready",
        }),
      ]),
    );
    const triage = founderAdminBetaRequestTriageReadiness(
      sampleBetaAccessRequestReport.rows[0],
      readyLedger,
    );
    expect(triage).toEqual(
      expect.objectContaining({
        state: "ready",
        summary: "Triage recorded as ready for operator fulfillment by Krish.",
      }),
    );
    expect(triage.packetCommand).toContain(
      "npm run admin:beta-request:triage-packet",
    );
    expect(triage.recordCommand).toContain(
      "npm run admin:beta-request:triage-record",
    );
    const followThrough = founderAdminBetaRequestFollowThroughReadiness(
      sampleBetaAccessRequestReport.rows[0],
      readyLedger,
    );
    expect(followThrough).toEqual(
      expect.objectContaining({
        state: "ready",
        summary:
          "Reviewed triage can move to terminal-only owner access fulfillment.",
        title: "Ready for follow-through",
      }),
    );
    expect(followThrough.command).toContain(
      "npm run admin:beta-request:followthrough",
    );
    expect(followThrough.recordCommand).toContain(
      "npm run admin:beta-request:followthrough-record",
    );

    const outcomeLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      betaAccessRequestFollowThroughOutcomeReport:
        sampleBetaAccessRequestFollowThroughOutcomeReport,
      betaProofRunSummaryRecordReport: sampleBetaProofRunSummaryRecordReport,
      betaAccessRequestTriageReceiptReport:
        sampleBetaAccessRequestTriageReceiptReport,
      branchName: "outpost-beta-access-scoped-proof",
      hostedNeonConfigured: true,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });
    const recordedFollowThrough = founderAdminBetaRequestFollowThroughReadiness(
      sampleBetaAccessRequestReport.rows[0],
      outcomeLedger,
    );
    expect(recordedFollowThrough).toEqual(
      expect.objectContaining({
        state: "ready",
        summary: "Follow-through outcome recorded 2026-06-22T00:09:30.000Z.",
        title: "Outcome recorded",
      }),
    );
    expect(recordedFollowThrough.outcome).toEqual(
      expect.objectContaining({
        outcome: "operator_handoff_completed",
        reviewer_label: "Krish",
      }),
    );

    const pendingFollowThrough = founderAdminBetaRequestFollowThroughReadiness(
      sampleBetaAccessRequestReport.rows[0],
    );
    expect(pendingFollowThrough).toEqual(
      expect.objectContaining({
        state: "pending",
        title: "Waiting on triage",
      }),
    );

    const blockedTriageLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      betaAccessRequestTriageReceiptReport: {
        ...sampleBetaAccessRequestTriageReceiptReport,
        rows: [
          {
            ...sampleBetaAccessRequestTriageReceiptReport.rows[0],
            decision: "needs_followup",
          },
        ],
      },
      branchName: "outpost-beta-access-scoped-proof",
      hostedNeonConfigured: true,
      mode: "hosted",
      report: sampleReport,
    });
    const blockedFollowThrough = founderAdminBetaRequestFollowThroughReadiness(
      sampleBetaAccessRequestReport.rows[0],
      blockedTriageLedger,
    );
    expect(blockedFollowThrough).toEqual(
      expect.objectContaining({
        state: "blocked",
        title: "Follow-through blocked",
      }),
    );
    expect(blockedFollowThrough.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining("needs follow-up")]),
    );
    expect(
      JSON.stringify(
        founderAdminBetaAccessRequestLifecycle(fulfilledRequest, readyLedger),
      ),
    ).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|password|token/iu,
    );
  });

  it("derives an end-to-end owner onboarding timeline from existing proof projections", () => {
    const pendingTimeline = founderAdminOwnerOnboardingTimeline(
      sampleBetaAccessRequestReport.rows[0],
    );

    expect(pendingTimeline).toEqual([
      expect.objectContaining({ label: "Beta request", state: "ready" }),
      expect.objectContaining({
        label: "Fulfillment receipt",
        state: "pending",
      }),
      expect.objectContaining({ label: "Owner sign-in", state: "blocked" }),
      expect.objectContaining({
        label: "Workspace bootstrap",
        state: "blocked",
      }),
      expect.objectContaining({ label: "Handoff packet", state: "blocked" }),
      expect.objectContaining({ label: "Reset or rollback", state: "blocked" }),
    ]);

    const fulfilledRequest = {
      ...sampleBetaAccessRequestReport.rows[0],
      fulfillment: {
        fulfilled: true,
        fulfilled_at: "2026-06-22T00:08:00.000Z",
        grant_linked: true,
        note_present: true,
      },
      fulfillment_receipt: sampleFulfillmentReceipt,
      grant: {
        present: true,
        status: "active",
      },
      owner_account: {
        app_user_present: true,
        auth_linked: true,
      },
      status: "approved" as const,
      tenant_bootstrap: {
        tenant_id: "tenant_northside",
        tenant_name: "Summit Strength",
      },
    };
    const matchingOwnerReadinessRow = {
      ...sampleReport.rows[0],
      owner_email: fulfilledRequest.email,
      rollback_readiness: {
        reason:
          "Disposable dry-run tenant shape matches the guarded rollback path.",
        state: "dry_run_rollback_ready" as const,
      },
      tenant_bootstrap: {
        ...sampleReport.rows[0].tenant_bootstrap,
        tenant_id: "tenant_northside",
        tenant_name: "Summit Strength",
      },
    };
    const readyLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });

    expect(
      founderAdminOwnerOnboardingTimeline(
        fulfilledRequest,
        readyLedger,
        matchingOwnerReadinessRow,
      ),
    ).toEqual([
      expect.objectContaining({ label: "Beta request", state: "ready" }),
      expect.objectContaining({ label: "Fulfillment receipt", state: "ready" }),
      expect.objectContaining({ label: "Owner sign-in", state: "ready" }),
      expect.objectContaining({ label: "Workspace bootstrap", state: "ready" }),
      expect.objectContaining({
        detail: expect.stringContaining("customer-observed proof is recorded"),
        label: "Handoff packet",
        state: "ready",
      }),
      expect.objectContaining({
        detail: expect.stringContaining("Disposable dry-run tenant shape"),
        label: "Reset or rollback",
        state: "ready",
      }),
    ]);

    const missingReceiptTimeline = founderAdminOwnerOnboardingTimeline(
      {
        ...fulfilledRequest,
        fulfillment_receipt: null,
      },
      readyLedger,
      matchingOwnerReadinessRow,
    );

    expect(missingReceiptTimeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: expect.stringContaining("receipt is missing"),
          label: "Fulfillment receipt",
          state: "attention",
        }),
      ]),
    );
    expect(JSON.stringify(missingReceiptTimeline)).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|password|token/iu,
    );

    for (const status of ["declined", "superseded"] as const) {
      const archivedTimeline = founderAdminOwnerOnboardingTimeline({
        ...fulfilledRequest,
        status,
      });

      expect(archivedTimeline).toHaveLength(6);
      expect(archivedTimeline).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: "Beta request", state: "blocked" }),
          expect.objectContaining({
            label: "Fulfillment receipt",
            state: "blocked",
          }),
          expect.objectContaining({ label: "Owner sign-in", state: "blocked" }),
          expect.objectContaining({
            label: "Workspace bootstrap",
            state: "blocked",
          }),
          expect.objectContaining({
            label: "Handoff packet",
            state: "blocked",
          }),
          expect.objectContaining({
            label: "Reset or rollback",
            state: "blocked",
          }),
        ]),
      );
    }
  });

  it("derives beta request fulfillment preflight without adding a browser write path", () => {
    const readyPreflight = founderAdminBetaFulfillmentPreflight(
      sampleBetaAccessRequestReport.rows[0],
    );

    expect(readyPreflight).toEqual(
      expect.objectContaining({
        detail: expect.stringContaining("ready for CLI fulfillment"),
        state: "ready",
        title: "Ready for CLI fulfillment",
      }),
    );
    expect(readyPreflight.command).toContain(
      "npm run beta:operator:request-preflight",
    );
    expect(readyPreflight.command).toContain(
      "OUTPOST_OWNER_BETA_REQUEST_EMAIL='owner@summitstrength.example'",
    );
    expect(JSON.stringify(readyPreflight)).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|password|token/iu,
    );

    const attentionPreflight = founderAdminBetaFulfillmentPreflight({
      ...sampleBetaAccessRequestReport.rows[0],
      grant: {
        present: true,
        status: "active",
      },
      owner_account: {
        app_user_present: true,
        auth_linked: true,
      },
      tenant_bootstrap: {
        tenant_id: "tenant_northside",
        tenant_name: "Summit Strength",
      },
    });

    expect(attentionPreflight).toEqual(
      expect.objectContaining({
        state: "attention",
        title: "Needs operator review",
      }),
    );
    expect(attentionPreflight.reasons).toEqual(
      expect.arrayContaining([
        "An owner beta access grant already exists.",
        "An app user already exists for this owner email.",
        "The owner email is already linked to Neon Auth.",
        "Workspace bootstrap already exists for Summit Strength.",
      ]),
    );

    const blockedPreflight = founderAdminBetaFulfillmentPreflight({
      ...sampleBetaAccessRequestReport.rows[0],
      provider_gate: {
        unexpected_live_records: 1,
      },
      status: "superseded",
    });

    expect(blockedPreflight).toEqual(
      expect.objectContaining({
        state: "blocked",
        title: "Preflight blocked",
      }),
    );
    expect(blockedPreflight.reasons).toEqual(
      expect.arrayContaining([
        "Request is superseded; use the latest request for this owner email.",
        "Unexpected live-provider records exist for the linked tenant.",
      ]),
    );
  });

  it("derives a protected operator sequence without exposing secrets", () => {
    const pendingSequence = founderAdminBetaRequestOperatorSequence(
      sampleBetaAccessRequestReport.rows[0],
    );

    expect(pendingSequence.title).toBe("Protected operator sequence");
    expect(pendingSequence.steps).toEqual([
      expect.objectContaining({
        command: expect.stringContaining(
          "npm run beta:operator:request-preflight",
        ),
        label: "1. Dry-run preflight",
        state: "ready",
      }),
      expect.objectContaining({
        command: expect.stringContaining(
          "npm run beta:operator:request-fulfillment",
        ),
        label: "2. Fulfill owner access",
        state: "attention",
      }),
      expect.objectContaining({
        command: "npm run hosted:request-fulfillment-proof",
        label: "3. Verify protected Preview",
        state: "blocked",
      }),
      expect.objectContaining({
        command: expect.stringContaining(
          "npm run hosted:owner-handoff:prepare",
        ),
        label: "4. Prepare owner handoff",
        state: "blocked",
      }),
      expect.objectContaining({
        command: expect.stringContaining("npm run beta:owner-handoff:message"),
        label: "5. Draft owner message",
        state: "blocked",
      }),
    ]);
    expect(JSON.stringify(pendingSequence)).toContain(
      "OUTPOST_OWNER_BETA_PASSWORD='<temporary-password>'",
    );
    expect(JSON.stringify(pendingSequence)).toContain(
      "OUTPOST_OWNER_BETA_REQUEST_FULFILLMENT_NOTE='<operator-note-without-secrets>'",
    );
    expect(JSON.stringify(pendingSequence)).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|cookie|jwt|napi_[a-z0-9]+/iu,
    );

    const fulfilledRequest = {
      ...sampleBetaAccessRequestReport.rows[0],
      fulfillment: {
        fulfilled: true,
        fulfilled_at: "2026-06-22T00:08:00.000Z",
        grant_linked: true,
        note_present: true,
      },
      fulfillment_receipt: sampleFulfillmentReceipt,
      grant: {
        present: true,
        status: "active",
      },
      owner_account: {
        app_user_present: true,
        auth_linked: true,
      },
      tenant_bootstrap: {
        tenant_id: "tenant_northside",
        tenant_name: "Summit Strength",
      },
    };
    const fulfilledSequence =
      founderAdminBetaRequestOperatorSequence(fulfilledRequest);

    expect(fulfilledSequence.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "2. Fulfill owner access",
          state: "ready",
        }),
        expect.objectContaining({
          label: "3. Verify protected Preview",
          state: "attention",
        }),
        expect.objectContaining({
          command: expect.stringContaining(
            "OUTPOST_BETA_HANDOFF_BUNDLE_PATH='artifacts/beta-owner-handoff/summit-strength-handoff-bundle.json'",
          ),
          label: "4. Prepare owner handoff",
          state: "ready",
        }),
        expect.objectContaining({
          command: expect.stringContaining(
            "OUTPOST_BETA_HANDOFF_BUNDLE_PATH='artifacts/beta-owner-handoff/summit-strength-handoff-bundle.json'",
          ),
          label: "5. Draft owner message",
          state: "attention",
        }),
      ]),
    );

    const readyLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });

    expect(
      founderAdminBetaRequestOperatorSequence(fulfilledRequest, readyLedger)
        .steps,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "3. Verify protected Preview",
          state: "ready",
        }),
      ]),
    );

    const declinedSequence = founderAdminBetaRequestOperatorSequence({
      ...sampleBetaAccessRequestReport.rows[0],
      status: "declined",
    });

    expect(declinedSequence.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "1. Dry-run preflight",
          state: "blocked",
        }),
        expect.objectContaining({
          label: "2. Fulfill owner access",
          state: "blocked",
        }),
        expect.objectContaining({
          label: "3. Verify protected Preview",
          state: "blocked",
        }),
        expect.objectContaining({
          label: "5. Draft owner message",
          state: "blocked",
        }),
      ]),
    );
  });

  it("derives a pre-self-serve readiness matrix that keeps launch blocked", () => {
    const readyLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });
    const fulfilledRequestReport: FounderAdminBetaAccessRequestReport = {
      ...sampleBetaAccessRequestReport,
      rows: [
        {
          ...sampleBetaAccessRequestReport.rows[0],
          fulfillment: {
            fulfilled: true,
            fulfilled_at: "2026-06-22T00:08:00.000Z",
            grant_linked: true,
            note_present: true,
          },
          fulfillment_receipt: sampleFulfillmentReceipt,
          grant: {
            present: true,
            status: "active",
          },
        },
      ],
    };
    const readiness = founderAdminSelfServeReadiness({
      betaAccessRequestReport: fulfilledRequestReport,
      proofLedger: readyLedger,
      report: sampleReport,
    });

    expect(readiness.title).toBe("Pre-self-serve readiness");
    expect(readiness.gates).toEqual([
      expect.objectContaining({
        label: "Protected Preview proof",
        state: "ready",
      }),
      expect.objectContaining({
        label: "Operator fulfillment path",
        state: "ready",
      }),
      expect.objectContaining({
        label: "Reset and rollback readiness",
        state: "ready",
      }),
      expect.objectContaining({
        label: "Customer-observed handoff",
        state: "ready",
      }),
      expect.objectContaining({
        label: "Live-provider and billing gates",
        state: "blocked",
      }),
      expect.objectContaining({
        label: "Public self-serve launch",
        state: "blocked",
      }),
    ]);
    expect(JSON.stringify(readiness)).toContain("public owner onboarding");
    expect(JSON.stringify(readiness)).toContain("Do not enable public signup");
    expect(JSON.stringify(readiness)).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|password|token/iu,
    );

    const pendingReadiness = founderAdminSelfServeReadiness({
      betaAccessRequestReport: sampleBetaAccessRequestReport,
      proofLedger: founderAdminProofStatusLedger({
        appOrigin: "https://outpost-preview.example.vercel.app",
        branchName: "outpost-beta-access-scoped-proof",
        hostedNeonConfigured: true,
        mode: "hosted",
        report: sampleReport,
      }),
      report: sampleReport,
    });

    expect(pendingReadiness.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Protected Preview proof",
          state: "pending",
        }),
        expect.objectContaining({
          label: "Operator fulfillment path",
          state: "pending",
        }),
        expect.objectContaining({
          label: "Customer-observed handoff",
          state: "blocked",
        }),
        expect.objectContaining({
          label: "Public self-serve launch",
          state: "blocked",
        }),
      ]),
    );

    const providerAttentionReadiness = founderAdminSelfServeReadiness({
      betaAccessRequestReport: fulfilledRequestReport,
      proofLedger: readyLedger,
      report: {
        ...sampleReport,
        rows: [
          {
            ...sampleReport.rows[0],
            provider_gate: {
              state: "attention",
              unexpected_live_records: 2,
            },
          },
        ],
      },
    });

    expect(providerAttentionReadiness.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: expect.stringContaining(
            "2 unexpected live-provider records need review",
          ),
          label: "Live-provider and billing gates",
          state: "blocked",
        }),
      ]),
    );

    const unauthorizedReadiness = founderAdminSelfServeReadiness({
      betaAccessRequestReport: {
        ...fulfilledRequestReport,
        authorized: false,
      },
      proofLedger: readyLedger,
      report: {
        ...sampleReport,
        authorized: false,
      },
    });

    expect(unauthorizedReadiness.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Operator fulfillment path",
          state: "blocked",
        }),
        expect.objectContaining({
          label: "Reset and rollback readiness",
          state: "blocked",
        }),
      ]),
    );
  });

  it("derives a sanitized launch-readiness export command from proof state", () => {
    const readyLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });
    const fulfilledRequestReport: FounderAdminBetaAccessRequestReport = {
      ...sampleBetaAccessRequestReport,
      rows: [
        {
          ...sampleBetaAccessRequestReport.rows[0],
          fulfillment: {
            fulfilled: true,
            fulfilled_at: "2026-06-22T00:08:00.000Z",
            grant_linked: true,
            note_present: true,
          },
          fulfillment_receipt: sampleFulfillmentReceipt,
          grant: {
            present: true,
            status: "active",
          },
        },
      ],
    };
    const exportProjection = founderAdminLaunchReadinessExport({
      betaAccessRequestReport: fulfilledRequestReport,
      proofLedger: readyLedger,
      report: sampleReport,
    });

    expect(exportProjection.title).toBe("Launch-readiness export");
    expect(exportProjection.exportPath).toBe(
      "artifacts/admin-launch-readiness/outpost-beta-access-scoped-proof-launch-readiness.json",
    );
    expect(exportProjection.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Protected Preview proof",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Operator fulfillment path",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Customer-observed handoff",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Live-provider and billing gates",
          state: "blocked",
        }),
        expect.objectContaining({
          label: "Public self-serve launch",
          state: "blocked",
        }),
        expect.objectContaining({ label: "Export artifact", state: "ready" }),
      ]),
    );
    expect(exportProjection.commands[0]).toEqual(
      expect.objectContaining({
        command: expect.stringContaining(
          "npm run admin:launch-readiness:export",
        ),
        label: "Write launch-readiness export",
        state: "ready",
      }),
    );
    expect(exportProjection.commands[0].command).toContain(
      "OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH=",
    );
    expect(exportProjection.commands[0].command).toContain(
      "OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_URL='https://outpost-preview.example.vercel.app'",
    );
    expect(exportProjection.commands[0].command).toContain(
      "OUTPOST_NEON_BRANCH_NAME='outpost-beta-access-scoped-proof'",
    );
    expect(exportProjection.commands[0].command).toContain(
      "OUTPOST_ADMIN_LAUNCH_READINESS_CUSTOMER_HANDOFF='ready'",
    );
    expect(exportProjection.commands[0].command).toContain(
      "OUTPOST_ADMIN_LAUNCH_READINESS_FULFILLMENT='ready'",
    );
    expect(exportProjection.commands[1].command).toContain(
      "npm run admin:launch-readiness:inspect",
    );
    expect(exportProjection.nonGoals).toEqual(
      expect.arrayContaining([
        "No browser approval buttons.",
        "No phone/email provider activation.",
        "No billing, POS, access control, or member-ledger writes.",
      ]),
    );
    expect(JSON.stringify(exportProjection)).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|password|token|napi_[a-z0-9]+/iu,
    );
  });

  it("blocks launch-readiness export when hosted Preview state is missing or local", () => {
    const localLedger = founderAdminProofStatusLedger({
      appOrigin: "http://localhost:3000",
      branchName: "",
      hostedNeonConfigured: false,
      mode: "local",
      report: sampleReport,
    });
    const exportProjection = founderAdminLaunchReadinessExport({
      betaAccessRequestReport: sampleBetaAccessRequestReport,
      proofLedger: localLedger,
      report: sampleReport,
    });

    expect(exportProjection.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Export artifact", state: "blocked" }),
      ]),
    );
    expect(exportProjection.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Write launch-readiness export",
          state: "blocked",
        }),
        expect.objectContaining({
          label: "Inspect launch-readiness export",
          state: "blocked",
        }),
      ]),
    );
    expect(exportProjection.commands[0].detail).toContain(
      "Missing runtime evidence",
    );
    expect(exportProjection.commands[0].command).toContain(
      "OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_URL='<protected-preview-url>'",
    );
    expect(exportProjection.commands[0].command).toContain(
      "OUTPOST_NEON_BRANCH_NAME='<neon-proof-branch>'",
    );
    expect(exportProjection.commands[0].command).not.toContain(
      "http://localhost:3000",
    );
    expect(exportProjection.commands[0].command).not.toContain(
      "Neon branch missing",
    );
    expect(JSON.stringify(exportProjection)).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|napi_[a-z0-9]+/iu,
    );
  });

  it("derives a read-only launch promotion gate from the launch-readiness export", () => {
    const readyLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });
    const fulfilledRequestReport: FounderAdminBetaAccessRequestReport = {
      ...sampleBetaAccessRequestReport,
      rows: [
        {
          ...sampleBetaAccessRequestReport.rows[0],
          fulfillment: {
            fulfilled: true,
            fulfilled_at: "2026-06-22T00:08:00.000Z",
            grant_linked: true,
            note_present: true,
          },
          fulfillment_receipt: sampleFulfillmentReceipt,
          grant: {
            present: true,
            status: "active",
          },
        },
      ],
    };
    const promotionGate = founderAdminLaunchPromotionGate({
      betaAccessRequestReport: fulfilledRequestReport,
      proofLedger: readyLedger,
      report: sampleReport,
    });

    expect(promotionGate.title).toBe("Launch promotion gate");
    expect(promotionGate.promotionPath).toBe(
      "artifacts/admin-launch-readiness/outpost-beta-access-scoped-proof-promotion-candidate.json",
    );
    expect(promotionGate.releaseNotePath).toBe(
      "artifacts/admin-launch-readiness/outpost-beta-access-scoped-proof-promotion-release-note.md",
    );
    expect(promotionGate.bundlePath).toBe(
      "artifacts/admin-launch-readiness/outpost-beta-access-scoped-proof-launch-bundle.json",
    );
    expect(promotionGate.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Protected Preview proof",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Operator fulfillment path",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Reset and rollback readiness",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Customer-observed handoff",
          state: "ready",
        }),
        expect.objectContaining({ label: "Export artifact", state: "ready" }),
        expect.objectContaining({
          label: "Live-provider and billing gates",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Public self-serve remains blocked",
          state: "ready",
        }),
      ]),
    );
    expect(promotionGate.commands[0]).toEqual(
      expect.objectContaining({
        command: expect.stringContaining(
          "npm run admin:launch-readiness:promote",
        ),
        label: "Check launch promotion candidate",
        state: "ready",
      }),
    );
    expect(promotionGate.commands[0].command).toContain(
      "OUTPOST_ADMIN_LAUNCH_READINESS_EXPORT_PATH=",
    );
    expect(promotionGate.commands[0].command).toContain(
      "OUTPOST_ADMIN_LAUNCH_READINESS_PROMOTION_PATH=",
    );
    expect(promotionGate.commands[1]).toEqual(
      expect.objectContaining({
        command: expect.stringContaining(
          "npm run admin:launch-readiness:release-note",
        ),
        label: "Write release-note artifact",
        state: "pending",
      }),
    );
    expect(promotionGate.commands[1].command).toContain(
      "OUTPOST_ADMIN_LAUNCH_READINESS_PROMOTION_PATH=",
    );
    expect(promotionGate.commands[1].command).toContain(
      "OUTPOST_ADMIN_LAUNCH_READINESS_RELEASE_NOTE_PATH=",
    );
    expect(promotionGate.commands[2]).toEqual(
      expect.objectContaining({
        command: expect.stringContaining(
          "npm run admin:launch-readiness:bundle",
        ),
        label: "Write launch-readiness bundle",
        state: "pending",
      }),
    );
    expect(promotionGate.commands[2].command).toContain(
      "OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH=",
    );
    expect(promotionGate.commands[2].command).toContain(
      "OUTPOST_ADMIN_LAUNCH_READINESS_PREVIEW_URL=",
    );
    expect(promotionGate.commands[3]).toEqual(
      expect.objectContaining({
        command: expect.stringContaining(
          "npm run admin:launch-readiness:bundle:inspect",
        ),
        label: "Inspect launch-readiness bundle",
        state: "pending",
      }),
    );
    expect(promotionGate.commands[3].command).toContain(
      "OUTPOST_ADMIN_LAUNCH_READINESS_BUNDLE_PATH=",
    );
    expect(promotionGate.nonGoals).toEqual(
      expect.arrayContaining([
        "No public launch approval.",
        "No browser mutation or approval button.",
        "No phone/email provider activation.",
      ]),
    );
    expect(JSON.stringify(promotionGate)).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|password|token|napi_[a-z0-9]+/iu,
    );
  });

  it("derives launch package readiness from matching hosted proof and package records", () => {
    const pendingLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });
    const pendingReadiness = founderAdminLaunchPackageReadiness(pendingLedger);

    expect(pendingReadiness.title).toBe("Launch package proof");
    expect(pendingReadiness.command).toEqual(
      expect.objectContaining({
        command: "npm run hosted:launch-package:record-proof",
        label: "Verify and import launch package record",
        state: "pending",
      }),
    );
    expect(pendingReadiness.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Protected Preview proof",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Admin portal proof",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Customer-observed handoff",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Launch package record",
          state: "pending",
        }),
        expect.objectContaining({
          label: "Public self-serve remains blocked",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Live-provider gates remain blocked",
          state: "ready",
        }),
      ]),
    );
    expect(JSON.stringify(pendingReadiness)).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|password|token|napi_[a-z0-9]+/iu,
    );

    const readyReadiness = founderAdminLaunchPackageReadiness(
      founderAdminProofStatusLedger({
        appOrigin: "https://outpost-preview.example.vercel.app",
        branchName: "outpost-beta-access-scoped-proof",
        customerHandoffGateReport: sampleCustomerHandoffGateReport,
        hostedNeonConfigured: true,
        launchPackageRecordReport: sampleLaunchPackageRecordReport,
        mode: "hosted",
        proofRunReport: sampleProofRunReport,
        report: sampleReport,
      }),
    );

    expect(readyReadiness.command.state).toBe("ready");
    expect(readyReadiness.latestRecord).toEqual(
      expect.objectContaining({
        gym_name: "Summit Strength",
        public_self_serve_launch_allowed: false,
      }),
    );
    expect(readyReadiness.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Launch package record",
          state: "ready",
        }),
      ]),
    );
    expect(readyReadiness.summary).toContain("reviewed package record exists");

    const selfServeAnomalyReadiness = founderAdminLaunchPackageReadiness(
      founderAdminProofStatusLedger({
        appOrigin: "https://outpost-preview.example.vercel.app",
        branchName: "outpost-beta-access-scoped-proof",
        customerHandoffGateReport: sampleCustomerHandoffGateReport,
        hostedNeonConfigured: true,
        launchPackageRecordReport: {
          ...sampleLaunchPackageRecordReport,
          rows: [
            {
              ...sampleLaunchPackageRecordReport.rows[0],
              public_self_serve_launch_allowed: true,
            },
          ],
        },
        mode: "hosted",
        proofRunReport: sampleProofRunReport,
        report: sampleReport,
      }),
    );

    expect(selfServeAnomalyReadiness.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Public self-serve remains blocked",
          state: "blocked",
        }),
      ]),
    );

    const blockedReadiness = founderAdminLaunchPackageReadiness(
      founderAdminProofStatusLedger({
        appOrigin: "http://localhost:3000",
        branchName: "",
        hostedNeonConfigured: false,
        mode: "local",
        report: sampleReport,
      }),
    );

    expect(blockedReadiness.command.state).toBe("blocked");
    expect(blockedReadiness.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Protected Preview proof",
          state: "blocked",
        }),
        expect.objectContaining({
          label: "Customer-observed handoff",
          state: "blocked",
        }),
        expect.objectContaining({
          label: "Launch package record",
          state: "blocked",
        }),
      ]),
    );
  });

  it("derives launch decision packet readiness from the hosted package record", () => {
    const readyLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      launchPackageRecordReport: sampleLaunchPackageRecordReport,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });
    const packetReadiness =
      founderAdminLaunchDecisionPacketReadiness(readyLedger);

    expect(packetReadiness.title).toBe("Launch decision packet");
    expect(packetReadiness.packetPath).toBe(
      "artifacts/admin-launch-readiness/outpost-beta-access-scoped-proof-launch-decision-packet.json",
    );
    expect(packetReadiness.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: expect.stringContaining(
            "npm run hosted:launch-decision:packet",
          ),
          label: "Write launch decision packet",
          state: "ready",
        }),
        expect.objectContaining({
          command: expect.stringContaining(
            "npm run admin:launch-decision:inspect",
          ),
          label: "Inspect launch decision packet",
          state: "pending",
        }),
      ]),
    );
    expect(packetReadiness.recordCommand).toEqual(
      expect.objectContaining({
        command: expect.stringContaining(
          "npm run admin:launch-decision:record",
        ),
        label: "Record manual launch decision",
        state: "pending",
      }),
    );
    expect(packetReadiness.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Launch package record",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Manual review remains required",
          state: "pending",
        }),
        expect.objectContaining({
          label: "Public self-serve remains blocked",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Live-provider gates remain blocked",
          state: "ready",
        }),
      ]),
    );
    expect(JSON.stringify(packetReadiness)).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role|password|token|napi_[a-z0-9]+/iu,
    );

    const blockedReadiness =
      founderAdminLaunchDecisionPacketReadiness(undefined);
    expect(blockedReadiness.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Write launch decision packet",
          state: "blocked",
        }),
        expect.objectContaining({
          label: "Inspect launch decision packet",
          state: "blocked",
        }),
      ]),
    );
    expect(blockedReadiness.recordCommand).toEqual(
      expect.objectContaining({
        label: "Record manual launch decision",
        state: "blocked",
      }),
    );
  });

  it("derives manual launch decision record readiness without enabling launch", () => {
    const readyLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      launchDecisionRecordReport: sampleLaunchDecisionRecordReport,
      launchPackageRecordReport: sampleLaunchPackageRecordReport,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });
    const packetReadiness =
      founderAdminLaunchDecisionPacketReadiness(readyLedger);

    expect(launchDecisionRecordMigration).toContain(
      "create table admin_launch_decision_records",
    );
    expect(launchDecisionRecordMigration).toContain(
      "list_founder_admin_launch_decision_records",
    );
    expect(launchDecisionRecordMigration).toContain(
      "public_self_serve_launch_allowed = false",
    );
    expect(launchDecisionRecordMigration).toContain(
      "launch_enablement_allowed = false",
    );
    expect(operatorSelfServeRehearsalMigration).toContain(
      "create table operator_self_serve_rehearsal_records",
    );
    expect(operatorSelfServeRehearsalMigration).toContain(
      "list_founder_admin_operator_self_serve_rehearsal_records",
    );
    expect(operatorSelfServeRehearsalMigration).toContain(
      "references admin_launch_decision_records(id)",
    );
    expect(operatorSelfServeRehearsalMigration).toContain(
      "public_self_serve_launch_allowed = false",
    );
    expect(operatorSelfServeRehearsalMigration).toContain(
      "launch_enablement_allowed = false",
    );
    expect(operatorSelfServeRehearsalMigration).toContain(
      "alter table operator_self_serve_rehearsal_records enable row level security",
    );
    expect(operatorSelfServeRehearsalMigration).toContain(
      "revoke all on table operator_self_serve_rehearsal_records from public, anonymous, authenticated",
    );
    expect(packetReadiness.latestDecisionRecord).toEqual(
      expect.objectContaining({
        decision: "reviewed_for_next_launch_slice",
        launch_enablement_allowed: false,
        public_self_serve_launch_allowed: false,
        reviewer_label: "Krish",
      }),
    );
    expect(packetReadiness.recordCommand.state).toBe("ready");
    expect(packetReadiness.summary).toContain("Public launch remains blocked");
  });

  it("blocks the launch promotion gate when prerequisite proof is incomplete", () => {
    const localLedger = founderAdminProofStatusLedger({
      appOrigin: "http://localhost:3000",
      branchName: "",
      hostedNeonConfigured: false,
      mode: "local",
      report: sampleReport,
    });
    const promotionGate = founderAdminLaunchPromotionGate({
      betaAccessRequestReport: sampleBetaAccessRequestReport,
      proofLedger: localLedger,
      report: sampleReport,
    });

    expect(promotionGate.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Protected Preview proof",
          state: "pending",
        }),
        expect.objectContaining({
          label: "Customer-observed handoff",
          state: "blocked",
        }),
        expect.objectContaining({ label: "Export artifact", state: "blocked" }),
      ]),
    );
    expect(promotionGate.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Check launch promotion candidate",
          state: "blocked",
        }),
        expect.objectContaining({
          label: "Write release-note artifact",
          state: "blocked",
        }),
        expect.objectContaining({
          label: "Inspect launch-readiness bundle",
          state: "blocked",
        }),
      ]),
    );
    expect(promotionGate.commands[0].detail).toContain(
      "Complete the protected Preview",
    );
  });

  it("keeps archived beta request lifecycle rows blocked", () => {
    for (const status of ["declined", "superseded"] as const) {
      const lifecycle = founderAdminBetaAccessRequestLifecycle({
        ...sampleBetaAccessRequestReport.rows[0],
        status,
      });

      expect(lifecycle).toHaveLength(6);
      expect(lifecycle).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: "Request queued",
            state: "blocked",
          }),
          expect.objectContaining({
            label: "Operator review",
            state: "blocked",
          }),
          expect.objectContaining({
            label: "Access fulfilled",
            state: "blocked",
          }),
          expect.objectContaining({
            label: "Owner signed in",
            state: "blocked",
          }),
          expect.objectContaining({
            label: "Workspace bootstrapped",
            state: "blocked",
          }),
          expect.objectContaining({ label: "Handoff ready", state: "blocked" }),
        ]),
      );
    }
  });

  it("keeps handoff pending when a bootstrapped request lacks matching hosted proof", () => {
    const fulfilledRequest = {
      ...sampleBetaAccessRequestReport.rows[0],
      fulfillment: {
        fulfilled: true,
        fulfilled_at: "2026-06-22T00:08:00.000Z",
        grant_linked: true,
        note_present: true,
      },
      fulfillment_receipt: sampleFulfillmentReceipt,
      grant: {
        present: true,
        status: "active",
      },
      owner_account: {
        app_user_present: true,
        auth_linked: true,
      },
      status: "approved" as const,
      tenant_bootstrap: {
        tenant_id: "tenant_northside",
        tenant_name: "Summit Strength",
      },
    };
    const mismatchedLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview-v2.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      hostedNeonConfigured: true,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });

    expect(
      founderAdminBetaAccessRequestLifecycle(
        fulfilledRequest,
        mismatchedLedger,
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Access fulfilled", state: "ready" }),
        expect.objectContaining({ label: "Owner signed in", state: "ready" }),
        expect.objectContaining({
          label: "Workspace bootstrapped",
          state: "ready",
        }),
        expect.objectContaining({
          detail: expect.stringContaining("matching hosted proof records"),
          label: "Handoff ready",
          state: "pending",
        }),
      ]),
    );
  });

  it("keeps hosted proof gates pending when records are for a different Preview origin", () => {
    const ledger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview-v2.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      hostedNeonConfigured: true,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });

    expect(ledger.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: expect.stringContaining("outpost-preview.example.vercel.app"),
          label: "Hosted beta workflow proof",
          state: "pending",
        }),
        expect.objectContaining({
          detail: expect.stringContaining("outpost-preview.example.vercel.app"),
          label: "Admin portal proof",
          state: "pending",
        }),
        expect.objectContaining({
          detail: expect.stringContaining("Available origin differs"),
          label: "Preview deployment URL",
          state: "pending",
        }),
      ]),
    );
  });

  it("keeps customer-observed handoff pending when persisted records are for a different Preview or branch", () => {
    const ledger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview-v2.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });

    expect(ledger.customerHandoffGateRecords).toHaveLength(1);
    expect(ledger.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Customer-observed handoff",
          state: "pending",
        }),
      ]),
    );

    const wrongBranchLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof-v2",
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });

    expect(wrongBranchLedger.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Customer-observed handoff",
          state: "pending",
        }),
      ]),
    );
  });

  it("keeps customer-observed handoff pending for same Preview and branch but no linked admin packet digest", () => {
    const unlinkedReport = {
      ...sampleCustomerHandoffGateReport,
      rows: sampleCustomerHandoffGateReport.rows.map((record) => ({
        ...record,
        admin_handoff_packet_sha256: null,
      })),
    };
    const ledger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      customerHandoffGateReport: unlinkedReport,
      hostedNeonConfigured: true,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });
    expect(ledger.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Customer-observed handoff",
          state: "pending",
        }),
      ]),
    );
  });

  it("blocks proof ledger gates when hosted env or Preview origin is missing", () => {
    const ledger = founderAdminProofStatusLedger({
      appOrigin: "http://localhost:3000",
      branchName: "",
      hostedNeonConfigured: false,
      mode: "local",
      report: { authorized: true, generated_at: null, rows: [] },
    });

    expect(ledger.previewUrl).toBe("http://localhost:3000");
    expect(ledger.branchName).toBe("Neon branch missing");
    expect(ledger.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Hosted beta workflow proof",
          state: "blocked",
        }),
        expect.objectContaining({
          label: "Admin portal proof",
          state: "blocked",
        }),
        expect.objectContaining({
          label: "Preview deployment URL",
          state: "blocked",
        }),
      ]),
    );

    const httpsLocalLedger = founderAdminProofStatusLedger({
      appOrigin: "https://localhost:3000",
      branchName: "outpost-beta-access-scoped-proof",
      hostedNeonConfigured: true,
      mode: "hosted",
      report: sampleReport,
    });

    expect(httpsLocalLedger.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Preview deployment URL",
          state: "blocked",
        }),
      ]),
    );
  });

  it("adds a read-only admin-portal gated Neon readiness RPC", () => {
    expect(migration).toContain(
      "create or replace function list_founder_admin_owner_readiness()",
    );
    expect(migration).toContain("returns jsonb");
    expect(migration).toContain("security definer");
    expect(migration).toContain("app_admins.status = 'active'");
    expect(migration).toContain("memberships.role = 'founder_admin'");
    expect(migration).toContain("memberships.invite_status = 'active'");
    expect(migration).toContain("'authorized', false");
    expect(migration).toContain("select distinct on (target_grants.id)");
    expect(migration).toContain("owner_beta_access_grants");
    expect(migration).toContain("display_name_present");
    expect(migration).toContain("note_present");
    expect(migration).not.toContain("'note',");
    expect(migration).not.toContain("'display_name',");
    expect(migration).not.toMatch(/\binsert\s+into\b/iu);
    expect(migration).not.toMatch(/\bupdate\s+[\w."]+\s+set\b/iu);
    expect(migration).not.toMatch(/\bdelete\s+from\b/iu);
    expect(migration).toContain(
      "revoke execute on function list_founder_admin_owner_readiness() from public, anonymous",
    );
    expect(migration).toContain(
      "grant execute on function list_founder_admin_owner_readiness() to authenticated",
    );
  });

  it("adds an append-only admin-portal gated hosted proof run projection", () => {
    expect(proofRunMigration).toContain("create table hosted_proof_runs");
    expect(proofRunMigration).toContain("proof_kind text not null check");
    expect(proofRunMigration).toContain("'hosted_founder_admin_readiness'");
    expect(proofRunMigration).toContain("'vercel_preview_verify'");
    expect(proofRunMigration).toContain(
      "summary jsonb not null default '{}'::jsonb",
    );
    expect(proofRunMigration).toContain("summary::text !~*");
    expect(proofRunMigration).toContain(
      "alter table hosted_proof_runs enable row level security",
    );
    expect(proofRunMigration).toContain(
      "revoke all on table hosted_proof_runs from public, anonymous, authenticated",
    );
    expect(proofRunMigration).toContain(
      "create or replace function list_founder_admin_proof_runs()",
    );
    expect(proofRunMigration).toContain("security definer");
    expect(proofRunMigration).toContain("app_admins.status = 'active'");
    expect(proofRunMigration).toContain("memberships.role = 'founder_admin'");
    expect(proofRunMigration).toContain("'authorized', false");
    expect(proofRunMigration).toContain(
      "grant execute on function list_founder_admin_proof_runs() to authenticated",
    );
    expect(proofRunMigration).not.toMatch(/\bupdate\s+[\w."]+\s+set\b/iu);
    expect(proofRunMigration).not.toMatch(/\bdelete\s+from\b/iu);
  });

  it("adds an append-only admin-portal gated customer handoff gate projection", () => {
    expect(customerHandoffGateMigration).toContain(
      "create table customer_handoff_gate_records",
    );
    expect(customerHandoffGateMigration).toContain(
      "customer_observed_beta_handoff_gate_passed",
    );
    expect(customerHandoffGateMigration).toContain(
      "source_artifact_sha256 text not null unique",
    );
    expect(customerHandoffGateMigration).toContain(
      "summary jsonb not null default '{}'::jsonb",
    );
    expect(customerHandoffGateMigration).toContain("summary::text !~*");
    expect(customerHandoffGateMigration).toContain(
      "alter table customer_handoff_gate_records enable row level security",
    );
    expect(customerHandoffGateMigration).toContain(
      "revoke all on table customer_handoff_gate_records from public, anonymous, authenticated",
    );
    expect(customerHandoffGateMigration).toContain(
      "create or replace function list_founder_admin_customer_handoff_gate_records()",
    );
    expect(customerHandoffGateMigration).toContain("security definer");
    expect(customerHandoffGateMigration).toContain(
      "app_admins.status = 'active'",
    );
    expect(customerHandoffGateMigration).toContain(
      "memberships.role = 'founder_admin'",
    );
    expect(customerHandoffGateMigration).toContain("'authorized', false");
    expect(customerHandoffGateMigration).toContain(
      "grant execute on function list_founder_admin_customer_handoff_gate_records() to authenticated",
    );
    expect(customerHandoffGateMigration).not.toMatch(
      /\bupdate\s+[\w."]+\s+set\b/iu,
    );
    expect(customerHandoffGateMigration).not.toMatch(/\bdelete\s+from\b/iu);
  });

  it("adds an append-only admin-portal gated launch package record projection", () => {
    expect(launchPackageRecordMigration).toContain(
      "create table admin_launch_package_records",
    );
    expect(launchPackageRecordMigration).toContain(
      "admin_launch_package_recorded",
    );
    expect(launchPackageRecordMigration).toContain(
      "launch_bundle_sha256 text not null check",
    );
    expect(launchPackageRecordMigration).toContain(
      "owner_message_sha256 text not null",
    );
    expect(launchPackageRecordMigration).toContain(
      "admin_launch_package_records_unique_artifact_pair unique",
    );
    expect(launchPackageRecordMigration).toContain("app_origin !~*");
    expect(launchPackageRecordMigration).toContain("neon_branch_name !~*");
    expect(launchPackageRecordMigration).toContain(
      "public_self_serve_launch_allowed boolean not null default false",
    );
    expect(launchPackageRecordMigration).toContain(
      "admin_launch_package_records_public_self_serve_blocked",
    );
    expect(launchPackageRecordMigration).toContain("summary::text !~*");
    expect(launchPackageRecordMigration).toContain(
      "alter table admin_launch_package_records enable row level security",
    );
    expect(launchPackageRecordMigration).toContain(
      "revoke all on table admin_launch_package_records from public, anonymous, authenticated",
    );
    expect(launchPackageRecordMigration).toContain(
      "create or replace function list_founder_admin_launch_package_records()",
    );
    expect(launchPackageRecordMigration).toContain("security definer");
    expect(launchPackageRecordMigration).toContain(
      "app_admins.status = 'active'",
    );
    expect(launchPackageRecordMigration).toContain(
      "memberships.role = 'founder_admin'",
    );
    expect(launchPackageRecordMigration).toContain("'authorized', false");
    expect(launchPackageRecordMigration).toContain(
      "grant execute on function list_founder_admin_launch_package_records() to authenticated",
    );
    expect(launchPackageRecordMigration).not.toMatch(
      /\bupdate\s+[\w."]+\s+set\b/iu,
    );
    expect(launchPackageRecordMigration).not.toMatch(/\bdelete\s+from\b/iu);
  });

  it("adds a public beta request write path and admin-portal gated request queue", () => {
    expect(betaAccessRequestMigration).toContain(
      "create table owner_beta_access_requests",
    );
    expect(betaAccessRequestMigration).toContain(
      "alter table owner_beta_access_requests enable row level security",
    );
    expect(betaAccessRequestMigration).toContain(
      "revoke all on table owner_beta_access_requests from public, anonymous, authenticated",
    );
    expect(betaAccessRequestMigration).toContain(
      "create or replace function submit_owner_beta_access_request",
    );
    expect(betaAccessRequestMigration).toContain("p_company_website");
    expect(betaAccessRequestMigration).toContain(
      "request cannot include secrets or credentials",
    );
    expect(betaAccessRequestMigration).toContain(
      "grant execute on function submit_owner_beta_access_request",
    );
    expect(betaAccessRequestMigration).toContain("to anonymous, authenticated");
    expect(betaAccessRequestMigration).toContain(
      "create or replace function list_founder_admin_beta_access_requests()",
    );
    expect(betaAccessRequestMigration).toContain(
      "app_admins.status = 'active'",
    );
    expect(betaAccessRequestMigration).toContain(
      "memberships.role = 'founder_admin'",
    );
    expect(betaAccessRequestMigration).toContain("'authorized', false");
    expect(betaAccessRequestMigration).toContain(
      "left join owner_beta_access_grants grants",
    );
    expect(betaAccessRequestMigration).toContain(
      "grant execute on function list_founder_admin_beta_access_requests() to authenticated",
    );
    expect(betaAccessRequestMigration).toContain(
      "revoke execute on function list_founder_admin_beta_access_requests() from public, anonymous",
    );
    expect(betaAccessRequestMigration).not.toMatch(/\bdelete\s+from\b/iu);
    expect(betaAccessPreflightMigration).toContain(
      "create or replace function list_founder_admin_beta_access_requests()",
    );
    expect(betaAccessPreflightMigration).toContain(
      "memberships.role = 'founder_admin'",
    );
    expect(betaAccessPreflightMigration).toContain(
      "'provider_gate', jsonb_build_object",
    );
    expect(betaAccessPreflightMigration).toContain("'unexpected_live_records'");
    expect(betaAccessPreflightMigration).toContain(
      "provider_connections providers",
    );
    expect(betaAccessPreflightMigration).toContain(
      "grant execute on function list_founder_admin_beta_access_requests() to authenticated",
    );
    expect(betaAccessPreflightMigration).not.toMatch(
      /\bupdate\s+owner_beta_access_requests\b/iu,
    );
    expect(betaAccessPreflightMigration).not.toMatch(
      /\binsert\s+into\s+owner_beta_access_requests\b/iu,
    );
    expect(betaAccessPreflightMigration).not.toMatch(/\bdelete\s+from\b/iu);
    expect(betaAccessReceiptMigration).toContain(
      "create table owner_beta_access_fulfillment_receipts",
    );
    expect(betaAccessReceiptMigration).toContain(
      "revoke all on table owner_beta_access_fulfillment_receipts from public, anonymous, authenticated",
    );
    expect(betaAccessReceiptMigration).toContain("'fulfillment_receipt', case");
    expect(betaAccessReceiptMigration).not.toContain(
      "'summary', receipt_summary",
    );
    expect(betaAccessReceiptMigration).toContain(
      "owner_beta_access_fulfillment_receipts_no_secret_summary",
    );
    expect(betaAccessReceiptMigration).toContain(
      "grant execute on function list_founder_admin_beta_access_requests() to authenticated",
    );
    expect(betaAccessTriageReceiptMigration).toContain(
      "create table owner_beta_access_request_triage_receipts",
    );
    expect(betaAccessTriageReceiptMigration).toContain(
      "revoke all on table owner_beta_access_request_triage_receipts from public, anonymous, authenticated",
    );
    expect(betaAccessTriageReceiptMigration).toContain(
      "list_founder_admin_beta_access_request_triage_receipts",
    );
    expect(betaAccessTriageReceiptMigration).toContain(
      "public_self_serve_launch_allowed = false",
    );
    expect(betaAccessTriageReceiptMigration).toContain(
      "launch_enablement_allowed = false",
    );
    expect(betaAccessTriageReceiptMigration).toContain(
      "owner_beta_access_request_triage_receipts_no_secret_text",
    );
    expect(betaAccessTriageReceiptMigration).toContain(
      "grant execute on function list_founder_admin_beta_access_request_triage_receipts() to authenticated",
    );
    expect(betaAccessTriageReceiptMigration).not.toMatch(
      /\bupdate\s+owner_beta_access_requests\b/iu,
    );
    expect(betaAccessTriageReceiptMigration).not.toMatch(
      /\binsert\s+into\s+owner_beta_access_grants\b/iu,
    );
    expect(betaAccessTriageReceiptMigration).not.toMatch(
      /\binsert\s+into\s+users\b/iu,
    );
    expect(betaAccessTriageReceiptMigration).not.toMatch(
      /\binsert\s+into\s+tenant_memberships\b/iu,
    );
    expect(betaAccessFollowThroughOutcomeMigration).toContain(
      "create table owner_beta_access_request_followthrough_outcomes",
    );
    expect(betaAccessFollowThroughOutcomeMigration).toContain(
      "list_founder_admin_beta_access_request_followthrough_outcomes",
    );
    expect(betaAccessFollowThroughOutcomeMigration).toContain(
      "public_self_serve_launch_allowed = false",
    );
    expect(betaAccessFollowThroughOutcomeMigration).toContain(
      "launch_enablement_allowed = false",
    );
    expect(betaAccessFollowThroughOutcomeMigration).not.toMatch(
      /\binsert\s+into\s+owner_beta_access_grants\b/iu,
    );
    expect(betaAccessFollowThroughOutcomeMigration).not.toMatch(
      /\binsert\s+into\s+users\b/iu,
    );
  });

  it("rate limits repeated beta requests without replacing original request details", () => {
    expect(betaAccessRequestHardeningMigration).toContain(
      "create or replace function submit_owner_beta_access_request",
    );
    expect(betaAccessRequestHardeningMigration).toContain("interval '15 minutes'");
    expect(betaAccessRequestHardeningMigration).toContain(
      "where owner_beta_access_requests.last_requested_at <=",
    );
    expect(betaAccessRequestHardeningMigration).toContain(
      "request_count = owner_beta_access_requests.request_count + 1",
    );
    expect(betaAccessRequestHardeningMigration).not.toMatch(
      /set\s+owner_name\s*=|gym_name\s*=\s*excluded|location_hint\s*=\s*excluded|note\s*=\s*excluded/iu,
    );
    expect(betaAccessRequestHardeningMigration).toContain(
      "return jsonb_build_object('ok', true, 'status', 'received')",
    );
    expect(betaAccessRequestHardeningMigration).toContain(
      "to anonymous, authenticated",
    );
  });

  it("wires /admin to hosted Neon readiness without operator secrets and redirects the old route", () => {
    expect(adminPage).toContain('export const dynamic = "force-dynamic"');
    expect(adminPage).toContain("isNeonConfigured");
    expect(adminPage).toContain("createOutpostServerNeonClient");
    expect(adminPage).toContain("NeonFounderAdminReadinessRepository");
    expect(adminPage).toContain("loadProofRuns");
    expect(adminPage).toContain("loadCustomerHandoffGateRecords");
    expect(adminPage).toContain("loadLaunchPackageRecords");
    expect(adminPage).toContain("loadBetaAccessRequests");
    expect(adminPage).toContain("loadBetaAccessRequestTriageReceipts");
    expect(adminPage).toContain("customerHandoffGates");
    expect(adminPage).toContain("launchPackageRecords");
    expect(adminPage).toContain("betaAccessRequests");
    expect(adminPage).toContain("betaAccessRequestTriageReceipts");
    expect(adminPage).toContain(
      "betaAccessRequestReport={authorizedReports?.betaAccessRequests}",
    );
    expect(adminPage).toContain(
      "const ownerReadiness = await repository.loadOwnerReadiness()",
    );
    expect(adminPage).toContain("if (ownerReadiness.authorized)");
    expect(adminPage).toContain("subordinateReportsAreAuthorized");
    expect(adminPage).toContain("FounderAdminReadinessConsole");
    expect(adminPage).toContain("Admin portal access is unavailable.");
    expect(adminPage).toContain("<h1>Admin portal</h1>");
    expect(adminPage).not.toContain("@/domain/seed");
    expect(adminPage).not.toContain("getCustomerZeroTenant");
    expect(adminPage).not.toContain("Local seed preview");
    expect(adminPage).not.toContain("NEON_API_KEY");
    expect(adminPage).not.toContain("OUTPOST_NEON_SEED_PASSWORD");
    expect(adminPage).not.toContain("VERCEL_AUTOMATION_BYPASS_SECRET");
    expect(adminPage).not.toContain("service_role");
    expect(founderAdminRedirectPage).toContain('redirect("/admin")');
    expect(repository).toMatch(
      /this\.neon\.rpc\(\s*"list_founder_admin_owner_readiness"/u,
    );
    expect(repository).toMatch(
      /this\.neon\.rpc\(\s*"list_founder_admin_proof_runs"/u,
    );
    expect(repository).toMatch(
      /this\.neon\.rpc\(\s*"list_founder_admin_customer_handoff_gate_records"/u,
    );
    expect(repository).toMatch(
      /this\.neon\.rpc\(\s*"list_founder_admin_launch_package_records"/u,
    );
    expect(repository).toMatch(
      /this\.neon\.rpc\(\s*"list_founder_admin_launch_decision_records"/u,
    );
    expect(repository).toMatch(
      /this\.neon\.rpc\(\s*"list_founder_admin_handoff_packet_records"/u,
    );
    expect(repository).toMatch(
      /this\.neon\.rpc\(\s*"list_founder_admin_operator_self_serve_rehearsal_records"/u,
    );
    expect(repository).toMatch(
      /this\.neon\.rpc\(\s*"list_founder_admin_beta_access_requests"/u,
    );
    expect(repository).toMatch(
      /this\.neon\.rpc\(\s*"list_founder_admin_beta_access_request_triage_receipts"/u,
    );
    expect(repository).toContain(
      "list_founder_admin_beta_access_request_followthrough_outcomes",
    );
  });

  it("renders the hosted readiness projection and no-live-provider gates", () => {
    const rendered = renderToStaticMarkup(
      createElement(FounderAdminReadinessConsole, {
        betaAccessRequestReport: sampleBetaAccessRequestReport,
        mode: "hosted",
        proofLedger: founderAdminProofStatusLedger({
          appOrigin: "https://outpost-preview.example.vercel.app",
          betaAccessRequestFollowThroughOutcomeReport:
            sampleBetaAccessRequestFollowThroughOutcomeReport,
          betaProofRunSummaryRecordReport:
            sampleBetaProofRunSummaryRecordReport,
          betaAccessRequestTriageReceiptReport:
            sampleBetaAccessRequestTriageReceiptReport,
          branchName: "outpost-beta-access-scoped-proof",
          customerHandoffGateReport: sampleCustomerHandoffGateReport,
          handoffPacketRecordReport: sampleHandoffPacketRecordReport,
          hostedNeonConfigured: true,
          launchDecisionRecordReport: sampleLaunchDecisionRecordReport,
          launchPackageRecordReport: sampleLaunchPackageRecordReport,
          mode: "hosted",
          operatorSelfServeRehearsalReport:
            sampleOperatorSelfServeRehearsalReport,
          proofRunReport: sampleProofRunReport,
          report: sampleReport,
        }),
        report: sampleReport,
      }),
    );

    expect(rendered).toContain("Beta owner readiness");
    expect(rendered).toContain("Hosted Neon");
    expect(rendered).toContain("owner-beta@example.com");
    expect(rendered).toContain("Example Dry Run Gym");
    expect(rendered).toContain("2 sources /");
    expect(rendered).toContain("3 review answers");
    expect(rendered).toContain("Provider attention");
    expect(rendered).toContain("Rollback ready");
    expect(rendered).toContain("Blocked product gates");
    expect(rendered).toContain(
      "Public self-serve, invite delivery, notifications, phone/email",
    );
    expect(rendered).toContain("member-ledger writes");
    expect(rendered).toContain("Operator next-action queue");
    expect(rendered).toContain("Next: Write launch-readiness export");
    expect(rendered).toContain("Queue artifact");
    expect(rendered).toContain("npm run admin:next-actions:export");
    expect(rendered).toContain("npm run admin:next-actions:inspect");
    expect(rendered).toContain("Proof evidence timeline");
    expect(rendered).toContain("Latest operator evidence in sequence");
    expect(rendered).toContain("Beta proof-run digest");
    expect(rendered).toContain(
      "Browser and request-chain proof digest imported",
    );
    expect(rendered).toContain("cccccccccccc");
    expect(rendered).toContain("Request follow-through");
    expect(rendered).toContain("Handoff packet");
    expect(rendered).toContain("555555555555");
    expect(rendered).toContain("Operator rehearsal");
    expect(rendered).toContain("Pre-self-serve readiness");
    expect(rendered).toContain(
      "This is the no-go matrix before public owner onboarding.",
    );
    expect(rendered).toContain("Protected Preview proof");
    expect(rendered).toContain("Operator fulfillment path");
    expect(rendered).toContain("Reset and rollback readiness");
    expect(rendered).toContain("Live-provider and billing gates");
    expect(rendered).toContain("Public self-serve launch");
    expect(rendered).toContain("Do not enable public signup");
    expect(rendered).toContain("Launch-readiness export");
    expect(rendered).toContain("Generate a sanitized review artifact");
    expect(rendered).toContain("Export artifact");
    expect(rendered).toContain("Write launch-readiness export");
    expect(rendered).toContain("Inspect launch-readiness export");
    expect(rendered).toContain("npm run admin:launch-readiness:export");
    expect(rendered).toContain("npm run admin:launch-readiness:inspect");
    expect(rendered).toContain(
      "artifacts/admin-launch-readiness/outpost-beta-access-scoped-proof-launch-readiness.json",
    );
    expect(rendered).toContain("Still blocked after export");
    expect(rendered).toContain("No browser approval buttons.");
    expect(rendered).toContain("No public owner self-signup.");
    expect(rendered).toContain("Handoff readiness packet");
    expect(rendered).toContain("Packet artifact");
    expect(rendered).toContain("npm run admin:handoff-readiness:packet");
    expect(rendered).toContain("npm run admin:handoff-readiness:inspect");
    expect(rendered).toContain("npm run admin:handoff-readiness:replay");
    expect(rendered).toContain("npm run admin:handoff-readiness:hosted-proof");
    expect(rendered).toContain("npm run admin:handoff-readiness:record");
    expect(rendered).toContain("Packet records");
    expect(rendered).toContain("Action required packet");
    expect(rendered).toContain("Handoff readiness still blocked gates");
    expect(rendered).toContain("Launch promotion gate");
    expect(rendered).toContain("promotion-candidate summary");
    expect(rendered).toContain("Promotion summary");
    expect(rendered).toContain("Release note");
    expect(rendered).toContain("Launch bundle");
    expect(rendered).toContain("Check launch promotion candidate");
    expect(rendered).toContain("Write release-note artifact");
    expect(rendered).toContain("Write launch-readiness bundle");
    expect(rendered).toContain("npm run admin:launch-readiness:promote");
    expect(rendered).toContain("npm run admin:launch-readiness:release-note");
    expect(rendered).toContain("npm run admin:launch-readiness:bundle");
    expect(rendered).toContain(
      "outpost-beta-access-scoped-proof-promotion-candidate.json",
    );
    expect(rendered).toContain(
      "outpost-beta-access-scoped-proof-promotion-release-note.md",
    );
    expect(rendered).toContain(
      "outpost-beta-access-scoped-proof-launch-bundle.json",
    );
    expect(rendered).toContain("Still blocked after promotion check");
    expect(rendered).toContain("No public launch approval.");
    expect(rendered).toContain("No browser mutation or approval button.");
    expect(rendered).toContain("Beta access request console");
    expect(rendered).toContain(
      "Operator review queue for public owner requests",
    );
    expect(rendered).toContain("Fulfillment stays in the CLI");
    expect(rendered).toContain("Needs review");
    expect(rendered).toContain("Ready for CLI fulfillment");
    expect(rendered).toContain("Dry-run checks show this request is ready");
    expect(rendered).toContain(
      "No existing owner grant, app user, workspace, or live-provider surprise was found.",
    );
    expect(rendered).toContain("npm run beta:operator:request-preflight");
    expect(rendered).toContain("Fulfillment receipt");
    expect(rendered).toContain(
      "Receipt appears only after the CLI fulfillment command succeeds.",
    );
    expect(rendered).toContain("Request triage");
    expect(rendered).toContain(
      "Triage recorded as ready for operator fulfillment by Krish.",
    );
    expect(rendered).toContain("npm run admin:beta-request:triage-packet");
    expect(rendered).toContain("npm run admin:beta-request:triage-record");
    expect(rendered).toContain("Outcome recorded");
    expect(rendered).toContain("operator handoff completed");
    expect(rendered).toContain(
      "npm run admin:beta-request:followthrough-record",
    );
    expect(rendered).toContain("888888888888");
    expect(rendered).toContain(
      "No browser approval or public owner self-registration.",
    );
    expect(rendered).toContain("Operator command sequence");
    expect(rendered).toContain("Protected operator sequence");
    expect(rendered).toContain("1. Dry-run preflight");
    expect(rendered).toContain("2. Fulfill owner access");
    expect(rendered).toContain("3. Verify protected Preview");
    expect(rendered).toContain("4. Prepare owner handoff");
    expect(rendered).toContain("OUTPOST_BETA_HANDOFF_BUNDLE_PATH");
    expect(rendered).toContain("npm run hosted:owner-handoff:prepare");
    expect(rendered).toContain("Owner onboarding timeline");
    expect(rendered).toContain("Derived from request, receipt, owner sign-in");
    expect(rendered).toContain("Beta request");
    expect(rendered).toContain("Fulfillment receipt");
    expect(rendered).toContain("Owner sign-in");
    expect(rendered).toContain("Workspace bootstrap");
    expect(rendered).toContain("Handoff packet");
    expect(rendered).toContain("Reset or rollback");
    expect(rendered).toContain("Run CLI fulfillment after approval");
    expect(rendered).toContain("OUTPOST_OWNER_BETA_REQUEST_EMAIL");
    expect(rendered).toContain("&lt;temporary-password&gt;");
    expect(rendered).toContain("Jordan Owner");
    expect(rendered).toContain("owner@summitstrength.example");
    expect(rendered).toContain("Austin, TX");
    expect(rendered).toContain("Not granted");
    expect(rendered).toContain("2 requests");
    expect(rendered).toContain("Hosted proof status");
    expect(rendered).toContain("outpost-preview.example.vercel.app");
    expect(rendered).toContain("outpost-beta-access-scoped-proof");
    expect(rendered).toContain("Passed verifier records are the");
    expect(rendered).toContain("Hosted beta workflow proof");
    expect(rendered).toContain("Preview deployment URL");
    expect(rendered).toContain("Last protected Preview proof passed");
    expect(rendered).toContain("Last hosted proof records");
    expect(rendered).toContain("Protected Preview proof");
    expect(rendered).toContain("Admin portal proof");
    expect(rendered).toContain("Customer-observed handoff records");
    expect(rendered).toContain("666666666666");
    expect(rendered).toContain("reviewed proof records below");
    expect(rendered).toContain("Launch package records");
    expect(rendered).toContain(
      "Reviewed bundle and owner-message metadata imported by operators",
    );
    expect(rendered).toContain("Launch package proof");
    expect(rendered).toContain(
      "A reviewed package record exists for Summit Strength",
    );
    expect(rendered).toContain("Verify and import launch package record");
    expect(rendered).toContain("npm run hosted:launch-package:record-proof");
    expect(rendered).toContain("Launch decision packet");
    expect(rendered).toContain("manual-review packet");
    expect(rendered).toContain("Write launch decision packet");
    expect(rendered).toContain("Inspect launch decision packet");
    expect(rendered).toContain("npm run hosted:launch-decision:packet");
    expect(rendered).toContain("npm run admin:launch-decision:inspect");
    expect(rendered).toContain("Record manual launch decision");
    expect(rendered).toContain("npm run admin:launch-decision:record");
    expect(rendered).toContain("Launch follow-through");
    expect(rendered).toContain("Follow-through artifact");
    expect(rendered).toContain("Write launch follow-through");
    expect(rendered).toContain("npm run admin:launch-decision:followthrough");
    expect(rendered).toContain("Still blocked after follow-through");
    expect(rendered).toContain("Operator self-serve rehearsal");
    expect(rendered).toContain("Rehearsal packet");
    expect(rendered).toContain("Write rehearsal packet");
    expect(rendered).toContain("Record rehearsal completion");
    expect(rendered).toContain("npm run admin:self-serve-rehearsal:packet");
    expect(rendered).toContain("npm run admin:self-serve-rehearsal:record");
    expect(rendered).toContain("Still blocked after rehearsal");
    expect(rendered).toContain("Rehearsal records");
    expect(rendered).toContain("operator_self_serve_rehearsal_abc123");
    expect(rendered).toContain("Manual review records");
    expect(rendered).toContain("reviewed_for_next_launch_slice");
    expect(rendered).toContain("Krish");
    expect(rendered).toContain("Tina");
    expect(rendered).toContain("eeeeeeeeeeee");
    expect(rendered).not.toContain("Other reviewer");
    expect(rendered).not.toContain("ffffffffffff");
    expect(rendered).toContain("dddddddddddd");
    expect(rendered).toContain("Manual review remains required");
    expect(rendered).toContain("Public self-serve remains blocked");
    expect(rendered).toContain("Live-provider gates remain blocked");
    expect(rendered).toContain("Summit Strength");
    expect(rendered).toContain("aaaaaaaaaaaa");
    expect(rendered).toContain("bbbbbbbbbbbb");
    expect(rendered).toContain("Self-serve");
    expect(rendered).toContain("Blocked");
    expect(rendered).toContain("2026-06-22T00:04:00.000Z");
    expect(rendered).toContain("Full protected Preview proof");
    expect(rendered).toContain("npm run vercel:preview:verify");
    expect(rendered).toContain("npm run hosted:admin-portal-readiness");
    expect(rendered).toContain("npm run beta:owner-handoff:record");
    expect(rendered).toContain("npm run hosted:launch-package:record-proof");
    expect(rendered).toContain("npm run beta:owner-handoff:complete");
    expect(rendered).not.toMatch(
      /NEON_API_KEY|OUTPOST_NEON_SEED_PASSWORD|VERCEL_AUTOMATION_BYPASS_SECRET|service_role/iu,
    );
  });

  it("renders a locked hosted state for non-founder sessions", () => {
    const rendered = renderToStaticMarkup(
      createElement(FounderAdminReadinessConsole, {
        betaAccessRequestReport: {
          ...sampleBetaAccessRequestReport,
          authorized: false,
        },
        mode: "hosted",
        proofLedger: founderAdminProofStatusLedger({
          appOrigin: "https://outpost-preview.example.vercel.app",
          branchName: "outpost-beta-access-scoped-proof",
          hostedNeonConfigured: true,
          mode: "hosted",
          report: { authorized: false, generated_at: null, rows: [] },
        }),
        report: { authorized: false, generated_at: null, rows: [] },
        unavailableReason:
          "This session is not authorized as an active admin portal user.",
      }),
    );

    expect(rendered).toContain("Admin portal session required");
    expect(rendered).toContain(
      "Owner and staff sessions cannot read this support projection.",
    );
    expect(rendered).toContain("not authorized as an active admin portal user");
    expect(rendered).not.toContain("Hosted proof status");
    expect(rendered).not.toContain("Launch-readiness export");
    expect(rendered).not.toContain("Launch promotion gate");
    expect(rendered).not.toContain("outpost-beta-access-scoped-proof");
    expect(rendered).not.toContain("npm run vercel:preview:verify");
    expect(rendered).not.toContain("npm run admin:launch-readiness:export");
    expect(rendered).not.toContain("npm run admin:launch-readiness:promote");
    expect(rendered).not.toContain("owner@summitstrength.example");
  });

  it("keeps the console responsive and support-readiness scoped", () => {
    expect(component).toContain(
      'aria-label="Admin portal owner readiness console"',
    );
    expect(component).toContain("No beta owner grants found.");
    expect(component).toContain("No beta access requests.");
    expect(component).toContain("CLI not completed");
    expect(component).toContain("founderAdminBetaFulfillmentPreflight");
    expect(component).toContain("founderAdminBetaRequestOperatorSequence");
    expect(component).toContain("founderAdminSelfServeReadiness");
    expect(component).toContain("founderAdminLaunchReadinessExport");
    expect(component).toContain("founderAdminLaunchPromotionGate");
    expect(component).toContain("founderAdminLaunchPackageReadiness");
    expect(component).toContain("Launch-readiness export");
    expect(component).toContain("Launch promotion gate");
    expect(component).toContain("Launch package proof");
    expect(component).toContain("releaseNotePath");
    expect(component).toContain("Fulfillment preflight");
    expect(component).toContain("Fulfillment receipt");
    expect(component).toContain(
      "Append-only CLI receipt recorded without secrets",
    );
    expect(component).toContain("Owner onboarding timeline");
    expect(component).toContain("founderAdminOwnerOnboardingTimeline");
    expect(component).toContain(
      "Generate temporary passwords outside the browser",
    );
    expect(component).not.toMatch(
      /sign-up\/email|sign-in\/email|bootstrap_owner_tenant|createManualTask|Approve request|Decline request/iu,
    );
    expect(globals).toContain(".founder-readiness-console");
    expect(globals).toContain(".founder-readiness-list");
    expect(globals).toContain(".founder-readiness-row");
    expect(globals).toContain(".founder-readiness-boundary");
    expect(globals).toContain(".founder-proof-ledger");
    expect(globals).toContain(".founder-proof-gates");
    expect(globals).toContain(".founder-proof-state-missing");
    expect(globals).toContain(".founder-proof-runs");
    expect(globals).toContain(".founder-proof-run-empty");
    expect(globals).toContain(".founder-customer-handoff-records");
    expect(globals).toContain(".founder-customer-handoff-record");
    expect(globals).toContain(".founder-launch-package-records");
    expect(globals).toContain(".founder-launch-package-summary");
    expect(globals).toContain(".founder-launch-package-gates");
    expect(globals).toContain(".founder-launch-package-gate");
    expect(globals).toContain(".founder-launch-package-command");
    expect(globals).toContain(".founder-launch-package-record");
    expect(globals).toContain(".founder-beta-access-requests");
    expect(globals).toContain(".founder-self-serve-readiness");
    expect(globals).toContain(".founder-self-serve-gates");
    expect(globals).toContain(".founder-self-serve-gate");
    expect(globals).toContain(".founder-launch-readiness-export");
    expect(globals).toContain(".founder-launch-readiness-body");
    expect(globals).toContain(".founder-launch-readiness-gates");
    expect(globals).toContain(".founder-launch-readiness-command");
    expect(globals).toContain(".founder-launch-readiness-non-goals");
    expect(globals).toContain(".founder-launch-promotion-gate");
    expect(globals).toContain(".founder-launch-promotion-body");
    expect(globals).toContain(".founder-launch-promotion-gates");
    expect(globals).toContain(".founder-launch-promotion-command");
    expect(globals).toContain(".founder-launch-promotion-non-goals");
    expect(globals).toContain(".founder-beta-access-request");
    expect(globals).toContain(".founder-beta-access-priority");
    expect(globals).toContain(".founder-beta-access-preflight");
    expect(globals).toContain(".founder-beta-access-receipt");
    expect(globals).toContain(".founder-beta-access-receipt-recorded");
    expect(globals).toContain(".founder-beta-access-preflight-ready");
    expect(globals).toContain(".founder-beta-access-preflight-attention");
    expect(globals).toContain(".founder-beta-access-preflight-blocked");
    expect(globals).toContain(".founder-beta-access-lifecycle");
    expect(globals).toContain(".founder-beta-access-lifecycle-step-ready");
    expect(globals).toContain(".founder-beta-access-lifecycle-step-pending");
    expect(globals).toContain(".founder-beta-access-lifecycle-step-blocked");
    expect(globals).toContain(".founder-beta-access-operator");
    expect(globals).toContain(".founder-beta-access-operator-steps");
    expect(globals).toContain(".founder-beta-access-operator-step");
    expect(globals).toContain(".founder-proof-command-row");
    expect(globals).toMatch(
      /@media \(max-width: 760px\)[\s\S]*\.founder-readiness-row\s*\{[\s\S]*grid-template-columns: 1fr;/u,
    );
    expect(globals).toMatch(
      /@media \(max-width: 760px\)[\s\S]*\.founder-proof-gates\s*\{[\s\S]*grid-template-columns: 1fr;/u,
    );
    expect(globals).toMatch(
      /@media \(max-width: 760px\)[\s\S]*\.founder-self-serve-gates\s*\{[\s\S]*grid-template-columns: 1fr;/u,
    );
    expect(globals).toMatch(
      /@media \(max-width: 760px\)[\s\S]*\.founder-launch-readiness-body\s*\{[\s\S]*grid-template-columns: 1fr;/u,
    );
    expect(globals).toMatch(
      /@media \(max-width: 760px\)[\s\S]*\.founder-launch-promotion-body\s*\{[\s\S]*grid-template-columns: 1fr;/u,
    );
    expect(globals).toMatch(
      /@media \(max-width: 760px\)[\s\S]*\.founder-launch-package-gates\s*\{[\s\S]*grid-template-columns: 1fr;/u,
    );
    expect(globals).toMatch(
      /@media \(max-width: 760px\)[\s\S]*\.founder-proof-run\s*\{[\s\S]*grid-template-columns: 1fr;/u,
    );
    expect(globals).toMatch(
      /@media \(max-width: 760px\)[\s\S]*\.founder-customer-handoff-record,\s*\.founder-launch-package-record\s*\{[\s\S]*grid-template-columns: 1fr;/u,
    );
    expect(globals).toMatch(
      /@media \(max-width: 760px\)[\s\S]*\.founder-customer-handoff-record,\s*\.founder-launch-package-record\s*\{[\s\S]*grid-template-columns: 1fr;/u,
    );
    expect(globals).toMatch(
      /@media \(max-width: 760px\)[\s\S]*\.founder-beta-access-request\s*\{[\s\S]*grid-template-columns: 1fr;/u,
    );
    expect(globals).toMatch(
      /@media \(max-width: 760px\)[\s\S]*\.founder-beta-access-lifecycle ol\s*\{[\s\S]*grid-template-columns: 1fr;/u,
    );
  });
  it("derives launch follow-through readiness without enabling self-serve", () => {
    const readyLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      handoffPacketRecordReport: sampleHandoffPacketRecordReport,
      hostedNeonConfigured: true,
      launchDecisionRecordReport: sampleLaunchDecisionRecordReport,
      launchPackageRecordReport: sampleLaunchPackageRecordReport,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });
    const followThrough = founderAdminLaunchFollowThroughReadiness(readyLedger);

    expect(followThrough.title).toBe("Launch follow-through");
    expect(followThrough.command).toEqual(
      expect.objectContaining({
        command: expect.stringContaining(
          "npm run admin:launch-decision:followthrough",
        ),
        label: "Write launch follow-through",
        state: "ready",
      }),
    );
    expect(followThrough.artifactPath).toBe(
      "artifacts/admin-launch-readiness/outpost-beta-access-scoped-proof-launch-followthrough.json",
    );
    expect(followThrough.latestDecisionRecord).toEqual(
      expect.objectContaining({
        decision: "reviewed_for_next_launch_slice",
        launch_enablement_allowed: false,
        public_self_serve_launch_allowed: false,
      }),
    );
    expect(followThrough.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Reviewed decision record",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Public self-serve remains blocked",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Live-provider gates remain blocked",
          state: "ready",
        }),
      ]),
    );
  });

  it("keeps launch follow-through no-live gates pending until a reviewed decision record exists", () => {
    const pendingLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      handoffPacketRecordReport: sampleHandoffPacketRecordReport,
      hostedNeonConfigured: true,
      launchPackageRecordReport: sampleLaunchPackageRecordReport,
      mode: "hosted",
      operatorSelfServeRehearsalReport: sampleOperatorSelfServeRehearsalReport,
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });
    const followThrough =
      founderAdminLaunchFollowThroughReadiness(pendingLedger);

    expect(followThrough.command.state).toBe("pending");
    expect(followThrough.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Reviewed decision record",
          state: "pending",
        }),
        expect.objectContaining({
          label: "Public self-serve remains blocked",
          state: "pending",
        }),
        expect.objectContaining({
          label: "Live-provider gates remain blocked",
          state: "pending",
        }),
      ]),
    );
  });

  it("derives operator self-serve rehearsal readiness from hosted completion records", () => {
    const readyLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      launchDecisionRecordReport: sampleLaunchDecisionRecordReport,
      launchPackageRecordReport: sampleLaunchPackageRecordReport,
      mode: "hosted",
      operatorSelfServeRehearsalReport: sampleOperatorSelfServeRehearsalReport,
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });
    const readiness =
      founderAdminOperatorSelfServeRehearsalReadiness(readyLedger);

    expect(readiness.title).toBe("Operator self-serve rehearsal");
    expect(readiness.latestRecord).toEqual(
      expect.objectContaining({
        id: "operator_self_serve_rehearsal_abc123",
        launch_enablement_allowed: false,
        public_self_serve_launch_allowed: false,
      }),
    );
    expect(readiness.packetCommand.command).toContain(
      "npm run admin:self-serve-rehearsal:packet",
    );
    expect(readiness.recordCommand).toEqual(
      expect.objectContaining({
        command: expect.stringContaining(
          "npm run admin:self-serve-rehearsal:record",
        ),
        state: "ready",
      }),
    );
    expect(readiness.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Reviewed follow-through",
          state: "ready",
        }),
        expect.objectContaining({ label: "Rehearsal packet", state: "ready" }),
        expect.objectContaining({ label: "Completion ledger", state: "ready" }),
        expect.objectContaining({
          label: "Public self-serve remains blocked",
          state: "ready",
        }),
        expect.objectContaining({
          label: "Live-provider gates remain blocked",
          state: "ready",
        }),
      ]),
    );

    const pendingLedger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      branchName: "outpost-beta-access-scoped-proof",
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      launchDecisionRecordReport: sampleLaunchDecisionRecordReport,
      launchPackageRecordReport: sampleLaunchPackageRecordReport,
      mode: "hosted",
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });
    const pending =
      founderAdminOperatorSelfServeRehearsalReadiness(pendingLedger);
    expect(pending.recordCommand.state).toBe("pending");
    expect(pending.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Completion ledger",
          state: "pending",
        }),
        expect.objectContaining({
          label: "Public self-serve remains blocked",
          state: "pending",
        }),
        expect.objectContaining({
          label: "Live-provider gates remain blocked",
          state: "pending",
        }),
      ]),
    );
  });

  it("derives proof freshness for the current Preview and Neon branch", () => {
    const ledger = founderAdminProofStatusLedger({
      appOrigin: "https://outpost-preview.example.vercel.app",
      betaProofRunSummaryRecordReport: sampleBetaProofRunSummaryRecordReport,
      branchName: "outpost-beta-access-scoped-proof",
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      launchDecisionRecordReport: sampleLaunchDecisionRecordReport,
      launchPackageRecordReport: sampleLaunchPackageRecordReport,
      mode: "hosted",
      operatorSelfServeRehearsalReport: sampleOperatorSelfServeRehearsalReport,
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });
    const freshness = founderAdminProofFreshnessSummary(ledger);

    expect(freshness.title).toBe("Proof freshness");
    expect(freshness.overallState).toBe("fresh");
    expect(freshness.freshCount).toBe(freshness.items.length);
    expect(freshness.exportCommand.command).toContain(
      "npm run admin:proof-freshness:export",
    );
    expect(freshness.inspectCommand.command).toContain(
      "npm run admin:proof-freshness:inspect",
    );
    expect(freshness.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "protected_preview", state: "fresh" }),
        expect.objectContaining({ id: "beta_proof_summary", state: "fresh" }),
        expect.objectContaining({ id: "operator_rehearsal", state: "fresh" }),
      ]),
    );

    const markup = renderToStaticMarkup(
      createElement(FounderAdminReadinessConsole, {
        betaAccessRequestReport: sampleBetaAccessRequestReport,
        mode: "hosted",
        proofLedger: ledger,
        report: sampleReport,
      }),
    );

    expect(markup).toContain("Proof freshness");
    expect(markup).toContain("Freshness artifact");
    expect(markup).toContain("admin:proof-freshness:export");
    expect(markup).toContain("admin:proof-freshness:inspect");
  });

  it("marks proof freshness stale when evidence belongs to a different Preview or branch", () => {
    const ledger = founderAdminProofStatusLedger({
      appOrigin: "https://current-preview.example.vercel.app",
      betaProofRunSummaryRecordReport: sampleBetaProofRunSummaryRecordReport,
      branchName: "current-proof-branch",
      customerHandoffGateReport: sampleCustomerHandoffGateReport,
      hostedNeonConfigured: true,
      launchDecisionRecordReport: sampleLaunchDecisionRecordReport,
      launchPackageRecordReport: sampleLaunchPackageRecordReport,
      mode: "hosted",
      operatorSelfServeRehearsalReport: sampleOperatorSelfServeRehearsalReport,
      proofRunReport: sampleProofRunReport,
      report: sampleReport,
    });
    const freshness = founderAdminProofFreshnessSummary(ledger);

    expect(freshness.overallState).toBe("stale");
    expect(freshness.staleCount).toBeGreaterThan(0);
    expect(freshness.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "protected_preview",
          recordPreviewUrl: "https://outpost-preview.example.vercel.app",
          state: "stale",
        }),
        expect.objectContaining({
          id: "launch_package",
          recordBranchName: "outpost-beta-access-scoped-proof",
          state: "stale",
        }),
      ]),
    );
  });
});
