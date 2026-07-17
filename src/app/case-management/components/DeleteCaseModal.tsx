'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import type { Matter } from './CaseManagementContent';

interface DeleteCaseModalProps {
  matter: Matter;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteCaseModal({ matter, onClose, onConfirm }: DeleteCaseModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expectedText = matter.reference;
  const isConfirmed = confirmText.trim() === expectedText;

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err: any) {
      setError(err.message ?? 'Erreur lors de la suppression.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 fade-in">
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
          <Icon name="TrashIcon" size={22} className="text-red-600" />
        </div>

        {/* Title */}
        <h2 className="text-base font-bold text-foreground text-center mb-1">
          Supprimer le dossier
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-5">
          Cette action est <span className="font-semibold text-red-600">irréversible</span>. Toutes les données associées (analyses, documents, parties, preuves, journal d'audit) seront définitivement supprimées.
        </p>

        {/* Case info */}
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-5">
          <div className="flex items-start gap-3">
            <Icon name="FolderIcon" size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-red-700 font-mono-ref">{matter.reference}</p>
              <p className="text-xs text-red-600 truncate">{matter.title}</p>
              <p className="text-[11px] text-red-500 mt-0.5">
                {matter.analyses} analyse{matter.analyses !== 1 ? 's' : ''} · {matter.documents} document{matter.documents !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Confirmation input */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Tapez <span className="font-mono-ref font-bold text-red-600">{expectedText}</span> pour confirmer la suppression
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={expectedText}
            className={`input-field font-mono-ref text-sm transition-colors ${
              confirmText && !isConfirmed ? 'border-red-300 focus:border-red-400' : ''
            } ${isConfirmed ? 'border-green-400' : ''}`}
            autoFocus
            aria-label="Confirmer la référence du dossier"
          />
          {confirmText && !isConfirmed && (
            <p className="text-[11px] text-red-500 mt-1">
              La référence ne correspond pas.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
            <Icon name="ExclamationTriangleIcon" size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn-secondary flex-1 justify-center"
          >
            Annuler
          </button>
          <button
            onClick={handleDelete}
            disabled={!isConfirmed || loading}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isConfirmed && !loading
                ? 'bg-red-600 hover:bg-red-700 text-white' :'bg-red-200 text-red-400 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Suppression...
              </>
            ) : (
              <>
                <Icon name="TrashIcon" size={14} />
                Supprimer définitivement
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
