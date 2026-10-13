'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import CaseDetailPanel from './CaseDetailPanel';
import NewCaseModal from './NewCaseModal';
import { toast } from 'sonner';
import { fetchCurrentUser } from '@/lib/auth/client';
import type { AuthUser } from '@/lib/contracts/matter';

export interface Matter {
  id: string;
  reference: string;
  title: string;
  domain: string;
  parties: string[];
  partyDetails?: { name: string; quality?: string; contact?: string }[];
  status: 'draft' | 'active' | 'analysis' | 'documented' | 'closed' | 'archived';
  analyses: number;
  documents: number;
  lastActivity: string;
  createdAt: string;
  assignedTo: string;
  riskLevel: 'low' | 'medium' | 'high';
  tags: string[];
  ownerId?: string;
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [sortField, setSortField] = useState<keyof Matter>('lastActivity');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const loadMatters = useCallback(async () => {
    setLoading(true);
    try {
      const me = await fetchCurrentUser();
      setUser(me);
      if (!me) {
        setAuthRequired(true);
        setMatters([]);
        return;
      }
      setAuthRequired(false);
      const res = await fetch('/api/matters', { credentials: 'include' });
      if (res.status === 401) {
        setAuthRequired(true);
        setMatters([]);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || 'Chargement impossible');
      setMatters(data.matters ?? []);
    } catch (e) {
      toast.error('Dossiers indisponibles', { description: (e as Error).message });
      setMatters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMatters();
  }, [loadMatters]);

  const filtered = matters
    .filter((m) => {
      const matchesSearch =
        !searchQuery ||
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.parties.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
      const matchesDomain = domainFilter === 'all' || m.domain === domainFilter;
      return matchesSearch && matchesStatus && matchesDomain;
    })
    .sort((a, b) => {
      const av = String(a[sortField] ?? '');
      const bv = String(b[sortField] ?? '');
      const cmp = av.localeCompare(bv, 'fr');
      return sortDir === 'asc' ? cmp : -cmp;
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
    if (selectedIds.length === filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered.map((m) => m.id));
  };

  const handleBulkClose = async () => {
    await Promise.all(
      selectedIds.map((id) =>
        fetch(`/api/matters/${id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'closed' }),
        })
      )
    );
    toast.success(
      `${selectedIds.length} dossier${selectedIds.length > 1 ? 's' : ''} clôturé${selectedIds.length > 1 ? 's' : ''}`
    );
    setSelectedIds([]);
    void loadMatters();
  };

  const handleArchive = async (id: string) => {
    const res = await fetch(`/api/matters/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const j = await res.json();
      toast.error(j.erreur || 'Archivage impossible');
      return;
    }
    toast.success('Dossier archivé');
    if (selectedMatter?.id === id) setSelectedMatter(null);
    void loadMatters();
  };

  const handleExport = async (id: string) => {
    const res = await fetch(`/api/matters/${id}?export=1`, {
      method: 'PUT',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.erreur || 'Export impossible');
      return;
    }
    const blob = new Blob([JSON.stringify(data.export, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.export.reference || id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export téléchargé (audité)');
  };

  const handleHardDelete = async (id: string) => {
    if (!confirm('Supprimer définitivement ce dossier ? Action irréversible.')) return;
    const res = await fetch(`/api/matters/${id}?hard=1`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const j = await res.json();
      toast.error(j.erreur || 'Suppression impossible');
      return;
    }
    toast.success('Dossier supprimé');
    if (selectedMatter?.id === id) setSelectedMatter(null);
    void loadMatters();
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
    { key: 'lastActivity', label: 'Dernière activité', sortable: true },
  ];

  if (authRequired) {
    return (
      <div className="card p-10 text-center max-w-lg mx-auto mt-10">
        <Icon name="LockClosedIcon" size={40} className="text-muted-foreground mx-auto mb-4" />
        <h1 className="text-lg font-semibold text-foreground mb-2">Connexion requise</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Les dossiers sont isolés par utilisateur. Connectez-vous ou créez un compte pour gérer vos
          dossiers.
        </p>
        <Link href="/sign-up-login" className="btn-primary inline-flex justify-center">
          <Icon name="ArrowRightOnRectangleIcon" size={16} />
          Se connecter / S&apos;inscrire
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Gestion des dossiers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading
              ? 'Chargement…'
              : `${matters.length} dossier${matters.length !== 1 ? 's' : ''}`}
            {user ? ` · ${user.fullName}` : ''}
            <span className="ml-2 text-[11px] font-mono-ref text-muted-foreground">
              isolation propriétaire
            </span>
          </p>
        </div>
        <button type="button" onClick={() => setShowNewCaseModal(true)} className="btn-primary">
          <Icon name="PlusIcon" size={16} />
          Nouveau dossier
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {[
          {
            label: 'Actifs',
            count: matters.filter((m) => m.status === 'active').length,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            label: 'En analyse',
            count: matters.filter((m) => m.status === 'analysis').length,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
          },
          {
            label: 'Documentés',
            count: matters.filter((m) => m.status === 'documented').length,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
          },
          {
            label: 'Clôturés',
            count: matters.filter((m) => m.status === 'closed').length,
            color: 'text-green-600',
            bg: 'bg-green-50',
          },
          {
            label: 'Risque élevé',
            count: matters.filter((m) => m.riskLevel === 'high').length,
            color: 'text-red-600',
            bg: 'bg-red-50',
          },
          {
            label: 'Brouillons',
            count: matters.filter((m) => m.status === 'draft').length,
            color: 'text-foreground',
            bg: 'bg-muted',
          },
        ].map((stat) => (
          <div key={`stat-${stat.label}`} className={`card p-3 ${stat.bg} border-0`}>
            <p className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.count}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-6">
        <div className={`flex-1 min-w-0 card overflow-hidden ${selectedMatter ? 'hidden xl:block' : ''}`}>
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
            >
              {domainOptions.map((o) => (
                <option key={`domain-opt-${o.value}`} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border-b border-primary/20">
              <span className="text-sm font-medium text-primary">
                {selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}
              </span>
              <button type="button" onClick={() => void handleBulkClose()} className="btn-secondary text-xs">
                Clôturer
              </button>
              <button type="button" onClick={() => setSelectedIds([])} className="ml-auto btn-ghost text-xs">
                Annuler
              </button>
            </div>
          )}

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[800px]" role="table">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-10 px-4 py-3">
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${
                        selectedIds.length === filtered.length && filtered.length > 0
                          ? 'bg-primary border-primary'
                          : 'border-border'
                      }`}
                      onClick={toggleSelectAll}
                      role="checkbox"
                      aria-checked={selectedIds.length === filtered.length && filtered.length > 0}
                    >
                      {selectedIds.length === filtered.length && filtered.length > 0 && (
                        <Icon name="CheckIcon" size={10} className="text-white" />
                      )}
                    </div>
                  </th>
                  {columns.map((col) => (
                    <th
                      key={`col-${col.key}`}
                      className={`px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide ${
                        col.sortable ? 'cursor-pointer' : ''
                      }`}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.sortable && <SortIcon field={col.key} />}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={columns.length + 2} className="text-center py-16 text-sm text-muted-foreground">
                      Chargement des dossiers…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 2} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <Icon name="FolderOpenIcon" size={36} className="text-muted-foreground" />
                        <p className="text-sm font-semibold">Aucun dossier</p>
                        <p className="text-xs text-muted-foreground">
                          Créez un dossier pour démarrer une analyse traçable.
                        </p>
                        <button
                          type="button"
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
                      className={`border-b border-border cursor-pointer ${
                        selectedMatter?.id === matter.id
                          ? 'bg-primary/5'
                          : idx % 2 === 0
                            ? 'bg-card hover:bg-muted/30'
                            : 'bg-muted/10 hover:bg-muted/30'
                      }`}
                      onClick={() =>
                        setSelectedMatter(selectedMatter?.id === matter.id ? null : matter)
                      }
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${
                            selectedIds.includes(matter.id)
                              ? 'bg-primary border-primary'
                              : 'border-border'
                          }`}
                          onClick={() => toggleSelect(matter.id)}
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
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            domainColors[matter.domain] || 'bg-gray-100 text-gray-600'
                          }`}
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
                        <span className="text-xs text-muted-foreground font-mono-ref">
                          {matter.lastActivity}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedMatter(matter)}
                            className="p-1.5 rounded hover:bg-muted"
                            title="Ouvrir"
                          >
                            <Icon name="EyeIcon" size={14} className="text-muted-foreground" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleExport(matter.id)}
                            className="p-1.5 rounded hover:bg-muted"
                            title="Exporter"
                          >
                            <Icon
                              name="ArrowDownTrayIcon"
                              size={14}
                              className="text-muted-foreground"
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleArchive(matter.id)}
                            className="p-1.5 rounded hover:bg-red-50"
                            title="Archiver"
                          >
                            <Icon
                              name="ArchiveBoxIcon"
                              size={14}
                              className="text-muted-foreground"
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
        </div>

        {selectedMatter && (
          <div className="w-full xl:w-[480px] flex-shrink-0">
            <CaseDetailPanel
              matter={selectedMatter}
              onClose={() => setSelectedMatter(null)}
              onExport={() => void handleExport(selectedMatter.id)}
              onDelete={() => void handleHardDelete(selectedMatter.id)}
            />
          </div>
        )}
      </div>

      {showNewCaseModal && (
        <NewCaseModal
          onClose={() => setShowNewCaseModal(false)}
          onCreated={(newMatter) => {
            setMatters((prev) => [newMatter, ...prev]);
            setShowNewCaseModal(false);
            toast.success('Dossier créé', { description: newMatter.reference });
          }}
        />
      )}
    </div>
  );
}
