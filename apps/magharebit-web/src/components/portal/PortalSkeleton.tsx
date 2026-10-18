export default function PortalSkeleton() {
  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Page title skeleton */}
      <div
        className="skeleton-shimmer"
        style={{ height: '28px', width: '220px', borderRadius: '8px' }}
      />

      {/* Stat cards row */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="skeleton-shimmer stagger-1"
            style={{
              flex: '1 1 140px',
              height: '90px',
              borderRadius: '12px',
              animationDelay: `${i * 0.07}s`,
            }}
          />
        ))}
      </div>

      {/* Chart area */}
      <div
        className="skeleton-shimmer stagger-3"
        style={{ height: '220px', borderRadius: '14px' }}
      />

      {/* Table rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[100, 85, 90, 80, 88].map((pct, i) => (
          <div
            key={i}
            className="skeleton-shimmer"
            style={{
              height: '44px',
              width: `${pct}%`,
              borderRadius: '8px',
              animationDelay: `${i * 0.06}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
