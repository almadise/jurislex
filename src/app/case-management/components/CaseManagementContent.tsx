'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import CaseDetailPanel from './CaseDetailPanel';
import NewCaseModal from './NewCaseModal';
import { caseService } from '@/lib/services/caseService';
import { toast } from 'sonner';
import DeleteCaseModal from './DeleteCaseModal';

export interface Matter {
  id: string;
  reference: string;
  title: string;
  domain: string;
  parties: string[];
  status: 'draft' | 'active' | 'analysis' | 'documented' | 'closed' | 'archived';
  analyses: number;
  documents: number;
  lastActivity: string;
  createdAt: string;
  assignedTo: string;
  riskLevel: 'low' | 'medium' | 'high';
  tags: string[];
}

const domainColors: Record<string, string> = {
  'Droit du travail': 'bg-green-100 text-green-700',
  'Droit commercial OHADA': 'bg-blue-100 text-blue-700',
  'Droit des sociétés': 'bg-indigo-100 text-indigo-700',
  'Droit civil': 'bg-purple-100 text-purple-700',
  'Droit foncier': 'bg-amber-100 text-amber-700',
  'Droit bancaire COBAC': 'bg-cyan-100 text-cyan-700',
  'Droit de la propriété intellectuelle': 'bg-pink-100 text-pink-700',
};

