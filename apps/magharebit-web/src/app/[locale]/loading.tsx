import Logo from '@/components/brand/Logo';

export default function Loading() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0A2318',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      {/* Pulsing ring + logo */}
      <div style={{ position: 'relative', width: '80px', height: '80px' }}>
        {/* Outer ping ring */}
        <div
          className="animate-ping"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '3px solid rgba(240,180,41,0.5)',
          }}
        />
        {/* Static ring */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid rgba(240,180,41,0.18)',
          }}
        />
        {/* Hexagon logo */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Logo className="animate-pulse" height={56} on="dark" variant="emblem" />
        </div>
      </div>
    </div>
  );
}
