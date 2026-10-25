export function Stars({ count, max = 3 }: { count: number; max?: number }) {
  return (
    <span className="stars" aria-label={`${count} of ${max} stars`} role="img">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} aria-hidden="true" className={i < count ? 'star is-on' : 'star'}>{i < count ? '★' : '☆'}</span>
      ))}
    </span>
  );
}
