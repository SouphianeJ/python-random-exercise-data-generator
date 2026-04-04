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

type RowValue = string | number | boolean | null | undefined;

function formatCell(value: RowValue) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function escapeCell(value: string) {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv<T extends Record<string, RowValue>>(rows: T[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(";"),
    ...rows.map((row) =>
      headers.map((header) => escapeCell(formatCell(row[header]))).join(";"),
    ),
  ];
  return `\ufeff${lines.join("\n")}`;
}

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
    base_price: line.adjustedBasePrice,
    is_best_seller: line.isBestSeller,
    total_discount_applied: line.totalDiscountApplied,
    discount_applied_profile: line.discountAppliedProfile,
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
    base_price: row.base_price,
    brand: row.brand,
    category: row.category,
    model: row.model,
    size: row.size,
    color: row.color,
    is_best_seller: row.is_best_seller,
  }));
}

export function exportFiles(dataset: GeneratedDataset) {
  return {
    "magasins.csv": toCsv(storesRows(dataset.stores)),
    "employes.csv": toCsv(employeesRows(dataset.employees)),
    "articles.csv": toCsv(productsRows(dataset.products)),
    "clients.csv": toCsv(customersRows(dataset.customers)),
    "ventes.csv": toCsv(salesRows(dataset)),
    "ventes_filtre.csv": toCsv(filteredSalesRows(dataset)),
    "canonical.json": JSON.stringify(dataset, null, 2),
  };
}
