import React from 'react';

/**
 * Islamic Geometric Pattern Components
 * Subtle, non-intrusive patterns for backgrounds and accents
 * Based on traditional Islamic geometric art
 */

/**
 * 8-Point Star Pattern (Rub el Hizb)
 * Common Islamic symbol, used in decorative art
 */
export function StarPattern({ className = '', opacity = 0.04 }) {
  return (
    <svg
      className={className}
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="star-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          <g opacity={opacity}>
            {/* 8-point star */}
            <path
              d="M40,10 L42,22 L50,15 L45,27 L57,25 L48,35 L60,40 L48,45 L57,55 L45,53 L50,65 L42,58 L40,70 L38,58 L30,65 L35,53 L23,55 L32,45 L20,40 L32,35 L23,25 L35,27 L30,15 L38,22 Z"
              fill="#006837"
            />
            {/* Center circle */}
            <circle cx="40" cy="40" r="6" fill="#C8A24A" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#star-pattern)" />
    </svg>
  );
}

/**
 * Geometric Tile Pattern
 * Repeating hexagonal Islamic pattern
 */
export function TilePattern({ className = '', opacity = 0.05 }) {
  return (
    <svg
      className={className}
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="tile-pattern" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
          <g opacity={opacity}>
            {/* Hexagon tiles */}
            <path
              d="M30,0 L45,8.66 L45,25.98 L30,34.64 L15,25.98 L15,8.66 Z"
              fill="none"
              stroke="#006837"
              strokeWidth="1.5"
            />
            <path
              d="M0,26 L15,34.66 L15,52 L0,60.64 L-15,52 L-15,34.66 Z"
              fill="none"
              stroke="#C8A24A"
              strokeWidth="1"
            />
            <path
              d="M60,26 L75,34.66 L75,52 L60,60.64 L45,52 L45,34.66 Z"
              fill="none"
              stroke="#C8A24A"
              strokeWidth="1"
            />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#tile-pattern)" />
    </svg>
  );
}

/**
 * Mosque Dome Silhouette
 * For empty states and Islamic-themed illustrations
 */
export function MosqueDome({ className = '', color = '#006837' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Crescent moon on top */}
      <path
        d="M100 10 C100 10, 90 15, 90 25 C90 35, 100 40, 100 40 C100 40, 95 35, 95 25 C95 18, 100 14, 100 10 Z"
        fill={color}
        opacity="0.3"
      />

      {/* Main dome */}
      <path
        d="M50 100 Q50 60, 100 60 Q150 60, 150 100"
        stroke={color}
        strokeWidth="3"
        fill="none"
        opacity="0.2"
      />
      <path
        d="M50 100 Q50 60, 100 60 Q150 60, 150 100"
        fill={color}
        opacity="0.1"
      />

      {/* Minaret left */}
      <rect x="40" y="100" width="10" height="80" fill={color} opacity="0.15" />
      <circle cx="45" cy="95" r="8" fill={color} opacity="0.2" />

      {/* Minaret right */}
      <rect x="150" y="100" width="10" height="80" fill={color} opacity="0.15" />
      <circle cx="155" cy="95" r="8" fill={color} opacity="0.2" />

      {/* Main structure */}
      <rect x="60" y="100" width="80" height="90" fill={color} opacity="0.1" />

      {/* Arch entrance */}
      <path
        d="M80 140 Q80 120, 100 120 Q120 120, 120 140 L120 190 L80 190 Z"
        fill={color}
        opacity="0.15"
      />

      {/* Decorative lines */}
      <line x1="60" y1="130" x2="140" y2="130" stroke={color} strokeWidth="1" opacity="0.2" />
      <line x1="60" y1="160" x2="140" y2="160" stroke={color} strokeWidth="1" opacity="0.2" />
    </svg>
  );
}

/**
 * Quran Book Icon
 * For religious/educational context
 */
