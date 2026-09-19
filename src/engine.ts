import type { Match, Profile, Right } from './types';
import { validateProfile } from './profile';
import { calendarDate, defaultRightRules, rightRulesSchema, type RightCriterion, type RightRulesCatalog } from './right-rules';

function matches(profile: Profile, criterion: RightCriterion): boolean {
  const value = profile[criterion.field];
  if ('values' in criterion) return typeof value === 'string' && (criterion.values as readonly string[]).includes(value);
  return typeof value === 'number' && (criterion.min === undefined || value >= criterion.min)
    && (criterion.max === undefined || value <= criterion.max);
}

/** Orientation only. Neither catalogue prose nor rule notes are executable. */
export function evaluateRights(profile: Profile, rights: Right[], now?: Date): Match[];
export function evaluateRights(profile: Profile, rights: Right[], rules?: RightRulesCatalog, now?: Date): Match[];
export function evaluateRights(profile: Profile, rights: Right[], rulesOrNow: RightRulesCatalog | Date = defaultRightRules, referenceTime = new Date()): Match[] {
  const clean = validateProfile(profile);
  const now = rulesOrNow instanceof Date ? rulesOrNow : referenceTime;
  const parsed = rightRulesSchema.safeParse(rulesOrNow instanceof Date ? defaultRightRules : rulesOrNow);
  const catalog = parsed.success ? parsed.data : undefined;
  const timestamp = now.getTime();
  const ruleIndex = new Map(catalog?.rules.map(rule => [rule.rightId, rule]));
  return rights.filter(right => right.published).map(right => {
    const result = (status: Match['status'], reasons: string[], missing: string[] = []): Match => ({right, status, reasons, missing});
    // A received benefit can never become a new prospect, including after review expiry.
    if (clean.receivedRights?.includes(right.id)) return result('received', ['Vous avez déclaré percevoir ce droit. Il ne constitue pas un gain supplémentaire.']);
    const checked = calendarDate(right.checkedAt);
    const deadline = calendarDate(right.reviewDue) + 86400000;
    if (!Number.isFinite(timestamp) || !Number.isFinite(checked) || !Number.isFinite(deadline) || checked >= deadline
      || timestamp < checked || timestamp >= deadline) return result('expired', ['La période de vérification de cette fiche est dépassée, future ou invalide. Consultez la source officielle ; cette piste doit être revue.']);
    if (!catalog) return result('outside', ['Les règles d’orientation sont invalides. Consultez la source officielle.']);
    if (timestamp < calendarDate(catalog.reviewedAt) || timestamp >= calendarDate(catalog.reviewDue) + 86400000)
      return result('expired', ['Les règles d’orientation doivent être revues pour cette date. Consultez la source officielle.']);
    const rule = ruleIndex.get(right.id);
    if (!rule) return result('outside', ['Cette fiche n’a pas de règle d’orientation validée dans ce questionnaire. Consultez sa source officielle.']);
    // Medical eligibility is deliberately unavailable, even with an injected catalogue.
    if (right.id === 'aah') return result('outside', ['Orientation générale vers la MDPH : aucune situation médicale n’est déduite ni demandée ici. Ce questionnaire ne peut pas évaluer ce droit.']);
    if (rule.outside) return result('outside', [rule.note]);
    const missing = rule.required.filter(field => clean[field] === undefined);
    if (missing.length) return result('missing', ['Des réponses générales manquent pour orienter cette piste.', rule.note], missing);
    if (rule.any && !rule.any.some(criterion => matches(clean, criterion))) return result('outside', ['Votre situation n’est pas évaluée par cette orientation simplifiée. Cela ne constitue pas un refus de droit.', rule.note]);
    return result('possible', [
      'Piste à vérifier auprès de l’organisme officiel, sans décision ni montant personnel.', rule.note,
      ...(rule.advisories ?? []).filter(advisory => matches(clean, advisory.when)).map(advisory => advisory.note),
    ]);
  });
}
