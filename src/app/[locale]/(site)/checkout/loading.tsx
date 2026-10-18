export default function CheckoutLoading() {
  // Static shell only; the real form is streamed in behind it (and never owns a
  // second `<main id="main">`).
  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10"
      aria-busy="true"
    >
      <div className="h-9 w-48 animate-pulse rounded-control bg-surface-2" />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="h-96 animate-pulse rounded-card bg-muted" />
        <div className="h-72 animate-pulse rounded-card bg-muted" />
      </div>
    </div>
  );
}
