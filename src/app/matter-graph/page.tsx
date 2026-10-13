import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import MatterGraphContent from './components/MatterGraphContent';

export default function MatterGraphPage() {
  return (
    <AppLayout
      breadcrumbs={[
        { label: 'JurisLex' },
        { label: 'Dossiers', href: '/case-management' },
        { label: 'Graphe' },
      ]}
    >
      <Suspense fallback={<div className="card p-8 text-sm text-muted-foreground">Chargement…</div>}>
        <MatterGraphContent />
      </Suspense>
    </AppLayout>
  );
}
