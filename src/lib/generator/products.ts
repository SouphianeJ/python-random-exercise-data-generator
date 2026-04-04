import {
  ACCESSORY_CATEGORIES,
  ACCESSORY_SIZES,
  BRANDS,
  COLORS,
  MODELS,
  SHOE_CATEGORIES,
  SHOE_SIZES,
} from "./constants";
import { SeededRandom } from "./random";
import type { GeneratorConfig, Product } from "./types";
import { roundCurrency } from "./utils";

export function generateProducts(rng: SeededRandom, config: GeneratorConfig) {
  const products: Product[] = [];
  const seen = new Set<string>();
  const accessoryTarget = config.includeAccessories ? Math.max(4, Math.floor(config.productCount * 0.12)) : 0;
  const shoeTarget = Math.max(1, config.productCount - accessoryTarget);
  let productIndex = 1;

  while (products.length < shoeTarget) {
    const brand = rng.choice(BRANDS);
    const model = rng.choice(MODELS);
    const category = rng.choice(SHOE_CATEGORIES);
    const color = rng.choice(COLORS);
    const size = rng.choice(SHOE_SIZES);
    const isBestSeller = rng.chance(0.15);
    const cacheKey = `${brand}:${model}:${category}:${size}:${isBestSeller ? "1" : "0"}`;
    if (seen.has(cacheKey)) continue;
    seen.add(cacheKey);

    let basePrice =
      category === "Limited Edition"
        ? rng.choice([190, 195, 200, 215, 229, 249, 255, 259])
        : rng.choice([60, 79, 85, 110, 129, 139, 145, 159, 169]);
    if (size < "36") basePrice -= 25;
    if (color === "Premium Black" || color === "Gold") basePrice += 20;
    if (isBestSeller) basePrice = roundCurrency(basePrice * 1.08);

    products.push({
      id: `product-${productIndex}`,
      legacyId: `P${String(productIndex).padStart(3, "0")}`,
      kind: "shoe",
      brand,
      model,
      category,
      color,
      size,
      basePrice: roundCurrency(basePrice),
      isBestSeller,
    });
    productIndex += 1;
  }

  let accessoryIndex = 1;
  while (products.length < config.productCount) {
    const category = rng.choice(ACCESSORY_CATEGORIES);
    const model = category;
    const size = rng.choice(ACCESSORY_SIZES);
    const color = rng.choice(["Black", "White", "Classic Grey", "Deep Blue"]);
    const key = `accessory:${category}:${size}:${color}`;
    if (seen.has(key)) continue;
    seen.add(key);

    products.push({
      id: `accessory-${accessoryIndex}`,
      legacyId: `A${String(accessoryIndex).padStart(3, "0")}`,
      kind: "accessory",
      brand: "Accessoire",
      model,
      category,
      color,
      size,
      basePrice: rng.choice([10, 15, 20, 25, 30, 35, 40]),
      isBestSeller: false,
    });
    accessoryIndex += 1;
  }

  return products;
}
