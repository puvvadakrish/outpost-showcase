import { signOutFounderAction } from "@/app/auth/actions";
import { AppShell } from "@/components/AppShell";
import { FounderAdminReadinessConsole } from "@/components/founder-admin/FounderAdminReadinessConsole";
import {
  emptyFounderAdminOwnerReadinessReport,
  founderAdminProofStatusLedger,
  founderAdminReadinessSummary,
  type FounderAdminBetaAccessRequestFollowThroughOutcomeReport,
  type FounderAdminBetaAccessRequestReport,
  type FounderAdminBetaAccessRequestTriageReceiptReport,
  type FounderAdminBetaProofRunSummaryRecordReport,
  type FounderAdminCustomerHandoffGateReport,
  type FounderAdminCustomerSessionRecordReport,
  type FounderAdminHandoffPacketRecordReport,
  type FounderAdminLaunchDecisionRecordReport,
  type FounderAdminLaunchPackageRecordReport,
  type FounderAdminOperatorSelfServeRehearsalReport,
  type FounderAdminOwnerReadinessReport,
  type FounderAdminProofRunReport,
} from "@/domain/founder-admin-readiness";
import { displayLabel } from "@/domain/formatting";
import {
  emptyProviderNormalizedDigestReport,
  providerNormalizedDigestSummary,
  type ProviderNormalizedDigestReport,
} from "@/domain/provider-normalized-digest";
import { NeonFounderAdminReadinessRepository } from "@/infrastructure/neon/founder-admin-readiness-repository";
import { getOutpostAppUrl, isNeonConfigured } from "@/server/neon/env";
import { createOutpostServerNeonClient } from "@/server/neon/server-client";
import { reportServerFailure } from "@/server/observability";

export const dynamic = "force-dynamic";

const GENERIC_ADMIN_UNAVAILABLE_REASON =
  "Admin portal access is unavailable.";

interface AuthorizedFounderAdminReports {
  betaAccessRequestFollowThroughOutcomes: FounderAdminBetaAccessRequestFollowThroughOutcomeReport;
  betaAccessRequests: FounderAdminBetaAccessRequestReport;
  betaAccessRequestTriageReceipts: FounderAdminBetaAccessRequestTriageReceiptReport;
  betaProofRunSummaryRecords: FounderAdminBetaProofRunSummaryRecordReport;
  customerHandoffGates: FounderAdminCustomerHandoffGateReport;
  customerSessionRecords: FounderAdminCustomerSessionRecordReport;
  handoffPacketRecords: FounderAdminHandoffPacketRecordReport;
  launchDecisionRecords: FounderAdminLaunchDecisionRecordReport;
  launchPackageRecords: FounderAdminLaunchPackageRecordReport;
  operatorSelfServeRehearsals: FounderAdminOperatorSelfServeRehearsalReport;
  ownerReadiness: FounderAdminOwnerReadinessReport;
  proofRuns: FounderAdminProofRunReport;
  providerNormalizedDigest: ProviderNormalizedDigestReport;
}

function subordinateReportsAreAuthorized(
  reports: AuthorizedFounderAdminReports,
) {
  return [
    reports.betaAccessRequestFollowThroughOutcomes,
    reports.betaAccessRequests,
    reports.betaAccessRequestTriageReceipts,
    reports.betaProofRunSummaryRecords,
    reports.customerHandoffGates,
    reports.customerSessionRecords,
    reports.handoffPacketRecords,
    reports.launchDecisionRecords,
    reports.launchPackageRecords,
    reports.operatorSelfServeRehearsals,
    reports.proofRuns,
    reports.providerNormalizedDigest,
  ].every((report) => report.authorized);
}

