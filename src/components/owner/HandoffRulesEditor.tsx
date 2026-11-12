"use client";

import { useActionState, useEffect, useRef } from "react";
import type {
  OwnerSetupActionState,
  PersistenceMode,
} from "@/application/owner-setup/action-result";
import { displayLabel } from "@/domain/formatting";
import type { HandoffRule } from "@/domain/handoff-rules";
import type { Location } from "@/domain/tenancy";

interface HandoffRulesEditorProps {
  onCreateHandoffRuleDraft: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  locations: Pick<Location, "id" | "name">[];
  onAddDraftRule: () => void;
  onRemoveDraftRule: (ruleId: string) => void;
  onRulesChange: (rules: HandoffRule[]) => void;
  onUpdateHandoffRule: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  persistenceMode: PersistenceMode;
  rules: HandoffRule[];
  tenantId: string;
}

export function HandoffRulesEditor({
  onCreateHandoffRuleDraft,
  locations,
  onAddDraftRule,
  onRemoveDraftRule,
  onRulesChange,
  onUpdateHandoffRule,
  persistenceMode,
  rules,
  tenantId
}: HandoffRulesEditorProps) {
  const [createState, createFormAction, isCreating] = useActionState(onCreateHandoffRuleDraft, {
    ok: false,
    message: ""
  });
  const [saveState, saveFormAction, isSaving] = useActionState(onUpdateHandoffRule, {
    ok: false,
    message: ""
  });
  const handledCreationTarget = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (
      createState.ok &&
      createState.targetId?.startsWith("rule_local_") &&
      handledCreationTarget.current !== createState.targetId
    ) {
      handledCreationTarget.current = createState.targetId;
      onRemoveDraftRule(createState.targetId);
    }
  }, [createState, onRemoveDraftRule]);

  function updateRule(id: string, update: Partial<HandoffRule>) {
    onRulesChange(rules.map((rule) => (rule.id === id ? { ...rule, ...update } : rule)));
  }

  const canPersist = persistenceMode === "backend";

  return (
    <section className="panel setup-editor" id="handoff-rules">
      <div className="panel-header">
        <div>
          <h2>Handoff rules</h2>
          <p>Backend-backed handoff policy edits. Transfer remains blocked until future provider work.</p>
        </div>
        <div className="panel-header-actions">
          <span className="channel-pill">{rules.length} rules</span>
          <button className="mini-button" onClick={onAddDraftRule} type="button">
            Add draft rule
          </button>
        </div>
      </div>
      {createState.ok && createState.message ? (
        <div className="inline-form-status success" role="status">
          {createState.message}
        </div>
      ) : null}
      <div className="setup-editor-list">
        {rules.map((rule) => {
          const isLocalDraft = rule.id.startsWith("rule_local_");
          return (
          <article className="setup-editor-row" key={rule.id}>
            <div>
              <span className="rail-title">{displayLabel(rule.trigger)}</span>
              <strong>{displayLabel(rule.topic)}</strong>
              <p>
                {displayLabel(rule.action)} to {rule.destination} during {rule.activeWindow}.
              </p>
              {rule.action === "transfer_when_live" ? (
                <span className="inline-warning">Transfer affordance only. No live phone provider is configured.</span>
              ) : null}
            </div>
            <form action={isLocalDraft ? createFormAction : saveFormAction} className="setup-editor-controls">
              <fieldset
                className="setup-editor-fieldset"
                disabled={isLocalDraft ? isCreating : isSaving}
              >
              <input name="tenantId" type="hidden" value={tenantId} />
              <input name="ruleId" type="hidden" value={rule.id} />
              {isLocalDraft ? (
                <>
                  <input name="creationKey" type="hidden" value={rule.id} />
                  <label>
                    Scope
                    <select
                      name="locationId"
                      onChange={(event) =>
                        updateRule(rule.id, {
                          locationId: event.target.value || undefined
                        })
                      }
                      value={rule.locationId ?? ""}
                    >
                      <option value="">Global</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              <label>
                Topic
                <input
                  name="topic"
                  onChange={(event) => updateRule(rule.id, { topic: event.target.value })}
                  value={rule.topic}
                />
              </label>
              <label>
                Trigger
                <select
                  onChange={(event) =>
                    updateRule(rule.id, {
                      trigger: event.target.value as HandoffRule["trigger"]
                    })
                  }
                  name="trigger"
                  value={rule.trigger}
                >
                  <option value="topic">Topic</option>
                  <option value="low_confidence">Low confidence</option>
                  <option value="always_human">Always human</option>
                  <option value="explicit_human_request">Explicit human request</option>
                  <option value="missing_fact">Missing fact</option>
                  <option value="conflict">Conflict</option>
                </select>
              </label>
              <label>
                Action
                <select
                  onChange={(event) =>
                    updateRule(rule.id, {
                      action: event.target.value as HandoffRule["action"]
                    })
                  }
                  name="action"
                  value={rule.action}
                >
                  <option value="create_task">Create task</option>
                  <option value="notify_staff">Notify staff</option>
                  <option value="transfer_when_live">Transfer when live</option>
                  <option value="block_automation">Block automation</option>
                </select>
              </label>
              <label>
                Destination
                <input
                  name="destination"
                  onChange={(event) => updateRule(rule.id, { destination: event.target.value })}
                  value={rule.destination}
                />
              </label>
              <label>
                Window
                <input
                  name="activeWindow"
                  onChange={(event) => updateRule(rule.id, { activeWindow: event.target.value })}
                  value={rule.activeWindow}
                />
              </label>
              <label>
                Priority
                <input
                  min={1}
                  max={1000}
                  name="priority"
                  onChange={(event) => {
                    const nextPriority =
                      event.target.value === "" ? Number.NaN : Number(event.target.value);
                    updateRule(rule.id, { priority: nextPriority });
                  }}
                  type="number"
                  value={Number.isNaN(rule.priority) ? "" : rule.priority}
                />
              </label>
              <label>
                Status
                <select
                  disabled={isLocalDraft}
                  onChange={(event) =>
                    updateRule(rule.id, {
                      status: event.target.value as HandoffRule["status"]
                    })
                  }
                  name="status"
                  value={rule.status}
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
              {isLocalDraft ? (
                <button
                  className="mini-button danger setup-remove-button"
                  onClick={() => onRemoveDraftRule(rule.id)}
                  type="button"
                >
                  Remove draft
                </button>
              ) : null}
              <button
                className="mini-button"
                disabled={!canPersist || isSaving || isCreating}
                type="submit"
              >
                {isLocalDraft ? "Create draft" : "Save rule"}
              </button>
              </fieldset>
            </form>
            {!createState.ok && createState.targetId === rule.id && createState.message ? (
              <div className="inline-form-status error" role="status">
                {createState.message}
              </div>
            ) : null}
            {saveState.targetId === rule.id && saveState.message ? (
              <div
                className={`inline-form-status ${saveState.ok ? "success" : "error"}`}
                role="status"
              >
                {saveState.message}
              </div>
            ) : null}
          </article>
          );
        })}
      </div>
    </section>
  );
}
