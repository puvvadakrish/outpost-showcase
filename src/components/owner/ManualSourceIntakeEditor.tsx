"use client";

import { useActionState, useMemo, useState } from "react";
import type {
  OwnerSetupActionState,
  PersistenceMode,
} from "@/application/owner-setup/action-result";
import {
  manualSourceDocuments,
  manualSourceDocumentsForLocation,
  sourceDocumentStatusLabel,
  type SourceDocument
} from "@/domain/sources";
import type { Location } from "@/domain/tenancy";

interface ManualSourceIntakeEditorProps {
  locations: Location[];
  onUpsertManualSourceDocument: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onProposeAnswersFromManualSource: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  persistenceMode: PersistenceMode;
  sourceDocuments: SourceDocument[];
  tenantId: string;
}

export function ManualSourceIntakeEditor({
  locations,
  onProposeAnswersFromManualSource,
  onUpsertManualSourceDocument,
  persistenceMode,
  sourceDocuments,
  tenantId
}: ManualSourceIntakeEditorProps) {
  const allManualSources = useMemo(() => manualSourceDocuments(sourceDocuments), [sourceDocuments]);
  const initialLocationId = allManualSources[0]?.locationId ?? locations[0]?.id ?? "";
  const [selectedLocationId, setSelectedLocationId] = useState(initialLocationId);
  const [selectedSourceDocumentId, setSelectedSourceDocumentId] = useState(
    manualSourceDocumentsForLocation(sourceDocuments, initialLocationId)[0]?.id ?? ""
  );
  const manualSourcesForLocation = useMemo(
    () => manualSourceDocumentsForLocation(sourceDocuments, selectedLocationId),
    [selectedLocationId, sourceDocuments]
  );
  const selectedManualSource = manualSourcesForLocation.find(
    (source) => source.id === selectedSourceDocumentId
  );
  const [sourceLabel, setSourceLabel] = useState(selectedManualSource?.label ?? "Owner setup notes");
  const [factRows, setFactRows] = useState(["fact-row-1", "fact-row-2", "fact-row-3", "fact-row-4"]);
  const [saveState, saveFormAction, isSaving] = useActionState(onUpsertManualSourceDocument, {
    ok: false,
    message: ""
  });
  const [proposalState, proposalFormAction, isStagingProposals] = useActionState(
    onProposeAnswersFromManualSource,
    {
      ok: false,
      message: ""
    }
  );
  const selectedLocation = locations.find((location) => location.id === selectedLocationId);
  const canPersist = persistenceMode === "backend" && Boolean(selectedLocation);
  const stageableManualSources = allManualSources.filter((source) => source.factsFound > 0);

  function handleLocationChange(nextLocationId: string) {
    const nextManualSource = manualSourceDocumentsForLocation(sourceDocuments, nextLocationId)[0];

    setSelectedLocationId(nextLocationId);
    setSelectedSourceDocumentId(nextManualSource?.id ?? "");
    setSourceLabel(nextManualSource?.label ?? "Owner setup notes");
  }

  function handleSourceDocumentChange(nextSourceDocumentId: string) {
    const nextManualSource = manualSourcesForLocation.find((source) => source.id === nextSourceDocumentId);

    setSelectedSourceDocumentId(nextSourceDocumentId);
    setSourceLabel(nextManualSource?.label ?? "Owner setup notes");
  }

  function addFactRow() {
    setFactRows((rows) => [
      ...rows,
      `fact-row-${Date.now()}-${Math.random().toString(36).slice(2)}`
    ]);
  }

  function removeFactRow(rowKey: string) {
    setFactRows((rows) => (rows.length > 1 ? rows.filter((row) => row !== rowKey) : rows));
  }

  return (
    <section className="panel setup-editor" id="manual-source-intake">
      <div className="panel-header">
        <div>
          <h2>Manual source intake</h2>
          <p>Owner or staff notes become proposed facts. Saved facts can stage draft or conflict answers.</p>
        </div>
        <span className="channel-pill">
          {allManualSources.length > 0 ? `${allManualSources.length} manual sources` : "Create source"}
        </span>
      </div>
      {saveState.message ? (
        <div
          className={`manual-source-status ${saveState.ok ? "success" : "error"}`}
          role="status"
        >
          {saveState.message}
        </div>
      ) : null}
      {proposalState.message ? (
        <div
          className={`manual-source-status ${proposalState.ok ? "success" : "error"}`}
          role="status"
        >
          {proposalState.message}
        </div>
      ) : null}
      <form action={saveFormAction} autoComplete="off" className="manual-source-form">
        <input name="tenantId" type="hidden" value={tenantId} />
        <div className="manual-source-grid">
          <label>
            Location
            <select
              disabled={!canPersist}
              name="locationId"
              onChange={(event) => handleLocationChange(event.target.value)}
              value={selectedLocationId}
            >
              {locations.length > 0 ? (
                locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))
              ) : (
                <option value="">No location</option>
              )}
            </select>
          </label>
          <label>
            Manual source
            <select
              disabled={!canPersist}
              name="sourceDocumentId"
              onChange={(event) => handleSourceDocumentChange(event.target.value)}
              value={selectedSourceDocumentId}
            >
              <option value="">Create a new manual source</option>
              {manualSourcesForLocation.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
          <label className="manual-source-wide">
            Source label
            <input
              disabled={!canPersist}
              name="label"
              onChange={(event) => setSourceLabel(event.target.value)}
              value={sourceLabel}
            />
          </label>
        </div>
        <div className="manual-source-fieldset">
          <div>
            <h3>Proposed facts</h3>
            <p>Saving replaces the proposed fact set for the selected manual source.</p>
          </div>
          <button
            className="mini-button quiet"
            disabled={!canPersist || factRows.length >= 20}
            onClick={addFactRow}
            type="button"
          >
            Add fact row
          </button>
        </div>
        {factRows.map((rowKey, index) => (
          <div className="manual-source-fact-row" key={rowKey}>
            <div className="manual-source-fact-index">
              <span className="rail-title">Fact {index + 1}</span>
              <button
                className="mini-button quiet"
                disabled={!canPersist || factRows.length <= 1}
                onClick={() => removeFactRow(rowKey)}
                type="button"
              >
                Remove
              </button>
            </div>
            <label>
              Topic
              <input disabled={!canPersist} name="factTopic" placeholder="hours" />
            </label>
            <label className="manual-source-fact-value">
              Fact
              <textarea
                disabled={!canPersist}
                name="factValue"
                placeholder="Staffed hours need owner review before any live answer uses them."
                rows={2}
              />
            </label>
            <label>
              Confidence
              <input
                defaultValue={index === 0 ? "0.9" : ""}
                disabled={!canPersist}
                max="1"
                min="0"
                name="factConfidence"
                step="0.001"
                type="number"
              />
            </label>
            <label>
              Conflict group
              <input
                disabled={!canPersist}
                name="factConflictGroup"
                placeholder="pricing-public-copy"
              />
            </label>
          </div>
        ))}
        <div className="manual-source-actions">
          <span className="muted">
            {selectedManualSource
              ? `${selectedManualSource.factsFound} persisted facts and ${selectedManualSource.conflictsFound} conflicts currently staged.`
              : `A new manual source will be created for ${selectedLocation?.name ?? "the selected location"}.`}
          </span>
          <button className="mini-button" disabled={!canPersist || isSaving} type="submit">
            Save source
          </button>
        </div>
      </form>
      <div className="manual-source-proposal-form">
        <div>
          <h3>Saved manual sources</h3>
          <p className="muted">Stage saved facts as draft or conflict answers for owner review.</p>
        </div>
        {stageableManualSources.length > 0 ? (
          <div className="manual-source-list">
            {stageableManualSources.map((source) => {
              const location = locations.find((candidate) => candidate.id === source.locationId);

              return (
                <form action={proposalFormAction} className="manual-source-card" key={source.id}>
                  <input name="tenantId" type="hidden" value={tenantId} />
                  <input name="sourceDocumentId" type="hidden" value={source.id} />
                  <div>
                    <strong>{source.label}</strong>
                    <span>
                      {location?.name ?? "Unknown location"} - {sourceDocumentStatusLabel(source.status)}
                    </span>
                  </div>
                  <div className="manual-source-card-metrics" aria-label="manual source metrics">
                    <span>{source.factsFound} facts</span>
                    <span>{source.conflictsFound} conflicts</span>
                  </div>
                  <button
                    className="mini-button"
                    disabled={persistenceMode !== "backend" || isStagingProposals}
                    type="submit"
                  >
                    Stage proposals
                  </button>
                </form>
              );
            })}
          </div>
        ) : (
          <div className="operational-empty-state manual-source-empty">
            <strong>No saved facts are ready to stage.</strong>
            <p>Save at least one manual fact for a location, then stage the saved source into owner answer review.</p>
            <a className="mini-button quiet" href="#manual-source-intake">
              Add source facts
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
