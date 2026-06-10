import type {
  AppliedStorePerformance,
  GeneratorConfig,
  ResolvedStorePerformancePlan,
  Store,
  StorePerformanceInput,
  StorePerformanceModifiers,
  StorePerformanceStatus,
  StoreType,
} from "./types";

const NEUTRAL_MODIFIERS: StorePerformanceModifiers = {
  trafficVisibilityMultiplier: 1,
  conversionExecutionMultiplier: 1,
  basketExecutionMultiplier: 1,
  accessoryExecutionMultiplier: 1,
  sellerEffectMultiplier: 1,
  specialOfferMultiplier: 1,
  monthDiscountMultiplier: 1,
  premiumMixMultiplier: 1,
  frontOfficeEfficiencyShift: 0,
  staffStabilityMultiplier: 1,
  salaryPressureMultiplier: 1,
  fixedCostPressureMultiplier: 1,
  marketingFloorMultiplier: 1,
};

const STATUS_PRESETS: Record<
  StorePerformanceStatus,
  {
    label: string;
    expectedSignals: string[];
    modifiers: StorePerformanceModifiers;
  }
> = {
  superperformant: {
    label: "Superperformant",
    expectedSignals: [
      "trafic bien capte",
      "conversion forte",
      "vente additionnelle forte",
      "equipe stable",
    ],
    modifiers: {
      ...NEUTRAL_MODIFIERS,
      trafficVisibilityMultiplier: 1.08,
      conversionExecutionMultiplier: 1.12,
      basketExecutionMultiplier: 1.1,
      accessoryExecutionMultiplier: 1.12,
      sellerEffectMultiplier: 1.08,
      specialOfferMultiplier: 0.92,
      monthDiscountMultiplier: 0.96,
      staffStabilityMultiplier: 1.08,
      salaryPressureMultiplier: 1.03,
    },
  },
  viable: {
    label: "Viable",
    expectedSignals: [
      "CA solide",
      "productivite correcte",
      "equipe plutot stable",
    ],
    modifiers: {
      ...NEUTRAL_MODIFIERS,
      trafficVisibilityMultiplier: 1.03,
      conversionExecutionMultiplier: 1.05,
      basketExecutionMultiplier: 1.04,
      accessoryExecutionMultiplier: 1.05,
      sellerEffectMultiplier: 1.03,
      specialOfferMultiplier: 0.97,
      monthDiscountMultiplier: 0.99,
      staffStabilityMultiplier: 1.03,
      salaryPressureMultiplier: 1.01,
    },
  },
  neutre: {
    label: "Neutre",
    expectedSignals: ["niveau de performance structurel"],
    modifiers: { ...NEUTRAL_MODIFIERS },
  },
  sous_performant_turnover: {
    label: "Sous-performant turnover",
    expectedSignals: [
      "CA plus faible",
      "equipe plus recente",
      "productivite vendeur plus faible",
      "moins de vente additionnelle",
      "promos defensives plus frequentes",
    ],
    modifiers: {
      ...NEUTRAL_MODIFIERS,
      trafficVisibilityMultiplier: 0.96,
      conversionExecutionMultiplier: 0.72,
      basketExecutionMultiplier: 0.56,
      accessoryExecutionMultiplier: 0.48,
      sellerEffectMultiplier: 0.78,
      specialOfferMultiplier: 1.18,
      monthDiscountMultiplier: 1.08,
      premiumMixMultiplier: 0.86,
      frontOfficeEfficiencyShift: -0.05,
      staffStabilityMultiplier: 0.45,
      salaryPressureMultiplier: 0.94,
      fixedCostPressureMultiplier: 1.02,
      marketingFloorMultiplier: 1.12,
    },
  },
  critique_turnover: {
    label: "Critique turnover",
    expectedSignals: [
      "CA nettement plus faible",
      "equipe tres recente",
      "execution commerciale degradee",
      "vente additionnelle faible",
      "promos defensives et marketing local en hausse",
    ],
    modifiers: {
      ...NEUTRAL_MODIFIERS,
      trafficVisibilityMultiplier: 0.93,
      conversionExecutionMultiplier: 0.52,
      basketExecutionMultiplier: 0.48,
      accessoryExecutionMultiplier: 0.38,
      sellerEffectMultiplier: 0.7,
      specialOfferMultiplier: 1.3,
      monthDiscountMultiplier: 1.12,
      premiumMixMultiplier: 0.82,
      frontOfficeEfficiencyShift: -0.07,
      staffStabilityMultiplier: 0.32,
      salaryPressureMultiplier: 0.91,
      fixedCostPressureMultiplier: 1.04,
      marketingFloorMultiplier: 1.22,
    },
  },
};

