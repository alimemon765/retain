export function ComingSoon({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-edge bg-surface px-6 py-12 text-center text-sm text-muted">
      {label} coming soon.
    </div>
  );
}
