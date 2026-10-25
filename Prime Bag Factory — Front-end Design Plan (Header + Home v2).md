# Prime Bag Factory — Front-end Design Plan (Header + Home v2)

Status: admin is finished. This plan replaces the loose "Home" and "Header and footer" bullets in plan.md section 8 and extends track G2. Cursor reads this, then implements one task per commit (`phase-fe: ...`). Nothing here changes the database or the admin.

## 0. How Cursor uses this document

- Insert sections 1 to 9 into plan.md as a new **section 8b: Public Front-end Design (Header + Home v2)**.
- In plan.md section 8, replace the "Home" paragraph with: "Home follows section 8b." Keep the "Header and footer" paragraph but add: "Header v2 follows section 8b.3."
- In section 15.2, split **G2** into the tasks FE-0 to FE-9 from section 9 below.
- Append the Decision Log entry from section 10.
- Rule 8 of plan.md still applies: the reference image gives us a **layout pattern only**. Never copy its text, photos, name or product shots.
- No new libraries. Public icons stay Hugeicons. No motion library (it was removed for performance).

## 1. What we take from the reference, and what we change

The reference is a bento-style fashion storefront: one white card on a warm beige page, a pill header, a big rounded hero tile with a floating glass product card, a narrow side column, and a full-width "most loved" product strip.

**Take (layout and feel):**

- Header: wordmark left, short centered nav with one dropdown, a pill search field with a round icon, a pill contact button, and a cart icon in a round chip with a count badge.
- Hero: a large rounded tile, a "new arrival" label with three color dots, a very large light headline, one small supporting line with an arrow link, and a frosted floating card showing one product with prev/next arrows.
- Side column: one image card, a short heading with two lines of text, a thin divider, then a heading and outlined pill chips for collections.
- Product strip: a soft grey rounded band, a light heading with an arrow, a small paragraph, three product tiles with name, bold price and a round "+" button, a progress bar with a counter (1/8) and round prev/next buttons.
- Overall: generous radii, almost no borders, soft surfaces, lots of whitespace, photography does the work.

**Change (because our business is different):**

- We are quote-first B2B plus ready-stock retail. The header primary button is **Get a quote**, not "Contact us". Call/WhatsApp becomes a secondary round button.
- The three color dots become **real fabric swatches** from the Swatch Library. They link into the Custom Bag Builder. This is our one memorable element.
- Collections chips become **use-case chips** (Food delivery, Cake and bakery, Pharma, Seminar, NGO, Backpacks, Jute) from our collections and categories.
- The "+" on a product tile cannot blindly add to cart (MOQ, quantity-range pricing, variants). In v1 it is a link to the product page. Quick-add is an optional later task.
- Prices show "from ৳X / pc" (lowest tier) plus the MOQ, never a fake single price.
- Headline text must not sit on a busy photo. In the reference the headline touches the bag. We keep text on the plain tinted tile so contrast always passes.
- The glass card falls back to a solid surface when transparency is reduced or unsupported.
- Everything is bilingual (EN/BN), works in dark mode, and respects the Bangla 18px floor.

**Distinctiveness check.** A cream background with a warm accent is a common default look. Our palette (ivory, antique gold, ink) is a locked owner decision, so we keep it. We earn distinctiveness through content instead: the swatch-driven hero, real factory proof, and the builder band. We spend boldness in one place (the hero swatches plus floating card) and keep every other section quiet.

## 2. Design tokens and type

Use the existing semantic tokens only. No new raw hex in components.

**Brand colors and combinations (owner rule).** We use our own brand palette and pairings only. The reference's beige page, white card on beige, and rust accent are not used anywhere.

- Page: ivory (`--background`). Cards and the hero tile: white (`--surface`). Soft panels: `--surface-2`.
- Ink (`--foreground`) for headings, logo and the one dark band. Never pure black.
- Antique gold (`--primary`) only for the primary button, the active nav underline, swatch rings and small highlights. Ink text sits on gold. Gold text on light backgrounds uses `--gold-text`.
- `--gold-soft` for the photo panel behind the hero product, chips and badges.
- Forest green (`--success`) only for trust and verified badges.
- Allowed pairings: ink on ivory, ink on white, ink on gold, ivory on ink, gold on ink (buttons and large text). Not allowed: gold text on ivory or white, gold on gold-soft, any new brand hue, colored gradients.
- Product photos bring their own colors; the interface around them stays inside this palette.
- Dark mode uses the dark values of the same tokens. There is no second palette.

