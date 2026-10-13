'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface FilterGroup {
  id: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Valeurs alignées sur le corpus legal-content/ et le contrat SearchFilters.
 * Les `value` sont envoyées telles quelles à l'API.
 */
const filterGroups: FilterGroup[] = [
  {
    id: 'domain',
    label: 'Domaine (catégorie corpus)',
    options: [
      { value: '18_Securite_sociale', label: 'Travail / sécurité sociale' },
      { value: '02_Droit_OHADA', label: 'Droit OHADA' },
      { value: '04_Foncier_domanial_urbanisme', label: 'Foncier / domanial' },
      { value: '08_Marches_publics', label: 'Marchés publics' },
      { value: '10_Penal_specialise', label: 'Droit pénal' },
      { value: '14_Banque_COBAC', label: 'Banque COBAC' },
      { value: '06_Fiscal_douanes_changes', label: 'Fiscal / douanes / changes' },
      { value: '15_Propriete_intellectuelle_OAPI', label: 'OAPI' },
      { value: '07_Commerce_investissements', label: 'Investissements' },
      { value: '01_Droit_camerounais', label: 'Droit camerounais' },
    ],
  },
  {
    id: 'authority',
    label: 'Autorité / juridiction',
    options: [
      { value: 'Cameroun', label: 'Cameroun' },
      { value: 'OHADA', label: 'OHADA' },
      { value: 'COBAC', label: 'COBAC' },
      { value: 'CEMAC', label: 'CEMAC' },
      { value: 'CIMA', label: 'CIMA' },
      { value: 'OAPI', label: 'OAPI' },
      { value: 'UDEAC', label: 'UDEAC' },
    ],
  },
  {
    id: 'type',
    label: 'Type de texte',
    options: [
      { value: 'Loi', label: 'Loi' },
      { value: 'Décret', label: 'Décret' },
      { value: 'Ordonnance', label: 'Ordonnance' },
      { value: 'Règlement', label: 'Règlement' },
      { value: 'Acte uniforme', label: 'Acte uniforme' },
      { value: 'Instruction', label: 'Instruction' },
      { value: 'Arrêté', label: 'Arrêté' },
    ],
  },
  {
    id: 'provenance',
    label: 'Provenance',
    options: [
      { value: 'official', label: 'Source officielle (inférée)' },
      { value: 'secondary', label: 'Source secondaire' },
    ],
  },
  {
    id: 'legalStatus',
    label: 'Statut juridique',
    options: [
      { value: 'verified', label: 'Vérifié' },
      { value: 'probable', label: 'Probable' },
      { value: 'unknown', label: 'Inconnu (défaut prudent)' },
      { value: 'superseded', label: 'Remplacé' },
      { value: 'repealed', label: 'Abrogé' },
    ],
  },
  {
    id: 'language',
    label: 'Langue',
    options: [
      { value: 'fr', label: 'Français' },
      { value: 'en', label: 'Anglais' },
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
    legalStatus: false,
    language: false,
  });

  const toggleFilter = (groupId: string, value: string) => {
    const current = activeFilters[groupId] || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...activeFilters, [groupId]: updated });
  };

  const setYear = (key: 'yearFrom' | 'yearTo', value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    onChange({
      ...activeFilters,
      [key]: digits ? [digits] : [],
    });
  };

  const clearAll = () => onChange({});

  const totalActive = Object.values(activeFilters).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="p-3 overflow-y-auto scrollbar-thin h-[calc(100%-48px)]">
      {totalActive > 0 && (
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
          <span className="text-xs text-muted-foreground">
            {totalActive} filtre{totalActive > 1 ? 's' : ''} actif{totalActive > 1 ? 's' : ''}
          </span>
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
            type="button"
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
                      role="checkbox"
                      aria-checked={isActive}
                    >
                      {isActive && <Icon name="CheckIcon" size={10} className="text-white" />}
                    </div>
                    <span
                      className="text-xs text-foreground flex-1"
                      onClick={() => toggleFilter(group.id, option.value)}
                    >
                      {option.label}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <div className="mb-4">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Période</p>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder="De (aaaa)"
            className="input-field text-xs py-1.5"
            aria-label="Année de début"
            value={activeFilters.yearFrom?.[0] ?? ''}
            onChange={(e) => setYear('yearFrom', e.target.value)}
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="À (aaaa)"
            className="input-field text-xs py-1.5"
            aria-label="Année de fin"
            value={activeFilters.yearTo?.[0] ?? ''}
            onChange={(e) => setYear('yearTo', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
