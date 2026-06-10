import test from "node:test";
import assert from "node:assert/strict";

import { defaultConfig } from "../src/lib/generator/config";
import { generateDataset } from "../src/lib/generator";

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageOrZero(values: number[]) {
  return values.length ? average(values) : 0;
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function contributionMarginByStore(dataset: ReturnType<typeof generateDataset>) {
  const map = new Map<string, number>();
  for (const cost of dataset.storeMonthCosts) {
    map.set(cost.storeId, (map.get(cost.storeId) ?? 0) + cost.caTtc - cost.totalStoreCost);
  }
  return map;
}

function sellerMetrics(dataset: ReturnType<typeof generateDataset>) {
  const metrics = new Map<
    string,
    { storeId: string; profile: string; tickets: number; revenue: number; lines: number; accessories: number }
  >();

  for (const employee of dataset.employees) {
    metrics.set(employee.id, {
      storeId: employee.storeId,
      profile: employee.profile,
      tickets: 0,
      revenue: 0,
      lines: 0,
      accessories: 0,
    });
  }

  for (const sale of dataset.sales) {
    const bucket = metrics.get(sale.employeeId)!;
    bucket.tickets += 1;
    bucket.revenue += sale.totalPaid;
    bucket.lines += sale.lineCount;
  }

  for (const line of dataset.saleLines) {
    if (line.productKind !== "accessory") continue;
    metrics.get(line.employeeId)!.accessories += 1;
  }

  return [...metrics.values()].map((metric) => ({
    storeId: metric.storeId,
    profile: metric.profile,
    ticketsPerEmployee: metric.tickets,
    revenuePerEmployee: metric.revenue,
    linesPerTicket: metric.lines / Math.max(1, metric.tickets),
    accessoryAttachRate: metric.accessories / Math.max(1, metric.lines),
  }));
}

test("representative runs include the main store archetypes", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 20260404,
    storeCount: 6,
    productCount: 90,
    customerCount: 320,
  });

  const storeTypes = new Set(dataset.stores.map((store) => store.type));
  const zones = new Set(dataset.stores.map((store) => store.zone));

  assert.deepEqual([...storeTypes].sort(), ["Discount", "Premium", "Standard"]);
  assert.deepEqual([...zones].sort(), ["Centre-ville", "Peripherie"]);
});

test("seasonality remains present in a representative batch", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 4242,
    storeCount: 6,
    productCount: 90,
    customerCount: 450,
  });

  const totalsByMonth = new Map<string, number>();
  for (const line of dataset.saleLines) {
    totalsByMonth.set(line.yearMonth, (totalsByMonth.get(line.yearMonth) ?? 0) + line.priceSold);
  }

  const december = [...totalsByMonth.entries()]
    .filter(([month]) => month.endsWith("-12"))
    .reduce((sum, [, total]) => sum + total, 0);
  const february = [...totalsByMonth.entries()]
    .filter(([month]) => month.endsWith("-02"))
    .reduce((sum, [, total]) => sum + total, 0);

  assert.ok(december > february);
});

test("premium and discount stores keep distinct business profiles", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 5150,
    storeCount: 9,
    productCount: 120,
    customerCount: 600,
  });

  const premiumStores = dataset.stores.filter((store) => store.type === "Premium");
  const discountStores = dataset.stores.filter((store) => store.type === "Discount");

  assert.ok(average(premiumStores.map((store) => store.avgBasketValue)) > average(discountStores.map((store) => store.avgBasketValue)));
  assert.ok(average(premiumStores.map((store) => store.priceAdjustmentPercent)) > average(discountStores.map((store) => store.priceAdjustmentPercent)));

  const salesByStore = new Map<string, number>();
  for (const sale of dataset.sales) {
    salesByStore.set(sale.storeId, (salesByStore.get(sale.storeId) ?? 0) + 1);
  }
  assert.ok(
    average(discountStores.map((store) => salesByStore.get(store.id) ?? 0)) >
      average(premiumStores.map((store) => salesByStore.get(store.id) ?? 0)),
  );
});

