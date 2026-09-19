import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rightsSimulationSchema, withSimulationCommune } from '../src/rights-simulation';

const broadProfile = {
  schemaVersion: 2,
  period: '2026-09',
  adults: [{ age: 35, activity: 'independent', salaryNetSocial: 0, salaryTaxable: 0,
    unemploymentNet: 0, unemploymentTaxable: 0, pensionNet: 0, pensionTaxable: 0,
    otherResources: 0, independentIncome: 1400, disabilityRate: 55, rsdae: true,
    higherEducation: false, studentParentalResources2024: 0, studentDistanceKm: 0 }],
  children: [{ age: 4, birthMonth: 6, sharedCustody: true, disability: true, aeehLevel: 1 }],
  family: { pregnant: false, pregnancyMonth: 0, childSupportReceived: 100,
    childcareMonthlyCost: 320, parentalLeave: false },
  annualFamilyResources2024: 18000,
  taxIncome2024: 18000,
  assets: { savings: 4000, rentedPropertyValue: 0, otherPropertyValue: 0,
    landValue: 0, investmentIncomeMonthly: 10 },
  housing: { communeCode: '83137', rent: 650, charges: 60, occupancy: 'hlm',
    conventioned: true, furnished: false, colocation: false, surface: 55 },
  confirmations: { stableResources: false, residentInFrance: true, allResourcesDeclared: true },
};

test('broad rights profile accepts complex situations without requiring optimistic confirmations', () => {
  const parsed = rightsSimulationSchema.safeParse(broadProfile);
  assert.equal(parsed.success, true);
});

test('broad rights profile still rejects structurally invalid money and commune values', () => {
  assert.equal(rightsSimulationSchema.safeParse({ ...broadProfile, taxIncome2024: -1 }).success, false);
  assert.equal(rightsSimulationSchema.safeParse({ ...broadProfile, housing: { ...broadProfile.housing, communeCode: '83' } }).success, false);
});

test('postal-code resolution returns a new draft with the selected commune', () => {
  const next = withSimulationCommune(broadProfile as never, '83137');
  assert.equal(next.housing.communeCode, '83137');
  assert.notEqual(next, broadProfile);
});
