/** Shown the instant a link is pressed, while the next page's data is fetched. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="fade-in">
      <span className="sr-only">Chargement…</span>
      <div className="sticky top-0 z-30 flex min-h-[56px] items-center border-b border-line bg-bg/90 px-4 backdrop-blur">
        <div className="skeleton h-5 w-36" />
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} aria-hidden="true" className="flex gap-3 border-b border-line px-4 py-4">
          <div className="skeleton h-10 w-10 flex-none !rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="skeleton h-3.5 w-40" />
            <div className="skeleton mt-3 h-3.5 w-full" />
            <div className="skeleton mt-2 h-3.5 w-[82%]" />
            {i % 2 === 0 && <div className="skeleton mt-2 h-3.5 w-[55%]" />}
            <div className="mt-4 flex max-w-xs justify-between">
              {[0, 1, 2, 3].map((j) => <div key={j} className="skeleton h-4 w-9" />)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