test("discount stores keep a tighter average shoe price band than cross-type comparisons", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 111222,
    storeCount: 8,
    productCount: 100,
    customerCount: 420,
    storePerformancePlan: [{ storeType: "Discount", performanceStatus: "sous_performant_turnover" }],
  });

  const shoePricesByStore = new Map<string, number[]>();
  for (const line of dataset.saleLines) {
    if (line.productKind !== "shoe") continue;
    const bucket = shoePricesByStore.get(line.storeId) ?? [];
    bucket.push(line.priceSold);
    shoePricesByStore.set(line.storeId, bucket);
  }

  const discountStoreAverages = dataset.stores
    .filter((store) => store.type === "Discount")
    .map((store) => averageOrZero(shoePricesByStore.get(store.id) ?? []))
    .filter((value) => value > 0);
  const premiumStoreAverages = dataset.stores
    .filter((store) => store.type === "Premium")
    .map((store) => averageOrZero(shoePricesByStore.get(store.id) ?? []))
    .filter((value) => value > 0);

  const discountSpread = Math.max(...discountStoreAverages) - Math.min(...discountStoreAverages);
  const crossTypeGap = averageOrZero(premiumStoreAverages) - averageOrZero(discountStoreAverages);

  assert.ok(discountSpread <= 12);
  assert.ok(crossTypeGap > discountSpread);
});

test("surface still drives staffing and volume potential", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 8800,
    storeCount: 10,
    productCount: 100,
    customerCount: 500,
  });

  const bySurface = [...dataset.stores].sort((left, right) => left.surface - right.surface);
  const smallest = bySurface[0];
  const largest = bySurface.at(-1)!;
  const salesByStore = new Map<string, number>();
  for (const sale of dataset.sales) {
    salesByStore.set(sale.storeId, (salesByStore.get(sale.storeId) ?? 0) + 1);
  }

  assert.ok(largest.employeeCount >= smallest.employeeCount);
  assert.ok(largest.footTrafficByHour >= smallest.footTrafficByHour);
  assert.ok((salesByStore.get(largest.id) ?? 0) >= (salesByStore.get(smallest.id) ?? 0));
});

test("stores keep one or two closing days depending on open_days", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 5566,
    storeCount: 8,
    productCount: 90,
    customerCount: 320,
  });

  const stores = new Map(dataset.stores.map((store) => [store.id, store]));
  for (const sale of dataset.sales) {
    const store = stores.get(sale.storeId)!;
    const weekday = new Date(`${sale.date}T12:00:00.000Z`).getUTCDay();
    const normalizedWeekday = weekday === 0 ? 7 : weekday;
    if (store.openDays === "open 5/7") {
      assert.ok(normalizedWeekday >= 1 && normalizedWeekday <= 5);
    } else {
      assert.ok(normalizedWeekday >= 1 && normalizedWeekday <= 6);
    }
  }
});

test("repeat visits are present and stronger for loyalty-oriented customers", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 90210,
    storeCount: 7,
    productCount: 96,
    customerCount: 320,
  });

  const customers = new Map(dataset.customers.map((customer) => [customer.id, customer]));
  const salesByCustomer = new Map<string, number>();
  for (const sale of dataset.sales) {
    salesByCustomer.set(sale.customerId, (salesByCustomer.get(sale.customerId) ?? 0) + 1);
  }

  const loyaltyCounts: number[] = [];
  const impulsiveCounts: number[] = [];
  for (const [customerId, count] of salesByCustomer.entries()) {
    const profile = customers.get(customerId)?.profile;
    if (profile === "fidele_marque" || profile === "sneakerhead") loyaltyCounts.push(count);
    if (profile === "impulsif") impulsiveCounts.push(count);
  }

  assert.ok(loyaltyCounts.length > 0);
  assert.ok(average(loyaltyCounts) > average(impulsiveCounts));
});

