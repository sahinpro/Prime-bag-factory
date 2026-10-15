# Prime Bag Factory: Master Plan

> Cursor: read this file and `AGENTS.md` before every task. This plan is the source of truth.
> If code and plan disagree, stop and ask. If the plan is silent, pick the simplest option and note it under "Decision Log".

---

## 0. Working Rules for Cursor

1. **Plan first.** Before coding a task, restate the task, list files you will touch, then implement.
2. **One phase at a time, in order.** Do not start a phase until the previous phase's "Done when" is met.
3. **Small commits.** One task = one commit. Message format: `phase-N: short description`.
4. **Tick the checkbox** in this file when a task is finished. Add notes under "Decision Log" (section 14).
5. **No new libraries** outside section 3 without asking.
6. **Validate twice.** Every form and server action is validated with `zod` on client and server.
7. **Never expose** the Supabase service-role key to the browser. It lives only in `src/lib/supabase/admin.ts` (server only).
8. **Never copy** a competitor's UI, text, photos, client logos or legal documents. We follow the *idea and strategy* only, and do it better.
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
- **Strategy:** follow a proven competitor's *structure* (use-case category pages, client proof, quote form, trust documents), and improve on it (see section 13).

### Locked decisions
| Topic | Decision |
|---|---|
| Stack | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase |
| Brand color | **Golden** (antique gold + ink + ivory), changed from orange (section 4) |
| Sales | Retail items: online checkout. Bulk/custom: quote request or the **Custom Bag Builder** (section 2c) |
| Quantity pricing | Every product has an MOQ and admin-defined quantity ranges (e.g. 5-50 pcs = one rate, 51-100 pcs = another) (section 2a) |
| Customization | Fabric/color swatch library + multi-step Custom Bag Builder: color, size, zipper and every other part, logo, notes (sections 2b, 2c) |
| Custom order flow | **Confirmed:** builder shows an estimate, the team confirms the final price, then the order is created (builder request, then Convert to order) |
| Quantity-range counting | **Confirmed:** total quantity of the same product across all colors and sizes |
| Builder preview | **Confirmed:** selection summary only at launch, no live color preview |
| Payment at launch | **COD only** (design so bKash/Nagad can be added later) |
| Inventory | **Variant-level stock + reserved stock + low-stock alert + movement log**. Schema must allow suppliers/purchasing/raw material later (not built now) |
| Languages | Bangla + English switch in the header (content in both). Accessibility baseline: WCAG 2.2 AA (section 3c) |
| Theme | Light / Dark / System toggle, default System (sections 3c, 4a) |

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

| Quantity | Unit price |
|---|---|
| 5-50 pcs | rate A |
| 51-100 pcs | rate B |
| 101-500 pcs | rate C |
| 501+ pcs | rate D |

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
- Forms: `react-hook-form` + `zod`. Tables: `@tanstack/react-table`. Server state: server components and server actions first.
- i18n: `next-intl` (`/en` and `/bn` routes).
- Fonts: `Inter` (Latin) + `Hind Siliguri` (Bangla) via `next/font/google`.
- Theme: `next-themes`. Server guard: `server-only`. Testing: `vitest`, `@playwright/test`, `@axe-core/playwright`.
- Optional later: Cloudflare Turnstile (spam), Resend (email).

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
- Header and admin top bar get a theme menu with **Light, Dark, System**: translated labels, `aria-label`, keyboard operable, current choice indicated.
- Components use semantic tokens only (section 4a). No raw hex in components; `dark:` utilities only for exceptions.
- Logo: render both variants and switch with CSS (`dark:hidden` / `hidden dark:block`) so there is no flash.
- Product photos sit on a neutral light container in dark mode so white-background photos do not look boxed.
- The favicon follows the OS/browser theme, not the site toggle (section 4b).
- Every key page must pass axe in both themes.

