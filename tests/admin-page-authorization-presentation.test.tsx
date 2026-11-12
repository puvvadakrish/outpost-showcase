import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  isNeonConfigured: vi.fn(),
  loadBetaAccessRequestFollowThroughOutcomes: vi.fn(),
  loadBetaAccessRequests: vi.fn(),
  loadBetaAccessRequestTriageReceipts: vi.fn(),
  loadBetaProofRunSummaryRecords: vi.fn(),
  loadCustomerHandoffGateRecords: vi.fn(),
  loadCustomerSessionRecords: vi.fn(),
  loadHandoffPacketRecords: vi.fn(),
  loadLaunchDecisionRecords: vi.fn(),
  loadLaunchPackageRecords: vi.fn(),
  loadOperatorSelfServeRehearsalRecords: vi.fn(),
  loadOwnerReadiness: vi.fn(),
  loadProofRuns: vi.fn(),
  loadProviderNormalizedDigest: vi.fn(),
  reportServerFailure: vi.fn(),
}));

vi.mock("@/app/auth/actions", () => ({
  signOutFounderAction: vi.fn(),
}));
vi.mock("@/server/neon/env", () => ({
  getOutpostAppUrl: () => "https://outpost.example",
  isNeonConfigured: mocks.isNeonConfigured,
}));
vi.mock("@/server/neon/server-client", () => ({
  createOutpostServerNeonClient: mocks.createClient,
}));
vi.mock("@/server/observability", () => ({
  reportServerFailure: mocks.reportServerFailure,
}));
vi.mock("@/infrastructure/neon/founder-admin-readiness-repository", () => ({
  NeonFounderAdminReadinessRepository: class {
    loadBetaAccessRequestFollowThroughOutcomes =
      mocks.loadBetaAccessRequestFollowThroughOutcomes;
    loadBetaAccessRequests = mocks.loadBetaAccessRequests;
    loadBetaAccessRequestTriageReceipts =
      mocks.loadBetaAccessRequestTriageReceipts;
    loadBetaProofRunSummaryRecords = mocks.loadBetaProofRunSummaryRecords;
    loadCustomerHandoffGateRecords = mocks.loadCustomerHandoffGateRecords;
    loadCustomerSessionRecords = mocks.loadCustomerSessionRecords;
    loadHandoffPacketRecords = mocks.loadHandoffPacketRecords;
    loadLaunchDecisionRecords = mocks.loadLaunchDecisionRecords;
    loadLaunchPackageRecords = mocks.loadLaunchPackageRecords;
    loadOperatorSelfServeRehearsalRecords =
      mocks.loadOperatorSelfServeRehearsalRecords;
    loadOwnerReadiness = mocks.loadOwnerReadiness;
    loadProofRuns = mocks.loadProofRuns;
    loadProviderNormalizedDigest = mocks.loadProviderNormalizedDigest;
  },
}));

import AdminPortalPage from "@/app/admin/page";

const anonymousUserResult = {
  data: { user: null },
  error: null,
};
const adminUserResult = {
  data: {
    user: {
      email: "founder@example.com",
      id: "auth_founder",
      user_metadata: { name: "Authorized Founder" },
    },
  },
  error: null,
};
const unauthorizedReport = {
  authorized: false,
  generated_at: null,
  rows: [],
};
const authorizedEmptyReport = {
  authorized: true,
  generated_at: "2026-07-14T00:00:00.000Z",
  rows: [],
};

const subordinateLoadCases = [
  ["proof runs", mocks.loadProofRuns],
  ["customer handoff gates", mocks.loadCustomerHandoffGateRecords],
  ["customer session records", mocks.loadCustomerSessionRecords],
  ["launch package records", mocks.loadLaunchPackageRecords],
  ["beta proof-run summaries", mocks.loadBetaProofRunSummaryRecords],
  ["launch decision records", mocks.loadLaunchDecisionRecords],
  ["handoff packet records", mocks.loadHandoffPacketRecords],
  ["operator rehearsals", mocks.loadOperatorSelfServeRehearsalRecords],
  ["beta access requests", mocks.loadBetaAccessRequests],
  ["beta request triage receipts", mocks.loadBetaAccessRequestTriageReceipts],
  [
    "beta request follow-through outcomes",
    mocks.loadBetaAccessRequestFollowThroughOutcomes,
  ],
  ["provider normalized digest", mocks.loadProviderNormalizedDigest],
] as const;
const subordinateLoads = subordinateLoadCases.map(([, load]) => load);

