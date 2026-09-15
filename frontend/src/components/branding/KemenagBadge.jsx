import React from 'react';
import { Badge } from '@/components/ui/badge';

/**
 * Kemenag Badge Component
 * Official branding badge for Kementerian Agama RI
 * Use this for official documents, headers, and branding areas
 */
export function KemenagBadge({ className = '', variant = 'default' }) {
  const variants = {
    default: 'bg-[#006837]/15 text-[#0B7A3B] border-[#006837]/30',
    solid: 'bg-[#006837] text-white border-[#006837]',
    outline: 'bg-transparent text-[#006837] border-[#006837]',
    subtle: 'bg-[#006837]/8 text-[#0B7A3B] border-[#006837]/20',
  };

  return (
    <Badge className={`${variants[variant]} ${className}`}>
      <svg
        className="h-3 w-3 mr-1.5"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Simplified Kemenag emblem icon */}
        <path
          d="M12 3L4 7V11C4 16.55 7.84 21.54 13 23C18.16 21.54 22 16.55 22 11V7L12 3Z"
          fill="currentColor"
          opacity="0.2"
        />
        <path
          d="M12 3L4 7V11C4 16.55 7.84 21.54 13 23C18.16 21.54 22 16.55 22 11V7L12 3Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 12L11 14L15 10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Kementerian Agama RI
    </Badge>
  );
}

/**
 * MTsN 2 Badge Component
 * School-specific branding badge
 */
export function MTsN2Badge({ className = '', variant = 'default' }) {
  const variants = {
    default: 'bg-[#C8A24A]/15 text-[#B7791F] border-[#C8A24A]/30',
    solid: 'bg-gradient-to-r from-[#C8A24A] to-[#D4AF37] text-white border-transparent',
    outline: 'bg-transparent text-[#C8A24A] border-[#C8A24A]',
  };

  return (
    <Badge className={`${variants[variant]} font-semibold ${className}`}>
      <svg
        className="h-3 w-3 mr-1.5"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Graduation cap icon */}
        <path
          d="M12 14L21 9L12 4L3 9L12 14Z"
          fill="currentColor"
          opacity="0.2"
        />
        <path
          d="M12 14L21 9L12 4L3 9L12 14Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 14V20M12 20C10.5 19.5 7 18 7 15V10M12 20C13.5 19.5 17 18 17 15V10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      MTsN 2 Kota Malang
    </Badge>
  );
}

/**
 * Madrasah Header Component
 * Combines Kemenag + School branding
 */
export function MadrasahHeader({ showKemenag = true, showSchool = true, size = 'md' }) {
  const sizes = {
    sm: {
      container: 'gap-2',
      text: 'text-sm',
      subtext: 'text-xs',
    },
    md: {
      container: 'gap-3',
      text: 'text-base',
      subtext: 'text-sm',
    },
    lg: {
      container: 'gap-4',
      text: 'text-lg',
      subtext: 'text-base',
    },
  };

  const sizeConfig = sizes[size];

  return (
    <div className={`flex flex-col ${sizeConfig.container}`}>
      {showKemenag && <KemenagBadge variant="default" />}
      {showSchool && (
        <div>
          <h1 className={`${sizeConfig.text} font-bold text-[#006837] leading-tight`}>
            Super Apps MATSANDATAMA
          </h1>
          <p className={`${sizeConfig.subtext} text-slate-600 mt-0.5`}>
            Madrasah Tsanawiyah Negeri 2 Kota Malang
          </p>
        </div>
      )}
    </div>
  );
}