### Language (Bangla / English)
- `next-intl`, routes `/en/...` and `/bn/...`, `localePrefix: "always"`. `/` redirects by `NEXT_LOCALE` cookie, then `Accept-Language`, then the default (English; changeable in `routing.ts`).
- Header language switcher with labels "EN" and "বাংলা", each written in its own language; keeps the current page and query string; choice stored in the `NEXT_LOCALE` cookie.
- `<html lang>` per locale; wrap inline text in another language with `lang`. `hreflang` alternates plus `x-default` on every public page.
- UI strings in `src/messages/{en,bn}.json`, grouped by feature. `bun run i18n:check` fails CI when a key exists in one file only. No hard-coded user-facing strings in components.
- DB content uses `_en` / `_bn` columns; Bangla falls back to English when empty. Admin shows a "Missing Bangla" badge and a dashboard counter.
- All formatting goes through `src/lib/format.ts`: money with the ৳ symbol via `Intl.NumberFormat`, dates in `Asia/Dhaka`, numbers by locale (`bn-BD` shows Bangla digits).
- **Input normalization:** accept Bangla digits (০-৯) in phone, quantity and size fields; convert to ASCII digits before zod validation and storage.
- Fonts: Hind Siliguri for Bangla with roomier line-height (about 1.7 for body); subset weights 400/600/700; `display: swap`.
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

| Token | Value | Use |
|---|---|---|
| `--brand` | `#C8962E` | Primary buttons, icons, highlights. Put **ink text** on it (about 6.5:1) |
| `--brand-hover` | `#B07F1F` | Button hover (ink text still passes, about 4.9:1) |
| `--gold-deep` | `#8A6414` | Gold text and links on light backgrounds (about 5:1 on ivory) |
| `--gold-soft` | `#F1E3B8` | Tints, badges, selected states |
| `--ink` | `#1C1917` | Text, dark sections, footer. Gold text on ink is fine (about 6.5:1) |
| `--ivory` | `#FBF8F1` | Page background |
| `--surface` | `#FFFFFF` | Cards |
| `--accent` | `#1F5F4A` | Optional: success and "verified/trust" badges (white text about 7.5:1) |

Dark mode values are in section 4a. Components use the semantic tokens there, not the raw palette above.

### 4a. Semantic tokens (light and dark)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#FBF8F1` | `#141210` | Page |
| `--surface` | `#FFFFFF` | `#1C1917` | Cards, dialogs |
| `--foreground` | `#1C1917` | `#FBF8F1` | Text |
| `--muted-foreground` | `#6B645C` | `#A8A29E` | Secondary text (about 5.5:1 / 7.4:1) |
| `--border` | `#E7E0D3` | `#3A332E` | Decorative dividers only |
| `--input-border` | `#8C8378` | `#78716C` | Input and control boundaries (3:1 or more) |
| `--brand` | `#C8962E` | `#C8962E` | Buttons, highlights |
| `--brand-foreground` | `#1C1917` | `#1C1917` | Text on gold |
| `--gold-text` | `#8A6414` | `#D9AE4F` | Gold text and links on the page (about 5:1 / 9:1) |
| `--focus` | `#1C1917` | `#FBF8F1` | Focus ring |
| `--accent` | `#1F5F4A` | `#4FB08A` | Success, trust badges (about 7.5:1 / 7:1) |

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
  components/ ui/ site/ admin/
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
- `categories` (parent_id, slug unique, name_en, name_bn, description_en/bn, image_path, seo_title_*, seo_description_*, sort_order, is_active)
- `collections` (slug, name_en/bn, description, image_path, sort_order, is_active)
- `products` (slug unique, type enum buy_now|quote_only, title_en/bn, short_description_*, description_*, specs jsonb, material, moq int not null default 1 (check >= 1), lead_time_days, stock_mode enum tracked|made_to_order, customization_enabled bool default false, status enum draft|published|archived, is_featured, seo_*)
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
- `coupons` (code, type percent|fixed, value, min_subtotal, starts_at, ends_at, usage_limit, is_active) *(Phase 5, low priority)*

**Quotes (RFQ)**
- `quote_requests` (source enum: form | builder, company_name, contact_name, phone, email, product_id nullable, category_id nullable, quantity, custom_size, custom_color, needs_logo_print bool, customization jsonb nullable, estimated_unit_price nullable, estimated_total nullable, needed_by date nullable, message, attachment_path, status enum: new | contacted | quoted | won | lost, quoted_amount, valid_until date nullable, assigned_to, internal_notes)

