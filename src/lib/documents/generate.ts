import { randomUUID } from 'crypto';
import type {
  DocumentTemplateDef,
  GenerateDocumentRequest,
  GeneratedDocument,
} from '@/lib/contracts/document';
import { getTemplate } from './templates';

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function findUnresolvedPlaceholders(text: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    found.add(m[1]);
  }
  return [...found];
}

export function renderTemplate(
  templateBody: string,
  values: Record<string, string>
): string {
  return templateBody.replace(PLACEHOLDER_RE, (_full, key: string) => {
    const v = values[key];
    if (v === undefined || v === null) return `{{${key}}}`;
    return String(v);
  });
}

export function validateFields(
  template: DocumentTemplateDef,
  fields: Record<string, string>
): { ok: boolean; missing: string[]; empty: string[] } {
  const missing: string[] = [];
  const empty: string[] = [];
  for (const f of template.fields) {
    if (!f.required) continue;
    if (!(f.key in fields) || fields[f.key] === undefined) {
      missing.push(f.key);
      continue;
    }
    if (!String(fields[f.key]).trim()) empty.push(f.key);
  }
  return { ok: missing.length === 0 && empty.length === 0, missing, empty };
}

export function generateDocument(input: GenerateDocumentRequest): GeneratedDocument {
  const template = getTemplate(input.templateId);
  if (!template) {
    throw Object.assign(new Error(`Modèle inconnu : ${input.templateId}`), { status: 404 });
  }

  const validation = validateFields(template, input.fields);
  if (!validation.ok) {
    const detail = [...validation.missing, ...validation.empty].join(', ');
    throw Object.assign(
      new Error(`Champs obligatoires manquants ou vides : ${detail}`),
      { status: 400, missing: validation.missing, empty: validation.empty }
    );
  }

  // Normaliser champs (trim) — aucune chaîne vide pour requis.
  // Échapper {{ }} dans les valeurs utilisateur pour bloquer l'injection de placeholders.
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.fields)) {
    clean[k] = String(v)
      .trim()
      .replace(/\{\{/g, '{ {')
      .replace(/\}\}/g, '} }');
  }

  const today = new Date();
  const dateDocument =
    input.dateDocument?.trim() ||
    `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const lieu = input.lieu?.trim() || 'Yaoundé';

  const values: Record<string, string> = {
    ...clean,
    date_document: dateDocument,
    lieu,
  };

  const body = renderTemplate(template.bodyTemplate, values);
  const unresolved = findUnresolvedPlaceholders(body);

  if (unresolved.length > 0) {
    throw Object.assign(
      new Error(
        `Variables non résolues dans le document : ${unresolved.map((u) => `{{${u}}}`).join(', ')}. Export refusé.`
      ),
      { status: 422, unresolved }
    );
  }

  // Double contrôle : aucun [placeholder] style UI
  if (/\[(?:Expéditeur|Destinataire|Objet|Montant|Délai)[^\]]*\]/i.test(body)) {
    throw Object.assign(new Error('Placeholders UI résiduels détectés — export refusé.'), {
      status: 422,
    });
  }

  const warnings: string[] = [];
  if (template.humanReviewLevel === 'recommended') {
    warnings.push('Revue professionnelle recommandée avant envoi.');
  }
  if (template.humanReviewLevel === 'required') {
    warnings.push(
      'Revue professionnelle OBLIGATOIRE avant tout dépôt. Document marqué PROJET.'
    );
  }
  warnings.push(
    'Assistance documentaire JurisLex — ne constitue pas un avis d’avocat ni une garantie de résultat.'
  );
  const attachments = template.attachments ?? [];
  if (attachments.length) {
    warnings.push(`Pièces à joindre : ${attachments.join(' ; ')}.`);
  }

  let blocked = false;
  let blockReason: string | undefined;
  let watermark: string | undefined;

  if (template.humanReviewLevel === 'required') {
    watermark = 'PROJET — REVUE PROFESSIONNELLE OBLIGATOIRE AVANT DÉPÔT';
    if (!input.confirmProfessionalReview) {
      blocked = true;
      blockReason =
        'Modèle à revue obligatoire : confirmez avoir pris connaissance de l’obligation de revue professionnelle pour autoriser l’export (le document restera filigrané PROJET).';
    }
  }

  return {
    id: randomUUID(),
    templateId: template.id,
    templateVersion: template.version,
    title: template.name,
    body,
    fields: clean,
    legalBasis: template.legalBasis,
    attachments,
    humanReviewLevel: template.humanReviewLevel,
    warnings,
    unresolvedPlaceholders: [],
    blocked,
    blockReason,
    watermark,
    matterId: input.matterId ?? null,
    createdAt: new Date().toISOString(),
  };
}