test("basket expansion is tied to seller and customer profiles", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 123321,
    storeCount: 8,
    productCount: 100,
    customerCount: 420,
  });

  const employees = new Map(dataset.employees.map((employee) => [employee.id, employee]));
  const customers = new Map(dataset.customers.map((customer) => [customer.id, customer]));

  const lineCountBySellerProfile = new Map<string, number[]>();
  const lineCountByCustomerProfile = new Map<string, number[]>();

  for (const sale of dataset.sales) {
    const employeeProfile = employees.get(sale.employeeId)!.profile;
    const customerProfile = customers.get(sale.customerId)!.profile;
    const sellerBucket = lineCountBySellerProfile.get(employeeProfile) ?? [];
    sellerBucket.push(sale.lineCount);
    lineCountBySellerProfile.set(employeeProfile, sellerBucket);
    const customerBucket = lineCountByCustomerProfile.get(customerProfile) ?? [];
    customerBucket.push(sale.lineCount);
    lineCountByCustomerProfile.set(customerProfile, customerBucket);
  }

  assert.ok(average(lineCountBySellerProfile.get("Requin") ?? [0]) > average(lineCountBySellerProfile.get("Blase") ?? [0]));
  assert.ok(average(lineCountByCustomerProfile.get("sneakerhead") ?? [0]) > average(lineCountByCustomerProfile.get("chasseur_de_promos") ?? [0]));
});

test("brand-loyal customers keep buying their favorite brand when buying shoes", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 4040,
    storeCount: 6,
    productCount: 88,
    customerCount: 260,
  });

  const customers = new Map(dataset.customers.map((customer) => [customer.id, customer]));
  const loyalShoeLines = dataset.saleLines.filter((line) => {
    const customer = customers.get(line.customerId);
    return line.productKind === "shoe" && customer?.profile === "fidele_marque" && customer.favoriteBrand;
  });

  assert.ok(loyalShoeLines.length > 0);
  assert.equal(
    loyalShoeLines.filter((line) => line.brand === customers.get(line.customerId)!.favoriteBrand).length,
    loyalShoeLines.length,
  );
});

test("seller personas stay behaviorally differentiated", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 7007,
    storeCount: 10,
    productCount: 120,
    customerCount: 650,
  });

  const employees = new Map(dataset.employees.map((employee) => [employee.id, employee]));
  const headcount = new Map<string, number>();
  for (const employee of dataset.employees) {
    headcount.set(employee.profile, (headcount.get(employee.profile) ?? 0) + 1);
  }

  const metrics = new Map<string, { sales: number; lines: number; paid: number; accessories: number }>();
  for (const sale of dataset.sales) {
    const profile = employees.get(sale.employeeId)!.profile;
    const bucket = metrics.get(profile) ?? { sales: 0, lines: 0, paid: 0, accessories: 0 };
    bucket.sales += 1;
    bucket.lines += sale.lineCount;
    bucket.paid += sale.totalPaid;
    metrics.set(profile, bucket);
  }
  for (const line of dataset.saleLines) {
    if (line.productKind !== "accessory") continue;
    const profile = employees.get(line.employeeId)!.profile;
    metrics.get(profile)!.accessories += 1;
  }

  const salesPerEmployee = (profile: string) => (metrics.get(profile)?.sales ?? 0) / (headcount.get(profile) ?? 1);
  const linesPerSale = (profile: string) => (metrics.get(profile)?.lines ?? 0) / Math.max(1, metrics.get(profile)?.sales ?? 0);
  const accessoryRate = (profile: string) => (metrics.get(profile)?.accessories ?? 0) / Math.max(1, metrics.get(profile)?.lines ?? 0);

  assert.ok(salesPerEmployee("Requin") > salesPerEmployee("Blase"));
  assert.ok(linesPerSale("Requin") > linesPerSale("Blase"));
  assert.ok(accessoryRate("Requin") > accessoryRate("Blase"));
});

