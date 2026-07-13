import { salaryRaiseScenario } from "./salary-raise";
import { supplierDealScenario } from "./supplier-deal";
import { angryClientScenario } from "./angry-client";
import { hardInvestorScenario } from "./hard-investor";
import { partnershipSplitScenario } from "./partnership-split";
import { apartmentRentScenario } from "./apartment-rent";
import type { Scenario } from "./types";

export * from "./types";

export const SCENARIOS: Scenario[] = [
  apartmentRentScenario,
  salaryRaiseScenario,
  supplierDealScenario,
  partnershipSplitScenario,
  angryClientScenario,
  hardInvestorScenario,
];

export function getScenarioBySlug(slug: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.slug === slug);
}
