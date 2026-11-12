import { describe, expect, it } from "vitest";
import { getOutpostAppUrl } from "../src/server/neon/env";

describe("Neon public env", () => {
  it("uses explicit app URL first", () => {
    expect(
      getOutpostAppUrl({
        NEXT_PUBLIC_OUTPOST_APP_URL: "https://explicit.example",
        VERCEL_URL: "preview.vercel.app"
      })
    ).toBe("https://explicit.example");
  });

  it("derives Vercel deployment origin when explicit app URL is absent", () => {
    expect(
      getOutpostAppUrl({
        VERCEL_URL: "outpost-preview-abc.vercel.app"
      })
    ).toBe("https://outpost-preview-abc.vercel.app");
  });

  it("keeps localhost as the local fallback", () => {
    expect(getOutpostAppUrl({})).toBe("http://localhost:3000");
  });
});
