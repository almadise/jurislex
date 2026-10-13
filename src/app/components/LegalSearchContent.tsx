'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

import SearchFilters from './SearchFilters';
import SearchResultCard from './SearchResultCard';
import ArticlePreviewPanel from './ArticlePreviewPanel';
import { hitToUi, uiFiltersToApi, type UiSearchResult } from '@/lib/search/mapToUi';

export type SearchMode = 'exact' | 'lexical' | 'semantic';

/** Alias pour les composants enfants. */
export type SearchResult = UiSearchResult;

interface CorpusStatus {
  supabase: boolean;
  openai: boolean;
  localCorpus: { documents: number; chunks: number; source: string };
  demoMode: boolean;
}

const modeConfig = {
  exact: {
    label: 'Référence exacte',
    icon: 'HashtagIcon' as const,
    placeholder: 'Ex: Loi 92-007 article 40, Décret 76-165 art. 1…',
    apiMode: 'exact' as const,
  },
  lexical: {
    label: 'Lexical',
    icon: 'DocumentTextIcon' as const,
    placeholder: 'Ex: contrat de travail à durée déterminée, injonction de payer…',
    apiMode: 'lexical' as const,
  },
  semantic: {
    label: 'Sémantique',
    icon: 'SparklesIcon' as const,
    placeholder: 'Ex: Quelles obligations en cas de licenciement économique ?',
    apiMode: 'hybrid' as const,
  },
};

export default function LegalSearchContent() {
  const [searchMode, setSearchMode] = useState<SearchMode>('exact');
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [backend, setBackend] = useState<string>('');
  const [effectiveMode, setEffectiveMode] = useState<string>('');
  const [corpus, setCorpus] = useState<CorpusStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/recherche-legale')
      .then((r) => r.json())
      .then((data: CorpusStatus) => setCorpus(data))
      .catch(() => setCorpus(null));
  }, []);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;

    setIsSearching(true);
    setHasSearched(true);
    setError(null);
    setSelectedResult(null);

    try {
      const res = await fetch('/api/recherche-legale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          mode: modeConfig[searchMode].apiMode,
          filters: uiFiltersToApi(activeFilters),
          limit: 20,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.erreur || `Erreur HTTP ${res.status}`);
      }

      const hits = (data.resultats ?? []).map(hitToUi);
      setResults(hits);
      setWarnings(data.warnings ?? []);
      setBackend(data.backend ?? '');
      setEffectiveMode(data.effectiveMode ?? '');
      if (hits.length) setSelectedResult(hits[0]);

      if (data.corpus) {
        setCorpus((prev) =>
          prev
            ? {
                ...prev,
                localCorpus: {
                  documents: data.corpus.documents ?? prev.localCorpus.documents,
                  chunks: data.corpus.chunks ?? prev.localCorpus.chunks,
                  source: data.corpus.source ?? prev.localCorpus.source,
                },
              }
            : prev
        );
      }

      if (!hits.length) {
        toast.message('Aucune disposition trouvée', {
          description: 'Essayez un autre mode, élargissez les filtres ou reformulez.',
        });
      }
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      setResults([]);
      toast.error('Recherche impossible', { description: msg });
    } finally {
      setIsSearching(false);
    }
  }, [query, searchMode, activeFilters]);

  const corpusLabel = corpus
    ? corpus.localCorpus.chunks > 0
      ? `${corpus.localCorpus.documents} documents · ${corpus.localCorpus.chunks.toLocaleString('fr-FR')} provisions (index local)`
      : corpus.supabase
        ? 'Supabase configuré — lancez une recherche pour interroger la base'
        : 'Corpus vide — lancer scripts/02_extract.py ou configurer Supabase'
    : 'Chargement de l’état du corpus…';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Recherche juridique</h1>
          <p className="text-sm text-muted-foreground mt-1">{corpusLabel}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono-ref">
          {backend && (
            <span className="px-2 py-1 rounded bg-muted">
              backend: {backend}
              {effectiveMode ? ` · ${effectiveMode}` : ''}
            </span>
          )}
          <span>
            {results.length} résultat{results.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold mb-1">Avertissements</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {warnings.map((w, i) => (
              <li key={`warn-${i}`}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="card p-4">
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          {(Object.keys(modeConfig) as SearchMode[]).map((mode) => (
            <button
              key={`mode-${mode}`}
              type="button"
              onClick={() => setSearchMode(mode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                searchMode === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon name={modeConfig[mode].icon} size={14} />
              {modeConfig[mode].label}
            </button>
          ))}
        </div>

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
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Effacer la recherche"
              >
                <Icon name="XMarkIcon" size={16} />
              </button>
            )}
          </div>
          <button
            type="button"
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

        <p className="text-xs text-muted-foreground mt-2">
          {searchMode === 'exact' &&
            'Recherche déterministe par numéro de loi, décret, règlement ou article — prioritaire sur la similarité.'}
          {searchMode === 'lexical' &&
            'Recherche par mots et expressions dans le corpus indexé (plein texte).'}
          {searchMode === 'semantic' &&
            'Hybride vectoriel + lexical si embeddings disponibles ; sinon repli lexical documenté.'}
        </p>
      </div>

      <div className="flex gap-6 min-h-[600px]">
        <div className={`flex-shrink-0 transition-all duration-300 ${filtersOpen ? 'w-64' : 'w-10'}`}>
          <div className="card h-full">
            <div className="flex items-center justify-between p-3 border-b border-border">
              {filtersOpen && (
                <span className="text-sm font-semibold text-foreground">Filtres</span>
              )}
              <button
                type="button"
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="p-1 rounded hover:bg-muted transition-colors ml-auto"
                aria-label={filtersOpen ? 'Masquer les filtres' : 'Afficher les filtres'}
              >
                <Icon
                  name={filtersOpen ? 'ChevronLeftIcon' : 'FunnelIcon'}
                  size={16}
                  className="text-muted-foreground"
                />
              </button>
            </div>
            {filtersOpen && (
              <SearchFilters activeFilters={activeFilters} onChange={setActiveFilters} />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex gap-4">
          <div
            className={`flex flex-col gap-2 overflow-y-auto scrollbar-thin ${
              selectedResult ? 'w-[400px] xl:w-[440px] flex-shrink-0' : 'flex-1'
            }`}
          >
            {!hasSearched ? (
              <div className="card flex-1 flex items-center justify-center">
                <div className="text-center py-16">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Icon name="MagnifyingGlassIcon" size={28} className="text-primary" />
                  </div>
                  <p className="text-base font-semibold text-foreground mb-2">Lancez une recherche</p>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Aucune donnée fictive n’est affichée. Essayez par exemple « article 40 loi 92-007 »
                    (exact) ou « injonction de payer » (lexical).
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
                  <Icon
                    name="DocumentMagnifyingGlassIcon"
                    size={40}
                    className="text-muted-foreground mb-4"
                  />
                  <p className="text-base font-semibold text-foreground mb-2">
                    Aucune disposition trouvée
                  </p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Aucun texte du corpus ne correspond. Reformulez, changez de mode ou élargissez les
                    filtres.
                  </p>
                </div>
              </div>
            ) : (
              results.map((result) => (
                <SearchResultCard
                  key={result.id}
                  result={result}
                  isSelected={selectedResult?.id === result.id}
                  onClick={() =>
                    setSelectedResult(selectedResult?.id === result.id ? null : result)
                  }
                />
              ))
            )}
          </div>

          {selectedResult && (
            <div className="flex-1 min-w-0">
              <ArticlePreviewPanel
                result={selectedResult}
                onClose={() => setSelectedResult(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