**Color roles (repo values):**

- Page: `--background` (ivory, dark `#141210`).
- Panels and cards: `--surface` (white, dark `#1C1917`).
- Soft panels (best-seller strip, product tile backs): `--surface-2`.
- Hero tile: `--surface` (white) fill on the ivory page, with a `--gold-soft` rounded panel behind the product photo. In dark mode: `--surface` fill with a `--surface-2` panel. Ink text, gold primary button.
- Primary action: `--primary` (antique gold) with ink text (`--primary-foreground`).
- Gold text and active underline: `--gold-text`.
- Text: `--foreground`, secondary `--muted-foreground`.
- Ink band (builder promo only): `--ink` background, ivory text, gold button.

**New public tokens (add to globals.css, light and dark):**

- `--glass-bg`: light `rgb(255 255 255 / 0.62)`, dark `rgb(28 25 23 / 0.62)`.
- `--glass-border`: light `rgb(28 25 23 / 0.10)`, dark `rgb(251 248 241 / 0.14)`.
- `--radius-tile`: 20px. `--radius-panel`: 28px. Pills use full radius. Existing `--radius-card` (16px) stays for small tiles.
- Verify contrast with the real components in both themes before ticking each task.

**Typography (decision, driven by performance and Bangla):**

- One Latin family (Inter, already self-hosted) and Noto Serif Bengali for Bangla. Do not add a third font family. Fonts are already the biggest resource (G6a), so we get character from scale and weight contrast instead.
- Display (h1): Inter 500, `clamp(2.5rem, 1.2rem + 4.2vw, 4.5rem)`, line-height 1.05, letter-spacing -0.025em, max width about 14 characters per line so it wraps to 2 or 3 lines.
- Section titles (h2): Inter 500, `clamp(1.75rem, 1.2rem + 1.6vw, 2.5rem)`, line-height 1.15.
- Card title 16/24 weight 500. Price 15/22 weight 600 with tabular numbers. Secondary text 14/22.
- English text never goes below 13px. **Bangla text is at least 18px everywhere in main and footer** (existing e2e enforces it). Bangla display headline uses weight 400 (only 400 and 700 are bundled) at `clamp(2rem, 1.1rem + 3.4vw, 3.5rem)` with line-height 1.3, not 1.7. Bangla body keeps 1.7.
- No all-caps labels, no single highlighted word in a headline, no tracked eyebrow above every heading.
- Numbered markers only where the content is a true sequence (the ordering steps).

**Layout rules:**

- Page container max 1440px, gutters 16 / 24 / 32 at mobile / tablet / desktop. Section gap 24px (mobile) to 32px (desktop). Inside bento grids the gap is 16px.
- Touch targets at least 44x44 on mobile. The reference chips are about 28px tall, so ours are 40px on desktop and 44px on touch.
- One restrained motion moment: on first load the glass card rises 12px and fades in over 200ms. No scroll-triggered reveals. Hover and press feedback only. Everything respects `prefers-reduced-motion`.

## 3. Header v2 (restyle of the existing site header)

Keep every current behavior: bilingual labels, DB-driven mega-menu, search, cart link with count, language switcher, theme toggle, sticky behavior, active link state, skip link. Restyle and reorganize only.

**Desktop (1280 and up), height fixed at h-16:**

```
[Logo]   Shop v   Industries v   Build your bag   About   Contact      (o Search...)  (phone)  [Get a quote]  (cart 2)  (lang)  (theme)
```

