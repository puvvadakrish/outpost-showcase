import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const staffAccessPanel = readFileSync("src/components/owner/StaffAccessPanel.tsx", "utf8");
const staffSignInPage = readFileSync("src/app/staff/sign-in/page.tsx", "utf8");
const staffSignInForm = readFileSync("src/app/staff/sign-in/StaffSignInForm.tsx", "utf8");
const staffSignInActions = readFileSync("src/app/staff/sign-in/actions.ts", "utf8");
const staffAccessRepository = readFileSync("src/infrastructure/neon/staff-access-repository.ts", "utf8");
const tenancy = readFileSync("src/domain/tenancy.ts", "utf8");

describe("staff claim handoff polish", () => {
  it("surfaces staff claim state from the roster projection", () => {
    expect(tenancy).toContain("authLinked?: boolean");
    expect(staffAccessRepository).toContain("list_tenant_staff_access_members");
    expect(staffAccessRepository).toContain("auth_linked");
    expect(staffAccessRepository).toContain("authLinked: Boolean");
    expect(staffAccessPanel).toContain("Claimed");
    expect(staffAccessPanel).toContain("Needs claim");
    expect(staffAccessPanel).toContain("Access disabled");
    expect(staffAccessPanel).toContain("Needs activation");
    expect(staffAccessPanel).toContain("Auth claim");
    expect(staffAccessPanel).toContain("Disable access");
    expect(staffAccessPanel).toContain("Save this email again to reactivate");
    expect(staffAccessPanel).toContain("Owner and admin rows stay managed outside staff access");
  });

  it("gives owners a manual staff sign-in handoff without implying invite delivery", () => {
    expect(staffAccessPanel).toContain("Manual staff handoff");
    expect(staffAccessPanel).toContain("/staff/sign-in");
    expect(staffAccessPanel).toContain("Copy sign-in link");
    expect(staffAccessPanel).toContain("Local claim rehearsal");
    expect(staffAccessPanel).toContain("staff:claim:rehearsal:local");
    expect(staffAccessPanel).toContain("full staff claim proof is rebuilt");
    expect(staffAccessPanel).toContain("navigator.clipboard.writeText");
    expect(staffAccessPanel).toContain("Invite email and live provider delivery");
    expect(staffAccessPanel).toContain("links only active roster rows");
    expect(staffAccessPanel).toContain("block staff claims or workboard access");
    expect(staffAccessPanel).not.toContain("send invite");
  });

  it("aligns the staff sign-in page with the owner handoff steps", () => {
    expect(staffSignInPage).toContain("Use the same email the owner added to staff access");
    expect(staffSignInPage).toContain("Owner adds staff access");
    expect(staffSignInPage).toContain("Staff uses matching email");
    expect(staffSignInPage).toContain("Outpost links the roster row");
    expect(staffSignInPage).toContain("result state below tells you what to do next");
  });

  it("guides staff through claim result states without broadening the boundary", () => {
    expect(staffSignInActions).toContain('"not_rostered"');
    expect(staffSignInActions).toContain('"already_claimed"');
    expect(staffSignInActions).toContain('"unconfirmed_email"');
    expect(staffSignInActions).toContain('"confirm_email"');
    expect(staffSignInForm).toContain("lastIntent");
    expect(staffSignInForm).toContain('setLastIntent("sign_in")');
    expect(staffSignInForm).toContain('setLastIntent("sign_up")');
    expect(staffSignInForm).toContain("Owner access is needed first");
    expect(staffSignInForm).toContain("Roster row already claimed");
    expect(staffSignInForm).toContain("Email confirmation required");
    expect(staffSignInForm).toContain("No invite email, Auth admin provisioning, hosted proof, or live providers.");
  });
});
