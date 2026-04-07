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

function groupMedian(values: number[]) {
  return median(values.filter((value) => Number.isFinite(value)));
}

test("representative runs include the main store archetypes", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 20260404,
    storeCount: 6,
    productCount: 90,
    customerCount: 320,
    targetSaleLineCount: 900,
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
    targetSaleLineCount: 2200,
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

  assert.ok(december > february, `Expected December revenue (${december}) to exceed February (${february})`);
});

test("premium and discount stores keep distinct business profiles", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 5150,
    storeCount: 9,
    productCount: 120,
    customerCount: 600,
    targetSaleLineCount: 2400,
  });

  const premiumStores = dataset.stores.filter((store) => store.type === "Premium");
  const discountStores = dataset.stores.filter((store) => store.type === "Discount");

  assert.ok(premiumStores.length > 0);
  assert.ok(discountStores.length > 0);
  assert.ok(
    average(premiumStores.map((store) => store.avgBasketValue)) >
      average(discountStores.map((store) => store.avgBasketValue)),
    "Premium stores should keep a higher modeled basket value than discount stores.",
  );
  assert.ok(
    average(premiumStores.map((store) => store.priceAdjustmentPercent)) >
      average(discountStores.map((store) => store.priceAdjustmentPercent)),
    "Premium stores should keep a more positive price adjustment than discount stores.",
  );
});

test("discount stores keep a tighter average shoe price band than cross-type comparisons", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 111222,
    storeCount: 8,
    productCount: 100,
    customerCount: 420,
    targetSaleLineCount: 1800,
    examScenario: "underperforming_sales_execution",
    examScenarioStrength: "medium",
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

  assert.ok(discountStoreAverages.length >= 2);
  assert.ok(premiumStoreAverages.length >= 1);

  const discountSpread =
    Math.max(...discountStoreAverages) - Math.min(...discountStoreAverages);
  const crossTypeGap =
    averageOrZero(premiumStoreAverages) - averageOrZero(discountStoreAverages);

  assert.ok(
    discountSpread <= 12,
    `Discount stores should stay in a relatively tight shoe-price band, observed spread ${discountSpread.toFixed(2)}.`,
  );
  assert.ok(
    crossTypeGap > discountSpread,
    `Cross-type gap should stay stronger than intra-discount spread, observed gap ${crossTypeGap.toFixed(2)} vs spread ${discountSpread.toFixed(2)}.`,
  );
});

test("surface still drives staffing and foot traffic", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 8800,
    storeCount: 10,
    productCount: 100,
    customerCount: 500,
    targetSaleLineCount: 1200,
  });

  const bySurface = [...dataset.stores].sort((left, right) => left.surface - right.surface);
  const smallest = bySurface[0];
  const largest = bySurface.at(-1)!;

  assert.ok(largest.employeeCount >= smallest.employeeCount);
  assert.ok(largest.footTrafficByHour >= smallest.footTrafficByHour);
  assert.ok(largest.dailyFootTraffic >= smallest.dailyFootTraffic);
});

test("stores keep one or two closing days depending on open_days", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 5566,
    storeCount: 8,
    productCount: 90,
    customerCount: 320,
    targetSaleLineCount: 1000,
  });

  const stores = new Map(dataset.stores.map((store) => [store.id, store]));

  for (const store of dataset.stores) {
    assert.ok(store.openDays === "open 5/7" || store.openDays === "open 6/7");
    const closingDays = store.openDays === "open 5/7" ? 2 : 1;
    assert.ok(closingDays === 1 || closingDays === 2);
  }

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
    targetSaleLineCount: 1800,
  });

  const customers = new Map(dataset.customers.map((customer) => [customer.id, customer]));
  const salesByCustomer = new Map<string, number>();
  for (const sale of dataset.sales) {
    salesByCustomer.set(sale.customerId, (salesByCustomer.get(sale.customerId) ?? 0) + 1);
  }

  const repeatCustomers = [...salesByCustomer.values()].filter((count) => count >= 2).length;
  assert.ok(repeatCustomers > 0, "Expected at least some customers to revisit.");

  const loyaltyCounts: number[] = [];
  const impulsiveCounts: number[] = [];
  for (const [customerId, count] of salesByCustomer.entries()) {
    const profile = customers.get(customerId)?.profile;
    if (profile === "fidele_marque" || profile === "sneakerhead") {
      loyaltyCounts.push(count);
    }
    if (profile === "impulsif") {
      impulsiveCounts.push(count);
    }
  }

  assert.ok(average(loyaltyCounts) > average(impulsiveCounts));
});

