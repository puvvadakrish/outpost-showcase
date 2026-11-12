"use client";

import { useActionState, useEffect, useRef } from "react";
import type {
  OwnerSetupActionState,
  PersistenceMode,
} from "@/application/owner-setup/action-result";
import { displayLabel } from "@/domain/formatting";
import type { NotificationDestination } from "@/domain/notifications";
import type { Location } from "@/domain/tenancy";

interface NotificationDestinationEditorProps {
  onCreateNotificationDestinationDraft: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  locations: Pick<Location, "id" | "name">[];
  destinations: NotificationDestination[];
  onAddDraftDestination: () => void;
  onDestinationsChange: (destinations: NotificationDestination[]) => void;
  onRemoveDraftDestination: (destinationId: string) => void;
  onUpdateNotificationDestination: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  persistenceMode: PersistenceMode;
  tenantId: string;
}

export function NotificationDestinationEditor({
  onCreateNotificationDestinationDraft,
  locations,
  destinations,
  onAddDraftDestination,
  onDestinationsChange,
  onRemoveDraftDestination,
  onUpdateNotificationDestination,
  persistenceMode,
  tenantId
}: NotificationDestinationEditorProps) {
  const [createState, createFormAction, isCreating] = useActionState(
    onCreateNotificationDestinationDraft,
    { ok: false, message: "" }
  );
  const [saveState, saveFormAction, isSaving] = useActionState(onUpdateNotificationDestination, {
    ok: false,
    message: ""
  });
  const handledCreationTarget = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (
      createState.ok &&
      createState.targetId?.startsWith("dest_local_") &&
      handledCreationTarget.current !== createState.targetId
    ) {
      handledCreationTarget.current = createState.targetId;
      onRemoveDraftDestination(createState.targetId);
    }
  }, [createState, onRemoveDraftDestination]);

  function updateDestination(id: string, update: Partial<NotificationDestination>) {
    onDestinationsChange(
      destinations.map((destination) =>
        destination.id === id ? { ...destination, ...update } : destination
      )
    );
  }

  const canPersist = persistenceMode === "backend";

  return (
    <section className="panel setup-editor" id="notifications">
      <div className="panel-header">
        <div>
          <h2>Notification destinations</h2>
          <p>Backend-backed destination setup. Email delivery and outbound replies are still disconnected.</p>
        </div>
        <div className="panel-header-actions">
          <span className="channel-pill">{destinations.length} destinations</span>
          <button className="mini-button" onClick={onAddDraftDestination} type="button">
            Add draft destination
          </button>
        </div>
      </div>
      {createState.ok && createState.message ? (
        <div className="inline-form-status success" role="status">
          {createState.message}
        </div>
      ) : null}
      <div className="setup-editor-list">
        {destinations.map((destination) => {
          const isLocalDraft = destination.id.startsWith("dest_local_");
          return (
          <article className="setup-editor-row" key={destination.id}>
            <div>
              <span className="rail-title">{displayLabel(destination.type)}</span>
              <strong>{destination.label}</strong>
              <p>{destination.destination}</p>
            </div>
            <form action={isLocalDraft ? createFormAction : saveFormAction} className="setup-editor-controls">
              <fieldset
                className="setup-editor-fieldset"
                disabled={isLocalDraft ? isCreating : isSaving}
              >
              <input name="tenantId" type="hidden" value={tenantId} />
              <input name="destinationId" type="hidden" value={destination.id} />
              {isLocalDraft ? (
                <>
                  <input name="creationKey" type="hidden" value={destination.id} />
                  <label>
                    Scope
                    <select
                      name="locationId"
                      onChange={(event) =>
                        updateDestination(destination.id, {
                          locationId: event.target.value || undefined
                        })
                      }
                      value={destination.locationId ?? ""}
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
                Label
                <input
                  name="label"
                  onChange={(event) =>
                    updateDestination(destination.id, { label: event.target.value })
                  }
                  value={destination.label}
                />
              </label>
              <label>
                Type
                <select
                  name="type"
                  onChange={(event) =>
                    updateDestination(destination.id, {
                      type: event.target.value as NotificationDestination["type"]
                    })
                  }
                  value={destination.type}
                >
                  <option value="task_queue">Task queue</option>
                  <option value="staff_email">Staff email</option>
                  <option value="owner_email">Owner email</option>
                </select>
              </label>
              <label>
                Destination
                <input
                  name="destination"
                  onChange={(event) =>
                    updateDestination(destination.id, { destination: event.target.value })
                  }
                  value={destination.destination}
                />
              </label>
              <label>
                Status
                <select
                  disabled={isLocalDraft}
                  name="status"
                  onChange={(event) =>
                    updateDestination(destination.id, {
                      status: event.target.value as NotificationDestination["status"]
                    })
                  }
                  value={destination.status}
                >
                  <option value="ready">Ready</option>
                  <option value="draft">Draft</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
              {isLocalDraft ? (
                <button
                  className="mini-button danger setup-remove-button"
                  onClick={() => onRemoveDraftDestination(destination.id)}
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
                {isLocalDraft ? "Create draft" : "Save destination"}
              </button>
              </fieldset>
            </form>
            {!createState.ok &&
            createState.targetId === destination.id &&
            createState.message ? (
              <div className="inline-form-status error" role="status">
                {createState.message}
              </div>
            ) : null}
            {saveState.targetId === destination.id && saveState.message ? (
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
