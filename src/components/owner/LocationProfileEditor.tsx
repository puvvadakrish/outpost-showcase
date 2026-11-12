"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type {
  OwnerSetupActionState,
  PersistenceMode,
} from "@/application/owner-setup/action-result";
import { displayLabel } from "@/domain/formatting";
import type { Location } from "@/domain/tenancy";

const EMPTY_LOCATION_DRAFT = {
  address: "",
  name: "",
  publicPhone: "",
  routingPhone: "",
  timezone: "America/Chicago"
};

interface LocationProfileEditorProps {
  includedLocations: number;
  locations: Location[];
  onCreateLocationDraft: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  onUpdateLocationProfile: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  persistenceMode: PersistenceMode;
  tenantId: string;
}

export function LocationProfileEditor({
  includedLocations,
  locations,
  onCreateLocationDraft,
  onUpdateLocationProfile,
  persistenceMode,
  tenantId
}: LocationProfileEditorProps) {
  const [createState, createFormAction, isCreating] = useActionState(onCreateLocationDraft, {
    ok: false,
    message: ""
  });
  const [creationKey, setCreationKey] = useState("");
  const [locationDraft, setLocationDraft] = useState(EMPTY_LOCATION_DRAFT);
  const [saveState, saveFormAction, isSaving] = useActionState(onUpdateLocationProfile, {
    ok: false,
    message: ""
  });
  const [draftLocations, setDraftLocations] = useState(locations);

  const locationCount = useMemo(() => draftLocations.length, [draftLocations]);
  const canPersist = persistenceMode === "backend";
  const locationAllowanceReached = locationCount >= includedLocations;

  useEffect(() => {
    setCreationKey(`location_${crypto.randomUUID()}`);
  }, []);

  useEffect(() => {
    setDraftLocations(locations);
  }, [locations]);

  useEffect(() => {
    if (createState.ok) {
      setCreationKey(`location_${crypto.randomUUID()}`);
      setLocationDraft(EMPTY_LOCATION_DRAFT);
    }
  }, [createState]);

  function updateLocation(id: string, update: Partial<Location>) {
    setDraftLocations((current) =>
      current.map((location) => (location.id === id ? { ...location, ...update } : location))
    );
  }

  return (
    <section className="panel setup-editor" id="location-profile">
      <div className="panel-header">
        <div>
          <h2>Location profiles</h2>
          <p>Backend-backed setup records. Routing phone remains stored context until provider work.</p>
        </div>
        <div className="panel-header-actions">
          <span className="channel-pill">{locationCount} locations</span>
        </div>
      </div>
      {createState.message ? (
        <div className={`inline-form-status ${createState.ok ? "success" : "error"}`} role="status">
          {createState.message}
        </div>
      ) : null}
      <form
        action={createFormAction}
        className="setup-editor-controls location-create-form"
      >
        <fieldset className="setup-editor-fieldset" disabled={isCreating}>
        <input name="tenantId" type="hidden" value={tenantId} />
        <input
          name="creationKey"
          type="hidden"
          value={creationKey}
        />
        <label>
          Name
        <input
          maxLength={120}
          name="name"
          onChange={(event) =>
            setLocationDraft((draft) => ({ ...draft, name: event.target.value }))
          }
          required
          value={locationDraft.name}
        />
        </label>
        <label>
          Address
          <input
            maxLength={240}
            name="address"
            onChange={(event) =>
              setLocationDraft((draft) => ({ ...draft, address: event.target.value }))
            }
            required
            value={locationDraft.address}
          />
        </label>
        <label>
          Public phone
          <input
            maxLength={80}
            name="publicPhone"
            onChange={(event) =>
              setLocationDraft((draft) => ({ ...draft, publicPhone: event.target.value }))
            }
            value={locationDraft.publicPhone}
          />
        </label>
        <label>
          Routing phone
          <input
            maxLength={80}
            name="routingPhone"
            onChange={(event) =>
              setLocationDraft((draft) => ({ ...draft, routingPhone: event.target.value }))
            }
            value={locationDraft.routingPhone}
          />
        </label>
        <label>
          Timezone
          <input
            maxLength={80}
            name="timezone"
            onChange={(event) =>
              setLocationDraft((draft) => ({ ...draft, timezone: event.target.value }))
            }
            required
            value={locationDraft.timezone}
          />
        </label>
        <button
          className="mini-button"
          disabled={!canPersist || !creationKey || isCreating || locationAllowanceReached}
          type="submit"
        >
          Add draft location
        </button>
        <span className="muted">
          {locationCount} of {includedLocations} plan locations configured
        </span>
        </fieldset>
      </form>
      <div className="setup-editor-list">
        {draftLocations.map((location) => (
          <article className="setup-editor-row" key={location.id}>
            <div>
              <span className="rail-title">{displayLabel(location.status)}</span>
              <strong>{location.name}</strong>
              <p>
                {location.address} · {location.timezone}
              </p>
            </div>
            <form action={saveFormAction} className="setup-editor-controls">
              <fieldset className="setup-editor-fieldset" disabled={isSaving}>
              <input name="tenantId" type="hidden" value={tenantId} />
              <input name="locationId" type="hidden" value={location.id} />
              <label>
                Name
                <input
                  name="name"
                  onChange={(event) => updateLocation(location.id, { name: event.target.value })}
                  value={location.name}
                />
              </label>
              <label>
                Address
                <input
                  name="address"
                  onChange={(event) => updateLocation(location.id, { address: event.target.value })}
                  value={location.address}
                />
              </label>
              <label>
                Public phone
                <input
                  name="publicPhone"
                  onChange={(event) =>
                    updateLocation(location.id, { publicPhone: event.target.value })
                  }
                  value={location.publicPhone ?? ""}
                />
              </label>
              <label>
                Routing phone
                <input
                  name="routingPhone"
                  onChange={(event) =>
                    updateLocation(location.id, { routingPhone: event.target.value })
                  }
                  value={location.routingPhone ?? ""}
                />
              </label>
              <label>
                Timezone
                <input
                  name="timezone"
                  onChange={(event) => updateLocation(location.id, { timezone: event.target.value })}
                  value={location.timezone}
                />
              </label>
              <label>
                Status
                <select
                  name="status"
                  onChange={(event) =>
                    updateLocation(location.id, {
                      status: event.target.value as Location["status"]
                    })
                  }
                  value={location.status}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </label>
              <button className="mini-button" disabled={!canPersist || isSaving} type="submit">
                Save location
              </button>
              </fieldset>
            </form>
            {saveState.targetId === location.id && saveState.message ? (
              <div
                className={`inline-form-status ${saveState.ok ? "success" : "error"}`}
                role="status"
              >
                {saveState.message}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
