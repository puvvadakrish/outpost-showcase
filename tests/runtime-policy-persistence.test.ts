import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type {
  IssueRuntimePolicyCandidateIntentInput,
  RecordRuntimePolicyCandidateInput,
  RuntimePolicyCandidateWriter,
  RuntimePolicyIntentIssuer,
  RuntimePolicySummaryRepository,
} from "@/application/runtime-policy/ports";
import { RuntimePolicyApplicationService } from "@/application/runtime-policy/service";
import type { AnswerBankEntry } from "@/domain/answer-bank";
import type { HandoffRule } from "@/domain/handoff-rules";
import type { RuntimePolicySnapshotRecord } from "@/domain/runtime-policy-records";
import type { Location } from "@/domain/tenancy";
import { NeonRuntimePolicyRepository } from "@/infrastructure/neon/runtime-policy-repository";
import { RuntimePolicySystemWriter } from "@/infrastructure/neon/runtime-policy-system-writer";
import {
  assertPolicyDbAuthority,
  assertPolicyDatabaseMatchesDataApi,
  neonEndpointId,
  OUTPOST_POLICY_DATABASE_TIMEOUT_MS,
  OUTPOST_POLICY_COMPILER_ROLE,
  OUTPOST_POLICY_FUNCTION_ALLOWLIST,
  type PolicyDbClient,
} from "@/server/policy-db";
import {
  hasExactPolicyRuntimeMembers,
  POLICY_DATABASE_AUTHORITY_SQL,
} from "@/server/policy-database-authority.mjs";

vi.mock("server-only", () => ({}));

const repositorySource = readFileSync(
  "src/infrastructure/neon/runtime-policy-repository.ts",
  "utf8",
);
const migration = readFileSync(
  "neon/migrations/20260713040000_runtime_policy_candidate_snapshots.sql",
  "utf8",
);
const ownerActionSource = readFileSync("src/app/owner/actions.ts", "utf8");
const policyAuthorityVerifier = readFileSync(
  "scripts/verify-policy-database-authority.mjs",
  "utf8",
);

const location: Location = {
  address: "North",
  id: "location_a",
  name: "North",
  status: "active",
  tenantId: "tenant_a",
  timezone: "America/Chicago",
};

const answer: AnswerBankEntry = {
  answer: "Open weekdays",
  approvalStatus: "approved",
  id: "answer_hours",
  ownerAction: "approve",
  question: "When are you open?",
  reviewNote: "Owner-only note",
  runtimeBehavior: "answer_live",
  sourceLabel: "Owner-only source",
  tenantId: "tenant_a",
  topic: "Hours",
  updatedAt: "2026-07-13T00:00:00.000Z",
};

const handoff: HandoffRule = {
  action: "create_task",
  activeWindow: "always",
  destination: "front desk queue",
  id: "rule_freeze",
  priority: 10,
  status: "active",
  tenantId: "tenant_a",
  topic: "Freeze",
  trigger: "topic",
};

const storedRecord: RuntimePolicySnapshotRecord = {
  answerTopicCount: 1,
  candidateCount: 1,
  compilerRevision: 1,
  createdAt: "2026-07-13T18:00:00.000Z",
  decisionCount: 0,
  handoffCount: 1,
  id: "runtime_policy_snapshot_1",
  latestDecision: null,
  latestDecisionAt: null,
  locationId: "location_a",
  policyDigest: "b".repeat(64),
  schemaVersion: 1,
  snapshotVersion: 1,
  sourceDigest: "a".repeat(64),
  tenantId: "tenant_a",
  warningCount: 0,
};

class FakeRuntimePolicyRepository
  implements RuntimePolicySummaryRepository, RuntimePolicyIntentIssuer
{
  issued: IssueRuntimePolicyCandidateIntentInput[] = [];

  async listOwnerCandidateSummaries() {
    return [storedRecord];
  }

  async issueCandidateIntent(input: IssueRuntimePolicyCandidateIntentInput) {
    this.issued.push(input);
    return "c".repeat(64);
  }
}

