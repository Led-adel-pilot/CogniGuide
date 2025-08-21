import { Suspense } from 'react';
import DashboardClient from './DashboardClient';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading...
      </div>
    }>
      <DashboardClient />
    </Suspense>
  );
}
