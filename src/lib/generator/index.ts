import type { GeneratedDataset, GeneratorConfig } from "./types";

import { SeededRandom } from "./random";
import { generateStores } from "./stores";
import { generateEmployees } from "./employees";
import { generateProducts } from "./products";
import { generateCustomers } from "./customers";
import { generateSales } from "./sales";
import { summarizeDataset } from "./summary";

export function generateDataset(config: GeneratorConfig): GeneratedDataset {
  const rng = new SeededRandom(config.seed);
  const stores = generateStores(rng, config);
  const employees = generateEmployees(rng, config, stores);
  const products = generateProducts(rng, config);
  const customers = generateCustomers(rng, config);
  const { sales, saleLines } = generateSales(rng, config, stores, employees, products, customers);
  const summary = summarizeDataset(
    config,
    stores,
    employees,
    products,
    customers,
    sales,
    saleLines,
  );

  return {
    config,
    stores,
    employees,
    products,
    customers,
    sales,
    saleLines,
    summary,
  };
}
