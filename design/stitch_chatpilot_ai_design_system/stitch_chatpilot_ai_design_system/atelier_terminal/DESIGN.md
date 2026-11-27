---
name: Atelier Terminal
colors:
  surface: '#fbf9f6'
  surface-dim: '#dbdad7'
  surface-bright: '#fbf9f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f0'
  surface-container: '#efeeeb'
  surface-container-high: '#eae8e5'
  surface-container-highest: '#e4e2df'
  on-surface: '#1b1c1a'
  on-surface-variant: '#46464b'
  inverse-surface: '#30312f'
  inverse-on-surface: '#f2f0ed'
  outline: '#76777c'
  outline-variant: '#c6c6cb'
  surface-tint: '#5b5e68'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#181b24'
  on-primary-container: '#81838e'
  inverse-primary: '#c4c6d1'
  secondary: '#ac3400'
  on-secondary: '#ffffff'
  secondary-container: '#fd6b36'
  on-secondary-container: '#5d1900'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#001551'
  on-tertiary-container: '#547aff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e0e2ed'
  primary-fixed-dim: '#c4c6d1'
  on-primary-fixed: '#181b24'
  on-primary-fixed-variant: '#444650'
  secondary-fixed: '#ffdbd0'
  secondary-fixed-dim: '#ffb59d'
  on-secondary-fixed: '#390c00'
  on-secondary-fixed-variant: '#832600'
  tertiary-fixed: '#dce1ff'
  tertiary-fixed-dim: '#b7c4ff'
  on-tertiary-fixed: '#001551'
  on-tertiary-fixed-variant: '#0039b5'
  background: '#fbf9f6'
  on-background: '#1b1c1a'
  surface-variant: '#e4e2df'
typography:
  display-lg:
    fontFamily: Newsreader
    fontSize: 56px
    fontWeight: '400'
    lineHeight: 64px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Newsreader
    fontSize: 38px
    fontWeight: '400'
    lineHeight: 44px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Newsreader
    fontSize: 36px
    fontWeight: '500'
    lineHeight: 44px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Newsreader
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Newsreader
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: 0em
  headline-sm:
    fontFamily: Newsreader
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: 0em
  body-lg:
    fontFamily: Newsreader
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.06em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-mobile: 0.75rem
  margin: 2.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system synthesizes the analytical precision of bespoke financial terminals with the literary discipline of heritage print broadsheets and the modern execution of high-craft software. It serves analysts, authors, strategists, and decision-makers who interact with dense streams of quantitative and narrative intelligence. 

The aesthetic is grounded in structural permanence, typographical authority, and tactile mechanical feedback. Interfaces avoid floaty synthetic gradients, glossy blur planes, and ephemeral novelty in favor of ink-and-paper materiality, structured rules, strict geometry, and typographical hierarchy. Every interaction feels deliberate, physical, and humanly authored—bearing the crisp weight of cast metal type, linotype rulings, and calibrated instrumentation.

## Colors

The color architecture is built around natural ink and warm parchment tones, avoiding clinical blue-shifted whites or synthetic greys.

- **Primary (`#14171F` / Rich Printing Ink):** The anchor for high-density type, structural linework, high-contrast buttons, and heavy horizontal rules.
- **Secondary (`#C2410C` / Press Vermilion):** A dry, intense vermilion red-orange derived from editorial margin annotations, critical delta alerts, and editorial lead markers.
- **Tertiary (`#1D4ED8` / Deep Press Cobalt):** A deliberate archival blue for secondary data series, verified state tags, and reference links.
- **Neutral (`#FAF8F5` / Warm Ivory Parchment):** The primary paper surface, providing high contrast against dark ink while preventing visual fatigue.

### Supporting Chromatics & Tokens
- **Surface Secondary (`#F3EFEA`):** Used for table headers, inset metrics cells, and secondary container fills.
- **Surface Dark Canvas (`#121316` / Obsidian Black):** Applied for high-density financial terminal panels, telemetry readouts, or full dark mode execution.
- **Rule Border (`#E2DDD5` on light; `#2D3139` on dark):** Calibrated to simulate physical hairline score marks.
- **Bronze Accent (`#B45309`):** Reserved for institutional statuses, warnings, and currency indicators.

## Typography

The typographic hierarchy establishes a rigorous dual-engine rhythm:
1. **Newsreader (Editorial Serif):** Handles headlines, pull-quotes, long-form editorial analysis, and critical narrative anchors. It delivers literary authority, classical serif proportions, and optical calibration reminiscent of printed newspapers.
2. **Geist (Modern High-Craft Grotesque):** Directs the primary human-interface layer: controls, navigation, dialogs, and standard form labels. It provides crisp neutral legibility without distracting stylistic mannerisms.
3. **JetBrains Mono (Technical Monospace):** Drives all financial matrices, tabular numbers, timestamp stamps, keyboard accelerators, and system state badges. Tabular figures (`tnum`, `zero`) must be forced across all mono tokens to guarantee strict column alignment across real-time data feeds.

