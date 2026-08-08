import React from 'react';
import { Loader2 } from 'lucide-react';

export function PageLoader({ message = "Memuat data..." }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#006837] mx-auto" />
        <p className="text-sm text-slate-600">{message}</p>
      </div>
    </div>
  );
}

export function FullPageLoader({ message = "Memuat..." }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-[#006837] mx-auto" />
        <p className="text-base text-slate-700 font-medium">{message}</p>
      </div>
    </div>
  );
}
