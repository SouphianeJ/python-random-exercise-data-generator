import {
  LOYALTY_EARN_POINTS_PER_EUR,
  LOYALTY_MAX_REDEEM_SHARE,
  LOYALTY_MIN_POINTS_TO_REDEEM,
  LOYALTY_POINT_VALUE_EUR,
  TVA_RATE,
} from "./economics";
import { performanceModifiersForStore } from "./performance";
import { adjustedLinePrice } from "./pricing";
import { SeededRandom } from "./random";
import type {
  Customer,
  Employee,
  EmployeeProfile,
  GeneratorConfig,
  Product,
  ResolvedStorePerformancePlan,
  Sale,
  SaleLine,
  Store,
  StoreMonthlyVolumePlan,
} from "./types";
import {
  formatDate,
  formatTime,
  monthKey,
  pickSaleDateTimeForMonth,
  roundCurrency,
  safeFavoriteBrand,
} from "./utils";

function monthDiscount(
  rng: SeededRandom,
  month: number,
  isBestSeller: boolean,
  monthDiscountMultiplier: number,
) {
  if (isBestSeller) {
    return rng.chance(0.02) ? rng.float(0.03, 0.08) * monthDiscountMultiplier : 0;
  }
  if ([1, 7].includes(month)) {
    return rng.chance(0.22)
      ? rng.choice([0.05, 0.1, 0.15, 0.2, 0.25, 0.3]) * monthDiscountMultiplier
      : 0;
  }
  return rng.chance(0.1) ? rng.choice([0.05, 0.1, 0.15, 0.2]) * monthDiscountMultiplier : 0;
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

function blendMultiplierTowardsNeutral(base: number, resilience: number) {
  return 1 + (base - 1) * resilience;
}

function sellerPerformanceMultiplier(
  performancePlan: ResolvedStorePerformancePlan | undefined,
  storeId: string,
  employeeProfile: EmployeeProfile,
  base: number,
) {
  const modifiers = performanceModifiersForStore(storeId, performancePlan);
  if (modifiers.staffStabilityMultiplier >= 0.95) {
    return base;
  }

  const resilience =
    employeeProfile === "Requin"
      ? 0.2
      : employeeProfile === "Experimente"
        ? 0.35
        : employeeProfile === "JeunePrometteur"
          ? 0.9
          : employeeProfile === "Blase"
            ? 1.05
            : 1.1;

  return blendMultiplierTowardsNeutral(base, resilience);
}

export function generateSales(
  rng: SeededRandom,
  config: GeneratorConfig,
  stores: Store[],
  employees: Employee[],
  products: Product[],
  customers: Customer[],
  monthlyVolumePlan: StoreMonthlyVolumePlan[],
  storePerformancePlan?: ResolvedStorePerformancePlan,
) {
  const sales: Sale[] = [];
  const saleLines: SaleLine[] = [];
  let saleIndex = 1;
  let lineIndex = 1;
  const customerState = new Map(customers.map((customer) => [customer.id, { ...customer }]));
  const customerVisitCounts = new Map<string, number>();
  const customerStoreVisitCounts = new Map<string, number>();

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

  for (const plan of monthlyVolumePlan) {
    const store = stores.find((entry) => entry.id === plan.storeId)!;
    const storeModifiers = performanceModifiersForStore(store.id, storePerformancePlan);

    for (let ticket = 0; ticket < plan.expectedMonthlyTickets; ticket += 1) {
      const saleMoment = pickSaleDateTimeForMonth(rng, config.year, plan.month, store);
      const saleDate = formatDate(saleMoment);
      const yearMonth = monthKey(saleDate);
      const month = saleMoment.getUTCMonth() + 1;

      const eligibleEmployees = (employeesByStore.get(store.id) ?? []).filter(
        (employee) =>
          new Date(employee.hireDate) <= saleMoment &&
          (!employee.endDate || saleMoment <= new Date(`${employee.endDate}T23:59:59.999Z`)),
      );
      if (eligibleEmployees.length === 0) continue;

      const employee = rng.weightedChoice(
        eligibleEmployees,
        eligibleEmployees.map((candidate) => {
          const effectiveFrontOffice = Math.max(
            0.2,
            candidate.workRatioFrontoffice + storeModifiers.frontOfficeEfficiencyShift,
          );
          const sellerEffectMultiplier = sellerPerformanceMultiplier(
            storePerformancePlan,
            store.id,
            candidate.profile,
            storeModifiers.sellerEffectMultiplier,
          );
          return (
            candidate.conversionRate *
            candidate.salesWeight *
            sellerEffectMultiplier *
            effectiveFrontOffice
          );
        }),
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
      const availableStoreBrands = store.specialtyBrands.filter(
        (brand) => (shoesByBrand.get(brand) ?? []).length > 0,
      );
      const fallbackBrands = [...shoesByBrand.keys()];
      const saleBrands = availableStoreBrands.length > 0 ? availableStoreBrands : fallbackBrands;
      if (saleBrands.length === 0) continue;

      const chosenBrand =
        loyalBrand ??
        rng.weightedChoice(
          saleBrands,
          saleBrands.map((brand) => {
            if (
              customer.profile === "sneakerhead" &&
              ["Nike", "Jordans", "Adidas"].includes(brand)
            ) {
              return 1.4 * storeModifiers.premiumMixMultiplier;
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
      if (
        employee.profile === "Requin" &&
        hypeProducts.length > 0 &&
        rng.chance(Math.min(0.95, 0.78 * storeModifiers.premiumMixMultiplier))
      ) {
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
      if (store.type === "Discount") extraShoeChance += 0.07;
      extraShoeChance *= sellerPerformanceMultiplier(
        storePerformancePlan,
        store.id,
        employee.profile,
        storeModifiers.basketExecutionMultiplier,
      );

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
              rng.chance(Math.min(0.9, 0.6 * storeModifiers.premiumMixMultiplier))
              ? rng.choice(
                  secondShoePool.filter(
                    (product) =>
                      product.isBestSeller || product.category === "Limited Edition",
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
        accessoryChance *= sellerPerformanceMultiplier(
          storePerformancePlan,
          store.id,
          employee.profile,
          storeModifiers.accessoryExecutionMultiplier,
        );

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
        const adjustedBasePrice = adjustedLinePrice(store, product);
        const discountValueMonth = roundCurrency(
          adjustedBasePrice *
            monthDiscount(
              rng,
              month,
              product.isBestSeller,
              storeModifiers.monthDiscountMultiplier,
            ),
        );
        let specialOfferDiscount = 0;
        const pricedAfterMonth = adjustedBasePrice - discountValueMonth;
        if (
          customer.profile === "chasseur_de_promos" &&
          rng.chance(Math.min(0.75, 0.28 * storeModifiers.specialOfferMultiplier))
        ) {
          specialOfferDiscount = roundCurrency(
            pricedAfterMonth *
              rng.float(0.08, 0.18, 3) *
              Math.min(1.5, storeModifiers.specialOfferMultiplier) *
              (store.type === "Discount" ? 1.08 : 1),
          );
        } else if (
          customer.profile !== "chasseur_de_promos" &&
          rng.chance(Math.min(0.25, 0.05 * storeModifiers.specialOfferMultiplier))
        ) {
          specialOfferDiscount = roundCurrency(
            pricedAfterMonth *
              rng.float(0.03, 0.1, 3) *
              Math.min(1.35, storeModifiers.specialOfferMultiplier) *
              (store.type === "Discount" ? 1.05 : 1),
          );
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
          priceBeforeLoyalty: Math.max(1, roundCurrency(pricedAfterMonth - specialOfferDiscount)),
          isBestSeller: product.isBestSeller,
          brand: product.brand,
          category: product.category,
          model: product.model,
          color: product.color,
          size: product.size,
          storeAdjustmentPercent: store.priceAdjustmentPercent,
          discountValueMonth,
          specialOfferDiscount,
        };
      });

      const subtotalBeforeLoyalty = roundCurrency(
        preliminaryLines.reduce((sum, line) => sum + line.priceBeforeLoyalty, 0),
      );
      const customerCanRedeem =
        customer.hasLoyaltyCard &&
        customer.loyaltyPoints >= LOYALTY_MIN_POINTS_TO_REDEEM &&
        rng.chance(customer.profile === "chasseur_de_promos" ? 0.25 : 0.15);
      const maxRedeemEuro = roundCurrency(subtotalBeforeLoyalty * LOYALTY_MAX_REDEEM_SHARE);
      const plannedPointsToUse = customerCanRedeem
        ? Math.min(customer.loyaltyPoints, Math.floor(maxRedeemEuro / LOYALTY_POINT_VALUE_EUR))
        : 0;
      // Spread redemption over the lines so every planned point converts into
      // an actual discount; leftover points stay with the customer.
      let remainingPoints = plannedPointsToUse;

      const finalLines: SaleLine[] = preliminaryLines.map((line) => {
        const maxLinePoints = Math.max(
          0,
          Math.floor((line.priceBeforeLoyalty - 1) / LOYALTY_POINT_VALUE_EUR),
        );
        const linePoints = Math.min(maxLinePoints, remainingPoints);
        remainingPoints -= linePoints;
        const fidelity = roundCurrency(linePoints * LOYALTY_POINT_VALUE_EUR);
        const priceSold = roundCurrency(line.priceBeforeLoyalty - fidelity);
        const totalDiscountApplied = roundCurrency(
          line.discountValueMonth + line.specialOfferDiscount + fidelity,
        );
        const tvaRate = TVA_RATE;
        const priceHt = roundCurrency(priceSold / (1 + tvaRate));
        const tvaAmount = roundCurrency(priceSold - priceHt);
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
          specialOfferDiscount: line.specialOfferDiscount,
          discountValueFidelity: fidelity,
          totalDiscountApplied,
          percentSaved: roundCurrency(
            line.adjustedBasePrice > 0 ? (1 - priceSold / line.adjustedBasePrice) * 100 : 0,
          ),
          tvaRate,
          priceHt,
          tvaAmount,
          loyaltyDiscountTtc: fidelity,
          grossPriceTtcBeforeLoyalty: line.priceBeforeLoyalty,
        };
      });

      const loyaltyPointsUsed = plannedPointsToUse - remainingPoints;
      const totalPaid = roundCurrency(finalLines.reduce((sum, line) => sum + line.priceSold, 0));
      const loyaltyPointsEarned = customer.hasLoyaltyCard
        ? Math.floor(totalPaid * LOYALTY_EARN_POINTS_PER_EUR)
        : 0;
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
  }

  return { sales, saleLines };
}
