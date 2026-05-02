# Aura — Design System

> *Your system, luminous and clean.*

---

## Concept

**Aura** is a cross-platform system cleaner built with Rust + Tauri. The design language draws from high-end developer tooling and premium macOS apps — dark, precise, confident. No gradients that scream "made with AI." No bloated cards. Just signal.

The aesthetic direction is **refined dark luxury**: obsidian surfaces, restrained accent colors, surgical typography, and micro-animations that feel earned rather than decorative.

---

## Color Palette

```css
/* Base surfaces */
--color-bg-base:        #0A0C10;   /* Deepest background */
--color-bg-surface:     #0F1219;   /* Cards, panels */
--color-bg-elevated:    #161B24;   /* Modals, dropdowns */
--color-bg-overlay:     #1C2333;   /* Hover states, borders */

/* Borders */
--color-border-subtle:  #1F2733;   /* Dividers */
--color-border-default: #2A3444;   /* Card edges */
--color-border-strong:  #3A4A5E;   /* Active/focus rings */

/* Text */
--color-text-primary:   #E8EDF5;   /* Headlines, labels */
--color-text-secondary: #8A97AA;   /* Descriptions, metadata */
--color-text-muted:     #4A5568;   /* Placeholder, disabled */

/* Accent — Electric Teal */
--color-accent:         #00D4AA;   /* Primary CTAs, highlights */
--color-accent-dim:     #00D4AA22; /* Accent backgrounds */
--color-accent-hover:   #00EAC0;   /* Hover state */

/* Semantic */
--color-success:        #22C987;
--color-warning:        #F59E0B;
--color-danger:         #EF4444;
--color-info:           #60A5FA;

/* Category colors (used for feature icons) */
--color-junk:           #F59E0B;   /* System Junk */
--color-trash:          #EF4444;   /* Trash Bins */
--color-files:          #8B5CF6;   /* Large & Old Files */
--color-apps:           #3B82F6;   /* App Uninstaller */
--color-privacy:        #EC4899;   /* Privacy */
--color-startup:        #10B981;   /* Startup Manager */
--color-disk:           #06B6D4;   /* Disk Analyzer */
--color-maintenance:    #F97316;   /* Maintenance */
```

---

## Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| App Logo | **Bricolage Grotesque** | 700 | 20px |
| Page Title | **Bricolage Grotesque** | 600 | 28px |
| Section Heading | **DM Sans** | 600 | 14px |
| Body / Labels | **DM Sans** | 400 | 13px |
| Metadata / Captions | **DM Mono** | 400 | 11px |
| Numeric Stats | **DM Mono** | 500 | varies |

Fonts loaded from Google Fonts CDN in `index.html`:
```
Bricolage+Grotesque:wght@400;600;700
DM+Sans:wght@300;400;500;600
DM+Mono:wght@400;500
```

---

## Spacing System

Uses a `4px` base grid. Spacing tokens:

```
xs:  4px
sm:  8px
md:  12px
lg:  16px
xl:  24px
2xl: 32px
3xl: 48px
4xl: 64px
```

---

## Layout

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar (220px)  │  Main Content Area (flex-1)          │
│  ─────────────── │  ─────────────────────────────────── │
│  [Logo + Version] │  [Top Bar: Title + Actions]          │
│                   │                                       │
│  Smart Scan       │                                       │
│  ─────────────── │  [Page Content]                       │
│  Cleaner          │                                       │
│    System Junk    │                                       │
│    Trash Bins     │                                       │
│    Large Files    │                                       │
│    Duplicates     │                                       │
│  ─────────────── │                                       │
│  Manager          │                                       │
│    App Uninstall  │                                       │
│    Startup Mgr    │                                       │
│  ─────────────── │                                       │
│  Privacy          │                                       │
│  Disk Space       │                                       │
│  Maintenance      │                                       │
│  ─────────────── │                                       │
│  [System Stats]   │                                       │
│  [Settings]       │                                       │
└─────────────────────────────────────────────────────────┘
```

**Sidebar**: Fixed 220px, no collapse on desktop. Slightly lighter than base (`#0F1219`). No icons-only mode.

**Content area**: White-labeled scroll area. Max-width: `none` — fills available space. Internal containers capped at `800px` centered for single-column flows; full-width for disk visualizer.

---

## Component Patterns

### Scan Cards
Rectangular cards with a faint left-border accent in the feature's category color. Shows:
- Feature icon (24px, colored)
- Feature name
- Scanned size or item count
- Checkbox for selection
- Status pill (`Scanning...` | `X MB found` | `Clean`)

### Progress Ring
SVG-based circular progress. Used on the Dashboard SmartScan. Outer ring shows overall score (0–100), inner shows individual category weights.

### File List
Virtualized list (react-window) for performance. Each row: icon, name, path truncated, size badge, checkbox. Supports multi-select with shift-click.

### Toast Notifications
Bottom-right slide-in. Auto-dismiss after 4s. Types: success (teal), warning (amber), error (red). Max 3 stacked.

### Action Sheet
Slide-up confirmation panel before any destructive operation. Shows: items count, total size to be freed, estimated time, Cancel / Confirm. Confirm button is teal, requires intentional click (no double-click shortcut).

---

## Motion

Animations use `transition-all duration-200 ease-in-out` as baseline.

| Interaction | Animation |
|-------------|-----------|
| Page transition | Fade + 8px slide-up, 180ms |
| Sidebar nav active | Background fill, 150ms |
| Scan progress | Ring stroke-dashoffset, smooth |
| Card appear | Stagger fade-in, 40ms delay per card |
| Button press | Scale 0.97, 80ms |
| Toast enter | Slide from right, 200ms |
| Toast exit | Fade + shrink, 150ms |

---

## Iconography

Use **Lucide React** for all icons. Icon size: `16px` in sidebar, `20px` in content headings, `24px` in feature cards. Stroke width: `1.5`.

No icon should be filled; always outline style to maintain the refined aesthetic.

---

## Platform-Specific Considerations

### macOS
- Tauri window: `titleBarStyle: "overlay"` — native traffic lights over frameless window
- Background: `transparent` + `vibrancy: "under-window"` for glass effect on the sidebar

### Windows
- Custom title bar with draggable region
- No vibrancy; use opaque `#0A0C10` bg

### Linux
- Same as Windows fallback
- Window decorations handled by WM; titleBarStyle: "default"

---

## Accessibility

- All interactive elements have `:focus-visible` rings using `--color-accent`
- Color is never the sole indicator — always paired with icon or label
- Keyboard navigation: Tab order follows visual layout
- ARIA labels on icon-only buttons
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text
- Reduced motion: `@media (prefers-reduced-motion)` disables all non-essential transitions
