<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Prime Bag Factory

`plan.md` is the source of truth. Read it before every task. If code and the plan disagree, stop and ask. If the plan is silent, pick the simplest option and note it under Decision Log.

### Working rules

1. Plan first. Before coding a task, restate the task, list files you will touch, then implement.
2. One phase at a time, in order. Do not start a phase until the previous phase's "Done when" is met.
3. Small commits. One task = one commit. Message format: `phase-N: short description`.
4. Tick the checkbox in `plan.md` when a task is finished. Add notes under Decision Log.
5. No new libraries outside plan section 3 without asking.
6. Validate every form and server action with `zod` on the client and the server.
7. Never expose the Supabase service-role key to the browser. It lives only in `src/lib/supabase/admin.ts` (server only).
8. Never copy a competitor's UI, text, photos, client logos, or legal documents.
9. No licensed characters (Marvel, Disney, Pokemon, etc.) anywhere in products or seed data.
10. No hard-coded colors. Use the design tokens in plan section 4.

### Conventions

- Server components by default. Add `"use client"` only when needed.
- Mutations go through server actions or route handlers, always validated with zod and checked with `requireRole()`.
- Money is stored as `numeric(12,2)`, currency BDT, formatted with `Intl.NumberFormat` (`en-BD` or `bn-BD`).
- Never trust prices, totals, or stock from the client.
- Slugs are lowercase, hyphenated English, and unique per table.
- File names are kebab-case. Components are PascalCase. Database columns are snake_case.
- Bangla text uses Noto Serif Bengali on `:lang(bn)`. Body line-height for Bangla is about 1.7. On `/bn`, visible text is at least 18px.
- Routes under `src/app/[locale]` are public and bilingual. Admin stays outside `[locale]` and is English first.
- Next.js 16 uses `src/proxy.ts`, not `middleware.ts`.

### Admin UI rules

- Before touching anything under `src/app/(admin)` or `src/components/admin`, read plan section 9c (Admin UI Design System) and 9c.10 (acceptance checklist).
- Build admin pages only from the kit in `src/components/admin/`. If a component is missing, add it to the kit and to `/admin/design-system` first.
- Use semantic tokens only (`bg-sidebar`, `bg-surface-2`, `text-success`, `bg-warning-soft`, `--chart-1..5`). No raw hex, no emoji, no icon library other than `lucide-react` (16px controls, 20px card headers, stroke 1.75).
- Status is never color alone: every badge, delta and urgency indicator has an icon and a text label (mapping in plan 9c.6).
- Every list and widget ships loading (skeleton), empty and error states. Skeletons match final dimensions.
- Tables use `DataTable` with URL-synced `page`, `sort`, `q` and filters. Under 768px they render as stacked cards. No horizontal page scroll at 375px.
- Forms use `FormSection`, `BilingualField`, `StickySaveBar`; validate with zod on client and server; destructive actions use `ConfirmDialog`.
- Admin is English; bilingual content inputs get `lang="bn"` for the Bangla font. Money and dates go through `src/lib/format.ts`.
- Respect `prefers-reduced-motion`; transitions 150-200ms; hover is never the only way to reach an action.
- Check every admin page in light and dark, at 375 / 768 / 1280 / 1440 px, with axe, before ticking its task.
- This is Next.js 16: read the relevant guide in `node_modules/next/dist/docs/` before using any API you are unsure of.