export default async function AdminPortalPage() {
  let authorizedReports: AuthorizedFounderAdminReports | undefined;
  let account:
    | {
        email: string;
        name: string;
        role: "founder_admin";
        signOutAction: typeof signOutFounderAction;
      }
    | undefined;

  if (isNeonConfigured()) {
    try {
      const neon = await createOutpostServerNeonClient();
      const { data, error } = await neon.auth.getUser();

      if (error) {
        reportServerFailure("admin.session.load", new Error(error.message));
      } else if (data.user) {
        const repository = new NeonFounderAdminReadinessRepository(neon);

        try {
          const ownerReadiness = await repository.loadOwnerReadiness();

          if (ownerReadiness.authorized) {
            const [
              proofRuns,
              customerHandoffGates,
              customerSessionRecords,
              launchPackageRecords,
              betaProofRunSummaryRecords,
              launchDecisionRecords,
              handoffPacketRecords,
              operatorSelfServeRehearsals,
              betaAccessRequests,
              betaAccessRequestTriageReceipts,
              betaAccessRequestFollowThroughOutcomes,
              providerNormalizedDigest,
            ] = await Promise.all([
              repository.loadProofRuns(),
              repository.loadCustomerHandoffGateRecords(),
              repository.loadCustomerSessionRecords(),
              repository.loadLaunchPackageRecords(),
              repository.loadBetaProofRunSummaryRecords(),
              repository.loadLaunchDecisionRecords(),
              repository.loadHandoffPacketRecords(),
              repository.loadOperatorSelfServeRehearsalRecords(),
              repository.loadBetaAccessRequests(),
              repository.loadBetaAccessRequestTriageReceipts(),
              repository.loadBetaAccessRequestFollowThroughOutcomes(),
              repository.loadProviderNormalizedDigest(),
            ]);
            const stagedReports: AuthorizedFounderAdminReports = {
              betaAccessRequestFollowThroughOutcomes,
              betaAccessRequests,
              betaAccessRequestTriageReceipts,
              betaProofRunSummaryRecords,
              customerHandoffGates,
              customerSessionRecords,
              handoffPacketRecords,
              launchDecisionRecords,
              launchPackageRecords,
              operatorSelfServeRehearsals,
              ownerReadiness,
              proofRuns,
              providerNormalizedDigest,
            };

            if (subordinateReportsAreAuthorized(stagedReports)) {
              authorizedReports = stagedReports;
              account = {
                email: data.user.email ?? "admin-portal-session",
                name:
                  data.user.user_metadata?.name ??
                  data.user.email ??
                  "Admin portal",
                role: "founder_admin",
                signOutAction: signOutFounderAction,
              };
            }
          }
        } catch (readError) {
          reportServerFailure("admin.reports.load", readError);
        }
      }
    } catch (sessionError) {
      reportServerFailure("admin.session.load", sessionError);
    }
  }

  const consoleReport =
    authorizedReports?.ownerReadiness ?? emptyFounderAdminOwnerReadinessReport;
  const readinessSummary = founderAdminReadinessSummary(consoleReport);
  const providerDigest =
    authorizedReports?.providerNormalizedDigest ??
    emptyProviderNormalizedDigestReport;
  const providerDigestSummary = providerNormalizedDigestSummary(providerDigest);
  const proofLedger =
    authorizedReports
      ? founderAdminProofStatusLedger({
          appOrigin: resolveFounderAdminAppOrigin(),
          betaAccessRequestFollowThroughOutcomeReport:
            authorizedReports.betaAccessRequestFollowThroughOutcomes,
          betaAccessRequestTriageReceiptReport:
            authorizedReports.betaAccessRequestTriageReceipts,
          betaProofRunSummaryRecordReport:
            authorizedReports.betaProofRunSummaryRecords,
          branchName: process.env.OUTPOST_NEON_BRANCH_NAME,
          customerHandoffGateReport: authorizedReports.customerHandoffGates,
          customerSessionRecordReport: authorizedReports.customerSessionRecords,
          handoffPacketRecordReport: authorizedReports.handoffPacketRecords,
          hostedNeonConfigured: true,
          launchDecisionRecordReport: authorizedReports.launchDecisionRecords,
          launchPackageRecordReport: authorizedReports.launchPackageRecords,
          mode: "hosted",
          operatorSelfServeRehearsalReport:
            authorizedReports.operatorSelfServeRehearsals,
          proofRunReport: authorizedReports.proofRuns,
          report: consoleReport,
        })
      : undefined;

  return (
    <AppShell
      account={account}
      activeNav="admin"
      metrics={
        authorizedReports
          ? [
              {
                label: "Beta owners",
                value: readinessSummary.betaOwners,
              },
              {
                label: "Bootstrapped",
                value: readinessSummary.bootstrappedTenants,
              },
              {
                attention: true,
                label: "Provider attention",
                value: readinessSummary.providerAttention,
              },
            ]
          : []
      }
      milestoneLabel={
        authorizedReports ? "Hosted support proof" : "Admin access required"
      }
      tenantName="Outpost admin portal"
      subtitle="Admin readiness"
    >
      <section className="page-header">
        <div>
          <h1>Admin portal</h1>
          <p>
            Internal support visibility for beta owner readiness, tenant
            bootstrap state, rollback classification, and deliberately
            disconnected live-provider gates.
          </p>
        </div>
      </section>

      <FounderAdminReadinessConsole
        betaAccessRequestReport={authorizedReports?.betaAccessRequests}
        mode="hosted"
        proofLedger={proofLedger}
        report={consoleReport}
        unavailableReason={
          authorizedReports ? undefined : GENERIC_ADMIN_UNAVAILABLE_REASON
        }
      />

      {authorizedReports ? (
        <section className="panel section-gap">
          <div className="panel-header">
            <div>
              <h2>Provider fixture digest</h2>
              <p>
                Read-only view of normalized provider rows persisted by the
                internal fixture replay path. Raw provider payloads, contacts,
                live providers, and outbound delivery stay unavailable.
              </p>
            </div>
          </div>
          <div className="grid provider-digest-metrics">
            <div className="metric compact">
              <span>Events</span>
              <strong>{providerDigestSummary.eventCount}</strong>
            </div>
            <div className="metric compact">
              <span>Providers</span>
              <strong>{providerDigestSummary.providerCount}</strong>
            </div>
            <div className="metric compact">
              <span>Task signals</span>
              <strong>{providerDigestSummary.taskCount}</strong>
            </div>
            <div className="metric compact">
              <span>Usage meters</span>
              <strong>{providerDigestSummary.meterCount}</strong>
            </div>
            <div className="metric compact">
              <span>Task provenance</span>
              <strong>{providerDigestSummary.sourceLinkedTaskCount}</strong>
            </div>
          </div>
          {providerDigest.rows.length > 0 ? (
            <table className="table">
              <tbody>
                {providerDigest.rows.slice(0, 6).map((row) => (
                  <tr key={row.channel_event_id}>
                    <td>
                      {displayLabel(row.provider_key ?? row.channel)} ·{" "}
                      {displayLabel(row.event_type)}
                    </td>
                    <td>{row.tenant_name}</td>
                    <td>{displayLabel(row.processing_status)}</td>
                    <td>{row.usage_meters.join(", ") || "No meters"}</td>
                    <td>
                      {row.source_linked_task_event_id && row.task_id
                        ? `Source linked · ${displayLabel(row.task_status ?? "task")}`
                        : "No task provenance"}
                    </td>
                    <td>
                      {row.payload_digest?.slice(0, 12) ?? "No digest"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="quiet-strip">
              <strong>No normalized fixture rows yet</strong>
              <span className="muted">
                Enqueue fixtures with npm run admin:provider-fixtures:enqueue,
                then run the guarded internal drain separately.
              </span>
            </div>
          )}
        </section>
      ) : null}
    </AppShell>
  );
}

function resolveFounderAdminAppOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_OUTPOST_APP_URL?.trim();

  if (configuredOrigin) {
    return configuredOrigin;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
  }

  return getOutpostAppUrl();
}
