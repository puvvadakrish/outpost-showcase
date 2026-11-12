import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appShell = readFileSync("src/components/AppShell.tsx", "utf8");
const ownerPage = readFileSync("src/app/owner/page.tsx", "utf8");
const ownerLocationsPage = readFileSync("src/app/owner/locations/page.tsx", "utf8");
const ownerSignInPage = readFileSync("src/app/owner/sign-in/page.tsx", "utf8");
const staffTasksPage = readFileSync("src/app/staff/tasks/page.tsx", "utf8");
const staffSignInPage = readFileSync("src/app/staff/sign-in/page.tsx", "utf8");
const neonServerClient = readFileSync("src/server/neon/server-client.ts", "utf8");
const authCallbackRoute = readFileSync("src/app/auth/callback/route.ts", "utf8");
const sessionContext = readFileSync("src/server/session-context.ts", "utf8");
const ownerActions = readFileSync("src/app/owner/actions.ts", "utf8");
const staffTaskActions = readFileSync("src/app/staff/tasks/actions.ts", "utf8");
const signOutActions = readFileSync("src/app/auth/actions.ts", "utf8");
const wrongAccountState = readFileSync("src/components/auth/WrongAccountState.tsx", "utf8");

describe("session polish", () => {
  it("renders authenticated account identity and sign-out in shared app chrome", () => {
    expect(appShell).toContain("export interface AppShellAccount");
    expect(appShell).toContain("account.email");
    expect(appShell).toContain("account.signOutAction");
    expect(appShell).toContain("Sign out");
  });

  it("keeps owner routes signed-in and owner-role aware in backend mode", () => {
    expect(ownerPage).toContain('redirect("/owner/sign-in")');
    expect(ownerPage).toContain('process.env.NODE_ENV === "production"');
    expect(ownerPage).toContain('tenantName="Outpost"');
    expect(ownerPage).toContain('account?.role === "owner"');
    expect(ownerPage).toContain("ownerAccessDenied");
    expect(ownerPage).toContain("ownerBackendUnavailable");
    expect(ownerPage).toContain("<WrongAccountState");
    expect(ownerPage).toContain("signOutOwnerAction");
    expect(ownerPage).toContain("taskService.loadTenantTaskEvents(tenant.id)");
    expect(ownerPage).toContain("taskEvents={backendTaskEvents}");
    expect(ownerLocationsPage).toContain('account?.role === "owner"');
    expect(ownerLocationsPage).toContain('process.env.NODE_ENV === "production"');
    expect(ownerLocationsPage).toContain('tenantName="Outpost"');
    expect(ownerLocationsPage).toContain("ownerAccessDenied");
    expect(ownerLocationsPage).toContain("ownerBackendUnavailable");
    expect(ownerLocationsPage).toContain("<WrongAccountState");
    expect(ownerLocationsPage).toContain("signOutOwnerAction");
    expect(ownerLocationsPage).toContain('alternateHref="/owner"');
    expect(ownerLocationsPage).toContain('tenantName="Outpost"');
  });

  it("keeps staff routes signed-in and sign-out aware in backend mode", () => {
    expect(staffTasksPage).toContain('redirect("/staff/sign-in")');
    expect(staffTasksPage).toContain('process.env.NODE_ENV === "production"');
    expect(staffTasksPage).toContain('tenantName="Outpost"');
    expect(staffTasksPage).toContain('account?.role === "staff"');
    expect(staffTasksPage).toContain("staffAccessDenied");
    expect(staffTasksPage).toContain("staffBackendUnavailable");
    expect(staffTasksPage).toContain("<WrongAccountState");
    expect(staffTasksPage).toContain("signOutStaffAction");
    expect(staffTasksPage).toContain('tenantName="Outpost"');
  });

  it("explains wrong-role access without loading the destination workspace", () => {
    expect(wrongAccountState).toContain("Use the ${expectedRoleLabel} account for this workspace");
    expect(wrongAccountState).toContain("Workspace temporarily unavailable");
    expect(wrongAccountState).toContain("Route protected by role");
    expect(wrongAccountState).toContain("Backend read unavailable");
    expect(wrongAccountState).toContain('label: "Access", value: "Retry"');
    expect(wrongAccountState).toContain("Try again after the Neon backend is configured and healthy.");
    expect(wrongAccountState).toContain("Live providers");
    expect(wrongAccountState).toContain("signOutAction");
    expect(wrongAccountState).toContain('variant?: "wrong_account" | "unavailable"');
    expect(ownerPage).toContain('alternateHref={account?.role === "staff" ? "/staff/tasks" : undefined}');
    expect(staffTasksPage).toContain('alternateHref={account?.role === "owner" ? "/owner" : undefined}');
  });

  it("redirects already-authorized users away from matching sign-in forms", () => {
    expect(ownerSignInPage).toContain('process.env.NODE_ENV === "production"');
    expect(ownerSignInPage).toContain("Owner sign-in unavailable");
    expect(ownerSignInPage).toContain('tenantName="Outpost"');
    expect(ownerSignInPage).toContain("resolveMembershipSession(neon)");
    expect(ownerSignInPage).toContain('sessionResolution.session.account.role === "owner"');
    expect(ownerSignInPage).toContain('redirect("/owner")');
    expect(staffSignInPage).toContain('process.env.NODE_ENV === "production"');
    expect(staffSignInPage).toContain("Staff sign-in unavailable");
    expect(staffSignInPage).toContain('tenantName="Outpost"');
    expect(staffSignInPage).toContain("resolveMembershipSession(neon)");
    expect(staffSignInPage).toContain('sessionResolution.session.account.role === "staff"');
    expect(staffSignInPage).toContain('redirect("/staff/tasks")');
  });

  it("derives session account state through the authenticated Neon client", () => {
    expect(sessionContext).toContain(".from(\"tenant_memberships\")");
    expect(sessionContext).toContain("tenants!inner(id, name, slug, status, plan_id, billing_mode, support_tier, created_at)");
    expect(sessionContext).toContain("users!inner(id, email, external_auth_id, name)");
    expect(sessionContext).toContain("memberUserId: row.users.id");
    expect(sessionContext).toContain("row.users.external_auth_id === user.id");
    expect(sessionContext).not.toContain("row.users.email.toLowerCase()");
    expect(sessionContext).not.toContain("hasActiveSessionRoleForFirstVisibleTenant");
    expect(sessionContext).not.toContain("loadFirstVisibleTenant");
    expect(sessionContext).not.toContain("service_role");
    expect(sessionContext).not.toContain("SUPABASE_SERVICE_ROLE");
  });

  it("keeps server actions on membership-derived tenant context", () => {
    expect(ownerActions).toContain("requireOwnerActionContext");
    expect(ownerActions).toContain("resolveMembershipSession(neon)");
    expect(ownerActions).toContain("Submitted tenant does not match the signed-in owner workspace.");
    expect(ownerActions).not.toContain('const tenantId = String(formData.get("tenantId") ?? "")');
    expect(staffTaskActions).toContain("requireStaffActionContext");
    expect(staffTaskActions).toContain("resolveMembershipSession(neon)");
    expect(staffTaskActions).toContain("Submitted tenant does not match the signed-in staff workspace.");
    expect(staffTaskActions).not.toContain('const tenantId = String(formData.get("tenantId") ?? "")');
  });

  it("clears Neon Auth before returning to role-specific sign-in pages", () => {
    expect(signOutActions).toContain("neon.auth.signOut()");
    expect(signOutActions).toContain('signOutTo("/owner/sign-in")');
    expect(signOutActions).toContain('signOutTo("/staff/sign-in")');
  });

  it("keeps Neon session cookies browser-safe and forwards the upstream cookie name server-side", () => {
    expect(neonServerClient).toContain('const NEON_SESSION_COOKIE_PREFIX = "__Secure-neon-auth.session_token"');
    expect(neonServerClient).toContain('const OUTPOST_SESSION_COOKIE_NAME = "outpost_neon_auth_session_token"');
    expect(neonServerClient).toContain("getStoredSessionCookie");
    expect(neonServerClient).toContain("Cookie: `${options.cookie.name}=${encodeURIComponent(options.cookie.value)}`");
    expect(neonServerClient).not.toContain("cookieStore.set(name, decodeURIComponent(value)");
  });

  it("does not pretend unsupported callback code exchange established a session", () => {
    expect(neonServerClient).toContain("Neon Auth callback code exchange is not implemented");
    expect(authCallbackRoute).toContain("callback-not-available");
    expect(authCallbackRoute).toContain("if (error)");
  });
});