test("basket expansion is tied to seller and customer profiles", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 123321,
    storeCount: 8,
    productCount: 100,
    customerCount: 420,
    targetSaleLineCount: 2200,
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

  assert.ok(
    average(lineCountBySellerProfile.get("Requin") ?? [0]) >
      average(lineCountBySellerProfile.get("Blase") ?? [0]),
  );
  assert.ok(
    average(lineCountByCustomerProfile.get("sneakerhead") ?? [0]) >
      average(lineCountByCustomerProfile.get("chasseur_de_promos") ?? [0]),
  );
});

test("brand-loyal customers keep buying their favorite brand when buying shoes", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 4040,
    storeCount: 6,
    productCount: 88,
    customerCount: 260,
    targetSaleLineCount: 1300,
  });

  const customers = new Map(dataset.customers.map((customer) => [customer.id, customer]));
  const loyalShoeLines = dataset.saleLines.filter((line) => {
    const customer = customers.get(line.customerId);
    return (
      line.productKind === "shoe" &&
      customer?.profile === "fidele_marque" &&
      customer.favoriteBrand
    );
  });

  assert.ok(loyalShoeLines.length > 0);
  assert.equal(
    loyalShoeLines.filter((line) => line.brand === customers.get(line.customerId)!.favoriteBrand)
      .length,
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
    targetSaleLineCount: 3200,
  });

  const employees = new Map(dataset.employees.map((employee) => [employee.id, employee]));
  const employeeHeadcount = new Map<string, number>();
  for (const employee of dataset.employees) {
    employeeHeadcount.set(employee.profile, (employeeHeadcount.get(employee.profile) ?? 0) + 1);
  }

  const metrics = new Map<
    string,
    { sales: number; lines: number; paid: number; accessories: number; hype: number; shoeLines: number }
  >();

  for (const sale of dataset.sales) {
    const profile = employees.get(sale.employeeId)!.profile;
    const bucket = metrics.get(profile) ?? {
      sales: 0,
      lines: 0,
      paid: 0,
      accessories: 0,
      hype: 0,
      shoeLines: 0,
    };
    bucket.sales += 1;
    bucket.lines += sale.lineCount;
    bucket.paid += sale.totalPaid;
    metrics.set(profile, bucket);
  }

  for (const line of dataset.saleLines) {
    const profile = employees.get(line.employeeId)!.profile;
    const bucket = metrics.get(profile)!;
    if (line.productKind === "accessory") {
      bucket.accessories += 1;
    }
    if (line.productKind === "shoe") {
      bucket.shoeLines += 1;
      if (line.isBestSeller || line.category === "Limited Edition") {
        bucket.hype += 1;
      }
    }
  }

  const salesPerEmployee = (profile: string) =>
    (metrics.get(profile)?.sales ?? 0) / (employeeHeadcount.get(profile) ?? 1);
  const linesPerSale = (profile: string) =>
    (metrics.get(profile)?.lines ?? 0) / Math.max(1, metrics.get(profile)?.sales ?? 0);
  const paidPerSale = (profile: string) =>
    (metrics.get(profile)?.paid ?? 0) / Math.max(1, metrics.get(profile)?.sales ?? 0);
  const accessoryRate = (profile: string) =>
    (metrics.get(profile)?.accessories ?? 0) / Math.max(1, metrics.get(profile)?.lines ?? 0);
  const hypeRate = (profile: string) =>
    (metrics.get(profile)?.hype ?? 0) / Math.max(1, metrics.get(profile)?.shoeLines ?? 0);

  assert.ok(salesPerEmployee("Requin") > salesPerEmployee("Blase"));
  assert.ok(salesPerEmployee("Experimente") > salesPerEmployee("Stagiaire"));
  assert.ok(linesPerSale("Requin") > linesPerSale("Blase"));
  assert.ok(paidPerSale("Requin") > paidPerSale("JeunePrometteur"));
  assert.ok(accessoryRate("Requin") > accessoryRate("Blase"));
  assert.ok(hypeRate("Requin") > hypeRate("Blase"));
});