- Logo: the existing `<Logo>` component. Mark only below 24px height.
- Nav (max 5 items): **Shop** (mega-menu from DB categories), **Industries** (mega-menu list of collections), **Build your bag** (link to the builder), **About**, **Contact**. Active item gets a 2px `--gold-text` underline and `aria-current="page"`. Clients and FAQ live in About and the footer, not the header.
- Search: pill field, 220px wide, `--surface-2` background, a round ink icon button on its left (Hugeicons search), placeholder "Search bags". Submits to the existing `/search?q=` route. Under 1280 it collapses to an icon button that opens a dialog.
- Phone: round 40px secondary button (ghost) with phone icon. It links to `tel:` and has an accessible label with the number. Hidden under 1280 (the floating WhatsApp button already covers it).
- **Get a quote**: pill, `--primary` background, ink text, links to /quote. Hidden under 640 (it lives in the mobile sheet and the sticky contact area).
- Cart: round 40px chip on `--surface-2` with a badge at the top right (ink background, ivory text, min 20px). Label: "Cart, N items". The count is client-only (localStorage), so reserve the badge space to avoid layout shift and render the number after hydration.
- Language and theme: keep the existing shared 32px boxes. Do not change their behavior.
- Right-cluster collapse order as the viewport shrinks: first hide Phone, then collapse Search to an icon, then hide Get a quote (moves to the sheet).
- Scroll state: add a 1px bottom border and a faint shadow after the page scrolls 8px (use an IntersectionObserver sentinel, not a scroll listener). Solid `--background` fill, no backdrop blur on the bar.

**Mega-menu panel:**

- Disclosure pattern: a button with `aria-expanded`, opens on click, Enter, Space and hover, closes on Escape, outside click and focus leaving the panel. Hover is never the only way.
- Panel width follows the page container, `--radius-panel` bottom corners, `--surface` fill, soft shadow in light, border only in dark.
- Shop panel: 3 or 4 columns of category groups (group title plus up to 6 links, with "View all" at the end of each), and one feature tile on the right (a product or builder image, a short line, a link). Names only, no counts.
- Industries panel: a two-column list of collections with a small icon each.
- Server-rendered from cached category and collection readers. Only the open/close state is a client island.

**Mobile and tablet (under 1024):**

```
[Logo]                      (search) (cart 2) (menu)
```

- The menu opens a Sheet from the right with focus trap and Escape to close: search field first, then Shop and Industries as accordions, then About and Contact, then a full-width **Get a quote** button, a Call and WhatsApp row, and finally the language and theme controls.
- Header height stays h-16 in both languages. Do not change the root font size on /bn.

## 4. Home page sections (order and spec)

Every section reads real data (database through cached readers, or messages). **A section with no real content is hidden, never filled with fake logos or invented numbers.** Exactly one `h1` (hero). All other section titles are `h2`.

### 4.1 Hero bento (above the fold)

Desktop 1280 and up, 12 columns, hero tile 8 columns by about 520px, side column 4 columns:

```
+---------------------------------------------------------+ +----------------------------+
| Pick a fabric   (o)(o)(o)(o)            [ product photo  | | [ lifestyle photo 16:10 ]  |
|                                           4:5, rounded   | | Made for your business     |
| H1: 2 to 3 lines                         ]               | | one or two lines of text   |
| supporting line (one sentence)                           | | -------------------------- |
| [Get a quote]  [Build your bag]    +--glass card----+   | | Shop by use                |
|                                    | thumb  Name    |   | | (Food) (Cake) (Pharma)     |
|                                    | Get a quote  <>|   | | (Seminar) (NGO) (Jute)     |
|                                    +----------------+   | |                            |
+---------------------------------------------------------+ +----------------------------+
```

