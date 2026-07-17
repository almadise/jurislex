import React from 'react';
import AppLayout from '@/components/AppLayout';
import LegalSearchContent from './components/LegalSearchContent';

export default function LegalSearchPage() {
  return (
    <AppLayout
      breadcrumbs={[
        { label: 'juriLex' },
        { label: 'Recherche juridique' },
      ]}
    >
      <LegalSearchContent />
    </AppLayout>
  );
}