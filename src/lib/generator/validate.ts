import type {
  Customer,
  Employee,
  GeneratorConfig,
  Product,
  Sale,
  SaleLine,
  Store,
  StoreMonthCost,
  ValidationIssue,
} from "./types";
import { LOYALTY_POINT_VALUE_EUR } from "./economics";

export interface DatasetValidationInput {
  config: GeneratorConfig;
  stores: Store[];
  employees: Employee[];
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  saleLines: SaleLine[];
  storeMonthCosts: StoreMonthCost[];
}

function push(
  issues: ValidationIssue[],
  severity: ValidationIssue["severity"],
  code: string,
  message: string,
) {
  issues.push({ severity, code, message });
}

export function validateDataset(dataset: DatasetValidationInput) {
  const issues: ValidationIssue[] = [];
  const stores = new Map(dataset.stores.map((store) => [store.id, store]));
  const employees = new Map(dataset.employees.map((employee) => [employee.id, employee]));
  const products = new Map(dataset.products.map((product) => [product.id, product]));
  const customers = new Map(dataset.customers.map((customer) => [customer.id, customer]));
  const saleIds = new Set<string>();
  const lineIds = new Set<string>();

  for (const sale of dataset.sales) {
    if (saleIds.has(sale.id)) {
      push(issues, "error", "duplicate-sale-id", `Duplicate sale id detected: ${sale.id}`);
    }
    saleIds.add(sale.id);
    if (!stores.has(sale.storeId)) {
      push(issues, "error", "missing-store", `Sale ${sale.id} references unknown store ${sale.storeId}`);
    }
    const employee = employees.get(sale.employeeId);
    if (!employee) {
      push(issues, "error", "missing-employee", `Sale ${sale.id} references unknown employee ${sale.employeeId}`);
    } else {
      const saleMoment = new Date(`${sale.date}T${sale.time}:00.000Z`);
      if (new Date(employee.hireDate) > saleMoment) {
        push(issues, "error", "sale-before-hire", `Sale ${sale.id} occurs before employee ${employee.id} hire date`);
      }
      if (employee.endDate && saleMoment > new Date(`${employee.endDate}T23:59:59.999Z`)) {
        push(issues, "error", "sale-after-departure", `Sale ${sale.id} occurs after employee ${employee.id} departure date`);
      }
    }
    if (!customers.has(sale.customerId)) {
      push(issues, "error", "missing-customer", `Sale ${sale.id} references unknown customer ${sale.customerId}`);
    }
    if (sale.totalPaid < 0) {
      push(issues, "error", "negative-sale-total", `Sale ${sale.id} has a negative total`);
    }
  }

  const fidelityBySale = new Map<string, number>();
  for (const line of dataset.saleLines) {
    if (lineIds.has(line.id)) {
      push(issues, "error", "duplicate-line-id", `Duplicate line id detected: ${line.id}`);
    }
    lineIds.add(line.id);
    if (!saleIds.has(line.saleId)) {
      push(issues, "error", "missing-sale", `Line ${line.id} references unknown sale ${line.saleId}`);
    }
    if (!products.has(line.productId)) {
      push(issues, "error", "missing-product", `Line ${line.id} references unknown product ${line.productId}`);
    }
    if (line.priceSold < 0) {
      push(issues, "error", "negative-line-total", `Line ${line.id} has a negative price`);
    }
    if (line.discountValueFidelity < 0) {
      push(issues, "error", "negative-fidelity-discount", `Line ${line.id} has a negative fidelity discount`);
    }
    fidelityBySale.set(
      line.saleId,
      (fidelityBySale.get(line.saleId) ?? 0) + line.discountValueFidelity,
    );
  }

  for (const sale of dataset.sales) {
    const appliedFidelity = fidelityBySale.get(sale.id) ?? 0;
    const promisedFidelity = sale.loyaltyPointsUsed * LOYALTY_POINT_VALUE_EUR;
    if (Math.abs(appliedFidelity - promisedFidelity) > 0.01) {
      push(
        issues,
        "error",
        "loyalty-points-mismatch",
        `Sale ${sale.id} used ${sale.loyaltyPointsUsed} points but applied ${appliedFidelity.toFixed(2)} EUR of fidelity discount`,
      );
    }
  }

  for (const customer of dataset.customers) {
    if (!customer.hasLoyaltyCard && customer.loyaltyPoints > 0) {
      push(
        issues,
        "error",
        "points-without-card",
        `Customer ${customer.id} holds loyalty points without a loyalty card`,
      );
    }
  }

  const costMonthsByStore = new Map<string, Set<string>>();
  for (const cost of dataset.storeMonthCosts) {
    const months = costMonthsByStore.get(cost.storeId) ?? new Set<string>();
    months.add(cost.yearMonth);
    costMonthsByStore.set(cost.storeId, months);
  }
  for (const store of dataset.stores) {
    const months = costMonthsByStore.get(store.id)?.size ?? 0;
    if (months !== 12) {
      push(
        issues,
        "error",
        "missing-cost-month",
        `Store ${store.id} has ${months} cost months instead of 12`,
      );
    }
  }

  const internSales = dataset.sales.filter((sale) => {
    const employee = employees.get(sale.employeeId);
    return employee?.profile === "Stagiaire";
  }).length;
  if (dataset.config.includeInterns && internSales === 0) {
    push(issues, "warning", "no-intern-sales", "Interns are enabled but no intern sale was generated for this seed.");
  }

  return issues;
}
