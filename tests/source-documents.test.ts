import { describe, expect, it } from "vitest";
import {
  manualSourceDocuments,
  manualSourceDocumentsForLocation,
  sourceDocumentStatusLabel
} from "@/domain/sources";
import type { SourceDocument } from "@/domain/sources";

const sourceDocuments: SourceDocument[] = [
  {
    id: "source_old_manual",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    type: "manual",
    label: "Old notes",
    status: "ready",
    factsFound: 2,
    conflictsFound: 0,
    lastCheckedAt: "2026-06-08T13:25:00.000Z"
  },
  {
    id: "source_website",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_main",
    type: "website",
    label: "Website",
    status: "needs_review",
    factsFound: 8,
    conflictsFound: 1,
    lastCheckedAt: "2026-06-10T13:25:00.000Z"
  },
  {
    id: "source_new_manual",
    tenantId: "tenant_acme_fitness",
    locationId: "loc_acme_annex",
    type: "manual",
    label: "Annex notes",
    status: "needs_review",
    factsFound: 4,
    conflictsFound: 1,
    lastCheckedAt: "2026-06-12T13:25:00.000Z"
  }
];

describe("source document domain helpers", () => {
  it("sorts manual source documents from newest to oldest without mutating input", () => {
    expect(manualSourceDocuments(sourceDocuments).map((source) => source.id)).toEqual([
      "source_new_manual",
      "source_old_manual"
    ]);
    expect(sourceDocuments.map((source) => source.id)).toEqual([
      "source_old_manual",
      "source_website",
      "source_new_manual"
    ]);
  });

  it("filters manual source documents by location for owner intake selection", () => {
    expect(manualSourceDocumentsForLocation(sourceDocuments, "loc_acme_main")).toEqual([
      expect.objectContaining({ id: "source_old_manual" })
    ]);
  });

  it("renders source document statuses as owner-facing labels", () => {
    expect(sourceDocumentStatusLabel("needs_review")).toBe("Needs review");
    expect(sourceDocumentStatusLabel("conflict")).toBe("Conflict");
  });
});
