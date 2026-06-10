import type { GeneratedDataset, GeneratorConfig } from "./types";

import { SeededRandom } from "./random";
import { generateStores } from "./stores";
import { generateEmployees } from "./employees";
import { generateProducts } from "./products";
import { generateCustomers } from "./customers";
import { generateSales } from "./sales";
import { generateStoreMonthCosts } from "./charges";
import { summarizeDataset } from "./summary";
import { resolveStorePerformancePlan } from "./performance";
import { applyStorePlanEstimates, buildStoreMonthlyVolumePlan } from "./volume";

export function generateDataset(config: GeneratorConfig): GeneratedDataset {
  const rng = new SeededRandom(config.seed);
  const stores = generateStores(rng, config);
  const storePerformancePlan = resolveStorePerformancePlan(config, stores);
  const employees = generateEmployees(rng, config, stores, storePerformancePlan);
  const products = generateProducts(rng, config);
  const customers = generateCustomers(rng, config);
  const storeMonthlyVolumePlan = buildStoreMonthlyVolumePlan(
    rng,
    config,
    stores,
    employees,
    customers,
    products,
    storePerformancePlan,
  );
  applyStorePlanEstimates(stores, storeMonthlyVolumePlan);
  const { sales, saleLines } = generateSales(
    rng,
    config,
    stores,
    employees,
    products,
    customers,
    storeMonthlyVolumePlan,
    storePerformancePlan,
  );
  const storeMonthCosts = generateStoreMonthCosts(
    config.year,
    stores,
    employees,
    sales,
    saleLines,
    storePerformancePlan,
  );
  const summary = summarizeDataset(
    config,
    stores,
    employees,
    products,
    customers,
    sales,
    saleLines,
    storeMonthCosts,
    storeMonthlyVolumePlan,
    storePerformancePlan.applied,
  );

  return {
    config,
    stores,
    employees,
    products,
    customers,
    sales,
    saleLines,
    storeMonthCosts,
    storeMonthlyVolumePlan,
    summary,
    storePerformanceApplied: storePerformancePlan.applied,
  };
}
