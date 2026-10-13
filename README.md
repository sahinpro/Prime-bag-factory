# Prime Bag Factory

Next.js app run with the Bun runtime. Package installs and scripts use Bun.

## Scripts

```bash
bun install
bun run dev
bun run build
bun run start
bun run lint
```

Open [http://localhost:3000](http://localhost:3000) after `bun run dev`.

`bunfig.toml` sets `bun = true`, and each script uses `bun --bun`, so Next.js does not start through the Node.js binary.
