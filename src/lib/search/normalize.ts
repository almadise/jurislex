import type { LegalStatus, Provenance } from '@/lib/contracts/search';

/** Détecte une source secondaire depuis le chemin ou le titre. */
export function inferProvenance(
  sourcePath: string | null | undefined,
  titre?: string | null
): Provenance {
  const hay = `${sourcePath ?? ''} ${titre ?? ''}`.toLowerCase();
  if (
    hay.includes('source_secondaire') ||
    hay.includes('secondaire') ||
    hay.includes('compilation')
  ) {
    return 'secondary';
  }
  if (sourcePath || titre) return 'official';
  return 'unknown';
}

/**
 * Mappe le champ legacy `statut` (en_vigueur | abroge | modifie)
 * vers le statut prudent CDC. Défaut : unknown.
 */
export function mapLegalStatus(
  statut: string | null | undefined,
  legalStatus?: string | null
): LegalStatus {
  if (legalStatus) {
    const s = legalStatus.toLowerCase();
    if (
      s === 'verified' ||
      s === 'probable' ||
      s === 'unknown' ||
      s === 'repealed' ||
      s === 'superseded'
    ) {
      return s;
    }
  }
  const s = (statut ?? '').toLowerCase();
  if (s === 'abroge' || s === 'repealed') return 'repealed';
  if (s === 'modifie' || s === 'superseded') return 'superseded';
  // Ne pas promouvoir « en_vigueur » en verified sans preuve d'audit.
  if (s === 'en_vigueur' || s === 'probable') return 'probable';
  if (s === 'verified') return 'verified';
  return 'unknown';
}

/** Libellé de domaine lisible depuis la catégorie corpus. */
export function domainFromCategory(categorie: string | null | undefined): string {
  if (!categorie) return 'Non classé';
  const map: Record<string, string> = {
    '01_Droit_camerounais': 'Droit camerounais',
    '02_Droit_OHADA': 'Droit commercial OHADA',
    '04_Foncier_domanial_urbanisme': 'Droit foncier',
    '06_Fiscal_douanes_changes': 'Fiscalité et changes',
    '07_Commerce_investissements': 'Investissements',
    '08_Marches_publics': 'Marchés publics',
    '09_Environnement': 'Environnement',
    '09_Justice_procedures': 'Justice et procédures',
    '10_Penal_specialise': 'Droit pénal',
    '11_Numerique_communications': 'Droit numérique',
    '14_Banque_COBAC': 'Droit bancaire COBAC',
    '15_Propriete_intellectuelle_OAPI': 'Propriété intellectuelle OAPI',
    '18_Securite_sociale': 'Droit du travail / sécurité sociale',
    '19_Famille_enfance_protection': 'Famille et protection',
  };
  return map[categorie] ?? categorie.replace(/^\d+_/, '').replace(/_/g, ' ');
}

export function formatDateFr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  if (/^\d{4}$/.test(iso)) return iso;
  return iso;
}

export function buildReference(parts: {
  typeActe?: string | null;
  numero?: string | null;
  titre?: string | null;
  slug?: string | null;
}): string {
  if (parts.typeActe && parts.numero) {
    return `${parts.typeActe.toUpperCase().replace(/\s+/g, '-')}-${parts.numero}`;
  }
  if (parts.numero) return parts.numero;
  if (parts.slug) return parts.slug;
  return parts.titre?.slice(0, 48) ?? 'REF-INCONNUE';
}

export function scoreToPercent(score: number, mode: 'rrf' | 'lexical' | 'exact'): number {
  if (mode === 'exact') return Math.min(100, Math.round(score));
  if (mode === 'rrf') {
    // RRF scores typically 0.01–0.04 for top hits
    return Math.min(99, Math.max(1, Math.round(score * 2500)));
  }
  // lexical 0–1
  return Math.min(99, Math.max(1, Math.round(score * 100)));
}