class FakeRuntimePolicyWriter implements RuntimePolicyCandidateWriter {
  recorded: RecordRuntimePolicyCandidateInput[] = [];

  async recordCandidateTransaction(input: RecordRuntimePolicyCandidateInput) {
    this.recorded.push(input);
    return storedRecord;
  }
}

describe("RuntimePolicyApplicationService", () => {
  it("keeps the browser command location-only and reloads authoritative source rows", () => {
    expect(ownerActionSource).toMatch(
      /requireOwnerActionContext\(\s*"recording a runtime policy candidate",?\s*\)/u,
    );
    expect(ownerActionSource).toContain(
      "locationService.loadOwnerLocations(tenantId)",
    );
    expect(ownerActionSource).toContain(
      "answerService.loadOwnerAnswerBank(tenantId)",
    );
    expect(ownerActionSource).toContain(
      "handoffService.loadOwnerHandoffRules(tenantId)",
    );
    expect(ownerActionSource).toContain(
      "new RuntimePolicySystemWriter(getPolicyDbClient())",
    );
    expect(ownerActionSource).toContain("}, repository, writer)");
    expect(ownerActionSource).not.toContain('formData.get("policyBody")');
    expect(ownerActionSource).not.toContain('formData.get("snapshotVersion")');
    expect(ownerActionSource).not.toContain('formData.get("sourceDigest")');
  });

  it("compiles before recording and sends only the allowlisted candidate body", async () => {
    const repository = new FakeRuntimePolicyRepository();
    const writer = new FakeRuntimePolicyWriter();
    const service = new RuntimePolicyApplicationService(repository);
    const result = await service.recordCandidate(
      {
        answerBankEntries: [answer],
        handoffRules: [handoff],
        locationId: " location_a ",
        locations: [location],
        tenantId: " tenant_a ",
      },
      repository,
      writer,
    );

    expect(result).toEqual({ diagnostics: [], ok: true, record: storedRecord });
    expect(writer.recorded).toHaveLength(1);
    expect(writer.recorded[0]).toMatchObject({
      intentToken: "c".repeat(64),
    });
    expect(repository.issued).toHaveLength(1);
    expect(repository.issued[0]).toMatchObject({
      compilerRevision: 1,
      locationId: "location_a",
      tenantId: "tenant_a",
    });
    expect(repository.issued[0]?.policyBody).toEqual(
      writer.recorded[0]?.policyBody,
    );
    expect(writer.recorded[0]?.sourceState).toMatchObject({
      location: { id: "location_a", status: "active", tenantId: "tenant_a" },
      tenantId: "tenant_a",
    });
    expect(writer.recorded[0]?.policyBody).toEqual({
      answerTopics: [
        {
          answer: "Open weekdays",
          kind: "answer",
          sourceAnswerId: "answer_hours",
          topic: "Hours",
          topicKey: "hours",
        },
      ],
      defaultPolicy: { kind: "create_staff_task" },
      handoffs: [
        {
          action: "create_task",
          activeWindow: "always",
          destination: "front desk queue",
          priority: 10,
          sourceRuleId: "rule_freeze",
          topic: "Freeze",
          trigger: "topic",
        },
      ],
      warnings: [],
    });
    expect(JSON.stringify(writer.recorded[0])).not.toContain("Owner-only");
  });

  it("returns compiler diagnostics without calling persistence", async () => {
    const repository = new FakeRuntimePolicyRepository();
    const writer = new FakeRuntimePolicyWriter();
    const service = new RuntimePolicyApplicationService(repository);
    const result = await service.recordCandidate(
      {
        answerBankEntries: [
          answer,
          { ...answer, id: "answer_duplicate", topic: " hours " },
        ],
        handoffRules: [],
        locationId: "location_a",
        locations: [location],
        tenantId: "tenant_a",
      },
      repository,
      writer,
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "duplicate_answers",
    ]);
    expect(writer.recorded).toEqual([]);
    expect(repository.issued).toEqual([]);
  });

  it("rejects malformed scope and unavailable locations", async () => {
    const repository = new FakeRuntimePolicyRepository();
    const writer = new FakeRuntimePolicyWriter();
    const service = new RuntimePolicyApplicationService(repository);
    const valid = {
      answerBankEntries: [answer],
      handoffRules: [],
      locationId: "location_a",
      locations: [location],
      tenantId: "tenant_a",
    };

    await expect(
      service.recordCandidate({ ...valid, tenantId: " " }, repository, writer),
    ).rejects.toThrow("Runtime policy tenant identifier is required.");
    await expect(
      service.recordCandidate(
        { ...valid, locationId: " " },
        repository,
        writer,
      ),
    ).rejects.toThrow("Runtime policy location identifier is required.");
    await expect(
      service.recordCandidate(
        { ...valid, locationId: "foreign" },
        repository,
        writer,
      ),
    ).rejects.toThrow("Runtime policy location is unavailable to this tenant.");
    expect(writer.recorded).toEqual([]);
    expect(repository.issued).toEqual([]);
  });

  it("normalizes tenant identity before loading summary rows", async () => {
    const listOwnerCandidateSummaries = vi
      .fn()
      .mockResolvedValue([storedRecord]);
    const service = new RuntimePolicyApplicationService({
      listOwnerCandidateSummaries,
    });

    await expect(
      service.listOwnerCandidateSummaries(" tenant_a "),
    ).resolves.toEqual([storedRecord]);
    expect(listOwnerCandidateSummaries).toHaveBeenCalledWith("tenant_a");
  });
});

