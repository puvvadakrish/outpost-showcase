import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const legacyAuthUsersPattern =
  /(?:^|[^\p{L}\p{N}_])"?auth"?\s*\.\s*"?users"?(?=$|[^\p{L}\p{N}_])/iu;
const legacyAnonRolePattern = /\banon\b/iu;

function migrationSourceViolations(source: string) {
  return {
    legacyAnonRole: legacyAnonRolePattern.test(source),
    legacyAuthUsers: legacyAuthUsersPattern.test(source),
  };
}

describe("Neon migration source", () => {
  it("keeps the candidate review manifest a fixed owner projection", () => {
    const migration = readFileSync(
      fileURLToPath(
        new URL(
          "../neon/migrations/20260715010000_runtime_policy_candidate_review_manifest.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    );

    expect(migration).toContain(
      "create or replace function get_runtime_policy_candidate_review_manifest",
    );
    expect(migration).toContain("stable\nsecurity definer");
    expect(migration).toContain("set search_path = pg_catalog, pg_temp");
    expect(migration).toContain("limit 11");
    expect(migration).toContain(
      `order by (answer.value->>'topicKey') collate "C", answer.ordinality`,
    );
    expect(migration).toContain(
      "order by (handoff.value->>'priority')::integer",
    );
    expect(migration).toContain("'answer_topics_has_more'");
    expect(migration).toContain("'handoffs_has_more'");
    expect(migration).toContain("'default_behavior'");
    expect(migration).toContain(
      "raise exception 'active tenant owner required' using errcode = '42501'",
    );
    expect(migration).toContain(
      "revoke execute on function get_runtime_policy_candidate_review_manifest(text)\n  from public, anonymous, outpost_policy_compiler",
    );
    expect(migration).toContain(
      "grant execute on function get_runtime_policy_candidate_review_manifest(text)\n  to authenticated",
    );
  });

  it.each([
    ["legacy auth relation", "references auth.users(id)"],
    ["spaced mixed-case auth relation", "references AUTH . users (id)"],
    ["quoted auth relation", 'references "auth"."users"(id)'],
    ["quoted auth schema", 'select * from "auth".users'],
    ["quoted auth relation name", 'select * from auth."users"'],
    ["legacy anonymous role", "grant usage on schema public to anon"],
    ["quoted legacy anonymous role", 'revoke all on schema public from "anon"'],
    ["commented legacy relation", "-- removed auth.users lookup"],
    ["string containing legacy role", "select 'anon'"],
  ])("flags a %s in raw SQL", (_label, source) => {
    expect(migrationSourceViolations(source)).not.toEqual({
      legacyAnonRole: false,
      legacyAuthUsers: false,
    });
  });

  it.each([
    ["Neon auth relation", 'references neon_auth."user"(id)'],
    ["anonymous role", "grant usage on schema public to anonymous"],
    ["authenticated role", "grant usage on schema public to authenticated"],
    ["auth helper", "select auth.uid()"],
    ["embedded anon text", "select 'anonymized'"],
    ["Neon auth schema", "select * from neon_auth.users"],
  ])("accepts a %s", (_label, source) => {
    expect(migrationSourceViolations(source)).toEqual({
      legacyAnonRole: false,
      legacyAuthUsers: false,
    });
  });

  it("keeps every raw migration source free of Supabase auth users and the legacy anon role", () => {
    const migrationsDirectory = fileURLToPath(
      new URL("../neon/migrations", import.meta.url),
    );
    const migrationFiles = readdirSync(migrationsDirectory)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    expect(migrationFiles.length).toBeGreaterThan(0);

    for (const file of migrationFiles) {
      const source = readFileSync(join(migrationsDirectory, file), "utf8");

      expect(migrationSourceViolations(source), file).toEqual({
        legacyAnonRole: false,
        legacyAuthUsers: false,
      });
    }
  });
});
