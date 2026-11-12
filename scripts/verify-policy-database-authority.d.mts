export interface VerifyPolicyDatabaseAuthorityOptions {
  connectionString?: string;
}

export interface VerifiedPolicyDatabaseAuthority {
  currentUser: string;
  verifiedFunctionCount: number;
}

export function verifyPolicyDatabaseAuthority(
  options?: VerifyPolicyDatabaseAuthorityOptions,
): Promise<VerifiedPolicyDatabaseAuthority>;
