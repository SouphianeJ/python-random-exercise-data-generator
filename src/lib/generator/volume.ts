import { MONTH_FACTORS } from "./constants";
import { performanceModifiersForStore } from "./performance";
import { adjustedLinePrice } from "./pricing";
import { SeededRandom } from "./random";
import type {
  Customer,
  Employee,
  GeneratorConfig,
  Product,
  ResolvedStorePerformancePlan,
  Store,
  StoreMonthlyVolumePlan,
} from "./types";
import { openDaysInMonth, roundCurrency } from "./utils";

function profileExecutionFactor(profile: Employee["profile"]) {
  if (profile === "Requin") return 1.16;
  if (profile === "Experimente") return 1.08;
  if (profile === "JeunePrometteur") return 0.98;
  if (profile === "Blase") return 0.84;
  return 0.68;
}

function roleExecutionFactor(role: Employee["role"]) {
  if (role === "Sales") return 1.04;
  if (role === "Manager") return 0.98;
  if (role === "Support") return 0.92;
  return 0.68;
}

function teamQualityScore(storeId: string, employees: Employee[]) {
  const team = employees.filter(
    (employee) => employee.storeId === storeId && !employee.endDate,
  );
  if (team.length === 0) return 0.85;

  const score =
    team.reduce((sum, employee) => {
      const profileFactor = profileExecutionFactor(employee.profile);
      const roleFactor = roleExecutionFactor(employee.role);
      const conversionFactor = Math.max(0.72, employee.conversionRate / 0.2);
      return (
        sum +
        profileFactor *
          roleFactor *
          conversionFactor *
          Math.max(0.55, employee.workRatioFrontoffice) *
          Math.max(0.6, employee.salesWeight)
      );
    }, 0) / team.length;

  return Math.max(0.78, Math.min(1.22, score));
}

function customerDemandFactor(customers: Customer[], storeCount: number) {
  const perStore = customers.length / Math.max(1, storeCount);
  const loyaltyMix =
    customers.filter(
      (customer) =>
        customer.profile === "sneakerhead" || customer.profile === "fidele_marque",
    ).length / Math.max(1, customers.length);

  return Math.max(0.82, Math.min(1.18, 0.9 + perStore / 550 + loyaltyMix * 0.18));
}

function typeCaptureFactor(store: Store) {
  if (store.type === "Premium") return store.zone === "Centre-ville" ? 0.24 : 0.21;
  if (store.type === "Standard") return store.zone === "Centre-ville" ? 0.19 : 0.18;
  return store.zone === "Peripherie" ? 0.17 : 0.15;
}

