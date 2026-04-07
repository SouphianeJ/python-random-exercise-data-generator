import type {
  ExamScenarioPresetId,
  ExamScenarioStrength,
  GeneratorConfig,
  ResolvedExamScenario,
  ScenarioDriverModifiers,
  Store,
} from "./types";

const NEUTRAL_MODIFIERS: ScenarioDriverModifiers = {
  trafficMultiplier: 1,
  conversionMultiplier: 1,
  basketLineMultiplier: 1,
  accessoryAttachMultiplier: 1,
  specialOfferMultiplier: 1,
  monthDiscountMultiplier: 1,
  premiumMixMultiplier: 1,
  sellerEffectMultiplier: 1,
  frontOfficeEfficiencyShift: 0,
  openingHoursDelta: 0,
  fixedCostPressureMultiplier: 1,
  marketingFloorMultiplier: 1,
};

const SCENARIO_PRESETS: Record<
  ExamScenarioPresetId,
  {
    label: string;
    expectedSignals: string[];
    modifiers: Partial<ScenarioDriverModifiers>;
    compatibleStore: (store: Store) => boolean;
  }
> = {
  underperforming_sales_execution: {
    label: "Sous-performance commerciale",
    expectedSignals: [
      "CA plus faible",
      "panier moyen plus faible",
      "moins de tickets multi-articles",
      "moins d'accessoires",
      "equipe plus recente et moins stable",
      "vendeurs moins performants",
    ],
    modifiers: {
      trafficMultiplier: 0.84,
      conversionMultiplier: 0.78,
      basketLineMultiplier: 0.56,
      accessoryAttachMultiplier: 0.48,
      sellerEffectMultiplier: 0.78,
      premiumMixMultiplier: 0.86,
    },
    compatibleStore: (store) =>
      store.type === "Discount" && store.zone === "Peripherie" && store.employeeCount >= 8,
  },
  understaffed_store: {
    label: "Sous-effectif commercial",
    expectedSignals: [
      "trafic correct",
      "CA sous potentiel",
      "moins de conversion",
      "moins de multi-achat",
      "efficacite commerciale degradee",
    ],
    modifiers: {
      trafficMultiplier: 0.97,
      conversionMultiplier: 0.9,
      basketLineMultiplier: 0.87,
      accessoryAttachMultiplier: 0.8,
      frontOfficeEfficiencyShift: -0.06,
      openingHoursDelta: 0,
    },
    compatibleStore: () => true,
  },
  promo_dependency: {
    label: "Dependance promotionnelle",
    expectedSignals: [
      "remises plus elevees",
      "rentabilite plus faible",
      "CA pas forcement mauvais",
      "pression promo visible",
    ],
    modifiers: {
      conversionMultiplier: 1.04,
      basketLineMultiplier: 1.02,
      specialOfferMultiplier: 1.55,
      monthDiscountMultiplier: 1.28,
      premiumMixMultiplier: 0.95,
    },
    compatibleStore: () => true,
  },
  premium_low_traffic: {
    label: "Premium sous-traffique",
    expectedSignals: [
      "bon panier moyen",
      "peu de tickets",
      "charges fixes elevees",
      "rentabilite sous pression",
    ],
    modifiers: {
      trafficMultiplier: 0.84,
      conversionMultiplier: 0.96,
      basketLineMultiplier: 1,
      accessoryAttachMultiplier: 1.05,
      fixedCostPressureMultiplier: 1.08,
    },
    compatibleStore: (store) => store.type === "Premium",
  },
  discount_volume_winner: {
    label: "Discount gagnant par volume",
    expectedSignals: [
      "beaucoup de tickets",
      "CA fort par volume",
      "plus de lignes de tickets",
      "levier volume visible",
    ],
    modifiers: {
      trafficMultiplier: 1.16,
      conversionMultiplier: 1.08,
      basketLineMultiplier: 1.28,
      accessoryAttachMultiplier: 1.18,
      sellerEffectMultiplier: 1.1,
    },
    compatibleStore: (store) => store.type === "Discount",
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function scaleMultiplier(base: number, strength: ExamScenarioStrength) {
  const factor = strength === "light" ? 0.55 : strength === "strong" ? 1.35 : 1;
  const scaled = 1 + (base - 1) * factor;
  return scaled;
}

function resolveOpeningHoursDelta(
  base: ScenarioDriverModifiers["openingHoursDelta"],
  strength: ExamScenarioStrength,
): ScenarioDriverModifiers["openingHoursDelta"] {
  if (strength === "light") return 0;
  if (base >= 1) return 1;
  if (base <= -1) return -1;
  return 0;
}

function resolveModifiers(
  partial: Partial<ScenarioDriverModifiers>,
  strength: ExamScenarioStrength,
): ScenarioDriverModifiers {
  const merged = { ...NEUTRAL_MODIFIERS, ...partial };
  return {
    trafficMultiplier: clamp(scaleMultiplier(merged.trafficMultiplier, strength), 0.82, 1.18),
    conversionMultiplier: clamp(scaleMultiplier(merged.conversionMultiplier, strength), 0.85, 1.15),
    basketLineMultiplier: clamp(scaleMultiplier(merged.basketLineMultiplier, strength), 0.75, 1.3),
    accessoryAttachMultiplier: clamp(
      scaleMultiplier(merged.accessoryAttachMultiplier, strength),
      0.55,
      1.5,
    ),
    specialOfferMultiplier: clamp(
      scaleMultiplier(merged.specialOfferMultiplier, strength),
      0.7,
      1.8,
    ),
    monthDiscountMultiplier: clamp(scaleMultiplier(merged.monthDiscountMultiplier, strength), 0.8, 1.4),
    premiumMixMultiplier: clamp(scaleMultiplier(merged.premiumMixMultiplier, strength), 0.75, 1.3),
    sellerEffectMultiplier: clamp(scaleMultiplier(merged.sellerEffectMultiplier, strength), 0.82, 1.18),
    frontOfficeEfficiencyShift: clamp(
      merged.frontOfficeEfficiencyShift *
        (strength === "light" ? 0.55 : strength === "strong" ? 1.35 : 1),
      -0.08,
      0.08,
    ),
    openingHoursDelta: resolveOpeningHoursDelta(merged.openingHoursDelta, strength),
    fixedCostPressureMultiplier: clamp(
      scaleMultiplier(merged.fixedCostPressureMultiplier, strength),
      1,
      1.15,
    ),
    marketingFloorMultiplier: clamp(
      scaleMultiplier(merged.marketingFloorMultiplier, strength),
      0.8,
      1.4,
    ),
  };
}

function compatibleStoresForScenario(presetId: ExamScenarioPresetId, stores: Store[]) {
  return stores.filter(SCENARIO_PRESETS[presetId].compatibleStore);
}

export function resolveExamScenario(
  config: GeneratorConfig,
  stores: Store[],
): ResolvedExamScenario | undefined {
  if (!config.examScenario || config.examScenario === "none") {
    return undefined;
  }

  const preset = SCENARIO_PRESETS[config.examScenario];
  const strength = config.examScenarioStrength ?? "medium";
  const compatibleStores = compatibleStoresForScenario(config.examScenario, stores);
  const fallbackTarget = compatibleStores[0];
  if (!fallbackTarget) {
    return undefined;
  }

  const targetStore =
    stores.find(
      (store) =>
        store.id === config.examScenarioStoreId && preset.compatibleStore(store),
    ) ??
    (config.examScenario === "underperforming_sales_execution"
      ? [...compatibleStores].sort((left, right) => right.employeeCount - left.employeeCount)[0]
      : fallbackTarget);

  return {
    presetId: config.examScenario,
    label: preset.label,
    strength,
    targetStoreId: targetStore.id,
    expectedSignals: preset.expectedSignals,
    activeModifiers: resolveModifiers(preset.modifiers, strength),
  };
}

export function applyScenarioToStores(stores: Store[], scenario?: ResolvedExamScenario) {
  if (!scenario) return stores;

  return stores.map((store) => {
    if (store.id !== scenario.targetStoreId) {
      return store;
    }

    const modifiers = scenario.activeModifiers;
    const openingHour = Math.min(20, Math.max(18, 9 + store.openTime + modifiers.openingHoursDelta));
    const openTime = Math.max(1, openingHour - 9);
    const openToClientsHours = `9h/${openingHour}h`;

    return {
      ...store,
      openTime,
      openToClientsHours,
      marketingFloor: Math.round(store.marketingFloor * modifiers.marketingFloorMultiplier),
      dailyFootTraffic: Math.max(1, Math.round(store.footTrafficByHour * openTime)),
    };
  });
}

export function modifiersForStore(storeId: string, scenario?: ResolvedExamScenario): ScenarioDriverModifiers {
  if (!scenario || scenario.targetStoreId !== storeId) {
    return NEUTRAL_MODIFIERS;
  }
  return scenario.activeModifiers;
}

export function availableExamScenarioOptions() {
  return [
    { value: "none", label: "Aucun scenario" },
    ...Object.entries(SCENARIO_PRESETS).map(([value, preset]) => ({
      value,
      label: preset.label,
    })),
  ];
}
