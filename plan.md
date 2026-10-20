# Prime Bag Factory: Master Plan

> AI coding agent (Cursor, Qoder): read this file and `AGENTS.md` before every task; if your tool does not load `AGENTS.md` automatically, open it explicitly. This plan is the source of truth.
> If code and plan disagree, stop and ask. If the plan is silent, pick the simplest option and note it under "Decision Log".

---

## 0. Working Rules for AI Coding Agents (Cursor, Qoder)

1. **Plan first.** Before coding a task, restate the task, list files you will touch, then implement.
2. **One phase at a time, in order.** Do not start a phase until the previous phase's "Done when" is met.
3. **Small commits.** One task = one commit. Message format: `phase-N: short description`.
4. **Tick the checkbox** in this file when a task is finished. Add notes under "Decision Log" (section 14).
5. **No new libraries** outside section 3 without asking.
6. **Validate twice.** Every form and server action is validated with `zod` on client and server.
7. **Never expose** the Supabase service-role key to the browser. It lives only in `src/lib/supabase/admin.ts` (server only).
8. **Never copy** a competitor's UI, text, photos, client logos or legal documents. We follow the _idea and strategy_ only, and do it better.
9. **No licensed characters** (Marvel, Disney, Pokemon, etc.) anywhere in products or seed data.
10. **No hard-coded colors.** Use the design tokens in section 4.

---

## 1. Project Summary

- **Client:** WNC (CEO is the project owner).
- **Brand / domain:** Prime Bag Factory, `primebagfactorybd.com`.
- **Market:** Bangladesh. Goal is to win Google searches like "bag factory in Dhaka", "custom bag", "delivery bag", "seminar bag" in **Bangla and English**.
- **Business model:** two lines on one site
  - **Bulk / custom (B2B):** delivery bags, seminar and NGO bags, promotional bags. Sold by **quote (RFQ)**.
  - **Ready-stock retail:** backpacks, wallets, belts, totes, etc. Sold by **online checkout (COD only at launch)**.
- **Strategy:** follow a proven competitor's _structure_ (use-case category pages, client proof, quote form, trust documents), and improve on it (see section 13).

### Locked decisions

| Topic                   | Decision                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack                   | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase                                                                                  |
| Brand color             | **Golden** (antique gold + ink + ivory), changed from orange (section 4)                                                                             |
| Sales                   | Retail items: online checkout. Bulk/custom: quote request or the **Custom Bag Builder** (section 2c)                                                 |
| Quantity pricing        | Every product has an MOQ and admin-defined quantity ranges (e.g. 5-50 pcs = one rate, 51-100 pcs = another) (section 2a)                             |
| Customization           | Fabric/color swatch library + multi-step Custom Bag Builder: color, size, zipper and every other part, logo, notes (sections 2b, 2c)                 |
| Custom order flow       | **Confirmed:** builder shows an estimate, the team confirms the final price, then the order is created (builder request, then Convert to order)      |
| Quantity-range counting | **Confirmed:** total quantity of the same product across all colors and sizes                                                                        |
| Builder preview         | **Confirmed:** selection summary only at launch, no live color preview                                                                               |
| Payment at launch       | **COD only** (design so bKash/Nagad can be added later)                                                                                              |
| Inventory               | **Variant-level stock + reserved stock + low-stock alert + movement log**. Schema must allow suppliers/purchasing/raw material later (not built now) |
| Languages               | Bangla + English switch in the header (content in both). Accessibility baseline: WCAG 2.2 AA (section 3c)                                            |
| Theme                   | Light / Dark / System toggle, default System (sections 3c, 4a)                                                                                       |

---

## 2. Product Model (important)

- **One product, many variants.** A delivery bag in 8 colors is ONE product with 8 variants, never 8 products.
- **One product, many categories** (many-to-many). The same insulated bag can appear under Pizza, Food, Cake and Grocery.
- Each product has a `type`:
  - `buy_now`: priced by quantity ranges (section 2a), has stock (or is made-to-order), shows Add to cart.
  - `quote_only`: no price shown, shows Request a Quote.
  - Every `buy_now` product also shows a secondary "Need bulk or custom? Request a quote" button.
- **Customization** is configured per product in admin (sections 2b and 2c). **MOQ** and **lead time (days)** are set on every product.
- **Collections** (industry tags, e.g. Food Delivery, Pharma, NGO, Education, Courier) cross-list products without duplicating them.

### 2a. MOQ and quantity-range pricing (set by admin on every product)

- Every product has a required `moq` (minimum order quantity, default 1). Quantities below MOQ are blocked everywhere (product page, cart, builder, `place_order`).
- When creating or editing a product, admin defines **price ranges**. Example (illustrative only):

| Quantity    | Unit price |
| ----------- | ---------- |
| 5-50 pcs    | rate A     |
| 51-100 pcs  | rate B     |
| 101-500 pcs | rate C     |
| 501+ pcs    | rate D     |

- **Rules (enforce in the admin form AND in the database):** first range starts at `moq`; ranges are contiguous with no gaps or overlaps; only the last range may be open-ended (`max_qty` null, shown as "501+"); unit price must be greater than 0; warn (do not block) if a higher-quantity range costs more than a lower one.
- **Admin UI:** a tier editor table with add/remove rows. A new row auto-fills `min_qty = previous max_qty + 1`. A live preview shows exactly how customers will see the table.
- **Customer UI:** the quantity input starts at MOQ; the range table highlights the active range; unit price and total update live; show a nudge such as "Add 12 more pcs to get the next price".
- **Counting rule (confirmed):** the active range is chosen by the **total quantity of the same product** across all colors and sizes in the cart or request.
- **Variants:** a variant may have an optional `price_delta` (default 0) added to the range price.
- **Single source of truth:** `src/lib/pricing.ts` computes range price, MOQ checks and totals for the UI; the `place_order` RPC re-implements the same logic server-side. Never trust a client price.

### 2b. Fabric and color swatches

- A global **Swatch Library** is managed in admin: `swatch_groups` (Fabric, Zipper, Zipper Puller, Lining, Strap/Webbing, Piping, Thread, Print Ink; admin can add more) and `swatches` (name en/bn, factory code, hex color, optional **fabric texture photo**, active flag).
- Swatches show as round chips (texture photo if available, else hex color) with the name on hover/tap and a clear selected state. Disabled when that variant is out of stock.
- Buy-now variants point to a fabric swatch (`swatch_id`). Selecting a swatch switches the gallery image when the variant has its own image.
- The same library feeds the Custom Bag Builder, so a fabric is added once and reused everywhere.

### 2c. Custom Bag Builder (AliExpress/Amazon-style "make it your own")

- Turned on per product with `customization_enabled`. The product page then shows a "Customize this bag" button.
- In admin, each customizable product has a list of **parts**. Per part: label (en/bn), input type, required flag, optional extra price per unit, sort order, help text.
  - Input types: `swatch` (pick from the allowed swatches), `select` (preset options such as S/M/L), `dimensions` (length x width x height with min and max in cm), `file` (logo), `text` (free note).
  - Typical parts: body fabric, zipper, zipper puller, lining, strap/handle, piping, thread, size, logo print.
  - For `swatch` parts admin picks the allowed swatches (a subset of the library), a default, and an optional price delta per swatch.
- **Customer flow: multi-step wizard** at `/product/[slug]/customize`. Steps with no configured parts are skipped.
  1. Quantity and live price estimate (MOQ and range pricing from 2a)
  2. Body fabric and color
  3. Other parts (zipper, puller, lining, strap, piping, thread)
  4. Size: preset or custom length x width x height within admin limits
  5. Branding: logo upload, print position/type
  6. Extra notes and contact details (name, phone, email, company, delivery area, needed-by date)
  7. Review and submit (all selections shown as color chips and values)
- **Wizard UX rules:** progress indicator, Back/Next with per-step zod validation, mobile-first, a live summary (selected chips + estimated price) as a sticky bottom bar on mobile and a side panel on desktop, draft saved in `localStorage`, fully translated (en/bn).
- **Data:** the result is a structured `customization` JSON snapshot (part key, label, chosen swatch id/name/code/hex, size, notes). Snapshot names and codes, not only ids, so later library edits never change old orders.
- **Pricing and ordering (confirmed):** the wizard shows an **estimate** = range price + sum of part price deltas. Submitting creates a `quote_requests` row with `source = 'builder'`; the team confirms the final price, then uses **Convert to order**. A settings flag `custom_order_mode` (`request` | `instant`) keeps the door open for instant COD checkout of custom bags later.
- Customizable products are **made-to-order** (`stock_mode = made_to_order`): no stock check, no reservation.
- Admin gets a printable **production spec sheet** for every builder request.

---

## 3. Tech Stack

- Package manager: **bun** (repo already has `bun.lock`).
- Next.js App Router, TypeScript strict.
- Tailwind (check `package.json`; if v4 define tokens with `@theme` in `globals.css`).
- shadcn/ui, `lucide-react`.
- Supabase: Postgres, Auth, Storage, RLS, Supabase CLI migrations in `supabase/migrations`.
- Cloudinary: public catalog media (product/category/collection images, swatch textures) via server-signed SDK uploads; Supabase Storage is retained only for private quote attachments (owner decision 2026-10-17 — see Decision Log).
- Forms: `react-hook-form` + `zod`. Tables: `@tanstack/react-table`. Server state: server components and server actions first.
- i18n: `next-intl` (`/en` and `/bn` routes).
- Fonts: `Inter` (Latin) + `Noto Serif Bengali` (Bangla glyphs only, variable, `--font-bn`) via `next/font/google`.
- Theme: `next-themes`. Server guard: `server-only`. Testing: `vitest`, `@playwright/test`, `@axe-core/playwright`.
- Performance gate (dev-only, plan Phase 3 task 8): `lighthouse` + `chrome-launcher`, run by `scripts/lighthouse-check.ts` (`bun run perf:lighthouse`) in the `lighthouse` CI job. Never a runtime dependency.
- Optional later: Cloudflare Turnstile (spam), Resend (email).
- Charts: `recharts` through the shadcn `chart` component. Fallback for sparklines: hand-written inline SVG.
- Command palette: `cmdk` through the shadcn `command` component.
- Drag-to-reorder (categories, swatches, images, tiers): `@dnd-kit/core` + `@dnd-kit/sortable` (must also offer keyboard-accessible Move up / Move down buttons).
- Email delivery: `resend` (owner-approved 2026-10-18 for new-quote alerts; server-only in `src/server/notifications.ts`, optional at runtime — no key means emails are skipped, the admin bell still works).
- shadcn components for the admin kit: `sidebar`, `card`, `badge`, `table`, `tabs`, `select`, `dropdown-menu`, `command`, `popover`, `tooltip`, `skeleton`, `separator`, `avatar`, `breadcrumb`, `sheet`, `checkbox`, `switch`, `textarea`, `calendar`, `chart`, `alert`, `progress`.
- No other UI libraries. Dates and numbers use `Intl` via `src/lib/format.ts`, not `date-fns` or `moment`.

### Environment variables

```
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only
NEXT_PUBLIC_WHATSAPP_NUMBER=
```

---

## 3b. Architecture

**Layers**

1. `src/app/` routes are thin: call server modules, render UI, no business logic.
2. `src/server/` (each file imports `server-only`): one module per domain: `catalog`, `orders`, `quotes`, `inventory`, `content`, `notifications`, `settings`. **All DB access lives here.** Modules return typed DTOs, not raw rows.
3. `src/lib/validators/`: zod schemas shared by forms and server actions.
4. Postgres is the last line of defense: constraints, RLS and RPCs (`place_order`, stock functions) enforce MOQ, tiers and stock even if app code is wrong.

**Rendering strategy**
| Routes | Strategy |
|---|---|
| Home, category, collection, product, blog, static pages | Static + ISR, refreshed with `revalidateTag` |
| Search, cart, checkout, order lookup, builder | Dynamic / client, no shared cache |
| Admin | Dynamic, `noindex`, never cached |

**Cache tags:** `catalog`, `category:{slug}`, `product:{slug}`, `content:{key}`, `settings`. Admin mutations revalidate only the affected tags.

**Mutations:** server actions return a typed `{ ok, data?, errors? }` result. Flow: validate (zod) -> authorize (`requireRole()`) -> execute -> write audit log -> revalidate. Route handlers only for webhooks, cron and file endpoints.

**Config and flags:** `src/lib/env.ts` validates env vars with zod at boot. Runtime flags live in the `settings` table (`cod_enabled`, `checkout_enabled`, `custom_order_mode`, `maintenance_mode`), cached under tag `settings`.

**Data conventions:** money `numeric(12,2)` in BDT; timestamps `timestamptz` (UTC), displayed in `Asia/Dhaka`; no hard delete of products that have orders (use `status` / `is_active`); `order_items` are immutable snapshots; every table has RLS enabled (a migration test fails if any table lacks it).

**Idempotency and concurrency:** checkout sends a client-generated `idempotency_key` (unique on `orders`). `place_order` locks variant rows (`for update`, ordered by id to avoid deadlocks). Admin edits use an `updated_at` optimistic check.

**Notifications:** outbox table `notifications` (channel, recipient, template, payload, status, attempts, sent_at). Events enqueue inside the same transaction; a scheduled sender (Vercel Cron or Supabase Edge Function) delivers through swappable adapters (email now; SMS/WhatsApp later).

**Security:** CSP and security headers in `next.config`; uploads validated by type, size and magic bytes; rate limiting through a `rate_limits` table (hashed IP + key + window) so no extra infrastructure is needed; service-role key only in `src/lib/supabase/admin.ts`; MFA (TOTP) for owner and manager; audit log on every admin mutation; no phone or address in logs.

**Observability:** error monitoring (Sentry or equivalent, pick at launch), structured server logs, uptime check on home and checkout.

**Testing:** Vitest for `pricing.ts`, validators and `format.ts` (include tier boundaries 50/51); SQL tests for RLS and `place_order` (oversell, MOQ, idempotency); Playwright e2e for quote, builder, checkout and admin product create; axe on key pages.

**CI/CD:** GitHub Actions on every PR: lint, typecheck, unit tests, build, i18n key parity, apply migrations to a throwaway DB. Environments: local (Supabase CLI), staging (separate Supabase project), production. Schema changes only through `supabase/migrations`, never by editing in the dashboard. Deploy on Vercel; use regions near Bangladesh (Supabase Singapore, Vercel `sin1`; verify availability).

---

## 3c. Theme, Language and Accessibility

### Theme (light / dark)

- `next-themes` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`; `<html suppressHydrationWarning>`.
- Header theme control is the animated sun/moon icon from shadcn-space toggle-01. It shows the sun in light and the moon in dark. A click switches to the other theme. Default stays **system** until that click. Admin can keep a Light / Dark / System menu later.
- Components use semantic tokens only (section 4a). No raw hex in components; `dark:` utilities only for exceptions.
- Logo: render both variants and switch with CSS (`dark:hidden` / `hidden dark:block`) so there is no flash.
- Product photos sit on a neutral light container in dark mode so white-background photos do not look boxed.
- The favicon follows the OS/browser theme, not the site toggle (section 4b).
- Every key page must pass axe in both themes.

### Language (Bangla / English)

- `next-intl`, routes `/en/...` and `/bn/...`, `localePrefix: "always"`. `/` redirects by `NEXT_LOCALE` cookie, then `Accept-Language`, then the default (English; changeable in `routing.ts`).
- Header language switcher is one toggle icon (languages glyph). It keeps the current page and query string; choice stored in the `NEXT_LOCALE` cookie. The accessible name is the target language written in that language ("EN" or "বাংলা").
- `<html lang>` per locale; wrap inline text in another language with `lang`. `hreflang` alternates plus `x-default` on every public page.
- UI strings in `src/messages/{en,bn}.json`, grouped by feature. `bun run i18n:check` fails CI when a key exists in one file only. No hard-coded user-facing strings in components.
- DB content uses `_en` / `_bn` columns; Bangla falls back to English when empty. Admin shows a "Missing Bangla" badge and a dashboard counter.
- All formatting goes through `src/lib/format.ts`: money with the ৳ symbol via `Intl.NumberFormat`, dates in `Asia/Dhaka`, numbers by locale (`bn-BD` shows Bangla digits).
- **Input normalization:** accept Bangla digits (০-৯) in phone, quantity and size fields; convert to ASCII digits before zod validation and storage.
- Fonts: Noto Serif Bengali is the only Bangla font (`next/font/google`, subset `bengali` only, variable, CSS variable `--font-bn`, `display: swap`). Apply it with `:lang(bn)`, with Inter as the fallback. `:lang(en)` and Latin letters always use Inter. Do not load Noto's latin subset, or English on `/bn` will switch to the serif face. Body line-height for Bangla is about 1.7.
- On `/bn`, **main and footer** type is at least **18px**. The html rem stays **16px** in both locales so the header does not jump. Header height is fixed (`h-16`); language and theme controls are a shared 32px box. Bangla `line-height: 1.7` applies to main and footer only.
- Search: Postgres has no Bangla stemmer, so use `pg_trgm` with `ilike` across both `_en` and `_bn` columns. Slugs stay English.
- Admin UI is English first (content fields are bilingual). A Bangla admin UI is a later option.

### Accessibility (target WCAG 2.2 AA)

- **Keyboard:** everything reachable and operable; visible focus ring (2px, `--focus`, 2px offset) in both themes; "Skip to content" link; dialogs trap focus, close on Esc and return focus.
- **Semantics:** landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page, correct heading order, `aria-current` on active nav item and wizard step.
- **Swatches and size options:** labelled radio group; selected state shown with a **check mark and the name**, never color alone.
- **Forms:** visible labels, required fields marked, errors linked with `aria-describedby`, error summary receives focus on failed submit, `autocomplete` attributes, `inputmode` on number and phone fields.
- **Custom Bag Builder:** on step change move focus to the step heading and announce "Step 3 of 7" in an `aria-live="polite"` region; Back/Next are real buttons; the live price summary is polite and throttled.
- **Feedback:** toasts for cart, quote and order events are also announced in an `aria-live` region.
- **Contrast:** text 4.5:1; large text and UI boundaries 3:1 (use `--input-border`, not `--border`, for inputs); verified in both themes.
- **Touch and motion:** targets at least 44x44px on mobile; respect `prefers-reduced-motion`; no auto-playing video with sound; videos have captions.
- **Images:** meaningful bilingual `alt`; decorative images `alt=""`; no text baked into images.
- **Zoom:** works at 200% text scale; layouts reflow down to 320px width.
- **Testing:** `@axe-core/playwright` on key pages in both themes and both languages (CI), plus a manual keyboard and screen-reader pass before launch.

---

## 4. Brand Tokens (golden palette; gold confirmed by owner, exact shades proposed)

Gold replaces orange. Use a **muted antique gold**, not bright yellow, so it reads premium. Never use gold as small text on light backgrounds (contrast too low); use `--gold-deep` there.

| Token           | Value     | Use                                                                      |
| --------------- | --------- | ------------------------------------------------------------------------ |
| `--brand`       | `#C8962E` | Primary buttons, icons, highlights. Put **ink text** on it (about 6.5:1) |
| `--brand-hover` | `#B07F1F` | Button hover (ink text still passes, about 4.9:1)                        |
| `--gold-deep`   | `#8A6414` | Gold text and links on light backgrounds (about 5:1 on ivory)            |
| `--gold-soft`   | `#F1E3B8` | Tints, badges, selected states                                           |
| `--ink`         | `#1C1917` | Text, dark sections, footer. Gold text on ink is fine (about 6.5:1)      |
| `--ivory`       | `#FBF8F1` | Page background                                                          |
| `--surface`     | `#FFFFFF` | Cards                                                                    |
| `--accent`      | `#1F5F4A` | Optional: success and "verified/trust" badges (white text about 7.5:1)   |

Dark mode values are in section 4a. Components use the semantic tokens there, not the raw palette above.

### 4a. Semantic tokens (light and dark)

| Token                | Light     | Dark      | Use                                               |
| -------------------- | --------- | --------- | ------------------------------------------------- |
| `--background`       | `#FBF8F1` | `#141210` | Page                                              |
| `--surface`          | `#FFFFFF` | `#1C1917` | Cards, dialogs                                    |
| `--foreground`       | `#1C1917` | `#FBF8F1` | Text                                              |
| `--muted-foreground` | `#6B645C` | `#A8A29E` | Secondary text (about 5.5:1 / 7.4:1)              |
| `--border`           | `#E7E0D3` | `#3A332E` | Decorative dividers only                          |
| `--input-border`     | `#8C8378` | `#78716C` | Input and control boundaries (3:1 or more)        |
| `--brand`            | `#C8962E` | `#C8962E` | Buttons, highlights                               |
| `--brand-foreground` | `#1C1917` | `#1C1917` | Text on gold                                      |
| `--gold-text`        | `#8A6414` | `#D9AE4F` | Gold text and links on the page (about 5:1 / 9:1) |
| `--focus`            | `#1C1917` | `#FBF8F1` | Focus ring                                        |
| `--accent`           | `#1F5F4A` | `#4FB08A` | Success, trust badges (about 7.5:1 / 7:1)         |

Re-verify contrast with the real components before launch.

### 4b. Logo and favicon assets

