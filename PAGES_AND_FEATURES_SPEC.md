# CHATPILOT AI — COMPLETE APPLICATION PAGES, TABS & INTERACTION SPECIFICATION

This document provides a comprehensive breakdown of all **10 Pages/Views** and **2 Global Modals** in ChatPilot AI. Use this specification to design the screens in Google Stitch with your exact preferred styling, visual hierarchy, colors, spacing, and component aesthetics.

---

## TABLE OF CONTENTS
1. [Global Layout & Navigation (Desktop & Mobile)](#1-global-layout--navigation)
2. [Page 1: Overview Dashboard (`overview`)](#page-1-overview-dashboard)
3. [Page 2: Ask ChatPilot — Executive Co-Pilot (`assistant`)](#page-2-ask-chatpilot--executive-co-pilot)
4. [Page 3: Reply Inbox & Approval (`reply-inbox`)](#page-3-reply-inbox--approval)
5. [Page 4: Contacts & Chat Rules (`chats`)](#page-4-contacts--chat-rules)
6. [Page 5: WhatsApp Groups (`groups`)](#page-5-whatsapp-groups)
7. [Page 6: Contact Memory & Knowledge Base (`memory`)](#page-6-contact-memory--knowledge-base)
8. [Page 7: AI Providers & Model Routing (`ai-providers`)](#page-7-ai-providers--model-routing)
9. [Page 8: Live Activity & Audit Log (`activity`)](#page-8-live-activity--audit-log)
10. [Page 9: Dataset Audit & Style Training (`dataset-audit`)](#page-9-dataset-audit--style-training)
11. [Page 10: Settings & Android Companion (`settings`)](#page-10-settings--android-companion)
12. [Global Modal 1: Notification Simulator (`SimulatorModal`)](#global-modal-1-notification-simulator)
13. [Global Modal 2: Chat Export Importer (`ImporterModal`)](#global-modal-2-chat-export-importer)
14. [How to Share Your Stitch Design With Me](#how-to-share-your-stitch-design-with-me)

---

## 1. GLOBAL LAYOUT & NAVIGATION

### Visibility
* **Desktop**: Left navigation sidebar (width: 256px / 64 tailwind units), fixed and persistent.
* **Mobile (Redmi Note 13 Pro 5G / Responsive)**:
  * Top sticky App Bar with Brand Icon, App Name ("ChatPilot AI"), Hamburger Menu button, and quick "Simulate" test button.
  * Slide-out navigation drawer with backdrop blur when hamburger is clicked.

### Navigation Items (in exact order)
1. **Overview** (Icon: `LayoutDashboard` or `Grid`)
2. **Ask ChatPilot** (Icon: `Bot` or `Sparkles` — AI Assistant Co-Pilot)
3. **Reply Inbox** (Icon: `Inbox` or `MessageSquare` — includes dynamic unread badge counter e.g., `[2]`)
4. **Contacts** (Icon: `Users` or `UserCheck`)
5. **Groups** (Icon: `UsersRound` or `Layers`)
6. **Memory** (Icon: `Brain` or `Database`)
7. **AI Providers** (Icon: `Cpu` or `Sparkles`)
8. **Activity Log** (Icon: `Activity` or `History`)
9. **Dataset Audit** (Icon: `BarChart3` or `FileText`)
10. **Settings** (Icon: `Settings`)

### Persistent Sidebar Footer
* User Profile row: Avatar ("T"), Name ("Thoufikur Rahman"), status dot ("Online").
* Live Watcher & Android Bridge status pill: e.g. "Android Bridge: Active".

---

## PAGE 1: OVERVIEW DASHBOARD

### Identifier: `overview`
### Purpose
The executive command center. Gives Thoufikur a 5-second summary of auto-reply status, pending messages, active AI quotas, and quick system controls.

### Visual Elements & Components
1. **Header Section**:
   * Title: "System Overview"
   * Subtitle: "Personal WhatsApp AI Assistant & Co-Pilot"
   * Master Global Auto-Reply Switch:
     * Toggle switch (ON / OFF).
     * Label: "Global Auto-Reply".
     * Description: "Master emergency switch. When OFF, messages create pending review drafts only."
   * Quick Action Buttons:
     * "Simulate Message" (opens Simulator Modal).
     * "Import WhatsApp Chat" (opens Importer Modal).

2. **Top Metric Summary Cards (4 Cards)**:
   * **Card 1: Selected Contacts**: e.g. `1 Active` (Parveen) / `14 Total Contacts`.
   * **Card 2: Pending Approval**: e.g. `0 Drafts Waiting` (shows badge if > 0).
   * **Card 3: Auto-Replies Sent**: e.g. `2 Replied Today` (respecting 2-message safety limit).
   * **Card 4: Security Shield**: e.g. `100% Guarded` (0 high-risk leaks, OTP/bank filters active).

3. **Active AI Model Status Cards (3 Provider Grid)**:
   * **Groq**: Status badge (Active/Healthy), Model (`qwen/qwen3.8-27b`), avg latency (`~800ms`), daily quota progress bar.
   * **Google Gemini**: Status badge (Active/Healthy), Model (`gemini-2.5-flash`), avg latency (`~1.2s`), quota progress bar.
   * **OpenRouter**: Status badge (Standby/Fallback), Model (`deepseek/deepseek-chat`), quota progress bar.

4. **Recent Activity Feed (List/Table)**:
   * Columns: Event Type, Contact / Sender, Action / Message Summary, Timestamp.
   * Shows real-time incoming messages, generated drafts, and sent notifications.

---

## PAGE 2: ASK CHATPILOT — EXECUTIVE CO-PILOT

### Identifier: `assistant`
### Purpose
A ChatGPT / Claude style executive assistant interface. Allows Thoufikur to ask questions about his chat history, draft and test replies, inspect pending decisions, and summarize daily chats without sending anything to real contacts.

### Visual Elements & Components
1. **Left Sessions Drawer / Sidebar (Desktop & Collapsible Mobile)**:
   * Header: "Ask ChatPilot" + "New Chat" (`+`) button.
   * Sessions List: Scrollable list of chat sessions with titles (e.g., "Summary of Parveen's messages", "Project deadlines inquiry") and timestamps.
   * Bottom Safety Note: "Private Sandbox: Messages here are never sent to contacts."

2. **Main Chat Stream Panel**:
   * Header: "Executive AI Assistant" + Provider Pills ("Groq • Gemini Active").
   * Welcome Screen (when chat is empty):
     * Bot Avatar illustration.
     * Greeting: "What can I help you with, Thoufikur?"
     * 4 Quick Action Prompt Cards:
       * "What happened today?" (Daily WhatsApp summary)
       * "What needs my attention?" (Pending decisions & high-priority messages)
       * "Who is waiting for my reply?" (Unanswered questions)
       * "Draft a casual holding reply" (Tanglish natural holding text)
   * Message Bubbles:
     * User Bubble: Right-aligned, colored container with Thoufikur's prompt.
     * Assistant Bubble: Left-aligned with Bot avatar, clean typography, formatted markdown, and metadata pill ("Generated via Groq • 840ms").
     * Copy Button on assistant replies with "Copied!" check feedback.
     * Context Chips: If a message had a contact attached (e.g. `Attached: Parveen`), a badge appears above the message.
   * Thinking State: Animated pulse / spinner ("ChatPilot is analyzing message context...").

3. **Bottom Floating Composer**:
   * Context Attachment Bar: Shows chips of attached contacts with remove (`×`) button.
   * Rounded Input Box:
     * Multi-line expandable textarea with placeholder: "Ask ChatPilot anything about your chats, drafts, or daily schedule...".
     * Left Action: Paperclip icon ("Attach Contact Context") -> opens contact selector dropdown.
     * Right Action: Send button (Paper plane icon) with disabled state while loading.

---

## PAGE 3: REPLY INBOX & APPROVAL

### Identifier: `reply-inbox`
### Purpose
Human-in-the-loop review station. When Global Auto-Reply is OFF, or when a contact requires approval, AI drafts appear here for Thoufikur to review, edit, approve, or reject.

### Visual Elements & Components
1. **Top Filter Tabs**:
   * **Pending Approval** (`pending`) — with counter badge.
   * **Approved / Sent** (`approved`).
   * **Rejected / Discarded** (`rejected`).

2. **Split-Screen Master-Detail Layout**:
   * **Left Column (List of Incoming Messages & Drafts)**:
     * Contact Name (e.g., "Parveen / مومياء").
     * Time ago (e.g., "3m ago").
     * Incoming snippet (e.g., "Eppa varuviga?").
     * Generated Draft preview.
     * Provider & Model tag.
     * Active selection highlight.
   * **Right Column (Review & Edit Panel)**:
     * Contact Header with phone number and preferred language badge (e.g., "Tanglish").
     * Incoming Message Card: Shows full incoming message bubble with timestamp.
     * Policy & Guardrails Card:
       * Safety Level: e.g. `LOW RISK` (Green) or `HIGH RISK` (Red).
       * Category: Casual Conversation / Scheduling / Finance.
       * Sensitive Data Check: "No OTP / Banking info detected".
     * AI Draft Response Card:
       * Model used: e.g., `Groq (qwen/qwen3.8-27b) • 780ms`.
       * Textarea: Pre-filled with AI draft, editable by Thoufikur.
       * Action Bar:
         * "Edit Draft" toggle button.
         * "Reject" button (red outline/subtle).
         * "Approve & Send to WhatsApp" button (primary action with Send icon).

---

## PAGE 4: CONTACTS & CHAT RULES

### Identifier: `chats`
### Purpose
Manage contacts, assign AI personalities, and enable auto-reply for selected individuals.

### Visual Elements & Components
1. **Header & Search Bar**:
   * Title: "Contacts & Direct Chats".
   * Search input to quickly filter by contact name or phone number.
   * Selection Filter: "All" / "Selected Only" / "Auto-Reply Enabled".

2. **Contacts Table / Grid Cards**:
   * Contact Avatar & Display Name (e.g., "Parveen").
   * WhatsApp JID / Phone Number (e.g., `+919790171303`).
   * **Is Selected Toggle**: Explicit checkbox / switch marking this contact eligible for ChatPilot processing.
   * **Auto-Reply Toggle**: Independent toggle per contact.
   * **Language Setting**: Dropdown: `Auto` / `Tanglish (Family)` / `English (Professional)`.
   * **Reply Mode**: `Approval Required` vs `Autonomous (Within Safety Limits)`.
   * **Actions**: "Edit Prompt & Memory" button -> opens custom instruction drawer.

---

## PAGE 5: WHATSAPP GROUPS

### Identifier: `groups`
### Purpose
Manage WhatsApp groups. By design, groups have auto-reply disabled by default to prevent spamming group chats.

### Visual Elements & Components
1. **Header with Privacy Alert**:
   * Banner: "Group Safety Active: Auto-reply to groups is blocked by default to prevent unauthorized bulk responses."
2. **Groups List**:
   * Group Name & Avatar.
   * Participant count.
   * Auto-Reply Toggle (Locked or restricted with warning dialog).
   * Monitored status (can allow reading for summaries without replying).

---

## PAGE 6: CONTACT MEMORY & KNOWLEDGE BASE

### Identifier: `memory`
### Purpose
Manage specific facts, relationship context, and rules that the AI remembers for each contact.

### Visual Elements & Components
1. **Contact Filter Dropdown**: Select contact (e.g., "Parveen").
2. **Memory Fact Cards**:
   * Key: e.g., `relationship`, Value: `Mother / Close family member`.
   * Key: `honorific`, Value: `Always call 'maa'`.
   * Key: `typical_replies`, Value: `Concise (1-5 words), uses Tanglish`.
   * "Delete Fact" (`trash`) and "Edit Fact" buttons.
3. **"Add Memory Fact" Form**:
   * Inputs for Fact Key, Fact Value, and Save button.

---

## PAGE 7: AI PROVIDERS & MODEL ROUTING

### Identifier: `ai-providers`
### Purpose
Monitor, configure, and route between Groq, Google Gemini, and OpenRouter.

### Visual Elements & Components
1. **Provider Cards (3 Cards)**:
   * **Groq**: API Key status (Configured), Active Model picker (`qwen/qwen3.8-27b` / `llama-3.3-70b-versatile`), Latency display.
   * **Google Gemini**: API Key status (Configured), Model picker (`gemini-2.5-flash`), Latency display.
   * **OpenRouter**: API Key status (Configured), Model picker (`deepseek/deepseek-chat`).
2. **Fallback Priority Chain**:
   * Drag-and-drop or rank list: e.g., 1. Groq (Fastest) -> 2. Gemini (Smartest) -> 3. OpenRouter (Backup).
3. **Usage & Quota Charts**:
   * Real-time requests today, average response time, error rate (0%).

---

## PAGE 8: LIVE ACTIVITY & AUDIT LOG

### Identifier: `activity`
### Purpose
Real-time chronological timeline of everything the system does.

### Visual Elements & Components
1. **Filter Pills**: "All Events", "Incoming Notifications", "Replies Generated", "Replies Sent", "Security Blocks".
2. **Timeline Feed**:
   * Event badge (Green = Sent, Blue = Drafted, Red = Blocked).
   * Timestamp (e.g., `17:04:41 • 26 Nov 2026`).
   * Event Title: e.g., `Generated draft reply for Parveen`.
   * Detailed Metadata JSON drawer: Shows provider used, latency in ms, notification ID, and matched rules.

---

## PAGE 9: DATASET AUDIT & STYLE TRAINING

### Identifier: `dataset-audit`
### Purpose
Inspects imported WhatsApp chat exports (e.g., Parveen's 477 messages) and analyzes Thoufikur's natural writing patterns.

### Visual Elements & Components
1. **Dataset Header**: Total messages analyzed (`477 Messages with Parveen`).
2. **Style Profile Metrics**:
   * Dominant Language: `Tanglish (78%) / English (22%)`.
   * Average Reply Length: `3.4 Words`.
   * Top Words: `maa`, `ok`, `seri`, `varren`, `iruken`, `express`.
3. **Sample Extraction Browser**: Table showing real message pairs from history and how the AI matches that tone.

---

## PAGE 10: SETTINGS & ANDROID COMPANION

### Identifier: `settings`
### Purpose
System settings, appearance customization, Android 15 companion setup, and privacy policy.

### Sub-Tabs
1. **General**:
   * Global Auto-Reply Master Toggle.
   * Reply Delay Selector (`1-3s Immediate`, `2-5s Recommended`, `5-10s Casual`).
   * Language Focus (`Auto`, `Tanglish`, `English`).
2. **Appearance & Theme**:
   * Mode: `Light` / `Dark` / `System`.
   * Accent Colors: `Emerald Green`, `Teal`, `Violet Indigo`, `Sapphire Blue`, `Warm Amber`, `Monochrome Slate`.
3. **Android Companion**:
   * Target Device Info Card: `Redmi Note 13 Pro 5G (Android 15) • ADB: n7fyu84lpv4989ha`.
   * Android 15 Notification Setup Walkthrough cards (Restricted Settings, Notification Access, Reverse Port).
   * Webhook Endpoint Card: `http://127.0.0.1:8000/api/webhooks/whatsapp`.
4. **Privacy & Safety**:
   * Personal WhatsApp Zero-Ban Guarantee statement.
   * High-risk sensitive information redaction rules (OTPs, banking).
5. **About**:
   * App version (`v1.0.0`), Author (`Thoufikur Rahman`), Tech stack.

---

## GLOBAL MODAL 1: NOTIFICATION SIMULATOR

### Trigger: "Simulate" Button on Header / Overview
### Purpose
Send a mock WhatsApp notification directly into the pipeline to test AI reply generation without requiring anyone to send a real message.

### Elements
* Dropdown: "Select Contact to Simulate" (Parveen / Other).
* Textarea: "Incoming Message Text" (e.g., `Eppa varuviga?`).
* Checkbox: "Simulate Native Reply Action (RemoteInput)".
* Action Button: "Inject Simulated Notification".
* Live Output Log: Displays the real-time response JSON and generated reply.

---

## GLOBAL MODAL 2: CHAT EXPORT IMPORTER

### Trigger: "Import WhatsApp Chat" Button
### Purpose
Upload a `.txt` WhatsApp chat export to extract contact style patterns.

### Elements
* Drag & drop file upload zone.
* Contact Name input.
* Progress bar showing parsing -> tokenizing -> saving style profile to Supabase.

---

## HOW TO SHARE YOUR STITCH DESIGN WITH ME

Once you finish designing your screens in Google Stitch, here is how you can share the design with me so I can apply it to your project:

### Method 1: Export Code or CSS / Tailwind Classes (Recommended & Fastest)
* From Google Stitch, export or copy:
  1. The **Tailwind CSS classes** or CSS styles for the components.
  2. The **HTML / JSX markup** of the screens you designed.
  3. The **Color Palette / Hex Codes** you chose (Primary background, card background, borders, text colors, and primary accent).
* Paste them here or drop the exported files into `D:\CHATPILOT AI` (e.g. into a `design/` folder).

### Method 2: Google Stitch Project URL / Screens
* If you have a share link or screen IDs from Google Stitch, share the URL or screen identifiers with me.

### Method 3: Screenshots or Design Spec
* If you take screenshots of your designs in Stitch, you can upload them directly in our chat.
* I will inspect every color, font, corner radius, padding, and layout detail and write pixel-perfect Tailwind CSS code matching your designs exactly.

---

### What I Will Do Once You Share Your Design:
1. I will replace the current visual styles with your exact colors, themes, cards, and layouts.
2. I will build and test the frontend bundle.
3. I will re-package the Android APK and deploy it directly to your connected Redmi Note 13 Pro 5G.
4. I will verify that all views render cleanly on both Desktop and Android.
5. Then we will proceed with the live verification test with Parveen (`+919790171303`).
