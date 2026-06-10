import type { EmployeeRole, StoreType } from "./types";

export const TVA_RATE = 0.2;

// Loyalty program: 10 points = 1 EUR at redemption. Redemption and cost
// provisioning must use the same exchange rate.
export const LOYALTY_POINT_VALUE_EUR = 0.1;
export const LOYALTY_EARN_POINTS_PER_EUR = 0.1;
export const LOYALTY_MIN_POINTS_TO_REDEEM = 100;
export const LOYALTY_MAX_REDEEM_SHARE = 0.3;

export const MARKETING_RATE_BY_STORE_TYPE: Record<StoreType, number> = {
  Premium: 0.012,
  Standard: 0.007,
  Discount: 0.004,
};

export const EMPLOYER_RATE_BY_ROLE: Record<EmployeeRole, number> = {
  Apprentice: 0.13,
  Sales: 0.3,
  Support: 0.33,
  Manager: 0.39,
};
