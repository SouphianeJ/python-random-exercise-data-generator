import { z } from "zod";

import type { GeneratorConfig } from "./types";

// Query-string transports send booleans as "true"/"false" strings, which
// Boolean() would both coerce to true. Missing params arrive as null and
// must fall back to the default instead of false.
function booleanParam(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (value === null || value === undefined || value === "") return undefined;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value === "true" || value === "1";
    return Boolean(value);
  }, z.boolean().default(defaultValue));
}

const configSchema = z
  .object({
    seed: z.coerce.number().int().min(1).max(999999999),
    year: z.coerce.number().int().min(2020).max(2035).default(2024),
    storeCount: z.coerce.number().int().min(1).max(20).default(5),
    productCount: z.coerce.number().int().min(12).max(300).default(100),
    customerCount: z.coerce.number().int().min(40).max(10000).default(1000),
    includeAccessories: booleanParam(true),
    includeInterns: booleanParam(true),
    storePerformancePlan: z
      .array(
        z.object({
          storeId: z.string().regex(/^S\d{2}$/).optional(),
          storeType: z.enum(["Premium", "Standard", "Discount"]).optional(),
          performanceStatus: z.enum([
            "superperformant",
            "viable",
            "neutre",
            "sous_performant_turnover",
            "critique_turnover",
          ]),
        }),
      )
      .max(20)
      .optional()
      .default([]),
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
  includeAccessories: true,
  includeInterns: true,
  storePerformancePlan: [],
};