- Current logo **v1** files (rename when copying into `public/brand/`):
  - `prime-bag-factory-horizontal-ivory.svg` -> `logo-horizontal-on-light.svg`
  - `prime-bag-factory-horizontal-black-bg.svg` -> `logo-horizontal-on-dark.svg`
  - `prime-bag-factory-icon-ivory.svg` -> `logo-mark.svg`
  - `prime-bag-factory-favicon.svg` -> `favicon-source.svg` (ivory badge only; replace with the light/dark pair below)
- Still to produce: `icon-light.png`, `icon-dark.png`, `icon.svg`, `apple-icon.png` (180x180), `icon-192.png`, `icon-512.png`, and a fallback `src/app/favicon.ico`.
- **Light-mode favicon:** ink badge with gold mark. **Dark-mode favicon:** gold badge with ink mark. Same mark, same position.
- Wire them in the root layout metadata:

```ts
export const metadata = {
  icons: {
    icon: [
      { url: "/brand/icon-light.png", media: "(prefers-color-scheme: light)" },
      { url: "/brand/icon-dark.png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/brand/apple-icon.png",
  },
};
```

- Safari ignores the `media` switch, so keep the default `favicon.ico` as the fallback.

### 4c. Logo usage rules

- Header: horizontal logo for light backgrounds (ink wordmark). Footer and dark sections: horizontal logo for dark backgrounds (ivory wordmark).
- Below 24px logo height (small mobile header), show the **mark only**. Minimum widths: horizontal logo 120px, mark 16px.
- Clear space on all sides: 25% of the mark height.
- Do not recolor outside the section 4 tokens, add shadows or gradients, stretch, or rotate.
- The gold mark on ivory/white is only about 2.5:1 contrast. That is fine next to the wordmark, but never rely on the gold mark alone at small sizes on light backgrounds; use the ink-badge favicon version there.
- Always use alt text "Prime Bag Factory". Build one `<Logo variant="light" | "dark" | "mark" />` component in `src/components/site/logo.tsx` so every page uses the same source and a logo swap is a one-file change.

### 4d. Known logo v1 issues (owner is fixing the logo; swap the files when ready)

1. **Mark reads like a padlock** (narrow centered arch on a rounded box; the favicon has no stitch line at all). Make it read as a bag: widen the handle so its ends land near the body corners (tote-style) or use two handles, taper the body slightly (wider at the bottom), and keep the diagonal zipper/stitch line where size allows.
2. **Wordmark is live `<text>`** using DejaVu Sans/Arial, so it renders differently on other machines. Convert text to outlines in the final SVGs.
3. **Backgrounds are baked in** and the stitch cut-outs are painted in the background color. Export transparent versions with real cut-outs (masks).
4. **Horizontal artboard has a lot of empty space on the right.** Crop the viewBox to the content.
5. **Favicon exists only as an ivory badge.** Produce the light/dark pair from 4b plus PNG/ICO sizes.
6. Optional polish: "PRIME" and "BAG FACTORY" end at different x positions; adjust letter-spacing so both lines end together.
   Until v2 is ready, use v1 behind the `<Logo>` component as a placeholder.

---

## 5. Folder Structure

```
src/
  app/
    [locale]/
      (site)/
        page.tsx                      # home
        category/[...slug]/page.tsx
        product/[slug]/page.tsx
        product/[slug]/customize/page.tsx   # Custom Bag Builder wizard
        collections/[slug]/page.tsx
        search/page.tsx
        quote/page.tsx
        cart/page.tsx
        checkout/page.tsx
        order/[orderNo]/page.tsx
        about/ contact/ faq/ clients/ blog/ legal/
    (admin)/admin/
      page.tsx                        # dashboard
      categories/ products/ swatches/ inventory/ orders/ quotes/
      customers/ content/ users/ settings/
    sitemap.ts  robots.ts
  components/
    ui/ site/ admin/
      admin/
        shell/        admin-shell.tsx app-sidebar.tsx topbar.tsx breadcrumbs.tsx page-header.tsx command-palette.tsx
        data/         data-table.tsx filter-bar.tsx tabs-bar.tsx status-badge.tsx table-skeleton.tsx
        dashboard/    stat-card.tsx chart-card.tsx segment-bar.tsx radial-gauge.tsx activity-feed.tsx
        forms/        form-section.tsx sticky-save-bar.tsx bilingual-field.tsx confirm-dialog.tsx image-uploader.tsx
        catalog/      tier-editor.tsx swatch-picker.tsx swatch-chip.tsx
        print/        print-sheet.tsx
  lib/
    supabase/ client.ts server.ts admin.ts
    validators/   # zod schemas
    pricing.ts    # MOQ + quantity-range price helpers (mirrors place_order)
    utils.ts
    env.ts        # zod-validated environment variables
    format.ts     # Intl money/date/number helpers + Bangla digit normalization
    auth.ts       # requireRole() and session helpers
  server/         # server-only domain modules (catalog, orders, quotes, inventory, content, notifications, settings)
  i18n/           # next-intl routing + request config
  messages/ en.json bn.json
supabase/
  migrations/
  seed.sql
src/app/(admin)/admin/design-system/page.tsx   # dev/staging only, 404 in production, noindex
src/server/dashboard.ts                        # server-only DTOs for dashboard widgets
```

Admin is English only and lives outside `[locale]`.

---

## 6. Category Seed (our own structure, not a copy)

```
Delivery & Cold-chain Bags: Food & Pizza, Cake & Bakery, Grocery & Milk, Medicine & Pharmacy, Parcel & Courier, Ice Cream, Laundry, Catering
Corporate & Event Bags:     Seminar/Conference, NGO & Promotional, Gift Sets
Backpacks:                  Laptop/Office, School/University/Coaching, Kids, Travel/Hiking, Drawstring/Gym
Eco & Jute Bags:            Jute Backpacks, Jute Tote/Side, Promotional Jute
Leather:                    Office/Messenger, Wallets, Belts, Key Rings, Combo Gifts
Medical & Health:           First Aid, Medical Tools
Tote, Side & Cross-body:    Tote, Cross-body, Laptop Side, File/Document
Specialty:                  Pet Carrier, Thermal Bag
```

Everything is editable from admin. Seed this tree in `seed.sql` with English + Bangla names.

---

## 7. Data Model (Postgres / Supabase)

All tables have `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`. Use snake_case. Bilingual text columns use `_en` / `_bn` (bn falls back to en).

**Auth & staff**

- `profiles` (id = auth.users.id, full_name, phone, `role` enum: owner | manager | sales | inventory | customer)

**Catalog**

- `categories` (parent*id, slug unique, name_en, name_bn, description_en/bn, image_path, seo_title*_, seo*description*_, sort_order, is_active)
- `collections` (slug, name_en/bn, description, image_path, sort_order, is_active)
- `products` (slug unique, type enum buy*now|quote_only, title_en/bn, short_description*\_, description\_\_, specs jsonb, material, moq int not null default 1 (check >= 1), lead*time_days, stock_mode enum tracked|made_to_order, customization_enabled bool default false, status enum draft|published|archived, is_featured, seo*\*)
- `product_categories` (product_id, category_id, is_primary)
- `product_collections` (product_id, collection_id)
- `product_images` (product_id, variant_id nullable, path, alt_en, alt_bn, sort_order)
- `product_variants` (product_id, sku unique, swatch_id nullable (fabric swatch), color_name, color_hex, size, price_delta numeric default 0, stock_qty int, reserved_qty int default 0, low_stock_threshold int, is_active). `color_name` / `color_hex` are fallbacks when no swatch is linked. Selling price = range price + price_delta.
- `price_tiers` (product_id, min_qty, max_qty nullable, unit_price numeric). Constraints: first tier min_qty = product moq; contiguous, no overlap; only the last tier has max_qty null.
- `swatch_groups` (key unique e.g. fabric|zipper|puller|lining|webbing|piping|thread|print_ink, name_en/bn, sort_order)
- `swatches` (group_id, name_en/bn, code, color_hex, texture_image_path nullable, sort_order, is_active)
- `product_custom_parts` (product_id, key, label_en/bn, input_type enum swatch|select|dimensions|file|text, swatch_group_id nullable, is_required, price_delta numeric default 0, config jsonb (select options, dimension min/max and unit), help_text_en/bn, sort_order)
- `product_part_swatches` (part_id, swatch_id, is_default, price_delta nullable)

**Inventory (Option 2, built to extend)**

- `inventory_movements` (variant_id, delta int, reason enum: opening | purchase | sale | return | adjustment | damage | cancel_release, ref_type, ref_id, note, created_by)
- Available stock = `stock_qty - reserved_qty`. `stock_qty` is only changed through movements (trigger or RPC), never by direct edit.
- Later (not now): `suppliers`, `materials`, `purchase_orders`. Do not create them yet.

**Commerce**

- `shipping_zones` (name_en/bn, fee, free_over nullable, is_active)
- `orders` (order_no unique `PBF-YYMMDD-XXXX`, type enum retail|bulk, status enum: pending | confirmed | processing | shipped | delivered | cancelled | returned, payment_method default 'cod', payment_status enum: unpaid | partially_paid | paid | refunded, production_status enum nullable (bulk/custom only): awaiting_artwork | artwork_approved | in_production | qc | ready, idempotency_key text unique, courier_name, tracking_code, shipped_at, delivered_at, vat_amount, customer_name, customer_phone, customer_email, division, district, area, address_line, shipping_zone_id, subtotal, shipping_fee, discount, total, customer_note, admin_note, source_quote_id nullable)
- `order_items` (order_id, variant_id nullable, **snapshot** of title, sku, color, size, unit_price, qty, line_total, tier_min_qty, customization jsonb nullable)
- `order_status_history` (order_id, from_status, to_status, note, changed_by)
- `payments` (order_id, amount, method enum: cod | bkash_manual | nagad_manual | bank_transfer | cash, reference (trx id), received_at, recorded_by, note). `orders.amount_paid` and balance due are derived from this ledger.
- `notifications` (channel enum: email | sms | whatsapp | admin_alert, recipient, template, payload jsonb, status enum: pending | sent | failed, attempts, last_error, sent_at)
- `rate_limits` (key, window_start, count)
- `blocked_contacts` (type enum: phone | ip_hash, value, reason, created_by)
- `coupons` (code, type percent|fixed, value, min*subtotal, starts_at, ends_at, usage_limit, is_active) *(Phase 5, low priority)\_

**Quotes (RFQ)**

- `quote_requests` (source enum: form | builder, company_name, contact_name, phone, email, product_id nullable, category_id nullable, quantity, custom_size, custom_color, needs_logo_print bool, customization jsonb nullable, estimated_unit_price nullable, estimated_total nullable, needed_by date nullable, message, attachment_path, status enum: new | contacted | quoted | won | lost, quoted_amount, valid_until date nullable, assigned_to, internal_notes)

**Content**

- `site_sections` (page, key, content jsonb, sort_order, is_active) for homepage blocks, banners, stats
- `clients` (name, logo_path, sort_order, is_active)
- `gallery_items` (image_path, caption, sort_order)
- `testimonials` (name, company, rating, body_en/bn)
- `faqs` (question_en/bn, answer_en/bn, sort_order)
- `posts` (slug, title*\*, body*_, cover*path, status, published_at, seo*_)
- `legal_documents` (title, number, image_path) for trade license, TIN, BIN (owner supplies real files)
- `redirects` (from_path, to_path, status_code)
- `settings` (key unique, value jsonb) for company info, contact, social, VAT, WhatsApp
- `audit_logs` (actor_id, action, table_name, record_id, diff jsonb)

### RLS rules (must be written and tested)

- **anon**: `select` only on published/active catalog and content rows (including swatches, price tiers and custom parts of published products). No direct inserts on `orders` or `order_items`.
- **Checkout** goes through a `security definer` RPC `place_order(payload jsonb)` that, in one transaction: validates items and recomputes the quantity-range price from the DB (never trust client prices), enforces MOQ, checks `stock_qty - reserved_qty` (skipped for made-to-order), creates order + items, reserves stock, writes movements, returns `order_no`.
- **Quote submit**: server action with zod + honeypot + rate limit, inserts into `quote_requests` (the Custom Bag Builder uses the same action with `source = 'builder'`).
- **Staff**: helper `has_role(roles text[])`. owner = all; manager = all except users/settings; sales = quotes, orders, customers; inventory = products stock, inventory.
- **Storage**: bucket `product-media` (public read, staff write). Bucket `quote-attachments` (private; admin reads by signed URL; anon upload only through server action, max 5 MB, png/jpg/svg/pdf).

### Stock lifecycle

| Event                    | Effect                                                           |
| ------------------------ | ---------------------------------------------------------------- |
| Order placed             | `reserved_qty += qty`                                            |
| Order shipped            | `stock_qty -= qty`, `reserved_qty -= qty`, movement `sale`       |
| Cancelled before shipped | `reserved_qty -= qty`, movement `cancel_release`                 |
| Returned                 | `stock_qty += qty`, movement `return`                            |
| Manual change            | movement `adjustment` / `damage` / `purchase` with required note |

Low-stock: `available <= low_stock_threshold` shows in the admin dashboard. Products with `stock_mode = made_to_order` (all customizable products) skip stock checks and reservations.

---

## 8. Public Site Spec

**Header and footer (all pages):** logo, mega-menu, search, **language switcher (icon toggle)**, **theme toggle (active sun or moon icon, default system)**, Request a Quote button. Sticky WhatsApp and Messenger buttons. Footer: policy links (Terms, Privacy, Returns & Refunds, Shipping, Custom Order & Advance Payment), contact, social links, legal documents.

**Home** (order of sections): hero + primary CTA (Request a Quote) → shop by category → shop by industry → featured products → why choose us (real specs, not generic words) → client proof wall → real work gallery → how ordering works (steps) → trust documents → video → quote form → reviews → footer. Sticky WhatsApp button on all pages.

**Category page:** short intro (unique Bangla + English copy), filters (color, size, material, price for buy_now), grid, FAQ block, internal links to sibling categories.

**Product page:** gallery, fabric swatch chips and size selector, specs table, MOQ and lead time, **quantity-range price table with the active range highlighted** and live unit price/total, `Add to cart` (buy_now) and/or `Request a quote` (always), **`Customize this bag` (when customization is enabled)**, related products, JSON-LD.

**Quote page/form:** name, company, phone, email, product (prefilled if coming from a product), quantity, custom size, custom color, logo upload, message. Success state with expected response time and WhatsApp link.

**Custom Bag Builder:** wizard described in section 2c.

**Cart and checkout (COD):** guest checkout. The price of each product is recalculated from its total quantity in the cart (section 2a); quantity below MOQ is blocked. Fields: name, phone (BD format `^(?:\+?88)?01[3-9]\d{8}$`), division/district/area/address, note. Shipping zone fee from DB. Order summary, then confirmation page with order number. Show "we will call to confirm your order".

**SEO (non-negotiable):**

- `generateMetadata` on every page, unique title/description, canonical URLs, `hreflang` for en/bn.
- `app/sitemap.ts` built from DB (categories, products, collections, posts, static pages), `robots.ts`.
- JSON-LD: `Organization` / `LocalBusiness`, `BreadcrumbList`, `Product` (include `offers` only for buy_now; omit price for quote_only), `FAQPage`.
- ISR with `revalidateTag` fired from admin saves.
- `next/image` for all images, Supabase storage domain whitelisted, descriptive alt text in both languages.
- Cross-listed products get a single canonical URL `/product/[slug]`.

---

## 9. Admin Panel Spec (`/admin`)

Protected by Supabase Auth + middleware + RLS (never rely on UI hiding alone). Built with shadcn/ui, data tables with search, filter, sort, pagination.

