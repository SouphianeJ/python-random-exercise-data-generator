import type { CustomerProfile, EmployeeProfile, StoreType } from "./types";

export const BRANDS = [
  "Nike",
  "Adidas",
  "Puma",
  "Reebok",
  "Asics",
  "New Balance",
  "Jordans",
] as const;

export const SHOE_CATEGORIES = [
  "Running",
  "Basketball",
  "Training",
  "Casual",
  "Trail",
  "Limited Edition",
] as const;

export const ACCESSORY_CATEGORIES = [
  "Lacets",
  "Bonnet",
  "Chaussettes",
  "Sac de sport",
  "Casquette",
  "Tee-shirt",
] as const;

export const COLORS = [
  "Red Blood",
  "Deep Blue",
  "Electric Blue",
  "Black",
  "Premium Black",
  "White",
  "Light Green",
  "Sunny Yellow",
  "Classic Grey",
  "Brown Bear",
  "Deep Purple",
  "Pink",
  "Gold",
] as const;

export const SHOE_SIZES = [
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
] as const;

export const ACCESSORY_SIZES = ["XS", "S", "M", "L", "XL"] as const;
export const MODELS = ["Pro", "Air", "Max", "Flex", "Elite", "Zoom"] as const;

export const MONTH_FACTORS: Record<number, number> = {
  1: 0.82,
  2: 0.9,
  3: 1,
  4: 1.08,
  5: 1.03,
  6: 1,
  7: 0.92,
  8: 0.96,
  9: 1.1,
  10: 1.18,
  11: 1.28,
  12: 1.48,
};

export const CUSTOMER_PROFILES: CustomerProfile[] = [
  "sneakerhead",
  "impulsif",
  "chasseur_de_promos",
  "fidele_marque",
];

export const EMPLOYEE_PROFILES: EmployeeProfile[] = [
  "Requin",
  "Experimente",
  "JeunePrometteur",
  "Stagiaire",
  "Blase",
];

export const STORE_TYPES: StoreType[] = ["Premium", "Standard", "Discount"];
