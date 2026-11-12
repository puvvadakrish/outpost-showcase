import type { Channel } from "./models";

export interface IntegrationConnectionStub {
  kind: Extract<Channel, "phone" | "email" | "social">;
  status: "not_configured" | "configured" | "disabled";
  externalLabel?: string;
}

export const integrationStubs: IntegrationConnectionStub[] = [
  { kind: "phone", status: "not_configured" },
  { kind: "email", status: "not_configured" },
  { kind: "social", status: "not_configured" }
];