test("buyer personas stay behaviorally differentiated", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 880088,
    storeCount: 10,
    productCount: 120,
    customerCount: 700,
    targetSaleLineCount: 3200,
  });

  const customers = new Map(dataset.customers.map((customer) => [customer.id, customer]));
  const activeCustomersByProfile = new Map<string, Set<string>>();
  const metrics = new Map<
    string,
    {
      sales: number;
      lines: number;
      paid: number;
      discounts: number;
      loyaltyUsed: number;
      accessories: number;
      hype: number;
      shoeLines: number;
    }
  >();

  for (const sale of dataset.sales) {
    const profile = customers.get(sale.customerId)!.profile;
    const bucket = metrics.get(profile) ?? {
      sales: 0,
      lines: 0,
      paid: 0,
      discounts: 0,
      loyaltyUsed: 0,
      accessories: 0,
      hype: 0,
      shoeLines: 0,
    };
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
    const profile = customers.get(line.customerId)!.profile;
    const bucket = metrics.get(profile)!;
    if (line.productKind === "accessory") {
      bucket.accessories += 1;
    }
    if (line.productKind === "shoe") {
      bucket.shoeLines += 1;
      if (line.isBestSeller || line.category === "Limited Edition") {
        bucket.hype += 1;
      }
    }
  }

  const linesPerSale = (profile: string) =>
    (metrics.get(profile)?.lines ?? 0) / Math.max(1, metrics.get(profile)?.sales ?? 0);
  const paidPerSale = (profile: string) =>
    (metrics.get(profile)?.paid ?? 0) / Math.max(1, metrics.get(profile)?.sales ?? 0);
  const discountPerSale = (profile: string) =>
    (metrics.get(profile)?.discounts ?? 0) / Math.max(1, metrics.get(profile)?.sales ?? 0);
  const loyaltyUsedPerSale = (profile: string) =>
    (metrics.get(profile)?.loyaltyUsed ?? 0) / Math.max(1, metrics.get(profile)?.sales ?? 0);
  const accessoryRate = (profile: string) =>
    (metrics.get(profile)?.accessories ?? 0) / Math.max(1, metrics.get(profile)?.lines ?? 0);
  const hypeRate = (profile: string) =>
    (metrics.get(profile)?.hype ?? 0) / Math.max(1, metrics.get(profile)?.shoeLines ?? 0);
  const visitsPerActiveCustomer = (profile: string) =>
    (metrics.get(profile)?.sales ?? 0) / Math.max(1, activeCustomersByProfile.get(profile)?.size ?? 0);

  assert.ok(hypeRate("sneakerhead") > hypeRate("chasseur_de_promos"));
  assert.ok(paidPerSale("sneakerhead") > paidPerSale("chasseur_de_promos"));
  assert.ok(accessoryRate("impulsif") > accessoryRate("fidele_marque"));
  assert.ok(linesPerSale("impulsif") > linesPerSale("fidele_marque"));
  assert.ok(discountPerSale("chasseur_de_promos") > discountPerSale("impulsif"));
  assert.ok(loyaltyUsedPerSale("chasseur_de_promos") > loyaltyUsedPerSale("impulsif"));
  assert.ok(visitsPerActiveCustomer("fidele_marque") > visitsPerActiveCustomer("impulsif"));
  assert.ok(visitsPerActiveCustomer("sneakerhead") > visitsPerActiveCustomer("impulsif"));
});

