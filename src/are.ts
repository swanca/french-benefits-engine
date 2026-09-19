export type AreInput = {
  age: number;
  contractStart: string;
  contractEnd: string;
  grossReferenceSalary: number;
  workedDays: number;
  workedHours: number;
  excludedDays: number;
  partTimePercent: number;
  terminationReason: 'end-contract' | 'dismissal' | 'economic-dismissal' | 'conventional-termination' | 'legitimate-resignation' | 'ordinary-resignation';
  territory: 'metropole' | 'drom';
  paidLeaveCompensation: number;
  supraLegalCompensation: number;
  waitingAppliedPast12Months: boolean;
  firstRightIn20Years: boolean;
  seasonal?: boolean;
  seekingWork: boolean;
  fullRatePension: boolean;
};

export type AreResult = {
  eligibility: 'possible' | 'unlikely';
  referenceDays: number;
  sjr: number;
  dailyGross: number;
  monthlyGross: number;
  monthlyNetLow: number;
  monthlyNetHigh: number;
  durationDays: number;
  waitingDays: number;
  degressiveMonthlyGross: number | null;
  notes: string[];
};

const DAY = 86_400_000;
const roundMoney = (value: number) => Math.round(value * 100) / 100;
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));

export function estimateAre(input: AreInput): AreResult {
  const numbers = [input.age, input.grossReferenceSalary, input.workedDays, input.workedHours, input.excludedDays,
    input.partTimePercent, input.paidLeaveCompensation, input.supraLegalCompensation];
  if (numbers.some(value => !Number.isFinite(value) || value < 0) || input.age < 16 || input.age > 80 ||
      input.partTimePercent <= 0 || input.partTimePercent > 100 || !validDate(input.contractStart) || !validDate(input.contractEnd)) {
    throw new Error('Vérifiez les informations saisies.');
  }
  const start = Date.parse(`${input.contractStart}T00:00:00Z`);
  const end = Date.parse(`${input.contractEnd}T00:00:00Z`);
  if (start > end || input.grossReferenceSalary <= 0 || input.workedDays <= 0) throw new Error('La période de travail ou le salaire de référence est invalide.');

  const calendarDays = Math.floor((end - start) / DAY) + 1;
  const windowDays = input.age >= 55 ? 1_095 : 730;
  const adjustedSpan = Math.max(1, Math.min(calendarDays, windowDays) - Math.round(input.excludedDays));
  const referenceDays = Math.max(1, Math.round(Math.min(adjustedSpan, input.workedDays * 1.7)));
  const sjr = input.grossReferenceSalary / referenceDays;
  const coefficient = input.partTimePercent / 100;
  const dailyGross = roundMoney(Math.min(
    Math.max(0.404 * sjr + 13.18 * coefficient, 0.57 * sjr, 32.13 * coefficient),
    0.75 * sjr,
  ));
  const monthlyGross = roundMoney(dailyGross * 30);

  const specialFiveMonths = Boolean(input.seasonal) || (input.firstRightIn20Years && end >= Date.parse('2026-04-01T00:00:00Z'));
  const minimumWorkedDays = specialFiveMonths ? 108 : 130;
  const minimumWorkedHours = specialFiveMonths ? 758 : 910;
  const affiliationMet = input.workedDays >= minimumWorkedDays || input.workedHours >= minimumWorkedHours;
  const voluntaryLoss = input.terminationReason === 'ordinary-resignation';
  const eligibility = affiliationMet && !voluntaryLoss && input.seekingWork && !input.fullRatePension ? 'possible' : 'unlikely';

  const coefficientDuration = input.territory === 'drom' ? 1 : 0.75;
  const standardCap = input.territory === 'drom'
    ? (input.age < 55 ? 730 : input.age < 57 ? 913 : 1_095)
    : (input.age < 55 ? 548 : input.age < 57 ? 685 : 822);
  const isNewConventionalRule = input.terminationReason === 'conventional-termination' && end >= Date.parse('2026-09-01T00:00:00Z');
  const conventionalCap = input.territory === 'drom'
    ? (input.age < 55 ? 608 : 913)
    : (input.age < 55 ? 456 : 624);
  const minimumDuration = specialFiveMonths ? 152 : 182;
  const rawDuration = Math.round(referenceDays * coefficientDuration);
  const durationDays = eligibility === 'possible'
    ? Math.min(Math.max(rawDuration, minimumDuration), isNewConventionalRule ? conventionalCap : standardCap)
    : 0;

  const leaveDelay = Math.min(30, Math.ceil(input.paidLeaveCompensation / sjr));
  const specificDelay = Math.min(input.terminationReason === 'economic-dismissal' ? 75 : 150, Math.ceil(input.supraLegalCompensation / 111.8));
  const waitingDays = leaveDelay + specificDelay + (input.waitingAppliedPast12Months ? 0 : 7);
  const averageMonthlySalary = input.grossReferenceSalary / Math.max(1, referenceDays / 30);
  const degressive = input.age < 55 && averageMonthlySalary > 4_939.67
    ? roundMoney(Math.max(monthlyGross * 0.7, 92.57 * 30))
    : null;

  const notes: string[] = [];
  if (!affiliationMet) notes.push(`Durée travaillée insuffisante avec les données saisies : ${minimumWorkedDays} jours ou ${minimumWorkedHours} heures sont attendus.`);
  if (voluntaryLoss) notes.push('Une démission ordinaire n’ouvre généralement pas immédiatement droit à l’ARE.');
  if (!input.seekingWork) notes.push('L’inscription et la recherche effective d’un emploi sont nécessaires.');
  if (input.fullRatePension) notes.push('Une retraite à taux plein empêche en principe l’ouverture de ce droit.');
  if (isNewConventionalRule) notes.push('Le plafond réduit applicable à une rupture conventionnelle individuelle depuis le 1er septembre 2026 est appliqué.');
  if (input.seasonal) notes.push('Le seuil minimal de cinq mois propre aux activités saisonnières est appliqué.');
  if (degressive !== null) notes.push('Une baisse pouvant aller jusqu’à 30 % peut s’appliquer à partir du 7e mois ; le montant après baisse est affiché séparément.');
  notes.push('Le montant net dépend des prélèvements sociaux et du prélèvement à la source.');

  return {
    eligibility, referenceDays, sjr: roundMoney(sjr), dailyGross, monthlyGross,
    monthlyNetLow: roundMoney(monthlyGross * 0.86), monthlyNetHigh: roundMoney(monthlyGross * 0.97),
    durationDays, waitingDays, degressiveMonthlyGross: degressive, notes,
  };
}
