export type StoreType = "Premium" | "Standard" | "Discount";
export type Zone = "Centre-ville" | "Peripherie";
export type StorePerformanceStatus =
  | "superperformant"
  | "viable"
  | "neutre"
  | "sous_performant_turnover"
  | "critique_turnover";
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
  includeAccessories: boolean;
  includeInterns: boolean;
  storePerformancePlan?: StorePerformanceInput[];
}

export interface StorePerformanceInput {
  storeId?: string;
  storeType?: StoreType;
  performanceStatus: StorePerformanceStatus;
}

export interface StorePerformanceModifiers {
  trafficVisibilityMultiplier: number;
  conversionExecutionMultiplier: number;
  basketExecutionMultiplier: number;
  accessoryExecutionMultiplier: number;
  sellerEffectMultiplier: number;
  specialOfferMultiplier: number;
  monthDiscountMultiplier: number;
  premiumMixMultiplier: number;
  frontOfficeEfficiencyShift: number;
  staffStabilityMultiplier: number;
  salaryPressureMultiplier: number;
  fixedCostPressureMultiplier: number;
  marketingFloorMultiplier: number;
}

export interface AppliedStorePerformance {
  inputIndex: number;
  performanceStatus: StorePerformanceStatus;
  label: string;
  targetStoreId: string;
  expectedSignals: string[];
  activeModifiers: StorePerformanceModifiers;
}

export interface ResolvedStorePerformancePlan {
  applied: AppliedStorePerformance[];
}

export interface StoreMonthlyVolumePlan {
  storeId: string;
  yearMonth: string;
  month: number;
  expectedDailyVisitors: number;
  expectedDailyTickets: number;
  expectedMonthlyTickets: number;
  expectedAvgLinesPerTicket: number;
  expectedAvgTicketTtc: number;
  expectedMonthlyRevenue: number;
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
  microLocationFactor: number;
  rentM2Month: number;
  utilityM2Month: number;
  energyEfficiencyFactor: number;
  cardShare: number;
  acquirerFeeRate: number;
  securityEnabled: boolean;
  marketingFloor: number;
  shrinkageRate: number;
  loyaltyRedemptionProb: number;
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
  endDate: string | null;
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
  specialOfferDiscount: number;
  discountValueFidelity: number;
  totalDiscountApplied: number;
  percentSaved: number;
  tvaRate: number;
  priceHt: number;
  tvaAmount: number;
  loyaltyDiscountTtc: number;
  grossPriceTtcBeforeLoyalty: number;
}

export interface StoreMonthCost {
  yearMonth: string;
  storeId: string;
  rentMonth: number;
  serviceCharges: number;
  utilities: number;
  cleaning: number;
  insurance: number;
  maintenance: number;
  softwareIt: number;
  security: number;
  grossPayroll: number;
  employerContrib: number;
  paymentFees: number;
  localMarketing: number;
  shrinkage: number;
  cfeMonth: number;
  loyaltyFutureCost: number;
  loyaltyDiscountTtc: number;
  totalStoreCost: number;
  caTtc: number;
  caHt: number;
  nbLines: number;
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
    storeMonthCosts: number;
  };
  monthlyRevenueTotals: Array<{
    storeId: string;
    yearMonth: string;
    totalPaid: number;
  }>;
  validationResults: ValidationIssue[];
  anomalyCount: number;
  warnings: string[];
  storePerformanceApplied: AppliedStorePerformance[];
}

export interface GeneratedDataset {
  config: GeneratorConfig;
  stores: Store[];
  employees: Employee[];
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  saleLines: SaleLine[];
  storeMonthCosts: StoreMonthCost[];
  storeMonthlyVolumePlan: StoreMonthlyVolumePlan[];
  summary: GeneratedDatasetSummary;
  storePerformanceApplied: AppliedStorePerformance[];
}
