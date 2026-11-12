import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/server/neon/server-client", () => ({
  createOutpostServerNeonClient: mocks.createClient,
}));

import { GET } from "@/app/auth/callback/route";

const callbackOrigin = "https://outpost.example";

function callbackRequest(next?: string) {
  const callbackUrl = new URL("/auth/callback", callbackOrigin);

  if (next !== undefined) {
    callbackUrl.searchParams.set("next", next);
  }

  return new NextRequest(callbackUrl);
}

function rawCallbackRequest(encodedNext: string) {
  return new NextRequest(
    `${callbackOrigin}/auth/callback?next=${encodedNext}`,
  );
}

async function redirectLocation(request: NextRequest) {
  const response = await GET(request);

  expect(response.status).toBe(307);
  return response.headers.get("location");
}

describe("auth callback redirect boundary", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.exchangeCodeForSession.mockReset();
    mocks.createClient.mockResolvedValue({
      auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
    });
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it.each([
    ["owner workspace", "/owner", `${callbackOrigin}/owner`],
    ["staff workboard", "/staff/tasks", `${callbackOrigin}/staff/tasks`],
    [
      "internal query and fragment",
      "/owner/locations?tab=setup#answers",
      `${callbackOrigin}/owner/locations?tab=setup#answers`,
    ],
  ])("accepts a same-origin %s destination", async (_label, next, expected) => {
    await expect(redirectLocation(callbackRequest(next))).resolves.toBe(
      expected,
    );
  });

  it.each([
    ["absolute HTTPS URL", "https://evil.example"],
    ["javascript URL", "javascript:alert(1)"],
    ["protocol-relative URL", "//evil.example"],
    ["triple-slash URL", "///evil.example"],
    ["literal backslash authority", "/\\evil.example"],
    ["backslash in query", "/owner?next=\\evil.example"],
    ["backslash in fragment", "/owner#\\evil.example"],
    ["normalized double-leading-slash path", "/%2e%2e//evil.example"],
    ["missing leading slash", "owner"],
    ["malformed percent escape", "/owner?value=%"],
    ["malformed UTF-8 escape", "/owner?value=%c0%af"],
  ])("rejects a %s", async (_label, next) => {
    await expect(redirectLocation(callbackRequest(next))).resolves.toBe(
      `${callbackOrigin}/owner`,
    );
  });

  it.each([
    ["encoded protocol-relative URL", "%2F%2Fevil.example"],
    ["encoded backslash authority", "%2F%5Cevil.example"],
    ["double-encoded backslash authority", "%2F%255Cevil.example"],
    ["malformed raw UTF-8", "%2F%C0%AF"],
  ])("rejects a %s after query decoding", async (_label, encodedNext) => {
    await expect(
      redirectLocation(rawCallbackRequest(encodedNext)),
    ).resolves.toBe(`${callbackOrigin}/owner`);
  });

  it.each([
    ["NUL", "\u0000"],
    ["tab", "\u0009"],
    ["line feed", "\u000a"],
    ["carriage return", "\u000d"],
    ["unit separator", "\u001f"],
    ["DEL", "\u007f"],
    ["C1 control", "\u0085"],
  ])("rejects an encoded %s control character", async (_label, control) => {
    await expect(
      redirectLocation(callbackRequest(`/owner${control}outside`)),
    ).resolves.toBe(`${callbackOrigin}/owner`);
  });

  it("uses the safe owner fallback when next is absent", async () => {
    await expect(redirectLocation(callbackRequest())).resolves.toBe(
      `${callbackOrigin}/owner`,
    );
  });

  it("uses the validated destination after a successful code exchange", async () => {
    const requestUrl = new URL("/auth/callback", callbackOrigin);
    requestUrl.searchParams.set("code", "safe-code");
    requestUrl.searchParams.set("next", "/staff/tasks");

    await expect(
      redirectLocation(new NextRequest(requestUrl)),
    ).resolves.toBe(`${callbackOrigin}/staff/tasks`);
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("safe-code");
  });

  it("keeps exchange failure ahead of the validated destination", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      error: new Error("exchange unavailable"),
    });
    const requestUrl = new URL("/auth/callback", callbackOrigin);
    requestUrl.searchParams.set("code", "failed-code");
    requestUrl.searchParams.set("next", "/staff/tasks");

    await expect(
      redirectLocation(new NextRequest(requestUrl)),
    ).resolves.toBe(
      `${callbackOrigin}/owner/sign-in?auth=callback-not-available`,
    );
  });
});