test("buyer personas stay behaviorally differentiated", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 880088,
    storeCount: 10,
    productCount: 120,
    customerCount: 700,
  });

  const customers = new Map(dataset.customers.map((customer) => [customer.id, customer]));
  const activeCustomersByProfile = new Map<string, Set<string>>();
  const metrics = new Map<string, { sales: number; lines: number; paid: number; discounts: number; loyaltyUsed: number; accessories: number }>();

  for (const sale of dataset.sales) {
    const profile = customers.get(sale.customerId)!.profile;
    const bucket = metrics.get(profile) ?? { sales: 0, lines: 0, paid: 0, discounts: 0, loyaltyUsed: 0, accessories: 0 };
    bucket.sales += 1;
    bucket.lines += sale.lineCount;
    bucket.paid += sale.totalPaid;
    bucket.discounts += sale.totalDiscountApplied;
    bucket.loyaltyUsed += sale.loyaltyPointsUsed;
    metrics.set(profile, bucket);
    const active = activeCustomersByProfile.get(profile) ?? new Set<string>();
    active.add(sale.customerId);
    activeCustomersByProfile.set(profile, active);
  }
  for (const line of dataset.saleLines) {
    if (line.productKind !== "accessory") continue;
    metrics.get(customers.get(line.customerId)!.profile)!.accessories += 1;
  }

  const linesPerSale = (profile: string) => (metrics.get(profile)?.lines ?? 0) / Math.max(1, metrics.get(profile)?.sales ?? 0);
  const paidPerSale = (profile: string) => (metrics.get(profile)?.paid ?? 0) / Math.max(1, metrics.get(profile)?.sales ?? 0);
  const discountPerSale = (profile: string) => (metrics.get(profile)?.discounts ?? 0) / Math.max(1, metrics.get(profile)?.sales ?? 0);
  const loyaltyUsedPerSale = (profile: string) => (metrics.get(profile)?.loyaltyUsed ?? 0) / Math.max(1, metrics.get(profile)?.sales ?? 0);
  const accessoryRate = (profile: string) => (metrics.get(profile)?.accessories ?? 0) / Math.max(1, metrics.get(profile)?.lines ?? 0);
  const visitsPerActiveCustomer = (profile: string) => (metrics.get(profile)?.sales ?? 0) / Math.max(1, activeCustomersByProfile.get(profile)?.size ?? 0);

  assert.ok(paidPerSale("sneakerhead") > paidPerSale("chasseur_de_promos"));
  assert.ok(accessoryRate("impulsif") > accessoryRate("fidele_marque"));
  assert.ok(linesPerSale("impulsif") > linesPerSale("fidele_marque"));
  assert.ok(discountPerSale("chasseur_de_promos") > discountPerSale("impulsif"));
  assert.ok(loyaltyUsedPerSale("chasseur_de_promos") > loyaltyUsedPerSale("impulsif"));
  assert.ok(visitsPerActiveCustomer("fidele_marque") > visitsPerActiveCustomer("impulsif"));
});

test("shop personas stay structurally differentiated", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 101010,
    storeCount: 12,
    productCount: 120,
    customerCount: 500,
  });

  const premium = dataset.stores.filter((store) => store.type === "Premium");
  const standard = dataset.stores.filter((store) => store.type === "Standard");
  const discount = dataset.stores.filter((store) => store.type === "Discount");

  assert.ok(averageOrZero(premium.map((store) => store.specialtyBrands.length)) < averageOrZero(discount.map((store) => store.specialtyBrands.length)));
  assert.ok(averageOrZero(premium.map((store) => store.avgBasketValue)) > averageOrZero(standard.map((store) => store.avgBasketValue)));
  assert.ok(averageOrZero(standard.map((store) => store.avgBasketValue)) > averageOrZero(discount.map((store) => store.avgBasketValue)));
  assert.ok(averageOrZero(discount.map((store) => store.footTrafficByHour)) > averageOrZero(premium.map((store) => store.footTrafficByHour)));
  assert.ok(averageOrZero(discount.map((store) => store.surface)) > averageOrZero(premium.map((store) => store.surface)));
});

