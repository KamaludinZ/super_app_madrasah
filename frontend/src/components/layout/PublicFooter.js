import React from 'react';

export default function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-50 border-t border-slate-200 mt-12">
      <div className="container mx-auto px-4 py-6 text-center">
        <p className="text-xs text-slate-500">
          Super Apps MATSANDATAMA v1.2.1 &copy; {currentYear} - Kementerian Agama Republik Indonesia
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Dikembangkan untuk meningkatkan kualitas layanan pendidikan madrasah
        </p>
      </div>
    </footer>
  );
}
