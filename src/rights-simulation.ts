import { z } from 'zod';

const money = z.number().finite().min(0).max(1_000_000);
const adult = z.object({
  age: z.number().int().min(16).max(120),
  activity: z.enum(['employee', 'unemployed', 'student', 'independent', 'retired', 'other']),
  salaryNetSocial: money, salaryTaxable: money,
  unemploymentNet: money, unemploymentTaxable: money,
  pensionNet: money, pensionTaxable: money,
  otherResources: money, independentIncome: money,
  disabilityRate: z.number().finite().min(0).max(100), rsdae: z.boolean(),
  higherEducation: z.boolean(), studentParentalResources2024: money,
  studentDistanceKm: z.number().int().min(0).max(10_000),
}).strict();

const child = z.object({
  age: z.number().int().min(0).max(25),
  birthMonth: z.number().int().min(1).max(12),
  sharedCustody: z.boolean(), disability: z.boolean(),
  aeehLevel: z.number().int().min(0).max(6),
}).strict();

export const rightsSimulationSchema = z.object({
  schemaVersion: z.literal(2),
  period: z.literal('2026-09'),
  adults: z.array(adult).min(1).max(2),
  children: z.array(child).max(8),
  family: z.object({
    pregnant: z.boolean(), pregnancyMonth: z.number().int().min(0).max(9),
    childSupportReceived: money, childcareMonthlyCost: money, parentalLeave: z.boolean(),
  }).strict(),
  annualFamilyResources2024: money,
  taxIncome2024: money,
  assets: z.object({
    savings: money, rentedPropertyValue: money, otherPropertyValue: money,
    landValue: money, investmentIncomeMonthly: money,
  }).strict(),
  housing: z.object({
    communeCode: z.string().regex(/^(?:\d{5}|2[AB]\d{3})$/),
    rent: money, charges: money,
    occupancy: z.enum(['tenant', 'hlm', 'foyer', 'hosted', 'owner', 'homeless']),
    conventioned: z.boolean(), furnished: z.boolean(), colocation: z.boolean(),
    surface: z.number().finite().min(0).max(10_000),
  }).strict(),
  confirmations: z.object({
    stableResources: z.boolean(), residentInFrance: z.boolean(), allResourcesDeclared: z.boolean(),
  }).strict(),
}).strict();

export type RightsSimulationInput = z.infer<typeof rightsSimulationSchema>;

export function withSimulationCommune(input: RightsSimulationInput, communeCode: string): RightsSimulationInput {
  return { ...input, housing: { ...input.housing, communeCode } };
}

export type BenefitConfidence = 'high' | 'medium' | 'low';
export type BenefitEligibility = 'likely' | 'possible' | 'unlikely';
export type RightsBenefit = {
  id: string;
  label: string;
  eligibility: BenefitEligibility;
  monthly: number;
  monthlyLow: number;
  monthlyHigh: number;
  annual: number;
  annualLow: number;
  annualHigh: number;
  confidence: BenefitConfidence;
  sourceUrl: string;
  applicationUrl: string;
  notes: string[];
};
export type RightsSimulationResult = {
  status: 'calculated' | 'incomplete' | 'unavailable';
  period: string;
  version: string;
  benefits: RightsBenefit[];
  assumptions: string[];
  limitations: string[];
  coverage?: { calculated: number; approximated: number; total: number };
  missing?: string[];
  reasons?: string[];
};
