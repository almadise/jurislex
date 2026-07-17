'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { caseService } from '@/lib/services/caseService';

interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  label: string;
  details: Record<string, any>;
  userName: string;
  userEmail: string;
  createdAt: string;
  createdTime: string;
}

interface AuditLogProps {
  caseId: string;
}

const actionConfig: Record<string, { icon: string; color: string; label: string }> = {
  create: { icon: 'FolderPlusIcon', color: 'bg-green-100 text-green-600', label: 'Création' },
  update: { icon: 'PencilSquareIcon', color: 'bg-blue-100 text-blue-600', label: 'Modification' },
  delete: { icon: 'TrashIcon', color: 'bg-red-100 text-red-600', label: 'Suppression' },
  status_change: { icon: 'ArrowPathIcon', color: 'bg-amber-100 text-amber-600', label: 'Changement statut' },
  view: { icon: 'EyeIcon', color: 'bg-gray-100 text-gray-500', label: 'Consultation' },
  export: { icon: 'ArrowDownTrayIcon', color: 'bg-indigo-100 text-indigo-600', label: 'Export' },
  analysis: { icon: 'DocumentMagnifyingGlassIcon', color: 'bg-purple-100 text-purple-600', label: 'Analyse' },
  document: { icon: 'DocumentTextIcon', color: 'bg-cyan-100 text-cyan-600', label: 'Document' },
  note: { icon: 'ChatBubbleBottomCenterTextIcon', color: 'bg-orange-100 text-orange-600', label: 'Note' },
  archive: { icon: 'ArchiveBoxIcon', color: 'bg-gray-100 text-gray-600', label: 'Archivage' },
};

export default function AuditLog({ caseId }: AuditLogProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await caseService.getAuditLog(caseId);
        if (!cancelled) setEvents(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [caseId]);

  const filtered = filterAction === 'all'
    ? events
    : events.filter((e) => e.action === filterAction);

  const actionOptions = [
    { value: 'all', label: 'Toutes les actions' },
    { value: 'create', label: 'Création' },
    { value: 'update', label: 'Modification' },
    { value: 'status_change', label: 'Changement statut' },
    { value: 'analysis', label: 'Analyse' },
    { value: 'document', label: 'Document' },
    { value: 'delete', label: 'Suppression' },
    { value: 'archive', label: 'Archivage' },
  ];

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 bg-muted rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <Icon name="FunnelIcon" size={14} className="text-muted-foreground flex-shrink-0" />
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="input-field text-xs py-1.5 w-auto flex-1"
          aria-label="Filtrer par action"
        >
          {actionOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground font-mono-ref flex-shrink-0">
          {filtered.length} événement{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Events */}
      {filtered.length === 0 ? (
        <div className="text-center py-10">
          <Icon name="ClipboardDocumentListIcon" size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Aucun événement enregistré.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-3 pl-10">
            {filtered.map((event) => {
              const config = actionConfig[event.action] ?? actionConfig.update;
              return (
                <div key={event.id} className="relative group">
                  <div className={`absolute -left-6 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.color}`}>
                    <Icon name={config.icon as Parameters<typeof Icon>[0]['name']} size={14} />
                  </div>
                  <div className="p-3 bg-muted/40 rounded-lg border border-border hover:border-border/80 transition-colors">
                    <p className="text-xs font-medium text-foreground leading-snug">{event.label}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${config.color}`}>
                        {config.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono-ref">
                        {event.createdAt} à {event.createdTime}
                      </span>
                      <span className="text-muted-foreground text-[11px]">·</span>
                      <span className="text-[11px] text-muted-foreground truncate max-w-[140px]" title={event.userEmail}>
                        {event.userName || event.userEmail}
                      </span>
                    </div>
                    {/* Details */}
                    {Object.keys(event.details).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(event.details).map(([k, v]) => (
                          <span key={k} className="text-[10px] bg-background border border-border px-1.5 py-0.5 rounded font-mono-ref text-muted-foreground">
                            {k}: {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
