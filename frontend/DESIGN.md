# Super Apps MATSANDATAMA - Design System

## Design Language

### Visual Identity - MTsN 2 Kota Malang

**Philosophy**: Modern Islamic Education meets Digital Excellence
- **Traditional**: Islamic geometric patterns, warm earth tones, calming green
- **Modern**: Clean layouts, crisp typography, smooth animations
- **Accessible**: WCAG AA compliant, inclusive design for all users
- **Localized**: Bahasa Indonesia, Indonesian education context

### Color System

#### Brand Colors (Primary Palette)
```css
--brand: #006837        /* Islamic Green - Primary brand color */
--brand-2: #0B7A3B      /* Darker green - Hover states, emphasis */
--cream: #FBF7EE        /* Warm background - Main surface */
--ivory: #FFFDF7        /* Reading surface - Cards, content areas */
--gold: #C8A24A         /* Excellence accent - Achievements, highlights */
--ink: #0E1A14          /* Primary text - High contrast */
```

#### Semantic Colors (Functional)
```css
--success: #0E8A4B      /* Success states, positive feedback */
--warning: #B7791F      /* Warnings, caution */
--danger: #C2410C       /* Errors, destructive actions */
--info: #0F766E         /* Informational messages */
--live: #16A34A         /* Live indicators, real-time status */
--offline: #9CA3AF      /* Offline state, disabled elements */
--pending: #D97706      /* Pending actions, in-progress states */
```

#### Accessibility-First Badge Colors (WCAG AA Compliant)
All badge variants maintain minimum 4.5:1 contrast ratio:
- `.badge-brand`: Background #006837/15%, Text #0B7A3B
- `.badge-success`: Background #0E8A4B/15%, Text #0E8A4B
- `.badge-warning`: Background #B7791F/15%, Text #B7791F
- `.badge-danger`: Background #C2410C/15%, Text #C2410C
- `.badge-info`: Background #0F766E/15%, Text #0F766E

### Typography

#### Font Families
```css
font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
font-mono: "IBM Plex Mono", Menlo, Monaco, Consolas, monospace;
```

**Plus Jakarta Sans**: Modern, friendly, Indonesian-designed typeface
- Regular reading: 400 weight
- Emphasis: 500-600 weight
- Headings: 700-800 weight

**IBM Plex Mono**: Technical precision for data
- Tabular numbers: Student IDs, scores, dates
- Code snippets: API responses, technical info

#### Type Scale
```css
/* Headings */
h1: 2.25rem (36px) - Page titles
h2: 1.875rem (30px) - Section headings
h3: 1.5rem (24px) - Card titles
h4: 1.25rem (20px) - Sub-sections
h5: 1rem (16px) - Labels

/* Body */
base: 0.875rem (14px) - Primary body text
sm: 0.75rem (12px) - Secondary text, captions
xs: 0.625rem (10px) - Labels, metadata
```

#### Font Smoothing
```css
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

### Spacing System

**8px Grid System** - All spacing follows 8px increments

#### Spacing Scale
```css
gap-1: 4px   - Inline elements (icon + text)
gap-2: 8px   - Tight grouping (form fields)
gap-3: 12px  - Default component spacing
gap-4: 16px  - Card internal padding
gap-6: 24px  - Section spacing
gap-8: 32px  - Page-level spacing
gap-12: 48px - Major section breaks
```

#### Layout Spacing Standards
- **Card padding**: `p-4` (16px) or `p-5` (20px)
- **Section gaps**: `space-y-6` (24px)
- **Page container**: `px-4 sm:px-6 lg:px-8` `py-6`
- **Grid gaps**: `gap-3` (12px) for dense grids, `gap-4` (16px) for cards

### Border Radius

```css
--radius: 0.75rem (12px)  /* Base radius */
rounded-lg: 12px          /* Cards, buttons */
rounded-xl: 16px          /* Larger cards, modals */
rounded-2xl: 20px         /* Feature sections */
rounded-full: 9999px      /* Icon buttons, avatars */
```

### Shadows

```css
/* Subtle elevation */
shadow-sm: 0 1px 2px rgba(0,0,0,0.05)

