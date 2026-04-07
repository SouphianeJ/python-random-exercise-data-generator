# TVA And Shop Charges Model

This document captures the implemented accounting layer added on the `shop-charges` branch.

## Sales-line VAT

For all `shoe` and `accessory` lines:

- `price_sold` is treated as TTC
- `tva_rate = 0.20`
- `price_ht = round(price_sold / 1.20, 2)`
- `tva_amount = round(price_sold - price_ht, 2)`

Added line-level fields:

- `tva_rate`
- `price_ht`
- `tva_amount`
- `loyalty_discount_ttc`
- `gross_price_ttc_before_loyalty`

## Store-month cost engine

New dataset:

- `storeMonthCosts`
- export file: `store_month_costs.csv`

Each row is one `store_id + year_month`.

### Fixed shop parameters

Stable per store:

- `microLocationFactor`
- `rentM2Month`
- `utilityM2Month`
- `energyEfficiencyFactor`
- `cardShare`
- `acquirerFeeRate`
- `securityEnabled`
- `marketingFloor`
- `shrinkageRate`
- `loyaltyRedemptionProb`

### Fixed charges

- `rent_month`
- `service_charges`
- `utilities`
- `cleaning`
- `insurance`
- `maintenance`
- `software_it`
- `security`
- `cfe_month`

Utilities vary with:

- surface
- opening duration
- open days
- season
- store efficiency factor

Rent does not vary month-to-month for a given store.

### Payroll and employer costs

Monthly payroll is computed from employees attached to the store:

- `gross_payroll`
- `employer_contrib`

Employer contribution rate depends on:

- `job_role`
- salary band

### Variable charges

- `payment_fees`
- `local_marketing`
- `shrinkage`
- `loyalty_future_cost`
- `loyalty_discount_ttc`

Variable charges are driven by:

- `ca_ttc`
- `ca_ht`
- card share
- acquiring fee
- marketing rate by store type
- shrinkage rate by store exposure
- loyalty points earned and redeemed

## Exported columns in `store_month_costs.csv`

- `year_month`
- `store_id`
- `rent_month`
- `service_charges`
- `utilities`
- `cleaning`
- `insurance`
- `maintenance`
- `software_it`
- `security`
- `gross_payroll`
- `employer_contrib`
- `payment_fees`
- `local_marketing`
- `shrinkage`
- `cfe_month`
- `loyalty_future_cost`
- `loyalty_discount_ttc`
- `total_store_cost`
- `ca_ttc`
- `ca_ht`
- `nb_lines`

## Verification coverage

Tests now verify:

- VAT fields are mathematically coherent at line level
- `price_ht + tva_amount ~= price_sold`
- `store_month_costs.ca_ttc` matches aggregated line totals
- `store_month_costs.ca_ht` matches aggregated HT totals
- `nb_lines` matches aggregated line count
- `total_store_cost` is at least larger than payroll alone