describe("NeonRuntimePolicyRepository", () => {
  it("maps only owner-visible summary rows", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          answer_topic_count: 1,
          candidate_count: 1,
          compiler_revision: 1,
          created_at: storedRecord.createdAt,
          decision_count: 0,
          handoff_count: 1,
          id: storedRecord.id,
          latest_decision: null,
          latest_decision_at: null,
          location_id: storedRecord.locationId,
          policy_digest: storedRecord.policyDigest,
          schema_version: 1,
          snapshot_version: 1,
          source_digest: storedRecord.sourceDigest,
          tenant_id: storedRecord.tenantId,
          warning_count: 0,
        },
      ],
      error: null,
    });
    const repository = new NeonRuntimePolicyRepository({ rpc } as never);

    await expect(
      repository.listOwnerCandidateSummaries("tenant_a"),
    ).resolves.toEqual([storedRecord]);
    expect(rpc).toHaveBeenCalledWith(
      "list_runtime_policy_candidate_summaries",
      { p_tenant_id: "tenant_a" },
    );
  });

  it("keeps policy JSON and actor identity out of the owner summary query", () => {
    expect(repositorySource).toContain(
      '"list_runtime_policy_candidate_summaries"',
    );
    expect(repositorySource).not.toContain('select("policy_body');
    expect(repositorySource).not.toContain("compiled_by_user_id");
    expect(repositorySource).not.toContain("record_runtime_policy_candidate");
  });

  it("issues an opaque owner intent through authenticated database authority", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: "d".repeat(64), error: null });
    const repository = new NeonRuntimePolicyRepository({ rpc } as never);

    await expect(
      repository.issueCandidateIntent({
        compilerRevision: 1,
        locationId: "location_a",
        policyBody: {
          answerTopics: [],
          defaultPolicy: { kind: "create_staff_task" },
          handoffs: [],
          warnings: [],
        },
        tenantId: "tenant_a",
      }),
    ).resolves.toBe("d".repeat(64));
    expect(rpc).toHaveBeenCalledWith("issue_runtime_policy_candidate_intent", {
      p_compiler_revision: 1,
      p_location_id: "location_a",
      p_policy_body: {
        answerTopics: [],
        defaultPolicy: { kind: "create_staff_task" },
        handoffs: [],
        warnings: [],
      },
      p_tenant_id: "tenant_a",
    });
  });
});

