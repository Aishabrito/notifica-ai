import React from "react";

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value?: number;
  accent: string;
  iconBg: string;
  sub?: string;
}

export default function StatCard({ icon: Icon, label, value, accent, iconBg, sub }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{label}</p>
          {value !== undefined ? (
            <p className={`text-4xl font-bold mt-1 tracking-tight ${accent}`}>{value}</p>
          ) : (
            <div className="w-14 h-9 bg-slate-100 rounded-lg animate-pulse mt-1" />
          )}
          {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`${iconBg} p-2.5 rounded-xl shrink-0`}>
          <Icon size={18} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}