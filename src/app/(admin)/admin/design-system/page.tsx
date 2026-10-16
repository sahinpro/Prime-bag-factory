import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/admin/PageHeader";

export default function DesignSystemPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader title="Admin design system" description="A playground for the admin UI kit and brand tokens." />

      <section className="mb-8">
        <h3 className="text-lg font-medium">Buttons</h3>
        <div className="mt-3 flex gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-medium">Badges</h3>
        <div className="mt-3 flex gap-3">
          <Badge>New</Badge>
          <Badge variant="secondary">Published</Badge>
          <Badge variant="destructive">Cancelled</Badge>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-medium">Tokens</h3>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded border p-3"><div style={{background: 'var(--color-primary)'}} className="h-8 w-full rounded" />
            <div className="mt-2 text-sm">--color-primary</div>
          </div>
          <div className="rounded border p-3"><div style={{background: 'var(--color-foreground)'}} className="h-8 w-full rounded" />
            <div className="mt-2 text-sm">--color-foreground</div>
          </div>
          <div className="rounded border p-3"><div style={{background: 'var(--color-gold-text)'}} className="h-8 w-full rounded" />
            <div className="mt-2 text-sm">--color-gold-text</div>
          </div>
          <div className="rounded border p-3"><div style={{background: 'var(--color-card)'}} className="h-8 w-full rounded" />
            <div className="mt-2 text-sm">--color-card</div>
          </div>
        </div>
      </section>
    </main>
  );
}
