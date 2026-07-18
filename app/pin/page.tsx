import { PinForm } from "@/components/pin-form";

export const dynamic = "force-dynamic";

export default function PinPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center gap-6 px-4 pt-32">
      <div className="flex flex-col items-center gap-2">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-accent">
          <span className="h-3 w-3 rounded-full bg-accent" />
        </span>
        <h1 className="text-lg font-semibold">Retain</h1>
      </div>
      <PinForm />
    </div>
  );
}
