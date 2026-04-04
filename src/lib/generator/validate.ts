import type { GeneratedDataset, ValidationIssue } from "./types";

function push(
  issues: ValidationIssue[],
  severity: ValidationIssue["severity"],
  code: string,
  message: string,
) {
  issues.push({ severity, code, message });
}

export function validateDataset(dataset: GeneratedDataset) {
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
    } else if (new Date(employee.hireDate) > new Date(`${sale.date}T${sale.time}:00.000Z`)) {
      push(issues, "error", "sale-before-hire", `Sale ${sale.id} occurs before employee ${employee.id} hire date`);
    }
    if (!customers.has(sale.customerId)) {
      push(issues, "error", "missing-customer", `Sale ${sale.id} references unknown customer ${sale.customerId}`);
    }
    if (sale.totalPaid < 0) {
      push(issues, "error", "negative-sale-total", `Sale ${sale.id} has a negative total`);
    }
  }

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
