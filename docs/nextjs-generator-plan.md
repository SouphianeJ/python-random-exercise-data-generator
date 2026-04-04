# Next.js Generator Plan

## Goal

Build a site that reproduces the Python generator behavior, while exposing a cleaner and explicit data contract for web use.

## Product Direction

Use Next.js as the main app and reimplement generation logic in TypeScript unless a Python dependency is truly necessary.

Reasoning:

- the current generator is pure business logic plus randomness
- no Python-only ML or heavy scientific requirement is needed for v1
- a native TypeScript implementation makes browser/server integration, validation, downloads, and seed-based reproducibility much easier

Python remains optional for comparison testing during migration, not as the long-term runtime.

## Proposed App Scope

### V1 user flow

1. User opens a generator page
2. User selects generation parameters
3. User clicks generate
4. App generates a dataset on the server
5. User previews summary stats and samples
6. User downloads CSV or JSON exports

### V1 configuration

- random seed
- number of stores
- number of products
- number of customers
- max sale tickets or max sale lines
- output format: normalized or legacy flat CSV

## Canonical Spec

### Output modes

#### Mode 1: canonical

Clean API-first model:

- `stores`
- `employees`
- `products`
- `customers`
- `sales`
- `saleLines`

#### Mode 2: legacy-compatible

CSV exports matching the Python structure as closely as practical:

- `magasins.csv`
- `employes.csv`
- `articles.csv`
- `clients.csv`
- `ventes.csv`
- `ventes_filtre.csv`

For legacy mode, we should decide whether to:

- exactly preserve current defects
- or preserve values while fixing schema defects

Recommended choice:

- preserve value logic
- fix schema defects
- if needed, add a separate "strict legacy quirks" toggle for testing only

### Canonical entities

#### Store

- `id`
- `zone`
- `type`
- `surface`
- `isHyper`
- `specialtyBrands: string[]`
- `openHoursLabel`
- `openDurationHours`
- `openDaysLabel`
- `footTrafficPerHour`
- `dailyFootTraffic`
- `conversionRate`
- `trafficConversion`
- `avgBasketValue`
- `monthlyRevenueEstimate`
- `employeeCount`

#### Employee

- `id`
- `fullName`
- `storeId`
- `profile`
- `conversionRate`
- `salaryMonthly`
- `tenureMonths`
- `hireDate`
- `role`
- `averageDayTimeBackoffice`
- `averageDayTimeFrontoffice`

#### Product

- `id`
- `kind: shoe | goodies`
- `brand`
- `model`
- `category`
- `color`
- `size`
- `basePrice`
- `isBestSeller`

#### Customer

- `id`
- `gender`
- `age`
- `profile`
- `favoriteBrand`
- `hasLoyaltyCard`
- `loyaltyPoints`

#### Sale

- `id`
- `storeId`
- `employeeId`
- `customerId`
- `saleDate`
- `saleTime`
- `yearMonth`
- `lineCount`
- `subtotal`
- `totalDiscountApplied`
- `totalPaid`

#### SaleLine

- `id`
- `saleId`
- `lineType: product | goodies`
- `productId`
- `brand`
- `category`
- `model`
- `color`
- `size`
- `basePrice`
- `priceSold`
- `isBestSeller`
- `storeAdjustmentPercent`
- `discountMonthValue`
- `discountProfileValue`
- `discountFidelityValue`
- `totalDiscountApplied`
- `economisePercent`

## Implementation Plan

### Phase 1: extract and freeze contract

- keep the analysis docs in `docs/`
- add one or more checked-in lightweight fixture exports
- document known generator defects and intended fixes

### Phase 2: build generator core in TypeScript

- create deterministic seeded RNG utilities
- port stores generation
- port employees generation
- port products generation
- port customers generation
- port sales and sale-lines generation
- add post-processing for monthly revenue

### Phase 3: verification

- compare TypeScript output distributions against Python output
- snapshot column names and value domains
- assert referential integrity
- assert deterministic output for a fixed seed

### Phase 4: web UI

- generator form
- dataset summary cards
- preview tables
- export buttons

## Technical Spec

### Stack

- Next.js App Router
- TypeScript
- server actions or route handlers for generation
- `zod` for schema validation
- `papaparse` or equivalent for CSV export
- deterministic RNG package or local seeded PRNG utility

### Project structure

- `src/lib/generator/config.ts`
- `src/lib/generator/random.ts`
- `src/lib/generator/domain.ts`
- `src/lib/generator/generate-stores.ts`
- `src/lib/generator/generate-employees.ts`
- `src/lib/generator/generate-products.ts`
- `src/lib/generator/generate-customers.ts`
- `src/lib/generator/generate-sales.ts`
- `src/lib/generator/export-legacy.ts`
- `src/lib/generator/export-canonical.ts`
- `src/app/page.tsx`
- `src/app/api/generate/route.ts`

## Verification Rules

The TypeScript generator should satisfy:

- deterministic for same seed and same config
- all FK links valid
- no accidental null columns
- unique `sale.id`
- unique `saleLine.id`
- legacy exports use stable ordered columns
- canonical arrays use real JSON arrays, never Python-list strings

## Immediate Next Coding Step

Start the Next.js app and implement the generator core first, not the UI first.

Order:

1. bootstrap Next.js project
2. define schemas and config
3. implement seeded RNG
4. port stores, employees, products, customers
5. port sales as `sales + saleLines`
6. add CSV export adapters
7. add a minimal UI for generate and download
