import type { MatterRecord } from '@/lib/contracts/matter';
import type { StoredAnalysis } from '@/lib/auth/localDb';

export interface GraphNode {
  id: string;
  type: 'matter' | 'party' | 'fact' | 'evidence' | 'issue' | 'article' | 'claim' | 'document';
  label: string;
  meta?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  relation: string;
}

export interface MatterGraph {
  matterId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Construit un graphe justificatif dossier : parties, faits, preuves,
 * questions, articles cités, affirmations.
 */
export function buildMatterGraph(
  matter: MatterRecord,
  analyses: StoredAnalysis[] = [],
  documents: { id: string; title: string; templateId?: string }[] = []
): MatterGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const mid = `matter:${matter.id}`;

  nodes.push({
    id: mid,
    type: 'matter',
    label: `${matter.reference} — ${matter.title}`,
    meta: { domain: matter.domain, status: matter.status, risk: matter.riskLevel },
  });

  matter.parties.forEach((p, i) => {
    const id = `party:${matter.id}:${i}`;
    nodes.push({
      id,
      type: 'party',
      label: p.name,
      meta: { quality: p.quality },
    });
    edges.push({
      id: `e-party-${i}`,
      from: mid,
      to: id,
      relation: 'implique',
    });
  });

  matter.tags.forEach((tag, i) => {
    const id = `tag:${matter.id}:${i}`;
    nodes.push({ id, type: 'fact', label: `Tag: ${tag}` });
    edges.push({ id: `e-tag-${i}`, from: mid, to: id, relation: 'étiquette' });
  });

  analyses.forEach((row, ai) => {
    const a = row.analysis as {
      factObject?: {
        admittedFacts?: string[];
        missingInfo?: string[];
        legalIssues?: string[];
      };
      applicableLaw?: { reference: string; article: string; sourceId?: string }[];
      evidence?: { item: string; status: string }[];
      assertions?: { text: string; status: string }[];
      qualification?: string;
      overallRisk?: string;
    };

    const analysisNode = `analysis:${row.id}`;
    nodes.push({
      id: analysisNode,
      type: 'claim',
      label: a.qualification?.slice(0, 80) || `Analyse ${ai + 1}`,
      meta: { risk: a.overallRisk, createdAt: row.createdAt },
    });
    edges.push({
      id: `e-an-${row.id}`,
      from: mid,
      to: analysisNode,
      relation: 'analysé_par',
    });

    (a.factObject?.admittedFacts || []).slice(0, 8).forEach((f, i) => {
      const id = `fact:${row.id}:${i}`;
      nodes.push({ id, type: 'fact', label: f.slice(0, 100) });
      edges.push({ id: `e-f-${row.id}-${i}`, from: analysisNode, to: id, relation: 'fait' });
    });

    (a.factObject?.legalIssues || []).slice(0, 6).forEach((iss, i) => {
      const id = `issue:${row.id}:${i}`;
      nodes.push({ id, type: 'issue', label: iss.slice(0, 100) });
      edges.push({ id: `e-i-${row.id}-${i}`, from: analysisNode, to: id, relation: 'question' });
    });

    (a.evidence || []).slice(0, 8).forEach((ev, i) => {
      const id = `ev:${row.id}:${i}`;
      nodes.push({
        id,
        type: 'evidence',
        label: ev.item.slice(0, 80),
        meta: { status: ev.status },
      });
      edges.push({ id: `e-ev-${row.id}-${i}`, from: analysisNode, to: id, relation: 'preuve' });
    });

    (a.applicableLaw || []).slice(0, 8).forEach((law, i) => {
      const id = `art:${row.id}:${i}`;
      nodes.push({
        id,
        type: 'article',
        label: `${law.reference} ${law.article}`.trim(),
        meta: { sourceId: law.sourceId },
      });
      edges.push({
        id: `e-law-${row.id}-${i}`,
        from: analysisNode,
        to: id,
        relation: 'fonde_sur',
      });
      // Lier questions aux articles
      edges.push({
        id: `e-iss-law-${row.id}-${i}`,
        from: mid,
        to: id,
        relation: 'cite',
      });
    });
  });

  documents.forEach((d, i) => {
    const id = `doc:${d.id}`;
    nodes.push({
      id,
      type: 'document',
      label: d.title,
      meta: { templateId: d.templateId },
    });
    edges.push({ id: `e-doc-${i}`, from: mid, to: id, relation: 'document_généré' });
  });

  return { matterId: matter.id, nodes, edges };
}
