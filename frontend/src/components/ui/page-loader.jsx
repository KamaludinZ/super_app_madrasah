import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

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
  const [logo, setLogo] = useState(null);
  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const { data } = await api.get('/app-info');
        if (data.logo) {
          setLogo(data.logo);
        }
        if (data.school_name) {
          setSchoolName(data.school_name);
        }
      } catch (error) {
        // Fallback: use default loading
      } finally {
        setLoading(false);
      }
    };

    fetchLogo();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="flex flex-col items-center space-y-6">
        {/* Logo Container */}
        <div className="relative">
          {/* Animated background circle */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin"></div>
          </div>

          {/* Logo */}
          <div className="relative z-10 flex items-center justify-center w-32 h-32">
            {!loading && logo ? (
              <img
                src={logo}
                alt={schoolName || 'Logo'}
                className="max-w-full max-h-full object-contain animate-pulse"
                style={{ animationDuration: '2s' }}
              />
            ) : (
              <div className="w-20 h-20 bg-slate-200 rounded-lg animate-pulse"></div>
            )}
          </div>
        </div>

        {/* Loading Text */}
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">
            {schoolName || 'Super Apps MATSANDATAMA'}
          </h2>
          <p className="text-sm text-slate-600 animate-pulse">
            {message}
          </p>
        </div>

        {/* Loading Dots Animation */}
        <div className="flex space-x-2">
          <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}
