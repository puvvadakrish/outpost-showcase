import "server-only";

import { randomUUID } from "node:crypto";

const safeErrorTypes = new Set(["AggregateError", "Error", "RangeError", "ReferenceError", "SyntaxError", "TypeError"]);

export function reportServerFailure(operation: string, error: unknown) {
  const safeOperation = operation.match(/^[a-z0-9_.-]{1,80}$/) ? operation : "unknown_operation";
  const candidateType = error instanceof Error ? error.name : "NonErrorThrown";
  const errorType = safeErrorTypes.has(candidateType) ? candidateType : "Error";
  const incidentId = randomUUID();

  console.error(
    JSON.stringify({
      errorType,
      event: "outpost.server_failure",
      incidentId,
      operation: safeOperation,
      timestamp: new Date().toISOString()
    })
  );

}
