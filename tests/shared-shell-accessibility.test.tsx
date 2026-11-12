import { readdirSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/AppShell";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceRoot = resolve(repositoryRoot, "src");
const globals = readFileSync(resolve(sourceRoot, "app/globals.css"), "utf8");
const design = readFileSync(resolve(repositoryRoot, "DESIGN.md"), "utf8");

function countOccurrences(source: string, value: string) {
  return source.split(value).length - 1;
}

function cssRuleBodies(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return Array.from(
    globals.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "gu")),
    (match) => match[1],
  );
}

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return sourceFilesUnder(path);
    }

    return entry.isFile() && [".ts", ".tsx"].includes(extname(entry.name))
      ? [path]
      : [];
  });
}

describe("shared shell accessibility", () => {
  it("renders one existing account and sign-out path with an optional milestone", () => {
    async function signOutAction() {}

    const rendered = renderToStaticMarkup(
      <AppShell
        account={{
          email: "owner@example.com",
          name: "Owner With A Long Account Name",
          role: "owner",
          signOutAction,
        }}
        activeNav="owner"
        tenantName="Acme Fitness"
        subtitle="Owner workspace"
      >
        <p>Workspace</p>
      </AppShell>,
    );

    expect(countOccurrences(rendered, 'class="sidebar-account"')).toBe(1);
    expect(countOccurrences(rendered, 'class="account-sign-out-form"')).toBe(1);
    expect(countOccurrences(rendered, ">Sign out</button>")).toBe(1);
    expect(rendered).not.toContain("system-dot");
    expect(rendered).not.toContain("Slice 2");

    const withMilestone = renderToStaticMarkup(
      <AppShell
        activeNav="overview"
        milestoneLabel="Neon beta proof"
        tenantName="Outpost"
        subtitle="Owner sign-in"
      >
        <p>Sign in</p>
      </AppShell>,
    );

    expect(withMilestone).toContain("Neon beta proof");
  });

  it("keeps the existing account control available and usable in narrow CSS", () => {
    const accountRules = cssRuleBodies(".sidebar-account");
    const signOutRules = cssRuleBodies(".account-sign-out");

    expect(accountRules.at(-1)).toContain("display: grid");
    expect(accountRules.at(-1)).not.toContain("display: none");
    expect(signOutRules.some((rule) => rule.includes("min-height: 44px"))).toBe(true);
  });

  it("keeps every consumed Outpost CSS token defined without dead shell tokens", () => {
    const defined = new Set(
      Array.from(globals.matchAll(/(--op-[a-z0-9-]+)\s*:/gu), (match) => match[1]),
    );
    const consumed = new Set(
      Array.from(globals.matchAll(/var\((--op-[a-z0-9-]+)/gu), (match) => match[1]),
    );
    const undefinedTokens = [...consumed].filter((token) => !defined.has(token));

    expect(undefinedTokens).toEqual([]);
    expect(globals).not.toContain("--op-shadow-soft");
    expect(design).not.toContain("--op-shadow-soft");
    expect(globals).not.toContain(".system-dot");
  });

  it("removes stale numeric slice labels only from current runtime source", () => {
    const staleLabels = sourceFilesUnder(sourceRoot).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return /Slice (?:2B|3A|3B|2)\b/u.test(source)
        ? [relative(repositoryRoot, file)]
        : [];
    });

    expect(staleLabels).toEqual([]);
  });
});
