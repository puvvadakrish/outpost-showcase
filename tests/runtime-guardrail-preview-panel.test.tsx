import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RuntimeGuardrailPreviewPanel } from "@/components/owner/RuntimeGuardrailPreviewPanel";

describe("RuntimeGuardrailPreviewPanel", () => {
  it("renders topic-only location guardrails with blocked execution copy", () => {
    const rendered = renderToStaticMarkup(
      <RuntimeGuardrailPreviewPanel
        previews={[
          {
            locationId: "location_a",
            locationName: "North",
            eligibleAnswerTopics: [{ id: "answer_a", scope: "global", topic: "Amenities" }],
            staffRoutedAnswerTopics: [
              { id: "answer_b", scope: "location", topic: "Membership freeze" }
            ],
            blockedAnswerTopics: [{ id: "answer_c", scope: "location", topic: "Pricing" }],
            activeHandoffTopics: [
              {
                id: "rule_a",
                scope: "location",
                topic: "Caller asks for a person",
                action: "transfer_when_live",
                priority: 10
              }
            ],
            inactiveHandoffRuleCount: 2,
            retiredAnswerCount: 1,
            reviewTopics: [
              {
                key: "amenities",
                topic: "Amenities",
                answerCount: 2,
                activeHandoffCount: 1,
                reasons: ["duplicate_answers", "eligible_answer_handoff_overlap"]
              }
            ]
          }
        ]}
      />
    );

    expect(rendered).toContain('aria-label="Future runtime guardrail preview"');
    expect(rendered).toContain("No provider execution");
    expect(rendered).toContain("Amenities");
    expect(rendered).toContain("Membership freeze");
    expect(rendered).toContain("Pricing");
    expect(rendered).toContain("Caller asks for a person");
    expect(rendered).toContain("Transfer when live");
    expect(rendered).toContain("1 retired answer · 2 inactive rules");
    expect(rendered).toContain("Review needed");
    expect(rendered).toContain("2 answers · 1 active handoff");
    expect(rendered).toContain("Multiple answer rows apply");
    expect(rendered).toContain("Eligible answer overlaps an active handoff");
    expect(rendered).not.toContain("answer text");
    expect(rendered).not.toContain("configured staff number");
    expect(rendered).not.toContain("provider payload");
  });

  it("renders a stable empty location state", () => {
    const rendered = renderToStaticMarkup(<RuntimeGuardrailPreviewPanel previews={[]} />);

    expect(rendered).toContain("No locations available");
    expect(rendered).toContain("Add a tenant location");
  });
});