test("store performance statuses visibly change volume and productivity", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 111222,
    storeCount: 9,
    productCount: 100,
    customerCount: 420,
    storePerformancePlan: [
      { storeType: "Discount", performanceStatus: "superperformant" },
      { storeType: "Discount", performanceStatus: "sous_performant_turnover" },
      { storeType: "Discount", performanceStatus: "critique_turnover" },
      { storeType: "Premium", performanceStatus: "viable" },
    ],
  });

  const applied = dataset.storePerformanceApplied;
  assert.ok(applied.length >= 4);

  const salesByStore = new Map<string, number>();
  const revenueByStore = new Map<string, number>();
  const linesByStore = new Map<string, number>();
  const accessoriesByStore = new Map<string, number>();
  for (const sale of dataset.sales) {
    salesByStore.set(sale.storeId, (salesByStore.get(sale.storeId) ?? 0) + 1);
    revenueByStore.set(sale.storeId, (revenueByStore.get(sale.storeId) ?? 0) + sale.totalPaid);
    linesByStore.set(sale.storeId, (linesByStore.get(sale.storeId) ?? 0) + sale.lineCount);
  }
  for (const line of dataset.saleLines) {
    if (line.productKind !== "accessory") continue;
    accessoriesByStore.set(line.storeId, (accessoriesByStore.get(line.storeId) ?? 0) + 1);
  }

  const statusMap = new Map(applied.map((entry) => [entry.performanceStatus, entry.targetStoreId]));
  const superStore = statusMap.get("superperformant")!;
  const underStore = statusMap.get("sous_performant_turnover")!;
  const criticalStore = statusMap.get("critique_turnover")!;

  assert.ok((salesByStore.get(superStore) ?? 0) > (salesByStore.get(underStore) ?? 0));
  assert.ok((salesByStore.get(underStore) ?? 0) > (salesByStore.get(criticalStore) ?? 0));
  assert.ok((revenueByStore.get(superStore) ?? 0) > (revenueByStore.get(underStore) ?? 0));
  assert.ok((revenueByStore.get(underStore) ?? 0) > (revenueByStore.get(criticalStore) ?? 0));
  assert.ok(
    (accessoriesByStore.get(underStore) ?? 0) / Math.max(1, linesByStore.get(underStore) ?? 0) <
      (accessoriesByStore.get(superStore) ?? 0) / Math.max(1, linesByStore.get(superStore) ?? 0),
  );
});

test("annual performance mix now includes profitable, near-equilibrium and loss-making stores", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 606060,
    storeCount: 9,
    productCount: 110,
    customerCount: 900,
    storePerformancePlan: [
      { storeType: "Discount", performanceStatus: "superperformant" },
      { storeType: "Premium", performanceStatus: "viable" },
      { storeType: "Discount", performanceStatus: "sous_performant_turnover" },
      { storeType: "Discount", performanceStatus: "critique_turnover" },
    ],
  });

  const margins = [...contributionMarginByStore(dataset).values()];
  const marginRates = dataset.stores.map((store) => {
    const margin = contributionMarginByStore(dataset).get(store.id) ?? 0;
    const revenue = dataset.storeMonthCosts
      .filter((row) => row.storeId === store.id)
      .reduce((sum, row) => sum + row.caTtc, 0);
    return (margin / Math.max(1, revenue)) * 100;
  });

  assert.ok(margins.some((value) => value > 50000));
  assert.ok(margins.some((value) => value < -20000));
  assert.ok(marginRates.some((value) => value > -10 && value < 10));
});

test("cost realism ratios move back into a plausible range", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 606060,
    storeCount: 8,
    productCount: 100,
    customerCount: 850,
    storePerformancePlan: [
      { storeType: "Discount", performanceStatus: "sous_performant_turnover" },
    ],
  });

  const shrinkRates = dataset.storeMonthCosts.map((row) => (row.shrinkage / Math.max(1, row.caHt)) * 100);
  const paymentFeeRates = dataset.storeMonthCosts.map((row) => (row.paymentFees / Math.max(1, row.caTtc)) * 100);
  const payrollRates = dataset.storeMonthCosts.map((row) => ((row.grossPayroll + row.employerContrib) / Math.max(1, row.caTtc)) * 100);

  assert.ok(median(shrinkRates) > 0.15 && median(shrinkRates) < 1.2);
  assert.ok(median(paymentFeeRates) > 0.2 && median(paymentFeeRates) < 0.8);
  assert.ok(median(payrollRates) > 18 && median(payrollRates) < 75);
});
