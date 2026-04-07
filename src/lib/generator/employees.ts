import { SeededRandom } from "./random";
import type {
  Employee,
  EmployeeProfile,
  EmployeeRole,
  GeneratorConfig,
  ResolvedExamScenario,
  Store,
} from "./types";
import { diffMonths, formatDate, roundCurrency } from "./utils";

function generateEmployeeName(rng: SeededRandom) {
  const firstNames = [
    "Camille",
    "Lina",
    "Noah",
    "Hugo",
    "Jade",
    "Sarah",
    "Liam",
    "Leo",
    "Nina",
    "Emma",
    "Ines",
    "Nathan",
    "Lucas",
    "Alice",
    "Paul",
  ];
  const lastNames = [
    "Martin",
    "Bernard",
    "Dubois",
    "Moreau",
    "Thomas",
    "Petit",
    "Robert",
    "Richard",
    "Durand",
    "Simon",
    "Laurent",
    "Michel",
    "Lefevre",
  ];
  return `${rng.choice(firstNames)} ${rng.choice(lastNames)}`;
}

function employeeProfileSpec(
  profile: EmployeeProfile,
  role: EmployeeRole,
  rng: SeededRandom,
  config: GeneratorConfig,
) {
  const yearStart = new Date(Date.UTC(config.year, 0, 1));
  const range = {
    Requin: { minMonths: 72, maxMonths: 144, salary: [2800, 3400], conversion: [0.28, 0.36] },
    Experimente: { minMonths: 48, maxMonths: 144, salary: [2400, 3000], conversion: [0.22, 0.29] },
    JeunePrometteur: { minMonths: 12, maxMonths: 72, salary: [1900, 2400], conversion: [0.16, 0.22] },
    Stagiaire: { minMonths: 1, maxMonths: 10, salary: [650, 950], conversion: [0.05, 0.1] },
    Blase: { minMonths: 60, maxMonths: 240, salary: [2200, 2800], conversion: [0.1, 0.16] },
  }[profile];

  const tenureMonths = rng.int(range.minMonths, range.maxMonths);
  const hireDate = new Date(
    Date.UTC(yearStart.getUTCFullYear(), yearStart.getUTCMonth() - tenureMonths, rng.int(1, 28)),
  );
  const salaryMonthly = rng.int(range.salary[0], range.salary[1]);
  const monthlyHours = role === "Apprentice" ? 70 : 145;
  const workRatioBackoffice =
    profile === "Requin"
      ? rng.float(0.02, 0.08)
      : profile === "Experimente"
        ? rng.float(0.06, 0.12)
        : profile === "JeunePrometteur"
          ? rng.float(0.1, 0.18)
          : profile === "Stagiaire"
            ? rng.float(0.18, 0.28)
            : rng.float(0.18, 0.3);
  const workRatioFrontoffice = roundCurrency(1 - workRatioBackoffice);
  const conversionRate = rng.float(range.conversion[0], range.conversion[1]);
  const salesWeight =
    profile === "Stagiaire"
      ? rng.float(0.08, 0.2, 3)
      : role === "Manager"
        ? rng.float(0.35, 0.75, 3)
        : rng.float(0.8, 1.4, 3);

  return {
    hireDate: formatDate(hireDate),
    tenureMonths: diffMonths(formatDate(hireDate), new Date(Date.UTC(config.year, 11, 31))),
    salaryMonthly,
    salaryHourly: roundCurrency(salaryMonthly / monthlyHours),
    workRatioBackoffice,
    workRatioFrontoffice,
    conversionRate,
    salesWeight,
  };
}

function adjustEmployeeForScenario(
  employee: Employee,
  rng: SeededRandom,
  config: GeneratorConfig,
  examScenarioApplied: ResolvedExamScenario | undefined,
) {
  if (
    !examScenarioApplied ||
    examScenarioApplied.presetId !== "underperforming_sales_execution" ||
    employee.storeId !== examScenarioApplied.targetStoreId
  ) {
    return employee;
  }

  const salaryFactor =
    employee.profile === "Requin"
      ? rng.float(0.97, 0.99, 3)
      : employee.profile === "Experimente"
        ? rng.float(0.95, 0.98, 3)
        : employee.profile === "JeunePrometteur"
          ? rng.float(0.91, 0.95, 3)
          : employee.profile === "Blase"
            ? rng.float(0.9, 0.94, 3)
            : rng.float(0.9, 0.93, 3);

  const recentTenureCap =
    employee.profile === "Requin"
      ? 48
      : employee.profile === "Experimente"
        ? 36
        : employee.profile === "JeunePrometteur"
          ? 18
          : employee.profile === "Blase"
            ? 14
            : 8;

  const targetTenure = Math.min(employee.tenureMonths, rng.int(1, recentTenureCap));
  const hireDate = new Date(
    Date.UTC(config.year, 11 - targetTenure, rng.int(1, 28)),
  );
  const adjustedSalary = Math.max(650, Math.round(employee.salaryMonthly * salaryFactor));

  return {
    ...employee,
    hireDate: formatDate(hireDate),
    tenureMonths: diffMonths(formatDate(hireDate), new Date(Date.UTC(config.year, 11, 31))),
    salaryMonthly: adjustedSalary,
    salaryHourly: roundCurrency(adjustedSalary / (employee.role === "Apprentice" ? 70 : 145)),
  };
}

export function generateEmployees(
  rng: SeededRandom,
  config: GeneratorConfig,
  stores: Store[],
  examScenarioApplied?: ResolvedExamScenario,
) {
  const employees: Employee[] = [];
  let employeeIndex = 1;

  for (const store of stores) {
    for (let count = 0; count < store.employeeCount; count += 1) {
      const profiles = config.includeInterns
        ? (["Requin", "Experimente", "JeunePrometteur", "Stagiaire", "Blase"] as const)
        : (["Requin", "Experimente", "JeunePrometteur", "Blase"] as const);
      const weights =
        store.type === "Premium"
          ? config.includeInterns
            ? [0.16, 0.34, 0.27, 0.08, 0.15]
            : [0.18, 0.38, 0.28, 0.16]
          : store.type === "Discount"
            ? config.includeInterns
              ? [0.04, 0.17, 0.3, 0.21, 0.28]
              : [0.06, 0.2, 0.38, 0.36]
            : config.includeInterns
              ? [0.08, 0.26, 0.31, 0.13, 0.22]
              : [0.1, 0.31, 0.34, 0.25];
      const profile = rng.weightedChoice(profiles, weights) as EmployeeProfile;
      const role =
        profile === "Stagiaire"
          ? "Apprentice"
          : rng.weightedChoice<EmployeeRole>(
              ["Manager", "Sales", "Support"],
              profile === "Requin" ? [0.18, 0.72, 0.1] : [0.08, 0.72, 0.2],
            );
      const spec = employeeProfileSpec(profile, role, rng, config);

      const employee = {
        id: `E${String(employeeIndex).padStart(4, "0")}`,
        fullName: generateEmployeeName(rng),
        storeId: store.id,
        profile,
        role,
        conversionRate: spec.conversionRate,
        salaryMonthly: spec.salaryMonthly,
        salaryHourly: spec.salaryHourly,
        hireDate: spec.hireDate,
        tenureMonths: spec.tenureMonths,
        workRatioBackoffice: spec.workRatioBackoffice,
        workRatioFrontoffice: spec.workRatioFrontoffice,
        salesWeight: spec.salesWeight,
      };
      employees.push(adjustEmployeeForScenario(employee, rng, config, examScenarioApplied));
      employeeIndex += 1;
    }
  }

  return employees;
}
