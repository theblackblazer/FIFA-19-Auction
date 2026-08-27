/**
 * FIFA 19 Live Auction - Client Vector Club Crest Generator
 * Real-time dynamic SVG generator for manager team crests.
 */

const CREST_COLOR_PALETTES = {
    gold: {
        name: 'Royal Gold',
        primary: '#d97706',
        secondary: '#f59e0b',
        accent: '#fbbf24',
        dark: '#0f172a',
        glow: 'rgba(245, 158, 11, 0.4)',
        gradient: ['#b45309', '#f59e0b', '#fef08a']
    },
    red: {
        name: 'Crimson Red',
        primary: '#b91c1c',
        secondary: '#ef4444',
        accent: '#fca5a5',
        dark: '#18181b',
        glow: 'rgba(239, 68, 68, 0.4)',
        gradient: ['#7f1d1d', '#dc2626', '#f87171']
    },
    blue: {
        name: 'Azure Blue',
        primary: '#1d4ed8',
        secondary: '#3b82f6',
        accent: '#93c5fd',
        dark: '#0f172a',
        glow: 'rgba(59, 130, 246, 0.4)',
        gradient: ['#1e3a8a', '#2563eb', '#60a5fa']
    },
    emerald: {
        name: 'Emerald Green',
        primary: '#047857',
        secondary: '#10b981',
        accent: '#6ee7b7',
        dark: '#022c22',
        glow: 'rgba(16, 185, 129, 0.4)',
        gradient: ['#064e3b', '#059669', '#34d399']
    },
    purple: {
        name: 'Imperial Purple',
        primary: '#6d28d9',
        secondary: '#8b5cf6',
        accent: '#c4b5fd',
        dark: '#1e1b4b',
        glow: 'rgba(139, 92, 246, 0.4)',
        gradient: ['#4c1d95', '#7c3aed', '#a78bfa']
    },
    orange: {
        name: 'Sunset Orange',
        primary: '#c2410c',
        secondary: '#f97316',
        accent: '#fdba74',
        dark: '#1c1917',
        glow: 'rgba(249, 115, 22, 0.4)',
        gradient: ['#7c2d12', '#ea580c', '#fb923c']
    },
    cyan: {
        name: 'Titanium Cyan',
        primary: '#0e7490',
        secondary: '#06b6d4',
        accent: '#67e8f9',
        dark: '#082f49',
        glow: 'rgba(6, 182, 212, 0.4)',
        gradient: ['#164e63', '#0891b2', '#22d3ee']
    },
    obsidian: {
        name: 'Obsidian Slate',
        primary: '#334155',
        secondary: '#64748b',
        accent: '#e2e8f0',
        dark: '#020617',
        glow: 'rgba(226, 232, 240, 0.3)',
        gradient: ['#0f172a', '#1e293b', '#475569']
    }
};

const CREST_EMBLEM_ICONS = {
    crown: '👑',
    lion: '🦁',
    eagle: '🦅',
    lightning: '⚡',
    ball: '⚽',
    star: '⭐',
    dragon: '🐉',
    flame: '🔥',
    shield: '🛡️',
    trophy: '🏆'
};

function getClientClubInitials(name) {
    if (!name) return 'FC';
    const words = name.trim().match(/[A-Za-z0-9]+/g);
    if (!words || words.length === 0) return 'FC';
    if (words.length === 1) {
        const w = words[0].toUpperCase();
        return w.length >= 2 ? w.substring(0, 2) : w;
    } else if (words.length === 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    } else {
        return (words[0][0] + words[1][0] + (words[2] ? words[2][0] : '')).toUpperCase().substring(0, 3);
    }
}

