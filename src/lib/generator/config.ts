import { z } from "zod";

import type { GeneratorConfig } from "./types";

const configSchema = z
  .object({
    seed: z.coerce.number().int().min(1).max(999999999),
    year: z.coerce.number().int().min(2020).max(2035).default(2024),
    storeCount: z.coerce.number().int().min(1).max(20).default(5),
    productCount: z.coerce.number().int().min(12).max(300).default(100),
    customerCount: z.coerce.number().int().min(40).max(10000).default(1000),
    targetSaleCount: z.coerce.number().int().min(1).max(10000).optional(),
    targetSaleLineCount: z.coerce.number().int().min(1).max(15000).optional(),
    exportMode: z
      .enum(["canonical-json", "legacy-compatible-clean"])
      .default("legacy-compatible-clean"),
    includeAccessories: z.coerce.boolean().default(true),
    includeInterns: z.coerce.boolean().default(true),
    examScenario: z
      .enum([
        "none",
        "underperforming_sales_execution",
        "understaffed_store",
        "promo_dependency",
        "premium_low_traffic",
        "discount_volume_winner",
      ])
      .default("none"),
    examScenarioStoreId: z.string().regex(/^S\d{2}$/).optional(),
    examScenarioStrength: z.enum(["light", "medium", "strong"]).default("medium"),
  })
  .superRefine((config, ctx) => {
    const hasSaleCount = typeof config.targetSaleCount === "number";
    const hasLineCount = typeof config.targetSaleLineCount === "number";

    if (!hasSaleCount && !hasLineCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetSaleCount"],
        message: "Provide targetSaleCount or targetSaleLineCount.",
      });
    }

    if (hasSaleCount && hasLineCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetSaleLineCount"],
        message: "Choose one target metric: targetSaleCount or targetSaleLineCount.",
      });
    }
  });

export function parseConfig(input: unknown): GeneratorConfig {
  return configSchema.parse(input);
}

export const defaultConfig: GeneratorConfig = {
  seed: 32,
  year: 2024,
  storeCount: 5,
  productCount: 100,
  customerCount: 1000,
  targetSaleLineCount: 1500,
  exportMode: "legacy-compatible-clean",
  includeAccessories: true,
  includeInterns: true,
  examScenario: "none",
  examScenarioStrength: "medium",
};
