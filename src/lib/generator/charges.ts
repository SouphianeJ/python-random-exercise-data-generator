import type {
  Employee,
  ResolvedStorePerformancePlan,
  Sale,
  SaleLine,
  Store,
  StoreMonthCost,
} from "./types";
import {
  EMPLOYER_RATE_BY_ROLE,
  LOYALTY_POINT_VALUE_EUR,
  MARKETING_RATE_BY_STORE_TYPE,
} from "./economics";
import { performanceModifiersForStore } from "./performance";
import { roundCurrency } from "./utils";

const DAY_MS = 24 * 60 * 60 * 1000;

function openingDaysValue(openDays: Store["openDays"]) {
  return openDays === "open 6/7" ? 6 : 5;
}

function monthSeasonFactor(month: number) {
  if ([12, 1, 2].includes(month)) return 1.14;
  if ([6, 7, 8].includes(month)) return 1.08;
  return 1;
}

function typeFactor(type: Store["type"]) {
  if (type === "Premium") return 1.25;
  if (type === "Discount") return 0.93;
  return 1;
}

function employerRate(employee: Employee) {
  const roleBase = EMPLOYER_RATE_BY_ROLE[employee.role];
  const salaryAdjustment =
    employee.salaryMonthly < 1000
      ? -0.03
      : employee.salaryMonthly <= 2000
        ? -0.01
        : employee.salaryMonthly > 2500
          ? 0.02
          : 0;
  return Math.max(0.08, roleBase + salaryAdjustment);
}

// Share of the month the employee was on the payroll, based on hire and
// departure dates. Pay must not be charged before hiring or after leaving.
function monthActivityFraction(employee: Employee, year: number, month: number) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month - 1, daysInMonth);
  const hire = Date.parse(employee.hireDate);
  const end = employee.endDate ? Date.parse(employee.endDate) : Number.POSITIVE_INFINITY;
  if (hire > monthEnd || end < monthStart) return 0;
  const firstActive = Math.max(hire, monthStart);
  const lastActive = Math.min(end, monthEnd);
  const activeDays = Math.round((lastActive - firstActive) / DAY_MS) + 1;
  return Math.min(1, Math.max(0, activeDays / daysInMonth));
}

