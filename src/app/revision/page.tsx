import AppLayout from '@/components/AppLayout';
import ReviewerContent from './components/ReviewerContent';

export default function RevisionPage() {
  return (
    <AppLayout
      title="Interface Réviseur"
      breadcrumbs={[{ label: 'Révision juridique' }]}
    >
      <ReviewerContent />
    </AppLayout>
  );
}
