# Corrections From Python Reference

This project uses the Python script as a behavioral reference only. The Next.js rebuild intentionally fixes the following incoherences.

## Sale identity

- Before: `sale_id` was duplicated by the goodies branch.
- After: each sale ticket has one unique `sale_id`, and each line item has one unique `line_id`.
- Rationale: the export is now explicitly one row per sale line, not an accidental schema collision.

## Store columns

- Before: the sales export mixed `hyper` and `hypermarche`, plus `open_time` and `open_time_int`.
- After: the export keeps one canonical store field name for each concept.
- Rationale: no sparse columns or branch-dependent schemas.

## Accessory lines

- Before: goodies rows reused stale sale context and fake `Gxxx` product ids that were absent from the products table.
- After: accessories are first-class products with real ids and proper line items.
- Rationale: every sold line now references an existing product row.

## Hire dates and sales eligibility

- Before: employee history was not enforced strongly enough against generated sales timing.
- After: sales are only assigned to employees already hired on the sale date, and `tenureMonths` is derived from `hireDate`.
- Rationale: no employee can sell before recruitment.

## Loyalty and revenue derivation

- Before: estimated store revenue and actual sales output could diverge conceptually.
- After: monthly export KPIs are derived from generated transaction totals.
- Rationale: downstream analysis sees a coherent source of truth.

## Store brand serialization

- Before: `specialty_brands` was written as a Python-list string.
- After: internal data uses arrays and CSV exports serialize brands intentionally as pipe-separated strings.
- Rationale: stable parsing in both JSON and CSV flows.
