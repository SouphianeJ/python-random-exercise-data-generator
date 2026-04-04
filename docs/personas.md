# Personas And Expected Signals

This document defines the intended personas behind the generator so the dataset can be checked against concrete expectations instead of vague realism.

## Store Personas

### Premium Store

Narrative:
- Smaller flagship store, usually in the city center
- Narrow brand focus
- Higher service level
- Higher basket value
- Lower raw traffic than big discount locations

Expected signals:
- smaller average surface than `Discount`
- fewer specialty brands than `Standard` and `Discount`
- higher `avgBasketValue` than `Standard` and `Discount`
- more positive `priceAdjustmentPercent` than `Standard` and `Discount`
- lower `footTrafficByHour` than large peripheral `Discount` stores
- higher share of strong seller profiles

### Standard Store

Narrative:
- Balanced assortment and positioning
- Mid-range store size
- Mid-range staffing and traffic
- No strong markup or markdown positioning

Expected signals:
- medium number of specialty brands
- `avgBasketValue` between `Premium` and `Discount`
- `priceAdjustmentPercent` near zero
- mixed employee seniority and performance

### Discount Store

Narrative:
- Larger volume-driven store, often peripheral
- Broad brand mix
- Lower price point
- High traffic and larger footprint

Expected signals:
- larger average surface than `Premium`
- more specialty brands than `Premium`
- higher `footTrafficByHour` than `Premium`
- lower `avgBasketValue` than `Premium`
- more negative `priceAdjustmentPercent`
- larger staff count than small city-center stores when surface is large

## Seller Personas

### Requin

Narrative:
- Elite closer
- Pushes premium or hype items
- Expands baskets through add-ons and cross-sell

Expected signals:
- highest or near-highest sales share per employee
- highest average basket line count
- higher average revenue per sale than `JeunePrometteur`, `Stagiaire`, and `Blase`
- higher accessory attachment rate than `Blase`
- higher share of hype products than weaker profiles

### Experimente

Narrative:
- Reliable senior salesperson
- Good conversion and solid cross-sell
- Less aggressive than `Requin`

Expected signals:
- sales share per employee above `JeunePrometteur`, `Stagiaire`, and `Blase`
- average basket line count above `Blase`
- average revenue per sale below or near `Requin`
- moderate accessory attachment rate

### JeunePrometteur

Narrative:
- Growing seller with decent conversion
- Mostly sales floor oriented
- Still less influential than senior closers

Expected signals:
- middle-tier sales share per employee
- average revenue per sale below `Experimente`
- average basket line count above `Stagiaire`

### Stagiaire

Narrative:
- Part-time or junior apprentice
- Low sales autonomy
- More back-office time, lower hours, lower pay

Expected signals:
- lowest sales share per employee
- lowest or near-lowest average basket line count
- lowest average revenue per sale
- lower accessory attachment than `Requin`

### Blase

Narrative:
- Experienced but disengaged seller
- Still present on floor but weak commercial energy

Expected signals:
- lower sales share per employee than `Experimente`
- lower average basket line count than `Requin`
- lower average revenue per sale than `Requin`
- low accessory attachment rate

## Buyer Personas

### sneakerhead

Narrative:
- Comes for hype products, rare drops, limited editions
- More willing to buy premium items
- More likely to revisit

Expected signals:
- highest hype-product share among shoe lines
- higher average paid amount than `chasseur_de_promos`
- above-average revisit rate
- above-average multi-line basket rate

### impulsif

Narrative:
- Buys emotionally
- Easy to upsell on accessories or second items
- Less loyalty-driven than repeat-oriented buyers

Expected signals:
- high accessory attachment rate
- high multi-line basket rate
- lower revisit rate than `sneakerhead` and `fidele_marque`

### chasseur_de_promos

Narrative:
- Looks for discounts first
- Uses loyalty points and responds to markdowns
- Can buy multiple items when deals are attractive

Expected signals:
- highest average discount per sale
- high average loyalty points redeemed
- lower average paid amount than `sneakerhead`
- moderate revisit rate

### fidele_marque

Narrative:
- Repeats purchases inside one preferred brand ecosystem
- Returns when the favorite brand is available
- Loyal and predictable

Expected signals:
- shoe purchases align with `favoriteBrand`
- above-average revisit rate
- lower hype-product share than `sneakerhead` unless favorite brand overlaps hype items

## Cross-Persona Effects

### Basket expansion

Expected:
- `Requin` and `Experimente` should increase basket size more than `Blase`
- `impulsif` and `sneakerhead` should increase basket size more than passive profiles

### Repeat visits

Expected:
- `sneakerhead` and `fidele_marque` should revisit more than `impulsif`
- loyalty-card holders should revisit more often on average

### Promotions and loyalty

Expected:
- `chasseur_de_promos` should capture the highest average discount
- best-sellers should be discounted less often than ordinary products

### Store impact

Expected:
- `Premium` stores should bias toward stronger sellers and higher-value baskets
- `Discount` stores should bias toward traffic and assortment breadth
- surface should remain positively related to staffing and traffic
