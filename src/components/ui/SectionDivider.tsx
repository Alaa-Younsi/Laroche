export function SectionDivider() {
  return (
    <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 md:px-8" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      <span className="text-brand">✦</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
