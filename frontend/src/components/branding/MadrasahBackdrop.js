import React from 'react';

/**
 * MadrasahBackdrop — soft animated background ornaments dengan tema pendidikan madrasah.
 *
 * Elemen:
 * - Pola geometri Islam (8-pointed stars + arabesque) yang mengambang lembut
 * - Beberapa ikon SVG buku/pena/bulan-sabit yang bergerak naik-turun pelan
 * - Warna sangat lembut (low opacity) supaya tidak mengganggu konten
 *
 * Tidak menggunakan library tambahan — animasi murni CSS keyframes.
 */
export default function MadrasahBackdrop({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}
      data-testid="madrasah-backdrop"
    >
      {/* Static base wash */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/60 via-amber-50/40 to-emerald-100/30" />

      {/* Floating ornaments - SVGs sized + animated via class */}
      <Ornament style={{ top: '8%', left: '6%', animationDelay: '0s' }} delay="0s" duration="14s">
        <IslamicStar size={84} color="#006837" />
      </Ornament>
      <Ornament style={{ top: '18%', right: '8%', animationDelay: '2.5s' }} delay="2.5s" duration="18s">
        <BookIcon size={72} color="#C99B2C" />
      </Ornament>
      <Ornament style={{ top: '52%', left: '12%', animationDelay: '4s' }} delay="4s" duration="22s">
        <CrescentMoon size={90} color="#006837" />
      </Ornament>
      <Ornament style={{ top: '64%', right: '14%', animationDelay: '1s' }} delay="1s" duration="20s">
        <IslamicStar size={120} color="#0B7A3B" />
      </Ornament>
      <Ornament style={{ bottom: '8%', left: '32%', animationDelay: '5s' }} delay="5s" duration="16s">
        <PenNibIcon size={64} color="#C99B2C" />
      </Ornament>
      <Ornament style={{ top: '38%', right: '34%', animationDelay: '3s' }} delay="3s" duration="24s">
        <ArabesquePattern size={130} color="#006837" />
      </Ornament>
      <Ornament style={{ bottom: '24%', right: '6%', animationDelay: '6s' }} delay="6s" duration="19s">
        <BookIcon size={56} color="#006837" />
      </Ornament>
      <Ornament style={{ top: '78%', left: '4%', animationDelay: '7s' }} delay="7s" duration="21s">
        <IslamicStar size={60} color="#C99B2C" />
      </Ornament>

      <style>{`
        @keyframes mb-drift-1 {
          0%, 100% { transform: translateY(0) translateX(0) rotate(0deg); }
          25% { transform: translateY(-14px) translateX(8px) rotate(8deg); }
          50% { transform: translateY(-6px) translateX(-10px) rotate(-6deg); }
          75% { transform: translateY(-18px) translateX(4px) rotate(4deg); }
        }
        @keyframes mb-drift-2 {
          0%, 100% { transform: translateY(0) translateX(0) rotate(0deg); }
          33% { transform: translateY(12px) translateX(-8px) rotate(-10deg); }
          66% { transform: translateY(-10px) translateX(6px) rotate(6deg); }
        }
        .mb-orn-anim { animation: mb-drift-1 var(--mb-d, 16s) ease-in-out infinite; }
        .mb-orn-anim:nth-child(even) { animation-name: mb-drift-2; }
      `}</style>
    </div>
  );
}

function Ornament({ children, style, delay, duration }) {
  return (
    <div
      className="absolute mb-orn-anim opacity-[0.12]"
      style={{ ...style, '--mb-d': duration, animationDelay: delay }}
    >
      {children}
    </div>
  );
}

// ---------- SVG ICONS ----------
function IslamicStar({ size = 80, color = '#006837' }) {
  // 8-pointed star
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <g transform="translate(50,50)">
        <polygon
          points="0,-45 14,-14 45,0 14,14 0,45 -14,14 -45,0 -14,-14"
          fill={color}
        />
        <polygon
          points="0,-32 10,-10 32,0 10,10 0,32 -10,10 -32,0 -10,-10"
          transform="rotate(22.5)"
          fill={color}
          opacity="0.65"
        />
        <circle r="6" fill={color} opacity="0.85" />
      </g>
    </svg>
  );
}

function CrescentMoon({ size = 80, color = '#006837' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <path
        d="M 70 20 A 35 35 0 1 0 70 80 A 28 28 0 1 1 70 20 Z"
        fill={color}
      />
    </svg>
  );
}

function BookIcon({ size = 64, color = '#006837' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth="2.5">
      <path d="M15 20 C 30 12, 45 12, 50 20 V 80 C 45 72, 30 72, 15 80 Z" fill={color} fillOpacity="0.18" />
      <path d="M85 20 C 70 12, 55 12, 50 20 V 80 C 55 72, 70 72, 85 80 Z" fill={color} fillOpacity="0.18" />
      <path d="M50 20 V 80" />
      <path d="M22 30 Q 32 28, 42 30 M22 42 Q 32 40, 42 42 M22 54 Q 32 52, 42 54" strokeWidth="1.8" />
      <path d="M58 30 Q 68 28, 78 30 M58 42 Q 68 40, 78 42 M58 54 Q 68 52, 78 54" strokeWidth="1.8" />
    </svg>
  );
}

function PenNibIcon({ size = 56, color = '#C99B2C' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill={color} fillOpacity="0.7">
      <path d="M50 10 L 60 60 L 50 90 L 40 60 Z" />
      <circle cx="50" cy="55" r="6" fill="white" />
      <path d="M50 10 L 50 60" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function ArabesquePattern({ size = 120, color = '#006837' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" stroke={color} strokeWidth="1.8" opacity="0.9">
      <circle cx="60" cy="60" r="40" />
      <circle cx="60" cy="60" r="25" />
      <circle cx="60" cy="60" r="55" />
      <path d="M60 20 Q 80 40 60 60 Q 40 40 60 20 Z" />
      <path d="M60 100 Q 80 80 60 60 Q 40 80 60 100 Z" />
      <path d="M20 60 Q 40 80 60 60 Q 40 40 20 60 Z" />
      <path d="M100 60 Q 80 80 60 60 Q 80 40 100 60 Z" />
    </svg>
  );
}
