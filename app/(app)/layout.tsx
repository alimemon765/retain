import { BottomNav } from "@/components/bottom-nav";
import { PwaSetup } from "@/components/pwa-setup";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <main className="flex-1 px-4 pb-24 pt-6">{children}</main>
      <BottomNav />
      <PwaSetup />
    </div>
  );
}
