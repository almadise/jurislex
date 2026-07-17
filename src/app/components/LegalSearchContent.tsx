'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

import SearchFilters from './SearchFilters';
import SearchResultCard from './SearchResultCard';
import ArticlePreviewPanel from './ArticlePreviewPanel';

export type SearchMode = 'exact' | 'lexical' | 'semantic';

export interface SearchResult {
  id: string;
  title: string;
  reference: string;
  article: string;
  excerpt: string;
  page: number;
  domain: string;
  authority: string;
  date: string;
  provenance: 'official' | 'secondary';
  legalStatus: 'verified' | 'probable' | 'unknown' | 'repealed' | 'superseded';
  matchScore: number;
  matchReason: string;
  language: 'fr' | 'en';
}

const mockResults: SearchResult[] = [
  {
    id: 'result-001',
    title: 'Acte Uniforme relatif au droit commercial général',
    reference: 'OHADA-AUDCG-2010',
    article: 'Art. 59',
    excerpt: 'Tout commerçant doit tenir une comptabilité conformément aux dispositions de l\'Acte uniforme portant organisation et harmonisation des comptabilités des entreprises...',
    page: 34,
    domain: 'Droit commercial OHADA',
    authority: 'OHADA',
    date: '15/12/2010',
    provenance: 'official',
    legalStatus: 'verified',
    matchScore: 98,
    matchReason: 'Référence exacte',
    language: 'fr',
  },
  {
    id: 'result-002',
    title: 'Code du Travail du Cameroun',
    reference: 'LOI-92-007-1992',
    article: 'Art. 66',
    excerpt: 'Le contrat de travail est soumis aux règles du droit commun. Il peut être établi selon les formes que les parties contractantes décident d\'adopter...',
    page: 22,
    domain: 'Droit du travail',
    authority: 'République du Cameroun',
    date: '14/08/1992',
    provenance: 'official',
    legalStatus: 'verified',
    matchScore: 94,
    matchReason: 'Correspondance lexicale',
    language: 'fr',
  },
  {
    id: 'result-003',
    title: 'Acte Uniforme portant organisation des procédures simplifiées de recouvrement',
    reference: 'OHADA-AUPSRVE-1998',
    article: 'Art. 2',
    excerpt: 'Toute créance certaine, liquide et exigible peut faire l\'objet d\'une procédure d\'injonction de payer. La demande est présentée par requête au président de la juridiction compétente...',
    page: 3,
    domain: 'Droit commercial OHADA',
    authority: 'OHADA',
    date: '10/04/1998',
    provenance: 'official',
    legalStatus: 'verified',
    matchScore: 91,
    matchReason: 'Similarité sémantique',
    language: 'fr',
  },
  {
    id: 'result-004',
    title: 'Acte Uniforme relatif au droit des sociétés commerciales',
    reference: 'OHADA-AUSC-2014',
    article: 'Art. 853-1',
    excerpt: 'La société par actions simplifiée est une société dans laquelle les associés fixent librement, dans les statuts, les conditions et les formes dans lesquelles la société est dirigée...',
    page: 187,
    domain: 'Droit des sociétés',
    authority: 'OHADA',
    date: '30/01/2014',
    provenance: 'official',
    legalStatus: 'verified',
    matchScore: 87,
    matchReason: 'Correspondance lexicale',
    language: 'fr',
  },
  {
    id: 'result-005',
    title: 'Code Civil camerounais — Livre III',
    reference: 'CC-CMR-1981',
    article: 'Art. 1134',
    excerpt: 'Les conventions légalement formées tiennent lieu de loi à ceux qui les ont faites. Elles ne peuvent être révoquées que de leur consentement mutuel...',
    page: 312,
    domain: 'Droit civil',
    authority: 'République du Cameroun',
    date: '01/01/1981',
    provenance: 'secondary',
    legalStatus: 'probable',
    matchScore: 82,
    matchReason: 'Similarité sémantique',
    language: 'fr',
  },
  {
    id: 'result-006',
    title: 'Décret n° 2018/366 portant organisation du Ministère du Travail',
    reference: 'DECRET-2018-366',
    article: 'Art. 12',
    excerpt: 'L\'Inspection du travail est chargée de veiller à l\'application des dispositions légales et réglementaires relatives au travail, à la main-d\'œuvre et à la prévoyance sociale...',
    page: 7,
    domain: 'Droit du travail',
    authority: 'République du Cameroun',
    date: '20/06/2018',
    provenance: 'official',
    legalStatus: 'verified',
    matchScore: 79,
    matchReason: 'Correspondance lexicale',
    language: 'fr',
  },
  {
    id: 'result-007',
    title: 'Acte Uniforme portant organisation des sûretés',
    reference: 'OHADA-AUS-2010',
    article: 'Art. 4',
    excerpt: 'Les sûretés sont constituées dans l\'intérêt d\'un créancier pour garantir l\'exécution d\'une obligation. Elles peuvent être personnelles ou réelles...',
    page: 4,
    domain: 'Droit commercial OHADA',
    authority: 'OHADA',
    date: '15/12/2010',
    provenance: 'official',
    legalStatus: 'verified',
    matchScore: 76,
    matchReason: 'Similarité sémantique',
    language: 'fr',
  },
  {
    id: 'result-008',
    title: 'Loi n° 2003-008 relative à la répression des infractions',
    reference: 'LOI-2003-008',
    article: 'Art. 3',
    excerpt: 'Toute personne qui, par quelque moyen que ce soit, contrefait ou falsifie un acte juridique ou un document officiel est punie d\'un emprisonnement de deux à cinq ans...',
    page: 2,
    domain: 'Droit pénal',
    authority: 'République du Cameroun',
    date: '10/07/2003',
    provenance: 'secondary',
    legalStatus: 'unknown',
    matchScore: 71,
    matchReason: 'Correspondance lexicale',
    language: 'fr',
  },
  {
    id: 'result-009',
    title: 'Règlement COBAC R-2001/07 relatif au contrôle interne',
    reference: 'COBAC-R-2001-07',
    article: 'Art. 8',
    excerpt: 'Les établissements assujettis doivent se doter d\'un système de contrôle interne permettant notamment de vérifier que les opérations réalisées respectent les procédures internes...',
    page: 5,
    domain: 'Droit bancaire COBAC',
    authority: 'COBAC',
    date: '01/01/2002',
    provenance: 'official',
    legalStatus: 'probable',
    matchScore: 68,
    matchReason: 'Similarité sémantique',
    language: 'fr',
  },
  {
    id: 'result-010',
    title: 'Ordonnance n° 74-1 du 6 juillet 1974 fixant le régime foncier',
    reference: 'ORD-74-1-1974',
    article: 'Art. 1',
    excerpt: 'Les terres du territoire national constituent la propriété publique ou privée de l\'État, des collectivités publiques ou des particuliers selon les distinctions établies par la présente ordonnance...',
    page: 1,
    domain: 'Droit foncier',
    authority: 'République du Cameroun',
    date: '06/07/1974',
    provenance: 'secondary',
    legalStatus: 'superseded',
    matchScore: 62,
    matchReason: 'Correspondance lexicale',
    language: 'fr',
  },
  {
    id: 'result-011',
    title: 'Loi n° 2010/021 régissant le commerce électronique',
    reference: 'LOI-2010-021',
    article: 'Art. 22',
    excerpt: 'Le prestataire de services de certification électronique est responsable du préjudice causé aux personnes qui se sont fiées raisonnablement aux certificats qu\'il délivre...',
    page: 15,
    domain: 'Droit numérique',
    authority: 'République du Cameroun',
    date: '21/12/2010',
    provenance: 'official',
    legalStatus: 'verified',
    matchScore: 58,
    matchReason: 'Similarité sémantique',
    language: 'fr',
  },
  {
    id: 'result-012',
    title: 'Acte Uniforme relatif au droit de l\'arbitrage',
    reference: 'OHADA-AUA-2017',
    article: 'Art. 10',
    excerpt: 'Le tribunal arbitral est seul compétent pour statuer sur les contestations relatives à son existence ou à sa validité. A cet effet, il peut statuer sur sa propre compétence...',
    page: 8,
    domain: 'Droit commercial OHADA',
    authority: 'OHADA',
    date: '23/11/2017',
    provenance: 'official',
    legalStatus: 'verified',
    matchScore: 55,
    matchReason: 'Correspondance lexicale',
    language: 'fr',
  },
];