## Layout & Spacing

Layouts adhere to an architectural broadsheet framework combining fluid multi-column grids with firm mechanical bounds.

- **Desktop (>=1280px):** 12-column layout with 20px gutters and generous 40px outer margins. Supports asymmetrical split-screens (e.g., 4-column fixed terminal telemetry / 8-column editorial reading canvas).
- **Tablet (768px - 1279px):** 8-column layout with 16px gutters and 24px margins. Sub-panes condense into tabbed views or stacked sheets.
- **Mobile (<768px):** 4-column layout with 12px gutters and 16px margins. Margins compress to maximize raw data density; horizontal scroll rules apply to multi-field data tables.

All horizontal rhythm is maintained via precise hairline rules (`1px solid #E2DDD5`) that physically tether columns and isolate operational blocks rather than relying on empty white space.

## Elevation & Depth

This design system rejects deep blur dropshadows, vibrant outer glows, and translucent glassmorphism. Depth is achieved via **tonal stratification, layered physical borders, and crisp mechanical bevels**.

- **Level 0 (Base Sheet):** The core canvas (`#FAF8F5`). In dark mode, `#121316`.
- **Level 1 (Card & Modular Panes):** Raised with a flat 1px crisp rule (`#E2DDD5`) and an imperceptible micro-shadow: `0 1px 1px rgba(20, 23, 31, 0.04), 0 2px 4px rgba(20, 23, 31, 0.02)`.
- **Level 2 (Popovers, Tooltips & Context Menus):** Framed in high-contrast double borders (1px outer rule `#14171F`, 1px inner inset `#FFFFFF`) with a dense, crisp stamp shadow: `2px 2px 0px rgba(20, 23, 31, 0.12)`.
- **Level 3 (Modal Dialogs & Terminal Overlays):** Block-opaque surface surrounded by a 1px solid ink stroke `#14171F` over a 40% opacity ink wash scrim (`#14171F` at 0.40).

## Shapes

The geometric signature is firm, structural, and restrained. 

- Base components utilize `roundedness: 1` (`0.25rem` / `4px`), referencing precision cut-paper edges and milled instrument bezels.
- Badges, status stamps, and action buttons keep corners tight (never capsule or pill-shaped) to preserve the feeling of structural machinery and typography-driven layout.
- Rule lines are strictly 1px or 2px flat vector divisions without gradient falloffs.

## Components

### Buttons & Interactive Controls
- **Primary Button:** Deep ink background (`#14171F`), paper-white text (`#FAF8F5`), 1px solid `#14171F`. Hover triggers a crisp background transition to `#2D3139`. Active state shifts the element downward by 1px with no blur shadow.
- **Secondary Button:** Parchment surface (`#FAF8F5`), ink text (`#14171F`), framed in a crisp 1px rule (`#D1CAC0`). Hover shifts background to `#F3EFEA`.
- **Tertiary / Press Action:** Understated text button underlined with a 1px dotted ink rule, shifting to solid vermilion on hover.

### Structured Editorial Data Tables
- **Header:** Uppercase monospace labels (`label-md`), background `#F3EFEA`, bottom border 2px solid `#14171F`.
- **Rows:** Alternating subtle zebra striping (`#FAF8F5` and `#F7F4EF`). Cell content separated by 1px hairline horizontal rules. All numerical values right-aligned using `data-mono` with identical character bounding boxes.
- **Active / Selected Row:** Highlights with a 2px vertical vermilion lead line on the left edge.

### Chips & Stamped Badges
- Stamped badges simulate manual archival print stamps: monospaced, all-caps, enclosed within a 1px border. 
- Positive indicator: Forest ink (`#15803D`) on pale tint (`#F0FDF4`). 
- Alert / Critical: Vermilion (`#C2410C`) on ivory-sand tint (`#FFF7ED`).
- Neutral metadata: Slated ink border with dot prefix.

### Form Inputs & Checkboxes
- **Inputs:** Crisp 1px border (`#D1CAC0`) on white/parchment. Focus transitions instantly to a 1.5px solid `#14171F` rule without soft focus rings. Input caret is a non-blinking 2px block.
- **Checkboxes & Radios:** Sharp square indicators (2px radius for checks; round 12px for radios) housing a sharp center pip.

### Cards & Modular Documents
- Styled as printed dossiers: explicit header divider rule, optional document metadata slug (e.g., `DOC-2024-X4`), and padded content canvas with defined tactile margins.

### Progress & Mechanical Spinners
- Replaces generic circular loaders with a **Typesetting Pip Blink** (three monospaced square dots toggling state sequentially) or a **Lead Inking Line** (a continuous 2px vermilion bar traversing an engraved rule track).