export default function CaseManagementContent() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [sortField, setSortField] = useState<keyof Matter>('lastActivity');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [deletingMatter, setDeletingMatter] = useState<Matter | null>(null);

  const fetchMatters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await caseService.getAll();
      setMatters(data);
    } catch (err: any) {
      setError(err.message ?? 'Erreur lors du chargement des dossiers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatters();
  }, [fetchMatters]);

  const filtered = matters.filter((m) => {
    const matchesSearch =
      !searchQuery ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.parties.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    const matchesDomain = domainFilter === 'all' || m.domain === domainFilter;
    return matchesSearch && matchesStatus && matchesDomain;
  });

  const handleSort = (field: keyof Matter) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((m) => m.id));
    }
  };

  const handleBulkClose = async () => {
    try {
      await caseService.updateStatus(selectedIds, 'closed');
      setMatters((prev) =>
        prev.map((m) => (selectedIds.includes(m.id) ? { ...m, status: 'closed' as const } : m))
      );
      toast.success(
        `${selectedIds.length} dossier${selectedIds.length > 1 ? 's' : ''} clôturé${selectedIds.length > 1 ? 's' : ''}`
      );
      setSelectedIds([]);
    } catch {
      toast.error('Erreur lors de la clôture des dossiers.');
    }
  };

  const handleBulkArchive = async () => {
    try {
      await caseService.updateStatus(selectedIds, 'archived');
      setMatters((prev) =>
        prev.map((m) => (selectedIds.includes(m.id) ? { ...m, status: 'archived' as const } : m))
      );
      toast.success(
        `${selectedIds.length} dossier${selectedIds.length > 1 ? 's' : ''} archivé${selectedIds.length > 1 ? 's' : ''}`
      );
      setSelectedIds([]);
    } catch {
      toast.error('Erreur lors de l\'archivage des dossiers.');
    }
  };

  const handleDeleteCase = async (matter: Matter) => {
    await caseService.deleteCase(matter.id);
    setMatters((prev) => prev.filter((m) => m.id !== matter.id));
    if (selectedMatter?.id === matter.id) setSelectedMatter(null);
    setDeletingMatter(null);
    toast.success(`Dossier ${matter.reference} supprimé définitivement`);
  };

  const statusOptions = [
    { value: 'all', label: 'Tous les statuts' },
    { value: 'draft', label: 'Brouillon' },
    { value: 'active', label: 'Actif' },
    { value: 'analysis', label: 'En analyse' },
    { value: 'documented', label: 'Documenté' },
    { value: 'closed', label: 'Clôturé' },
    { value: 'archived', label: 'Archivé' },
  ];

  const domainOptions = [
    { value: 'all', label: 'Tous les domaines' },
    ...Array.from(new Set(matters.map((m) => m.domain))).map((d) => ({ value: d, label: d })),
  ];

  const SortIcon = ({ field }: { field: keyof Matter }) => {
    if (sortField !== field)
      return <Icon name="ChevronUpDownIcon" size={14} className="text-muted-foreground/50" />;
    return sortDir === 'asc' ? (
      <Icon name="ChevronUpIcon" size={14} className="text-primary" />
    ) : (
      <Icon name="ChevronDownIcon" size={14} className="text-primary" />
    );
  };

  const columns: { key: keyof Matter; label: string; sortable?: boolean }[] = [
    { key: 'reference', label: 'Référence', sortable: true },
    { key: 'title', label: 'Intitulé', sortable: true },
    { key: 'domain', label: 'Domaine', sortable: true },
    { key: 'status', label: 'Statut', sortable: true },
    { key: 'riskLevel', label: 'Risque', sortable: true },
    { key: 'analyses', label: 'Analyses', sortable: true },
    { key: 'documents', label: 'Documents', sortable: true },
    { key: 'lastActivity', label: 'Dernière activité', sortable: true },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Gestion des dossiers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading
              ? 'Chargement...'
              : `${matters.length} dossier${matters.length > 1 ? 's' : ''} — ${matters.filter((m) => m.status === 'active' || m.status === 'analysis').length} actif${matters.filter((m) => m.status === 'active' || m.status === 'analysis').length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => setShowNewCaseModal(true)} className="btn-primary">
          <Icon name="PlusIcon" size={16} />
          Nouveau dossier
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <Icon name="ExclamationTriangleIcon" size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={fetchMatters} className="ml-auto btn-secondary text-xs">
            Réessayer
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {[
          { label: 'Actifs', count: matters.filter((m) => m.status === 'active').length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'En analyse', count: matters.filter((m) => m.status === 'analysis').length, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Documentés', count: matters.filter((m) => m.status === 'documented').length, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Clôturés', count: matters.filter((m) => m.status === 'closed').length, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Risque élevé', count: matters.filter((m) => m.riskLevel === 'high').length, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Total documents', count: matters.reduce((s, m) => s + m.documents, 0), color: 'text-foreground', bg: 'bg-muted' },
        ].map((stat) => (
          <div key={`stat-${stat.label}`} className={`card p-3 ${stat.bg} border-0`}>
            {loading ? (
              <div className="h-8 w-8 bg-current/10 rounded animate-pulse mb-1" />
            ) : (
              <p className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.count}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Table */}
        <div className={`flex-1 min-w-0 card overflow-hidden ${selectedMatter ? 'hidden xl:block' : ''}`}>
          {/* Toolbar */}
          <div className="flex items-center gap-3 p-4 border-b border-border flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Icon
                name="MagnifyingGlassIcon"
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un dossier, une partie..."
                className="input-field pl-9"
                aria-label="Rechercher un dossier"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field w-auto"
              aria-label="Filtrer par statut"
            >
              {statusOptions.map((o) => (
                <option key={`status-opt-${o.value}`} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="input-field w-auto"
              aria-label="Filtrer par domaine"
            >
              {domainOptions.map((o) => (
                <option key={`domain-opt-${o.value}`} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground font-mono-ref ml-auto">
              {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Bulk action bar */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border-b border-primary/20 slide-up">
              <span className="text-sm font-medium text-primary">
                {selectedIds.length} dossier{selectedIds.length > 1 ? 's' : ''} sélectionné{selectedIds.length > 1 ? 's' : ''}
              </span>
              <button onClick={handleBulkClose} className="btn-secondary text-xs">
                <Icon name="CheckCircleIcon" size={14} />
                Clôturer
              </button>
              <button onClick={handleBulkArchive} className="btn-ghost text-xs text-muted-foreground">
                <Icon name="ArchiveBoxIcon" size={14} />
                Archiver
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="ml-auto btn-ghost text-xs text-muted-foreground"
              >
                Annuler
              </button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[900px]" role="table">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-10 px-4 py-3">
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                        selectedIds.length === filtered.length && filtered.length > 0
                          ? 'bg-primary border-primary' :'border-border hover:border-primary/50'
                      }`}
                      onClick={toggleSelectAll}
                      role="checkbox"
                      aria-checked={selectedIds.length === filtered.length && filtered.length > 0}
                      aria-label="Tout sélectionner"
                    >
                      {selectedIds.length === filtered.length && filtered.length > 0 && (
                        <Icon name="CheckIcon" size={10} className="text-white" />
                      )}
                    </div>
                  </th>
                  {columns.map((col) => (
                    <th
                      key={`col-${col.key}`}
                      className={`px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide ${col.sortable ? 'cursor-pointer hover:text-foreground' : ''}`}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.sortable && <SortIcon field={col.key} />}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="border-b border-border">
                      <td className="px-4 py-3">
                        <div className="w-4 h-4 bg-muted rounded animate-pulse" />
                      </td>
                      {columns.map((col) => (
                        <td key={`skel-col-${col.key}`} className="px-4 py-3">
                          <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="h-4 bg-muted rounded animate-pulse w-16" />
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 2} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <Icon name="FolderOpenIcon" size={36} className="text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">Aucun dossier trouvé</p>
                        <p className="text-xs text-muted-foreground">
                          Modifiez vos filtres ou créez un nouveau dossier.
                        </p>
                        <button
                          onClick={() => setShowNewCaseModal(true)}
                          className="btn-primary text-xs"
                        >
                          <Icon name="PlusIcon" size={14} />
                          Nouveau dossier
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((matter, idx) => (
                    <tr
                      key={matter.id}
                      className={`border-b border-border transition-colors cursor-pointer group ${
                        selectedMatter?.id === matter.id
                          ? 'bg-primary/5'
                          : idx % 2 === 0
                          ? 'bg-card hover:bg-muted/30' :'bg-muted/10 hover:bg-muted/30'
                      }`}
                      onClick={() =>
                        setSelectedMatter(selectedMatter?.id === matter.id ? null : matter)
                      }
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                            selectedIds.includes(matter.id)
                              ? 'bg-primary border-primary' :'border-border hover:border-primary/50'
                          }`}
                          onClick={() => toggleSelect(matter.id)}
                          role="checkbox"
                          aria-checked={selectedIds.includes(matter.id)}
                          aria-label={`Sélectionner ${matter.reference}`}
                        >
                          {selectedIds.includes(matter.id) && (
                            <Icon name="CheckIcon" size={10} className="text-white" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono-ref text-xs font-medium text-primary">
                          {matter.reference}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[260px]">
                        <p className="text-sm font-medium text-foreground truncate">{matter.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {matter.parties.join(' · ')}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${domainColors[matter.domain] || 'bg-gray-100 text-gray-600'}`}
                        >
                          {matter.domain}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge type="matter" value={matter.status} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge type="risk" value={matter.riskLevel} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono-ref tabular-nums text-foreground">
                          {matter.analyses}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono-ref tabular-nums text-foreground">
                          {matter.documents}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground font-mono-ref">
                          {matter.lastActivity}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setSelectedMatter(matter)}
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                            aria-label={`Ouvrir le dossier ${matter.reference}`}
                            title="Ouvrir le dossier"
                          >
                            <Icon name="EyeIcon" size={14} className="text-muted-foreground" />
                          </button>
                          <button
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                            aria-label={`Exporter ${matter.reference}`}
                            title="Exporter"
                          >
                            <Icon
                              name="ArrowDownTrayIcon"
                              size={14}
                              className="text-muted-foreground"
                            />
                          </button>
                          <button
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                            aria-label={`Archiver ${matter.reference}`}
                            title="Archiver le dossier"
                          >
                            <Icon
                              name="ArchiveBoxIcon"
                              size={14}
                              className="text-muted-foreground hover:text-red-500"
                            />
                          </button>
                          <button
                            onClick={() => setDeletingMatter(matter)}
                            className="p-1.5 rounded hover:bg-red-50 transition-colors"
                            aria-label={`Supprimer ${matter.reference}`}
                            title="Supprimer le dossier"
                          >
                            <Icon
                              name="TrashIcon"
                              size={14}
                              className="text-muted-foreground hover:text-red-600"
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Lignes par page :</span>
              <select
                className="input-field w-auto text-xs py-1"
                aria-label="Nombre de lignes par page"
              >
                <option>10</option>
                <option>25</option>
                <option>50</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-2">
                1 – {filtered.length} sur {filtered.length}
              </span>
              <button
                className="btn-ghost p-1.5 disabled:opacity-40"
                disabled
                aria-label="Page précédente"
              >
                <Icon name="ChevronLeftIcon" size={16} />
              </button>
              <button className="px-3 py-1 text-xs font-medium bg-primary text-white rounded-lg">
                1
              </button>
              <button
                className="btn-ghost p-1.5 disabled:opacity-40"
                disabled
                aria-label="Page suivante"
              >
                <Icon name="ChevronRightIcon" size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {selectedMatter && (
          <div className="w-full xl:w-[480px] flex-shrink-0">
            <CaseDetailPanel matter={selectedMatter} onClose={() => setSelectedMatter(null)} />
          </div>
        )}
      </div>

      {showNewCaseModal && (
        <NewCaseModal
          onClose={() => setShowNewCaseModal(false)}
          onCreated={(newMatter) => {
            setMatters((prev) => [newMatter, ...prev]);
            setShowNewCaseModal(false);
            toast.success('Dossier créé avec succès', { description: newMatter.reference });
          }}
        />
      )}

      {deletingMatter && (
        <DeleteCaseModal
          matter={deletingMatter}
          onClose={() => setDeletingMatter(null)}
          onConfirm={() => handleDeleteCase(deletingMatter)}
        />
      )}
    </div>
  );
}