**Content**
- `site_sections` (page, key, content jsonb, sort_order, is_active) for homepage blocks, banners, stats
- `clients` (name, logo_path, sort_order, is_active)
- `gallery_items` (image_path, caption, sort_order)
- `testimonials` (name, company, rating, body_en/bn)
- `faqs` (question_en/bn, answer_en/bn, sort_order)
- `posts` (slug, title_*, body_*, cover_path, status, published_at, seo_*)
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
| Event | Effect |
|---|---|
| Order placed | `reserved_qty += qty` |
| Order shipped | `stock_qty -= qty`, `reserved_qty -= qty`, movement `sale` |
| Cancelled before shipped | `reserved_qty -= qty`, movement `cancel_release` |
| Returned | `stock_qty += qty`, movement `return` |
| Manual change | movement `adjustment` / `damage` / `purchase` with required note |

Low-stock: `available <= low_stock_threshold` shows in the admin dashboard. Products with `stock_mode = made_to_order` (all customizable products) skip stock checks and reservations.

---

## 8. Public Site Spec

**Header and footer (all pages):** logo, mega-menu, search, **language switcher (EN | বাংলা)**, **theme toggle (Light / Dark / System)**, Request a Quote button. Sticky WhatsApp and Messenger buttons. Footer: policy links (Terms, Privacy, Returns & Refunds, Shipping, Custom Order & Advance Payment), contact, social links, legal documents.

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

| Module | Must have |
|---|---|
| Dashboard | New quotes, pending orders, low-stock list, sales (7/30 days), missing Bangla translations counter |
| Categories | Tree view, drag to reorder, bn/en names, image, SEO fields, active toggle |
| Products | Tabs: **General** (type, bn/en content, specs, categories, collections, MOQ, lead time, stock mode), **Pricing** (quantity-range tier editor with validation and live preview), **Variants** (SKU, fabric swatch, size, price delta, stock), **Customization** (enable builder, define parts, allowed swatches per part, size limits, extra prices), **Images** (upload, reorder, alt text, per variant), **SEO**. Plus draft/publish, duplicate product, bulk status change, **CSV import/export** (products, variants, stock) and bulk image upload |
| Swatch Library | Manage swatch groups and swatches (name en/bn, code, hex, fabric texture photo), reorder, activate/deactivate, see which products use a swatch |
| Inventory | Variant stock list, available vs reserved, adjust stock (with reason and note), movement history, low-stock threshold, CSV export |
| Orders | List and filters, detail, status change with history, **record payments** (COD collected, advance, balance) with paid and balance due, courier and tracking code, **production status and artwork approval** (bulk/custom), confirmation-call status, block phone, admin note, printable invoice/packing slip |
| Quotes | Inbox with status pipeline and a `form` / `builder` filter, view attachment, assign to staff, add quoted amount and notes, builder requests shown with color chips and every selected part, **printable production spec sheet**, printable quotation (proforma) with validity date, **Convert to order** (creates `bulk` order), WhatsApp/phone quick links |
| Customers | Derived from orders/quotes, grouped by phone, order and quote history |
| Content | Homepage sections, banners, clients, gallery, testimonials, FAQ, blog, legal documents, redirects |
| Users | Invite staff, assign role, deactivate |
| Settings | Company info, contact numbers, WhatsApp/Messenger, social links, shipping zones, VAT, SEO defaults, feature flags (`cod_enabled`, `checkout_enabled`, `custom_order_mode`, `maintenance_mode`), notification channels, policy pages |
| Audit log | Who changed what, when (read-only) |

---

## 9b. Launch Readiness (e-commerce essentials, do not skip)

