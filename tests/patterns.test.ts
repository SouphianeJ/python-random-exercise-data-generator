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