function resetScenario() {
  for (const mock of Object.values(mocks)) {
    mock.mockReset();
  }

  mocks.isNeonConfigured.mockReturnValue(true);
  mocks.getUser.mockResolvedValue(adminUserResult);
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
  mocks.loadOwnerReadiness.mockResolvedValue(authorizedEmptyReport);

  for (const load of subordinateLoads) {
    load.mockResolvedValue(authorizedEmptyReport);
  }
}

async function renderAdminPage() {
  return renderToStaticMarkup(await AdminPortalPage());
}

function expectGenericLockedPresentation(markup: string) {
  expect(markup).toContain("Admin portal session required");
  expect(markup).not.toContain("Authorized Founder");
  expect(markup).not.toContain("founder@example.com");
  expect(markup).not.toContain("Admin account");
  expect(markup).not.toContain("Acme Fitness");
  expect(markup).not.toContain("Local seed preview");
  expect(markup).not.toContain("Provider fixture digest");
  expect(markup).not.toContain("Operational diagnostics");
  expect(markup).not.toContain("Beta owners</span>");
}

function expectNoAdminReportReads() {
  expect(mocks.loadOwnerReadiness).not.toHaveBeenCalled();
  for (const load of subordinateLoads) {
    expect(load).not.toHaveBeenCalled();
  }
}

function expectNoSubordinateReads() {
  for (const load of subordinateLoads) {
    expect(load).not.toHaveBeenCalled();
  }
}

