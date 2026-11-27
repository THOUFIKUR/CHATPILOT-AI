# ChatPilot AI — Design System & Stitch Architecture Specification

## 1. Vision & Identity

ChatPilot AI delivers a clean, minimal, and premium AI-assistant experience inspired by modern interaction patterns seen in ChatGPT and Claude, while retaining its dedicated personal WhatsApp assistant capabilities.

- **Tone & Mood**: Professional, refined, calm, highly legible, uncluttered.
- **Form Factor**: Responsive across Mobile (Android / Redmi Note 13 ), Tablet, and Desktop (Windows 11).

---

## 2. Color System & Design Tokens

### Semantic Color Palettes

#### A. Light Mode (Default)
- `bg-primary`: `#F8FAFC` (Canvas background)
- `bg-surface`: `#FFFFFF` (Cards, drawers, navigation, composer)
- `bg-surface-subtle`: `#F1F5F9` (Hover states, subtle borders)
- `text-primary`: `#0F172A` (Headings, active text, high contrast)
- `text-secondary`: `#475569` (Body text, active icons)
- `text-tertiary`: `#94A3B8` (Placeholders, inactive timestamps)
- `border-subtle`: `#E2E8F0` (Card borders, dividers)
- `border-focus`: `var(--accent-primary)`

#### B. Dark Mode
- `bg-primary`: `#090D16` (Deep space canvas)
- `bg-surface`: `#111827` (Elevation cards, modals, composer)
- `bg-surface-subtle`: `#1F2937` (Subtle highlights, drawer background)
- `text-primary`: `#F8FAFC` (Pure white text)
- `text-secondary`: `#94A3B8` (Muted secondary text)
- `text-tertiary`: `#64748B` (Inactive states)
- `border-subtle`: `#1E293B` (Soft dark dividers)

#### C. Accent Color Options (User Configurable)
1. **Emerald (Default)**: `#16A34A` (Hover `#15803D`, Subtle `#F0FDF4`, Dark Subtle `#064E3B40`)
2. **Teal**: `#0D9488` (Hover `#0F766E`, Subtle `#F0FDFA`, Dark Subtle `#134E4A40`)
3. **Indigo / Violet**: `#6366F1` (Hover `#4F46E5`, Subtle `#EEF2FF`, Dark Subtle `#312E8140`)
4. **Sapphire Blue**: `#0284C7` (Hover `#0369A1`, Subtle `#F0F9FF`, Dark Subtle `#0C4A6E40`)
5. **Warm Amber**: `#D97706` (Hover `#B45309`, Subtle `#FFFBEB`, Dark Subtle `#78350F40`)
6. **Monochrome Slate**: `#334155` (Hover `#1E293B`, Subtle `#F8FAFC`, Dark Subtle `#33415540`)

---

## 3. Typography Hierarchy

- **Font Family**: System font stack (`Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, sans-serif)
- **Scale**:
  - `Display / Hero`: `text-2xl` (24px) / `font-bold` / tracking `-0.02em`
  - `Section Title`: `text-lg` (18px) / `font-semibold` / tracking `-0.01em`
  - `Body / Message`: `text-sm` (14px) / `font-normal` / line-height `1.5`
  - `Label / Badge`: `text-xs` (12px) / `font-medium` / tracking `0.02em`
  - `Micro`: `text-[10px]` (10px) / `font-semibold` / uppercase

---

## 4. Responsive Layout & Navigation Architecture

```
Mobile Screen (< 768px):
┌──────────────────────────────────────────────┐
│ [≡ Menu]       ChatPilot AI       [+ New]   │  <- Mobile Top Bar
├──────────────────────────────────────────────┤
│                                              │
│                                              │
│               Active View Content            │
│       (Overview / Ask AI / Chats / Inbox)    │
│                                              │
│                                              │
├──────────────────────────────────────────────┤
│  [Message Composer / Quick Action Dock]     │  <- Floating Bottom Dock
└──────────────────────────────────────────────┘
  (Tapping [≡] slides out Mobile Navigation Drawer with backdrop blur)

Desktop Screen (>= 768px):
┌────────────┬─────────────────────────────────┐
│            │ Header (Status Pills, Master UI)│
│  Sidebar   ├─────────────────────────────────┤
│  (Fixed)   │                                 │
│            │      Responsive Workspace       │
│            │                                 │
└────────────┴─────────────────────────────────┘
```

---

## 5. Screen Specifications

1. **AI Home & Ask ChatPilot (`AssistantChatView.tsx`)**:
   - Conversational thread with streaming indicator.
   - Code copy action, markdown rendering, stop generation.
   - Floating rounded message composer with clear placeholder and send button.
2. **Overview (`OverviewView.tsx`)**:
   - Minimalist metrics: Connected Contacts, Drafts Pending Review, Active AI Provider.
   - Master Auto-Reply toggle (prominently labeled, safety guarded).
   - Recent Assistant Conversations and Quick Actions.
3. **WhatsApp Chats (`ChatsView.tsx`)**:
   - Real contacts from Supabase.
   - Search bar, Auto-reply status pills, individual toggle.
4. **Reply Inbox (`ReplyInboxView.tsx`)**:
   - Status tabs: `Pending`, `Approved`, `Rejected`, `Failed`.
   - Card showing original message, AI Tanglish draft, and approve/reject actions.
5. **Settings (`SettingsView.tsx`)**:
   - Theme switch: Light, Dark, System.
   - Accent color picker (Live preview).
   - Android Notification Access & Permissions banner.
   - Provider status (Groq, Gemini, OpenRouter).
