import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRights } from '../src/engine';
import { readProfile, saveProfile, clearProfile, validateProfile } from '../src/profile';
import type { Right } from '../src/types';

const now = new Date('2026-09-09T12:00:00Z');
const right = (id: string, extra: Partial<Right> = {}): Right => ({ id, name: id, provider: 'CAF', category: 'revenus-emploi', description: '', sourceUrl: 'https://www.service-public.gouv.fr', applicationUrl: 'https://www.caf.fr', checkedAt: '2026-09-09', reviewDue: '2026-09-16', conditions: [], caution: '', published: true, version: 1, ...extra });

test('RSA is a piste, never a simulated means test', () => {
  for (const monthlyIncome of [0, 900000]) {
    const [match] = evaluateRights({age: 30, children: 0, monthlyIncome}, [right('rsa')], now);
    assert.equal(match.status, 'possible');
    assert.match(match.reasons.join(' '), /piste à vérifier/i);
  }
});
test('missing questions stay missing; zero children is answered', () => {
  assert.deepEqual(evaluateRights({}, [right('rsa')], now)[0].missing, ['age', 'children']);
  assert.equal(evaluateRights({age: 30, children: 0}, [right('rsa')], now)[0].status, 'possible');
});
test('RSA under 25 preserves parent and young worker exceptions', () => {
  for (const children of [0, 1]) {
    const match = evaluateRights({age: 22, children}, [right('rsa')], now)[0];
    assert.equal(match.status, 'possible');
    assert.match(match.reasons.join(' '), /exception/i);
  }
});
test('AAH needs no medical question and makes no health inference', () => {
  const match = evaluateRights({}, [right('aah')], now)[0];
  assert.equal(match.status, 'outside');
  assert.deepEqual(match.missing, []);
  assert.match(match.reasons.join(' '), /MDPH/);
});
test('expired, invalid date, received and unpublished have explicit outcomes', () => {
  assert.equal(evaluateRights({}, [right('rsa', {reviewDue: '2026-09-08'})], now)[0].status, 'expired');
  assert.equal(evaluateRights({}, [right('rsa', {reviewDue: 'bad'})], now)[0].status, 'expired');
  assert.equal(evaluateRights({age: 30, children: 0}, [right('rsa', {reviewDue: '2026-09-09'})], now)[0].status, 'possible');
  assert.equal(evaluateRights({receivedRights: ['rsa']}, [right('rsa')], now)[0].status, 'received');
  assert.deepEqual(evaluateRights({}, [right('rsa', {published: false})], now), []);
});
test('unknown rule cannot create a positive match; condition strings are not executable', () => {
  assert.equal(evaluateRights({}, [right('unknown', {conditions: ['return true']})], now)[0].status, 'outside');
});
test('categorical orientation does not claim an administrative refusal', () => {
  assert.equal(evaluateRights({housing: 'tenant'}, [right('apl')], now)[0].status, 'possible');
  assert.equal(evaluateRights({housing: 'owner'}, [right('apl')], now)[0].status, 'outside');
  assert.equal(evaluateRights({activity: 'student'}, [right('bourse-crous')], now)[0].status, 'possible');
});
test('profile imports remove invalid values and unknown sensitive fields', () => {
  assert.deepEqual(validateProfile({ age: -3, children: 2, monthlyIncome: '300', household: 'alone', medical: true, receivedRights: ['rsa', 12] }), {children: 2, household: 'alone'});
  assert.deepEqual(validateProfile(null), {});
});
test('server profile calls retain no data', () => {
  saveProfile({age: 40});
  assert.deepEqual(readProfile(), {});
});
test('browser session profile validates and clears; storage failure falls back safely', () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {configurable: true, value: {sessionStorage: {getItem: (k:string) => storage.get(k) ?? null, setItem: (k:string,v:string) => storage.set(k,v), removeItem: (k:string) => storage.delete(k)}}});
  try {
    saveProfile({age: 42}); assert.equal(readProfile().age, 42);
    clearProfile(); assert.deepEqual(readProfile(), {});
    Object.defineProperty(window, 'sessionStorage', {get() { throw new Error('blocked'); }});
    saveProfile({age: 25}); assert.equal(readProfile().age, 25);
    clearProfile(); assert.deepEqual(readProfile(), {});
  } finally { Reflect.deleteProperty(globalThis, 'window'); }
});
