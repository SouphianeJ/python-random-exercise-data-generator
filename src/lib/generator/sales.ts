import { SeededRandom } from "./random";
import type {
  Customer,
  Employee,
  GeneratorConfig,
  Product,
  Sale,
  SaleLine,
  Store,
} from "./types";
import {
  formatDate,
  formatTime,
  monthKey,
  pickSaleDateTime,
  roundCurrency,
  safeFavoriteBrand,
} from "./utils";

function monthDiscount(rng: SeededRandom, month: number, isBestSeller: boolean) {
  if (isBestSeller) {
    return rng.chance(0.02) ? rng.float(0.03, 0.08) : 0;
  }
  if ([1, 7].includes(month)) {
    return rng.chance(0.22) ? rng.choice([0.05, 0.1, 0.15, 0.2, 0.25, 0.3]) : 0;
  }
  return rng.chance(0.1) ? rng.choice([0.05, 0.1, 0.15, 0.2]) : 0;
}

function pickCustomerForStoreWeighted(
  rng: SeededRandom,
  customers: Customer[],
  store: Store,
  visitCounts: Map<string, number>,
  storeVisitCounts: Map<string, number>,
) {
  const compatible = customers.filter((customer) => {
    if (customer.profile !== "fidele_marque" || !customer.favoriteBrand) {
      return true;
    }
    return store.specialtyBrands.includes(customer.favoriteBrand);
  });
  const pool = compatible.length > 0 ? compatible : customers;
  const weights = pool.map((customer) => {
    const visits = visitCounts.get(customer.id) ?? 0;
    const storeVisits = storeVisitCounts.get(`${customer.id}:${store.id}`) ?? 0;
    let weight = 1;

    if (customer.hasLoyaltyCard) weight *= 1.18;
    if (customer.profile === "sneakerhead") weight *= 1.26;
    if (customer.profile === "fidele_marque") weight *= 1.34;
    if (customer.profile === "chasseur_de_promos") weight *= 1.08;
    if (customer.profile === "impulsif") weight *= 0.8;

    const revisitBoost =
      customer.profile === "fidele_marque"
        ? 0.28
        : customer.profile === "sneakerhead"
          ? 0.22
          : customer.profile === "chasseur_de_promos"
            ? 0.16
            : 0.08;
    const storeRevisitBoost =
      customer.profile === "fidele_marque"
        ? 0.42
        : customer.profile === "sneakerhead"
          ? 0.28
          : customer.profile === "chasseur_de_promos"
            ? 0.2
            : 0.1;

    weight *= 1 + Math.min(visits * revisitBoost, 1.8);
    weight *= 1 + Math.min(storeVisits * storeRevisitBoost, 2.2);

    return weight;
  });

  return rng.weightedChoice(pool, weights);
}

