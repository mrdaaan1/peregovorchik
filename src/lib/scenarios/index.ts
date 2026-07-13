import { salaryRaiseScenario } from "./salary-raise";
import { supplierDealScenario } from "./supplier-deal";
import { angryClientScenario } from "./angry-client";
import { hardInvestorScenario } from "./hard-investor";
import type { Scenario } from "./types";

export * from "./types";

export const SCENARIOS: Scenario[] = [
  salaryRaiseScenario,
  supplierDealScenario,
  angryClientScenario,
  hardInvestorScenario,
];

export function getScenarioBySlug(slug: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.slug === slug);
}
