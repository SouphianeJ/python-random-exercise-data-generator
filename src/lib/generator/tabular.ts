import type {
  Customer,
  Employee,
  GeneratedDataset,
  Product,
  Sale,
  SaleLine,
  Store,
} from "./types";
import { serializeBrands } from "./utils";

export type RowValue = string | number | boolean | null | undefined;
export type TableRow = Record<string, RowValue>;
export type TabularExportName =
  | "magasins"
  | "employes"
  | "articles"
  | "clients"
  | "ventes"
  | "ventes_filtre"
  | "ventes_exam"
  | "store_month_costs";

function monthlyRevenueMap(dataset: GeneratedDataset) {
  return new Map(
    dataset.summary.monthlyRevenueTotals.map((entry) => [
      `${entry.storeId}:${entry.yearMonth}`,
      entry.totalPaid,
    ]),
  );
}

function storesRows(stores: Store[]) {
  return stores.map((store) => ({
    store_id: store.id,
    zone: store.zone,
    type: store.type,
    surface: store.surface,
    hyper: store.hyper,
    specialty_brands: serializeBrands(store.specialtyBrands),
    open_time: store.openTime,
    open_to_clients_hours: store.openToClientsHours,
    open_days: store.openDays,
    foot_traffic_by_hour: store.footTrafficByHour,
    daily_foot_traffic: store.dailyFootTraffic,
    conversion_rate: store.conversionRate,
    traffic_conversion: store.trafficConversion,
    avg_basket_value: store.avgBasketValue,
    monthly_revenue_est: store.monthlyRevenueEstimate,
    num_employees: store.employeeCount,
  }));
}

function employeesRows(employees: Employee[]) {
  return employees.map((employee) => ({
    employee_id: employee.id,
    nom_complet: employee.fullName,
    store_id: employee.storeId,
    profile: employee.profile,
    conversion_rate: employee.conversionRate,
    salary: employee.salaryMonthly,
    anciennete_mois: employee.tenureMonths,
    hire_date: employee.hireDate,
    end_date: employee.endDate,
    role: employee.role,
    average_day_time_backoffice: employee.workRatioBackoffice,
    average_day_time_frontoffice: employee.workRatioFrontoffice,
  }));
}

function productsRows(products: Product[]) {
  return products.map((product) => ({
    product_id: product.legacyId,
    product_kind: product.kind,
    brand: product.brand,
    model: product.model,
    category: product.category,
    color: product.color,
    size: product.size,
    base_price: product.basePrice,
    is_best_seller: product.isBestSeller,
  }));
}

function customersRows(customers: Customer[]) {
  return customers.map((customer) => ({
    customer_id: customer.id,
    genre: customer.gender,
    age: customer.age,
    profile: customer.profile,
    favorite_brand: customer.favoriteBrand,
    has_loyalty_card: customer.hasLoyaltyCard,
    loyalty_points: customer.loyaltyPoints,
  }));
}

function salesRow(
  sale: Sale,
  line: SaleLine,
  store: Store,
  employee: Employee,
  customer: Customer,
  caMonth: number,
) {
  return {
    sale_id: sale.id,
    line_id: line.id,
    date: sale.date,
    time: sale.time,
    store_id: store.id,
    store_type: store.type,
    zone: store.zone,
    surface: store.surface,
    hyper: store.hyper,
    specialty_brands: serializeBrands(store.specialtyBrands),
    open_time: store.openTime,
    open_to_clients_hours: store.openToClientsHours,
    open_days: store.openDays,
    foot_traffic_by_hour: store.footTrafficByHour,
    daily_foot_traffic: store.dailyFootTraffic,
    nb_employees: store.employeeCount,
    employee_id: employee.id,
    employee_profile: employee.profile,
    monthly_salary: employee.salaryMonthly,
    anciennete_mois: employee.tenureMonths,
    hire_date: employee.hireDate,
    job_role: employee.role,
    average_day_time_backoffice: employee.workRatioBackoffice,
    average_day_time_frontoffice: employee.workRatioFrontoffice,
    customer_id: customer.id,
    genre: customer.gender,
    age: customer.age,
    favorite_brand: customer.favoriteBrand,
    has_loyalty_card: customer.hasLoyaltyCard,
    customer_profile: customer.profile,
    loyalty_points_used: sale.loyaltyPointsUsed,
    loyalty_points_earned: sale.loyaltyPointsEarned,
    product_id: line.legacyProductId,
    product_kind: line.productKind,
    brand: line.brand,
    category: line.category,
    model: line.model,
    color: line.color,
    size: line.size,
    price_sold: line.priceSold,
    tva_rate: line.tvaRate,
    price_ht: line.priceHt,
    tva_amount: line.tvaAmount,
    loyalty_discount_ttc: line.loyaltyDiscountTtc,
    gross_price_ttc_before_loyalty: line.grossPriceTtcBeforeLoyalty,
    base_price: line.adjustedBasePrice,
    is_best_seller: line.isBestSeller,
    total_discount_applied: line.totalDiscountApplied,
    special_offer_discount: line.specialOfferDiscount,
    discount_value_fidelity: line.discountValueFidelity,
    ajust_value_magasin: line.storeAdjustmentPercent,
    discount_val_month: line.discountValueMonth,
    pct_economise: line.percentSaved,
    year_month: sale.yearMonth,
    CA_month: caMonth,
  };
}