function scoreStoreForAutoTarget(store: Store) {
  return store.employeeCount * 1000 + store.surface * 10 + store.dailyFootTraffic;
}

function resolveCompatibleStores(
  stores: Store[],
  input: StorePerformanceInput,
  status: StorePerformanceStatus,
) {
  const targetType = input.storeType;
  const filtered = stores.filter((store) => !targetType || store.type === targetType);

  if (status === "sous_performant_turnover" || status === "critique_turnover") {
    const preferred = filtered.filter(
      (store) => store.type === "Discount" && store.zone === "Peripherie" && store.employeeCount >= 8,
    );
    if (preferred.length > 0) {
      return preferred.sort(
        (left, right) => scoreStoreForAutoTarget(right) - scoreStoreForAutoTarget(left),
      );
    }
  }

  return filtered.sort((left, right) => scoreStoreForAutoTarget(right) - scoreStoreForAutoTarget(left));
}

export function resolveStorePerformancePlan(
  config: GeneratorConfig,
  stores: Store[],
): ResolvedStorePerformancePlan {
  const applied: AppliedStorePerformance[] = [];
  const usedStoreIds = new Set<string>();

  for (const [index, input] of (config.storePerformancePlan ?? []).entries()) {
    const preset = STATUS_PRESETS[input.performanceStatus];
    let targetStore = input.storeId
      ? stores.find(
          (store) =>
            store.id === input.storeId &&
            (!input.storeType || store.type === input.storeType) &&
            !usedStoreIds.has(store.id),
        )
      : undefined;

    if (!targetStore) {
      targetStore = resolveCompatibleStores(stores, input, input.performanceStatus).find(
        (store) => !usedStoreIds.has(store.id),
      );
      if (!targetStore && (input.performanceStatus === "sous_performant_turnover" || input.performanceStatus === "critique_turnover")) {
        targetStore = stores
          .filter((store) => (!input.storeType || store.type === input.storeType) && !usedStoreIds.has(store.id))
          .sort((left, right) => scoreStoreForAutoTarget(right) - scoreStoreForAutoTarget(left))[0];
      }
    }

    if (!targetStore) {
      continue;
    }

    usedStoreIds.add(targetStore.id);
    applied.push({
      inputIndex: index,
      performanceStatus: input.performanceStatus,
      label: preset.label,
      targetStoreId: targetStore.id,
      expectedSignals: preset.expectedSignals,
      activeModifiers: preset.modifiers,
    });
  }

  return { applied };
}

export function performanceModifiersForStore(
  storeId: string,
  resolved: ResolvedStorePerformancePlan | undefined,
) {
  const applied = resolved?.applied.find((entry) => entry.targetStoreId === storeId);
  return applied?.activeModifiers ?? NEUTRAL_MODIFIERS;
}

export function performanceStatusForStore(
  storeId: string,
  resolved: ResolvedStorePerformancePlan | undefined,
) {
  return (
    resolved?.applied.find((entry) => entry.targetStoreId === storeId)?.performanceStatus ??
    "neutre"
  );
}

export function availableStorePerformanceStatuses() {
  return Object.entries(STATUS_PRESETS).map(([value, preset]) => ({
    value: value as StorePerformanceStatus,
    label: preset.label,
  }));
}

export function ensureStoreBlueprintRequirements(
  blueprints: Array<{ zone: Store["zone"]; type: StoreType }>,
  config: GeneratorConfig,
) {
  const requiredDiscountStores = Math.min(
    config.storeCount,
    Math.max(
      1,
      (config.storePerformancePlan ?? []).filter(
        (entry) => !entry.storeType || entry.storeType === "Discount",
      ).length,
    ),
  );

  if (requiredDiscountStores <= 1) {
    return blueprints;
  }

  const currentDiscountPeriphery = blueprints.filter(
    (entry) => entry.type === "Discount" && entry.zone === "Peripherie",
  ).length;

  for (
    let index = currentDiscountPeriphery;
    index < requiredDiscountStores && blueprints.length < config.storeCount;
    index += 1
  ) {
    blueprints.push({ zone: "Peripherie", type: "Discount" });
  }

  while (
    blueprints.filter((entry) => entry.type === "Discount").length < requiredDiscountStores
  ) {
    const replaceIndex = blueprints.findIndex(
      (entry) => entry.type !== "Premium" && entry.type !== "Discount",
    );
    if (replaceIndex === -1) break;
    blueprints[replaceIndex] = { zone: "Peripherie", type: "Discount" };
  }

  return blueprints;
}
