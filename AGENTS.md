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
- Bangla text uses Hind Siliguri. Body line-height for Bangla is about 1.7.
- Routes under `src/app/[locale]` are public and bilingual. Admin stays outside `[locale]` and is English first.
- Next.js 16 uses `src/proxy.ts`, not `middleware.ts`.
