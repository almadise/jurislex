/**
 * Tests C2a : npx tsx src/lib/analysis/rules.test.ts
 */
import {
  calcSeveranceHypothesis,
  calcSeveranceEligibility,
  calcPrescriptionSalaryIndemnity,
  calcNoticeIndemnity,
  calcOhadaOppositionDeadline,
  calcOhadaSaisieVenteEarliest,
  monthsBetween,
  parseFcfaAmount,
  yearsBetween,
  formatDateFr,
} from './rules';
import { listVerifiedRules, getRuleAnchor } from './ruleRegistry';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const hire = new Date(2019, 0, 3);
const end = new Date(2026, 4, 28);
assert(yearsBetween(hire, end) === 7, 'yearsBetween 7');
assert(monthsBetween(hire, end) >= 7 * 12, 'monthsBetween');

assert(parseFcfaAmount('450 000 FCFA') === 450000, 'parse salary');
assert(parseFcfaAmount('1.350.000') === 1350000, 'parse dotted');

// Prescription 3 ans Art. 74 (verified)
const presc = calcPrescriptionSalaryIndemnity(end);
assert(presc.result === '28/05/2029', `presc 3 ans got ${presc.result}`);
assert(presc.status === 'computed', 'presc computed');
assert(presc.id === 'prescription-salaire-indemnites-3ans', 'presc id');

// Conditions Art. 37
const elig = calcSeveranceEligibility({
  hireDate: hire,
  endDate: end,
  employerInitiated: true,
  seriousMisconduct: false,
});
assert(elig.status === 'computed', 'elig status');
assert(elig.result.includes('remplies'), `elig result ${elig.result}`);

const eligShort = calcSeveranceEligibility({
  hireDate: new Date(2025, 0, 1),
  endDate: end,
  employerInitiated: true,
});
assert(eligShort.result.includes('non réunies'), 'elig short seniority');

// Montant still hypothesis
const sevr = calcSeveranceHypothesis({
  monthlySalary: 450000,
  hireDate: hire,
  endDate: end,
});
assert(sevr.status === 'hypothesis_only', 'severance status');
assert(Number(sevr.result.replace(/\s/g, '')) === Math.round(0.2 * 450000 * 7), 'severance amount');

const blocked = calcSeveranceHypothesis({
  monthlySalary: null,
  hireDate: hire,
  endDate: end,
});
assert(blocked.status === 'blocked_missing_input', 'blocked without salary');

// Art. 36 notice indemnity
const noticeInd = calcNoticeIndemnity({
  monthlySalary: 450000,
  noticeMonths: 2,
});
assert(noticeInd.status === 'computed', 'notice ind computed');
assert(Number(noticeInd.result.replace(/\s/g, '')) === 900000, 'notice amount');

// OHADA
const sig = new Date(2026, 0, 10);
const opp = calcOhadaOppositionDeadline(sig);
assert(opp.result === formatDateFr(new Date(2026, 0, 20)), `opp ${opp.result}`);
assert(opp.status === 'computed', 'opp computed');

const cmd = new Date(2026, 2, 1);
const saisie = calcOhadaSaisieVenteEarliest(cmd);
assert(saisie.result === formatDateFr(new Date(2026, 2, 9)), `saisie ${saisie.result}`);

// Registry
const verified = listVerifiedRules();
assert(verified.length >= 5, `expected ≥5 verified rules, got ${verified.length}`);
assert(getRuleAnchor('prescription-salaire-indemnites-3ans')?.status === 'verified', 'registry presc');

console.log('OK rules tests (C2a)', { verified: verified.length });