describe("RuntimePolicySystemWriter", () => {
  it("uses the exact protected policy capability and submits canonical evidence", async () => {
    const queries: Array<{ sql: string; values?: unknown[] }> = [];
    const client: PolicyDbClient = {
      async query<Row>(sql: string, values?: unknown[]) {
        queries.push({ sql, values });
        if (queries.length === 1) {
          expect(sql).toBe(POLICY_DATABASE_AUTHORITY_SQL);
          expect(values).toEqual([
            OUTPOST_POLICY_COMPILER_ROLE,
            [...OUTPOST_POLICY_FUNCTION_ALLOWLIST],
          ]);
          return {
            rows: [
              {
                session_user: "outpost_policy_login",
                has_policy_role: true,
                has_exact_policy_role_attributes: true,
                has_elevated_attributes: false,
                has_direct_table_authority: false,
                has_schema_creation: false,
                owns_policy_function: false,
                has_exact_role_memberships: true,
                has_exact_runtime_role_members: true,
                has_exact_security_definer_functions: true,
                has_exact_policy_function_acl: true,
                database_owner_name: "neondb_owner",
                policy_role_members: [
                  {
                    adminOption: false,
                    grantorName: "neondb_owner",
                    inheritOption: true,
                    memberName: "outpost_policy_login",
                    setOption: true,
                  },
                ],
              } as Row,
            ],
          };
        }
        return {
          rows: [
            {
              summary: {
                answer_topic_count: 1,
                compiler_revision: 1,
                created_at: storedRecord.createdAt,
                handoff_count: 1,
                id: storedRecord.id,
                location_id: storedRecord.locationId,
                policy_digest: storedRecord.policyDigest,
                schema_version: 1,
                snapshot_version: 1,
                source_digest: storedRecord.sourceDigest,
                tenant_id: storedRecord.tenantId,
                warning_count: 0,
              },
            } as Row,
          ],
        };
      },
    };
    const writer = new RuntimePolicySystemWriter(client);
    const input: RecordRuntimePolicyCandidateInput = {
      intentToken: "c".repeat(64),
      policyBody: {
        answerTopics: [],
        defaultPolicy: { kind: "create_staff_task" },
        handoffs: [],
        warnings: [],
      },
      sourceState: {
        answers: [],
        handoffs: [],
        location: { id: "location_a", status: "active", tenantId: "tenant_a" },
        tenantId: "tenant_a",
      },
    };

    await expect(writer.recordCandidateTransaction(input)).resolves.toEqual(
      storedRecord,
    );
    expect(queries[1]?.sql).toContain("public.record_runtime_policy_candidate");
    expect(queries[1]?.values).toEqual([
      "c".repeat(64),
      JSON.stringify(input.policyBody),
      JSON.stringify(input.sourceState),
    ]);
  });
});

