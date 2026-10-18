export default function CartLoading() {
  // Static shell only — the dynamic part below never touches `params`, so PPR
  // prerenders this without the personal cart content.
  return (
    <main
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10"
      aria-busy="true"
    >
      <div className="h-9 w-40 animate-pulse rounded-control bg-surface-2" />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-card bg-muted" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-card bg-muted" />
      </div>
    </main>
  );
}
