import { BRANDS } from "./constants";
import { ensureStoreBlueprintRequirements } from "./performance";
import { SeededRandom } from "./random";
import type { GeneratorConfig, Store, StoreType } from "./types";

function shuffleInPlace<T>(rng: SeededRandom, items: T[]) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.int(0, index);
    const current = items[index];
    items[index] = items[swapIndex];
    items[swapIndex] = current;
  }
  return items;
}

function buildRepresentativeStoreBlueprints(
  rng: SeededRandom,
  config: GeneratorConfig,
): Array<{ zone: Store["zone"]; type: StoreType }> {
  const storeCount = config.storeCount;
  const blueprints: Array<{ zone: Store["zone"]; type: StoreType }> = [];

  if (storeCount >= 1) {
    blueprints.push({ zone: "Centre-ville", type: "Premium" });
  }
  if (storeCount >= 2) {
    blueprints.push({ zone: "Peripherie", type: "Discount" });
  }
  if (storeCount >= 3) {
    blueprints.push({
      zone: rng.chance(0.55) ? "Centre-ville" : "Peripherie",
      type: "Standard",
    });
  }

  while (blueprints.length < storeCount) {
    const zone = rng.chance(0.6) ? "Centre-ville" : "Peripherie";
    const type =
      zone === "Centre-ville"
        ? rng.weightedChoice<StoreType>(
            ["Premium", "Standard", "Discount"],
            [0.28, 0.57, 0.15],
          )
        : rng.weightedChoice<StoreType>(["Discount", "Standard"], [0.55, 0.45]);
    blueprints.push({ zone, type });
  }

  return shuffleInPlace(rng, ensureStoreBlueprintRequirements(blueprints, config));
}

export function generateStores(rng: SeededRandom, config: GeneratorConfig) {
  const stores: Store[] = [];
  const blueprints = buildRepresentativeStoreBlueprints(rng, config);

  for (let index = 1; index <= config.storeCount; index += 1) {
    const blueprint = blueprints[index - 1];
    const zone = blueprint.zone;
    const type = blueprint.type;
    const baseSurface = 90;
    const surface =
      type === "Premium"
        ? rng.int(Math.round(baseSurface * 0.55), Math.round(baseSurface * 0.95))
        : type === "Standard"
          ? rng.int(
              zone === "Centre-ville" ? Math.round(baseSurface * 0.95) : 110,
              zone === "Centre-ville" ? 130 : 180,
            )
          : rng.int(zone === "Centre-ville" ? 110 : 150, zone === "Centre-ville" ? 160 : 310);

    const openToClientsHours =
      zone === "Centre-ville"
        ? rng.weightedChoice(["9h/18h", "9h/19h", "9h/20h"], [0.45, 0.35, 0.2])
        : rng.weightedChoice(["9h/18h", "9h/19h", "9h/20h"], [0.1, 0.55, 0.35]);

    const closingHour = Number(openToClientsHours.split("/")[1]?.replace("h", ""));
    const openTime = Math.max(1, closingHour - 9);
    const openDays =
      zone === "Centre-ville"
        ? rng.weightedChoice<Store["openDays"]>(["open 5/7", "open 6/7"], [0.65, 0.35])
        : rng.weightedChoice<Store["openDays"]>(["open 5/7", "open 6/7"], [0.85, 0.15]);

    const specialtyCount =
      type === "Premium" ? 1 : type === "Standard" ? rng.int(2, 4) : rng.int(3, 5);
    const specialtyBrands = rng.sampleUnique(BRANDS, specialtyCount);
    const trafficBase =
      type === "Premium"
        ? surface / (zone === "Centre-ville" ? 7 : 8)
        : type === "Discount"
          ? surface / (zone === "Centre-ville" ? 5.15 : 4.35)
          : surface / 6.1;
    const footTrafficByHour = Math.max(5, Math.round(trafficBase + rng.normal(0, 2)));
    const dailyFootTraffic = footTrafficByHour * openTime;
    const conversionRate =
      type === "Premium"
        ? rng.float(0.2, 0.28)
        : type === "Discount"
          ? rng.float(0.14, 0.19)
          : rng.float(0.16, 0.22);
    const trafficConversion = Math.max(1, Math.round(dailyFootTraffic * conversionRate));
    const avgBasketValue =
      type === "Premium"
        ? rng.int(145, 290)
        : type === "Discount"
          ? rng.int(75, 125)
          : rng.int(100, 180);
    const employeeCount =
      type === "Premium"
        ? Math.max(4, Math.round(surface * 0.04) + 2)
        : type === "Discount"
          ? Math.max(4, Math.round(surface * 0.024) + 2)
          : Math.max(4, Math.round(surface * 0.03) + 2);
    const priceAdjustmentPercent =
      type === "Premium"
        ? rng.weightedChoice([0, 4, 6, 8], [0.2, 0.35, 0.3, 0.15])
        : type === "Discount"
          ? rng.weightedChoice([-11, -10, -9, -8], [0.22, 0.34, 0.28, 0.16])
          : rng.weightedChoice([-2, 0, 2], [0.2, 0.6, 0.2]);
    const microLocationFactor = rng.float(0.94, 1.08, 3);
    const rentM2Month =
      zone === "Centre-ville" ? rng.float(28, 40, 2) : rng.float(12, 18, 2);
    const utilityM2Month =
      zone === "Centre-ville" ? rng.float(2.8, 3.8, 2) : rng.float(2.4, 3.0, 2);
    const energyEfficiencyFactor = rng.float(0.92, 1.08, 3);
    const cardShare =
      type === "Premium"
        ? rng.float(0.8, 0.9, 3)
        : type === "Discount" && zone === "Peripherie"
          ? rng.float(0.55, 0.65, 3)
          : rng.float(0.65, 0.75, 3);
    const acquirerFeeRate = rng.float(0.0045, 0.0075, 4);
    const securityEnabled =
      type === "Premium" ||
      zone === "Centre-ville" ||
      surface > 180 ||
      footTrafficByHour > 55;
    const marketingFloor =
      type === "Premium" ? rng.int(160, 250) : type === "Standard" ? rng.int(110, 180) : rng.int(80, 140);
    const shrinkageRate =
      type === "Premium"
        ? rng.float(0.007, 0.012, 4)
        : type === "Standard"
          ? rng.float(0.004, 0.007, 4)
          : zone === "Peripherie"
            ? rng.float(0.002, 0.004, 4)
            : rng.float(0.004, 0.006, 4);
    const loyaltyRedemptionProb = rng.float(0.6, 0.75, 3);

    stores.push({
      id: `S${String(index).padStart(2, "0")}`,
      zone,
      type,
      surface,
      hyper: surface >= 220 ? "oui" : "non",
      specialtyBrands,
      openToClientsHours,
      openTime,
      openDays,
      footTrafficByHour,
      dailyFootTraffic,
      conversionRate,
      trafficConversion,
      avgBasketValue,
      monthlyRevenueEstimate: Math.round(dailyFootTraffic * conversionRate * avgBasketValue * 30),
      employeeCount,
      priceAdjustmentPercent,
      microLocationFactor,
      rentM2Month,
      utilityM2Month,
      energyEfficiencyFactor,
      cardShare,
      acquirerFeeRate,
      securityEnabled,
      marketingFloor,
      shrinkageRate,
      loyaltyRedemptionProb,
    });
  }

  return stores;
}
