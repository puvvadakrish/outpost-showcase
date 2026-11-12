import {
  answerBankEntries,
  answerBankRevisions,
  auditEvents,
  channelEvents,
  conversations,
  domainEvents,
  founderAdmins,
  handoffRules,
  locations,
  memberships,
  notificationDestinations,
  planEntitlements,
  plans,
  providerConnections,
  sourceDocuments,
  sourceFacts,
  supportAccessGrants,
  taskEvents,
  tasks,
  tenants,
  usageEvents,
  users
} from "./seed";
import { isUnresolvedTask, taskStatusSummaries, tasksForTenant } from "./tasks";

export function getCustomerZeroTenant() {
  const tenant = tenants[0];
  const tenantLocations = locations.filter((location) => location.tenantId === tenant.id);
  const tenantTasks = tasksForTenant(tasks, tenant.id);
  const unresolvedTasks = tenantTasks.filter(isUnresolvedTask);
  const plan = plans.find((candidate) => candidate.id === tenant.planId);

  return {
    tenant,
    plan,
    locations: tenantLocations,
    users,
    founderAdmins,
    memberships: memberships.filter((membership) => membership.tenantId === tenant.id),
    answerBankEntries: answerBankEntries.filter((entry) => entry.tenantId === tenant.id),
    answerBankRevisions: answerBankRevisions.filter((revision) => revision.tenantId === tenant.id),
    handoffRules: handoffRules.filter((rule) => rule.tenantId === tenant.id),
    sourceDocuments: sourceDocuments.filter((source) => source.tenantId === tenant.id),
    sourceFacts: sourceFacts.filter((fact) => fact.tenantId === tenant.id),
    notificationDestinations: notificationDestinations.filter(
      (destination) => destination.tenantId === tenant.id
    ),
    providerConnections: providerConnections.filter((connection) => connection.tenantId === tenant.id),
    conversations: conversations.filter((conversation) => conversation.tenantId === tenant.id),
    channelEvents: channelEvents.filter((event) => event.tenantId === tenant.id),
    domainEvents: domainEvents.filter((event) => event.tenantId === tenant.id),
    auditEvents: auditEvents.filter((event) => event.tenantId === tenant.id),
    supportAccessGrants: supportAccessGrants.filter((grant) => grant.tenantId === tenant.id),
    usageEvents: usageEvents.filter((event) => event.tenantId === tenant.id),
    taskEvents: taskEvents.filter((event) => event.tenantId === tenant.id),
    planEntitlements: planEntitlements.filter((entitlement) => entitlement.planId === tenant.planId),
    tasks: tenantTasks,
    unresolvedTasks,
    taskStatusSummaries: taskStatusSummaries(tenantTasks)
  };
}
