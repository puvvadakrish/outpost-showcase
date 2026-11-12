export interface VerifyIngressDatabaseAuthorityOptions {
  connectionString?: string;
}

export interface VerifiedIngressDatabaseAuthority {
  currentUser: string;
  verifiedFunctionCount: number;
}

export function verifyIngressDatabaseAuthority(
  options?: VerifyIngressDatabaseAuthorityOptions,
): Promise<VerifiedIngressDatabaseAuthority>;