/* Card elevation */
shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)

/* Prominent elements */
shadow-md: 0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)

/* Modals, overlays */
shadow-lg: 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)

/* Popovers */
shadow-xl: 0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04)
```

### Islamic Design Patterns

#### Geometric Patterns (Subtle, Non-Intrusive)
```css
/* Subtle background pattern */
.bg-pattern-geometric {
    background-color: var(--cream);
    background-image:
        radial-gradient(circle at 25% 25%, rgba(0, 104, 55, 0.04) 1px, transparent 1px),
        radial-gradient(circle at 75% 75%, rgba(200, 162, 74, 0.04) 1px, transparent 1px);
    background-size: 32px 32px;
}

/* Hero section wash */
.bg-hero-wash {
    background-color: var(--cream);
    background-image:
        radial-gradient(1200px 600px at 20% 0%, rgba(0, 104, 55, 0.14), transparent 60%),
        radial-gradient(900px 500px at 90% 10%, rgba(200, 162, 74, 0.12), transparent 55%);
}

/* Brand gradient */
.bg-brand-gradient {
    background: linear-gradient(135deg, #006837 0%, #0B7A3B 60%, #138248 100%);
}
```

#### Islamic Motifs - Usage Guidelines
- **Geometric patterns**: Background accents only, never compete with content
- **Mosque silhouettes**: Empty states, loading screens (coming soon)
- **Arabesque borders**: Optional emphasis on achievement cards
- **Prayer time integration**: Dashboard widget showing daily prayer schedule

### Motion & Animation

#### Animation Principles
1. **Purposeful**: Every animation has a functional reason
2. **Subtle**: Never flashy or distracting from content
3. **Fast**: 200-300ms for micro-interactions, 400-500ms for page transitions
4. **Respectful**: Honor `prefers-reduced-motion` accessibility setting

#### Timing Functions
```css
ease-out: Entering elements (fade in, slide in)
ease-in: Exiting elements (fade out, slide out)
ease-in-out: State changes (expand/collapse)
```

#### Standard Animations
```css
/* Fade up entrance */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.fade-up { animation: fadeUp 0.3s ease-out; }

/* Live indicator pulse */
@keyframes live-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.15); }
}
.live-dot { animation: live-pulse 1.6s ease-in-out infinite; }
```

#### Page Transitions (Framer Motion)
```jsx
<motion.div
  key={location.pathname}
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.25 }}
>
```

#### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
    .live-dot { animation: none; }
    * { animation-duration: 0.01ms !important; }
}
```

### Touch Targets (Mobile-First)

**Minimum Touch Target**: 44x44px (WCAG 2.1 Level AAA)

#### Responsive Touch Sizes
```jsx
/* Icon buttons: Larger on mobile */
<Button className="h-11 w-11 sm:h-10 sm:w-10">

/* Regular buttons: Consistent height */
<Button className="h-11">

/* Input fields: Comfortable tap area */
<Input className="h-11">
```

### Accessibility Standards

#### WCAG 2.1 Level AA Compliance
✅ **1.4.3 Contrast (Minimum)**: 4.5:1 for normal text, 3:1 for large text
✅ **2.4.7 Focus Visible**: All interactive elements have visible focus indicators
✅ **4.1.2 Name, Role, Value**: All components have proper ARIA labels
✅ **2.5.5 Target Size**: Minimum 44x44px touch targets on mobile

#### Focus Indicators
```css
focus-visible:ring-2
focus-visible:ring-[#006837]
focus-visible:ring-offset-2
```