function linesBaseByType(store: Store) {
  if (store.type === "Premium") return 1.24;
  if (store.type === "Standard") return 1.18;
  return store.zone === "Peripherie" ? 1.22 : 1.16;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Ticket value is estimated from the store's actual product assortment
// (specialty-brand shoes at store-adjusted prices), not from an arbitrary
// store attribute, so planned revenue stays close to realized revenue.
function estimateTicketValue(
  store: Store,
  products: Product[],
  config: GeneratorConfig,
  extraLinesPerTicket: number,
  premiumMixMultiplier: number,
) {
  const shoes = products.filter((product) => product.kind === "shoe");
  const storeShoes = shoes.filter((product) =>
    store.specialtyBrands.includes(product.brand),
  );
  const shoePool = storeShoes.length > 0 ? storeShoes : shoes;
  const avgShoePrice = average(shoePool.map((product) => adjustedLinePrice(store, product)));
  const accessories = config.includeAccessories
    ? products.filter((product) => product.kind === "accessory")
    : [];
  const avgAccessoryPrice = average(
    accessories.map((product) => adjustedLinePrice(store, product)),
  );

  // Hype products (best sellers, limited editions) are over-picked by
  // sneakerheads and Requin sellers, lifting the realized average line price.
  // Premium stores staff more Requin sellers, so the lift is strongest there;
  // Discount stores barely benefit because their prices are anchor-compressed.
  const typeHype =
    store.type === "Premium" ? 1.16 : store.type === "Standard" ? 1.06 : 1.02;
  const hypeBoost = typeHype * Math.max(0.96, Math.min(1.06, premiumMixMultiplier));
  // Month promos, special offers and loyalty redemptions shave a few percent.
  const discountLeak = 0.03;

  const accessoryShare = accessories.length > 0 ? 0.55 : 0;
  const shoeLines = 1 + extraLinesPerTicket * (1 - accessoryShare);
  const accessoryLines = extraLinesPerTicket * accessoryShare;

  return (
    (avgShoePrice * hypeBoost * shoeLines + avgAccessoryPrice * accessoryLines) *
    (1 - discountLeak)
  );
}

export function buildStoreMonthlyVolumePlan(
  rng: SeededRandom,
  config: GeneratorConfig,
  stores: Store[],
  employees: Employee[],
  customers: Customer[],
  products: Product[],
  performancePlan?: ResolvedStorePerformancePlan,
) {
  const year = config.year;
  const customerFactor = customerDemandFactor(customers, stores.length);
  const plans: StoreMonthlyVolumePlan[] = [];

  for (const store of stores) {
    const modifiers = performanceModifiersForStore(store.id, performancePlan);
    const teamQuality = teamQualityScore(store.id, employees);
    const adjustedDailyVisitors = Math.max(
      8,
      Math.round(store.dailyFootTraffic * modifiers.trafficVisibilityMultiplier),
    );
    const adjustedDailyTickets = Math.max(
      2,
      roundCurrency(
        adjustedDailyVisitors *
          store.conversionRate *
          typeCaptureFactor(store) *
          teamQuality *
          customerFactor *
          modifiers.conversionExecutionMultiplier,
      ),
    );

    const extraLinesPerTicket = Math.max(
      0,
      (linesBaseByType(store) - 1) *
        modifiers.basketExecutionMultiplier *
        (1 + Math.max(-0.08, modifiers.frontOfficeEfficiencyShift)),
    );
    const expectedAvgLinesPerTicket = roundCurrency(1 + extraLinesPerTicket);
    const expectedAvgTicketTtc = roundCurrency(
      estimateTicketValue(
        store,
        products,
        config,
        extraLinesPerTicket,
        modifiers.premiumMixMultiplier,
      ),
    );

    for (let month = 1; month <= 12; month += 1) {
      const seasonalFactor = MONTH_FACTORS[month] ?? 1;
      const microVariation = Math.max(0.88, Math.min(1.12, rng.float(0.94, 1.08, 3)));
      const openDays = openDaysInMonth(year, month, store.openDays);
      const expectedMonthlyTickets = Math.max(
        18,
        Math.round(adjustedDailyTickets * openDays * seasonalFactor * microVariation),
      );

      plans.push({
        storeId: store.id,
        yearMonth: `${year}-${String(month).padStart(2, "0")}`,
        month,
        expectedDailyVisitors: adjustedDailyVisitors,
        expectedDailyTickets: adjustedDailyTickets,
        expectedMonthlyTickets,
        expectedAvgLinesPerTicket,
        expectedAvgTicketTtc,
        expectedMonthlyRevenue: roundCurrency(
          expectedMonthlyTickets * expectedAvgTicketTtc,
        ),
      });
    }
  }

  return plans;
}

// Once the plan exists, the store estimate columns are aligned on it so the
// exported magasins table stays internally coherent: traffic_conversion =
// daily_foot_traffic x conversion_rate = expected daily tickets.
export function applyStorePlanEstimates(stores: Store[], plans: StoreMonthlyVolumePlan[]) {
  for (const store of stores) {
    const rows = plans.filter((plan) => plan.storeId === store.id);
    if (rows.length === 0) continue;

    const avgDailyTickets = average(rows.map((plan) => plan.expectedDailyTickets));
    store.trafficConversion = Math.max(1, Math.round(avgDailyTickets));
    store.conversionRate = Number(
      (avgDailyTickets / Math.max(1, store.dailyFootTraffic)).toFixed(3),
    );
    store.avgBasketValue = Math.round(average(rows.map((plan) => plan.expectedAvgTicketTtc)));
    store.monthlyRevenueEstimate = Math.round(
      average(rows.map((plan) => plan.expectedMonthlyRevenue)),
    );
  }
}
