import { ThemeLogo } from "@/components/site/logo";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <ThemeLogo />
      <h1 className="text-3xl font-semibold tracking-tight">Prime Bag Factory</h1>
    </main>
  );
}