test("shop personas stay structurally differentiated", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 101010,
    storeCount: 12,
    productCount: 120,
    customerCount: 500,
    targetSaleLineCount: 1800,
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

test("underperforming sales execution scenario is visible on the targeted store", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 111222,
    storeCount: 8,
    productCount: 100,
    customerCount: 420,
    targetSaleLineCount: 1800,
    examScenario: "underperforming_sales_execution",
    examScenarioStrength: "medium",
  });

  const targetStoreId = dataset.examScenarioApplied!.targetStoreId;
  const salesCountByStore = new Map<string, number>();
  const paidByStore = new Map<string, number>();
  const linesByStore = new Map<string, number>();
  const accessoriesByStore = new Map<string, number>();

  for (const sale of dataset.sales) {
    salesCountByStore.set(sale.storeId, (salesCountByStore.get(sale.storeId) ?? 0) + 1);
    paidByStore.set(sale.storeId, (paidByStore.get(sale.storeId) ?? 0) + sale.totalPaid);
    linesByStore.set(sale.storeId, (linesByStore.get(sale.storeId) ?? 0) + sale.lineCount);
  }
  for (const line of dataset.saleLines) {
    if (line.productKind !== "accessory") continue;
    accessoriesByStore.set(line.storeId, (accessoriesByStore.get(line.storeId) ?? 0) + 1);
  }

  const controlStore = dataset.stores
    .filter(
      (store) =>
        store.id !== targetStoreId &&
        store.type === "Discount" &&
        store.zone === "Peripherie" &&
        store.employeeCount >= 8,
    )
    .sort((left, right) => right.employeeCount - left.employeeCount)[0];

  assert.ok(controlStore);

  assert.ok(
    (paidByStore.get(targetStoreId) ?? 0) < (paidByStore.get(controlStore.id) ?? 0),
  );
  assert.ok(
    (linesByStore.get(targetStoreId) ?? 0) / Math.max(1, salesCountByStore.get(targetStoreId) ?? 0) <
      (linesByStore.get(controlStore.id) ?? 0) /
        Math.max(1, salesCountByStore.get(controlStore.id) ?? 0),
  );
  assert.ok(
    (accessoriesByStore.get(targetStoreId) ?? 0) / Math.max(1, linesByStore.get(targetStoreId) ?? 0) <
      (accessoriesByStore.get(controlStore.id) ?? 0) /
        Math.max(1, linesByStore.get(controlStore.id) ?? 0),
  );
});

test("underperforming sales execution is visible in seller-level productivity indicators", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 111222,
    storeCount: 8,
    productCount: 100,
    customerCount: 420,
    targetSaleLineCount: 1800,
    examScenario: "underperforming_sales_execution",
    examScenarioStrength: "medium",
  });

  const targetStoreId = dataset.examScenarioApplied!.targetStoreId;
  const employeesById = new Map(dataset.employees.map((employee) => [employee.id, employee]));
  const employeeMetrics = new Map<
    string,
    { storeId: string; profile: string; tickets: number; revenue: number; lines: number; accessories: number }
  >();

  for (const employee of dataset.employees) {
    employeeMetrics.set(employee.id, {
      storeId: employee.storeId,
      profile: employee.profile,
      tickets: 0,
      revenue: 0,
      lines: 0,
      accessories: 0,
    });
  }

  for (const sale of dataset.sales) {
    const bucket = employeeMetrics.get(sale.employeeId)!;
    bucket.tickets += 1;
    bucket.revenue += sale.totalPaid;
    bucket.lines += sale.lineCount;
  }

  for (const line of dataset.saleLines) {
    if (line.productKind !== "accessory") continue;
    const bucket = employeeMetrics.get(line.employeeId)!;
    bucket.accessories += 1;
  }

  const sellerRows = [...employeeMetrics.values()].map((metric) => ({
    storeId: metric.storeId,
    profile: metric.profile,
    ticketsPerEmployee: metric.tickets,
    revenuePerEmployee: metric.revenue,
    linesPerTicket: metric.lines / Math.max(1, metric.tickets),
    accessoryAttachRate: metric.accessories / Math.max(1, metric.lines),
  }));

  const targetRows = sellerRows.filter((row) => row.storeId === targetStoreId);
  const controlStore = dataset.stores
    .filter(
      (store) =>
        store.id !== targetStoreId &&
        store.type === "Discount" &&
        store.zone === "Peripherie" &&
        store.employeeCount >= 8,
    )
    .sort((left, right) => right.employeeCount - left.employeeCount)[0];
  assert.ok(controlStore);

  const controlRows = sellerRows.filter((row) => row.storeId === controlStore.id);

  assert.ok(targetRows.length > 0);
  assert.ok(
    average(targetRows.map((row) => row.ticketsPerEmployee)) <
      average(controlRows.map((row) => row.ticketsPerEmployee)),
  );
  assert.ok(
    average(targetRows.map((row) => row.revenuePerEmployee)) <
      average(controlRows.map((row) => row.revenuePerEmployee)),
  );
  assert.ok(
    average(targetRows.map((row) => row.linesPerTicket)) <
      average(controlRows.map((row) => row.linesPerTicket)),
  );
  assert.ok(
    average(targetRows.map((row) => row.accessoryAttachRate)) <
      average(controlRows.map((row) => row.accessoryAttachRate)),
  );

  const targetTopProfiles = sellerRows.filter(
    (row) =>
      row.storeId === targetStoreId &&
      (row.profile === "Requin" || row.profile === "Experimente"),
  );
  const targetWeakerProfiles = sellerRows.filter(
    (row) =>
      row.storeId === targetStoreId &&
      (row.profile === "JeunePrometteur" || row.profile === "Blase" || row.profile === "Stagiaire"),
  );

  if (targetTopProfiles.length > 0 && targetWeakerProfiles.length > 0) {
    assert.ok(
      average(targetTopProfiles.map((row) => row.revenuePerEmployee)) >
        average(targetWeakerProfiles.map((row) => row.revenuePerEmployee)),
    );
    assert.ok(
      average(targetTopProfiles.map((row) => row.linesPerTicket)) >=
        average(targetWeakerProfiles.map((row) => row.linesPerTicket)),
    );
  }

  const topProfileComparables = controlRows.filter(
    (row) =>
      (row.profile === "Requin" || row.profile === "Experimente"),
  );

  if (targetTopProfiles.length > 0 && topProfileComparables.length > 0) {
    assert.ok(
      average(targetTopProfiles.map((row) => row.revenuePerEmployee)) >
        average(topProfileComparables.map((row) => row.revenuePerEmployee)) * 0.72,
    );
  }
});

