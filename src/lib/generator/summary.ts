import type {
  Customer,
  Employee,
  GeneratedDataset,
  GeneratorConfig,
  Product,
  Sale,
  SaleLine,
  Store,
  StoreMonthCost,
  ResolvedExamScenario,
} from "./types";
import { configWarnings, roundCurrency } from "./utils";
import { validateDataset } from "./validate";

export function summarizeDataset(
  config: GeneratorConfig,
  stores: Store[],
  employees: Employee[],
  products: Product[],
  customers: Customer[],
  sales: Sale[],
  saleLines: SaleLine[],
  storeMonthCosts: StoreMonthCost[],
  examScenarioApplied?: ResolvedExamScenario,
) {
  const totals = new Map<string, number>();
  for (const line of saleLines) {
    const key = `${line.storeId}:${line.yearMonth}`;
    totals.set(key, roundCurrency((totals.get(key) ?? 0) + line.priceSold));
  }

  const monthlyRevenueTotals = [...totals.entries()]
    .map(([key, totalPaid]) => {
      const [storeId, yearMonth] = key.split(":");
      return { storeId, yearMonth, totalPaid };
    })
    .sort((left, right) =>
      left.storeId === right.storeId
        ? left.yearMonth.localeCompare(right.yearMonth)
        : left.storeId.localeCompare(right.storeId),
    );

  const validationResults = validateDataset({
    config,
    stores,
    employees,
    products,
    customers,
    sales,
    saleLines,
    storeMonthCosts,
    summary: {
      counts: {
        stores: stores.length,
        employees: employees.length,
        products: products.length,
        customers: customers.length,
        sales: sales.length,
        saleLines: saleLines.length,
        storeMonthCosts: storeMonthCosts.length,
      },
      monthlyRevenueTotals,
      validationResults: [],
      anomalyCount: 0,
      warnings: [],
    },
  } as GeneratedDataset);

  return {
    counts: {
      stores: stores.length,
      employees: employees.length,
      products: products.length,
      customers: customers.length,
      sales: sales.length,
      saleLines: saleLines.length,
      storeMonthCosts: storeMonthCosts.length,
    },
    monthlyRevenueTotals,
    validationResults,
    anomalyCount: validationResults.filter((issue) => issue.severity === "error").length,
    warnings: configWarnings(config, examScenarioApplied),
    examScenarioApplied,
  };
}
