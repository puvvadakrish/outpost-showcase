import { describe, expect, it } from "vitest";
import { manualTaskIntakeDuplicateCandidates } from "@/domain/manual-task-intake";
import { tasks } from "@/domain/seed";

describe("manual task intake duplicate awareness", () => {
  const candidate = {
    ...tasks[0],
    id: "task_existing_phone",
    intent: "Tour Follow-up",
    requesterContact: "+1 (555) 010-8811",
    status: "new" as const
  };

  it("matches unresolved same-location phone and intent formatting", () => {
    expect(
      manualTaskIntakeDuplicateCandidates([candidate], candidate.tenantId, {
        intent: "  tour   follow-up ",
        locationId: candidate.locationId,
        requesterContact: "15550108811"
      }).map((task) => task.id)
    ).toEqual([candidate.id]);
  });

  it("normalizes email casing and surrounding whitespace", () => {
    const emailCandidate = {
      ...candidate,
      id: "task_existing_email",
      requesterContact: "Person@Example.com"
    };

    expect(
      manualTaskIntakeDuplicateCandidates([emailCandidate], emailCandidate.tenantId, {
        intent: "tour follow-up",
        locationId: emailCandidate.locationId,
        requesterContact: " person@example.com "
      })
    ).toHaveLength(1);
  });

  it("excludes terminal, other-location, mismatched, and incomplete candidates", () => {
    expect(
      manualTaskIntakeDuplicateCandidates(
        [
          { ...candidate, id: "done", status: "done" },
          { ...candidate, id: "other_location", locationId: "loc_other" },
          { ...candidate, id: "other_intent", intent: "billing" },
          { ...candidate, id: "other_tenant", tenantId: "tenant_other" }
        ],
        candidate.tenantId,
        {
          intent: "tour follow-up",
          locationId: candidate.locationId,
          requesterContact: "15550108811"
        }
      )
    ).toEqual([]);
    expect(
      manualTaskIntakeDuplicateCandidates([candidate], candidate.tenantId, {
        intent: "",
        locationId: candidate.locationId,
        requesterContact: candidate.requesterContact
      })
    ).toEqual([]);
  });
});
