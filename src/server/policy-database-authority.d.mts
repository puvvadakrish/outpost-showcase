export interface PolicyCapabilityMembership {
  adminOption: boolean;
  grantorName: string;
  inheritOption: boolean;
  memberName: string;
  setOption: boolean;
}

export const POLICY_COMPILER_ROLE: string;
export const POLICY_FUNCTION_ALLOWLIST: readonly string[];
export const POLICY_DATABASE_AUTHORITY_SQL: string;

export function hasExactPolicyRuntimeMembers(input: {
  databaseOwnerName: string;
  members: PolicyCapabilityMembership[];
  sessionUser: string;
}): boolean;
