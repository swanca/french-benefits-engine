import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateAre } from '../src/are';

const base = {
  age: 40,
  contractStart: '2024-09-01',
  contractEnd: '2026-08-31',
  grossReferenceSalary: 36_000,
  workedDays: 520,
  workedHours: 3_640,
  excludedDays: 0,
  partTimePercent: 100,
  terminationReason: 'end-contract' as const,
  territory: 'metropole' as const,
  paidLeaveCompensation: 0,
  supraLegalCompensation: 0,
  waitingAppliedPast12Months: false,
  firstRightIn20Years: false,
  seekingWork: true,
  fullRatePension: false,
};

test('ARE estimates the official daily formula, 30-day month and duration', () => {
  const result = estimateAre(base);
  assert.equal(result.eligibility, 'possible');
  assert.equal(result.referenceDays, 730);
  assert.equal(result.durationDays, 548);
  assert.equal(result.dailyGross, 33.1);
  assert.equal(result.monthlyGross, 993);
  assert.equal(result.waitingDays, 7);
});

test('ARE caps post September 2026 individual conventional termination', () => {
  const result = estimateAre({ ...base, contractEnd: '2026-09-10', terminationReason: 'conventional-termination' });
  assert.equal(result.durationDays, 456);
  assert.match(result.notes.join(' '), /rupture conventionnelle/i);
});

test('ARE rejects an ordinary resignation and estimates cumulative deferrals', () => {
  assert.equal(estimateAre({ ...base, terminationReason: 'ordinary-resignation' }).eligibility, 'unlikely');
  const delayed = estimateAre({ ...base, paidLeaveCompensation: 1_000, supraLegalCompensation: 11_180 });
  assert.equal(delayed.waitingDays, 128);
});

test('ARE uses the five-month threshold for a first right in twenty years', () => {
  const result = estimateAre({ ...base, workedDays: 108, workedHours: 758, firstRightIn20Years: true });
  assert.equal(result.eligibility, 'possible');
  assert.equal(result.durationDays, 152);
});