- Hero tile: `--surface` background, `--radius-panel`, a `--gold-soft` panel behind the product photo, and a faint stitched-line curve as a decorative SVG (`aria-hidden`). Headline and buttons stay on the plain white tile and never overlap the photo.
- "Pick a fabric" row: 4 round swatches (44px) from the active **fabric** group of the Swatch Library, texture photo if present, else hex. Each one is a link to `/builder?fabric=<code>` with the label "Customize with \<name>". They are links, not radios, so there is no selected state. Hide the row when fewer than 3 swatches exist.
- Headline: short and concrete, approved by the owner in both languages (see section 8). Candidate direction: say what we make and for whom, not a slogan. Example shape: "Bags made to your order, for your business."
- Supporting line: one sentence with the real MOQ and lead time once the owner confirms them. Under it, two buttons: **Get a quote** (primary) and **Build your bag** (outline). A small underlined text link to WhatsApp sits next to them.
- Product photo: one stable image, `next/image` with `priority`, explicit width and height, `sizes="(min-width:1280px) 560px, 100vw"`, AVIF or WebP, 4:5 aspect on desktop, 4:3 on mobile. It is the LCP element and it never changes after load.
- Glass card: frosted (`--glass-bg`, `--glass-border`, 12px blur only on desktop, solid `--surface` on mobile and under reduced transparency). Shows the thumbnail, product name, and a **Shop now** or **Get a quote** link depending on product type, plus prev/next round buttons. It cycles through up to 5 featured products. No auto-advance. The change is announced in a polite live region. Only the card contents change, not the hero photo.
- Side column: top image card (a real work or lifestyle photo), a heading, two lines of text, a 1px divider, then the "Shop by use" chips (outlined pills with a small leading Hugeicons icon, linking to collections or categories, 6 to 8 items, driven by collection sort order).
- Tablet (768 to 1279): hero tile full width with the photo on the right 45%; the side column becomes a two-column row below it (image card left, text and chips right).
- Mobile (under 768): stack in this order: headline, supporting line, fabric swatches, buttons, photo (4:3), then the glass card as a normal static card below the photo (no overlay), then the side content with the chips as one horizontally scrolling row (scroll-snap, 44px chips).

### 4.2 Ready-stock favorites strip (the "most loved bags" pattern)

Full-width band, `--surface-2`, `--radius-panel`, padding 24 to 32px.

```
+-----------------------------------------------------------------------------------------+
| Ready-stock favorites  (arrow)   |  [ tile ]        [ tile ]        [ tile ]             |
| one short paragraph              |  Name            Name            Name                 |
|                                  |  from X/pc  (+)  from X/pc  (+)  from X/pc  (+)       |
|                                  |  ============------------------  1/8   (<) (>)        |
+-----------------------------------------------------------------------------------------+
```

- Data: published `buy_now` products with `is_featured`, newest first, max 8. Hide the whole strip if fewer than 3.
- Tile: image on a light neutral tile (`--surface`, so white-background photos never look boxed in dark mode), aspect 1:1, `--radius-card`. Below it: name (one line, truncated with title), price line "from ৳420 / pc" plus a small "MOQ 5" text, and a **Customizable** badge (icon plus text) when the builder is on.
- The round 44px button on each tile is a link to the product page (label "View \<name>"). Quick-add is a separate optional task.
- Carousel: native CSS scroll-snap with prev/next buttons that scroll by one tile width. No library. Container is `role="region"` with `aria-roledescription="carousel"` and an accessible label. The progress bar is derived from scroll position. The counter (1/8) is visible text. Prev/next are disabled at the ends. Mobile shows 1.15 tiles with a peek; tablet 2; desktop 3. Reduced motion switches smooth scrolling off.
- Only the first three tiles load eagerly enough to avoid layout shift; the rest are lazy. Reserve fixed aspect ratios so nothing jumps.

### 4.3 Shop by use (categories)

- A tile grid: 4 columns on desktop, 2 on mobile. The first tile spans two rows and two columns.
- Each tile: an image, with the category name on a **solid label chip** at the bottom left (not text on the photo). Optional product count. Tiles link to the category pages.
- Content: the seed tree from plan section 6 (Delivery and Cold-chain, Corporate and Event, Backpacks, Eco and Jute, Leather, and so on). Needs one image per tile (see section 8).

### 4.4 Build your bag (the differentiator band)

- The only dark band on the page: `--ink` background (dark theme uses `--surface`), ivory text, gold button.
- Left: heading "Design every part" (final copy to be approved), a short paragraph, and a numbered list of the real builder steps (fabric and color, size, logo, estimate and quote). Numbering is correct here because it is a true sequence. A **Start customizing** button.
- Right: a card that looks like the builder summary: a row of selectable-looking swatch chips (links to `/builder?fabric=<code>`), then three summary chips (Body, Zipper, Size) as plain text, then "Estimate shown, final price confirmed by our team".
- This section has no animation.

