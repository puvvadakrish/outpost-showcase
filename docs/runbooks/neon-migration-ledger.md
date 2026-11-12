# Neon Migration Ledger

Outpost uses `neon/migrations/*.sql` as its only schema source of truth. Atlas
provides the ordered revision ledger, advisory lock, pending-only application,
and `neon/migrations/atlas.sum` integrity check. Do not apply the concatenated
migration bundle to an established database.

## Routine Workflow

1. Add a new, uniquely versioned `YYYYMMDDHHMMSS_description.sql` file. Never
   edit an applied migration.
2. Run `npm run db:migrations:hash` and review the `atlas.sum` change.
3. Run `npm run db:migrations:validate`, `npm run check`, and the disposable
   PostgreSQL CI contract.
4. Set `OUTPOST_DATABASE_URL` to a direct, unpooled target URL and run
   `npm run db:migrations:status`.
5. Preview pending SQL with `atlas migrate apply --dry-run --dir
   file://neon/migrations --url "$OUTPOST_DATABASE_URL"`.
6. Apply with `npm run db:migrations:apply`, then run status again and the
   target's hosted verification commands.

Atlas refuses checksum drift, migration-history mismatch, concurrent apply
past its lock timeout, and dirty databases without an explicit baseline.
The revision table is explicitly placed in `public` so Neon PostgreSQL 18 does
not infer a same-named revision schema.

## One-Time Existing-Database Adoption

Never infer or automatically choose a baseline. A baseline claims every
migration through that version already exists on the target.

1. Create a protected Neon child branch from the target branch.
2. Record the candidate version from the last migration proven on that target.
   Verify its tables, columns, constraints, functions, grants, and RLS policies
   on the child. A successful application deployment is not schema proof.
3. Set the child branch's direct URL as `OUTPOST_DATABASE_URL` and preview:

   ```sh
   OUTPOST_NEON_BASELINE_VERSION=YYYYMMDDHHMMSS \
   OUTPOST_NEON_BASELINE_CONFIRMATION=schema-verified \
   atlas migrate apply --dry-run --dir file://neon/migrations \
     --url "$OUTPOST_DATABASE_URL" \
     --baseline "$OUTPOST_NEON_BASELINE_VERSION"
   ```

4. Apply the baseline plus pending migrations to the child with
   `npm run db:migrations:apply`. Run `npm run db:migrations:status`, hosted RLS
   verification, owner/staff/admin browser rehearsals, and the relevant proof
   scripts.
5. Only after the child passes, repeat the same explicit baseline against the
   target during a controlled deployment window. Capture the status output and
   hosted verification result in the deployment record.
6. Unset both baseline variables after adoption. Future runs apply pending
   migrations only because the Atlas revision ledger is present.

If the child does not match the candidate baseline, stop. Fix the schema/history
discrepancy with a reviewed forward migration or choose the last version that
can actually be proven. Never use `--allow-dirty` on an established Outpost
database. It is permitted only in CI or for a greenfield Neon target whose
`public` schema has been independently proven to contain zero user-defined
objects of any kind while Neon-owned auth schemas already exist. Confirm that
no revision table or same-named revision schema was left by a failed attempt.
Rehearse the same full history on an isolated branch and capture a logical
backup before setting
`OUTPOST_NEON_GREENFIELD_CONFIRMATION=neon-auth-only-public-empty` and using
`npm run db:migrations:apply` for that greenfield exception.

## Rollback

Outpost migrations are forward-only. Before applying destructive or data-shape
changes, create a Neon restore point/branch and include an explicit forward
repair migration plus verification queries in the change plan. Application
rollback does not imply schema rollback. If an apply fails, preserve the target
and Atlas revision state, stop writes affected by the migration, and diagnose
before attempting another apply.