export function QuranIcon({ className = '', color = '#006837' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Book cover */}
      <rect x="20" y="15" width="60" height="70" rx="4" fill={color} opacity="0.1" />
      <rect x="20" y="15" width="60" height="70" rx="4" stroke={color} strokeWidth="2" opacity="0.3" />

      {/* Book spine */}
      <rect x="20" y="15" width="8" height="70" fill={color} opacity="0.2" />

      {/* Decorative pattern on cover */}
      <circle cx="50" cy="50" r="15" stroke="#C8A24A" strokeWidth="2" opacity="0.4" />
      <path
        d="M50 40 L52 48 L60 48 L54 53 L56 61 L50 56 L44 61 L46 53 L40 48 L48 48 Z"
        fill="#C8A24A"
        opacity="0.4"
      />

      {/* Arabic calligraphy placeholder (stylized) */}
      <text x="50" y="75" fontSize="12" textAnchor="middle" fill={color} opacity="0.5" fontFamily="serif">
        ﷽
      </text>
    </svg>
  );
}

/**
 * Prayer Beads (Tasbih) Icon
 * For prayer/spiritual context
 */
export function TasbihIcon({ className = '', color = '#006837' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* String of beads in circular arrangement */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
        const angle = (i * 30 * Math.PI) / 180;
        const x = 50 + 35 * Math.cos(angle);
        const y = 50 + 35 * Math.sin(angle);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="4"
            fill={i % 3 === 0 ? '#C8A24A' : color}
            opacity={i % 3 === 0 ? 0.6 : 0.3}
          />
        );
      })}

      {/* Center ornament */}
      <circle cx="50" cy="50" r="8" fill={color} opacity="0.15" />
      <circle cx="50" cy="50" r="8" stroke={color} strokeWidth="2" opacity="0.3" />

      {/* Tassel */}
      <line x1="50" y1="85" x2="50" y2="95" stroke={color} strokeWidth="2" opacity="0.3" />
      <circle cx="50" cy="97" r="3" fill="#C8A24A" opacity="0.4" />
    </svg>
  );
}

/**
 * Islamic Lantern (Fanous)
 * For festive/celebration contexts
 */
export function LanternIcon({ className = '', color = '#C8A24A' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Hook */}
      <line x1="50" y1="5" x2="50" y2="15" stroke={color} strokeWidth="2" opacity="0.4" />
      <circle cx="50" cy="15" r="3" fill={color} opacity="0.4" />

      {/* Top cap */}
      <path d="M35 20 L50 15 L65 20" stroke={color} strokeWidth="2" fill="none" opacity="0.4" />

      {/* Lantern body */}
      <path
        d="M40 25 L35 45 L35 65 L40 80 L60 80 L65 65 L65 45 L60 25 Z"
        fill={color}
        opacity="0.1"
        stroke={color}
        strokeWidth="2"
      />

      {/* Glass panels pattern */}
      <line x1="50" y1="25" x2="50" y2="80" stroke={color} strokeWidth="1" opacity="0.2" />
      <line x1="35" y1="50" x2="65" y2="50" stroke={color} strokeWidth="1" opacity="0.2" />

      {/* Light glow */}
      <ellipse cx="50" cy="52" rx="10" ry="15" fill="#FFFDF7" opacity="0.3" />

      {/* Bottom decoration */}
      <circle cx="45" cy="85" r="2" fill={color} opacity="0.5" />
      <circle cx="50" cy="87" r="2" fill={color} opacity="0.5" />
      <circle cx="55" cy="85" r="2" fill={color} opacity="0.5" />
    </svg>
  );
}

/**
 * Background Pattern Wrapper
 * Applies patterns as full-screen backgrounds
 */
export function IslamicBackground({ pattern = 'star', className = '', opacity = 0.04 }) {
  const patterns = {
    star: <StarPattern opacity={opacity} />,
    tile: <TilePattern opacity={opacity} />,
  };

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      {patterns[pattern]}
    </div>
  );
}
