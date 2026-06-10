import type {
  Customer,
  GeneratorConfig,
  AppliedStorePerformance,
  Store,
} from "./types";
import { MONTH_FACTORS } from "./constants";
import { SeededRandom } from "./random";

export function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

export function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function formatTime(date: Date) {
  return date.toISOString().slice(11, 16);
}

export function diffMonths(fromDateIso: string, toDate: Date) {
  const from = new Date(fromDateIso);
  let months =
    (toDate.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (toDate.getUTCMonth() - from.getUTCMonth());
  if (toDate.getUTCDate() < from.getUTCDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

export function monthKey(dateIso: string) {
  return dateIso.slice(0, 7);
}

export function parseClosingHour(label: string) {
  const parts = label.split("/");
  return Number(parts[1]?.replace("h", "")) || 18;
}

export function pickOpenDate(
  rng: SeededRandom,
  year: number,
  openDays: Store["openDays"],
  month?: number,
) {
  const targetMonth =
    month ?? rng.weightedChoice(Object.keys(MONTH_FACTORS).map(Number), Object.values(MONTH_FACTORS));
  const allowedWeekdays = openDays === "open 6/7" ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  if (allowedWeekdays.includes(6) && rng.chance(0.12)) {
    const saturdays: Date[] = [];
    const lastDay = new Date(Date.UTC(year, targetMonth, 0)).getUTCDate();
    for (let day = 1; day <= lastDay; day += 1) {
      const date = new Date(Date.UTC(year, targetMonth - 1, day, 0, 0, 0));
      const weekday = date.getUTCDay();
      if ((weekday === 0 ? 7 : weekday) === 6) {
        saturdays.push(date);
      }
    }
    if (saturdays.length > 0) {
      return rng.choice(saturdays);
    }
  }
  while (true) {
    const day = rng.int(1, new Date(Date.UTC(year, targetMonth, 0)).getUTCDate());
    const date = new Date(Date.UTC(year, targetMonth - 1, day, 0, 0, 0));
    const weekday = date.getUTCDay();
    const normalizedWeekday = weekday === 0 ? 7 : weekday;
    if (allowedWeekdays.includes(normalizedWeekday)) {
      return date;
    }
  }
}

export function openDaysInMonth(
  year: number,
  month: number,
  openDays: Store["openDays"],
) {
  const allowedWeekdays = openDays === "open 6/7" ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const weekday = date.getUTCDay();
    const normalizedWeekday = weekday === 0 ? 7 : weekday;
    if (allowedWeekdays.includes(normalizedWeekday)) {
      count += 1;
    }
  }
  return count;
}

export function pickSaleDateTimeForMonth(
  rng: SeededRandom,
  year: number,
  month: number,
  store: Store,
) {
  const date = pickOpenDate(rng, year, store.openDays, month);
  const closingHour = parseClosingHour(store.openToClientsHours);
  const hour = rng.int(9, Math.max(9, closingHour - 1));
  const minute = rng.int(0, 59);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

export function serializeBrands(brands: string[]) {
  return brands.join("|");
}

export function realisticAge(rng: SeededRandom) {
  return Math.max(16, Math.min(78, Math.round(rng.normal(33, 12))));
}

export function safeFavoriteBrand(store: Store, customer: Customer) {
  if (customer.profile === "fidele_marque" && customer.favoriteBrand) {
    return store.specialtyBrands.includes(customer.favoriteBrand)
      ? customer.favoriteBrand
      : null;
  }
  return null;
}

export function configWarnings(
  config: GeneratorConfig,
  storePerformanceApplied: AppliedStorePerformance[],
) {
  const warnings: string[] = [];
  if (config.customerCount < config.storeCount * 20) {
    warnings.push("Low customer counts reduce diversity and repeat the same buyers often.");
  }
  if (!config.includeAccessories) {
    warnings.push("Accessory upsells are disabled, so basket composition is less varied.");
  }
  if (!config.includeInterns) {
    warnings.push("Intern profiles are disabled to maximize realism consistency.");
  }
  if (storePerformanceApplied.length > 0) {
    warnings.push(
      `Store performance plan active on ${storePerformanceApplied.length} magasin(s).`,
    );
  }
  return warnings;
}