describe("policy database deployment authority", () => {
  it("requires the policy and Data API URLs to identify the same Neon endpoint", () => {
    expect(
      neonEndpointId(
        "https://ep-outpost-preview.apirest.us-east-1.aws.neon.tech/neondb/rest/v1",
      ),
    ).toBe("ep-outpost-preview");
    expect(
      neonEndpointId(
        "postgresql://policy:secret@ep-outpost-preview-pooler.us-east-1.aws.neon.tech/neondb",
      ),
    ).toBe("ep-outpost-preview");
    expect(
      assertPolicyDatabaseMatchesDataApi({
        NEXT_PUBLIC_NEON_DATA_API_URL:
          "https://ep-outpost-preview.apirest.neon.tech/neondb/rest/v1",
        OUTPOST_POLICY_DATABASE_URL:
          "postgresql://policy:secret@ep-outpost-preview-pooler.neon.tech/neondb",
      }),
    ).toBe("ep-outpost-preview");
    expect(() =>
      assertPolicyDatabaseMatchesDataApi({
        NEXT_PUBLIC_NEON_DATA_API_URL:
          "https://ep-outpost-preview.apirest.neon.tech/neondb/rest/v1",
        OUTPOST_POLICY_DATABASE_URL:
          "postgresql://policy:secret@ep-outpost-production.neon.tech/neondb",
      }),
    ).toThrow("must match the configured Neon Data API branch");
  });

  it("verifies the dedicated credential against the same exact capability", () => {
    expect(policyAuthorityVerifier).toContain("OUTPOST_POLICY_DATABASE_URL");
    expect(OUTPOST_POLICY_COMPILER_ROLE).toBe("outpost_policy_compiler");
    expect(OUTPOST_POLICY_FUNCTION_ALLOWLIST).toEqual([
      "record_runtime_policy_candidate(text,jsonb,jsonb)",
    ]);
    expect(POLICY_DATABASE_AUTHORITY_SQL).toContain(
      "has_exact_security_definer_functions",
    );
    expect(POLICY_DATABASE_AUTHORITY_SQL).toContain(
      "has_any_column_privilege",
    );
    expect(POLICY_DATABASE_AUTHORITY_SQL).toContain("membership.inherit_option");
    expect(POLICY_DATABASE_AUTHORITY_SQL).toContain("membership.set_option");
    expect(POLICY_DATABASE_AUTHORITY_SQL).toContain(
      "runtime_member_role.rolname = database_owner.rolname",
    );
    expect(POLICY_DATABASE_AUTHORITY_SQL).toContain(
      "not capability_role.rolcanlogin",
    );
    expect(POLICY_DATABASE_AUTHORITY_SQL).toContain("aclexplode");
    expect(POLICY_DATABASE_AUTHORITY_SQL).toContain(
      "cardinality($2::text[]) * 2",
    );
    expect(POLICY_DATABASE_AUTHORITY_SQL).toContain(
      "and not execute_acl.is_grantable",
    );
    expect(POLICY_DATABASE_AUTHORITY_SQL).toContain("limit 3");
    expect(POLICY_DATABASE_AUTHORITY_SQL).not.toContain("claim_jobs(integer,text)");
    expect(policyAuthorityVerifier).toContain("statement_timeout");
    expect(OUTPOST_POLICY_DATABASE_TIMEOUT_MS).toBe(2_000);
  });

  it.each([
    ["one runtime login", [
      { adminOption: false, grantorName: "neondb_owner", inheritOption: true, memberName: "policy_login", setOption: true },
    ]],
    ["one runtime login plus the observed Neon administrator", [
      { adminOption: true, grantorName: "cloud_admin", inheritOption: false, memberName: "neondb_owner", setOption: false },
      { adminOption: false, grantorName: "neondb_owner", inheritOption: true, memberName: "policy_login", setOption: true },
    ]],
  ])("accepts %s", (_label, members) => {
    expect(hasExactPolicyRuntimeMembers({
      databaseOwnerName: "neondb_owner",
      members,
      sessionUser: "policy_login",
    })).toBe(true);
  });

  it.each([
    ["no members", []],
    ["delegating runtime row", [
      { adminOption: true, grantorName: "neondb_owner", inheritOption: true, memberName: "policy_login", setOption: true },
    ]],
    ["non-inheriting runtime row", [
      { adminOption: false, grantorName: "neondb_owner", inheritOption: false, memberName: "policy_login", setOption: true },
    ]],
    ["duplicate runtime grants", [
      { adminOption: false, grantorName: "neondb_owner", inheritOption: true, memberName: "policy_login", setOption: true },
      { adminOption: true, grantorName: "cloud_admin", inheritOption: false, memberName: "policy_login", setOption: false },
    ]],
    ["second executable login", [
      { adminOption: false, grantorName: "neondb_owner", inheritOption: true, memberName: "policy_login", setOption: true },
      { adminOption: false, grantorName: "neondb_owner", inheritOption: true, memberName: "other_login", setOption: true },
    ]],
    ["inert unexpected login", [
      { adminOption: false, grantorName: "neondb_owner", inheritOption: true, memberName: "policy_login", setOption: true },
      { adminOption: false, grantorName: "neondb_owner", inheritOption: false, memberName: "other_login", setOption: false },
    ]],
    ["wrong managed grantor", [
      { adminOption: false, grantorName: "neondb_owner", inheritOption: true, memberName: "policy_login", setOption: true },
      { adminOption: true, grantorName: "neondb_owner", inheritOption: false, memberName: "neondb_owner", setOption: false },
    ]],
    ["executable managed administrator", [
      { adminOption: false, grantorName: "neondb_owner", inheritOption: true, memberName: "policy_login", setOption: true },
      { adminOption: true, grantorName: "cloud_admin", inheritOption: false, memberName: "neondb_owner", setOption: true },
    ]],
    ["three membership rows", [
      { adminOption: false, grantorName: "neondb_owner", inheritOption: true, memberName: "policy_login", setOption: true },
      { adminOption: true, grantorName: "cloud_admin", inheritOption: false, memberName: "neondb_owner", setOption: false },
      { adminOption: false, grantorName: "neondb_owner", inheritOption: false, memberName: "other_login", setOption: false },
    ]],
  ])("rejects %s", (_label, members) => {
    expect(hasExactPolicyRuntimeMembers({
      databaseOwnerName: "neondb_owner",
      members,
      sessionUser: "policy_login",
    })).toBe(false);
  });

  it.each([
    ["a direct relation or column grant", { has_direct_table_authority: true }],
    ["an indirect member of the dedicated runtime login", { has_exact_runtime_role_members: false }],
    ["unsafe compiler-role attributes", { has_exact_policy_role_attributes: false }],
    ["an additional direct function executor", { has_exact_policy_function_acl: false }],
  ])("rejects %s", async (_label, override) => {
    const client: PolicyDbClient = {
      async query<Row>() {
        return {
          rows: [{
            session_user: "policy_login",
            has_policy_role: true,
            has_exact_policy_role_attributes: true,
            has_elevated_attributes: false,
            has_direct_table_authority: false,
            has_schema_creation: false,
            owns_policy_function: false,
            has_exact_role_memberships: true,
            has_exact_runtime_role_members: true,
            has_exact_security_definer_functions: true,
            has_exact_policy_function_acl: true,
            database_owner_name: "neondb_owner",
            policy_role_members: [
              {
                adminOption: false,
                grantorName: "neondb_owner",
                inheritOption: true,
                memberName: "policy_login",
                setOption: true,
              },
            ],
            ...override,
          } as Row],
        };
      },
    };

    await expect(assertPolicyDbAuthority(client)).rejects.toThrow(
      "lacks compiler authority",
    );
  });
});

