export type Category = 'revenus-emploi' | 'logement-energie' | 'famille' | 'etudes-formation' | 'handicap-autonomie' | 'mobilite';
export type Right = {
  id: string; name: string; provider: string; category: Category; description: string;
  sourceUrl: string; applicationUrl: string; checkedAt: string; reviewDue: string;
  conditions: string[]; caution: string; published: boolean; version: number;
};
export type Profile = {
  age?: number; postalCode?: string; commune?: string; communeCode?: string;
  activity?: 'employee' | 'unemployed' | 'student' | 'independent' | 'retired' | 'other';
  household?: 'alone' | 'couple'; children?: number;
  housing?: 'tenant' | 'owner' | 'hosted'; rent?: number;
  monthlyIncome?: number; vehicle?: 'yes' | 'no'; fuel?: string;
  mobileBill?: number; internetBill?: number; energyBill?: number;
  mobileDataGB?: number;
  selectedBillOffers?: {mobile?: string; internet?: string};
  billExitFees?: {mobile?: number; internet?: number};
  receivedRights?: string[];
  rightsSimulation?: import('./rights-simulation').RightsSimulationInput;
};
export type Match = {right: Right; status: 'possible' | 'missing' | 'outside' | 'expired' | 'received'; reasons: string[]; missing: string[]};
