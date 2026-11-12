export interface VerifyRuntimeDatabaseAuthorityOptions {
  connectionString?: string;
}

export interface VerifiedRuntimeDatabaseAuthority {
  currentUser: string;
  verifiedFunctionCount: number;
}

export function verifyRuntimeDatabaseAuthority(
  options?: VerifyRuntimeDatabaseAuthorityOptions,
): Promise<VerifiedRuntimeDatabaseAuthority>;
