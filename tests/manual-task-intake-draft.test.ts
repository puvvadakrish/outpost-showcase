import { describe, expect, it } from "vitest";
import {
  createManualTaskIntakeDraft,
  manualTaskIntakeDraftIsDirty,
  setManualTaskIntakeDraftField
} from "@/domain/manual-task-intake-draft";

describe("manual task intake drafts", () => {
  it("creates privacy-minimal defaults for the current location", () => {
    const draft = createManualTaskIntakeDraft("loc_acme_main");

    expect(draft).toEqual({
      channel: "manual",
      claimForActor: false,
      confidence: "0.9",
      intent: "",
      locationId: "loc_acme_main",
      requesterContact: "",
      requesterName: "",
      suggestedNextStep: "",
      summary: ""
    });
    expect(manualTaskIntakeDraftIsDirty(draft, "loc_acme_main")).toBe(false);
  });

  it("updates one field immutably and reports non-default choices as dirty", () => {
    const draft = createManualTaskIntakeDraft("loc_acme_main");
    const updated = setManualTaskIntakeDraftField(draft, "channel", "email");

    expect(updated).not.toBe(draft);
    expect(updated.channel).toBe("email");
    expect(draft.channel).toBe("manual");
    expect(manualTaskIntakeDraftIsDirty(updated, "loc_acme_main")).toBe(true);
  });

  it("treats unfinished customer text as dirty without normalizing it away", () => {
    const draft = setManualTaskIntakeDraftField(
      createManualTaskIntakeDraft("loc_acme_main"),
      "summary",
      "  Asked for a tour  "
    );

    expect(draft.summary).toBe("  Asked for a tour  ");
    expect(manualTaskIntakeDraftIsDirty(draft, "loc_acme_main")).toBe(true);
  });
});
