import React from 'react';
import AppLayout from '@/components/AppLayout';
import ObservatoryContent from './components/ObservatoryContent';

export default function ObservatoryPage() {
  return (
    <AppLayout
      breadcrumbs={[{ label: 'JurisLex' }, { label: 'Observatoire des mises à jour' }]}
    >
      <ObservatoryContent />
    </AppLayout>
  );
}
