import type { Product, Store } from "./types";
import { roundCurrency } from "./utils";

export function discountStorePriceRelief(store: Store, productKind: Product["kind"]) {
  if (store.type !== "Discount") return 0;
  if (productKind === "accessory") return 0.02;
  return store.zone === "Peripherie" ? 0.045 : 0.035;
}

export function normalizeDiscountShoePrice(
  store: Store,
  product: Product,
  adjustedBasePrice: number,
) {
  if (store.type !== "Discount" || product.kind !== "shoe") {
    return adjustedBasePrice;
  }

  const categoryAnchor =
    product.category === "Limited Edition"
      ? store.zone === "Peripherie"
        ? 148
        : 154
      : product.category === "Basketball"
        ? store.zone === "Peripherie"
          ? 112
          : 116
        : product.category === "Running"
          ? store.zone === "Peripherie"
            ? 104
            : 108
          : product.category === "Trail"
            ? store.zone === "Peripherie"
              ? 106
              : 110
            : product.category === "Training"
              ? store.zone === "Peripherie"
                ? 101
                : 105
              : store.zone === "Peripherie"
                ? 99
                : 103;
  const compressed = roundCurrency(categoryAnchor + (adjustedBasePrice - categoryAnchor) * 0.34);
  const minBound = categoryAnchor - 12;
  const maxBound = categoryAnchor + 12;
  return roundCurrency(Math.max(minBound, Math.min(maxBound, compressed)));
}

export function adjustedLinePrice(store: Store, product: Product) {
  return normalizeDiscountShoePrice(
    store,
    product,
    roundCurrency(
      product.basePrice *
        (1 + store.priceAdjustmentPercent / 100) *
        (1 - discountStorePriceRelief(store, product.kind)),
    ),
  );
}