test("underperforming sales execution creates a large discount target with a large discount control", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 111222,
    storeCount: 8,
    productCount: 100,
    customerCount: 420,
    targetSaleLineCount: 1800,
    examScenario: "underperforming_sales_execution",
    examScenarioStrength: "medium",
  });

  const targetStoreId = dataset.examScenarioApplied!.targetStoreId;
  const largeDiscountStores = dataset.stores.filter(
    (store) => store.type === "Discount" && store.zone === "Peripherie" && store.employeeCount >= 8,
  );

  assert.ok(largeDiscountStores.length >= 2);
  assert.ok(largeDiscountStores.some((store) => store.id === targetStoreId));
});

test("underperforming sales execution biases the target store toward lower pay and newer hires", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 111222,
    storeCount: 8,
    productCount: 100,
    customerCount: 420,
    targetSaleLineCount: 1800,
    examScenario: "underperforming_sales_execution",
    examScenarioStrength: "medium",
  });

  const targetStoreId = dataset.examScenarioApplied!.targetStoreId;
  const targetEmployees = dataset.employees.filter((employee) => employee.storeId === targetStoreId);
  const controlStore = dataset.stores
    .filter(
      (store) =>
        store.id !== targetStoreId &&
        store.type === "Discount" &&
        store.zone === "Peripherie" &&
        store.employeeCount >= 8,
    )
    .sort((left, right) => right.employeeCount - left.employeeCount)[0];

  assert.ok(controlStore);

  const controlEmployees = dataset.employees.filter((employee) => employee.storeId === controlStore.id);

  assert.ok(
    average(targetEmployees.map((employee) => employee.salaryMonthly)) <
      average(controlEmployees.map((employee) => employee.salaryMonthly)),
  );
  assert.ok(
    average(targetEmployees.map((employee) => employee.tenureMonths)) <
      average(controlEmployees.map((employee) => employee.tenureMonths)),
  );
});

test("promo dependency scenario raises discounts on the targeted store", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 333444,
    storeCount: 8,
    productCount: 100,
    customerCount: 420,
    targetSaleLineCount: 1800,
    examScenario: "promo_dependency",
    examScenarioStrength: "medium",
  });

  const targetStoreId = dataset.examScenarioApplied!.targetStoreId;
  const discountsByStore = new Map<string, number[]>();
  for (const line of dataset.saleLines) {
    const bucket = discountsByStore.get(line.storeId) ?? [];
    bucket.push(line.totalDiscountApplied);
    discountsByStore.set(line.storeId, bucket);
  }

  const targetAvg = averageOrZero(discountsByStore.get(targetStoreId) ?? []);
  const baselineMedian = median(
    [...discountsByStore.entries()]
      .filter(([storeId]) => storeId !== targetStoreId)
      .map(([, values]) => averageOrZero(values)),
  );

  assert.ok(targetAvg > baselineMedian);
});

