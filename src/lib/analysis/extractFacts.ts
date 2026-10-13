import type { ClarificationQuestion, FactObject } from '@/lib/contracts/analysis';
import { parseDateFlexible, parseFcfaAmount, formatDateFr } from './rules';

/**
 * Extraction structurée déterministe (règles + heuristiques).
 * Option LLM possible plus tard ; ici zéro invention d'articles.
 */

export function extractFactsFromNarrative(narrative: string): FactObject {
  const text = narrative.trim();
  const lower = text.toLowerCase();

  const parties = extractParties(text);
  const dates = extractDates(text);
  const amounts = extractAmounts(text);
  const domainGuess = guessDomain(lower);
  const legalRelation = guessRelation(lower, domainGuess);
  const objective = guessObjective(lower);
  const admittedFacts = extractAdmitted(text, lower);
  const disputedFacts = extractDisputed(lower);
  const legalIssues = guessIssues(lower, domainGuess);
  const missingInfo = guessMissing(lower, dates, amounts, parties);
  const urgencies = guessUrgencies(lower, dates);
  const hypotheses: string[] = [];

  if (!parties.length) {
    hypotheses.push('Parties non clairement identifiées — compléter les qualités.');
  }
  if (domainGuess.includes('travail') && !dates.some((d) => /embauche|notification|licenciement/i.test(d.label))) {
    hypotheses.push('Chronologie emploi/licenciement incomplète.');
  }

  let confidence = 45;
  confidence += Math.min(20, parties.length * 8);
  confidence += Math.min(15, dates.length * 5);
  confidence += Math.min(10, amounts.length * 5);
  confidence += admittedFacts.length >= 3 ? 10 : 0;
  confidence -= missingInfo.length * 3;
  confidence = Math.max(15, Math.min(88, confidence));

  return {
    parties:
      parties.length > 0
        ? parties
        : [{ name: 'Partie non identifiée', quality: 'À préciser' }],
    jurisdiction: guessJurisdiction(lower),
    dates,
    legalRelation,
    admittedFacts:
      admittedFacts.length > 0
        ? admittedFacts
        : [summarizeNarrative(text)],
    disputedFacts,
    amounts,
    objective,
    legalIssues,
    missingInfo,
    urgencies,
    confidenceLevel: confidence,
    hypotheses,
    domainGuess,
  };
}