#### ARIA Patterns
- Navigation: `<nav aria-label="Menu navigasi utama">`
- Buttons: `<button aria-label="Panduan Pengguna">`
- Icons: `<Icon aria-hidden="true" />`
- Current page: `<Link aria-current="page">`
- Expandable: `<button aria-expanded={isOpen}>`

### Component Patterns

#### Cards
```jsx
<Card className="shadow-sm hover:shadow-md transition-shadow">
  <CardHeader className="pb-3">
    <CardTitle className="text-lg">Title</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Content */}
  </CardContent>
</Card>
```

#### Badges
```jsx
/* Brand badge (accessible) */
<Badge className="badge-brand">Label</Badge>

/* Status badges */
<Badge className="badge-success">Aktif</Badge>
<Badge className="badge-warning">Pending</Badge>
<Badge className="badge-danger">Error</Badge>
```

#### Buttons
```jsx
/* Primary CTA */
<Button className="bg-[#006837] hover:bg-[#0B7A3B]">
  Submit
</Button>

/* Secondary */
<Button variant="outline">
  Cancel
</Button>

/* Ghost (icon only) */
<Button
  variant="ghost"
  className="h-11 w-11 rounded-full"
  aria-label="Close"
>
  <X className="h-5 w-5" aria-hidden="true" />
</Button>
```

#### Loading States
```jsx
/* Skeleton loader (to be implemented) */
<Skeleton className="h-20 w-full rounded-lg" />

/* Loading spinner */
<Loader2 className="h-4 w-4 animate-spin" />
```

#### Empty States (To Be Implemented)
```jsx
<EmptyState
  illustration={<MosqueIllustration />}
  title="Belum ada data"
  description="Mulai dengan menambahkan data pertama"
  action={<Button>Tambah Data</Button>}
/>
```

### Responsive Breakpoints

```css
sm: 640px   - Small tablets
md: 768px   - Tablets
lg: 1024px  - Laptops
xl: 1280px  - Desktops
2xl: 1536px - Large screens
```

#### Layout Patterns
- **Mobile-first**: Design for mobile, enhance for desktop
- **Sidebar**: Hidden on mobile (Sheet drawer), visible on desktop
- **Grid columns**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- **Text truncation**: `truncate` on mobile, full text on desktop

### Dark Mode Support

#### Theme Switching
```jsx
/* Automatic theme variables */
.dark {
  --background: 160 18% 6%;
  --foreground: 44 33% 96%;
  --primary: 151 80% 35%;
  /* ... */
}
```

Currently: Full token support, manual toggle (coming soon)

---

## Upcoming Enhancements (MTsN 2 Kota Malang Distinctive Elements)

### Phase 1: Foundation Polish (Current Sprint)
- ✅ ARIA labels and keyboard navigation
- ✅ Color contrast fixes (WCAG AA compliance)
- ✅ Touch target sizes (44x44px minimum)
- 🚧 Consistent spacing rhythm
- 🚧 Loading states & skeleton screens

### Phase 2: Distinctive Brand Elements
- 🎯 Custom Islamic geometric SVG patterns
- 🎯 MTsN 2 Kota Malang custom illustrations
- 🎯 Mosque dome empty state illustrations
- 🎯 Prayer time widget integration
- 🎯 Hijriyah calendar support

### Phase 3: Micro-Interactions & Delight
- 🎯 Success celebration animations (confetti on journal submit)
- 🎯 Achievement badge unlock animations
- 🎯 Smooth card hover effects with subtle lifts
- 🎯 Progress indicators with Islamic patterns
- 🎯 Custom loading animations (rotating geometric pattern)

### Phase 4: Power User Features
- 🎯 Command Palette (Cmd+K) for quick navigation
- 🎯 Keyboard shortcuts documentation
- 🎯 Bulk operations UI patterns
- 🎯 Customizable dashboard widgets

---

**Last Updated**: 2026-09-14
**Version**: 1.2.1
**Maintained By**: Development Team
**Design Review**: Monthly