describe("admin page authorization presentation", () => {
  beforeEach(resetScenario);

  it("renders one generic state for unconfigured, anonymous, auth-error, denied, and readiness-error requests", async () => {
    mocks.isNeonConfigured.mockReturnValue(false);
    const unconfigured = await renderAdminPage();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expectNoAdminReportReads();

    resetScenario();
    mocks.getUser.mockResolvedValue(anonymousUserResult);
    const anonymous = await renderAdminPage();
    expectNoAdminReportReads();

    resetScenario();
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "session lookup failed" },
    });
    const authError = await renderAdminPage();
    expectNoAdminReportReads();
    expect(mocks.reportServerFailure).toHaveBeenCalledTimes(1);

    resetScenario();
    mocks.loadOwnerReadiness.mockResolvedValue(unauthorizedReport);
    const denied = await renderAdminPage();
    expect(mocks.loadOwnerReadiness).toHaveBeenCalledTimes(1);
    expectNoSubordinateReads();

    resetScenario();
    mocks.loadOwnerReadiness.mockRejectedValue(new Error("readiness failed"));
    const readinessError = await renderAdminPage();
    expect(mocks.loadOwnerReadiness).toHaveBeenCalledTimes(1);
    expectNoSubordinateReads();
    expect(mocks.reportServerFailure).toHaveBeenCalledTimes(1);

    for (const markup of [
      unconfigured,
      anonymous,
      authError,
      denied,
      readinessError,
    ]) {
      expectGenericLockedPresentation(markup);
      expect(markup).toBe(unconfigured);
    }
  });

  it("uses readiness as the first admin read and skips every subordinate read on denial", async () => {
    mocks.loadOwnerReadiness.mockResolvedValue(unauthorizedReport);

    const markup = await renderAdminPage();

    expectGenericLockedPresentation(markup);
    expect(mocks.loadOwnerReadiness).toHaveBeenCalledTimes(1);
    expectNoSubordinateReads();
  });

  it("publishes an authorized empty report set only after every subordinate read succeeds", async () => {
    const markup = await renderAdminPage();

    expect(markup).toContain("Authorized Founder");
    expect(markup).toContain("founder@example.com");
    expect(markup).toContain("Admin account");
    expect(markup).toContain("No beta owner grants found.");
    expect(markup).toContain("Provider fixture digest");
    expect(markup).toContain("No normalized fixture rows yet");
    expect(markup).not.toContain("Acme Fitness");
    expect(markup).not.toContain("Local seed preview");

    const readinessOrder = mocks.loadOwnerReadiness.mock.invocationCallOrder[0];
    for (const load of subordinateLoads) {
      expect(load).toHaveBeenCalledTimes(1);
      expect(load.mock.invocationCallOrder[0]).toBeGreaterThan(readinessOrder);
    }
  });

  it("retains genuine authorized readiness and sanitized provider evidence", async () => {
    mocks.loadOwnerReadiness.mockResolvedValue({
      authorized: true,
      generated_at: "2026-07-14T00:00:00.000Z",
      rows: [
        {
          grant: {
            created_at: "2026-07-14T00:00:00.000Z",
            display_name_present: true,
            note_present: true,
            present: true,
            status: "active",
            updated_at: "2026-07-14T00:00:00.000Z",
          },
          owner_account: {
            app_user_present: true,
            auth_linked: true,
            created_at: "2026-07-14T00:00:00.000Z",
          },
          owner_email: "owner@authorized.example",
          provider_gate: { state: "blocked", unexpected_live_records: 0 },
          rollback_readiness: {
            reason: "Operator review is required.",
            state: "manual_review_required",
          },
          tenant_bootstrap: {
            billing_mode: "pilot",
            created_at: "2026-07-14T00:00:00.000Z",
            locations_count: 1,
            manual_sources_count: 1,
            open_tasks_count: 0,
            owner_membership_status: "active",
            review_answers_count: 1,
            tenant_id: "tenant_authorized",
            tenant_name: "Authorized Strength",
            tenant_status: "active",
          },
        },
      ],
    });
    mocks.loadProviderNormalizedDigest.mockResolvedValue({
      authorized: true,
      generated_at: "2026-07-14T00:00:00.000Z",
      rows: [
        {
          channel: "phone",
          channel_event_id: "channel_event_authorized",
          conversation_id: "conversation_authorized",
          event_type: "call_completed",
          location_id: "location_authorized",
          location_name: "Authorized Main",
          payload_digest: "a".repeat(64),
          payload_ref: null,
          processing_status: "processed",
          provider_connection_id: "provider_authorized",
          provider_event_id: "event_authorized",
          provider_key: "retell",
          received_at: "2026-07-14T00:00:00.000Z",
          source_linked_task_event_id: null,
          task_id: null,
          task_status: null,
          tenant_id: "tenant_authorized",
          tenant_name: "Authorized Strength",
          usage_meters: ["provider_event_normalized"],
        },
      ],
    });

    const markup = await renderAdminPage();

    expect(markup).toContain("Authorized Strength");
    expect(markup).toContain("owner@authorized.example");
    expect(markup).toContain("Retell");
    expect(markup).toContain("provider_event_normalized");
    expect(markup).not.toContain("Acme Fitness");
  });

  it("publishes no account or partial evidence when one subordinate read throws", async () => {
    mocks.isNeonConfigured.mockReturnValue(false);
    const genericMarkup = await renderAdminPage();

    resetScenario();
    mocks.loadProofRuns.mockResolvedValue({
      authorized: true,
      generated_at: "2026-07-14T00:00:00.000Z",
      rows: [
        {
          app_origin: "https://outpost.example",
          completed_at: "2026-07-14T00:00:00.000Z",
          id: "proof_partial",
          neon_branch_name: "partial-branch",
          proof_kind: "hosted_founder_admin_readiness",
          started_at: "2026-07-14T00:00:00.000Z",
          status: "passed",
          summary: {},
        },
      ],
    });
    mocks.loadProviderNormalizedDigest.mockRejectedValue(
      new Error("digest unavailable"),
    );

    const markup = await renderAdminPage();

    expectGenericLockedPresentation(markup);
    expect(markup).toBe(genericMarkup);
    expect(markup).not.toContain("partial-branch");
    expect(mocks.reportServerFailure).toHaveBeenCalledTimes(1);
  });

  it.each(subordinateLoadCases)(
    "fails the complete report set closed when %s denies authority",
    async (label, deniedLoad) => {
      mocks.isNeonConfigured.mockReturnValue(false);
      const genericMarkup = await renderAdminPage();

      resetScenario();
      const sensitiveMarker = `sensitive-${label.replaceAll(" ", "-")}`;
      deniedLoad.mockResolvedValue({
        authorized: false,
        generated_at: null,
        rows: [{ sensitive_marker: sensitiveMarker }],
      });

      const markup = await renderAdminPage();

      expectGenericLockedPresentation(markup);
      expect(markup).toBe(genericMarkup);
      expect(markup).not.toContain(sensitiveMarker);
    },
  );
});