### 4.5 How ordering works (real sequence)

Five steps in a row on desktop, a vertical list on mobile: Request a quote or build your bag, Our team confirms the price, 50% advance, Production and artwork approval, Delivery. Short line under each. Real lead time shown only after the owner confirms it.

### 4.6 Why us (specs, not slogans)

- A two-column spec list: label on the left, value on the right (fabric weight, stitching, zipper type, insulation, printing methods, MOQ, lead time). Real values only, supplied by the owner. No stat cards, no gradient numbers.
- Hide any row that has no confirmed value.

### 4.7 Proof: clients and work gallery

- Client logo wall (grayscale, 6 per row on desktop, 3 on mobile) only for logos we have permission to show.
- Work gallery: a 6-image grid (3 columns desktop, 2 mobile) of real production photos with bilingual alt text. A "See all clients" link to /clients.

### 4.8 Trust documents and factory video

- Trade license, TIN and BIN documents as thumbnails that open larger (real files, owner supplies).
- Video is a poster image with a play button that loads the player only on click. No autoplay. Captions required. Skip the section until a real video exists.

### 4.9 Inline quote form

- Short form: name, phone, bag type (select), quantity. Submit goes to the existing quote server action with the honeypot, rate limit and blocklist already in place. Success state stays inline with a WhatsApp link. A link "Need a custom size or logo? Use the full form" goes to /quote.
- Built with `useActionState`, works without JavaScript for the basic post.

### 4.10 Reviews and FAQ

- Reviews only if real (name, company, short text). Otherwise hide the section.
- FAQ: 5 most useful questions as an accordion, with `FAQPage` JSON-LD, and a link to the full FAQ page.

### 4.11 Footer

Already redesigned (Decision Log, 2026-10-24). Only change: use the same pill, radius and chip styles as this plan so it matches the new home.

## 5. Components to build (public kit, `src/components/site/`)

- `SectionShell` (container, gutters, vertical rhythm, heading slot).
- `PillButton`, `IconCircleButton` (40 and 44 sizes), `ChipLink` (outlined pill with a leading icon).
- `SwatchDot` and `SwatchRow` (link variant).
- `GlassCard` (with solid fallback).
- `ProductTile`, `ProductCarousel` (client island), `CarouselControls`.
- `SiteSearchPill` (client island), `CartButton` (client island), `MegaMenu` (client open state only), `MobileNavSheet`.
- `HeroBento`, `HeroFeaturedCard` (client island), `UseChips`.
- `CategoryTile`, `BuilderBand`, `OrderSteps`, `SpecList`, `LogoWall`, `GalleryGrid`, `InlineQuoteForm`.
- Each one must have a loading skeleton with the same dimensions when it is data-driven.

## 6. Next.js rules for this work

- Server Components by default. Client islands only for: mobile sheet, mega-menu open state, search field, cart count, hero featured card, product carousel, theme and language toggles, inline quote form.
- The home page and header must not call `cookies()` or `headers()`, so the route stays static or Partial Prerender. Check the build route table after each task.
- Data comes from the existing cached readers (`"use cache"` with `cacheTag` and `cacheLife`). Featured products, best sellers, collections and settings reuse the `catalog` and `settings` tags. No new fetching pattern.
- Static hero art, lifestyle and gallery photos, client logos and document thumbnails live in `public/site/` and are imported statically so `next/image` can set size and a blur placeholder. Product photos still come from the database (Cloudinary). Any change to static assets needs a deploy, which is acceptable because the admin content module was removed.
- `next/image` everywhere with real `sizes`. Only the hero photo uses `priority`.
- Wrap each data-driven section in its own `Suspense` with a same-size skeleton so the static shell paints first.
- The strings come from `src/messages/{en,bn}.json` (namespace `home`, `header`). `bun run i18n:check` must pass.
- No new dependencies.

## 7. Quality gates (every task)