| Area | Must be ready at launch |
|---|---|
| Policies | Terms, Privacy, Returns & Refunds, Shipping/Delivery, and Custom Order & Advance Payment (custom items are made to order and not returnable; advance %, lead time, artwork approval), in both languages, linked in footer and checkout |
| Payments | COD for retail. Custom/bulk orders need an **advance**: record manual bKash/Nagad/bank payments in the `payments` ledger, show paid and balance due, status `partially_paid` |
| Delivery | Courier name and tracking code on the order (manual entry at launch), shipping zones, delivered date, failed-delivery and return handling |
| Order flow | Idempotency key (no duplicate orders on double tap), confirmation-call status, phone/IP blocklist, order lookup by order number + phone |
| Custom orders | Artwork approval and `production_status`, printable quotation with validity date, production spec sheet |
| Notifications | Admin alert for every new order and quote (email now, WhatsApp click-to-chat link). Customer confirmation on the order page, plus email if provided; SMS provider later. All through the `notifications` outbox |
| Tax and invoice | Decide whether prices include VAT; invoice and quotation show business name, address, BIN, VAT line and order number |
| Marketing and analytics | GA4 ecommerce events (`view_item`, `add_to_cart`, `begin_checkout`, `purchase`, `generate_lead` for quotes); Meta Pixel (Facebook is the main channel in Bangladesh; add Conversions API later); Search Console; Google Business Profile with `LocalBusiness` schema and map link; Open Graph/Twitter tags with product image for Facebook and WhatsApp sharing; Facebook page link plus Messenger and WhatsApp buttons |
| Catalog loading | Admin CSV import/export for products, variants and stock, plus bulk image upload, so about 200 products can be loaded without typing each one |
| Performance | Mobile 4G target: LCP under 2.5s on home and product pages; WebP images resized on upload (about 300 KB max); dynamic-import the builder; Bangla font subset |
| Infra and ops | Separate staging and production Supabase projects; production on paid plans (check current limits: Vercel Hobby is for non-commercial use, Supabase free projects pause when inactive and have no managed backups); regions near Bangladesh; daily backups verified by a test restore; uptime check; error monitoring |
| Security | MFA (TOTP) for owner and manager; CSP and security headers; upload validation; rate limits; RLS tests; no PII in logs |
| Business email and DNS | `info@` mailbox on the domain; SPF, DKIM and DMARC for any email sender |

---

## 10. Phases and Tasks

### Phase 0: Setup
- [x] Remove default `create-next-app` page content in `src/app/page.tsx`.
- [ ] Add brand tokens (section 4) to `globals.css`; set fonts (Inter + Hind Siliguri).
- [ ] Copy logo v1 assets into `public/brand/` (section 4b), build the `<Logo>` component (section 4c), wire favicon metadata (use the ivory favicon as a temporary fallback until the light/dark pair exists).
- [ ] Init shadcn/ui; add base components (button, input, form, dialog, table, tabs, badge, toast, dropdown, sheet).
- [ ] Create Supabase project, add env vars, `.env.example`.
- [ ] Add Supabase clients (`client.ts`, `server.ts`, `admin.ts`).
- [ ] Set up `next-intl` with `/en` and `/bn`, the language switcher, `format.ts` helpers and the `i18n:check` script (section 3c).
- [ ] Set up `next-themes`, light/dark semantic tokens (4a) and the theme toggle with no flash on load.
- [ ] Accessibility base: skip link, focus ring, landmarks, reduced-motion styles (section 3c).
- [ ] Create `src/lib/env.ts` (zod-validated env), the `src/server/` folder with `server-only`, and a `requireRole()` stub (section 3b).
- [ ] Tooling: Vitest, Playwright + axe, GitHub Actions CI (lint, typecheck, unit tests, build, i18n check).
- [ ] Update `AGENTS.md` with the rules from section 0 and the conventions in section 12.
- **Done when:** app runs, tokens work in light and dark, `/en` and `/bn` render a placeholder home, theme toggle and language switcher work with no flash, CI is green.

