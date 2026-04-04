# Effects Extracted From The Original Python Script

This note captures the real-life effects the original Python generator was trying to model, including effects that were implicit in the code rather than fully coherent in the exported data.

## Store-level effects

- City center stores are more likely to be `Premium` or `Standard`.
- Peripheral stores are more likely to be `Discount` or `Standard`.
- Premium stores are smaller and more selective.
- Discount stores tend to be larger and can become `hyper` stores.
- Surface influences foot traffic.
- Very large stores receive a traffic boost.
- Surface and positioning influence staffing levels.
- Opening days and closing hours differ by zone.
- Store type controls brand assortment width:
  - Premium: single flagship brand
  - Standard: 2 to 4 brands
  - Discount: 3 to 5 brands
- Store type controls average basket value.
- Store type controls store-level price uplift or markdown.

## Employee-level effects

- Seller profiles were intended to encode sales ability:
  - `Requin`
  - `Expérimenté`
  - `Jeune prometteur`
  - `étudiants`
  - `Blasé`
- Profile mixes differ by store type.
- Seller conversion rate is higher for strong profiles.
- Back-office vs front-office time differs by profile.
- Intern/student roles have lower hours and lower salary.
- Higher-performing sellers are more likely to close sales.
- Strong sellers were also intended to sell better products and more add-ons.

## Product and pricing effects

- Brands, categories, colors, sizes, and models are randomized with uniqueness constraints.
- Limited editions are priced higher.
- Best-sellers are more expensive and less frequently discounted.
- Small sizes are cheaper.
- Some colorways are more expensive.
- Premium stores add a positive price adjustment.
- Discount stores apply a negative price adjustment.
- January and July have stronger markdown behavior.
- Non-sold periods still include random promotions.

## Customer effects

- Customer profiles were intended to change behavior:
  - `sneakerhead`
  - `impulsif`
  - `chasseur_de_promos`
  - `fidèle_marque`
- Loyalty card ownership differs by profile.
- Promo hunters start with more loyalty points.
- Brand-loyal customers should only buy in compatible stores.
- Some customers should come back multiple times.
- Some customers should buy more than one item in a basket.

## Basket and sales effects

- Sales are weighted by store traffic and store conversion.
- Sales volume changes by month.
- Week-end bias was attempted by shifting some transactions to Saturday.
- Sneakerheads prefer best-sellers and limited editions.
- Strong sellers prefer to sell expensive or hype products.
- Loyalty cards generate points and sometimes redemption.
- Promo hunters should receive more discounts when no other discount exists.
- Impulsive customers and strong sellers increase the chance of add-on items.
- A single basket can contain more than one line item.

## What The Next.js Rebuild Now Preserves Explicitly

- seasonality by month
- city-center vs periphery store mix
- premium vs standard vs discount store behavior
- surface impact on staffing and foot traffic
- seller profile impact on sale assignment
- loyalty-card and points behavior
- brand-loyal customer/store compatibility
- repeat visits, especially for loyalty-oriented customers
- multi-line baskets tied to seller and customer profile
- week-end bias toward Saturdays
- accessory upsells as real products and real line items
- premium vs discount basket/pricing differences

## What Was Intention In Python But Not Reliably Encoded There

- coherent multi-line basket identity
- explicit repeat-visit behavior
- explicit basket-size effect by profile
- sale timing consistent with hire date
- stable product identity for accessory lines
- one canonical set of export columns

The TypeScript generator keeps those effects, but models them with explicit rules and tests instead of relying on accidental side effects.
