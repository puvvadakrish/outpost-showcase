import type { Id } from "./models";

export interface DomainEvent {
  id: Id;
  tenantId: Id;
  locationId?: Id;
  actorUserId?: Id;
  subjectType: string;
  subjectId: Id;
  action: string;
  metadata: Record<string, string | number | boolean | null>;
  occurredAt: string;
}

export interface AuditEvent {
  id: Id;
  tenantId: Id;
  actorUserId?: Id;
  founderAdminId?: Id;
  supportAccessGrantId?: Id;
  subjectType: string;
  subjectId: Id;
  action: string;
  metadata: Record<string, string | number | boolean | null>;
  occurredAt: string;
}
