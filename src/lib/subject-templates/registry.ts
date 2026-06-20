import { createComparisonTemplate } from "./comparison";
import { createNetworkTemplate } from "./network-diagnosis";
import { toInfo, type SubjectTemplate, type SubjectTemplateInfo } from "./types";

export const subjectTemplates: SubjectTemplate[] = [
  createComparisonTemplate(),
  createNetworkTemplate(),
];

export function getTemplate(id: string): SubjectTemplate | undefined {
  return subjectTemplates.find((template) => template.id === id);
}

export function listTemplateInfos(): SubjectTemplateInfo[] {
  return subjectTemplates.map(toInfo);
}
