import React from 'react';

type LegalStatus = 'verified' | 'probable' | 'unknown' | 'repealed' | 'superseded';
type ClaimStatus = 'supported' | 'inferred' | 'uncertain' | 'unsupported' | 'conflicting';
type RiskLevel = 'low' | 'medium' | 'high';
type MatterStatus = 'draft' | 'active' | 'analysis' | 'documented' | 'closed' | 'archived';

const legalStatusConfig: Record<LegalStatus, { label: string; className: string }> = {
  verified: { label: 'Vérifié', className: 'status-badge-verified' },
  probable: { label: 'Probable', className: 'status-badge-probable' },
  unknown: { label: 'Inconnu', className: 'status-badge-unknown' },
  repealed: { label: 'Abrogé', className: 'status-badge-repealed' },
  superseded: { label: 'Remplacé', className: 'status-badge-superseded' },
};

const claimStatusConfig: Record<ClaimStatus, { label: string; className: string }> = {
  supported: { label: 'Fondé', className: 'claim-badge-supported' },
  inferred: { label: 'Déduit', className: 'claim-badge-inferred' },
  uncertain: { label: 'Incertain', className: 'claim-badge-uncertain' },
  unsupported: { label: 'Non fondé', className: 'claim-badge-unsupported' },
  conflicting: { label: 'Conflictuel', className: 'claim-badge-conflicting' },
};

const riskConfig: Record<RiskLevel, { label: string; className: string }> = {
  low: { label: 'Risque faible', className: 'bg-green-100 text-green-700' },
  medium: { label: 'Risque modéré', className: 'bg-amber-100 text-amber-700' },
  high: { label: 'Risque élevé', className: 'bg-red-100 text-red-700' },
};

const matterStatusConfig: Record<MatterStatus, { label: string; className: string }> = {
  draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-600' },
  active: { label: 'Actif', className: 'bg-blue-100 text-blue-700' },
  analysis: { label: 'En analyse', className: 'bg-amber-100 text-amber-700' },
  documented: { label: 'Documenté', className: 'bg-purple-100 text-purple-700' },
  closed: { label: 'Clôturé', className: 'bg-green-100 text-green-700' },
  archived: { label: 'Archivé', className: 'bg-gray-100 text-gray-500' },
};

interface StatusBadgeProps {
  type: 'legal' | 'claim' | 'risk' | 'matter';
  value: LegalStatus | ClaimStatus | RiskLevel | MatterStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ type, value, size = 'sm' }: StatusBadgeProps) {
  let config: { label: string; className: string };

  if (type === 'legal') config = legalStatusConfig[value as LegalStatus];
  else if (type === 'claim') config = claimStatusConfig[value as ClaimStatus];
  else if (type === 'risk') config = riskConfig[value as RiskLevel];
  else config = matterStatusConfig[value as MatterStatus];

  const sizeClass = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${sizeClass} ${config.className}`}>
      {config.label}
    </span>
  );
}