import { z } from 'zod';
import catalog from '../rules/right-rules.json';

/** Calendar dates only; Date.parse alone accepts impossible dates. */
export function calendarDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : NaN;
}

const date = z.string().refine(value => Number.isFinite(calendarDate(value)), 'Date calendaire invalide');
const field = z.enum(['age', 'children', 'activity', 'housing', 'household', 'postalCode']);
const criterion = z.union([
  z.object({field: z.enum(['age', 'children']), min: z.number().finite().optional(), max: z.number().finite().optional()}).strict()
    .refine(value => value.min !== undefined || value.max !== undefined)
    .refine(value => value.min === undefined || value.max === undefined || value.min <= value.max),
  z.object({field: z.literal('activity'), values: z.array(z.enum(['employee', 'unemployed', 'student', 'independent', 'retired', 'other'])).min(1)}).strict(),
  z.object({field: z.literal('housing'), values: z.array(z.enum(['tenant', 'owner', 'hosted'])).min(1)}).strict(),
  z.object({field: z.literal('household'), values: z.array(z.enum(['alone', 'couple'])).min(1)}).strict(),
  z.object({field: z.literal('postalCode'), values: z.array(z.string().regex(/^\d{5}$/)).min(1)}).strict(),
]);
const note = z.string().trim().min(1).max(2000);
const rule = z.object({
  rightId: z.string().regex(/^[a-z0-9-]{1,80}$/), version: z.number().int().positive(),
  required: z.array(field).max(6), any: z.array(criterion).min(1).max(30).optional(),
  note, outside: z.boolean().optional(),
  advisories: z.array(z.object({when: criterion, note}).strict()).max(20).optional(),
}).strict().refine(value => new Set(value.required).size === value.required.length)
  .refine(value => (value.any ?? []).every(condition => value.required.includes(condition.field)), 'Chaque critère doit être une réponse requise');

export const rightRulesSchema = z.object({
  schemaVersion: z.literal(1), version: z.number().int().positive(),
  reviewedAt: date, reviewDue: date, rules: z.array(rule).max(500),
}).strict().refine(value => value.reviewedAt <= value.reviewDue, 'Révision antérieure à la vérification')
  .refine(value => new Set(value.rules.map(rule => rule.rightId)).size === value.rules.length, 'Droit en doublon');

export type RightRulesCatalog = z.infer<typeof rightRulesSchema>;
export type RightCriterion = z.infer<typeof criterion>;
export function parseRightRules(input: unknown): RightRulesCatalog { return rightRulesSchema.parse(input); }
export const defaultRightRules = parseRightRules(catalog);
