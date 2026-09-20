import React from 'react';

export default function LabKPI({ label, value, icon: Icon, color = 'slate' }) {
  const cls = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    rose: 'bg-rose-50 border-rose-200 text-rose-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
    slate: 'bg-white border-slate-200 text-slate-700',
  }[color];
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</span>
        <Icon className="h-4 w-4 opacity-60" />
      </div>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}
