import type { GeneratedDataset, GeneratorConfig } from "./types";

import { SeededRandom } from "./random";
import { generateStores } from "./stores";
import { generateEmployees } from "./employees";
import { generateProducts } from "./products";
import { generateCustomers } from "./customers";
import { generateSales } from "./sales";
import { generateStoreMonthCosts } from "./charges";
import { summarizeDataset } from "./summary";
import { applyScenarioToStores, resolveExamScenario } from "./scenarios";

export function generateDataset(config: GeneratorConfig): GeneratedDataset {
  const rng = new SeededRandom(config.seed);
  const baseStores = generateStores(rng, config);
  const examScenarioApplied = resolveExamScenario(config, baseStores);
  const stores = applyScenarioToStores(baseStores, examScenarioApplied);
  const employees = generateEmployees(rng, config, stores, examScenarioApplied);
  const products = generateProducts(rng, config);
  const customers = generateCustomers(rng, config);
  const { sales, saleLines } = generateSales(
    rng,
    config,
    stores,
    employees,
    products,
    customers,
    examScenarioApplied,
  );
  const storeMonthCosts = generateStoreMonthCosts(
    stores,
    employees,
    sales,
    saleLines,
    examScenarioApplied,
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
    examScenarioApplied,
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
    summary,
    examScenarioApplied,
  };
}