export function buildClarificationQuestions(facts: FactObject): ClarificationQuestion[] {
  const qs: ClarificationQuestion[] = [];
  const domain = (facts.domainGuess || facts.legalRelation || '').toLowerCase();
  const missing = new Set(facts.missingInfo.map((m) => m.toLowerCase()));

  // Uniquement si impact qualification / compétence / délai / preuve / document
  if (domain.includes('travail') || /licenciement|salari|employeur|contrat de travail/.test(domain + facts.admittedFacts.join(' '))) {
    if (
      !facts.admittedFacts.some((f) => /motif|faute|économique/i.test(f)) ||
      [...missing].some((m) => m.includes('motif') || m.includes('lettre'))
    ) {
      qs.push({
        id: 'q-motif-licenciement',
        question:
          'Avez-vous reçu une lettre de licenciement indiquant le motif exact (économique, faute, autre) ? Précisez le motif.',
        impact: 'Qualification juridique du licenciement et procédure applicable',
        required: true,
        category: 'qualification',
      });
    }
    if (!facts.admittedFacts.some((f) => /délégué|consultation/i.test(f))) {
      qs.push({
        id: 'q-delegues',
        question:
          "Y a-t-il des délégués du personnel dans l'entreprise, et une consultation a-t-elle eu lieu avant le licenciement ?",
        impact: 'Validité procédurale — peut modifier la qualification (abusif / régulier)',
        required: true,
        category: 'qualification',
      });
    }
    if (!facts.amounts.some((a) => /salaire/i.test(a.label))) {
      qs.push({
        id: 'q-salaire',
        question:
          'Quel est votre salaire mensuel brut (ou moyenne des 12 derniers mois) ? Disposez-vous des bulletins ?',
        impact: 'Calcul déterministe des indemnités et du préavis',
        required: true,
        category: 'document',
      });
    }
    if (!facts.dates.some((d) => /embauche|entrée/i.test(d.label))) {
      qs.push({
        id: 'q-embauche',
        question: "Quelle est la date d'embauche (JJ/MM/AAAA) ?",
        impact: 'Ancienneté, préavis, indemnité, prescription',
        required: true,
        category: 'delai',
      });
    }
    if (!facts.dates.some((d) => /licenciement|notification/i.test(d.label))) {
      qs.push({
        id: 'q-notif',
        question: 'Quelle est la date de notification du licenciement (JJ/MM/AAAA) ?',
        impact: 'Point de départ des délais et urgence procédurale',
        required: true,
        category: 'delai',
      });
    }
  }

  if (domain.includes('ohada') || /créance|impayé|injonction|recouvrement/.test(facts.admittedFacts.join(' ').toLowerCase())) {
    qs.push({
      id: 'q-creance',
      question:
        'La créance est-elle certaine, liquide et exigible ? Disposez-vous d’un titre (facture, contrat, reconnaissance) ?',
      impact: 'Conditions de l’injonction de payer / procédure de recouvrement',
      required: true,
      category: 'qualification',
    });
    if (!facts.amounts.length) {
      qs.push({
        id: 'q-montant-creance',
        question: 'Quel est le montant exact de la créance (FCFA) et la date d’échéance ?',
        impact: 'Liquidité de la créance et calculs de délais',
        required: true,
        category: 'preuve',
      });
    }
  }

  if (domain.includes('foncier') || /titre foncier|parcelle|domaine/.test(facts.admittedFacts.join(' ').toLowerCase())) {
    qs.push({
      id: 'q-titre',
      question: 'Disposez-vous d’un titre foncier, d’une ordonnance ou d’un acte administratif ? Référence ?',
      impact: 'Preuve du droit réel et compétence',
      required: true,
      category: 'preuve',
    });
  }

  // Compétence / lieu si absent
  if (!facts.jurisdiction || facts.jurisdiction.includes('non précisée')) {
    qs.push({
      id: 'q-lieu',
      question: 'Dans quelle ville / juridiction les faits se sont-ils déroulés ?',
      impact: 'Compétence territoriale',
      required: false,
      category: 'competence',
    });
  }

  // Limiter pour ne pas noyer l'utilisateur
  return qs.slice(0, 5);
}

