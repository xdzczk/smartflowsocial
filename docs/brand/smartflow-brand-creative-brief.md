# SmartFlowSocial — Visual brand brief

Concise creative direction derived from the in-app design system. Use this alongside `smartflow-brand-tokens.json` for external image generation (e.g. Nano Banana Pro, Midjourney, etc.).

## Positioning snapshot

**Product:** Nostr-native publishing operating system — scheduling, calendars, campaigns, operator workflows.

**Design personality:** Premium B2B SaaS with a **warm, editorial light mode** and a **cool charcoal dark mode**. Confident and restrained: the UI reads as **instrumentation for serious creators**, not a playful consumer app.

## Visual tone

- **Premium & product-led:** Dense information, clear hierarchy, minimal ornament.
- **Operator-grade:** Dashboard chrome (sidebar, header, footer) shares one neutral surface; content sits on layered cards with soft shadows — reads as a **control room**, not a marketing landing page pasted into the product.
- **Dark elegant:** Dark mode is **neutral slate (~220° hue), not purple-tinted**. Purple is reserved for action and identity moments.
- **Restrained accent:** **Violet/saturated purple (`brand-strong`)** for primary CTAs, focus rings, selection washes, and key interactive states — **never** as a full-screen gradient wash behind everyday UI.

## Color philosophy

- **Light:** Warm **greige canvas** + **white cards**. Separation comes from **elevation (shadow + inset highlight)** more than heavy borders. Borders are warm grey — explicitly **not lavender**.
- **Dark:** **Charcoal ladder** with invisible or tonal borders on cards; depth is **shadow + subtle top-plane highlight**.
- **Purple role:** **Accent and action only** — buttons, toggles “on,” selected rows/chips, optional hero headline gradient (slate → purple). **Hyperlinks** use a separate **cool slate blue** so purple stays precious.
- **Semantic colors** (success, warning, danger, info) are available but secondary for brand storytelling; lead with neutrals + purple.

## Typography

- **Family:** **Kanit** (sans) system-wide — modern, slightly technical, good at UI density.
- **Hierarchy** (feel, not pixel-perfect): tight tracking on large titles; **display ~36px** for rare heroes; **page titles ~28px bold**; **sections/modals ~22px semibold**; **cards ~18px semibold**; **body ~14px**; **meta/caption ~12px**; **overlines ~11px uppercase tracked**.
- **Tone:** Precise labels, short clauses; avoid playful rounded “friendly SaaS” copy styling in visuals — match **instrumentation + clarity**.

## Surfaces & elevation

- **Three-tier shadow ladder:** (1) everyday cards — soft warm/cool drop + **inset top highlight**; (2) emphasized panels; (3) overlays/modals — deeper stack.
- **Cards:** Rounded **~14px** on panels; controls **~10px**; **~16px** for modals/sheets — slightly more rounded than panels so hierarchy reads.
- **Textures:** Optional **micro grain** on dashboard canvas (very subtle dot noise) — suggests craft without skeuomorphism.

## Spacing & layout

- **Rhythm:** 4px base grid; typical vertical stacks **8px / 16px / 24px** for tight / default / loose.
- **Inset:** ~16px standard card padding; ~24px for hero/modal bodies.
- **Character:** Generous whitespace **within** cards; **dense rails** (sidebar) acceptable — reads as **power-user efficiency**.

## Screenshot framing (marketing)

- Prefer **real product chrome**: sidebar + top bar visible when it helps context; crop **tight to one primary panel** when explaining a feature.
- Maintain **margin breathing room** — never flush-edge screenshots without padding in final comps.
- **Hero device frames:** optional; if used, keep frames **minimal/neutral** — let UI shadows carry depth.

## Annotations & callouts

- Style callouts like **in-product UI**: small **rounded rectangles** or **pills**, **neutral surfaces**, **thin borders**, **12–13px semibold** labels.
- Leader lines: **single-weight strokes**, muted neutral — **not** neon arrows or comic bursts.
- Prefer **numbered steps** or **short verbs** (“Schedule,” “Queue,” “Publish”) over paragraph explanations on the image.

## Logo & wordmark

- **Assets:** `public/logos/Logo-Full-LightMode.svg` and `public/logos/Logo-Full-DarkMode.svg` (also `public/Logo-NoText.svg` for icon-only).
- **Mark:** Gradient **stacked chevron / ribbon** shapes (deep indigo → violet → lavender) — energy **without** clutter.
- **Wordmark:** Near-black (`#161616`) in supplied full logos — pair with backgrounds that preserve contrast.
- **Usage:** Clear space ≈ **height of the “S”** around the logo where possible; **do not** recolor the gradient mark with arbitrary hues; **do not** outline or emboss the wordmark for “marketing flair.”

## Do / don’t (generated marketing visuals)

**Do**

- Show **real UI density** and **actual purple CTAs** sparingly.
- Use **warm light** or **cool dark** backgrounds consistent with the app — **not** generic pure `#FFFFFF` posters unless mimicking a card-on-canvas composition.
- Keep **copy short**; let screenshots imply capability.

**Don’t**

- Flood the frame with **purple gradients**, lens flares, or **crypto-neon** tropes.
- Mix **unrelated accent colors** (coral, mint, electric blue) as primary — breaks brand discipline.
- Use **glossy glassmorphism** or **heavy blur blobs** behind screenshots — reads as generic SaaS 2023 poster art.
- Replace Kanit with **Inter-only** or **system-default** unless matching a specific competitor swipe (avoid).

## Recommended reference screens (for image-generation refs)

Capture or export from these **in-app routes** — each highlights a different pillar of the SmartFlowSocial visual system (chrome, elevation, purple accent, workflow density).

| Route | Why it represents the brand |
|-------|----------------------------|
| **`/dashboard`** | **Primary hero reference.** Full shell: sidebar + top bar on `dashboard-canvas` grain, **Flow zone** (`flow-zone` section tier), KPI-style cards, queue-colored accents — best single shot for “this is SmartFlowSocial.” |
| **`/dashboard/calendar`** | **Scheduling & time.** Large **rounded panels** (`radius-lg`), tiered shadows, calendar grid — shows **information density** and **neutral chrome** without relying on purple fills. |
| **`/dashboard/compose`** | **Creation surface.** Composer chrome, inputs at **`radius-md`**, primary CTA purple — ideal for **“create / publish”** narratives and **accent discipline** (purple on actions, not backgrounds). |
| **`/dashboard/scheduled`** | **Operator workflow.** Lists, filters, queue semantics — demonstrates **muted tables**, status badges, and **secondary text hierarchy** (`text-secondary` / `text-tertiary`). |
| **`/plans`** | **Premium positioning.** Plan comparison, pricing cards on **elevated surfaces** — useful when marketing needs **upgrade / Pro** story while staying on-brand (cards + restrained color). |
| **`/dashboard/broadcasts`** | **Campaign-scale UI.** Broader panels and campaign workflows — shows the product as **more than a single-post composer**; good for **B2B / creator-pro** angles. |

**Tip:** For dark-mode references, toggle theme and re-capture the same routes — dark mode is **slate-charcoal**, not purple-washed, and reads especially **premium** with lit card stacks.
