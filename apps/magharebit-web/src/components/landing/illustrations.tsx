// Simple on-brand SVG illustrations used inside <MediaFrame>. They are decorative
// (the frame carries the accessible label) and act as the permanent poster/fallback
// for reduced-motion and Save-Data visitors once real media exists.

const GOLD = '#F0B429';
const GREEN = '#5EC485';
const LINE = 'rgba(255,255,255,0.22)';
const FILL = 'rgba(255,255,255,0.06)';

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 320 240" className="h-full max-h-full w-full max-w-[420px]" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Barcode being scanned by a laser line. */
export function ScanIllustration() {
  const bars = [0, 10, 16, 28, 34, 44, 52, 60, 70, 76, 88, 96, 104, 112, 124, 132];
  return (
    <Svg>
      <rect x="70" y="60" width="180" height="120" rx="14" fill={FILL} stroke={LINE} />
      {bars.map((x, i) => (
        <rect key={x} x={90 + x} y="84" width={i % 3 === 0 ? 6 : 3} height="72" fill="rgba(255,255,255,0.7)" />
      ))}
      <rect x="62" y="116" width="196" height="3" rx="1.5" fill={GOLD} />
      <path d="M62 78V66a4 4 0 0 1 4-4h12M258 78V66a4 4 0 0 0-4-4h-12M62 162v12a4 4 0 0 0 4 4h12M258 162v12a4 4 0 0 1-4 4h-12" stroke={GOLD} strokeWidth="3" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** Thermal receipt strip. */
export function ReceiptIllustration() {
  return (
    <Svg>
      <path d="M100 30h120v168l-10-8-10 8-10-8-10 8-10-8-10 8-10-8-10 8-10-8-10 8-10-8z" fill={FILL} stroke={LINE} />
      <rect x="120" y="52" width="80" height="8" rx="4" fill={GOLD} />
      {[78, 96, 114, 132].map((y, i) => (
        <g key={y}>
          <rect x="120" y={y} width={i % 2 ? 46 : 58} height="5" rx="2.5" fill="rgba(255,255,255,0.45)" />
          <rect x="178" y={y} width="22" height="5" rx="2.5" fill="rgba(255,255,255,0.45)" />
        </g>
      ))}
      <rect x="120" y="156" width="80" height="2" fill={LINE} />
      <rect x="150" y="166" width="50" height="8" rx="4" fill={GREEN} />
    </Svg>
  );
}

/** Rising bar chart with a trend line. */
export function InsightsIllustration() {
  const bars = [60, 84, 70, 108, 96, 132, 148];
  return (
    <Svg>
      <rect x="40" y="40" width="240" height="160" rx="14" fill={FILL} stroke={LINE} />
      {bars.map((h, i) => (
        <rect key={i} x={62 + i * 30} y={180 - h} width="18" height={h} rx="4" fill={i === bars.length - 1 ? GOLD : 'rgba(255,255,255,0.35)'} />
      ))}
      <path d="M70 140 L100 120 L130 130 L160 98 L190 108 L220 76 L250 62" stroke={GREEN} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Counter-top desktop POS. */
export function DesktopIllustration() {
  return (
    <Svg>
      <rect x="64" y="40" width="192" height="120" rx="10" fill={FILL} stroke={LINE} />
      <rect x="76" y="52" width="110" height="96" rx="6" fill="rgba(255,255,255,0.05)" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={84 + (i % 2) * 48} y={60 + Math.floor(i / 2) * 40} width="42" height="32" rx="5" fill={i === 1 ? GOLD : 'rgba(255,255,255,0.18)'} />
      ))}
      <rect x="196" y="52" width="48" height="96" rx="6" fill="rgba(255,255,255,0.08)" />
      <rect x="204" y="132" width="32" height="10" rx="5" fill={GOLD} />
      <path d="M150 160v22M118 186h84" stroke={LINE} strokeWidth="6" strokeLinecap="round" />
    </Svg>
  );
}

/** Handheld / phone POS. */
export function MobileIllustration() {
  return (
    <Svg>
      <rect x="112" y="24" width="96" height="192" rx="18" fill={FILL} stroke={LINE} />
      <rect x="140" y="34" width="40" height="5" rx="2.5" fill={LINE} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x="124" y={56 + i * 34} width="72" height="26" rx="6" fill="rgba(255,255,255,0.16)" />
      ))}
      <rect x="124" y="164" width="72" height="30" rx="8" fill={GOLD} />
    </Svg>
  );
}

/** 80 mm thermal printer with a receipt coming out. */
export function PrinterIllustration() {
  return (
    <Svg>
      <path d="M118 34h84v70h-84z" fill={FILL} stroke={LINE} />
      <path d="M126 104v66l-6-5-6 5-6-5-4 3v-64" fill="none" />
      <rect x="86" y="96" width="148" height="76" rx="12" fill="rgba(255,255,255,0.08)" stroke={LINE} />
      <rect x="104" y="112" width="112" height="6" rx="3" fill={GOLD} />
      <circle cx="212" cy="144" r="5" fill={GREEN} />
      <path d="M124 172h72v36l-9-6-9 6-9-6-9 6-9-6-9 6z" fill="rgba(255,255,255,0.12)" stroke={LINE} />
    </Svg>
  );
}