### Phase 1: Database, auth, RLS
- [ ] Write migrations for all tables in section 7 (except coupons).
- [ ] Add enums, indexes (slugs, foreign keys, status columns), `updated_at` triggers.
- [ ] Write RLS policies and `has_role()`.
- [ ] Write `place_order` RPC and inventory movement logic.
- [ ] `seed.sql`: categories (section 6), swatch groups and sample swatches, one demo product with variants, quantity ranges and builder parts, shipping zones, settings.
- [ ] Generate TypeScript types from the DB.
- [ ] Auth: login page for staff, middleware protecting `/admin`, first owner user.
- **Done when:** RLS tests prove anon cannot read drafts or write orders directly, and `place_order` blocks overselling.

### Phase 2: Admin catalog
- [ ] Admin layout (sidebar, topbar, breadcrumbs, role-aware nav).
- [ ] Categories CRUD (tree + reorder).
- [ ] Collections CRUD.
- [ ] Media upload component (Supabase Storage, image compression/resizing on upload).
- [ ] Swatch Library CRUD (groups, swatches, texture photo upload).
- [ ] Products CRUD with tabs: general, pricing (MOQ + quantity-range editor with validation), variants (swatch link, price delta, stock), images, categories, collections, SEO.
- [ ] Customization tab: enable builder, define parts, allowed swatches, size limits, extra prices.
- **Done when:** staff can create a complete product with 8 color variants, quantity ranges (e.g. 5-50 and 51-100 pcs) and builder options, then publish it.

### Phase 3: Public catalog + quote (soft-launch milestone)
- [ ] Site layout (header, mega menu from DB categories, footer, language switch, WhatsApp button).
- [ ] Home, category, collection, product, search pages.
- [ ] Quote form + server action + file upload + success page.
- [ ] Product page: swatch chips, MOQ-aware quantity input, quantity-range table with live price.
- [ ] Custom Bag Builder wizard (section 2c) that submits a `builder` quote request.
- [ ] Static pages: about, contact, FAQ, legal documents, clients.
- [ ] SEO: metadata, sitemap, robots, JSON-LD, hreflang.
- [ ] Performance pass (Lighthouse mobile 90+ on home and product).
- **Done when:** site works as a catalog plus quote plus custom-builder site on real data.

### Phase 4: Admin quotes + content
- [ ] Quotes inbox, detail, status pipeline, assignment, notes, attachment view, builder-request view with color chips, printable production spec sheet and printable quotation (validity date).
- [ ] Notification on new quote (email or WhatsApp link; provider TBD with owner).
- [ ] Content admin: homepage sections, clients, gallery, testimonials, FAQ, legal docs, blog, redirects.
- **Done when:** owner can run the marketing content and handle quotes without a developer.

### Phase 5: Commerce (COD)
- [ ] Cart (client state, persisted), stock check on add (skipped for made-to-order), MOQ enforcement and quantity-range pricing across the cart.
- [ ] Checkout form + `place_order` RPC + confirmation page + order lookup by order number and phone.
- [ ] Admin orders: list, detail, status history, mark paid, notes, invoice/packing slip print view.
- [ ] Inventory admin: adjustments, movement history, low-stock alerts.
- [ ] Shipping zones in admin and used in checkout.
- [ ] Anti-abuse for COD: honeypot, rate limit per IP/phone, BD phone validation, optional Turnstile.
- [ ] Quote to order conversion (`bulk` order).
- [ ] Payments ledger: record advance and balance payments, `partially_paid` status, amount paid and balance due on the order.
- [ ] Courier name, tracking code, shipped and delivered dates on orders.
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

## Decision Log
*(Cursor: append dated notes here when you make a choice the plan did not specify.)*

- 2026-10-15: Plan refactored: quantity-range pricing (2a), swatch library (2b), Custom Bag Builder (2c). Owner answered items 11, 12 and 17 in section 14; they are now locked decisions in section 1.
- 2026-10-15: Brand color changed from orange to a golden palette (section 4); added logo/favicon asset spec (4b).
- 2026-10-15: Logo v1 received (4 SVGs); usage rules in 4c, known issues in 4d. Owner will fix the logo himself.
- 2026-10-15: Added architecture (3b), theme/language/accessibility (3c), semantic light/dark tokens (4a), launch readiness (9b) and matching schema, admin and phase changes.