function generateClubCrestSVG(clubName = 'Royal Strikers FC', colorKey = 'gold', emblemKey = 'crown', width = 120, height = 140) {
    const rawName = (clubName || 'Club FC').trim();
    const initials = getClientClubInitials(rawName);
    const color = (colorKey || 'gold').toLowerCase();
    const palette = CREST_COLOR_PALETTES[color] || CREST_COLOR_PALETTES.gold;
    const emblem = CREST_EMBLEM_ICONS[(emblemKey || 'crown').toLowerCase()] || '👑';

    const [g1, g2, g3] = palette.gradient;
    const darkC = palette.dark;
    const accentC = palette.accent;
    const glowC = palette.glow;

    const shieldOuter = 'M 100 10 L 175 35 Q 185 120 100 225 Q 15 120 25 35 Z';
    const shieldInner = 'M 100 18 L 167 40 Q 175 116 100 214 Q 25 116 33 40 Z';

    let displayBannerText = rawName.toUpperCase();
    if (displayBannerText.length > 18) {
        displayBannerText = displayBannerText.substring(0, 16) + '..';
    }

    const uniqueId = Math.random().toString(36).substring(2, 7);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="${width}" height="${height}" class="club-vector-crest">
  <defs>
    <linearGradient id="crestGrad_${uniqueId}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${g1}" />
      <stop offset="50%" stop-color="${g2}" />
      <stop offset="100%" stop-color="${g3}" />
    </linearGradient>

    <linearGradient id="borderGrad_${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="30%" stop-color="#f59e0b" />
      <stop offset="70%" stop-color="#b45309" />
      <stop offset="100%" stop-color="#fef08a" />
    </linearGradient>

    <radialGradient id="coreGlow_${uniqueId}" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="${glowC}" />
      <stop offset="100%" stop-color="rgba(0,0,0,0.65)" />
    </radialGradient>

    <filter id="crestShadow_${uniqueId}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="rgba(0,0,0,0.45)" />
    </filter>
  </defs>

  <g filter="url(#crestShadow_${uniqueId})">
    <path d="${shieldOuter}" fill="url(#crestGrad_${uniqueId})" stroke="url(#borderGrad_${uniqueId})" stroke-width="4.5" stroke-linejoin="round" />
    <path d="${shieldInner}" fill="${darkC}" fill-opacity="0.9" stroke="${accentC}" stroke-width="1.8" stroke-dasharray="6,3" />
    <path d="${shieldInner}" fill="url(#coreGlow_${uniqueId})" />
  </g>

  <!-- Stars -->
  <g fill="#fbbf24" stroke="#78350f" stroke-width="0.5">
    <polygon points="100,28 103,36 112,36 105,42 107,50 100,45 93,50 95,42 88,36 97,36" />
    <polygon points="76,34 78,40 85,40 80,44 82,51 76,47 70,51 72,44 67,40 74,40" transform="scale(0.85) translate(18, 5)" />
    <polygon points="124,34 126,40 133,40 128,44 130,51 124,47 118,51 120,44 115,40 122,40" transform="scale(0.85) translate(18, 5)" />
  </g>

  <!-- Central Emblem / Icon -->
  <g transform="translate(100, 96)">
    <circle cx="0" cy="0" r="32" fill="${darkC}" stroke="url(#borderGrad_${uniqueId})" stroke-width="2.5" />
    <circle cx="0" cy="0" r="28" fill="${g1}" fill-opacity="0.55" />
    <text x="0" y="10" text-anchor="middle" font-size="28" font-family="'Apple Color Emoji', 'Segoe UI Emoji', sans-serif">${emblem}</text>
  </g>

  <!-- Monogram Initials -->
  <text x="100" y="156" text-anchor="middle" font-family="'Oswald', 'Montserrat', 'Impact', sans-serif" font-size="26" font-weight="900" letter-spacing="2" fill="#ffffff" stroke="${darkC}" stroke-width="1.5">
    ${initials}
  </text>

  <!-- Lower Banner Ribbon -->
  <g transform="translate(100, 186)">
    <rect x="-70" y="-12" width="140" height="22" rx="6" fill="${g1}" stroke="url(#borderGrad_${uniqueId})" stroke-width="1.8" />
    <text x="0" y="3" text-anchor="middle" font-family="'Outfit', 'Inter', sans-serif" font-size="9.5" font-weight="900" letter-spacing="1" fill="#ffffff">
      ${displayBannerText}
    </text>
  </g>
</svg>`;
}
