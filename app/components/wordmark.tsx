export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flag" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className={`font-display font-bold tracking-[0.14em] text-ink ${small ? "text-[18px]" : "text-[22px]"}`}>POLITIQUE</span>
    </span>
  );
}