export function mergeAnswersIntoFacts(
  facts: FactObject,
  answers: Record<string, string>
): FactObject {
  const next: FactObject = {
    ...facts,
    admittedFacts: [...facts.admittedFacts],
    missingInfo: [...facts.missingInfo],
    dates: [...facts.dates],
    amounts: [...facts.amounts],
    disputedFacts: [...facts.disputedFacts],
    hypotheses: [...(facts.hypotheses || [])],
  };

  for (const [id, raw] of Object.entries(answers)) {
    const answer = (raw || '').trim();
    if (!answer) continue;

    if (id === 'q-motif-licenciement') {
      next.admittedFacts.push(`Motif de licenciement indiqué par l’utilisateur : ${answer}`);
      next.missingInfo = next.missingInfo.filter((m) => !/motif|lettre/i.test(m));
    }
    if (id === 'q-delegues') {
      next.admittedFacts.push(`Délégués / consultation : ${answer}`);
      if (/non|pas|aucune|jamais/i.test(answer)) {
        next.disputedFacts.push('Consultation des délégués du personnel non établie');
      }
    }
    if (id === 'q-salaire') {
      const amt = parseFcfaAmount(answer);
      if (amt != null) {
        next.amounts.push({
          label: 'Salaire mensuel brut (déclaré)',
          amount: `${amt.toLocaleString('fr-FR')} FCFA`,
        });
      } else {
        next.admittedFacts.push(`Salaire (texte libre) : ${answer}`);
      }
      next.missingInfo = next.missingInfo.filter((m) => !/salaire|bulletin/i.test(m));
    }
    if (id === 'q-embauche') {
      const d = parseDateFlexible(answer) || parseDateFlexible(extractFirstDate(answer) || '');
      if (d) {
        next.dates = next.dates.filter((x) => !/embauche/i.test(x.label));
        next.dates.push({ label: "Date d'embauche", date: formatDateFr(d) });
      } else {
        next.admittedFacts.push(`Date d'embauche déclarée : ${answer}`);
      }
    }
    if (id === 'q-notif') {
      const d = parseDateFlexible(answer) || parseDateFlexible(extractFirstDate(answer) || '');
      if (d) {
        next.dates = next.dates.filter((x) => !/licenciement|notification/i.test(x.label));
        next.dates.push({ label: 'Date de notification de licenciement', date: formatDateFr(d) });
      }
    }
    if (id === 'q-creance' || id === 'q-montant-creance' || id === 'q-titre' || id === 'q-lieu') {
      next.admittedFacts.push(`Réponse (${id}) : ${answer}`);
      if (id === 'q-lieu') {
        next.jurisdiction = answer;
      }
      const amt = parseFcfaAmount(answer);
      if (amt != null && id === 'q-montant-creance') {
        next.amounts.push({
          label: 'Montant de la créance',
          amount: `${amt.toLocaleString('fr-FR')} FCFA`,
        });
      }
    }
  }

  // Recalcul confiance
  let confidence = facts.confidenceLevel;
  const answered = Object.values(answers).filter((a) => a.trim()).length;
  confidence = Math.min(92, confidence + answered * 4);
  next.confidenceLevel = confidence;
  next.missingInfo = next.missingInfo.filter((m) => {
    // retirer si on a une réponse liée
    return true;
  });

  return next;
}

function extractFirstDate(s: string): string | null {
  const m = s.match(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}/);
  return m?.[0] ?? null;
}