describe("runtime policy candidate migration", () => {
  it("creates owner-readable append-only storage with no activation state", () => {
    expect(migration).toContain("create table runtime_policy_snapshots");
    expect(migration).toContain(
      "alter table runtime_policy_snapshots enable row level security",
    );
    expect(migration).toContain(
      'create policy "owners read runtime policy candidates"',
    );
    expect(migration).toContain(
      "revoke all on runtime_policy_snapshots from public, anonymous, authenticated",
    );
    expect(migration).not.toContain(
      "grant select on runtime_policy_snapshots to authenticated",
    );
    expect(migration).not.toContain(
      "grant select (\n  id, tenant_id, location_id",
    );
    expect(migration).toContain(
      "before update or delete on runtime_policy_snapshots",
    );
    expect(migration).not.toMatch(
      /\bactivated_at\b|\bactivation_status\b|activate_runtime_policy/u,
    );
  });

  it("allocates versions under the location lock and replays only exact work", () => {
    const lockAt = migration.indexOf("select status\n    into v_location_status");
    const versionAt = migration.indexOf(
      "select coalesce(max(snapshot_version), 0) + 1",
    );
    expect(lockAt).toBeGreaterThan(0);
    expect(migration.slice(lockAt, lockAt + 260)).toContain("for update");
    expect(versionAt).toBeGreaterThan(lockAt);
    expect(migration).toContain(
      "unique (tenant_id, location_id, snapshot_version)",
    );
    expect(migration).toContain("unique (tenant_id, creation_key)");
    expect(migration).toContain(
      "'candidate:r' || v_intent.compiler_revision::text || ':' || v_source_digest",
    );
    expect(migration).toContain("v_existing.policy_body <> p_policy_body");
    expect(migration).toContain(
      "creation key conflicts with different runtime policy candidate",
    );
  });

  it("validates bounded candidate JSON and returns a summary without policy content", () => {
    expect(migration).toContain(
      "runtime_policy_candidate_body_is_valid(p_policy_body)",
    );
    expect(migration).toContain("octet_length(p_body::text) > 2097152");
    expect(migration).toContain(
      "jsonb_array_length(p_body->'answerTopics') > 1000",
    );
    expect(migration).toContain(
      "jsonb_array_length(p_body->'handoffs') > 1000",
    );
    expect(migration).toContain(
      "jsonb_array_length(p_body->'warnings') > 1000",
    );
    const summaryFunction = migration.slice(
      migration.indexOf(
        "create or replace function runtime_policy_snapshot_summary",
      ),
      migration.indexOf(
        "create or replace function list_runtime_policy_candidate_summaries",
      ),
    );
    expect(summaryFunction).not.toContain("policy_body");
    expect(migration).toContain("runtime_policy.candidate_recorded");
    expect(migration).toContain("'activation_state', 'not_available'");
  });

  it("binds writes to an owner intent, dedicated compiler authority, and current source", () => {
    expect(migration).toContain(
      "revoke execute on function record_runtime_policy_candidate(text, jsonb, jsonb)",
    );
    expect(migration).toContain("from public, anonymous, authenticated");
    expect(migration).toContain("create role outpost_policy_compiler");
    expect(migration).toContain("to outpost_policy_compiler");
    expect(migration).not.toContain("to outpost_job_runtime");
    expect(migration).toContain(
      "create table runtime_policy_candidate_intents",
    );
    expect(migration).toContain("issue_runtime_policy_candidate_intent");
    expect(migration).toContain(
      "runtime policy candidate body does not match its owner intent",
    );
    expect(migration).toContain(
      "token_digest = encode(public.digest(p_intent_token",
    );
    expect(migration).toContain("v_intent.source_digest <> v_source_digest");
    expect(migration).toContain("v_current_source_state <> p_source_state");
    expect(migration).toContain(
      "unique (tenant_id, location_id, actor_user_id)",
    );
    expect(migration).toContain(
      "on conflict (tenant_id, location_id, actor_user_id) do update",
    );
    expect(migration).toContain(
      "v_intent.expires_at <= clock_timestamp()",
    );
    expect(migration).toContain(
      "runtime policy source state changed before persistence",
    );
    expect(migration).toContain(
      "v_actor_user_id := public.current_app_user_id()",
    );
    expect(migration).toContain("'visibility', 'owner_only'");
    expect(migration).toContain("members read tenant-visible audit events");
    expect(migration).toContain(
      "create or replace function list_runtime_policy_candidate_summaries",
    );
    expect(migration).toContain(
      "foreign key (tenant_id, compiled_by_user_id)",
    );
    expect(migration).toContain(
      "foreign key (tenant_id, location_id, snapshot_id)",
    );
  });
});
