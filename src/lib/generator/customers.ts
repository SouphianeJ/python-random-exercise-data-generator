import { BRANDS, CUSTOMER_PROFILES } from "./constants";
import { SeededRandom } from "./random";
import type { Customer, GeneratorConfig } from "./types";
import { realisticAge } from "./utils";

export function generateCustomers(rng: SeededRandom, config: GeneratorConfig) {
  const customers: Customer[] = [];

  for (let index = 1; index <= config.customerCount; index += 1) {
    const profile = rng.choice(CUSTOMER_PROFILES);
    const hasLoyaltyCard =
      profile === "sneakerhead"
        ? rng.chance(0.88)
        : profile === "fidele_marque"
          ? rng.chance(0.8)
          : profile === "chasseur_de_promos"
            ? rng.chance(0.72)
            : rng.chance(0.42);
    const favoriteBrand = profile === "fidele_marque" ? rng.choice(BRANDS) : null;
    const basePoints = hasLoyaltyCard ? rng.int(0, 220) : 0;
    const loyaltyPoints = profile === "chasseur_de_promos" ? basePoints + 120 : basePoints;

    customers.push({
      id: `C${String(index).padStart(4, "0")}`,
      gender: rng.choice(["M", "F"]),
      age: realisticAge(rng),
      profile,
      favoriteBrand,
      hasLoyaltyCard,
      loyaltyPoints,
    });
  }

  return customers;
}
