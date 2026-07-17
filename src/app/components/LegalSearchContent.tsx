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

export default function LegalSearchContent() {
  const [searchMode, setSearchMode] = useState<SearchMode>('semantic');
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    setSearchError(null);
    setSelectedResult(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), mode: searchMode, filters: activeFilters }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Erreur réseau' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de recherche';
      setSearchError(msg);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
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
            Corpus indexé : OHADA · Cameroun · COBAC — Recherche hybride vectorielle activée
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono-ref">
            {hasSearched && !isSearching ? `${results.length} résultat${results.length !== 1 ? 's' : ''}` : ''}
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
          {searchMode === 'lexical' && 'Recherche par mots et expressions exactes dans le corpus indexé via PostgreSQL full-text search.'}
          {searchMode === 'semantic' && 'Reformulez en langage courant — le moteur identifie les dispositions pertinentes par similarité vectorielle (OpenAI + pgvector) avec re-classement hybride.'}
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
            ) : searchError ? (
              <div className="card flex-1">
                <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                  <Icon name="ExclamationTriangleIcon" size={40} className="text-amber-500 mb-4" />
                  <p className="text-base font-semibold text-foreground mb-2">Erreur de recherche</p>
                  <p className="text-sm text-muted-foreground max-w-xs">{searchError}</p>
                  <button onClick={handleSearch} className="btn-secondary mt-4 text-sm">
                    Réessayer
                  </button>
                </div>
              </div>
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