- axe clean on `/en` and `/bn`, light and dark, at 375, 768, 1280 and 1440 px. No horizontal overflow.
- Bangla text at least 18px in main and footer; the Bangla headline never clips and the layout has no fixed heights.
- Keyboard walk: skip link, header, mega-menu, search, carousel buttons, hero card buttons, chips. Visible focus ring everywhere.
- Home Lighthouse mobile target stays 90 or more on CI (G6a). If a task makes it worse, fix or revert it before moving on.
- Home must still build as `○` or `◐` (check `bun run build`).
- Update e2e selectors that depended on the old header and home. Add e2e: header quote button reaches /quote, search submits, carousel next changes the counter, fabric swatch link opens the builder.

## 8. What the owner must provide (replace placeholders as they arrive)

- Approved hero headline and supporting line in English and Bangla.
- Confirmed MOQ and lead time, and spec values for the Why us list.
- Photos: 1 hero product shot (clean background, 4:5), 1 lifestyle or work shot (16:10), 8 best-seller shots on a neutral background (1:1), 6 category images, 6 production photos, fabric swatch photos for the Swatch Library, client logos with written permission, trade license and TIN/BIN scans.
- Until real photos exist: the hero uses a flat product shot from the catalog if one is published, otherwise an SVG stitched-bag illustration on the gold-soft panel. Never use stock photos of other brands' bags. Sections that need photos stay hidden until at least the minimum count exists.

## 9. Task list for Cursor (one commit each)

- [ ] **FE-0 Foundation:** add the public tokens (`--glass-*`, radii), the type scale classes, and the primitives `SectionShell`, `PillButton`, `IconCircleButton`, `ChipLink`, `SwatchDot`. Colors come only from the brand rules above. Done when the primitives render in both themes and both languages with the Bangla 18px rule intact.
- [ ] **FE-1 Header v2:** restyle `site-header.tsx` per section 3 (pill search, round phone button, Get a quote, cart chip with badge, 5-item nav, mega-menu panels, mobile sheet). Keep all current behavior. Done when all gates in section 7 pass and the route table is unchanged.
- [ ] **FE-2 Hero bento:** `HeroBento`, fabric swatch row, glass card (`HeroFeaturedCard`), side column and `UseChips`, responsive at all three breakpoints. Done when the hero photo is the LCP element and CLS is 0.
- [ ] **FE-3 Ready-stock strip:** `ProductTile` and `ProductCarousel` with native scroll-snap, progress bar, counter and controls. Done when keyboard and screen reader walk-through passes and the strip hides under 3 products.
- [ ] **FE-4 Shop by use:** `CategoryTile` grid. Done when the first tile spans correctly and names sit on solid chips.
- [ ] **FE-5 Builder band and ordering steps:** `BuilderBand`, `OrderSteps`. Optional sub-task FE-5b: make the builder read `?fabric=<code>` and preselect the body fabric.
- [ ] **FE-6 Why us, proof and gallery:** `SpecList`, `LogoWall`, `GalleryGrid`, document thumbnails. Hidden until the data exists.
- [ ] **FE-7 Inline quote form and FAQ strip:** `InlineQuoteForm` with the existing quote action, short FAQ accordion with JSON-LD.
- [ ] **FE-8 Polish and performance:** footer alignment with the new styles, skeletons for every data section, image sizes, e2e additions, Lighthouse check, final axe pass (both themes, both languages).
- [ ] **FE-9 Category and product pages restyle (next pass, separate plan):** apply the same tokens and tiles to category, collection and product pages and add category filters.

## 10. Decision Log entry to append

"2026-10-24: Front-end design plan 8b adopted. Layout pattern taken from the owner's BAGLUXE-style reference (bento hero with floating glass card, side column with use-case chips, ready-stock carousel strip, pill header). Adapted for a quote-first B2B plus retail business: header primary button is Get a quote; hero swatches are real fabric swatches linking to the builder; product tile plus button links to the product page (no blind quick-add because of MOQ and quantity tiers); no third font family (performance and Bangla); hero text never overlaps the photo (contrast); carousel is native scroll-snap (no new library); static site photos live in public/site; sections without real content stay hidden; colors and combinations are the Prime Bag Factory brand palette only (ivory, white, ink, antique gold, forest green), and the reference's beige and rust are not used."
