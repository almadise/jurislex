import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import LegalAnalysisContent from './components/LegalAnalysisContent';

export default function LegalAnalysisPage() {
  return (
    <AppLayout
      breadcrumbs={[
        { label: 'JurisLex' },
        { label: 'Analyse de situation' },
      ]}
    >
      <Suspense
        fallback={
          <div className="card p-8 text-sm text-muted-foreground">Chargement de l’analyse…</div>
        }
      >
        <LegalAnalysisContent />
      </Suspense>
    </AppLayout>
  );
}