test("understaffed store scenario lowers conversion effectiveness on the targeted store", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 444555,
    storeCount: 8,
    productCount: 100,
    customerCount: 420,
    targetSaleLineCount: 1800,
    examScenario: "understaffed_store",
    examScenarioStrength: "medium",
  });

  const targetStoreId = dataset.examScenarioApplied!.targetStoreId;
  const stores = new Map(dataset.stores.map((store) => [store.id, store]));
  const salesCountByStore = new Map<string, number>();

  for (const sale of dataset.sales) {
    salesCountByStore.set(sale.storeId, (salesCountByStore.get(sale.storeId) ?? 0) + 1);
  }

  const targetStore = stores.get(targetStoreId)!;
  const targetSalesCount = salesCountByStore.get(targetStoreId) ?? 0;
  const targetSalesPerTraffic = targetSalesCount / Math.max(1, targetStore.dailyFootTraffic);
  const baselineMedian = median(
    [...dataset.stores]
      .filter((store) => store.id !== targetStoreId)
      .map((store) => (salesCountByStore.get(store.id) ?? 0) / Math.max(1, store.dailyFootTraffic)),
  );

  assert.ok(targetSalesPerTraffic < baselineMedian);
});

test("premium low traffic scenario keeps premium basket but fewer tickets", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 555666,
    storeCount: 8,
    productCount: 100,
    customerCount: 420,
    targetSaleLineCount: 1800,
    examScenario: "premium_low_traffic",
    examScenarioStrength: "medium",
  });

  const targetStoreId = dataset.examScenarioApplied!.targetStoreId;
  const targetStore = dataset.stores.find((store) => store.id === targetStoreId)!;
  assert.equal(targetStore.type, "Premium");

  const salesCountByStore = new Map<string, number>();
  const basketByStore = new Map<string, number[]>();
  for (const sale of dataset.sales) {
    salesCountByStore.set(sale.storeId, (salesCountByStore.get(sale.storeId) ?? 0) + 1);
    const bucket = basketByStore.get(sale.storeId) ?? [];
    bucket.push(sale.totalPaid);
    basketByStore.set(sale.storeId, bucket);
  }

  const targetSalesCount = salesCountByStore.get(targetStoreId) ?? 0;
  const targetBasket = averageOrZero(basketByStore.get(targetStoreId) ?? []);
  const ticketMedian = median([...salesCountByStore.values()]);
  const basketMedian = median([...basketByStore.values()].map((values) => averageOrZero(values)));

  assert.ok(targetSalesCount < ticketMedian);
  assert.ok(targetBasket >= basketMedian);
});

test("discount volume winner scenario increases volume on a discount store", () => {
  const dataset = generateDataset({
    ...defaultConfig,
    seed: 777888,
    storeCount: 8,
    productCount: 100,
    customerCount: 420,
    targetSaleLineCount: 1800,
    examScenario: "discount_volume_winner",
    examScenarioStrength: "medium",
  });

  const targetStoreId = dataset.examScenarioApplied!.targetStoreId;
  const targetStore = dataset.stores.find((store) => store.id === targetStoreId)!;
  assert.equal(targetStore.type, "Discount");

  const salesCountByStore = new Map<string, number>();
  const totalLinesByStore = new Map<string, number>();
  for (const sale of dataset.sales) {
    salesCountByStore.set(sale.storeId, (salesCountByStore.get(sale.storeId) ?? 0) + 1);
    totalLinesByStore.set(sale.storeId, (totalLinesByStore.get(sale.storeId) ?? 0) + sale.lineCount);
  }

  const targetSalesCount = salesCountByStore.get(targetStoreId) ?? 0;
  const targetTotalLines = totalLinesByStore.get(targetStoreId) ?? 0;
  assert.ok(targetSalesCount > median([...salesCountByStore.values()]));
  assert.ok(targetTotalLines > median([...totalLinesByStore.values()]));
});