function extractParties(text: string): { name: string; quality: string }[] {
  const parties: { name: string; quality: string }[] = [];
  const cAgainst = text.match(
    /([A-ZÀ-Ü][\wÀ-ú.'’\- ]{2,40})\s+(?:c\/|c\.|contre)\s+([A-ZÀ-Ü][\wÀ-ú.'’\- ]{2,60})/
  );
  if (cAgainst) {
    parties.push({ name: cAgainst[1].trim(), quality: 'Demandeur potentiel' });
    parties.push({ name: cAgainst[2].trim(), quality: 'Défendeur potentiel' });
  }

  const sarl = text.match(/\b(SARL|SA|SAS|EURL|Etablissements?|Ets\.?)\s+([A-ZÀ-Ü][\wÀ-ú&.'’\- ]{2,40})/gi);
  if (sarl) {
    for (const s of sarl.slice(0, 2)) {
      if (!parties.some((p) => p.name.toLowerCase() === s.trim().toLowerCase())) {
        parties.push({ name: s.trim(), quality: 'Personne morale / employeur potentiel' });
      }
    }
  }

  const person = text.match(
    /\b(Mme|Mlle|M\.|Monsieur|Madame)\s+([A-ZÀ-Ü][\wÀ-ú\-']+(?:\s+[A-ZÀ-Ü][\wÀ-ú\-']+){0,2})/g
  );
  if (person) {
    for (const p of person.slice(0, 2)) {
      if (!parties.some((x) => p.includes(x.name))) {
        parties.push({
          name: p.trim(),
          quality: /salari|employé/i.test(text) ? 'Salarié(e) potentiel(le)' : 'Personne physique',
        });
      }
    }
  }

  return parties.slice(0, 4);
}

function extractDates(text: string): { label: string; date: string }[] {
  const out: { label: string; date: string }[] = [];
  const re = /(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/g;
  let m: RegExpExecArray | null;
  const found: string[] = [];
  while ((m = re.exec(text)) !== null) found.push(m[1]);

  for (const raw of found) {
    const d = parseDateFlexible(raw);
    if (!d) continue;
    const idx = text.indexOf(raw);
    const window = text.slice(Math.max(0, idx - 40), idx + raw.length + 20).toLowerCase();
    let label = 'Date mentionnée';
    if (/embauch|entrée|depuis|contrat/.test(window)) label = "Date d'embauche";
    else if (/licenci|notifi|reçu|lettre/.test(window)) label = 'Date de notification de licenciement';
    else if (/échéance|payable|impay/.test(window)) label = "Date d'échéance";
    if (!out.some((x) => x.date === formatDateFr(d) && x.label === label)) {
      out.push({ label, date: formatDateFr(d) });
    }
  }
  return out.slice(0, 6);
}

function extractAmounts(text: string): { label: string; amount: string }[] {
  const out: { label: string; amount: string }[] = [];
  const re = /(\d{1,3}(?:[ .\u00a0]\d{3})+|\d+)\s*(?:FCFA|F\s*CFA|XAF)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const amt = parseFcfaAmount(m[0]);
    if (amt == null || amt < 1000) continue;
    // Ignorer les années type 2019/2026 capturées hors contexte monétaire
    if (amt >= 1900 && amt <= 2100 && !/FCFA|F\s*CFA|XAF/i.test(m[0])) {
      const idx = m.index;
      const near = text.slice(Math.max(0, idx - 12), idx + m[0].length + 12);
      if (/\d{1,2}[\/.\-]\d{1,2}[\/.\-]/.test(near) || /depuis|en\s+\d{4}|année/i.test(near)) {
        continue;
      }
    }
    const idx = m.index;
    const window = text.slice(Math.max(0, idx - 30), idx + 20).toLowerCase();
    let label = 'Montant mentionné';
    if (/salaire|mensuel|brut/.test(window)) label = 'Salaire mensuel brut';
    else if (/créance|dette|impay|facture/.test(window)) label = 'Créance / montant dû';
    else if (/indemnité/.test(window)) label = 'Indemnité mentionnée';
    // Montants « salaire » absurdes (< 50 000) sans FCFA explicite : ignorer
    if (label === 'Salaire mensuel brut' && amt < 50000 && !/FCFA|XAF/i.test(m[0])) {
      continue;
    }
    out.push({ label, amount: `${amt.toLocaleString('fr-FR')} FCFA` });
  }
  const seen = new Set<string>();
  return out
    .filter((a) => {
      const k = `${a.label}|${a.amount}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 5);
}

function guessDomain(lower: string): string {
  if (/licenci|salari|employeur|contrat de travail|préavis|cnps/.test(lower)) {
    return 'Droit du travail';
  }
  if (/ohada|injonction de payer|créance|recouvrement|audcg|aupsrve|sarl|associé/.test(lower)) {
    return 'Droit commercial OHADA';
  }
  if (/foncier|titre foncier|parcelle|domaine|cadastre/.test(lower)) {
    return 'Droit foncier';
  }
  if (/marché public|appel d'offres|maître d'ouvrage/.test(lower)) {
    return 'Marchés publics';
  }
  return 'Droit général';
}

function guessRelation(lower: string, domain: string): string {
  if (domain.includes('travail')) {
    if (/cdd|durée déterminée/.test(lower)) return 'Contrat de travail à durée déterminée — droit du travail camerounais';
    return 'Contrat de travail (CDI présumé si non précisé) — droit du travail camerounais';
  }
  if (domain.includes('OHADA')) return 'Relation commerciale / créance — espace OHADA';
  if (domain.includes('foncier')) return 'Relation foncière / domaniale';
  return 'Relation juridique à préciser';
}

function guessObjective(lower: string): string {
  if (/contester|abusif|annul/.test(lower)) return 'Contester un acte et obtenir réparation / indemnités';
  if (/recouvr|paiement|impay/.test(lower)) return 'Obtenir le paiement d’une créance';
  if (/titre foncier|reconnaissance/.test(lower)) return 'Sécuriser ou faire reconnaître un droit foncier';
  return 'Obtenir une analyse juridique et les prochaines démarches';
}

function extractAdmitted(text: string, lower: string): string[] {
  const facts: string[] = [];
  if (/licenci/.test(lower)) facts.push('Un licenciement est allégué dans le récit');
  if (/contrat/.test(lower)) facts.push('Existence d’un contrat mentionnée');
  if (/délégué/.test(lower) && /pas|sans|aucune|non/.test(lower)) {
    facts.push('Absence de consultation des délégués alléguée par l’utilisateur');
  }
  // phrases courtes du récit
  const sentences = text.split(/[.!?\n]+/).map((s) => s.trim()).filter((s) => s.length > 25 && s.length < 220);
  for (const s of sentences.slice(0, 4)) {
    if (!facts.includes(s)) facts.push(s);
  }
  return facts.slice(0, 8);
}

function extractDisputed(lower: string): string[] {
  const d: string[] = [];
  if (/peut-être|semble|je pense|à ma connaissance|non confirmé/.test(lower)) {
    d.push('Certains faits sont présentés sous réserve / non confirmés');
  }
  if (/licenci/.test(lower) && !/motif/.test(lower)) {
    d.push('Motif exact du licenciement non établi dans le récit initial');
  }
  return d;
}

function guessIssues(lower: string, domain: string): string[] {
  const issues: string[] = [];
  if (domain.includes('travail')) {
    issues.push('Le licenciement respecte-t-il la procédure légale applicable ?');
    issues.push('Quelles indemnités sont dues et selon quel calcul vérifiable ?');
    issues.push('Y a-t-il matière à licenciement abusif ?');
    issues.push('Quel est le délai pour agir ?');
  } else if (domain.includes('OHADA')) {
    issues.push('La créance est-elle certaine, liquide et exigible ?');
    issues.push('Quelle procédure de recouvrement est ouverte (injonction de payer, etc.) ?');
  } else if (domain.includes('foncier')) {
    issues.push('Quel est le titre ou le fondement du droit revendiqué ?');
    issues.push('Quelle autorité / juridiction est compétente ?');
  } else {
    issues.push('Quelle est la qualification juridique des faits ?');
    issues.push('Quels textes du corpus s’appliquent ?');
  }
  return issues;
}

function guessMissing(
  lower: string,
  dates: { label: string }[],
  amounts: { label: string }[],
  parties: { name: string }[]
): string[] {
  const m: string[] = [];
  if (/licenci/.test(lower)) {
    m.push('Lettre de licenciement (motif exact)');
    m.push('Contrat de travail signé');
    m.push('Bulletins de salaire des 12 derniers mois');
    if (!dates.some((d) => /embauche/i.test(d.label))) m.push("Date d'embauche précise");
  }
  if (/créance|impay/.test(lower)) {
    m.push('Pièce justificative de la créance (facture, contrat)');
  }
  if (parties.length < 2) m.push('Identification complète des parties et qualités');
  if (!amounts.length && /indemnité|salaire|créance|montant/.test(lower)) {
    m.push('Montants chiffrés (salaire, créance)');
  }
  return m;
}

function guessUrgencies(lower: string, dates: { label: string; date: string }[]): string[] {
  const u: string[] = [];
  if (/urgent|immédiat|délai|prescription/.test(lower)) {
    u.push('Le récit mentionne une urgence ou un délai — à vérifier par calcul déterministe');
  }
  const notif = dates.find((d) => /licenciement|notification/i.test(d.label));
  if (notif) {
    u.push(`Point de départ potentiel des délais : ${notif.label} (${notif.date})`);
  }
  return u;
}

function guessJurisdiction(lower: string): string {
  if (/douala/.test(lower)) return 'Douala (juridiction à confirmer — chambre sociale si litige travail)';
  if (/yaoundé|yaounde/.test(lower)) return 'Yaoundé (juridiction à confirmer)';
  if (/ohada|ccja/.test(lower)) return 'Espace OHADA (juridiction nationale compétente à préciser)';
  return 'Juridiction non précisée — à confirmer';
}

function summarizeNarrative(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 280 ? `${t.slice(0, 280)}…` : t;
}