export function generateSales(
  rng: SeededRandom,
  config: GeneratorConfig,
  stores: Store[],
  employees: Employee[],
  products: Product[],
  customers: Customer[],
) {
  const sales: Sale[] = [];
  const saleLines: SaleLine[] = [];
  let saleIndex = 1;
  let lineIndex = 1;
  const customerState = new Map(customers.map((customer) => [customer.id, { ...customer }]));
  const customerVisitCounts = new Map<string, number>();
  const customerStoreVisitCounts = new Map<string, number>();
  const targetSales = config.targetSaleCount;
  const targetLines = config.targetSaleLineCount;

  const shoesByBrand = new Map<string, Product[]>();
  const accessoryProducts = products.filter((product) => product.kind === "accessory");
  for (const product of products.filter((entry) => entry.kind === "shoe")) {
    const bucket = shoesByBrand.get(product.brand) ?? [];
    bucket.push(product);
    shoesByBrand.set(product.brand, bucket);
  }
  const employeesByStore = new Map<string, Employee[]>();
  for (const employee of employees) {
    const bucket = employeesByStore.get(employee.storeId) ?? [];
    bucket.push(employee);
    employeesByStore.set(employee.storeId, bucket);
  }

  while (true) {
    if (typeof targetSales === "number" && sales.length >= targetSales) break;
    if (typeof targetLines === "number" && saleLines.length >= targetLines) break;

    const store = rng.weightedChoice(
      stores,
      stores.map((candidate) => candidate.dailyFootTraffic * candidate.conversionRate),
    );
    const saleMoment = pickSaleDateTime(rng, config.year, store);
    const saleDate = formatDate(saleMoment);
    const yearMonth = monthKey(saleDate);
    const month = saleMoment.getUTCMonth() + 1;

    const eligibleEmployees = (employeesByStore.get(store.id) ?? []).filter(
      (employee) => new Date(employee.hireDate) <= saleMoment,
    );
    if (eligibleEmployees.length === 0) continue;

    const employee = rng.weightedChoice(
      eligibleEmployees,
      eligibleEmployees.map((candidate) => candidate.conversionRate * candidate.salesWeight),
    );
    const customer = customerState.get(
      pickCustomerForStoreWeighted(
        rng,
        customers,
        store,
        customerVisitCounts,
        customerStoreVisitCounts,
      ).id,
    )!;
    const loyalBrand = safeFavoriteBrand(store, customer);
    const chosenBrand =
      loyalBrand ??
      rng.weightedChoice(
        store.specialtyBrands,
        store.specialtyBrands.map((brand) => {
          if (customer.profile === "sneakerhead" && ["Nike", "Jordans", "Adidas"].includes(brand)) {
            return 1.4;
          }
          return 1;
        }),
      );
    const availableShoes = shoesByBrand.get(chosenBrand) ?? [];
    if (availableShoes.length === 0) continue;

    const hypeProducts = availableShoes.filter(
      (product) => product.isBestSeller || product.category === "Limited Edition",
    );
    let primaryProduct =
      customer.profile === "sneakerhead" && hypeProducts.length > 0 && rng.chance(0.72)
        ? rng.choice(hypeProducts)
        : rng.choice(availableShoes);
    if (employee.profile === "Requin" && hypeProducts.length > 0 && rng.chance(0.78)) {
      primaryProduct = rng.choice(hypeProducts);
    }

    const lineProducts: Product[] = [primaryProduct];
    let extraShoeChance = 0.02;
    if (employee.profile === "Requin") extraShoeChance += 0.12;
    if (employee.profile === "Experimente") extraShoeChance += 0.05;
    if (employee.profile === "Stagiaire") extraShoeChance -= 0.01;
    if (customer.profile === "sneakerhead") extraShoeChance += 0.16;
    if (customer.profile === "impulsif") extraShoeChance += 0.08;
    if (customer.profile === "chasseur_de_promos") extraShoeChance += 0.05;
    if (customer.profile === "fidele_marque") extraShoeChance += 0.04;
    if (store.type === "Discount") extraShoeChance += 0.03;

    if (rng.chance(Math.max(0.02, extraShoeChance))) {
      const secondShoePool = availableShoes.filter(
        (product) => product.id !== primaryProduct.id && product.size === primaryProduct.size,
      );
      if (secondShoePool.length > 0) {
        lineProducts.push(
          customer.profile === "sneakerhead" &&
            secondShoePool.some(
              (product) => product.isBestSeller || product.category === "Limited Edition",
            ) &&
            rng.chance(0.6)
            ? rng.choice(
                secondShoePool.filter(
                  (product) => product.isBestSeller || product.category === "Limited Edition",
                ),
              )
            : rng.choice(secondShoePool),
        );
      }
    }

    if (config.includeAccessories && accessoryProducts.length > 0) {
      let accessoryChance = 0.06;
      if (employee.profile === "Requin") accessoryChance += 0.19;
      if (employee.profile === "Experimente") accessoryChance += 0.08;
      if (customer.profile === "impulsif") accessoryChance += 0.12;
      if (customer.profile === "sneakerhead") accessoryChance += 0.04;
      if (employee.profile === "Stagiaire") accessoryChance -= 0.04;

      if (rng.chance(Math.max(0.03, accessoryChance))) {
        lineProducts.push(rng.choice(accessoryProducts));
        if (rng.chance(0.15)) {
          lineProducts.push(rng.choice(accessoryProducts));
        }
      }
    }

    const saleId = `V${String(saleIndex).padStart(6, "0")}`;
    const preliminaryLines = lineProducts.map((product, offset) => {
      const basePrice = product.basePrice;
      const adjustedBasePrice = roundCurrency(basePrice * (1 + store.priceAdjustmentPercent / 100));
      const discountValueMonth = roundCurrency(
        adjustedBasePrice * monthDiscount(rng, month, product.isBestSeller),
      );
      let discountAppliedProfile = 0;
      const pricedAfterMonth = adjustedBasePrice - discountValueMonth;
      if (customer.profile === "chasseur_de_promos" && rng.chance(0.28)) {
        discountAppliedProfile = roundCurrency(pricedAfterMonth * rng.float(0.08, 0.18, 3));
      } else if (customer.profile !== "chasseur_de_promos" && rng.chance(0.05)) {
        discountAppliedProfile = roundCurrency(pricedAfterMonth * rng.float(0.03, 0.1, 3));
      }

      return {
        id: `L${String(lineIndex + offset).padStart(7, "0")}`,
        saleId,
        storeId: store.id,
        employeeId: employee.id,
        customerId: customer.id,
        productId: product.id,
        legacyProductId: product.legacyId,
        productKind: product.kind,
        date: saleDate,
        time: formatTime(saleMoment),
        yearMonth,
        basePrice,
        adjustedBasePrice,
        priceBeforeLoyalty: Math.max(1, roundCurrency(pricedAfterMonth - discountAppliedProfile)),
        isBestSeller: product.isBestSeller,
        brand: product.brand,
        category: product.category,
        model: product.model,
        color: product.color,
        size: product.size,
        storeAdjustmentPercent: store.priceAdjustmentPercent,
        discountValueMonth,
        discountAppliedProfile,
      };
    });

    const subtotalBeforeLoyalty = roundCurrency(
      preliminaryLines.reduce((sum, line) => sum + line.priceBeforeLoyalty, 0),
    );
    const customerCanRedeem =
      customer.hasLoyaltyCard &&
      customer.loyaltyPoints >= 100 &&
      rng.chance(customer.profile === "chasseur_de_promos" ? 0.25 : 0.15);
    const maxRedeemEuro = roundCurrency(subtotalBeforeLoyalty * 0.3);
    const loyaltyPointsUsed =
      customerCanRedeem ? Math.min(customer.loyaltyPoints, Math.floor(maxRedeemEuro * 10)) : 0;
    let remainingLoyalty = roundCurrency(loyaltyPointsUsed / 10);

    const finalLines: SaleLine[] = preliminaryLines.map((line, idx) => {
      const fidelity = idx === 0 ? Math.min(line.priceBeforeLoyalty - 1, remainingLoyalty) : 0;
      remainingLoyalty = roundCurrency(remainingLoyalty - fidelity);
      const priceSold = roundCurrency(line.priceBeforeLoyalty - fidelity);
      const totalDiscountApplied = roundCurrency(
        line.discountValueMonth + line.discountAppliedProfile + fidelity,
      );
      return {
        id: line.id,
        saleId: line.saleId,
        storeId: line.storeId,
        employeeId: line.employeeId,
        customerId: line.customerId,
        productId: line.productId,
        legacyProductId: line.legacyProductId,
        productKind: line.productKind,
        date: line.date,
        time: line.time,
        yearMonth: line.yearMonth,
        basePrice: line.basePrice,
        adjustedBasePrice: line.adjustedBasePrice,
        priceSold,
        isBestSeller: line.isBestSeller,
        brand: line.brand,
        category: line.category,
        model: line.model,
        color: line.color,
        size: line.size,
        storeAdjustmentPercent: line.storeAdjustmentPercent,
        discountValueMonth: line.discountValueMonth,
        discountAppliedProfile: line.discountAppliedProfile,
        discountValueFidelity: fidelity,
        totalDiscountApplied,
        percentSaved: roundCurrency(
          line.adjustedBasePrice > 0 ? (1 - priceSold / line.adjustedBasePrice) * 100 : 0,
        ),
      };
    });

    const totalPaid = roundCurrency(finalLines.reduce((sum, line) => sum + line.priceSold, 0));
    const loyaltyPointsEarned = customer.hasLoyaltyCard ? Math.floor(totalPaid * 0.1) : 0;
    customer.loyaltyPoints =
      Math.max(0, customer.loyaltyPoints - loyaltyPointsUsed) + loyaltyPointsEarned;
    customerVisitCounts.set(customer.id, (customerVisitCounts.get(customer.id) ?? 0) + 1);
    const storeVisitKey = `${customer.id}:${store.id}`;
    customerStoreVisitCounts.set(
      storeVisitKey,
      (customerStoreVisitCounts.get(storeVisitKey) ?? 0) + 1,
    );

    sales.push({
      id: saleId,
      storeId: store.id,
      employeeId: employee.id,
      customerId: customer.id,
      date: saleDate,
      time: formatTime(saleMoment),
      yearMonth,
      loyaltyPointsUsed,
      loyaltyPointsEarned,
      subtotalBeforeLoyalty,
      totalDiscountApplied: roundCurrency(
        finalLines.reduce((sum, line) => sum + line.totalDiscountApplied, 0),
      ),
      totalPaid,
      lineCount: finalLines.length,
    });
    saleLines.push(...finalLines);

    saleIndex += 1;
    lineIndex += finalLines.length;
  }

  return { sales, saleLines };
}
