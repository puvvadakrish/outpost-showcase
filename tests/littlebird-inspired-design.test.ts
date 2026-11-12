import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appShell = readFileSync("src/components/AppShell.tsx", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");
const design = readFileSync("DESIGN.md", "utf8");

describe("Littlebird-inspired Outpost visual refinement", () => {
  it("adds product-safe navigation glyphs without introducing an icon dependency", () => {
    expect(appShell).toContain("function NavGlyph");
    expect(appShell).toContain('className="nav-icon"');
    expect(appShell).toContain("<NavGlyph id={item.id} />");
    expect(globals).toContain(".nav-icon svg");
  });

  it("records the softer shell geometry as shared design-system tokens", () => {
    expect(globals).toContain("--op-radius-xl: 28px;");
    expect(globals).toContain("--op-radius-pill: 999px;");
    expect(globals).toContain("--op-shadow-diffuse:");
    expect(globals).toContain("border-radius: var(--op-radius-xl);");
    expect(globals).toContain("box-shadow: var(--op-shadow-contact), var(--op-shadow-diffuse);");
    expect(design).toContain("--op-shadow-contact:");
  });

  it("keeps the inspiration translated into Outpost's operational SaaS direction", () => {
    expect(design).toContain("Visual inspiration may come from refined consumer SaaS surfaces");
    expect(design).toMatch(/Translate that into Outpost's operational command\s+system/u);
    expect(design).toContain("do not copy a marketing layout");
    expect(design).toMatch(/beige-heavy\s+brand palette/u);
  });
});
