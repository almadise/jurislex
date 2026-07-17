'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface FilterGroup {
  id: string;
  label: string;
  options: { value: string; label: string; count?: number }[];
}

const filterGroups: FilterGroup[] = [
  {
    id: 'domain',
    label: 'Domaine',
    options: [
      { value: 'ohada-commercial', label: 'Droit commercial OHADA', count: 1842 },
      { value: 'travail', label: 'Droit du travail', count: 634 },
      { value: 'civil', label: 'Droit civil', count: 521 },
      { value: 'societes', label: 'Droit des sociétés', count: 487 },
      { value: 'penal', label: 'Droit pénal', count: 312 },
      { value: 'foncier', label: 'Droit foncier', count: 298 },
      { value: 'bancaire', label: 'Droit bancaire COBAC', count: 187 },
      { value: 'numerique', label: 'Droit numérique', count: 91 },
    ],
  },
  {
    id: 'authority',
    label: 'Autorité',
    options: [
      { value: 'ohada', label: 'OHADA', count: 2341 },
      { value: 'cameroun', label: 'République du Cameroun', count: 1987 },
      { value: 'cobac', label: 'COBAC', count: 234 },
      { value: 'cemac', label: 'CEMAC', count: 198 },
      { value: 'cima', label: 'CIMA', count: 112 },
    ],
  },
  {
    id: 'type',
    label: 'Type de texte',
    options: [
      { value: 'acte-uniforme', label: 'Acte uniforme', count: 891 },
      { value: 'loi', label: 'Loi', count: 1243 },
      { value: 'decret', label: 'Décret', count: 876 },
      { value: 'ordonnance', label: 'Ordonnance', count: 234 },
      { value: 'reglement', label: 'Règlement', count: 312 },
      { value: 'arrete', label: 'Arrêté', count: 156 },
    ],
  },
  {
    id: 'provenance',
    label: 'Provenance',
    options: [
      { value: 'official', label: 'Source officielle', count: 3412 },
      { value: 'secondary', label: 'Source secondaire', count: 1460 },
    ],
  },
  {
    id: 'legalStatus',
    label: 'Statut juridique',
    options: [
      { value: 'verified', label: 'Vérifié en vigueur', count: 2987 },
      { value: 'probable', label: 'Probablement en vigueur', count: 1123 },
      { value: 'unknown', label: 'Statut inconnu', count: 456 },
      { value: 'superseded', label: 'Remplacé', count: 234 },
      { value: 'repealed', label: 'Abrogé', count: 72 },
    ],
  },
  {
    id: 'language',
    label: 'Langue',
    options: [
      { value: 'fr', label: 'Français', count: 4312 },
      { value: 'en', label: 'Anglais', count: 560 },
    ],
  },
];

interface SearchFiltersProps {
  activeFilters: Record<string, string[]>;
  onChange: (filters: Record<string, string[]>) => void;
}

export default function SearchFilters({ activeFilters, onChange }: SearchFiltersProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    domain: true,
    authority: true,
    type: false,
    provenance: false,
    legalStatus: true,
    language: false,
  });

  const toggleFilter = (groupId: string, value: string) => {
    const current = activeFilters[groupId] || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...activeFilters, [groupId]: updated });
  };

  const clearAll = () => onChange({});

  const totalActive = Object.values(activeFilters).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="p-3 overflow-y-auto scrollbar-thin h-[calc(100%-48px)]">
      {totalActive > 0 && (
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
          <span className="text-xs text-muted-foreground">{totalActive} filtre{totalActive > 1 ? 's' : ''} actif{totalActive > 1 ? 's' : ''}</span>
          <button onClick={clearAll} className="text-xs text-accent hover:underline font-medium">
            Tout effacer
          </button>
        </div>
      )}

      {filterGroups.map((group) => (
        <div key={`filter-group-${group.id}`} className="mb-4">
          <button
            onClick={() => setExpanded((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
            className="flex items-center justify-between w-full text-left mb-2"
          >
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
              {group.label}
            </span>
            <Icon
              name={expanded[group.id] ? 'ChevronUpIcon' : 'ChevronDownIcon'}
              size={14}
              className="text-muted-foreground"
            />
          </button>

          {expanded[group.id] && (
            <div className="space-y-1">
              {group.options.map((option) => {
                const isActive = (activeFilters[group.id] || []).includes(option.value);
                return (
                  <label
                    key={`filter-${group.id}-${option.value}`}
                    className="flex items-center gap-2 cursor-pointer group py-0.5"
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        isActive ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
                      }`}
                      onClick={() => toggleFilter(group.id, option.value)}
                    >
                      {isActive && <Icon name="CheckIcon" size={10} className="text-white" />}
                    </div>
                    <span
                      className="text-xs text-foreground flex-1"
                      onClick={() => toggleFilter(group.id, option.value)}
                    >
                      {option.label}
                    </span>
                    {option.count !== undefined && (
                      <span className="text-[10px] text-muted-foreground font-mono-ref">
                        {option.count.toLocaleString('fr-FR')}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* Date range */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Période</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="De (aaaa)"
            className="input-field text-xs py-1.5"
            aria-label="Année de début"
          />
          <input
            type="text"
            placeholder="À (aaaa)"
            className="input-field text-xs py-1.5"
            aria-label="Année de fin"
          />
        </div>
      </div>
    </div>
  );
}