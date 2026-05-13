{
  "app": {
    "name": "Super Apps MATSANDATAMA",
    "brand_attributes": [
      "institusional & berwibawa (government-grade)",
      "aman/anti-manipulasi (security-first)",
      "ramah untuk guru (besar, jelas, tidak rumit)",
      "modern-profesional dengan sentuhan motif Islami yang sangat halus"
    ],
    "language": "id-ID",
    "platform": "mobile-first responsive web app"
  },
  "design_personality": {
    "style_fusion": {
      "layout_principle": "Swiss / International Typographic Style (grid ketat, hierarchy jelas)",
      "surface_style": "Soft-elevated cards (enterprise SaaS) + subtle Islamic geometric micro-pattern (opacity rendah)",
      "public_monitoring_vibe": "Scoreboard / status-page (live, high-contrast, data-dense, mudah dipindai)"
    },
    "do_not": [
      "Jangan gunakan ornamen Islami yang ramai/berat (cukup pattern halus sebagai watermark/border)",
      "Jangan gunakan layout center-aligned untuk seluruh halaman",
      "Jangan gunakan gradient gelap/saturated (lihat aturan gradient di bawah)",
      "Jangan gunakan purple untuk AI/scan flow; tetap di hijau-krem-emas"
    ]
  },
  "typography": {
    "font_loading": {
      "google_fonts": [
        {
          "family": "Plus Jakarta Sans",
          "weights": ["400", "500", "600", "700", "800"],
          "usage": "UI utama (body, label, navigasi, tabel)"
        },
        {
          "family": "IBM Plex Mono",
          "weights": ["400", "500", "600"],
          "usage": "kode QR token, ID jurnal, timestamp, audit log (membuat terasa 'secure/system')"
        }
      ],
      "implementation_note_js": "Tambahkan <link> Google Fonts di public/index.html atau import di index.css. Pastikan fallback system-ui."
    },
    "font_pairing": {
      "heading": "Plus Jakarta Sans 700/800",
      "body": "Plus Jakarta Sans 400/500",
      "mono": "IBM Plex Mono 500"
    },
    "type_scale_tailwind": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight",
      "h2": "text-base md:text-lg font-semibold",
      "section_title": "text-sm font-semibold tracking-wide uppercase",
      "body": "text-sm md:text-base",
      "small": "text-xs text-muted-foreground",
      "mono": "font-mono text-xs md:text-sm"
    },
    "numerals": {
      "dashboard_metrics": "tabular-nums (gunakan class tailwind: tabular-nums)"
    }
  },
  "color_system": {
    "notes": [
      "Primary wajib: Hijau Kemenag (#006837).",
      "Gunakan krem/ivory untuk area baca agar terasa resmi & hangat.",
      "Aksen emas dipakai hemat untuk status/CTA penting (bukan background besar)."
    ],
    "tokens_hsl_for_shadcn": {
      "root": {
        "--background": "44 33% 98%",
        "--foreground": "160 18% 10%",
        "--card": "0 0% 100%",
        "--card-foreground": "160 18% 10%",
        "--popover": "0 0% 100%",
        "--popover-foreground": "160 18% 10%",
        "--primary": "151 100% 21%",
        "--primary-foreground": "0 0% 98%",
        "--secondary": "44 28% 94%",
        "--secondary-foreground": "160 18% 12%",
        "--muted": "44 18% 92%",
        "--muted-foreground": "160 8% 38%",
        "--accent": "43 55% 88%",
        "--accent-foreground": "160 18% 12%",
        "--destructive": "0 72% 52%",
        "--destructive-foreground": "0 0% 98%",
        "--border": "44 14% 86%",
        "--input": "44 14% 86%",
        "--ring": "151 100% 21%",
        "--radius": "0.75rem"
      },
      "semantic_extras_css_vars": {
        "--brand": "#006837",
        "--brand-2": "#0B7A3B",
        "--cream": "#FBF7EE",
        "--ivory": "#FFFDF7",
        "--gold": "#C8A24A",
        "--ink": "#0E1A14",
        "--success": "#0E8A4B",
        "--warning": "#B7791F",
        "--danger": "#C2410C",
        "--info": "#0F766E",
        "--live": "#16A34A",
        "--offline": "#9CA3AF",
        "--pending": "#D97706"
      }
    },
    "allowed_gradients_restricted": {
      "rule": "Gradients hanya untuk background section dekoratif (maks 20% viewport) dan tidak untuk area baca/tabel.",
      "safe_gradients": [
        {
          "name": "hero-wash",
          "css": "radial-gradient(1200px 600px at 20% 0%, rgba(0,104,55,0.14), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(200,162,74,0.12), transparent 55%)",
          "usage": "Login hero / dashboard header strip"
        }
      ]
    }
  },
  "layout_and_grid": {
    "breakpoints": {
      "mobile": "<640px (default)",
      "tablet": "sm/md",
      "desktop": "lg+"
    },
    "page_container": {
      "max_width": "max-w-6xl",
      "padding": "px-4 sm:px-6 lg:px-8",
      "vertical_rhythm": "py-6 sm:py-8"
    },
    "dashboard_grid": {
      "pattern": "Bento grid",
      "classes": "grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12",
      "cards": {
        "default": "lg:col-span-4",
        "wide": "lg:col-span-8",
        "full": "lg:col-span-12"
      }
    },
    "navigation": {
      "mobile": "Bottom action bar hanya untuk 2-3 aksi utama (Scan Jurnal, Jadwal, Dashboard). Sisanya via Sheet.",
      "desktop": "Sidebar collapsible (Sheet/Resizable) + topbar role switcher"
    }
  },
  "components": {
    "component_path": {
      "shadcn_primary": "/app/frontend/src/components/ui",
      "use_components": [
        {"name": "button", "path": "src/components/ui/button.jsx"},
        {"name": "input", "path": "src/components/ui/input.jsx"},
        {"name": "label", "path": "src/components/ui/label.jsx"},
        {"name": "card", "path": "src/components/ui/card.jsx"},
        {"name": "tabs", "path": "src/components/ui/tabs.jsx"},
        {"name": "table", "path": "src/components/ui/table.jsx"},
        {"name": "badge", "path": "src/components/ui/badge.jsx"},
        {"name": "dropdown-menu", "path": "src/components/ui/dropdown-menu.jsx"},
        {"name": "select", "path": "src/components/ui/select.jsx"},
        {"name": "dialog", "path": "src/components/ui/dialog.jsx"},
        {"name": "sheet", "path": "src/components/ui/sheet.jsx"},
        {"name": "drawer", "path": "src/components/ui/drawer.jsx"},
        {"name": "calendar", "path": "src/components/ui/calendar.jsx"},
        {"name": "sonner", "path": "src/components/ui/sonner.jsx"},
        {"name": "progress", "path": "src/components/ui/progress.jsx"},
        {"name": "skeleton", "path": "src/components/ui/skeleton.jsx"},
        {"name": "tooltip", "path": "src/components/ui/tooltip.jsx"},
        {"name": "breadcrumb", "path": "src/components/ui/breadcrumb.jsx"},
        {"name": "pagination", "path": "src/components/ui/pagination.jsx"},
        {"name": "scroll-area", "path": "src/components/ui/scroll-area.jsx"},
        {"name": "separator", "path": "src/components/ui/separator.jsx"}
      ]
    },
    "button_system": {
      "brand": "Professional / Corporate",
      "tokens": {
        "--btn-radius": "12px",
        "--btn-shadow": "0 1px 0 rgba(14,26,20,0.06), 0 10px 24px rgba(14,26,20,0.08)",
        "--btn-press-scale": "0.98"
      },
      "variants": {
        "primary": {
          "look": "solid brand green",
          "tailwind": "bg-[var(--brand)] text-white hover:bg-[#0B7A3B] focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
          "data_testid_examples": ["login-submit-button", "jurnal-scan-start-button"]
        },
        "secondary": {
          "look": "cream surface + green border",
          "tailwind": "bg-[var(--ivory)] text-[var(--ink)] border border-[#0B7A3B]/25 hover:border-[#0B7A3B]/45",
          "data_testid_examples": ["dashboard-secondary-action-button"]
        },
        "ghost": {
          "look": "text button",
          "tailwind": "hover:bg-[#006837]/8 text-[#0B7A3B]",
          "data_testid_examples": ["topbar-role-switcher-trigger"]
        },
        "danger": {
          "look": "solid destructive",
          "tailwind": "bg-destructive text-destructive-foreground hover:bg-destructive/90",
          "data_testid_examples": ["admin-delete-user-button"]
        }
      },
      "micro_interactions": {
        "hover": "transition-colors duration-200",
        "press": "active:scale-[0.98] (jangan pakai transition-all)",
        "loading": "gunakan spinner kecil + disabled opacity-60"
      }
    },
    "forms": {
      "pattern": "Label di atas input, helper text kecil, error state jelas",
      "input_classes": "h-11 rounded-xl bg-white/90",
      "validation": {
        "error": "border-destructive focus-visible:ring-destructive",
        "success": "border-[#0E8A4B]/40 focus-visible:ring-[#0E8A4B]"
      },
      "math_captcha": {
        "ui": "Captcha sebagai Input terpisah dengan badge 'Verifikasi' + hint",
        "testids": ["login-math-captcha-input", "login-username-input", "login-password-input"]
      }
    },
    "data_display": {
      "tables": {
        "use": "shadcn table + sticky header untuk admin master data",
        "density": "mobile: card-list fallback; desktop: table",
        "testids": ["admin-users-table", "admin-audit-logs-table"]
      },
      "badges": {
        "status": {
          "valid": "bg-[#0E8A4B]/12 text-[#0E8A4B] border border-[#0E8A4B]/25",
          "invalid": "bg-destructive/10 text-destructive border border-destructive/25",
          "pending": "bg-[#D97706]/12 text-[#B45309] border border-[#D97706]/25"
        }
      }
    }
  },
  "screen_blueprints": {
    "login": {
      "layout": "Split feel on desktop (left brand panel, right form). Mobile: single column.",
      "visual": [
        "Top: logo Kemenag + nama app",
        "Background: ivory + hero-wash gradient (maks 20% viewport) + noise overlay",
        "Form card: rounded-2xl, shadow lembut"
      ],
      "components": ["card", "input", "button", "label", "sonner"],
      "testids": ["login-form", "login-submit-button"]
    },
    "dashboard_multi_role": {
      "topbar": {
        "left": "Breadcrumb + page title",
        "center": "Search (Command optional untuk admin)",
        "right": "Role switcher (DropdownMenu) + avatar",
        "testids": ["topbar-role-switcher", "topbar-profile-menu"]
      },
      "role_switcher": {
        "pattern": "DropdownMenu dengan grouping per role + icon lucide",
        "copy": "Peran Aktif: Guru / Admin / ...",
        "safety": "Konfirmasi Dialog saat pindah role jika ada draft form"
      },
      "cards": [
        "Quick Actions: Scan Jurnal, Jadwal Hari Ini, Riwayat",
        "KPI: Jurnal terisi hari ini, kelas aktif, keterlambatan"
      ]
    },
    "jurnal_presisi_scan_flow": {
      "goal": "Membuat user merasa proses validasi aman dan tidak bisa dimanipulasi.",
      "steps": [
        {
          "step": "1. Kamera/Scanner",
          "ui": "Full-width camera card + overlay frame (rounded rectangle) + hint 'Arahkan QR ke dalam bingkai'",
          "components": ["card", "button", "tooltip"],
          "states": ["camera-permission", "scanning", "paused"],
          "testids": ["jurnal-scan-camera", "jurnal-scan-toggle-flash-button", "jurnal-scan-switch-camera-button"]
        },
        {
          "step": "2. Validasi",
          "ui": "Result panel besar: icon + status badge + alasan (schedule mismatch, GPS out-of-zone, QR invalid/expired)",
          "pattern": "Gunakan Alert component untuk status + Badge untuk ringkas",
          "components": ["alert", "badge", "progress"],
          "testids": ["jurnal-validation-result", "jurnal-validation-reason"]
        },
        {
          "step": "3. Form Jurnal",
          "ui": "Form bertahap (Tabs atau Collapsible): Materi, Kehadiran, Catatan, Bukti",
          "components": ["tabs", "textarea", "select", "checkbox", "button"],
          "testids": ["jurnal-form", "jurnal-submit-button"]
        }
      ],
      "security_cues": [
        "Tampilkan 'Token Validasi' (mono) + timestamp + lokasi ringkas (tanpa menampilkan koordinat detail ke publik)",
        "Gunakan wording: 'Terverifikasi oleh Jadwal & Lokasi'"
      ]
    },
    "admin_qr_generator_b5": {
      "layout": "2 kolom desktop: kiri form, kanan preview. Mobile: preview di bawah.",
      "preview": {
        "look": "Seperti artefak cetak: kertas krem, border tipis emas, watermark motif geometris",
        "paper": "B5 portrait (176mm x 250mm) preview ratio",
        "components": ["card", "aspect-ratio", "tabs", "button"],
        "testids": ["qr-generator-template-upload", "qr-generator-preview", "qr-generator-download-button"]
      },
      "print_notes": [
        "Gunakan background solid (tanpa gradient) untuk area preview",
        "Sediakan toggle 'Tampilkan garis potong'"
      ]
    },
    "public_monitoring": {
      "vibe": "Scoreboard live: data-dense, mudah dipindai, terasa real-time.",
      "layout": {
        "header": "Sticky top bar: logo + judul + jam realtime + indikator 'LIVE'",
        "grid": "Masonry-like grid tapi konsisten: 2 kolom mobile, 4-6 kolom desktop",
        "filters": "Chip filters (Tabs/ToggleGroup): Semua / Terisi / Belum / Bermasalah"
      },
      "status_card": {
        "fields": ["Kelas", "Mapel", "Guru", "Jam", "Status Jurnal"],
        "status_encoding": {
          "filled": "green",
          "missing": "amber",
          "issue": "red",
          "inactive": "gray"
        },
        "micro_motion": "Pulsing dot untuk kelas aktif (gunakan animate-pulse hanya pada dot kecil, bukan seluruh card)",
        "testids": ["public-monitoring-grid", "public-monitoring-filter-tabs"]
      },
      "live_updates": {
        "tech": "SSE/WebSocket",
        "ui": "Toast sonner untuk event penting (mis. 'Kelas 8A baru saja mengisi jurnal')"
      }
    }
  },
  "motion_and_microinteractions": {
    "principles": [
      "Motion harus fungsional: memberi feedback validasi, perubahan status live, dan navigasi.",
      "Hindari animasi besar yang mengganggu guru saat scan."
    ],
    "recommended_library": {
      "name": "framer-motion",
      "install": "npm i framer-motion",
      "usage_js": "Gunakan untuk enter/exit panel validasi dan transisi antar step scan."
    },
    "patterns": {
      "page_enter": "fade-up ringan: opacity 0→1, y 8→0, duration 0.25",
      "status_change": "highlight ring: outline 2px brand/amber/red selama 600ms",
      "button": "active scale 0.98 tanpa transition-all"
    },
    "reduced_motion": "Hormati prefers-reduced-motion: matikan pulse dan transisi besar"
  },
  "data_viz_and_realtime": {
    "charts": {
      "library": "recharts",
      "install": "npm i recharts",
      "usage": "Admin dashboard: tren keterisian jurnal per hari, keterlambatan, heatmap sederhana (opsional).",
      "styling": "Gunakan warna brand green untuk series utama, gold untuk highlight; background chart tetap solid."
    },
    "realtime_transport": {
      "preferred": "Server-Sent Events (SSE) untuk public monitoring (lebih ringan dari WS untuk broadcast)",
      "fallback": "Polling 10-15 detik jika SSE tidak tersedia"
    }
  },
  "accessibility": {
    "targets": [
      "WCAG AA contrast",
      "tap targets min 44px",
      "focus ring terlihat (ring brand)",
      "error messages jelas dan dibacakan screen reader"
    ],
    "aria": {
      "scanner": "Berikan aria-label pada tombol kamera/flash",
      "role_switcher": "aria-expanded + aria-controls"
    }
  },
  "testing_conventions": {
    "data_testid_rule": "Semua elemen interaktif & info penting wajib punya data-testid (kebab-case).",
    "examples": [
      "role-switcher-trigger",
      "jurnal-scan-start-button",
      "jurnal-validation-result",
      "admin-qr-generator-download-button",
      "public-monitoring-live-indicator"
    ]
  },
  "image_urls": {
    "hero_login_optional": [
      {
        "url": "https://images.pexels.com/photos/12719346/pexels-photo-12719346.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "description": "Foto edukasi (guru & siswa) untuk panel kiri login desktop. Gunakan overlay krem agar tidak ramai.",
        "category": "login"
      }
    ],
    "pattern_reference": [
      {
        "url": "https://images.unsplash.com/photo-1572756317709-fe9c15ced298?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
        "description": "Referensi tekstur/pattern geometris. Jangan pakai langsung; buat versi SVG/CSS pattern opacity 4–6%.",
        "category": "background-pattern"
      }
    ]
  },
  "instructions_to_main_agent": {
    "global_css_changes": [
      "Hapus/abaikan styling default CRA di App.css (App-header center). Jangan center align container.",
      "Update index.css :root tokens ke hijau-krem-emas sesuai tokens_hsl_for_shadcn.",
      "Set body font-family ke 'Plus Jakarta Sans', dan mono ke 'IBM Plex Mono'.",
      "Tambahkan utility untuk noise overlay (pseudo-element) dan subtle geometric pattern (SVG background-image) dengan opacity rendah."
    ],
    "component_usage_notes": [
      "Gunakan shadcn DropdownMenu untuk role switcher.",
      "Gunakan shadcn Calendar untuk manajemen tahun ajaran/semester.",
      "Gunakan shadcn Table untuk master data + audit logs; mobile fallback jadi Card list.",
      "Gunakan Sonner untuk toast validasi scan & live updates."
    ],
    "page_specific": [
      "Public monitoring harus terasa seperti scoreboard: grid rapat, status color-coded, jam realtime, indikator LIVE.",
      "QR scan flow: feedback validasi harus besar dan jelas (badge + alert), jangan animasi berlebihan.",
      "B5 preview: tampilkan seperti kertas cetak (solid background), sediakan download PDF/PNG."
    ],
    "data_testid": "Pastikan setiap Button/Input/Select/Tab trigger/Table row action punya data-testid kebab-case."
  },
  "appendix_general_ui_ux_design_guidelines": "<General UI UX Design Guidelines>\n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
