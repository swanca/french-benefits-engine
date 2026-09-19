import { z } from 'zod';
import type { Profile } from './types';
import { rightsSimulationSchema } from './rights-simulation';

const money = z.number().finite().min(0).max(100000);
const fields = {
  age: z.number().int().min(0).max(120), postalCode: z.string().regex(/^\d{5}$/),
  commune: z.string().trim().min(1).max(120), communeCode: z.string().regex(/^(?:\d{5}|2[AB]\d{3})$/),
  activity: z.enum(['employee', 'unemployed', 'student', 'independent', 'retired', 'other']),
  household: z.enum(['alone', 'couple']), children: z.number().int().min(0).max(20),
  housing: z.enum(['tenant', 'owner', 'hosted']), rent: money, monthlyIncome: money,
  vehicle: z.enum(['yes', 'no']), fuel: z.enum(['e10', 'sp95', 'sp98', 'gazole', 'e85', 'gplc']),
  mobileBill: money, internetBill: money, energyBill: money,
  mobileDataGB: z.number().int().min(0).max(1000),
  billExitFees: z.object({mobile:money.optional(),internet:money.optional()}).strict(),
  selectedBillOffers: z.object({mobile:z.string().regex(/^[a-z0-9-]{1,100}$/).optional(),internet:z.string().regex(/^[a-z0-9-]{1,100}$/).optional()}).strict(),
  receivedRights: z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).max(100),
  rightsSimulation: rightsSimulationSchema,
} satisfies Record<keyof Profile, z.ZodType>;

/** Unknown and invalid fields are discarded individually, with no type coercion. */
export function validateProfile(input: unknown): Profile {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(fields)) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const parsed = schema.safeParse((input as Record<string, unknown>)[key]);
    if (parsed.success) result[key] = parsed.data;
  }
  return result as Profile;
}

/** Detailed rights answers can include health and disability data; they stay in session storage. */
export function profileForAccount(input: unknown): Profile {
  const { rightsSimulation: _sensitiveAnswers, ...profile } = validateProfile(input);
  return profile;
}

const STORAGE_KEY = 'plus-en-poche:profile:v1';
let fallback: Profile = {};
let memoryOnly = false;
export function readProfile(): Profile {
  if (typeof window === 'undefined') return {};
  if (memoryOnly) return validateProfile(fallback);
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    fallback = raw ? validateProfile(JSON.parse(raw)) : {};
  } catch { /* Private browsing or invalid saved JSON: use this tab's memory. */ }
  return validateProfile(fallback);
}
export function saveProfile(profile: Profile): void {
  if (typeof window === 'undefined') return;
  fallback = validateProfile(profile);
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fallback)); memoryOnly = false; }
  catch { memoryOnly = true; }
}
export function clearProfile(): void {
  if (typeof window === 'undefined') return;
  fallback = {};
  try { window.sessionStorage.removeItem(STORAGE_KEY); memoryOnly = false; }
  catch { memoryOnly = true; }
}
