export type ExportMode = "canonical-json" | "legacy-compatible-clean";

export type StoreType = "Premium" | "Standard" | "Discount";
export type Zone = "Centre-ville" | "Peripherie";
export type EmployeeProfile =
  | "Requin"
  | "Experimente"
  | "JeunePrometteur"
  | "Stagiaire"
  | "Blase";
export type EmployeeRole = "Manager" | "Sales" | "Support" | "Apprentice";
export type CustomerProfile =
  | "sneakerhead"
  | "impulsif"
  | "chasseur_de_promos"
  | "fidele_marque";
export type ProductKind = "shoe" | "accessory";

export interface GeneratorConfig {
  seed: number;
  year: number;
  storeCount: number;
  productCount: number;
  customerCount: number;
  targetSaleCount?: number;
  targetSaleLineCount?: number;
  exportMode: ExportMode;
  includeAccessories: boolean;
  includeInterns: boolean;
}

export interface Store {
  id: string;
  zone: Zone;
  type: StoreType;
  surface: number;
  hyper: "oui" | "non";
  specialtyBrands: string[];
  openToClientsHours: string;
  openTime: number;
  openDays: "open 5/7" | "open 6/7";
  footTrafficByHour: number;
  dailyFootTraffic: number;
  conversionRate: number;
  trafficConversion: number;
  avgBasketValue: number;
  monthlyRevenueEstimate: number;
  employeeCount: number;
  priceAdjustmentPercent: number;
}

export interface Employee {
  id: string;
  fullName: string;
  storeId: string;
  profile: EmployeeProfile;
  role: EmployeeRole;
  conversionRate: number;
  salaryMonthly: number;
  salaryHourly: number;
  hireDate: string;
  tenureMonths: number;
  workRatioBackoffice: number;
  workRatioFrontoffice: number;
  salesWeight: number;
}

export interface Product {
  id: string;
  legacyId: string;
  kind: ProductKind;
  brand: string;
  model: string;
  category: string;
  color: string;
  size: string;
  basePrice: number;
  isBestSeller: boolean;
}

export interface Customer {
  id: string;
  gender: "M" | "F";
  age: number;
  profile: CustomerProfile;
  favoriteBrand: string | null;
  hasLoyaltyCard: boolean;
  loyaltyPoints: number;
}

export interface Sale {
  id: string;
  storeId: string;
  employeeId: string;
  customerId: string;
  date: string;
  time: string;
  yearMonth: string;
  loyaltyPointsUsed: number;
  loyaltyPointsEarned: number;
  subtotalBeforeLoyalty: number;
  totalDiscountApplied: number;
  totalPaid: number;
  lineCount: number;
}

export interface SaleLine {
  id: string;
  saleId: string;
  storeId: string;
  employeeId: string;
  customerId: string;
  productId: string;
  legacyProductId: string;
  productKind: ProductKind;
  date: string;
  time: string;
  yearMonth: string;
  basePrice: number;
  adjustedBasePrice: number;
  priceSold: number;
  isBestSeller: boolean;
  brand: string;
  category: string;
  model: string;
  color: string;
  size: string;
  storeAdjustmentPercent: number;
  discountValueMonth: number;
  discountAppliedProfile: number;
  discountValueFidelity: number;
  totalDiscountApplied: number;
  percentSaved: number;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface GeneratedDatasetSummary {
  counts: {
    stores: number;
    employees: number;
    products: number;
    customers: number;
    sales: number;
    saleLines: number;
  };
  monthlyRevenueTotals: Array<{
    storeId: string;
    yearMonth: string;
    totalPaid: number;
  }>;
  validationResults: ValidationIssue[];
  anomalyCount: number;
  warnings: string[];
}

export interface GeneratedDataset {
  config: GeneratorConfig;
  stores: Store[];
  employees: Employee[];
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  saleLines: SaleLine[];
  summary: GeneratedDatasetSummary;
}