export function generateStoreMonthCosts(
  year: number,
  stores: Store[],
  employees: Employee[],
  sales: Sale[],
  saleLines: SaleLine[],
  storePerformancePlan?: ResolvedStorePerformancePlan,
) {
  const employeesByStore = new Map<string, Employee[]>();
  for (const employee of employees) {
    const bucket = employeesByStore.get(employee.storeId) ?? [];
    bucket.push(employee);
    employeesByStore.set(employee.storeId, bucket);
  }

  const linesByStoreMonth = new Map<string, SaleLine[]>();
  for (const line of saleLines) {
    const key = `${line.storeId}:${line.yearMonth}`;
    const bucket = linesByStoreMonth.get(key) ?? [];
    bucket.push(line);
    linesByStoreMonth.set(key, bucket);
  }
  const salesByStoreMonth = new Map<string, Sale[]>();
  for (const sale of sales) {
    const key = `${sale.storeId}:${sale.yearMonth}`;
    const bucket = salesByStoreMonth.get(key) ?? [];
    bucket.push(sale);
    salesByStoreMonth.set(key, bucket);
  }

  const costs: StoreMonthCost[] = [];

  // Fixed costs run every calendar month, including months without any sale.
  for (const store of stores) {
    const modifiers = performanceModifiersForStore(store.id, storePerformancePlan);
    const storeEmployees = employeesByStore.get(store.id) ?? [];

    for (let month = 1; month <= 12; month += 1) {
      const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
      const key = `${store.id}:${yearMonth}`;
      const lines = linesByStoreMonth.get(key) ?? [];
      const salesForMonth = salesByStoreMonth.get(key) ?? [];

      const caTtc = roundCurrency(lines.reduce((sum, line) => sum + line.priceSold, 0));
      const caHt = roundCurrency(lines.reduce((sum, line) => sum + line.priceHt, 0));
      const nbLines = lines.length;
      const hoursFactor = store.openTime / 10;
      const daysFactor = openingDaysValue(store.openDays) / 5.5;
      const openingFactor = hoursFactor * daysFactor;
      const seasonFactor = monthSeasonFactor(month);

      const rentMonth = roundCurrency(
        store.surface *
          store.rentM2Month *
          typeFactor(store.type) *
          store.microLocationFactor *
          modifiers.fixedCostPressureMultiplier,
      );
      const serviceCharges = roundCurrency(rentMonth * 0.12);
      const utilities = roundCurrency(
        store.surface *
          store.utilityM2Month *
          openingFactor *
          seasonFactor *
          store.energyEfficiencyFactor *
          modifiers.fixedCostPressureMultiplier,
      );
      const cleaning = roundCurrency(
        55 + store.surface * 0.85 * (openingDaysValue(store.openDays) / 5),
      );
      const insurance = roundCurrency(70 + store.surface * 0.35 * typeFactor(store.type));
      const maintenance = roundCurrency(30 + store.surface * 0.35);
      const softwareIt = roundCurrency(100 + 16 * store.employeeCount + 0.3 * store.surface);
      const security = store.securityEnabled ? roundCurrency(90 + store.surface * 0.3) : 0;

      const grossPayroll = roundCurrency(
        storeEmployees.reduce(
          (sum, employee) =>
            sum + employee.salaryMonthly * monthActivityFraction(employee, year, month),
          0,
        ),
      );
      const employerContrib = roundCurrency(
        storeEmployees.reduce(
          (sum, employee) =>
            sum +
            employee.salaryMonthly *
              monthActivityFraction(employee, year, month) *
              employerRate(employee),
          0,
        ),
      );
      const paymentFees = roundCurrency(caTtc * store.cardShare * store.acquirerFeeRate);
      const marketingRate = MARKETING_RATE_BY_STORE_TYPE[store.type];
      const localMarketing = roundCurrency(
        Math.max(store.marketingFloor, caHt * marketingRate) * modifiers.marketingFloorMultiplier,
      );
      const shrinkage = roundCurrency(caHt * store.shrinkageRate);
      const cfeMonth = roundCurrency(
        (300 +
          3 * store.surface +
          (store.zone === "Centre-ville" ? 200 : 0) +
          (store.type === "Premium" ? 160 : store.type === "Standard" ? 80 : 0)) /
          12,
      );
      const loyaltyFutureCost = roundCurrency(
        salesForMonth.reduce(
          (sum, sale) => sum + sale.loyaltyPointsEarned * LOYALTY_POINT_VALUE_EUR,
          0,
        ) * store.loyaltyRedemptionProb,
      );
      const loyaltyDiscountTtc = roundCurrency(
        lines.reduce((sum, line) => sum + line.loyaltyDiscountTtc, 0),
      );
      const totalStoreCost = roundCurrency(
        rentMonth +
          serviceCharges +
          utilities +
          cleaning +
          insurance +
          maintenance +
          softwareIt +
          security +
          grossPayroll +
          employerContrib +
          paymentFees +
          localMarketing +
          shrinkage +
          cfeMonth +
          loyaltyFutureCost,
      );

      costs.push({
        yearMonth,
        storeId: store.id,
        rentMonth,
        serviceCharges,
        utilities,
        cleaning,
        insurance,
        maintenance,
        softwareIt,
        security,
        grossPayroll,
        employerContrib,
        paymentFees,
        localMarketing,
        shrinkage,
        cfeMonth,
        loyaltyFutureCost,
        loyaltyDiscountTtc,
        totalStoreCost,
        caTtc,
        caHt,
        nbLines,
      });
    }
  }

  return costs;
}
