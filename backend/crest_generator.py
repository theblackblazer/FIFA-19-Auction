"""
FIFA 19 Auction - Dynamic Vector Club Crest Generator
Generates high-resolution, professional football club crests in SVG format.
"""

import re
import html

# 8 Vibrant Heraldic & Modern Football Club Color Palettes
COLOR_PALETTES = {
    "gold": {
        "primary": "#d97706",
        "secondary": "#f59e0b",
        "accent": "#fbbf24",
        "dark": "#0f172a",
        "glow": "rgba(245, 158, 11, 0.4)",
        "gradient": ("#b45309", "#f59e0b", "#fef08a")
    },
    "red": {
        "primary": "#b91c1c",
        "secondary": "#ef4444",
        "accent": "#fca5a5",
        "dark": "#18181b",
        "glow": "rgba(239, 68, 68, 0.4)",
        "gradient": ("#7f1d1d", "#dc2626", "#f87171")
    },
    "blue": {
        "primary": "#1d4ed8",
        "secondary": "#3b82f6",
        "accent": "#93c5fd",
        "dark": "#0f172a",
        "glow": "rgba(59, 130, 246, 0.4)",
        "gradient": ("#1e3a8a", "#2563eb", "#60a5fa")
    },
    "emerald": {
        "primary": "#047857",
        "secondary": "#10b981",
        "accent": "#6ee7b7",
        "dark": "#022c22",
        "glow": "rgba(16, 185, 129, 0.4)",
        "gradient": ("#064e3b", "#059669", "#34d399")
    },
    "purple": {
        "primary": "#6d28d9",
        "secondary": "#8b5cf6",
        "accent": "#c4b5fd",
        "dark": "#1e1b4b",
        "glow": "rgba(139, 92, 246, 0.4)",
        "gradient": ("#4c1d95", "#7c3aed", "#a78bfa")
    },
    "orange": {
        "primary": "#c2410c",
        "secondary": "#f97316",
        "accent": "#fdba74",
        "dark": "#1c1917",
        "glow": "rgba(249, 115, 22, 0.4)",
        "gradient": ("#7c2d12", "#ea580c", "#fb923c")
    },
    "cyan": {
        "primary": "#0e7490",
        "secondary": "#06b6d4",
        "accent": "#67e8f9",
        "dark": "#082f49",
        "glow": "rgba(6, 182, 212, 0.4)",
        "gradient": ("#164e63", "#0891b2", "#22d3ee")
    },
    "obsidian": {
        "primary": "#334155",
        "secondary": "#64748b",
        "accent": "#e2e8f0",
        "dark": "#020617",
        "glow": "rgba(226, 232, 240, 0.3)",
        "gradient": ("#0f172a", "#1e293b", "#475569")
    }
}

EMBLEM_ICONS = {
    "crown": "👑",
    "lion": "🦁",
    "eagle": "🦅",
    "lightning": "⚡",
    "ball": "⚽",
    "star": "⭐",
    "dragon": "🐉",
    "flame": "🔥",
    "shield": "🛡️",
    "trophy": "🏆"
}

def get_club_initials(name):
    """Extract 1 to 3 uppercase initials from club name."""
    if not name:
        return "FC"
    words = re.findall(r'[A-Za-z0-9]+', name)
    if not words:
        return "FC"
    if len(words) == 1:
        w = words[0].upper()
        return w[:2] if len(w) >= 2 else w
    elif len(words) == 2:
        return (words[0][0] + words[1][0]).upper()
    else:
        return "".join(w[0] for w in words[:3]).upper()

def generate_crest_svg(club_name="Royal Strikers FC", color_key="gold", emblem_key="crown", width=120, height=140):
    """
    Generates a high-quality, crisp vector SVG club crest.
    """
    safe_name = html.escape((club_name or "Club FC").strip())
    initials = get_club_initials(safe_name)
    
    palette = COLOR_PALETTES.get((color_key or "gold").lower(), COLOR_PALETTES["gold"])
    emblem_symbol = EMBLEM_ICONS.get((emblem_key or "crown").lower(), "👑")
    
    g1, g2, g3 = palette["gradient"]
    dark_c = palette["dark"]
    accent_c = palette["accent"]
    glow_c = palette["glow"]
    
    shield_outer = "M 100 10 L 175 35 Q 185 120 100 225 Q 15 120 25 35 Z"
    shield_inner = "M 100 18 L 167 40 Q 175 116 100 214 Q 25 116 33 40 Z"
    
    display_banner_text = safe_name.upper()
    if len(display_banner_text) > 18:
        display_banner_text = display_banner_text[:16] + ".."
        
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="{width}" height="{height}">
  <defs>
    <linearGradient id="crestGrad_{color_key}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="{g1}" />
      <stop offset="50%" stop-color="{g2}" />
      <stop offset="100%" stop-color="{g3}" />
    </linearGradient>

    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="30%" stop-color="#f59e0b" />
      <stop offset="70%" stop-color="#b45309" />
      <stop offset="100%" stop-color="#fef08a" />
    </linearGradient>

    <radialGradient id="coreGlow" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="{glow_c}" />
      <stop offset="100%" stop-color="rgba(0,0,0,0.6)" />
    </radialGradient>

    <filter id="crestShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="rgba(0,0,0,0.5)" />
    </filter>
  </defs>

  <g filter="url(#crestShadow)">
    <path d="{shield_outer}" fill="url(#crestGrad_{color_key})" stroke="url(#borderGrad)" stroke-width="4.5" stroke-linejoin="round" />
    <path d="{shield_inner}" fill="{dark_c}" fill-opacity="0.88" stroke="{accent_c}" stroke-width="1.8" stroke-dasharray="6,3" />
    <path d="{shield_inner}" fill="url(#coreGlow)" />
  </g>

  <g fill="#fbbf24" stroke="#78350f" stroke-width="0.5">
    <polygon points="100,28 103,36 112,36 105,42 107,50 100,45 93,50 95,42 88,36 97,36" />
    <polygon points="76,34 78,40 85,40 80,44 82,51 76,47 70,51 72,44 67,40 74,40" transform="scale(0.85) translate(18, 5)" />
    <polygon points="124,34 126,40 133,40 128,44 130,51 124,47 118,51 120,44 115,40 122,40" transform="scale(0.85) translate(18, 5)" />
  </g>

  <g transform="translate(100, 96)">
    <circle cx="0" cy="0" r="32" fill="{dark_c}" stroke="url(#borderGrad)" stroke-width="2.5" />
    <circle cx="0" cy="0" r="28" fill="{g1}" fill-opacity="0.5" />
    <text x="0" y="10" text-anchor="middle" font-size="28" font-family="'Apple Color Emoji', 'Segoe UI Emoji', sans-serif">{emblem_symbol}</text>
  </g>

  <text x="100" y="156" text-anchor="middle" font-family="'Oswald', 'Montserrat', 'Impact', sans-serif" font-size="26" font-weight="900" letter-spacing="2" fill="#ffffff" stroke="{dark_c}" stroke-width="1.5">
    {initials}
  </text>

  <g transform="translate(100, 186)">
    <rect x="-70" y="-12" width="140" height="22" rx="6" fill="{g1}" stroke="url(#borderGrad)" stroke-width="1.8" />
    <text x="0" y="3" text-anchor="middle" font-family="'Outfit', 'Inter', sans-serif" font-size="9.5" font-weight="900" letter-spacing="1" fill="#ffffff">
      {display_banner_text}
    </text>
  </g>
</svg>"""
    return svg