function salesRows(dataset: GeneratedDataset) {
  const stores = new Map(dataset.stores.map((store) => [store.id, store]));
  const employees = new Map(dataset.employees.map((employee) => [employee.id, employee]));
  const customers = new Map(dataset.customers.map((customer) => [customer.id, customer]));
  const sales = new Map(dataset.sales.map((sale) => [sale.id, sale]));
  const caMonth = monthlyRevenueMap(dataset);

  return dataset.saleLines.map((line) => {
    const sale = sales.get(line.saleId)!;
    const store = stores.get(line.storeId)!;
    const employee = employees.get(line.employeeId)!;
    const customer = customers.get(line.customerId)!;
    return salesRow(
      sale,
      line,
      store,
      employee,
      customer,
      caMonth.get(`${line.storeId}:${line.yearMonth}`) ?? 0,
    );
  });
}

function filteredSalesRows(dataset: GeneratedDataset) {
  return salesRows(dataset).map((row) => ({
    sale_id: row.sale_id,
    line_id: row.line_id,
    date: row.date,
    time: row.time,
    store_id: row.store_id,
    store_type: row.store_type,
    zone: row.zone,
    surface: row.surface,
    open_to_clients_hours: row.open_to_clients_hours,
    open_days: row.open_days,
    foot_traffic_by_hour: row.foot_traffic_by_hour,
    employee_id: row.employee_id,
    monthly_salary: row.monthly_salary,
    hire_date: row.hire_date,
    job_role: row.job_role,
    average_day_time_backoffice: row.average_day_time_backoffice,
    average_day_time_frontoffice: row.average_day_time_frontoffice,
    customer_id: row.customer_id,
    genre: row.genre,
    age: row.age,
    has_loyalty_card: row.has_loyalty_card,
    loyalty_points_used: row.loyalty_points_used,
    loyalty_points_earned: row.loyalty_points_earned,
    product_id: row.product_id,
    product_kind: row.product_kind,
    price_sold: row.price_sold,
    tva_rate: row.tva_rate,
    price_ht: row.price_ht,
    tva_amount: row.tva_amount,
    loyalty_discount_ttc: row.loyalty_discount_ttc,
    gross_price_ttc_before_loyalty: row.gross_price_ttc_before_loyalty,
    base_price: row.base_price,
    brand: row.brand,
    category: row.category,
    model: row.model,
    size: row.size,
    color: row.color,
    is_best_seller: row.is_best_seller,
  }));
}

function examSalesRows(dataset: GeneratedDataset) {
  const rows = salesRows(dataset);
  const grouped = new Map<string, (typeof rows)[number][]>();

  for (const row of rows) {
    const bucket = grouped.get(row.sale_id) ?? [];
    bucket.push(row);
    grouped.set(row.sale_id, bucket);
  }

  const maxLines = Math.max(1, ...[...grouped.values()].map((bucket) => bucket.length));

  return [...grouped.entries()].map(([saleId, lineRows]) => {
    const first = lineRows[0];
    const result: TableRow = {
      sale_id: saleId,
      date: first.date,
      time: first.time,
      store_id: first.store_id,
      employee_id: first.employee_id,
      customer_id: first.customer_id,
      article_count: lineRows.length,
      sale_total_ht: "",
      sale_total_ttc: "",
      sale_total_discount: Number(
        lineRows.reduce((sum, row) => sum + Number(row.total_discount_applied), 0).toFixed(2),
      ),
    };

    for (let index = 0; index < maxLines; index += 1) {
      const suffix = index + 1;
      const line = lineRows[index];
      result[`product_${suffix}_id`] = line?.product_id;
      result[`product_${suffix}_kind`] = line?.product_kind;
      result[`product_${suffix}_brand`] = line?.brand;
      result[`product_${suffix}_model`] = line?.model;
      result[`product_${suffix}_is_best_seller`] = line?.is_best_seller;
      result[`product_${suffix}_price_ht`] = line?.price_ht;
      result[`product_${suffix}_base_price`] = line?.base_price;
      result[`product_${suffix}_total_discount_applied`] = line?.total_discount_applied;
      result[`product_${suffix}_special_offer_discount`] = line?.special_offer_discount;
      result[`product_${suffix}_discount_value_fidelity`] = line?.discount_value_fidelity;
      result[`product_${suffix}_discount_val_month`] = line?.discount_val_month;
      result[`product_${suffix}_pct_economise`] = line?.pct_economise;
    }

    return result;
  });
}

function storeMonthCostsRows(dataset: GeneratedDataset) {
  return dataset.storeMonthCosts.map((cost) => ({
    year_month: cost.yearMonth,
    store_id: cost.storeId,
    rent_month: cost.rentMonth,
    service_charges: cost.serviceCharges,
    utilities: cost.utilities,
    cleaning: cost.cleaning,
    insurance: cost.insurance,
    maintenance: cost.maintenance,
    software_it: cost.softwareIt,
    security: cost.security,
    gross_payroll: cost.grossPayroll,
    employer_contrib: cost.employerContrib,
    payment_fees: cost.paymentFees,
    local_marketing: cost.localMarketing,
    shrinkage: cost.shrinkage,
    cfe_month: cost.cfeMonth,
    loyalty_future_cost: cost.loyaltyFutureCost,
    loyalty_discount_ttc: cost.loyaltyDiscountTtc,
    total_store_cost: cost.totalStoreCost,
    ca_ttc: cost.caTtc,
    ca_ht: cost.caHt,
    nb_lines: cost.nbLines,
  }));
}

export function tabularExports(dataset: GeneratedDataset): Record<TabularExportName, TableRow[]> {
  return {
    magasins: storesRows(dataset.stores),
    employes: employeesRows(dataset.employees),
    articles: productsRows(dataset.products),
    clients: customersRows(dataset.customers),
    ventes: salesRows(dataset),
    ventes_filtre: filteredSalesRows(dataset),
    ventes_exam: examSalesRows(dataset),
    store_month_costs: storeMonthCostsRows(dataset),
  };
}
