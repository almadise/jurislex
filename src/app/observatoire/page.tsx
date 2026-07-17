'use client';

import React from 'react';
import AppLayout from '@/components/AppLayout';
import ObservatoireContent from './components/ObservatoireContent';

export default function ObservatoirePage() {
  return (
    <AppLayout
      title="Observatoire des mises à jour"
      breadcrumbs={[{ label: 'Observatoire des mises à jour' }]}
    >
      <ObservatoireContent />
    </AppLayout>
  );
}