export default function LegalSearchContent() {
  const [searchMode, setSearchMode] = useState<SearchMode>('semantic');
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(true);
  const [results, setResults] = useState<SearchResult[]>(mockResults);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(mockResults[0]);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});

  // Backend integration point: POST /api/search with { query, mode, filters }
  const handleSearch = () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setTimeout(() => {
      setResults(mockResults);
      setHasSearched(true);
      setIsSearching(false);
    }, 800);
  };

  const modeConfig = {
    exact: { label: 'Référence exacte', icon: 'HashtagIcon', placeholder: 'Ex: OHADA-AUDCG-2010, Art. 59...' },
    lexical: { label: 'Lexical', icon: 'DocumentTextIcon', placeholder: 'Ex: contrat de travail à durée déterminée...' },
    semantic: { label: 'Sémantique', icon: 'SparklesIcon', placeholder: 'Ex: Quelles obligations pour un gérant de SARL en cas de faillite ?' },
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Recherche juridique</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Corpus indexé : 3 domaines — 4 872 provisions — Dernière ingestion : 14/07/2026
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono-ref">
            {results.length} résultat{results.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Search bar */}
      <div className="card p-4">
        {/* Mode selector */}
        <div className="flex items-center gap-1 mb-3">
          {(Object.keys(modeConfig) as SearchMode[]).map((mode) => (
            <button
              key={`mode-${mode}`}
              onClick={() => setSearchMode(mode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                searchMode === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon name={modeConfig[mode].icon as Parameters<typeof Icon>[0]['name']} size={14} />
              {modeConfig[mode].label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Icon
              name="MagnifyingGlassIcon"
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={modeConfig[searchMode].placeholder}
              className="input-field pl-10 pr-4 py-3"
              aria-label="Requête de recherche"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Effacer la recherche"
              >
                <Icon name="XMarkIcon" size={16} />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="btn-primary px-6 min-w-[160px] justify-center"
          >
            {isSearching ? (
              <>
                <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                Recherche...
              </>
            ) : (
              <>
                <Icon name="MagnifyingGlassIcon" size={16} />
                Lancer la recherche
              </>
            )}
          </button>
        </div>

        {/* Mode hint */}
        <p className="text-xs text-muted-foreground mt-2">
          {searchMode === 'exact' && 'Recherche déterministe par numéro de loi, décret, règlement ou article — résultats prioritaires.'}
          {searchMode === 'lexical' && 'Recherche par mots et expressions exactes dans le corpus indexé.'}
          {searchMode === 'semantic' && 'Reformulez en langage courant — le moteur identifie les dispositions pertinentes par similarité sémantique.'}
        </p>
      </div>

      {/* Body */}
      <div className="flex gap-6 min-h-[600px]">
        {/* Filters */}
        <div className={`flex-shrink-0 transition-all duration-300 ${filtersOpen ? 'w-64' : 'w-10'}`}>
          <div className="card h-full">
            <div className="flex items-center justify-between p-3 border-b border-border">
              {filtersOpen && (
                <span className="text-sm font-semibold text-foreground">Filtres</span>
              )}
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="p-1 rounded hover:bg-muted transition-colors ml-auto"
                aria-label={filtersOpen ? 'Masquer les filtres' : 'Afficher les filtres'}
              >
                <Icon name={filtersOpen ? 'ChevronLeftIcon' : 'FunnelIcon'} size={16} className="text-muted-foreground" />
              </button>
            </div>
            {filtersOpen && (
              <SearchFilters
                activeFilters={activeFilters}
                onChange={setActiveFilters}
              />
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 min-w-0 flex gap-4">
          {/* Result list */}
          <div className={`flex flex-col gap-2 overflow-y-auto scrollbar-thin ${selectedResult ? 'w-[400px] xl:w-[440px] flex-shrink-0' : 'flex-1'}`}>
            {!hasSearched ? (
              <div className="card flex-1 flex items-center justify-center">
                <div className="text-center py-16">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Icon name="MagnifyingGlassIcon" size={28} className="text-primary" />
                  </div>
                  <p className="text-base font-semibold text-foreground mb-2">Lancez une recherche</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Entrez une référence exacte, des mots-clés ou une question en langage naturel.
                  </p>
                </div>
              </div>
            ) : isSearching ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={`skel-${i}`} className="card p-4 animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2 mb-3" />
                  <div className="h-3 bg-muted rounded w-full mb-1" />
                  <div className="h-3 bg-muted rounded w-5/6" />
                </div>
              ))
            ) : results.length === 0 ? (
              <div className="card flex-1">
                <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                  <Icon name="DocumentMagnifyingGlassIcon" size={40} className="text-muted-foreground mb-4" />
                  <p className="text-base font-semibold text-foreground mb-2">Aucune disposition trouvée</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Aucun texte du corpus ne correspond à cette requête. Essayez de reformuler ou d'élargir les filtres.
                  </p>
                </div>
              </div>
            ) : (
              results.map((result) => (
                <SearchResultCard
                  key={result.id}
                  result={result}
                  isSelected={selectedResult?.id === result.id}
                  onClick={() => setSelectedResult(selectedResult?.id === result.id ? null : result)}
                />
              ))
            )}
          </div>

          {/* Article preview */}
          {selectedResult && (
            <div className="flex-1 min-w-0">
              <ArticlePreviewPanel result={selectedResult} onClose={() => setSelectedResult(null)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}