| Module         | Must have                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard      | New quotes, pending orders, low-stock list, sales (7/30 days), missing Bangla translations counter                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Categories     | Tree view, drag to reorder, bn/en names, image, SEO fields, active toggle                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Products       | Tabs: **General** (type, bn/en content, specs, categories, collections, MOQ, lead time, stock mode), **Pricing** (quantity-range tier editor with validation and live preview), **Variants** (SKU, fabric swatch, size, price delta, stock), **Customization** (enable builder, define parts, allowed swatches per part, size limits, extra prices), **Images** (upload, reorder, alt text, per variant), **SEO**. Plus draft/publish, duplicate product, bulk status change, **CSV import/export** (products, variants, stock) and bulk image upload |
| Swatch Library | Manage swatch groups and swatches (name en/bn, code, hex, fabric texture photo), reorder, activate/deactivate, see which products use a swatch                                                                                                                                                                                                                                                                                                                                                                                                        |
| Inventory      | Variant stock list, available vs reserved, adjust stock (with reason and note), movement history, low-stock threshold, CSV export                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Orders         | List and filters, detail, status change with history, **record payments** (COD collected, advance, balance) with paid and balance due, courier and tracking code, **production status and artwork approval** (bulk/custom), confirmation-call status, block phone, admin note, printable invoice/packing slip                                                                                                                                                                                                                                         |
| Quotes         | Inbox with status pipeline and a `form` / `builder` filter, view attachment, assign to staff, add quoted amount and notes, builder requests shown with color chips and every selected part, **printable production spec sheet**, printable quotation (proforma) with validity date, **Convert to order** (creates `bulk` order), WhatsApp/phone quick links                                                                                                                                                                                           |
| Customers      | Derived from orders/quotes, grouped by phone, order and quote history                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Content        | Homepage sections, banners, clients, gallery, testimonials, FAQ, blog, legal documents, redirects                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Users          | Invite staff, assign role, deactivate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Settings       | Company info, contact numbers, WhatsApp/Messenger, social links, shipping zones, VAT, SEO defaults, feature flags (`cod_enabled`, `checkout_enabled`, `custom_order_mode`, `maintenance_mode`), notification channels, policy pages                                                                                                                                                                                                                                                                                                                   |
| Audit log      | Who changed what, when (read-only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

---

## 9c. Admin UI Design System

The admin looks like a calm, modern SaaS dashboard (see references) in our **antique gold + ink + ivory** identity. Gold is an accent, never a flood. The palette stays inside the section 4 family (gold, ink, ivory, forest green) plus red and amber for errors and warnings only; no blue anywhere. Admin is English only; content fields stay bilingual.

#### 9c.1 Principles

1. **Quiet chrome, loud data.** Neutral surfaces, 1px borders, almost no shadow. Gold marks the active nav item, the primary button, the selected state and the first chart series only.
2. **Information hierarchy per screen:** page title -> key numbers -> trend/charts -> work queue (tables) -> activity.
3. **Status is never color alone.** Every badge, delta and priority has an icon and a text label.
4. **Every list has loading (skeleton), empty (icon + one sentence + primary action) and error (message + Retry) states.**
5. **One kit.** Admin pages compose only the components in 9c.5. If a needed component is missing, add it to the kit first, show it on `/admin/design-system`, then use it.
6. **Both themes, always.** Every admin screen is checked in light and dark.
7. **Mobile works.** Staff will approve orders and quotes from a phone. Nothing requires hover.
8. **No emoji, no stock avatars, no decorative gradients.** Icons are `lucide-react` only, 16px in controls and nav, 20px in card headers, stroke 1.75, one outline style everywhere.

#### 9c.2 Tokens (add to `globals.css`, light and dark; components use these only, no raw hex)

Existing tokens from section 4a stay. Add:

Token
Light
Dark
Use

`--sidebar`
`#F4EFE4`
`#181513`
Sidebar background

`--sidebar-foreground`
`#1C1917`
`#FBF8F1`
Nav text

`--sidebar-muted`
`#6B645C`
`#A8A29E`
Group labels, inactive icons

`--sidebar-border`
`#E2DACA`
`#2E2823`
Sidebar dividers

`--sidebar-active`
`#FFFFFF`
`#26211D`
Active item pill (with 1px `--border` and shadow-xs in light)

`--surface-2`
`#F6F2E9`
`#211D1A`
Inset panels, table header, chart tray, skeletons

`--success` / `--success-soft`
`#1F5F4A` / `#E3F1EA`
`#4FB08A` / `#16302A`
Delivered, paid, won, positive delta

`--warning` / `--warning-soft`
`#8A5A00` / `#FBEBC8`
`#E5A93C` / `#3A2C10`
Pending, due soon, partial

`--ink-badge` / `--ink-badge-soft`
`#1C1917` / `#ECE6D8`
`#FBF8F1` / `#2A2521`
New, confirmed, shipped (derived from ink and ivory, no blue)

`--destructive` / `--destructive-soft`
`#B42318` / `#FDE7E4`
`#F97066` / `#3A1816`
Cancelled, failed, negative delta, delete

`--chart-1`
`#C8962E`
`#D9AE4F`
Primary series (gold)

`--chart-2`
`#3F3A36`
`#D6D3D1`
Second series (ink)

`--chart-3`
`#1F5F4A`
`#4FB08A`
Third series

`--chart-4`
`#8A6414`
`#F1E3B8`
Fourth series (gold-deep / gold-soft)

`--chart-5`
`#A8A29E`
`#78716C`
Remainder / "other"

`--radius-card`
`16px`

Cards

`--radius-control`
`10px`

Inputs, buttons, selects

Rules: soft tokens are backgrounds, solid tokens are text/icon on them (target 4.5:1; re-verify with real components). Dark mode has no shadows, only borders. Spacing follows a 4/8 rhythm: card padding 20px, grid gap 16px, section gap 24px, page gutter 24px (16px under 768px).

#### 9c.3 Typography (admin)

- Font: Inter. Bangla input fields get `lang="bn"` so `:lang(bn)` applies Noto Serif Bengali.
- Page title 24/32 semibold. Card title 14/20 medium. Stat value 28/32 semibold. Body and table 14/20. Meta/caption 12/16 (minimum text size in admin).
- All numbers, money and IDs use `tabular-nums`. Money: `৳` via `format.ts` (`en-BD`).
- Truncate long cells with `title` tooltip; never wrap table rows to 3+ lines.

#### 9c.4 Shell layout

```
+-----------+--------------------------------------------------------------+
| SIDEBAR   | TOPBAR: breadcrumb | search (Cmd/Ctrl+K) | bell | theme | user |
| 264px     +--------------------------------------------------------------+
| (rail 72) | PAGE: header (title, subtitle, actions) then content grid     |
+-----------+--------------------------------------------------------------+
```

- **Sidebar:** logo (mark only when collapsed), a workspace chip ("Prime Bag Factory", static, no switcher), grouped nav, footer user card (avatar initials, name, role, menu with Profile, Theme, Sign out). Collapsible to a 72px icon rail (tooltips on icons); state persisted in a cookie. Below 768px it becomes a `Sheet` opened from a hamburger in the topbar. Active item: `--sidebar-active` pill, `--gold-text` icon, `aria-current="page"`. Count badges are `--gold-soft` pills with text (e.g. 12 new quotes).
- **Nav groups and items (lucide icon, role gate):**

- MAIN: Dashboard (`LayoutDashboard`), all roles.
- CATALOG: Products (`Package`), Categories (`FolderTree`), Collections (`Layers`), Swatches (`Palette`); owner, manager, inventory (products only).
- SALES: Quotes (`FileText`, badge = new quotes), Orders (`ShoppingCart`, badge = pending), Customers (`Users`); owner, manager, sales.
- OPERATIONS: Inventory (`Boxes`, badge = low-stock variants); owner, manager, inventory.
- CONTENT: Content (`PanelsTopLeft`); owner, manager.
- SYSTEM: Users (`UserCog`), Settings (`Settings`), Audit log (`ScrollText`); owner (Settings and Users), owner and manager (Audit log).
- Quotes expands to sub-items: All, New, Builder requests, Won/Lost (like the Kravio Tickets group). Orders expands: All, Pending, In production, Shipped.
- **Topbar:** breadcrumbs (`Admin / Products / Edit`), search button opening the command palette (searches orders by number/phone, quotes by company/phone, products by title/SKU, plus quick actions like "New product"), notifications popover (new quotes/orders from `notifications` outbox `admin_alert`), theme toggle (same sun/moon control as the public site), user menu on mobile. Height `h-16`, sticky, `--background` with bottom border.
- **Page header:** `<PageHeader title description actions />`. Title is the single `h1`. Primary action top right. On mobile actions collapse to one primary button plus a `...` menu.
- **Content width:** fluid up to 1440px, centered beyond. Skip link and landmarks as in 3c. `noindex`.
- **Responsive:** >=1280 full layout; 768-1279 sidebar rail, stat cards 2x2, two-column rows stack; <768 sheet nav, single column, tables become stacked cards (see DataTable).

#### 9c.5 Component kit (`src/components/admin/`, shown on `/admin/design-system`)

Component
Spec

`AdminShell`, `AppSidebar`, `Topbar`, `Breadcrumbs`, `PageHeader`
As 9c.4

`StatCard`
Card with icon chip (`--surface-2`, 32px), label, value (28px), delta badge (arrow icon + `+7.1%` + "vs last week", success/destructive, never color-only), optional sparkline (SVG, 64x24, `--chart-1`, `aria-hidden` with the numbers also in text). Info tooltip icon is a real button with `aria-label`. Whole card is a link when it drills into a list (e.g. New quotes -> `/admin/quotes?status=new`).

`ChartCard`
Card header (icon, title, range `Select`), legend as real text chips, tray body on `--surface-2` is optional. Recharts bar + line combo with dashed gridlines, hover tooltip showing date and values (`Tue 584` style pill), y-axis in compact `৳` (10k, 1.2L). Includes a visually hidden data table for screen readers and an empty state.

`SegmentBar`
Horizontal stacked bar plus legend rows with counts (for orders by category, quotes by status). Each segment has a legend label and value, not just color.

`RadialGauge`
Optional, for fulfilment rate or quote win rate; the number sits in the center, same value in text.

`StatusBadge`
Pill, 12px/500, leading icon + label, `*-soft` background and solid text. Mapping table in 9c.6.

`DataTable`
`@tanstack/react-table` on shadcn table. Header on `--surface-2`; sticky header; sortable columns (button in header, `aria-sort`); row checkbox column; column visibility menu; pagination (10/25/50, "1-25 of 312"); row action `...` dropdown; URL-synced `page`, `sort`, `q`, filters via `searchParams`; selected-rows bar ("3 selected: Change status, Export, Clear") that appears above the table; row height 52px (44px min touch target for actions); horizontal scroll inside its own container with a sticky first data column; under 768px renders each row as a stacked card with the same actions. Skeleton rows while loading.

`FilterBar`
Search input (debounced 300ms), filter popovers (status, date range, source form/builder, assignee), active-filter chips with remove buttons, "Reset". Mirrors the Kravio filter button.

`TabsBar`
Pill tabs for Today / Yesterday / This week and for status pipelines (Quotes: New, Contacted, Quoted, Won, Lost with counts).

`ActivityFeed`
Vertical timeline with icon chips, title, one-line detail, relative time (`Intl.RelativeTimeFormat`), tab filter, "8 new activities today" header, search. Source: `audit_logs` plus `notifications`.

`EmptyState`, `ErrorState`, `TableSkeleton`, `CardSkeleton`
Skeletons match final dimensions (no layout shift).

`FormSection`
Two-column on desktop (label + help left, fields right), single column on mobile. Visible labels, errors via `aria-describedby`, error summary receives focus.

`StickySaveBar`
Appears when a form is dirty: "Unsaved changes" + Discard + Save (loading state, disabled while submitting). Blocks navigation with a confirm if dirty. Uses the `updated_at` optimistic check and shows a conflict dialog on mismatch.

`BilingualField`
EN / BN segmented tabs for any `_en` / `_bn` pair; "Missing Bangla" badge on the BN tab when empty.

`ConfirmDialog`
Required for delete, archive, cancel order, convert quote, block phone. Destructive style, names the object, focus on Cancel.

`TierEditor`
Table of rows (min, max, unit price) with auto-fill, inline validation, warning (not block) for price increases, live customer preview. Move up/down buttons for keyboard users.

`SwatchPicker`, `SwatchChip`
Round chips (texture or hex), checkmark + name for selected, labelled radio group.

`ImageUploader`
Drag-drop plus button, progress, client-side resize/WebP (about 300 KB), reorder (dnd-kit + buttons), alt text EN/BN per image, per-variant assignment.

`CommandPalette`
`cmdk` dialog, Cmd/Ctrl+K, grouped results (Pages, Orders, Quotes, Products, Actions).

`PrintSheet`
Print layout (A4) for invoice, packing slip, quotation, production spec sheet: no sidebar, black on white, logo on light, `@media print` rules, page-break control.

#### 9c.6 Status badge mapping

Domain
Value -> style (icon)

Quote
new -> ink (`Sparkles`), contacted -> neutral (`Phone`), quoted -> gold-soft with `--gold-text` (`FileCheck`), won -> success (`Trophy`), lost -> destructive (`XCircle`)

Order
pending -> warning (`Clock`), confirmed -> ink (`CheckCircle2`), processing -> gold-soft (`Loader`), shipped -> ink (`Truck`), delivered -> success (`PackageCheck`), cancelled -> destructive (`Ban`), returned -> warning (`Undo2`)

Payment
unpaid -> neutral (`CircleDashed`), partially_paid -> warning (`CircleDot`), paid -> success (`BadgeCheck`), refunded -> neutral (`RotateCcw`)

Production
awaiting_artwork -> warning (`ImageUp`), artwork_approved -> ink (`Check`), in_production -> gold-soft (`Factory`), qc -> ink (`ScanSearch`), ready -> success (`PackageCheck`)

Product
draft -> neutral, published -> success, archived -> neutral outline

Stock
ok -> success, low (`available <= threshold`) -> warning (`AlertTriangle`), out -> destructive

Urgency (quotes by `needed_by` / `valid_until`)
overdue -> destructive (`AlarmClock`), due in <=2 days -> warning, later -> neutral. Shown like the priority column in the Kravio table

#### 9c.7 Dashboard (`/admin`) spec

Header: **"Hello, {firstName}"** (text only, no emoji), subtitle "Here is what needs attention today", range `Select` (Last 7 days default, Last 30 days) and a primary `New product` button.

```
Row 1  [Stat: New quotes] [Stat: Pending orders] [Stat: Sales BDT] [Stat: Low-stock variants]   (3 cols each of 12)
Row 2  [ChartCard: Sales and quotes trend (8)        ] [SegmentBar card: Quote pipeline (4)   ]
Row 3  [DataTable card: Recent orders (8)            ] [ActivityFeed: Latest updates (4)      ]
Row 4  [DataTable card: Quotes needing action (8)    ] [Low-stock list (4)                    ]
Strip  Missing Bangla translations: N items [Review]   (alert style, links to content filter)
```

Widget
Data (via `src/server/dashboard.ts`, typed DTOs)

New quotes
count of `quote_requests` with `status = 'new'` in range, delta vs previous period, 7-point sparkline

Pending orders
count `orders.status = 'pending'`, delta, sparkline

Sales
sum `orders.total` where status not in (cancelled, returned), delta, sparkline

Low-stock variants
count `stock_qty - reserved_qty <= low_stock_threshold` on tracked products; links to Inventory filtered

Sales and quotes trend
bars = daily sales total (`--chart-1`), line = daily new quotes (`--chart-2`), legend, tooltip, hidden data table

Quote pipeline
segments new / contacted / quoted / won / lost with counts and win rate

Recent orders
last 5: order no, customer, date, total, status badge, row action; "View all"

Quotes needing action
`new` or `quoted` quotes ordered by urgency; columns: Company, Product, Qty, Source (form/builder), Assigned to, Status, Urgency

Latest updates
last 20 audit/notification events with Today / Yesterday / This week tabs

Low-stock list
variant SKU, product, available, threshold, "Adjust" link

Missing Bangla
count of `_bn` empty fields on published rows

Until Phase 5, orders and sales widgets show `EmptyState` ("No orders yet. Orders appear here after the first checkout."), not fake data. Seed/demo data is allowed only in `seed.sql` for local dev.

#### 9c.8 Module page layouts (all built from the kit)

Page
Layout

Products list
PageHeader (New product, Import CSV, Export), TabsBar (All, Published, Draft, Archived with counts), FilterBar (category, type, stock, customizable), DataTable (thumbnail, title EN + BN subline, type badge, categories, MOQ, price range, stock, status), bulk bar (Publish, Archive, Export)

Product editor
Header with status badge + Publish split button + Preview link; left tab list or top tabs (General, Pricing, Variants, Customization, Images, SEO); content in `FormSection`s; `StickySaveBar`; right rail (desktop) with checklist: title EN/BN, price tiers valid, >=1 image, SEO set, Bangla complete

Categories
Left tree (drag + move buttons), right editor panel; mobile: list then detail page

Collections
DataTable + side `Sheet` editor

Swatch Library
Groups as tabs; grid of `SwatchChip` cards with name, code, usage count; `Sheet` editor with texture upload

Inventory
StatCards (Total variants, Low stock, Out of stock, Reserved units), DataTable (SKU, product, available, reserved, threshold, status) with inline "Adjust" dialog (delta, reason, required note) and a Movements tab

Orders list
TabsBar by status with counts, FilterBar (date, payment, type retail/bulk, production), DataTable (order no, customer + phone, type, items, total, paid / balance, status, payment, date)

Order detail
Two columns: left items table + payments ledger + status timeline (`order_status_history`); right summary card (customer, address, courier + tracking, production status, confirmation-call toggle), actions (Change status, Record payment, Print invoice, Packing slip, Block phone)

Quotes inbox
TabsBar pipeline (counts), FilterBar (source form/builder, assignee, urgency), DataTable, row opens detail

Quote detail
Left: contact card, request details, builder selections as color chips + part list, attachment viewer; right: status stepper, assign, quoted amount, valid-until, internal notes; actions: Print production spec, Print quotation, Convert to order, WhatsApp, Call

Customers
DataTable grouped by phone, detail drawer with orders + quotes history

Content
Left list of content types, right `FormSection` editors; homepage sections have reorder + active toggle — **REMOVED by owner 2026-10-18: not built; assets are managed via media uploads in the editors (see Decision Log)**

Users
DataTable, Invite `Sheet`, role select, deactivate with `ConfirmDialog`

Settings
Vertical tabs (Company, Contact, Social, Shipping zones, VAT, SEO defaults, Feature flags, Notifications, Policies); flags use `Switch` with description and a confirm for `maintenance_mode`

Audit log
Read-only DataTable (when, actor, action, table, record), diff viewer in a `Sheet`, FilterBar

Login (`/admin/login`)
Centered card, logo, email + password, error summary, MFA step for owner/manager, no signup

#### 9c.9 Interaction and motion

- Transitions 150-200ms, `ease-out`, only on color, opacity and transform. Respect `prefers-reduced-motion` (disable chart animations, sidebar slide becomes instant).
- Buttons with async work disable and show a spinner; mutations use optimistic UI where safe and roll back with an error toast.
- Toasts: Sonner, also announced in `aria-live="polite"`; destructive actions offer Undo where possible.
- Keyboard: Cmd/Ctrl+K palette, `/` focuses table search, Esc closes dialogs/sheets, focus returns to trigger, visible 2px `--focus` ring everywhere.
- Hover is enhancement only; every hover reveal also works on focus and tap. Cursor pointer on clickable rows.
- Tables and forms never lose input on error.

#### 9c.10 Admin UI acceptance checklist (every admin page, before ticking its task)

- [ ] Uses only kit components and semantic tokens; no raw hex, no emoji, no new icon family.
- [ ] Loading, empty and error states present; no layout shift when data arrives.
- [ ] Checked at 375, 768, 1280 and 1440 px; no horizontal page scroll; tables scroll inside their container or become cards.
- [ ] Light and dark verified; axe clean in both.
- [ ] Contrast: text 4.5:1, borders/controls 3:1, status never color-only.
- [ ] Keyboard-only walkthrough works; focus order matches visual order; icon-only buttons have `aria-label`; one `h1`.
- [ ] Touch targets at least 44x44 px on mobile; 8px minimum gap between targets.
- [ ] Role gating enforced server side (`requireRole()`) and in nav.
- [ ] Destructive actions use `ConfirmDialog`; forms validate with zod on client and server.
- [ ] Money, dates, numbers formatted through `format.ts` (`Asia/Dhaka`).

---

## 9b. Launch Readiness (e-commerce essentials, do not skip)

| Area                    | Must be ready at launch                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Policies                | Terms, Privacy, Returns & Refunds, Shipping/Delivery, and Custom Order & Advance Payment (custom items are made to order and not returnable; advance %, lead time, artwork approval), in both languages, linked in footer and checkout                                                                                                                                                                                  |
| Payments                | COD for retail. Custom/bulk orders need an **advance**: record manual bKash/Nagad/bank payments in the `payments` ledger, show paid and balance due, status `partially_paid`                                                                                                                                                                                                                                            |
| Delivery                | Courier name and tracking code on the order (manual entry at launch), shipping zones, delivered date, failed-delivery and return handling                                                                                                                                                                                                                                                                               |
| Order flow              | Idempotency key (no duplicate orders on double tap), confirmation-call status, phone/IP blocklist, order lookup by order number + phone                                                                                                                                                                                                                                                                                 |
| Custom orders           | Artwork approval and `production_status`, printable quotation with validity date, production spec sheet                                                                                                                                                                                                                                                                                                                 |
| Notifications           | Admin alert for every new order and quote (email now, WhatsApp click-to-chat link). Customer confirmation on the order page, plus email if provided; SMS provider later. All through the `notifications` outbox                                                                                                                                                                                                         |
| Tax and invoice         | Decide whether prices include VAT; invoice and quotation show business name, address, BIN, VAT line and order number                                                                                                                                                                                                                                                                                                    |
| Marketing and analytics | GA4 ecommerce events (`view_item`, `add_to_cart`, `begin_checkout`, `purchase`, `generate_lead` for quotes); Meta Pixel (Facebook is the main channel in Bangladesh; add Conversions API later); Search Console; Google Business Profile with `LocalBusiness` schema and map link; Open Graph/Twitter tags with product image for Facebook and WhatsApp sharing; Facebook page link plus Messenger and WhatsApp buttons |
| Catalog loading         | Admin CSV import/export for products, variants and stock, plus bulk image upload, so about 200 products can be loaded without typing each one                                                                                                                                                                                                                                                                           |
| Performance             | Mobile 4G target: LCP under 2.5s on home and product pages; WebP images resized on upload (about 300 KB max); dynamic-import the builder; Bangla font subset                                                                                                                                                                                                                                                            |
| Infra and ops           | Separate staging and production Supabase projects; production on paid plans (check current limits: Vercel Hobby is for non-commercial use, Supabase free projects pause when inactive and have no managed backups); regions near Bangladesh; daily backups verified by a test restore; uptime check; error monitoring                                                                                                   |
| Security                | MFA (TOTP) for owner and manager; CSP and security headers; upload validation; rate limits; RLS tests; no PII in logs                                                                                                                                                                                                                                                                                                   |
| Business email and DNS  | `info@` mailbox on the domain; SPF, DKIM and DMARC for any email sender                                                                                                                                                                                                                                                                                                                                                 |

---

## 10. Phases and Tasks

### Phase 0: Setup

- [x] Remove default `create-next-app` page content in `src/app/page.tsx`.
- [x] Add brand tokens (section 4) to `globals.css`; set fonts (Inter + Noto Serif Bengali).
- [x] Copy logo v1 assets into `public/brand/` (section 4b), build the `<Logo>` component (section 4c), wire favicon metadata (use the ivory favicon as a temporary fallback until the light/dark pair exists).
- [x] Init shadcn/ui; add base components (button, input, form, dialog, table, tabs, badge, toast, dropdown, sheet).
- [x] Create Supabase project, add env vars, `.env.example`.
- [x] Add Supabase clients (`client.ts`, `server.ts`, `admin.ts`).
- [x] Set up `next-intl` with `/en` and `/bn`, the language switcher, `format.ts` helpers and the `i18n:check` script (section 3c).
- [x] Set up `next-themes`, light/dark semantic tokens (4a) and the theme toggle with no flash on load.
- [x] Accessibility base: skip link, focus ring, landmarks, reduced-motion styles (section 3c).
- [x] Create `src/lib/env.ts` (zod-validated env), the `src/server/` folder with `server-only`, and a `requireRole()` stub (section 3b).
- [x] Tooling: Vitest, Playwright + axe, GitHub Actions CI (lint, typecheck, unit tests, build, i18n check, e2e).
- [x] Update `AGENTS.md` with the rules from section 0 and the conventions in section 12.
- **Done when:** app runs, tokens work in light and dark, `/en` and `/bn` render a placeholder home, theme toggle and language switcher work with no flash, CI is green.

### Phase 1: Database, auth, RLS

- [x] Write migrations for all tables in section 7 (except coupons).
- [x] Add enums, indexes (slugs, foreign keys, status columns), `updated_at` triggers.
- [x] Write RLS policies and `has_role()`.
- [x] Write `place_order` RPC and inventory movement logic.
- [x] `seed.sql`: categories (section 6), swatch groups and sample swatches, one demo product with variants, quantity ranges and builder parts, shipping zones, settings.
- [x] Generate TypeScript types from the DB.
- [x] Auth: staff login page, `src/proxy.ts` protection for `/admin`, server-side role gate, and first-owner provisioning script.
- [x] Provision the first owner in Supabase with `bun run owner:setup -- <auth-user-id> "Full name"`.
- [x] Apply the forward auth/order migration and run the Phase 1 pgTAP tests against the configured Supabase database.
- **Done when:** generated types match the DB; the first owner can log in and `/admin` rejects unauthenticated and customer sessions; RLS tests prove anon cannot read drafts or write orders directly, and `place_order` blocks overselling.

### Phase 2: Admin catalog

- [x] Add admin tokens from 9c.2 to `globals.css` (light and dark) and verify contrast.
- [x] Install the shadcn components and libraries listed in A1.
- [ ] Build the kit components from 9c.5 with typed props and the `/admin/design-system` page showing every component, every status badge and every state in both themes. _(Base kit + dashboard widgets done — status badges, states, skeletons, StatCard, SegmentBar, RadialGauge, ChartCard, ChartSkeleton, ChartRangeMenu, ActivityFeed, TabsBar, FormSection, BilingualField, ConfirmDialog, StickySaveBar, SwatchChip/Picker, PageHeader. Still built just before their consuming pages: DataTable, FilterBar, ImageUploader, TierEditor, CommandPalette record-search, PrintSheet.)_
- [ ] Admin shell: sidebar (collapsible, role-aware, count badges), topbar, breadcrumbs, command palette, mobile sheet nav, login page layout. _(Sidebar, topbar, breadcrumbs, command palette, mobile sheet + mobile user menu, providers and login layout done. Sidebar count badges use a `counts` prop but stay empty: wiring them means a per-page count query in the protected layout, deferred until the Quotes/Orders/Inventory pages exist.)_
- [x] Dashboard (9c.7) with `src/server/dashboard.ts`, skeletons, empty and error states. _(Real queries for new quotes + delta + sparkline, quote pipeline, quotes needing action, low stock, activity feed and the Missing Bangla count; sales/pending-orders/recent-orders widgets show EmptyState until Phase 5. Route-level `loading.tsx` skeleton; `fatal` DB-unreachable shows an ErrorState with retry; per-role RLS gaps degrade to empty states.)_
- [x] Playwright + axe for `/admin/login`, `/admin`, `/admin/design-system` (and `/admin/categories`) in light and dark. _(Authenticated run GREEN: 33/33. `auth.setup.ts` logs a staff user in from `E2E_STAFF_EMAIL`/`E2E_STAFF_PASSWORD` and writes storageState; `a11y-admin.spec.ts` runs 32 combos (4 pages × light/dark × 375/768/1280/1440) **serially** (parallel workers raced the Supabase SSR session-cookie refresh → ECONNRESET); `a11y-public.spec.ts` covers `/admin/login`. The pages are `/admin`, `/admin/design-system`, `/admin/categories` and `/admin/collections`. The run surfaced several systemic kit issues that were fixed — see the 2026-10-17 Decision Log entries. Note: two PUBLIC-site tests still fail (`/bn` home text <18px; language switcher dark contrast) — pre-existing, outside Phase 2 admin, logged for the public pass.)_
- **Done when (UI kit):** the dashboard renders on real queries, passes 9c.10 at all four widths in both themes, and staff can navigate every module stub with keyboard only.

Then continue with the existing Phase 2 tasks (Categories CRUD, Collections, Media upload, Swatch Library, Products CRUD, Customization tab), each page built from the kit and checked against 9c.8 and 9c.10.

- [x] Admin layout (sidebar, topbar, breadcrumbs, role-aware nav). _(Built with the admin shell in the UI-kit task above.)_
- [x] Categories CRUD (tree + reorder). _(Two-pane `/admin/categories`: left `CategoryTree` with dnd-kit drag **and** keyboard Move up/down; right `CategoryEditor` (BilingualField name/description/SEO, auto slug, parent select excluding self+descendants, active switch, path field for the future Media picker). Reads via `src/server/categories.ts`; writes in `categories/actions.ts` — `saveCategory`/`deleteCategory`/`reorderCategories`, each zod-validated + `requireRole(['owner','manager'])`, unique-slug suffix, children reparented on delete, FK-in-use handled. Loading skeleton added; `/admin/categories` is in the authed a11y matrix.)_
- [x] Collections CRUD. _(Plan 9c.8 "DataTable + side Sheet editor". First consumer of the two deferred kit components: `DataTable` (`@tanstack/react-table` over the shadcn table — sortable headers with `aria-sort`, sticky header, 10/25/50 page-size, "a–b of N" range + prev/next, dedicated horizontal-scroll container, stacked cards below `md`, skeleton + empty states, URL-synced `sort`/`dir`/`page`/`size`/`q`) and `FilterBar` (debounced 300ms search + clear + reset + filter slot). `/admin/collections` reads via `src/server/collections.ts` (all rows + a `product_collections(count)` linked-product count); writes in `collections/actions.ts` — `saveCollection`/`deleteCollection`, each zod-validated (`src/lib/validators/collection.ts`) + `requireRole(['owner','manager'])`, unique-slug suffix, delete relies on the `on delete cascade` join so products just drop the tag. Editing happens in a right-hand `Sheet` (bilingual name/description, auto slug, sort order, active switch, path field for the future Media picker, `ConfirmDialog` delete). Loading skeleton added; `/admin/collections` is in the authed a11y matrix — 33/33 GREEN.)_
- [x] Media upload component (Cloudinary, image compression/resizing on upload). _(Owner switched media from Supabase Storage to **Cloudinary**. `src/lib/cloudinary.ts` is server-only (lazy `CLOUDINARY_URL`), uploads via `upload_stream` and stores an auto-format/auto-quality resized URL. `media/actions.ts` gates with `requireRole(['owner','manager'])` + zod (fixed folder enum, PNG/JPG/WebP/AVIF, 5 MB). Kit `ImageUploader` (drag/drop + click, preview/replace/remove, idle/uploading/error states) wired into the Category + Collection editors, replacing the old path fields; demoed on `/admin/design-system`. `next.config.ts` whitelists `res.cloudinary.com`. Authed axe **33/33** with the uploader on design-system.)_
- [x] Swatch Library CRUD (groups, swatches, texture photo upload). _(Plan 9c.8 "Groups as tabs; grid of SwatchChip cards ... Sheet editor with texture upload". `/admin/swatches`: one server read (`listSwatchLibrary`) loads every group with its swatches nested + a per-swatch usage count (tallied from `product_variants` and `product_part_swatches`, since `product_variants.swatch_id` has no FK so PostgREST can't embed it); client selects the group tab (with a first-group fallback, no setState-in-effect). Two `Sheet` editors (`SwatchGroupEditor`, `SwatchEditor`) write via `swatches/actions.ts` — `saveSwatchGroup`/`deleteSwatchGroup`/`saveSwatch`/`deleteSwatch`, each zod-validated (`validators/swatch.ts`) + `requireRole(['owner','manager'])`; group `key` is unique (duplicates rejected, not suffixed), deletes are blocked when a swatch/group is in use, group delete cascades its swatches. Texture photo uses the Cloudinary `ImageUploader` (folder `swatches`). Loading skeleton + empty states. **Schema gap fixed:** `swatch_groups` had only a public read policy — added `supabase/migrations/202610180001_phase2_swatches_rls.sql` granting staff write (owner/manager/inventory) mirroring `swatches`; run `supabase db push` before creating groups. Authed axe **41/41** (added swatches).)_
- [x] Products CRUD with tabs: general, pricing (MOQ + quantity-range editor with validation), variants (swatch link, price delta, stock), images, categories, collections, SEO. _(Plan 9c.8 "list + tabbed editor". `/admin/products` list: status tabs (all/published/draft/archived) as URL `?status` links with counts, `FilterBar` (debounced `q`) + client type/custom/stock/category filters over the loaded rows, `DataTable` (sortable title, price range, stock tone badge, status badge), row selection with bulk Publish/Archive (`bulkSetProductStatus`), and a CSV Export (Blob download — the plan's "Import CSV" is deferred; only export shipped). New product is a minimal draft step (`/admin/products/new` → `createProduct`) so children get a `product_id`, then redirects into the tabbed editor `/admin/products/[id]` (`?tab=` deep-link, ARIA tablist/tab). Tabs each own a slice and save independently via `router.refresh()` + `revalidatePath`: **general** (bilingual title/short/full desc, selling type, stock mode, MOQ, lead time, material, customization/featured switches, auto-slug), **pricing** (MOQ + the new `TierEditor` kit component — quantity-range rows with live overlap/gap/price-rise warnings and min/max/price errors), **variants** (SwatchChip picker fed from `listSwatchLibrary`, auto-fill color name/hex, SKU, size, price delta, tracked-only stock fields, active switch), **images** (Cloudinary `ImageUploader` folder `products`, bilingual alt, linked variant, reorder, first = thumbnail), **relations** (category checkboxes + one primary radio, collection checkboxes), **seo**. Header Publish/Archive + `ConfirmDialog` Delete; right-rail "Publish checklist". Reads via `src/server/products.ts` (`listAdminProducts`/`countProductsByStatus`/`getAdminProduct`/`listRelationOptions`); writes in `products/actions.ts` — every action `requireRole(['owner','manager','inventory'])` + zod (`validators/product.ts`), replace-semantics (delete-then-insert) for children, unique-slug suffix, global-SKU de-dup (Postgres `23505` → friendly error), max-1-primary guard. typecheck/lint/build green; authed axe **56/56** (added `/admin/products` + `/admin/products/new`).)_
- [x] Customization tab: enable builder, define parts, allowed swatches, size limits, extra prices. _(5th editor tab, gated by `customization_enabled`. `CustomizationTab` builds `product_custom_parts` rows: part key (snake/kebab), label bilingual, input type (`swatch|select|dimensions|text|file`), extra price, required switch, help text; per-type config — `swatch` picks a swatch group + allowed swatches (checkbox list with a default radio) + optional per-swatch price delta, `select` takes one option per line, `dimensions` takes min/max width/height, all stored in the `config` jsonb. Saved via `saveCustomParts` (replace: delete parts → cascade `product_part_swatches` → re-insert returning ids → de-dup allowed swatches). No new schema (child write RLS already present from Phase 1).)_
- **Done when:** staff can create a complete product with 8 color variants, quantity ranges (e.g. 5-50 and 51-100 pcs) and builder options, then publish it. _(Met: the New → editor flow supports a draft with N variants added one-by-one in the variants tab, arbitrary quantity ranges via `TierEditor`, builder parts via the customization tab, and Publish/Archive in the header. Verified against the live Supabase DB; both product routes reached in the authed axe run.)_

### Phase 3: Public catalog + quote (soft-launch milestone)

- [x] Site layout (header, mega menu from DB categories, footer, language switch, WhatsApp button). _(Site shell under `src/app/[locale]/(site)`: sticky header with logo, DB-driven category mega-menu, search, icon language switcher (`nav.*`), animated sun/moon theme toggle (toggle-01), Request-a-Quote CTA, mobile `Sheet` nav; footer with policy/contact/social columns; floating WhatsApp launcher in an `<aside data-sticky-contact aria-label>` landmark. Brand tokens only, no hex.)_
- [x] Home, category, collection, product, search pages. _(Home composes hero → featured → categories → collections → why. Category/collection/product detail resolve a slug at request time, so each streams behind a `<Suspense>` shell (Partial Prerender); skeletons are plain `<div>`s so the streamed `<main id="main">` stays the single landmark. Search uses `pg_trgm` `ilike` across `_en`/`_bn`, URL-synced `q`. All read via cached `src/server/catalog.ts` queries.)_
- [x] Quote form + server action + file upload + success page. _(`quote` namespace form (name/company/phone/email/product/qty/size/color/message + logo upload), zod on client and server, BD-phone + Bangla-digit normalization, honeypot spam guard; writes via service-role admin client (public quote has no anon insert policy) in a server action; success state shows response time + WhatsApp link. Uploads to Cloudinary via `/api/upload-signature`.)_
- [x] Product page: swatch chips, MOQ-aware quantity input, quantity-range table with live price. _(Interactive `ProductConfigurator` client island: swatch/size radios show check + name (never color alone), MOQ-floor quantity input, quantity-range table highlights the active tier with live unit price and total via `format.ts`; CTA `Add to cart` (buy_now) and `Request a quote` (always) plus `Customize this bag` when enabled.)_
- [x] Custom Bag Builder wizard (section 2c) that submits a `builder` quote request. _(Multi-step wizard, focus moves to the step heading with `Step n of N` announced politely, draft persisted, part/swatch/size/price snapshot captured, submits a `builder`-kind quote request; server-validated with zod, never trusts client prices.)_
- [x] Static pages: about, contact, FAQ, legal documents, clients. _(All under `[locale]`, bilingual from `src/messages`; FAQ emits `FAQPage` JSON-LD; footer nav links every one.)_
- [x] SEO: metadata, sitemap, robots, JSON-LD, hreflang. _(`generateMetadata` + `buildMetadata` on every page (canonical + `hreflang` alternates + `x-default`); `app/sitemap.ts` from DB (products with `lastModified`, categories, collections, static pages × both locales, prerendered at build); `app/robots.ts`; JSON-LD — site-wide `Organization`, `BreadcrumbList` (product Home›Category›Product, category, collection), `Product` (`offers` only for buy_now, price omitted for quote_only), `FAQPage`. ISR `revalidateTag` fires from admin saves.)_
- [ ] Performance pass (Lighthouse mobile 90+ on home and product). **DEFERRED by owner 2026-10-18** — resume before/at Phase 6 (polish); Phase 3's feature-based _Done when_ (catalog + quote + builder on real data) is already met, so this is a quality gate only. _Code-side perf is in: `next/image` everywhere with explicit `sizes`, Cache Components + Partial Prefetching (static shell streams, dynamic islands hydrate on arrival), server components by default, `unstable_cache` on catalog reads. The gate is wired: `scripts/lighthouse-check.ts` (`bun run perf:lighthouse`) audits `LIGHTHOUSE_PATHS` (default `/en,/en/quote`) against a live server, and a CI `lighthouse` job runs it on the production build at threshold 90 (a clean CI runner is the source of truth). **Optimizations landed this pass (measured on local `next start`, mobile preset):** (1) dropped `motion`/framer-motion — reimplemented the header sun/moon toggle with CSS transitions (`toggle-01.tsx` + `.theme-toggle` block in `globals.css`), reduced-motion still honored by the global media rule; (2) `experimental.inlineCss: true` in `next.config.ts` — the small atomic/Tailwind sheet is now inlined, eliminating the ~450ms render-blocking CSS request (render-blocking count 0); (3) removed `priority` from `ThemeLogo` — the two large header-image srcSet preloads (light+dark, one always `display:none`) no longer compete with the real LCP and critical JS. **Current scores:** home **91** (now reliably passes, 4/4 runs); product **~85** (82–87, still under bar). **Next lever for product (diagnosed, not yet done):** web fonts are the largest resource (~235 KiB on `/en`, > JS), and the LCP is *text* — `display:"swap"` makes the font substitution delay the text LCP under 4× CPU throttle. Try `display:"optional"` for `Inter` and/or stop loading the `Noto_Serif_Bengali` subset on `/en` (it is only referenced by `:lang(bn)` rules but is still preloaded from the shared `[locale]` layout). Also revisit `LIGHTHOUSE_PATHS` to `/en,/en/product/[slug]` (the plan's required pages) once CI has real catalog data._
- **Done when:** site works as a catalog plus quote plus custom-builder site on real data.

### Phase 4: Admin quotes + content

- [x] Quotes inbox, detail, status pipeline, assignment, notes, attachment view, builder-request view with color chips, printable production spec sheet and printable quotation (validity date). _(Inbox `/admin/quotes`: server-side status tab links with counts + client-side source/assignee filters + `DataTable` (URL-synced q/sort/dir/page/size), mobile cards, loading skeleton. Detail `/admin/quotes/[id]`: contact card, request details, builder selections with `ColorChip` (name + hex + label, never color alone), artwork attachment viewer, 5-step status pipeline buttons (`aria-current="step"`, Check icon + label), assignment Select (owner/manager/sales), quoted amount / valid-until / internal notes form with `useActionSave`. Mutations in `admin/quotes/actions.ts` — `requireRole([owner,manager,sales])` + zod (`validators/quote-admin.ts`), matching the RLS already granted in Phase 1 (no new migration). Print routes `/admin/print/quotes/[id]/{spec,quotation}` built on new kit `print/print-sheet.tsx` (A4 `@page`, letterhead from `settings.company`, no admin chrome). Seed: 2 demo quotes (form + builder). Gates: typecheck/lint/build green, authed axe **65/65** (8 pages, `/admin/quotes` added). See Decision Log 2026-10-18.)_
- [x] Notification on new quote (email or WhatsApp link; provider TBD with owner). _(Owner decision 2026-10-18: Resend email to the company address + WhatsApp handoff to the env number + in-app bell. See Decision Log.)_
- ~~Content admin: homepage sections, clients, gallery, testimonials, FAQ, legal docs, blog, redirects.~~ _(Built and shipped in `051bb06`, then **removed entirely by owner instruction 2026-10-18** — "no need the content route anymore… we just need to manage all assets, can be upload and can be use in the product add new etc." Marketing content will not have an admin UI; image assets are handled by the existing `ImageUploader` flows in the product/category/collection/swatch editors. See Decision Log.)_
- **Done when:** owner can run the marketing content and handle quotes without a developer. _(Owner 2026-10-18: the content-admin half is dropped — quotes and asset uploads are what's needed.)_

### Phase 5: Commerce (COD)

- [x] Cart (client state, persisted), stock check on add (skipped for made-to-order), MOQ enforcement and quantity-range pricing across the cart. _(See Decision Log 2026-10-18 “Phase 5 task 1 — cart”: `lib/pricing.ts` mirrors `place_order`, the store keeps only `{variant_id, qty}`, and the server re-hydrates every number through the `loadCart` action.)_
- [x] Checkout form + `place_order` RPC + confirmation page + order lookup by order number and phone. _(Owner policy 2026-10-18: checkout is COD with a **50% advance** collected/recorded at order time — see Decision Log. Written order flow lives in `checkout/actions.ts` → the anon-granted RPC only; money never leaves the browser, and `/order/[orderNo]` needs number **and** phone. Advance *recording* is task 5-3.)_
- [x] Admin orders: list, detail, status history, mark paid, notes, invoice/packing slip print view. _(Built and gated — see Decision Log 2026-10-18 “Phase 5 task 3”. `/admin/orders` list + `/admin/orders/[id]` detail + two print views, zod validators, 48 unit tests, public suite **85/85** and authed admin suite **75/75** (8 new `/admin/orders` axe combos + 2 orders feature tests). `202610180002_phase5_order_fulfilment.sql` is **applied to the linked project** and both RPCs were exercised against the real order **PBF-261018-0001** inside rolled-back transactions: `pending → confirmed → +৳9,945 bKash → shipped` landed as `shipped`/`partially_paid`, balance ৳9,945.00, `shipped_at` stamped, 2 history rows with `changed_by = auth.uid()`, stock `85/51 → 34/0` with a second `sale` movement, and a repeated “shipped” click was a **no-op** (no extra movement, no extra history row). Guards raise the short codes the UI maps: `payment_exceeds_balance`, `invalid_amount`, `not_allowed` (a JWT sub with no staff profile), `cannot_cancel_after_shipment`, `cannot_return_before_delivery`; the order itself was left `pending`/`unpaid` with 0 payments for the owner to fulfil by hand.)_
- [ ] Inventory admin: adjustments, movement history, low-stock alerts.
- [ ] Shipping zones in admin and used in checkout.
- [ ] Anti-abuse for COD: honeypot, rate limit per IP/phone, BD phone validation, optional Turnstile.
- [ ] Quote to order conversion (`bulk` order).
- [x] Payments ledger: record advance and balance payments, `partially_paid` status, amount paid and balance due on the order. _(Ledger screen + `admin_record_payment` live and verified: `paid` is always the ledger sum, `payment_status` flips to `partially_paid`/`paid` inside the RPC, and over-payment is refused.)_
- [x] Courier name, tracking code, shipped and delivered dates on orders. _(Courier/tracking form on the detail page; `shipped_at`/`delivered_at` stamped once by `admin_set_order_status` — `shipped_at` verified live, `delivered_at` by the same branch.)_
- [ ] Idempotency key on checkout, phone/IP blocklist, confirmation-call status.
- [ ] Production status and artwork approval for bulk/custom orders.
- [ ] Notifications outbox, email adapter, admin alerts and the scheduled sender.
- **Done when:** a customer can place a COD order, stock reserves and releases correctly, staff can fulfil it.

### Phase 6: Roles, audit, reports, polish

- [ ] Staff invites and role enforcement across all modules.
- [ ] Enforce MFA (TOTP) for owner and manager roles.
- [ ] CSV import/export for products, variants and stock, plus bulk image upload.
- [ ] Audit log writes on all admin mutations.
- [ ] Basic reports (sales by day, top products, quote conversion), CSV export.
- [ ] Full accessibility audit (section 3c checklist) in both themes and both languages, empty/error/loading states everywhere, 404 and 500 pages.
- [ ] Coupons (optional).

### Phase 7: Launch

- [ ] Real products, real photos (own samples), real client logos with permission, real legal documents.
- [ ] Replace logo v1 with v2 and the favicon pair (section 4d).
- [ ] Policy pages written in Bangla and English and linked (Terms, Privacy, Returns & Refunds, Shipping, Custom Order & Advance Payment).
- [ ] Analytics and marketing set up per section 9b; Google Business Profile claimed.
- [ ] Infra checklist from section 9b (paid plans, regions, staging, backups with a test restore, monitoring).
- [ ] Final accessibility pass: axe plus manual keyboard and screen-reader check.
- [ ] Proofread Bangla copy (human review).
- [ ] Connect domain on hosting, HTTPS, redirects from any old URLs.
- [ ] Google Search Console + sitemap submit, GA4, Meta Pixel if wanted.
- [ ] Backups enabled on Supabase, error monitoring set up.
- [ ] Final QA on mobile (most BD traffic is mobile).

### Later (not in scope now)

bKash/Nagad, card payments (SSLCommerz), courier API integration, full inventory (suppliers, purchasing, raw materials), customer accounts, product reviews, 2D color preview in the Custom Bag Builder, instant checkout for custom bags (`custom_order_mode = instant`).

---

## 11. Quality Gates (every phase)

- `bun run lint` and `bun run build` pass.
- No `any` unless justified in a comment.
- No secrets in the repo.
- Mobile-first check at 375px width.
- Every list view has loading, empty and error states.
- axe passes in both themes and both languages; `i18n:check` passes.
- Playwright e2e runs under Node (`npx playwright test`), including axe on `/en` and `/bn` in light and dark.
- On `/bn`, a Playwright walk of every visible text-bearing element (light and dark) asserts computed `font-size` ≥ 18px, excluding `.sr-only` text and SVG logos.
- Admin pages pass the 9c.10 checklist.
- Playwright + axe covers `/admin/login`, `/admin`, `/admin/design-system` and each new admin module in light and dark.
- A visual smoke test at 375 / 768 / 1280 / 1440 px asserts no horizontal page overflow on admin pages.

---

## 12. Conventions

- Server components by default; add `"use client"` only when needed.
- Mutations through server actions or route handlers, always validated with zod and checked against the user's role.
- Money stored as `numeric(12,2)`, currency BDT, formatted with `Intl.NumberFormat('en-BD')`.
- Never trust prices, totals or stock from the client.
- Slugs: lowercase, hyphenated English. Unique per table.
- File names: kebab-case. Components: PascalCase. DB: snake_case.
- Bangla text must use the Bangla font; test line height (Bangla needs more).

---

## 13. How We Beat the Competitor (keep in mind while building)

- Real quote-first buttons instead of fake 0.00 prices and an empty cart.
- A real **Custom Bag Builder** (every part customizable, live estimate) where the competitor only has a plain quote form, and quantity-range pricing shown openly.
- One product with variants instead of dozens of color-duplicate pages.
- Unique, specific copy (fabric GSM, stitching, insulation, MOQ) instead of generic slogans.
- Proper **native Bangla** content, not just a translate widget.
- A clean, small menu instead of a giant duplicated mega-menu.
- A **maintained blog** for SEO (competitor's blog is dormant).
- Clear ordering steps, lead times and MOQ shown upfront.
- Premium antique-gold + ink + ivory look, clearly different from their orange and dark moody style.

---

## 14. Open Questions (owner to answer; defaults in brackets)

1. Final gold palette (section 4) and logo: confirm after seeing the generated logo. [yes]
2. Default language for `/`: Bangla or English? [English, with prominent switch]
3. Company details: address, phones, email, WhatsApp number, working hours.
4. Delivery charge amounts and free-delivery threshold per zone.
5. MOQ and lead time for custom orders.
6. Who supplies product photos? [own photo shoot of real samples]
7. Who writes/reviews Bangla copy?
8. Logo (next step after this plan).
9. Notification channel for new quotes and orders: email, WhatsApp, or both? [email first]
10. Does the owner want raw-material and supplier tracking? [not now; revisit after launch]
11. DECIDED: custom bag orders show an estimate, team confirms, then order.
12. DECIDED: quantity ranges count the total of the same product across colors/sizes.
13. Which parts are customizable per product type? [default list: body fabric, zipper, puller, lining, strap, piping, thread, size, logo]
14. Custom size limits (min/max length, width, height) per product type.
15. Who supplies fabric swatch photos? [photograph the factory's real fabric and zipper swatches]
16. Sample policy: allow a 1-piece paid sample before bulk? [not in v1]
17. DECIDED: no live color preview at launch (selection summary only).
18. Are prices VAT-inclusive or exclusive, and should invoices show a VAT line? [inclusive, show VAT line; confirm with the accountant]
19. Advance payment for custom/bulk orders: what percentage, and which accounts (bKash/Nagad number, bank)? [50% advance, recorded manually]
20. How should customers be notified at launch: email, SMS, WhatsApp? [admin alert by email, customer sees status on the order page; SMS later]
21. Return and refund rules for ready-stock items (days, condition). Custom items: no returns.
22. Admin UI language: English only, or Bangla as well? [English first]
23. Facebook page and Messenger username, and access to claim the Google Business Profile.

## 15. Remaining Work (code review of 2026-10-19, HEAD `e39ba78`)

Source: a read of the repository (checkout, quote, upload, auth, SQL migrations, CI) plus the implementation report. Everything below is **not done yet**. Work the tracks in order; one task per commit (`phase-N: ...`, or `fix: ...` for review findings); tick a box only after the stated check passes; log decisions in the Decision Log. No UI redesign: reuse the existing admin kit.

### 15.1 Review findings

| ID | Severity | Finding | Where | Status |
|---|---|---|---|---|
| R1 | High | Public `/api/upload-signature` is unauthenticated and unthrottled. It signs only `timestamp` + `folder`, so anyone can upload images of any size/format the Cloudinary account allows into the production account, repeatedly. Its allow-list also contained `products` (the catalog folder). | `src/app/api/upload-signature/route.ts`, `src/lib/cloudinary.ts` | `products` removed in the review commit; the rest is B2, B3, B6 |
| R2 | High | Quote `attachment_path` is a client-supplied string, stored unvalidated and rendered in admin as `<img src>` and `<a href>`: an attacker-chosen external URL inside the staff panel (tracking, phishing; React 19 blocks `javascript:` but not `https://evil`). | `src/lib/validators/quote.ts`, `components/admin/quotes/quote-detail.tsx` | Host + folder check added in the review commit; cloud-name pinning is B7 |
| R3 | Medium | No rate limit on checkout or order lookup. The quote limit is per phone only, so rotating phone numbers means unlimited requests (DB spam and a Resend email flood). `rate_limits` and `blocked_contacts` are unused. The lookup returns name, phone and address, and order numbers are sequential (`PBF-YYMMDD-NNNN`). | `checkout/actions.ts`, `server/orders.ts`, `quote/actions.ts` | B1 to B5 |
| R4 | Medium | COD reserves stock at placement, so scripted orders can lock stock, and nothing expires unconfirmed pending orders. | `place_order` | B8 |
| R5 | Medium | Test safety: pgTAP covers Phase 1 only (19 assertions). `place_order`, `admin_set_order_status` and `admin_record_payment` have no repo tests and CI never runs pgTAP. CI e2e uses placeholder Supabase values, so admin tests self-skip. There is one Supabase project and mutation tests were run against it. | `supabase/tests`, `.github/workflows/ci.yml` | A1 to A5 |
| R6 | Medium | The `/admin` proxy checks only "signed in"; the role is enforced later in the layout and actions. There is no `supabase/config.toml` in the repo, so signup settings are not reproducible (an unexpected self-signup would pass the proxy). | `src/proxy.ts` | A1, D4, D5 |
| R7 | Medium | No security headers. | `next.config.ts` | Basic headers added in the review commit; CSP is D6 |
| R8 | Low | No `error.tsx`, `global-error.tsx` or `not-found.tsx`. | `src/app` | D3 |
| R9 | Low | `audit_logs` has no writer (plan: every admin mutation) although the dashboard feed reads it. No MFA. | | D1, D2 |
| R10 | Low | The builder `customization` JSON is only `JSON.parse`d (20 KB cap) with no structural schema, although a comment says it is validated. | `quote/actions.ts` | B9 |
| R11 | Low | The header comment in `cloudinary.ts` says private quote attachments stay on Supabase Storage, but customer artwork actually goes to Cloudinary public delivery URLs. | `src/lib/cloudinary.ts` | B6 (owner decision) |
| R12 | Info | `date-fns` is unused (forbidden by section 3); `ignoreScripts` is not a `package.json` field (Bun uses `trustedDependencies`); four commits break the `phase-N:` convention (`7578716`, `b29b37e`, `e39ba78` "Phase 4  done" also contains Phase 5 code, and `01e3bae` landed after the review HEAD). | | H1 to H3 |

**Verified fine (no action):** no secrets committed (scanned; `.env.example` holds placeholders only); JSON-LD escapes `<`; `place_order` and the admin RPCs are `SECURITY DEFINER` with `search_path = ''` and the admin RPCs are revoked from `anon`; every admin server action calls `requireRole` (except `signOut` and login, which is correct); prices are recomputed server-side; checkout uses an advisory lock and an idempotency key; honeypots exist on checkout and quote; admin media uploads validate type, size and a folder enum; `cn` is shadcn's own package.

### 15.2 Tracks

**A. Test safety and environment (do first)**
- [x] A1. `supabase init`; commit `supabase/config.toml` with `[auth] enable_signup = false` (staff are invited). Confirm `supabase start` works with Docker (installed by the owner on 2026-10-19).
- [x] A2. Tests use a local-only `.env.test`. Add a guard in test setup that aborts unless `NEXT_PUBLIC_SUPABASE_URL` is `127.0.0.1` or `localhost`. Never run mutation tests against the live project.
- [x] A3. CI: new `database` job (`supabase start`, `supabase db reset`, `supabase test db`). The `e2e` job runs against the local stack with seeded data and a seeded staff user (no secrets).
- [x] A4. pgTAP for Phase 5: `place_order` (tier boundaries 50/51, MOQ, oversell, idempotency replay, anon cannot insert orders directly), `admin_set_order_status` (each transition, double-send is a no-op, stock effects, role denied), `admin_record_payment` (overpay rejected, partial to paid), and "every table has RLS enabled".
- [ ] A5. **(Owner / human task — the coding agent creates nothing here.)** Separate staging Supabase project. Steps: (1) Supabase dashboard → New project, region `ap-southeast-1 (Singapore)`, name e.g. `primebagfactory-staging`, own database password; (2) `supabase link --project-ref <staging-ref>` then `supabase db push` so every migration is proven on staging before production; (3) seed a small fake dataset (`supabase/seed.sql`) — never production data; (4) invite staff users from Auth → Users (public signups stay disabled); (5) staging URL/anon/service keys go only in the staging environment of the host (Vercel), production keys only in production; (6) boot the app against staging and walk one manual order. Tick only when the owner confirms all six.
- [x] A6. Lighthouse CI paths include a product page (slug from seed), not only `/en` and `/en/quote`.

**B. Abuse protection (second)**
- [x] B1. Migration: `check_rate_limit(p_key text, p_limit int, p_window_seconds int) returns boolean`, `security definer`, `set search_path = ''`, fixed-window counter in `rate_limits` with a unique `(key, window_start)`, `execute` granted to `service_role` only; scheduled cleanup of old windows.
- [x] B2. `src/server/abuse.ts`: `getClientKey()` (salted SHA-256 of the first `x-forwarded-for` hop; env `RATE_LIMIT_SALT`) and `limit(key, rule)`. Rules live in `settings.rate_limits` (tunable without a deploy). Defaults: checkout 3/hour per phone and 10/hour per IP; order lookup 10 per 10 minutes per IP and 5/hour per order number; quote 5/hour per IP (keep the per-phone rule); upload-signature 20/hour per IP.
- [x] B3. Apply B2 in `placeCheckoutOrder`, `lookupOrder`, `submitQuote` (add the IP key) and `/api/upload-signature` (respond 429). The honeypot path must still look like success.
- [ ] B4. Check `blocked_contacts` (normalized phone, IP hash) in checkout and quote with a generic error. Admin can add entries from the order detail ("Block this phone").
- [ ] B5. Order lookup returns the identical error for a wrong number or a wrong phone.
- [ ] B6. Upload hardening, owner picks one (see 15.4): sign `allowed_formats` (match `ACCEPT` in `artwork-upload.tsx`) and send the same params from the client; OR (recommended, matches sections 7 and 9b) move customer artwork to a **private Supabase Storage bucket** `quote-attachments` using server-issued signed upload URLs, with staff reading via signed URLs.
- [ ] B7. `submitQuote` pins `attachment_path` to the configured cloud name (from `CLOUDINARY_URL`), or to the bucket path once B6 option 2 ships.
- [ ] B8. Reservation expiry: setting `pending_order_hold_hours` (default 48). A scheduled function (pg_cron, or a cron route secured by `CRON_SECRET`) cancels still-`pending`, `unpaid` orders past the hold using the same stock release as `admin_set_order_status` (movement `cancel_release`, history row, system actor).
- [ ] B9. Zod schema for the builder `customization` snapshot (parts array, bounded lengths); reject instead of silently storing `null`.
- **Done when:** pgTAP, Vitest and Playwright show that the 4th order from one phone in an hour is rejected, a blocked phone gets the generic message, a double submit yields one order, a stale pending order releases `reserved_qty` exactly once, the signature endpoint returns 429 past the limit, and a tampered `attachment_path` is rejected.

**C. Ops visibility**
- [ ] C1. Notifications outbox sender: new order creates an `admin_alert` and an email to `settings.company` (Resend), enqueued in the same transaction as the event; scheduled sender with retries (`attempts` incremented, `last_error` stored).
- [ ] C2. Dashboard order queries (pending orders, recent orders, 7/30-day sales chart) in `server/dashboard.ts`.
- [ ] C3. Wire `AdminShell counts` (`quotes_new`, `orders_pending`, `inventory_low`) from the protected layout (closes the Phase 2 count-badge box).
- [ ] C4. Hide nav links to unbuilt pages (`/admin/inventory`, shipping zones) until each ships.

**D. Security baseline**
- [ ] D1. `audit_logs` writer: one helper called by every admin mutation (actor, action, table, record id, diff without PII beyond ids); show it in the dashboard ActivityFeed.
- [ ] D2. MFA (TOTP) required for owner and manager: enrolment flow in admin, enforced in `requireRole` (AAL2) for those roles.
- [ ] D3. `error.tsx`, `global-error.tsx` and `not-found.tsx` (localized on the public site, plain in admin), never showing stack traces.
- [ ] D4. Test: a signed-in user with the `customer` role (or no profile) cannot load any `/admin` page or run any admin action.
- [ ] D5. Confirm in the hosted project that public signups are disabled and email confirmation is on; record it in the Decision Log.
- [ ] D6. CSP with a per-request nonce (theme script and JSON-LD), allowing `res.cloudinary.com` images and Supabase. Report-only first, enforce after a clean week.

**E. Inventory and zones admin**
- [ ] E1. `/admin/inventory`: variant stock list (available = stock - reserved); adjust through a `security definer` RPC `admin_adjust_stock` (reason enum, required note, movement row; never a direct `stock_qty` update); movement history; low-stock threshold; CSV export.
- [ ] E2. Shipping zones CRUD (fee, free_over, active) with kit components.

**F. Bulk/custom bridge**
- [ ] F1. Convert quote to `bulk` order (RPC; copies the customization snapshot; sets `source_quote_id`; quote status becomes `won`).
- [ ] F2. `production_status` and artwork-approval transitions in the order detail; link the spec sheet.

**G. Content and launch**
- [ ] G1. Record the content decision: the admin content module was removed by the owner (2026-10-18). Public clients, FAQ and legal content come from `messages/*.json` and seed data. Update sections 7, 8 and 9 to match, and mark `site_sections`, `gallery_items`, `testimonials`, `posts`, `redirects` as reserved (do not drop yet).
- [ ] G2. Home sections still missing from section 8 (client proof wall, work gallery, ordering steps, trust documents, video, inline quote form, reviews), built from static content; category filters (color, size, material, price).
- [ ] G3. Policy pages (Terms, Privacy, Returns & Refunds, Shipping, Custom Order & Advance Payment) in Bangla and English, linked from the footer and checkout.
- [ ] G4. CSV import for products, variants and stock, plus bulk image upload.
- [ ] G5. Real catalog, photos and legal documents; `LocalBusiness` JSON-LD with the verified address.
- [ ] G6. Reports, analytics (section 9b), error monitoring, backups with a test restore, uptime check, production Supabase and hosting on paid plans, product-page Lighthouse 90 or more.

**H. Housekeeping**
- [ ] H1. Remove `date-fns` (update `bun.lock`), delete the empty `src/components/admin/content/` directory, remove the invalid `ignoreScripts` field from `package.json`.
- [ ] H2. Regenerate `database.types.ts` with `supabase gen types` after every migration (the two RPC entries were hand-written).
- [ ] H3. Use `phase-N:` commit messages and never bundle another phase's code into a commit.
- [ ] H4. Add `TierEditor`, `StickySaveBar`, `SwatchChip`, `TabsBar`, `ActivityFeed`, `ChartCard`, `ChartRangeMenu` and `ChartSkeleton` to `/admin/design-system` (closes the Phase 2 box).

### 15.3 Order of work
A, then B, then C (C1 to C3), then D1, D3, D4, D5, then E, F, then D2, D6, then G. H1 to H3 can be done at any time.

### 15.4 Owner decisions needed
1. Customer artwork privacy: a private Supabase bucket (recommended), or keep unguessable public Cloudinary URLs with `allowed_formats`.
2. Rate-limit numbers and `pending_order_hold_hours` (defaults are in B2 and B8).
3. MFA scope (owner and manager) and the authenticator-app flow.
4. The open items in section 14 (#18 to #23 still apply).

### 15.5 First instruction for the coding agent
> Read `plan.md` (section 15) and `AGENTS.md`. Work only on track A, one task per commit, using the local Supabase stack. Do not touch the live project. Report each task with the command you ran and its result. Do not start track B until A is verified.

## Decision Log

_(Agents: append dated notes here when you make a choice the plan did not specify.)_

- 2026-10-15: Plan refactored: quantity-range pricing (2a), swatch library (2b), Custom Bag Builder (2c). Owner answered items 11, 12 and 17 in section 14; they are now locked decisions in section 1.
- 2026-10-15: Brand color changed from orange to a golden palette (section 4); added logo/favicon asset spec (4b).
- 2026-10-15: Logo v1 received (4 SVGs); usage rules in 4c, known issues in 4d. Owner will fix the logo himself.
- 2026-10-15: Added architecture (3b), theme/language/accessibility (3c), semantic light/dark tokens (4a), launch readiness (9b) and matching schema, admin and phase changes.
- 2026-10-15: Logo v1 SVGs copied into `public/brand/` with the section 4b names. The light/dark PNG favicon pair and `apple-icon.png` are not in the v1 pack, so metadata points at `favicon-source.svg`. The existing `src/app/favicon.ico` stays as the Safari fallback.
- 2026-10-15: shadcn/ui uses the radix-nova style. The registry item `form` emits no files, so `src/components/ui/form.tsx` is the react-hook-form adapter and `field.tsx` is the current field layout. Toast is Sonner. `cn`, `radix-ui`, and `sonner` come with shadcn. Error red (`--destructive`) is not in the brand palette. shadcn `primary` maps to brand gold. Default buttons and inputs are 44px tall.
- 2026-10-15: No Supabase CLI or project credentials were available, so the hosted project was not created. `.env.example` documents the keys and `.env.local` uses placeholders so the app can boot. The service-role key is validated only in `src/lib/env.server.ts` (imported by `admin.ts`) so it stays out of the browser bundle. Public vars are validated in `src/lib/env.ts`.
- 2026-10-15: Locale routing uses `src/proxy.ts` because Next.js 16 renamed middleware to proxy. `next-intl` 4.14 does not export `hasLocale`, so `isLocale()` lives in `src/i18n/routing.ts`. The locale cookie name `NEXT_LOCALE` is next-intl's default. `/` redirects by that cookie, then `Accept-Language`, then English.
- 2026-10-15: GitHub Actions `check` job runs lint, typecheck, unit tests, `i18n:check`, and build. The `e2e` job runs Playwright under Node.
- 2026-10-15: Owner replaced Hind Siliguri with Tiro Bangla for Bangla text. Tiro Bangla on Google Fonts is weight 400 only, so Bangla bold is synthesized. The header language control is one languages icon that toggles locale, and the theme trigger is a sun/moon icon. Menu labels for Light, Dark, and System stay as text.
- 2026-10-15: Header theme control is only sun and moon buttons. `defaultTheme` stays `system`. The accent dot follows the resolved appearance, including when the stored choice is still system.
- 2026-10-15: Header theme button shows only the active icon. Clicking it sets the other theme. `defaultTheme` stays `system`.
- 2026-10-15: Owner asked for the shadcn-space animated theme toggle. `motion` is installed for that icon. The header button uses it and still calls `setTheme`. Default stays system. The installer also rewrote `button.tsx` sizes and the primary hover; those edits were reverted so buttons stay 44px and use `bg-brand-hover`.
- 2026-10-15: Tiro Bangla is removed. Noto Serif Bengali (`--font-bn`) is the Bangla face on `:lang(bn)`. `/bn` html is 17px; `text-xs`/`sm`/`base` are `max(1rem, 18px)` so the Playwright floor of 18px holds. Playwright e2e runs under Node; CI has a separate e2e job with axe in both themes and languages.
- 2026-10-15: English on `/bn` was picking up Noto Serif because the font included a latin subset and `:lang(bn)` inherited onto Latin text. Noto is now bengali-only, Inter is the fallback, and `:lang(en)` forces Inter.
- 2026-10-15: Locale switch was jumping the header because `/bn` used a 17px root, 18px `text-sm`, and line-height 1.7 on chrome. Html rem is 16px in both locales; header is `h-16`; 18px Bangla type is limited to main and footer.
- 2026-10-15: Admin UI design system added (9c) from the Salesin and Kravio references: patterns only, gold/ink/ivory palette, no emoji, no copied assets. New libraries approved via section 3: `recharts` (shadcn chart), `cmdk` (shadcn command), `@dnd-kit/*`. New tokens: sidebar, surface-2, success/warning/ink-badge/destructive (+soft), chart-1..5. Dashboard data comes from `src/server/dashboard.ts`; order and sales widgets show empty states until Phase 5.
- 2026-10-15: Phase 1 checkout validation rejects `quote_only` products; the auth/order forward migration and pgTAP suite must be applied and run on the configured Supabase database before Phase 1 is complete.
- 2026-10-15: Applied and recorded migrations `202610150001` and `202610150002` on the linked Supabase project, provisioned and verified the first owner, and ran all 19 rollback-protected pgTAP assertions. The test file enables pgTAP in `extensions`; direct SQL execution was used because the CLI test runner requires Docker.
- 2026-10-15: `has_role(roles text[])` compares `profiles.role::text` to the supplied roles, since `profiles.role` is a PostgreSQL enum and cannot be compared directly with text.
- 2026-10-17: Phase 2 tokens added (9c.2). Sidebar tokens realigned to the plan (light `#F4EFE4`/border `#E2DACA`, dark `#181513`/border `#2E2823`) and `--sidebar-muted`, `--sidebar-active`, `--surface-2`, `--success/-soft`, `--warning/-soft`, `--ink-badge/-soft`, `--destructive-soft` and `--radius-card`/`--radius-control` added and exposed via `@theme inline`. Chart-1..5 set to the 9c.2 admin series. `--destructive` left at the existing value to avoid regressing the shadcn button/badge variants; `--destructive-soft` added for status badges. Contrast is the plan's approved pairing and is re-verified with real components in the Phase 2 axe pass.
- 2026-10-17: Installed `recharts`, `cmdk`, `@dnd-kit/core|sortable|utilities`, `@tanstack/react-table` and the missing shadcn components from section 3. The shadcn installer rewrote `button.tsx`/`input.tsx` back to 32px with `bg-primary/80`; reverted to keep 44px controls and `bg-brand-hover` (as in the earlier decision). Fixed the generated `src/hooks/use-mobile.ts` to use `useSyncExternalStore` so `bun run lint` (React Compiler `set-state-in-effect`) passes.
- 2026-10-17: Built the base admin kit under `src/components/admin/{data,dashboard,forms,catalog,shell}/` per section 5 and rebuilt `/admin/design-system` to show status badges, tones, stat/chart widgets, loading/empty/error states, forms and swatches. `PageHeader` moved to `shell/page-header.tsx` (old flat file removed). The design-system page is `"use client"` because it demos interactive kit pieces with inline handlers, so its `metadata` title is dropped; it stays under the noindex admin layout. Remaining kit components are added just before the pages that use them.
- 2026-10-17: Admin shell built from shadcn `sidebar` (collapsible icon rail, mobile Sheet and `sidebar_state` cookie are provided by the component; `TooltipProvider` is added by `AdminShell` since sidebar.tsx does not). Nav lives in `shell/nav.ts` with role gates mirroring `requireRole()`; nav is a convenience only and each module page still calls `requireRole()`. Active pill overrides `SidebarMenuButton` with `--sidebar-active` + gold icon rather than editing sidebar.tsx. Added `getAdminUser()` (role + name + email) in `auth.ts` and a `signOut` server action in `admin/actions.ts`; the protected layout now redirects on a null staff session. Login page gains the brand mark, a return link and `rounded-card`; the owner/manager MFA step is deferred to Phase 6 per the plan. `DataTable`, `ChartCard`, `ActivityFeed`, `TabsBar`, `FilterBar` and command-palette record search arrive with the dashboard and list pages.
- 2026-10-17: Admin shell fix — do NOT reuse the public site `ThemeToggle` (`shadcn-space/toggle-01`) in admin: it calls `useTranslations`, and admin routes live outside `[locale]` with no `NextIntlClientProvider`, which crashed the shell (and, via the client re-render fallback, surfaced the `ThemeScript` "script in a React component" warning). Added `shell/admin-theme-toggle.tsx` that uses the app's **custom** `@/components/site/theme-provider` (not `next-themes`). Note: `NavUser` and the mobile menu also had to switch from `next-themes` to the custom provider. Rule for Phase 2+: admin components must not import `next-intl` at all.
- 2026-10-17: Dashboard (9c.7) built on real queries in `src/server/dashboard.ts`, which reads through the cookie-based RSC `createClient()` so `has_role()` RLS applies; a SELECT a role isn't granted returns zero rows (never an error), so per-role gaps render as EmptyState, and only a genuine connection failure sets `fatal` (→ ErrorState with retry). Enum check: `quote_status` is `new|contacted|quoted|won|lost` (no `in_review`/`archived`) — "needs action" = new + contacted. Pipeline colors and lucide chart dots use `var(--chart-*)` tokens; SegmentBar/StatCard sparkline are hand-drawn SVG (recharts installed but the sales trend chart is intentionally EmptyState until Phase 5 real order data). Added dashboard widgets `ChartCard`, `ChartSkeleton`, `ChartRangeMenu`, `ActivityFeed`, `TabsBar` and extended `StatCard` with an optional `caption` for placeholder KPIs. `TabsBar`/`ChartRangeMenu` take a server-provided `baseQuery` (URL `?range=`) instead of `useSearchParams`, avoiding a Suspense boundary and keeping admin next-intl-free. No widget hrefs to module pages yet (they 404 until those pages land this phase).
- 2026-10-17: Task 6 axe harness — added a Playwright `setup` project (`e2e/auth.setup.ts`) that logs a staff user in from `E2E_STAFF_EMAIL`/`E2E_STAFF_PASSWORD` and saves storageState, plus an `admin` project (`e2e/a11y-admin.spec.ts`) depending on it; the public `chromium` project runs `e2e/a11y-public.spec.ts` (`/admin/login`, 8/8 green). No staff user is committed and we never hard-code creds, so when env vars are absent the setup writes a baseline empty storageState and every admin test self-skips (verified: all skip, no file-missing error). Completing the tick needs one authenticated run. `e2e/.auth` is gitignored.
- 2026-10-17: Categories CRUD (9c.8) — `/admin/categories` is a server-driven two-pane manager (fresh props after every action via `router.refresh()` + `revalidatePath`, so the tree/editor never diverge from the DB). Selection is derived (not a `useEffect` setState, per the React Compiler rule). Reorder writes `sort_order` from the flattened DFS id order; drag and the Move up/down buttons share that path. New `src/lib/slug.ts` (`slugify`/`isValidSlug`) and `src/lib/validators/category.ts` (zod v4, `z.guid()` for ids). `image_path` is a plain field until the Media task adds the picker.
- 2026-10-17: Task 6 authenticated axe run surfaced and fixed systemic admin-kit bugs (all admin pages inherited them): (1) **duplicate `<main>`** — shadcn `SidebarInset` already renders the page `<main>`, so `AdminShell`'s content wrapper is now `<div id="main" tabIndex={-1}>` (skip-link target preserved); (2) **sidebar wasn't a landmark** → 21 `region` errors, fixed with `role="complementary" aria-label="Admin sidebar"` on `<Sidebar>`; (3) **no `<title>`** — `(admin)/layout.tsx` now sets `title.default`+`template`, the dashboard exports `"Dashboard"`, and login uses `title.absolute` (the design-system page is `"use client"` so it relies on the layout default); (4) **gold contrast** — `--gold-soft` had no dark value (pale `#f1e3b8` in dark) and light `--gold-text` was 4.19:1, so light `--gold-text`→`#6f5010` and dark `--gold-soft`→`#2e2410` were set, and the avatar + sidebar count badge moved to `bg-sidebar-primary`/`text-sidebar-primary-foreground` (6.7:1, theme-stable); (5) **dark destructive Button** `text-destructive` on `bg-destructive/20` was 4.42:1 → lowered to `/10` (hover `/15`). Also **moved `/admin/design-system` under `(protected)`** so it inherits the shell (fixes its `region`/no-`main`), and its `DemoCard` titles are now `<h2>` (heading-order h1→h2→h3). Next 16 PPR `blocking-prerender-current-time`: added `await connection()` to the dashboard page so `Date.now` (getDashboardData/urgencyFor/ActivityFeed) is request-time. Gotchas: the `admin` project must run serially (Supabase SSR cookie refresh races under parallel workers → ECONNRESET), and Turbopack served stale compiled CSS until `.next` was deleted.
- 2026-10-17: Collections CRUD + the two deferred list kit components. **`DataTable`** is built on `@tanstack/react-table@9`, which is a major rewrite (`useReactTable`→`useTable` + a `features`/`Subscribe` model). Rather than guess at the bleeding-edge API, `DataTable` uses the library's documented **v8-compatibility layer**: `useLegacyTable` + `getCoreRowModel`/`getSortedRowModel`/`getPaginationRowModel` from `@tanstack/react-table/legacy`, and `flexRender` from the main entry. `ColumnDef` is invariant in `TValue` in v9, so the kit's column type widens the value slot to `any` (`LegacyColumnDef<TData, any>`) — the standard TanStack idiom — with a scoped eslint-disable. **Filtering is deliberately the caller's job** (the page filters by `q` and hands the table a finished array); the table only sorts + paginates what it is given, avoiding the v8-compat global-filter ambiguity and keeping `total = data.length`. Sorting/pagination/search are **URL-synced** (`sort`, `dir`, `page`, `size`, `q`): the server page reads `searchParams` and seeds the client table; interactions call `router.replace` (no history spam, `scroll:false`). Back/forward does not re-sync client table state — acceptable for admin and consistent with the rest of the phase. **`FilterBar`** debounces 300ms and owns its input draft locally so typing stays instant (no setState-in-effect). Row actions live in a trailing `display` column; its header MUST have accessible text (axe `th` rule) — use `header: () => <span className="sr-only">Actions</span>` (a bare empty `<th>` failed the authed run at 768+; 375 card view passes because there is no `<th>`). **Collections** specifics: `collections` is a flat table (no parent, no SEO columns — unlike categories), so the editor is a right-hand `Sheet` (not the two-pane tree); the `image_path` is a plain field until the Media task; delete leans on `product_collections … on delete cascade` so it is never FK-blocked. The linked-product count is a `product_collections(count)` embed, normalized for both the `{count}` object and the `[{count}]` array the typegen emits. `/admin/collections` is `ƒ` (dynamic/auth-gated). Full authed matrix now **33/33** (added collections), design-system now demos `DataTable`+`FilterBar`. typecheck/lint/build green.
- 2026-10-17: **Media storage switched to Cloudinary** (owner instruction, overriding the plan's "Supabase Storage" for the Media task). Scope decided with the owner: **public catalog images only** (product/category/collection images + swatch textures) move to Cloudinary; **private quote attachments stay on Supabase Storage** (Cloudinary is image/video-oriented and the plan's RLS/signed-URL design fits docs better). Upload path is **server-signed via the SDK** — `src/lib/cloudinary.ts` is `import "server-only"` (mirrors `supabase/admin.ts`), reads `CLOUDINARY_URL` **lazily** so a build/CI without creds still succeeds (only a real upload fails fast with a clear message); the API secret never reaches the browser. `uploadImage` streams the buffer through `uploader.upload_stream` and stores a delivery URL built with `quality:auto` + `fetch_format:auto` + `crop:limit` resize (1000px `standard` / 1600px `wide`) to meet the ~300KB performance target — "compression/resizing on upload". `src/app/(admin)/admin/media/actions.ts` is the only client-facing entry: `requireRole(['owner','manager'])`, then zod on a **fixed folder enum** (no free-text path → injection-safe) and explicit file checks (PNG/JPG/WebP/AVIF, ≤5MB) before any bytes hit Cloudinary. Kit `ImageUploader` (`forms/image-uploader.tsx`): drag/drop + click field calling the action, with idle/preview/uploading/error states, keyboard-operable (sr-only `Input` labelled by its dropzone `<label>`), text-labelled controls (never color alone), 150-200ms transitions with `motion-reduce`. Wired into the Category + Collection editors in place of the placeholder `image_path` text fields. `next.config.ts` now whitelists `res.cloudinary.com` for `next/image` (added `images.remotePatterns`; the public catalog will render through it in Phase 3). Cloudinary added to plan section 3. Demoed live on `/admin/design-system` (in the authed axe matrix) — **33/33** green; the admin preview uses a plain `<img>` (next/image is reserved for the public site).
- 2026-10-18: **Products CRUD + Customization tab (closes Phase 2).** Architecture: a minimal New step creates a draft row so the child tables (tiers/variants/images/parts) have a `product_id`, then the tabbed editor at `/admin/products/[id]` owns everything else. **Per-tab independent save** — each tab keeps its own draft, shows its own `StickySaveBar`, and calls its own action; children use **replace-semantics** (delete-then-insert) which is simpler and safer than diffing, and matches how the swatch/collection editors already behaved. Every tab resets its local draft with the **adjust-during-render** pattern (`const [prev] = useState(baseline); if (prev !== baseline) { setPrev(baseline); setForm(baseline); }`) after `router.refresh()` — never `setState` in an effect (React Compiler). Tabs deep-link via `?tab=` (an ARIA `tablist`; only the active tab sets `aria-controls` pointing at the single rendered `tabpanel`, the pattern that passed axe on Swatches). `product_variants.sku` is **globally unique** in the schema, so `saveVariants` batch de-dups in-request and maps Postgres `23505` to a friendly message. The `pricing` tab ships a new kit component **`TierEditor`** (controlled `TierRow[]`; `analyze()` flags unit*price≤0 and max<min as errors, overlap/gap/price-rises as warnings; live BDT preview via `formatMoney`). Catalog actions are gated `requireRole(['owner','manager','inventory'])` (a wider set than the content modules' owner/manager, matching the plan's inventory role) and zod-validated in `validators/product.ts`; `config` jsonb from the builder parts is stored with a double cast (`as unknown as Database…Insert.config`) because the validator's `z.record(z.string(), z.unknown())` output is wider than Supabase's `Json`. **Deferred / decisions:** "Import CSV" not built — shipped client **Export CSV** (Blob) only; a Preview link is left for Phase 3 (public product route doesn't exist yet); the `/admin/products/[id]` editor is intentionally **not** in the static axe matrix because it needs a real product id (would 404) — the list and New pages are covered. Schema: no new migration for products (all `product*\*`child write RLS +`on delete cascade` FKs came from Phase 1); the outstanding **`202610180001_phase2_swatches_rls.sql`** (swatch_groups write policy) has since been pushed to the live DB (2026-10-18: applied via `supabase db push`; the migration was made idempotent with `drop policy if exists`to reconcile drift where the policy existed but the version wasn't recorded — now tracked, re-push is a clean no-op; verified live that an`authenticated`owner INSERT passes RLS (row visible) and an`anon`INSERT is blocked with`42501`, both rolled back so no test rows persist). Final gates: typecheck/lint/build green, authed axe **56/56** (7 pages × light/dark × 375/768/1280/1440) — the last 8 failures were a `heading-order`violation on`/admin/products/new`(h1 "New product" → h3 "Basics" skipped h2), fixed with an`sr-only` `<h2>`before the first`FormSection`.
- 2026-10-18: **Media asset folder scoping (Cloudinary).** All project catalog media now lives under a single `Primebagfactory/` root folder in Cloudinary (`Primebagfactory/<entity>`, e.g. `Primebagfactory/products`), so it stays separate from other work in the shared account (`Logos`, `portfolios`). Two gotchas surfaced while wiring this up: (1) the admin `403` on upload was an invalid/rotated `CLOUDINARY_URL` API secret (Cloudinary secrets are exactly 24 chars — a mis-paste of the wrong length returns a bare `403` with no JSON body; fixed by regenerating the secret and copy-button pasting); (2) setting only the `folder` param did NOT keep assets in `Primebagfactory` — the account has a **default upload preset** whose Asset folder is `/portfolios`, and that preset overrode the Media Library location. Fix in `src/lib/cloudinary.ts` `uploadImage`: pass `asset_folder` (the Media Library location) and `use_asset_folder_as_public_id_prefix: true` alongside `folder`, all to the same `Primebagfactory/<entity>` path — request-level params win over preset defaults. `use_asset_folder_as_public_id_prefix` must be boolean `true` (SDK type), not the string `"true"`. Folder names are case-sensitive; `ROOT_FOLDER = "Primebagfactory"` must match the console exactly. Verified live: a product-image upload now lands in `Primebagfactory/products`.
- 2026-10-18: **Phase 3 feature-complete; perf gate deferred; owner reprioritized to Phase 4 (admin).** Phase 3 tasks 1–7 are ticked and the feature-based _Done when_ (catalog + quote + custom-builder on real data) is met — 60/60 public e2e, gates green. Only the Lighthouse mobile ≥90 gate (task 8) remained. Ran a real optimization pass against a local `next start`: dropped `motion`/framer-motion (CSS-transition header toggle, reduced-motion honored), enabled `experimental.inlineCss` (kill the ~450ms render-blocking Tailwind request → count 0), and removed `priority` from `ThemeLogo` (two competing header-image preloads, one always hidden). Net: quote 67→~90, home 87→**91 (reliably passes)**; product still **~85**. Next lever is web fonts (~235 KiB on `/en`, larger than JS) delaying the _text_ LCP via `display:"swap"` — try `Inter({display:"optional"})` and stop preloading the Bengali subset on `/en`. **Owner decision: skip the front-end perf page for now and finish the admin first**, i.e. move to **Phase 4 — Admin quotes + content** (quotes inbox/pipeline/notes/printable spec + quotation; content admin for homepage/clients/gallery/testimonials/FAQ/legal/blog/redirects). Task 8 is left **unticked** and tracked as deferred to Phase 6 (polish), not dropped. Phase 4 will be started in a fresh chat. No git commits were made this session.
- 2026-10-18: **Phase 4 task 2 — new-quote notifications (owner answered the "provider TBD").** Owner chose **Resend email + the WhatsApp number from `.env`**. Shipped: (1) `src/server/notifications.ts` `notifyNewQuote()` runs at the end of the public `submitQuote` — best-effort, a delivery failure can never reject a submission; (2) an `admin_alert` row in the existing `notifications` outbox feeds the **topbar bell** (protected layout fetches via the RLS-scoped client — owner/manager see rows, other roles get an empty popover; unread = `status pending`, "Mark all read" action flips them to `sent` and is the app-level mirror of the notifications RLS policy); (3) **Resend** (`resend@6`, added to plan §3) emails the `settings.company` address when `RESEND_API_KEY` + `MAIL_FROM` exist — the owner provisions both, missing config silently skips email (bell still works), each attempt records an `email` outbox row (sent/failed + error). CI note: builds without the keys pass because they are read lazily from `process.env`, not zod-validated. **WhatsApp is a handoff, not a server push:** there is no WhatsApp API credential (Meta Cloud API/Twilio would be new providers), so the public success screen shows a prefilled **wa.me link to `NEXT_PUBLIC_WHATSAPP_NUMBER`** ("Continue on WhatsApp" with the ref) — the request literally arrives in the owner's WhatsApp chat. Revisit server-side push at Phase 5 outbox if the owner gets Business API access.
- 2026-10-18: **Phase 4 task 1 — quotes admin + print sheets.** Decisions the plan left open: (1) **Print routes live at `/admin/print/quotes/[id]/{spec,quotation}`**, outside `(protected)` — a sibling `quotes/[id]/print/…` would duplicate the `[id]` route segment across groups and the shell would inject sidebar/topbar chrome into print; pages are role-gated (owner/manager/sales, others redirect to `/admin`) and render `<main id="main">` themselves. (2) **PrintSheet is black-on-white** (plan 9c.5 print spec — an explicit exception to the token rule, documented in the component); the design-system demo embeds only `PrintSection/PrintRow/PrintChecklist` inside a forced-white block because `PrintSheet` renders `<main>` and can't be nested. (3) **Urgency is computed, never stored**: target date = `needed_by ?? valid_until` (valid_until wins when status is `quoted`), Asia/Dhaka end-of-day, `<0` overdue / `≤2d` due_soon / else later. (4) **Quotation validity fallback**: when `valid_until` is null the terms print "Quoted prices are valid until confirmed in the order." (5) **Company letterhead** comes from `src/server/settings.ts` `getCompanyProfile()` reading the seeded `settings.company` key `{name,phone,email,whatsapp}` with a Prime Bag Factory fallback — a missing row never fails a print. (6) Source/assignee filters are client-side over the fetched status tab's rows (status tabs are server-queried links, like products); assignee filter also offers "Unassigned". (7) Quote detail/print pages tolerate a throwing query (products pattern) rather than the dashboard fatal/ErrorState — acceptable until the Phase 6 error audit. Kit additions: `print/print-sheet.tsx`, `print/print-toolbar.tsx`, `quotes/color-chip.tsx`.
- 2026-10-18: **Commerce policy (owner): quotes are for the Custom Bag Builder only; standard products sell through COD checkout with a 50% advance.** Consequences and what was done now: (a) **Phase 5** checkout becomes the ordering path for all catalog products — product CTAs switch from "Request quote" to add-to-cart/buy there, and the `quote_only` product type falls out of use for new products; (b) the general public `/quote` form stays live **until checkout ships** (removing it earlier would leave no way to order); after Phase 5 it reduces to the builder flow, and the quotes admin built in Phase 4 keeps serving builder requests either way; (c) the **50% advance** is written into the Terms of service on `/legal` (new bilingual `legal.terms*` message keys rendered as a numbered list under the documents) — a code-side statement until the owner publishes real signed legal documents at Phase 7 — and into the printable quotation's Payment row ("50% advance due at order confirmation; the remaining 50% is cash on delivery (COD). Production starts after the advance is received."); (d) checkout must reserve stock and record the advance in the payments ledger (`partially_paid` already exists in the schema).
- 2026-10-18: **Phase 3 public catalog + quote — build notes (technical detail).** Cache Components (Next 16 `cacheComponents: true` + `partialPrefetching`) forced two restructures: (a) `generateStaticParams` may **not** return `[]` (error `empty-generate-static-params`), so the ISR-on-demand `return []` pattern used on every Phase 3 page was **removed** — a route without `generateStaticParams` renders on request; (b) runtime data (`params`/`searchParams`) awaited **outside** `<Suspense>` fails the build (`blocking-prerender-dynamic`), so the slug pages (product/category/collection) and the query pages (search/quote/builder) were split into a thin default export that renders `<Suspense fallback={skeleton}><Content params searchParams/></Suspense>` with an inner async component that awaits the props. Result markers: home/faq/legal/clients/contact + robots/sitemap = `○ Static`; builder/category/collection/product/quote/search = `◐ Partial Prerender`; admin = `ƒ Dynamic`. **SEO:** `buildMetadata` gives canonical + `hreflang` (`en`/`bn`/`x-default`); `app/sitemap.ts` reads `listSitemapProducts` (with `lastModified`), `listSitemapCategories`, `listSitemapCollections` (all `unstable_cache`, revalidate 3600) × both locales and prerendered from the live DB at build; `app/robots.ts` disallows `/admin/`+`/api/`. JSON-LD via the `jsonLd()` helper (escapes `<`): site-wide `Organization` in `[locale]/layout.tsx`, `Product` on the product page (**`offers` only when `type === "buy_now"`**, price omitted for quote_only), `FAQPage` on /faq, and a new `buildBreadcrumb()` (`lib/seo.tsx`) emitting `BreadcrumbList` on product (Home›Category›Product), category and collection. **LocalBusiness/PostalAddress deferred to launch** (needs the real verified address). **a11y fixes surfaced by the public-page axe matrix + bn font walk:** (1) the floating WhatsApp launcher was outside a landmark (`region`) → wrapped in `<aside data-sticky-contact aria-label>`; (2) LanguageSwitcher's gold button used `text-foreground` (cream in dark → `color-contrast`) → `text-primary-foreground`; (3) `heading-order` on /search (h1→h3 skipping h2) → the results count is now always an `<h2>` (same latent fix proactively applied on category/collection); (4) the PPR `<Suspense>` fallbacks on the six streaming pages (product/category/collection/builder/quote/search) each rendered `<main id="main">`, so the static-shell skeleton and the streamed content produced **two `main` landmarks + duplicate ids** (a Playwright strict-mode + axe risk that surfaced intermittently by stream timing) → every fallback skeleton is now a plain `<div>` and only the streamed content owns `<main id="main">`; (5) `/bn` visible text floor — `html[lang="bn"] main, footer` base bumped `17px → 18px` and a `html[lang="bn"] [data-sticky-contact] a { font-size: max(1rem,18px) }` rule added (the launcher sits outside main). **Decision-log note on the font test:** `e2e/bn-font-size.spec.ts` asserted the `/bn` `<h1>` stack was Inter and **not** Noto, which contradicts plan §3c line 202 ("Noto Serif Bengali ... apply with `:lang(bn)`, Inter as the fallback") — `getComputedStyle().fontFamily` returns the whole declared stack, so a Bengali heading correctly lists Noto first. The assertion was **corrected to the plan** (`toContain("noto serif bengali")` + `toContain("inter")`) rather than forcing Inter-only headings (which would drop Bengali glyphs). New `e2e/public-pages.spec.ts` runs axe on every new page × en/bn × light/dark and discovers a real product slug from /search to audit the detail pages. Final gates green: typecheck, lint, `i18n:check` (196 keys), vitest (13), `next build` (compiled successfully), Playwright public/home/font **60/60**. **Not yet done:** the literal Lighthouse mobile ≥90 audit (task 8) — Lighthouse is not installed and is outside plan §3, so it must be provisioned before that box is ticked; code-side perf (`next/image` + sizes/priority, PPR streaming, server components, `unstable_cache`) is already in place. **Perf-gate follow-up (owner approved the plan-§3 addition):** `lighthouse@13` + `chrome-launcher` added as **devDependencies**; `scripts/lighthouse-check.ts` (`bun run perf:lighthouse`) audits `LIGHTHOUSE_PATHS` (default `/en,/en/quote`) in the mobile preset and exits non-zero under `LIGHTHOUSE_MIN_PERF` (90); a `lighthouse` CI job (`needs: check`) builds, starts `next start` and runs it on ubuntu-latest Chrome. A local `next start` run measured **home 87 / quote 67** — below the bar, so task 8 stays **unticked**; the quote form's client bundle is the priority for the next optimization pass. CI caveat: with Phase 3 home/sitemap now prerendered statically from Supabase, the `check` and `lighthouse` builds need real Supabase secrets, not the workflow's placeholder env.
- 2026-10-18: **Phase 4 task 3 — content admin (all eight tables in one workspace).** The plan lists eight content modules; building eight bespoke pages would repeat the collections editor eight times, so it is **config-driven**: `components/admin/content/content-types.ts` declares each table's fields (8 kinds: text/textarea/json/bilingual/number/select/date/image) and the generic `ContentWorkspace` (row list + `ContentEditor`) renders any of them. Decisions the plan left open: (1) **one page, `?type=` rail** of server links (same tab-link pattern as the quotes pipeline) — `/admin/content` defaults to sections; the nav link already existed from Phase 2. (2) **Four generic mutations** (`save/delete/move/toggle` in `admin/content/actions.ts`) validated twice — `contentSaveSchema` pins the entity to the fixed enum, then the per-table zod schema (`validators/content.ts`) pins the columns, so no free-form object reaches Supabase; RLS (owner/manager, Phase 1) mirrors the `requireRole` gate, so **no new migration**. (3) **Reorder is up/down buttons, not drag-and-drop** — plan §3 restricts dnd-kit to the products builder; move renumbers the whole table (marketing lists are <50 rows). (4) **Sections jsonb edits as pretty JSON text** with a documented `title_en/title_bn` convention — the homepage banner/stat blocks are too varied for fixed inputs until Phase 6 wires them to the site. (5) `liveOnSite` flag per type: clients/faqs/legal render publicly today (saves `revalidateTag(CATALOG_TAG, "wait")` — Next 16 requires the staleness arg); gallery/testimonials/posts/redirects/sections show an honest "not displayed yet" note until their pages ship. (6) `posts.published_at` is auto-stamped server-side when status flips to published (+06:00 at 09:00 for manual dates); the DB has Bangla SEO columns but the editor exposes EN only (BN SEO copy is a Phase 6 nicety). (7) Unique-constraint `23505`s map to friendly per-entity hints (page/key, slug, from_path). Cloudinary folders extended with `clients`/`gallery`. Gates: typecheck/lint/build green, i18n 204 keys, public e2e 69/69, authed axe matrix now **73/73** (9 pages incl. `/admin/content` × light/dark × 375/768/1280/1440).
- 2026-10-18: **Content admin removed by owner (supersedes the task-3 entry above).** Right after task 3 shipped the owner ruled: "no need the content route anymore, remove it completely. just we need to manage all assets, can be upload and can be use in the product add new etc." Deleted in one revert commit: `(protected)/content/{page,loading}.tsx`, `admin/content/actions.ts`, `components/admin/content/*` (workspace/editor/types), `lib/validators/content.ts`, `server/content-admin.ts`, the sidebar Content section in `nav.ts`, and the `/admin/content` axe-matrix row (back to 65 combos). **Kept:** everything the asset workflow needs — the server-signed `uploadMedia` action, the `ImageUploader` kit in the product/category/collection/swatch editors and the design-system demo, and the extended Cloudinary folder enum (`clients`, `gallery` remain valid upload targets if marketing images are ever needed). The eight content tables stay in the database (Phase 1 schema, untouched) — only the admin UI is gone; if marketing content editing returns later it will be a fresh decision. No RLS or storage migration was required either way.
- 2026-10-18: **Phase 5 task 1 — cart (client store + `/cart` + add-to-cart).** No new tables, no migration: Phase 1 already ships the commerce schema and `place_order` is complete. (1) **Single source of price truth:** `src/lib/pricing.ts` re-implements the RPC’s rules in TS (product-level tier lookup, per-unit variant `price_delta`, `round2`, MOQ, `available = stock_qty - reserved_qty`, `shipping_fee` with `free_over`, `advance_due = total/2`) and is unit-tested at the tier boundaries the plan names (49/50/51/99/100) — checkout will call the RPC and the same module for display, so the two can’t drift silently. (2) **The store keeps only `{variantId, qty}`** in localStorage (`pbf-cart-v1`), exposed via `useSyncExternalStore` with a frozen empty server snapshot (SSR never hydrates cart state — matches the “cart is client state” line in 3b) and a `storage` listener so tabs share one cart. (3) **Money never comes from the client**: `/cart` posts its uuid list to the `loadCart` server action (`zod`: `guid[]`, max 50), which re-reads price tiers, MOQ, stock and publish state through `src/server/cart.ts`; items that vanished/where unpublished come back as `missing` and get a one-click cleanup. Lines re-fetch only when the **set of variants** changes; quantity edits recompute locally from the fetched tiers. (4) **MOQ is per product, not per line** — quantity is grouped by `productId` before tier and MOQ checks, exactly as `place_order` does across the cart, so two variants of one bag can together reach the minimum. (5) **Product type decides the CTA**: `buy_now` gets a primary Add to cart (disabled when `qty > available`, with an “Only N pcs available” note; made-to-order has `available = null` so nothing blocks it) plus an “Added — view cart” confirmation link, and keeps a quiet Request-a-quote escape hatch; `quote_only` products keep the quote-only CTA. Stock/MOQ/quote-only failures block the checkout button in the summary rather than being silently fixable later. (6) `/cart` is `robots: noindex` (personal state). **React Compiler note:** the first draft reset cart state inside `useEffect` and the compiler rejected it (`setState` synchronously within an effect) — “loading” is now **derived** from whether the fetched snapshot matches the current variant set, which also removed the double-render on open. (7) Messages: new `cart` namespace (25 keys) + `nav.cart`/`nav.cartAria` + three `product` keys, en/bn in parity (i18n now 234). Gates: typecheck, lint (compiler clean), vitest **25**, i18n 234, build green with `/[locale]/cart` at `◐`, public suite **70/70** (new `e2e/cart.spec.ts` drives a real add-to-cart then axe-audits the **populated** cart — the empty state is covered by `/cart` added to `public-pages.spec.ts`), authed admin matrix **65/65**. **Environment gotcha found while testing:** a long-lived `bun --bun next dev` server on :3000 serves HTML but never hydrates (exactly what `playwright.config.ts` warns about), so client-side flows like Add to cart silently no-op — Playwright must own a Node `next dev`; killed the stale Bun server and the flow test passed immediately. Next task: 5-2 checkout (`place_order` + confirmation + order lookup).
- 2026-10-18: **Phase 5 task 2 — checkout, confirmation and order lookup.** Still no migration and no new RPC: `place_order` (Phase 1) already holds the whole write contract, so this task is only about feeding it honestly. (1) **Write path stays anon.** `placeCheckoutOrder` uses `createPublicClient()` and calls `.rpc("place_order", { payload })`; the payload keys were checked against the function body line by line (`items[].variant_id/qty`, `customer_name/phone/email`, `division/district/area/address_line`, `shipping_zone_id`, `customer_note`, `type`, `payment_method`, `idempotency_key`) and **contain no money** — `checkoutSchema` has no price fields and zod strips unknown ones, so a hand-edited `total` can’t even reach the RPC. The service-role key is used only for the _read_ (2). (2) **`src/server/orders.ts` is the only customer-facing order read.** RLS gives anon no select on `orders`/`order_items`/`payments`, so the lookup runs on `createAdminClient()` and returns a customer-safe projection (no internal notes, no flags) matched on `order_no` **and** `customer_phone`; a wrong half and a wrong whole produce the same `errNotFound` text. (3) **Feature flags fail open, and are re-checked in the action.** `getCheckoutFlags()` reads `settings.checkout` through the anon client (public select policy) and falls back to “commerce on” when the row is absent — a missing setting must never block revenue — while `placeCheckoutOrder` re-reads it so a tab left open over a closed checkout still gets `errClosed`/`errCodClosed`. Zones come from `shipping_zones where is_active` ordered by fee; `free_over` is honoured for display by `shippingFeeFor` and for real by the RPC. (4) **Stable error codes, no SQL leakage.** Every `raise exception` string in the RPC is mapped in `codeForRpcError` (`errMoq`, `errStock`, `errTier`, `errZone`, `errStaleCart`, `errQuoteOnlyItem`, `errCustomerFields`, `errIdempotency`, `errMethodClosed`, `errDailyLimit`) and anything unrecognised degrades to `errGeneric` — the customer never sees Postgres text. A pre-flight through `loadCartLines` rejects unpublished/quote-only variants before the RPC runs, which turns a race with the admin into a localized message instead of a constraint error. (5) **One idempotency key per browser attempt** (`web-<uuid>`), kept across client- and server-side validation failures and cleared only when the action throws, so a double click or a dropped response replays into the same `order_no` (the RPC’s advisory lock does the work). (6) **Confirmation is inline, not a handoff.** On success the cart is emptied (`clearCart()`, so the back button can’t resubmit the same lines) and the order is read straight back through `lookupOrder` into `<OrderStatus justPlaced>`; if that read fails the screen still shows the order number plus a link to `/order/[orderNo]`. An earlier draft stashed the number/phone in localStorage and `router.push`ed — rejected, because a storage read during render breaks hydration under PPR. (7) **`/order/[orderNo]` pre-fills the number from the URL but always asks for the phone** — the page is a status lookup, not an enumeration oracle; both `/checkout` and `/order/*` are `robots: noindex` and stay out of the sitemap. (8) **The 50% advance is shown everywhere and recorded nowhere.** `advanceDue`/`balanceDue` appear in the sticky summary and on the status page; `paid` sums the `payments` ledger, so a fresh order legitimately reads “৳X advance due · ৳0 paid” until staff record it in task 5-3. (9) Reused from the quote flow: the `website` honeypot (fail-open fake success), error _codes_ localized client-side, and the form `Field` wrapper — extracted from `quote-form.tsx` into `components/site/form-field.tsx` so checkout, quote and the order lookup share one label/error markup. Bangla type sizes are already covered by `html[lang="bn"] main :is(.text-xs,.text-sm,.text-base)` (18px floor). (10) **Gate found a real a11y bug outside this task:** the builder wizard’s current-step chip was `bg-brand text-white` — 2.67:1 at 12px, failing `wcag143` in both themes — now `bg-brand text-brand-foreground` (the token pair built for it). It only surfaced once the public suite ran against a _hydrating_ dev server. (11) **Deliberately not done:** no real order was placed by the suite (it would reserve stock, write movements and burn a daily order number); the payload contract was verified against the RPC source instead. One live COD order — placed, then cancelled through the admin — will be run as soon as task 5-3 exists, so cleanup is a staff action rather than manual SQL. (12) **Environment gotcha:** running `bun run build` and _then_ a Node `next dev` in the same `.next` made the first requests fail with `JSON.parse` and `next/font/google` module errors (cold font cache) — fix is `rm -rf .next` and re-run; two axe failures on the first cold run disappeared on the second. Files: `lib/validators/checkout.ts` (+ `checkout.test.ts`, 12 cases: BD phone shapes, Bangla digits, `01[3-9]` only, order-no format, honeypot, missing/oversized idempotency key), `server/checkout.ts`, `server/orders.ts`, `app/[locale]/(site)/checkout/{page,loading,actions}`, `app/[locale]/(site)/order/[orderNo]/page.tsx` (thin Suspense like the product page — no second `loading.tsx`, no second `<main id="main">`), `components/site/{checkout-form,order-status,form-field}.tsx`, `e2e/checkout.spec.ts`, `/checkout` + `/order/PBF-251018-0001` added to the public axe matrix. Gates: typecheck, lint (React Compiler clean), vitest **37**, i18n **332** keys in parity, build green with `/[locale]/checkout` and `/[locale]/order/[orderNo]` at `◐`, public suite **85/85** (11 new runs, incl. a cart→checkout flow that asserts the zone radios, the advance rows and the “we will call to confirm” note, an empty-field submit that asserts the form errors and that nothing was written, and a lookup that asserts the single safe not-found message), authed admin matrix **65/65**. Next task: 5-3 admin orders.
- 2026-10-18: **Phase 5 task 3 — admin orders (mandatory core, owner-trimmed scope).** The owner asked “i ordered but where is it?” after placing **PBF-261018-0001**. The write had worked — verified with the service-role client: order row `pending`/`unpaid`/`cod`/`retail`, subtotal and total ৳19,890, one line `PBF-DEL-BLK-12` × 51 @ ৳390, an `inventory_movements` row `delta -51, reason 'sale', ref_type 'order', ref_id 'PBF-261018-0001'`, and the variant at `stock_qty 85 / reserved_qty 51` — but the sidebar’s **Orders** link pointed at `/admin/orders`, a route that did not exist yet (task 5-3). The owner then approved building “the mandatory feature” only. Decisions: (1) **Two atomic RPCs instead of browser-side multi-writes.** A status move touches `orders`, `order_status_history`, `product_variants` and `inventory_movements`; a payment touches `payments` and recomputes `orders.payment_status`. Phase-1 RLS gives `sales` no write policy on `product_variants` (owner/manager only), so the alternatives were “fail for sales staff” or “let a browser touch stock” — instead `admin_set_order_status` and `admin_record_payment` are `security definer` with `set search_path = ''`, re-check `public.has_role(array['owner','manager','sales'])` internally, are revoked from `public`/`anon` and granted `execute` to `authenticated`. (2) **Stock effects follow plan §7’s lifecycle table**: shipped → `stock_qty −qty` **and** `reserved_qty −qty` + `sale` movement; cancelled → `reserved_qty −qty` + `cancel_release`; returned → `stock_qty +qty` + `return`; every write clamped with `greatest(0, …)` and applied only when the product’s `stock_mode = 'tracked'` (the enum _type_ is `public.product_stock_mode`, not `public.stock_mode` — caught while reading the DDL). Re-sending the status an order already has **returns early**, so a double click can never reserve or release twice; `shipped_at`/`delivered_at` are stamped once; illegal moves raise short codes (`cannot_cancel_after_shipment`, `cannot_return_before_delivery`, `payment_exceeds_balance`, `not_allowed`) which `fulfilmentError()` turns into staff prose — and when the RPC is missing the message names the exact migration file to apply. (3) **Money stays derived**: `paid` is the sum of the ledger, `balance = total − paid`, `advance_due = advanceDue(total)` from `lib/pricing.ts`; the list does one extra `payments.select("order_id, amount")` read and aggregates per order, so a table cell can never disagree with the ledger, and the record-payment form pre-fills the advance on an unpaid order, the balance after that. (4) **Kit-only, shaped like quotes**: status tabs as links with counts, `DataTable` (URL-synced `q/sort/dir/page/size`), mobile cards, skeleton/empty/error on both screens, `SectionCard` + pipeline buttons with `aria-current="step"` + `ConfirmDialog` for cancel/return + `useActionSave`, so the `orders_pending` sidebar badge finally has a real page behind it. (5) **Print kit corrected**: `PrintToolbar` had “Back to quotes” hard-coded, which would have sent every order document back to the wrong inbox — `backHref`/`backLabel` props added (defaults unchanged, so the quote pages are untouched) and both order sheets pass “Back to order”. Invoice carries the ledger and the advance/balance lines; packing slip carries contents and deliberately **no prices** (the packer’s copy). (6) Reads go through the cookie RSC client so **RLS decides visibility** (`getAdminUser()` + role check only gates the page shell), mutations go through `requireRole([owner,manager,sales])` + zod (`validators/order-admin.ts`, 11 unit cases: unknown status and non-guid id rejected, amount coerced/rounded and ≤0 rejected, blank text → `null` not `""`). (7) **e2e is read-only on purpose** — a status move changes stock and a payment writes money rows, so `admin-orders.spec.ts` only proves the list carries the pipeline/advance columns and that a real order’s detail shows items, ledger, history and both print links, axe-clean; the place → confirm → advance → ship cycle will be walked by hand on PBF-261018-0001 once the functions exist (the task-2 entry, note 11). (8) **Two test-plumbing bugs found while gating**: `admin-orders.spec.ts` was running under the `chromium` project, which has no `storageState`, so it silently skipped — the `admin` project now `testMatch`es both admin specs; and the kit’s “Open” + sr-only “: order PBF-…” makes the computed name `Open : order …` (space before the colon), so the spec’s `^Open: order` regex never matched. The component is right (identical to the quotes table), the selector was wrong. (9) **Environment gotcha, second flavor of the Bun-dev trap:** five client-interaction tests failed with _no_ console errors because the dev server I had restarted was bound to `localhost` while `playwright.config.ts` drives `http://127.0.0.1:3000` — Next 16 blocks cross-origin requests to its dev resources, so nothing hydrated and every click was a no-op on static HTML; the dev log said it plainly (`⚠ Blocked cross-origin request to Next.js dev resource /_next/hmr from "127.0.0.1"`). Fix: start dev exactly as the config does (`npx next dev --hostname 127.0.0.1 --port 3000`), never weaken the test. `public-pages.auditFirstProduct` also now waits for the stream and matches `<main>` leniently, because while the PPR resume lands, dev briefly holds a second copy of the layout landmark in the DOM (strict-mode flake, not a shipped-page bug — the served HTML has exactly one `<main>`). (10) **Deployed and proved live.** The first read of this environment was wrong — there is no `supabase` on `PATH`, but **`bunx supabase@2.121.0 db push` works** (it resolves from the bun cache and connects with the credentials saved at `supabase link` time; no `SUPABASE_ACCESS_TOKEN`, no `SUPABASE_DB_PASSWORD`), which is how the earlier phases were pushed. `migration list` showed `202610180002` local-only, `db push` applied it, and both functions were then exercised **on the owner’s real order inside `begin; … rollback;`** with `set local role authenticated` + `set local request.jwt.claim.sub = '<owner uuid>'` so `auth.uid()`, the `has_role` guard and `changed_by` were all tested as a staff session rather than as postgres: `pending → confirmed → +৳9,945 bKash → shipped` came back as `shipped` / `partially_paid`, balance ৳9,945.00, `shipped_at` stamped, 2 history rows with `changed_by_ok = true`, stock `85 / reserved 51 → 34 / 0` with a second `-51 sale` movement, and **re-sending `shipped` was a no-op** (still 2 movements, 2 history rows). Live signatures match the hand-written `database.types.ts` parameter names exactly (`p_order_id, p_to_status, p_note` / `p_order_id, p_amount, p_method, p_reference, p_note`), execute is granted to `authenticated` and **not** to `anon`. Guards raised exactly the codes `fulfilmentError()` maps: `payment_exceeds_balance`, `invalid_amount`, `not_allowed` (a sub with no staff profile), `cannot_cancel_after_shipment`, `cannot_return_before_delivery`. Every check rolled back, so **PBF-261018-0001 is still `pending`/`unpaid` with 0 payments** — the owner’s first real fulfilment is theirs to click. **Still open**: `supabase gen types` has not been re-run (the two `Functions` entries are hand-written), the `cancelled`/`returned` stock branches were not run end-to-end because they would move this order’s real stock, and the polish items the owner deferred (filters beyond status/payment/type, per-role courier picklist, bulk print run) stay out. Files: `supabase/migrations/202610180002_phase5_order_fulfilment.sql`, `app/(admin)/admin/(protected)/orders/{page,loading}.tsx` + `orders/[id]/{page,loading}.tsx`, `app/(admin)/admin/orders/actions.ts`, `app/(admin)/admin/print/orders/[id]/{invoice,packing}/page.tsx`, `components/admin/orders/{orders-table,order-detail}.tsx`, `server/orders.ts`, `lib/validators/order-admin.{ts,test.ts}`, `lib/database.types.ts`, `components/admin/print/print-{sheet,toolbar}.tsx`, `e2e/admin-orders.spec.ts`, `e2e/{a11y-admin,public-pages}.spec.ts`, `playwright.config.ts`. Gates: typecheck, lint (React Compiler clean), vitest **48**, i18n **332** keys in parity, `next build` green (`ƒ /admin/orders`, `◐` detail + both print routes), public suite **85/85**, authed admin suite **75/75** (72 axe combos incl. 8 new `/admin/orders`, 2 orders feature tests, setup). Next task: 5-4 inventory admin.
- 2026-10-19: Code review of `e39ba78` added section 15 (findings R1 to R12, tracks A to H). Review commit also removed `products` from the public upload-signature allow-list, validated quote `attachment_path` against our Cloudinary artwork URLs (`src/lib/validators/artwork-url.ts`, unit-tested in isolation) and added basic security headers in `next.config.ts` (no CSP yet). The full `lint`, `typecheck`, `build` and Playwright suites were not run for these changes; run them before merging.
- 2026-10-19: **Section 15 verified against the code (branch `track-a-test-safety`, HEAD `fa89959` = PR #1 merged).** R1 to R12 re-checked: all findings remain accurate except R12 (four convention-breaking commits, not three — `01e3bae` landed after the review HEAD; corrected in the table). PR #1 fixes confirmed present: upload-signature allow-list is `artwork` only; `attachment_path` validated (https + `res.cloudinary.com` + `/Primebagfactory/artwork/`); five basic security headers live. PR #1 was merged **without** running the gates its own note required — they were run on the merged tree instead: lint ✓, typecheck ✓, vitest **57/57** ✓, `next build` ✓ (Playwright suites run per task going forward). A5 reclassified as an owner/human task with the steps documented inline. Environment: Docker reachable, `bunx supabase` 2.121.0, `bun install` clean; no live-project changes were made during verification.
- 2026-10-19: **A1 done — local Supabase stack is real.** `supabase init` added `supabase/config.toml` (+ its `.gitignore` for `.temp`/local dotenvx files). Beyond the letter of the task, `[auth.email] enable_signup` is also `false` — the plan names only `[auth]`, but the per-provider flag must not silently re-open self-signup; admin **invites still work** because invites are not gated by `enable_signup`. Verified live: `supabase start` pulled Postgres 17.11 and applied **all four migrations + seed.sql cleanly on a fresh local DB**; `supabase db reset` (no `--linked`) resets the local stack only; the app was booted with shell-env overrides (they beat `.env.local`, so the live project was never contacted — no live keys were copied anywhere) and `/en` plus `/en/product/premium-delivery-bag` rendered seed catalog rows through local RLS (anon sees published only). Note for tests/CI: CLI 2.121 local keys use the new `sb_publishable_…`/`sb_secret_…` format; they pass `env.ts` zod and work with the installed supabase-js.
- 2026-10-19: **A2 done — tests are fenced to the local stack.** `e2e/test-env.ts` (shared, no new deps: hand-rolled dotenv reader) loads gitignored `.env.test` (template committed as `.env.test.example` with the CLI's documented local defaults only — no real secrets) and gives it whitelist priority over `process.env`, because `bun run test` pre-loads `.env.local` (live project) into the environment and the test values must win. `assertLocalSupabase()` runs at config load in both `playwright.config.ts` (also feeds the values to the dev server via `webServer.env`; real env beats `.env.local` in Next) and `vitest.config.ts`; verified aborts: unset URL and `https://real-project.supabase.co` both refuse with copy-the-template guidance. Vitest touches no DB today but is fenced so a future DB test can never escape. While proving A2 on the local stack: (1) a **real a11y bug** surfaced and fixed separately (`fix:` cart thumbnail link had no accessible name when a product has no image — the seed catalog is imageless, live was masking it); (2) **`reuseExistingServer` flipped to `false`** — a `bun run dev` from another terminal (the documented never-hydrates trap) was silently reused and no-op'd every click; Playwright now fails loudly on a taken :3000 instead; (3) hardened cart/checkout specs against cold starts: re-click-until-hydrated `expect.poll` (all retried actions are no-op-before-hydration or read-only, never double-write) and `waitFor` instead of immediate `count()` (which raced the PPR fallback and faked a skip). Final: vitest 57/57, `next build` ✓, Playwright **85/85** against local (75 admin skips until A3 seeds the staff user).
- 2026-10-19: **A3 done — CI runs on the local stack, seeded and secret-free.** (1) **Config correction to A1:** `[auth.email] enable_signup = false` (the A1 over-reach) had to go back to `true` — in this gotrue it disables *all email logins*, not just self-signup (token grant answers `email_provider_disabled`), so no staff account could ever sign in locally or in CI. Self-signup remains blocked by the plan's `[auth] enable_signup = false` (verified: `/signup` → `signup_disabled`), which is what the plan actually requires. Also learned: `db reset`'s "restarting containers" does **not** re-read `config.toml` for auth — a full `supabase stop && supabase start` is needed after auth config edits. (2) **Seeded staff user** (`e2e-staff@primebagfactory.test` / `E2e-Local-Stack-Only!`, role owner) in `supabase/seed.sql`. Seeds never run on hosted projects (`db push` skips `seed.sql`), so this account only ever exists in throwaway databases and CI — its password is committed on purpose and is not a secret. GoTrue v2.197 scans `auth.users` strictly, so the insert must set `instance_id` (zero UUID — a NULL one silently means `invalid_credentials`), `''` in every nullable token column (NULL → 500 on scan), provider metadata and an `auth.identities` row; proved with a real password-grant login after `db reset`. (3) **CI** rewritten: new `database` job (`supabase start` → `db reset` → `supabase test db`); `check`, `e2e` and `lighthouse` start the stack, `cp .env.test.example .env.test`, and `check` curls a seeded staff login to prove the deterministic CLI keys and the seed before anything else; workflow env now carries the documented local-stack defaults instead of `placeholder.supabase.co`. Official `supabase/setup-cli@v1` pinned `2.121.0` (bump together with the local CLI). No repository secrets exist or are referenced. `lighthouse` got the stack because the build/prod server now talk to it. The workflow interpolates no GitHub event payloads (static env only). (4) **Proof:** pgTAP 19/19, Playwright **159/160 with the admin suite finally authenticated** (only skip: order-detail, no orders in a fresh seed — by design), lint/typecheck/vitest 57/build ✓ against the local stack.
- 2026-10-19: **A4 done — `supabase/tests/phase5_fulfilment.test.sql` (42 assertions; suite total 61/61 on a fresh `db reset`).** Coverage per the task line: tier boundaries (qty 50 → 100/unit and qty 51 → 80/unit, plus the `order_items` unit-price snapshot and zone-driven free shipping), MOQ rejection, and the RLS sweep (`is(count of public tables without relrowsecurity, 0)` plus a ≥33-tables sanity so it can't pass vacuously). Oversell, idempotency replay and direct anon INSERT on `orders` were already proven in `phase1_rls.test.sql` — not duplicated. `admin_set_order_status`: anon gets 42501 (execute revoked), a customer-role session gets `not_allowed` (definer re-checks `has_role`), then the full walk as owner — confirm (no stock write), ship (stock −qty, reservation released, own `sale` movement, `shipped_at`), **double-ship is a no-op** (movement and history counts unchanged), deliver (`delivered_at`), return (stock back +qty, `return` movement), cancel-after-shipped raises `cannot_cancel_after_shipment`. `admin_record_payment`: zero amount and 501-on-500 rejected, 200 → `partially_paid` with the ledger at exactly 200, +300 → `paid`, +1 after paid rejected, customer session `not_allowed`. Two findings while writing it: (1) money/row read-backs must run after `reset role` — anon RLS *correctly* cannot see its own new order rows (phase1 asserted as postgres for the same reason); (2) `place_order` already writes a `sale` movement for the reservation, so the ship-movement assertions filter on the `Shipped stock for order` note rather than counting all `sale` rows for the order. Staff/customer fixtures are fixed `b5…` UUIDs inside the file's rolled-back transaction — nothing persistent was added.
- 2026-10-19: **A6 done — the Lighthouse gate now scores a product page.** `LIGHTHOUSE_PATHS` in CI gains `/en/product/premium-delivery-bag` (the slug `supabase/seed.sql` inserts, which the lighthouse job's own stack applies), and the same three paths become the script's default so local runs match CI. Proved by a real prod build + `bun run start` against the local stack: the page is fetched and scored. **Honest caveat:** on this dev machine (snap chromium, simulated 4G) the scores were `/en` 90-91 ✓, `/en/quote` 78-84 ✗, product 88-89 ✗ — note `/en/quote` was already under 90 *before* A6, so this is machine noise, not a regression introduced here; the only failing audit is LCP (~3.8 s; TBT 80 ms and CLS 0 are clean). CI on ubuntu-latest is the arbiter once this branch pushes; if the product page lands under 90 there, LCP work is a separate task (plan §8 perf budget) — the threshold was **not** lowered and no page was dropped. Files: `.github/workflows/ci.yml`, `scripts/lighthouse-check.ts`. Track A is now code-complete (A5 remains the owner's staging-project task).
- 2026-10-19: **PR #2 CI made the gate honest; first two levers applied.** First real run of the A3 workflow: `database` (pgTAP 61), `check` (seeded staff login included) and `e2e` all green on ubuntu-latest — the deterministic local keys matched there too. `lighthouse` failed 69/69/66 (/en, /en/quote, product): with the local stack the job now audits **real seeded pages** instead of the old placeholder-env error states, and it audits them **cold** on a slow runner. Not a regression — the §8 deferred performance debt, first measured honestly. Two fixes: (1) `fix:` the lighthouse job curls every `LIGHTHOUSE_PATHS` route once after `next start` so scores measure steady state, not PPR resume + module init; (2) `phase-3:` the diagnosed font lever from line 947 — `Inter` and `Noto_Serif_Bengali` move to `display: "optional"` (LCP here is text; swap was delaying it under 4x CPU throttle) and the `--font-bn` variable class is applied only on `/bn`, so `/en` no longer ships the ~235 KiB Bengali subset. Admin layout untouched (not audited). Threshold stays 90; if CI is still under after these, remaining levers (JS weight) are a separate owner-decided task. Also noted: GitHub push protection flagged the committed `sb_secret_…` local default (correct pattern match, wrong context — it is the CLI's public local-dev constant); owner allowed it via secret scanning rather than rewriting history.
- 2026-10-19: **Warmup+font fix landed; CI re-run: quote 69→80, product 66→88, /en stuck at exactly 69.** Home's bottleneck is therefore not fonts or cold start. `scripts/lighthouse-check.ts` now prints, for every failing page, the composing metrics (FCP/LCP/TBT/CLS/SI), the LCP element (Lighthouse 13's `lcp-breakdown-insight` with legacy fallback) and the top 3 opportunities — so the CI log explains itself. Verified locally against the **live** project (`.env.local` — read-only render; important disclosure: local prod-server numbers measure live catalog data, **not** the seed CI audits, so local and CI LCP elements can differ — e.g. product images exist only on live). Local warmed scores: 90/87/85, LCPs 3.6–4.1 s (home = hero text, quote = lazy header logo, product = live bag image). Next move is data-driven: read the CI diagnostics and fix the actual seeded-page LCP element, one lever per commit.
- 2026-10-19: **Track B owner decisions (recorded before starting).** (1) **B6 = option 2** — customer artwork moves to a **private Supabase Storage bucket `quote-attachments`** with server-issued signed upload URLs and staff read via signed URLs (matches §7 and §9b; closes R11; supersedes the Cloudinary public artwork path for quote attachments). (2) **B2/B8 defaults approved as written** — checkout 3/hour per phone and 10/hour per IP; order lookup 10 per 10 minutes per IP and 5/hour per order number; quote 5/hour per IP (plus the existing per-phone rule); upload-signature 20/hour per IP; `pending_order_hold_hours = 48`.
- 2026-10-19: **B1 done — `supabase/migrations/202610190001_track_b_rate_limits.sql`.** Reshapes the unused `rate_limits` table (dropped the Phase 1 `unique (key)` — a fixed window needs one row per `(key, window_start)`, constraint `rate_limits_key_window_start_key` so the upsert can target it by name) and adds `check_rate_limit(text, integer, integer)`: SECURITY DEFINER, `set search_path = ''`, fixed-window = now() floored to a multiple of the window, `insert … on conflict do update count+1 returning count <= p_limit` (the 4th call at limit 3 returns false — the track's Done-when), invalid args raise `invalid_rate_limit_args`. Cleanup is two-layered: on rotation a key prunes its own expired windows, and a `prune_rate_limits()` definer (revoked from every login role; only the cron owner runs it) sweeps rows older than 1 day via a **pg_cron** job named `prune-rate-limits` (*/15 min). Two gotchas found live: pg_cron is *not* pre-installed locally and `CREATE EXTENSION … WITH SCHEMA cron` must create the schema itself — pre-running `create schema cron` makes the install fail (script hard-codes it); both enable paths are wrapped in tolerated DO-block exceptions so the migration never hard-fails where cron is unavailable (the rotation prune is the safety net). Scheduled job verified active after a clean `db reset`. Tests: `supabase/tests/track_b_rate_limits.test.sql` — 19 assertions (shape, definer+search_path, counter incl. the reject-the-4th case, per-key isolation, single row per window, rotation + global prune, arg validation, anon/authenticated 42501); full suite **80/80** via `bunx supabase test db`. `database.types.ts` got the hand-written `check_rate_limit` entry in the existing pattern (full `supabase gen types` regeneration stays H2). Gates: lint/typecheck/vitest/build ✓, `supabase test db` ✓.
- 2026-10-19: **B2 done — `src/server/abuse.ts`.** Six named rules (`checkout_phone` 3/h, `checkout_ip` 10/h, `lookup_ip` 10/10min, `lookup_order` 5/h, `quote_ip` 5/h, `upload_ip` 20/h — exactly the approved defaults, asserted in a unit test), overridable per rule through the `settings.rate_limits` jsonb row (only positive-integer `limit`/`windowSeconds` accepted; anything malformed falls back to that rule's default; read every call through the anon client — the row is tiny and public-read, so no cache to invalidate). `getClientKey()` = SHA-256(`salt:ip`) of the first XFF hop — keys and logs never carry raw IPs (9b "no PII in logs"); a malformed leading-comma header yields null and callers skip IP rules rather than trusting a later hop. `limit(key, rule)` calls the B1 RPC via the service-role client and **fails open** (log the error, allow) — a limiter outage must not kill checkout, matching the settings fail-open rule; a live smoke through PostgREST proved both ends: service_role got `true,true,true,false` at limit 3 and anon got `42501`. `normalizePhone()` (+880/880 → 0, Bangla digits, strips separators) lands here because both B2 keys and the B4 blocklist need one canonical phone. `RATE_LIMIT_SALT` documented in `.env.example`; deliberately read lazily from `process.env` with an insecure-dev fallback salt (same pattern as Resend/Cloudinary optional vars) instead of hardening `env.server.ts` — CI and local runs must keep working without a new secret. Vitest gained a `server-only → empty.js` alias so `src/server` modules are unit-testable under Node (12 new tests; suite 57→69). Files: `src/server/abuse.{ts,test.ts}`, `vitest.config.ts`, `.env.example`. Gates: lint/typecheck/vitest 69/build ✓.
- 2026-10-19: **CI diagnostics answered; two targeted LCP fixes.** With the warmup the gate printed 89/88/88 and the real culprits: (1) `/en` LCP was the hero `<p>` at 3.3 s against a 1.1 s FCP because `page.tsx` awaited four DB queries at the top level — the *entire* page, hero included, streamed as one PPR dynamic chunk. Split: hero + Why (translations only) now render in the prerendered shell; featured/categories/collections moved into an async `HomeSections` under `<Suspense>` with a dimension-matched skeleton. (2) `/en/quote` LCP was the lazy header logo image — `ThemeLogo`'s light variant is now `priority` (supersedes the 2026-10-18 "never priority" note: with `sizes="140px"` the preload is one small raster, and CI data shows it *is* the LCP there; the dark variant stays lazy and is never fetched in light mode). Product's LCP is its `<h1>` — inherent to request-time slug resolution (title needs the DB), left alone. Gates: lint/typecheck/vitest 57/build ✓, home+public e2e green after clearing a stale Turbopack `.next` cache (two initial axe "failures" on checkout/contact were the dev-error overlay, not violations). CI re-run decides.
- 2026-10-20: **B3 done — limits live on all four entrances, and the honeypot now actually pretends success.** `placeCheckoutOrder`: `checkout_phone` (normalized) then `checkout_ip` (salted key) after the honeypot, before flags/DB; `lookupOrder`: `lookup_ip` + `lookup_order` over-limit answers the **identical** `errNotFound` as a miss (B5 spirit — a flood must not learn the pair exists nor that it hit a wall); `submitQuote`: `quote_ip` added **before** the existing rolling per-phone DB count (kept — it also blocks service outages); `/api/upload-signature`: folder allow-list checked **before** the counter (probing bad folders must not burn the window) → over-limit answers `429 {error:"rate_limited"}`. New `checkout.errRateLimited` in en+bn (i18n 333 keys). **Two real bugs the new e2e caught:** (1) the honeypot was unreachable — client-side zod (`website.max(0)`) rejected baited payloads *before the POST*, and the server checked honeypot only *after* its own parse, so a bot got a silent validation dead-end instead of fake success; fixed by exempting `website` from the client pass (`checkout-form.tsx` validates `{...payload, website:""}`) and hoisting a loose pre-parse honeypot read in the action (quote was already correct — FormData action checks bait before zod, native form posts skip client zod entirely). (2) local browser traffic **does** carry `x-forwarded-for`, so repeated e2e runs shared the 127.0.0.1 `checkout_ip` bucket and the 10/hour budget got exhausted across runs (first real sign the limiter bites in the browser); the spec now sets a random XFF per test, phones stay random, and the gate run uses a fresh `db reset` like CI. **Review fixes folded in (owner 2026-10-20):** `getClientKey()` no longer trusts the spoofable leftmost XFF on Vercel — `pickClientIp()` reads `x-vercel-forwarded-for` else `x-real-ip` there, XFF only off-Vercel (local/e2e), 3 new unit tests; and `limit()` keeps failing open but now logs a one-line structured JSON (`abuse.limiter` / `check_rate_limit_failed`) carrying only the rule kind + numbers — never the key (it embeds a phone) and never an IP. Files: `checkout/actions.ts`, `quote/actions.ts`, `upload-signature/route.ts`, `checkout-form.tsx`, `abuse.{ts,test.ts}`, `messages/{en,bn}.json`, `e2e/abuse.spec.ts` (new, 3 tests). Gates against the local stack: lint ✓, typecheck ✓, vitest **72** ✓, build ✓, i18n 333 ✓, pgTAP **80/80** ✓, Playwright abuse+checkout+cart **7/7** ✓ (4th-checkout-rejected, honeypot silent ×4 past the phone budget, 429 at call 21/22).
