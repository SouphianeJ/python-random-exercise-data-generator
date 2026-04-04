# Generator Contract Analysis

## Scope

Source generator: `data_generator_ultime4.py`

The script exports 6 CSV files:

- `magasins.csv`
- `employes.csv`
- `articles.csv`
- `clients.csv`
- `ventes.csv`
- `ventes_filtre.csv`

The current repo was patched for lightweight inspection:

- stores reduced to `3`
- products reduced to `40`
- customers reduced to `300`
- sales hard-capped to `1000`

This keeps the output small enough to inspect while preserving the actual column contract.

## Export Format

Common CSV settings:

- delimiter: `;`
- decimal separator: `,`
- encoding: `utf-8-sig`
- header row included

## Top-Level Entity Shapes

### `magasins.csv`

Observed columns:

- `store_id`
- `zone`
- `type`
- `surface`
- `hyper`
- `specialty_brands`
- `open_time`
- `open_to_clients_hours`
- `open_days`
- `foot_traffic_by_hour`
- `daily_foot_traffic`
- `conversion_rate`
- `traffic_conversion`
- `avg_basket_value`
- `monthly_revenue_est`
- `num_employees`

Contract notes:

- `store_id` format: `S01`
- `specialty_brands` is exported as a Python-list string, not JSON
- `hyper` values observed: `oui|non`
- `type` values observed in code: `Premium|Discount|Standard`

### `employes.csv`

Observed columns:

- `employee_id`
- `nom_complet`
- `store_id`
- `profile`
- `conversion_rate`
- `salary`
- `anciennete_mois`
- `hire_date`
- `role`
- `average_day_time_backoffice`
- `average_day_time_frontoffice`

Contract notes:

- `employee_id` format: `E0001`
- foreign key: `store_id -> magasins.store_id`
- `hire_date` format: `YYYY-MM-DD`
- `profile` values from code: `Requin`, `Expérimenté`, `Jeune prometteur`, `étudiants`, `Blasé`
- sampled data did not include `étudiants`, but the generator can emit it

### `articles.csv`

Observed columns:

- `product_id`
- `brand`
- `model`
- `category`
- `color`
- `size`
- `base_price`
- `is_best_seller`

Contract notes:

- `product_id` format: `P001`
- `size` is numeric in this table
- `is_best_seller` is boolean-like
- brands and categories are closed enumerations in code

### `clients.csv`

Observed columns:

- `customer_id`
- `genre`
- `age`
- `profile`
- `favorite_brand`
- `has_loyalty_card`
- `loyalty_points`

Contract notes:

- `customer_id` format: `C0001`
- `favorite_brand` is nullable
- `has_loyalty_card` is boolean-like
- `profile` values: `sneakerhead`, `impulsif`, `chasseur_de_promos`, `fidèle_marque`

## Sales Shape

### `ventes.csv`

Observed columns:

- `sale_id`
- `date`
- `time`
- `store_id`
- `store_type`
- `zone`
- `surface`
- `hypermarche`
- `specialty_brands`
- `open_time_int`
- `open_to_clients_hours`
- `open_days`
- `foot_traffic_by_hour`
- `daily_foot_traffic`
- `nb_employees`
- `employee_id`
- `employee_profile`
- `monthly_salary`
- `anciennete_mois`
- `hire_date`
- `job_role`
- `average_day_time_backoffice`
- `average_day_time_frontoffice`
- `customer_id`
- `genre`
- `age`
- `favorite_brand`
- `has_loyalty_card`
- `customer_profile`
- `loyalty_points_used`
- `loyalty_points_earned`
- `product_id`
- `brand`
- `category`
- `model`
- `color`
- `size`
- `price_sold`
- `base_price`
- `is_best_seller`
- `total_discount_applied`
- `discount_applied_profile`
- `discount_value_fidelity`
- `ajust_value_magasin`
- `discount_val_month`
- `%economise`
- `hyper`
- `open_time`
- `year_month`
- `CA_month`

Contract notes:

- this file is denormalized: store, employee, customer, and product attributes are repeated on every row
- `date` format: `YYYY-MM-DD`
- `time` format: `HH:MM`
- `year_month` is added after generation via pandas period grouping
- `CA_month` is also post-processed after generation
- `size` becomes mixed-type in this table: shoe sizes plus goodies sizes like `XS`, `M`, `XL`

### `ventes_filtre.csv`

This is a reduced projection of `ventes.csv`, intended for student-facing use.

## Relationships

Observed FK integrity in sampled data:

- `sales.store_id -> stores.store_id`: valid
- `sales.employee_id -> employees.employee_id`: valid
- `sales.customer_id -> customers.customer_id`: valid
- regular `sales.product_id -> products.product_id`: valid for non-goodies rows

Important exception:

- goodies rows use synthetic ids like `G030`
- those ids do not exist in `articles.csv`

## Real Generator Behaviors To Preserve

These are part of the business behavior, not accidental bugs:

- stores specialize in 1 to 5 brands depending on store type
- employees belong to one store
- brand-loyal customers only buy in compatible stores
- sales volume varies by month
- price sold is derived from product base price plus store adjustment minus discounts
- loyalty points can be earned and sometimes redeemed
- some transactions add accessory or upsell items ("goodies")

## Generator Defects / Inconsistencies

These are in the current Python output and should be treated as defects, not ideal API design.

### 1. Two sales schemas are merged together

The normal sale branch writes:

- `hypermarche`
- `open_time_int`

The goodies branch writes:

- `hyper`
- `open_time`

Pandas merges both shapes into `ventes.csv`, creating sparse columns.

Observed in sample:

- goodies rows: `223`
- rows with `hypermarche = null`: `223`
- rows with `hyper = null`: `777`

### 2. `sale_id` is not unique

The goodies branch reuses the previous ticket context and writes additional rows with the same `sale_id`.

Observed in sample:

- duplicated `sale_id` count: `223`

Interpretation:

- `sale_id` behaves more like a basket or ticket id
- `ventes.csv` is actually a line-item table, not a strict one-row-per-sale table

### 3. Goodies rows overload product semantics

For goodies rows:

- `product_id` becomes `Gxxx`
- `brand`, `category`, `model` all receive the goodies label
- `color` is empty/null in CSV
- `size` switches to apparel-style sizes

This means the product contract is polymorphic in `ventes.csv`.

### 4. `specialty_brands` is stringified Python data

CSV exports values like:

- `['New Balance']`

This is not JSON and should not be exposed as-is in a clean web API.

### 5. Lightweight cap biases the sample

Because the cap returns early from `generate_sales`, the current 1000-row sample only includes early stores encountered in the loop.

Observed in sample:

- only `Premium` store rows appeared in `ventes.csv`

This is a sampling artifact, not the full generator behavior.

## Recommended Canonical Domain Model For The Web Version

To reproduce behavior cleanly in Next.js, split the model into:

### Dimension tables

- `stores`
- `employees`
- `products`
- `customers`

### Transaction tables

- `sales`
- `sale_lines`

Recommended meaning:

- `sales.id`: unique ticket id
- `sale_lines.id`: unique line id
- one sale can have multiple sale lines
- goodies become a sale-line subtype instead of a schema fork

## Minimal Reproduction Requirements

If the goal is "same business output, cleaner implementation", the Next.js generator should preserve:

- entity ids and core enumerations
- weighted randomness and seeding
- store specialization
- employee profile weighting by store type
- customer profile behavior
- monthly seasonality
- price/discount/loyalty calculations
- optional multi-line baskets

It should not preserve:

- duplicate line ids under the name `sale_id`
- mixed column names for the same concept
- Python-list strings in serialized output
