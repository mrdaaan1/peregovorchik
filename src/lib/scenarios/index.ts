import { salaryRaiseScenario } from "./salary-raise";
import { supplierDealScenario } from "./supplier-deal";
import { angryClientScenario } from "./angry-client";
import type { Scenario } from "./types";

export * from "./types";

export const SCENARIOS: Scenario[] = [salaryRaiseScenario, supplierDealScenario, angryClientScenario];

export function getScenarioBySlug(slug: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.slug === slug);
}
