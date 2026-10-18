/**
 * MoroccoMap — Premium interactive merchant distribution map
 *
 * Coordinate system (viewBox 0 0 500 620):
 *   x = (lon + 18) × 29.4    (−18°W → x=0 ; −1°W → x=500)
 *   y = (36 − lat) × 40      (36°N → y=0  ; 20.5°N → y=620)
 *
 * Morocco boundary traced clockwise from Tanger:
 *   Mediterranean coast → Algeria border (south) → Southern border (west) → Atlantic coast (north)
 *
 * No external map library — pure SVG + React.
 */
'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CityData {
  id:        string
  name:      string
  cx:        number
  cy:        number
  count:     number
  region:    string
  labelPos:  'right' | 'left' | 'below' | 'none'
  slug?:     string
}

// ── Data ───────────────────────────────────────────────────────────────────────

const MAX_COUNT = 187

const CITIES: CityData[] = [
  { id: 'casablanca', name: 'Casablanca',  cx: 306, cy: 96,  count: 187, region: 'Casablanca-Settat',            labelPos: 'right', slug: 'casablanca' },
  { id: 'rabat',      name: 'Rabat',       cx: 329, cy: 80,  count: 92,  region: 'Rabat-Salé-Kénitra',          labelPos: 'right', slug: 'rabat'      },
  { id: 'marrakech',  name: 'Marrakech',   cx: 294, cy: 175, count: 64,  region: 'Marrakech-Safi',              labelPos: 'right', slug: 'marrakech'  },
  { id: 'tanger',     name: 'Tanger',      cx: 359, cy: 14,  count: 48,  region: 'Tanger-Tétouan-Al Hoceïma',  labelPos: 'below'                     },
  { id: 'fes',        name: 'Fès',         cx: 382, cy: 78,  count: 41,  region: 'Fès-Meknès',                 labelPos: 'right'                     },
  { id: 'agadir',     name: 'Agadir',      cx: 247, cy: 224, count: 35,  region: 'Souss-Massa',                labelPos: 'right'                     },
  { id: 'oujda',      name: 'Oujda',       cx: 473, cy: 52,  count: 28,  region: 'Oriental',                  labelPos: 'left'                      },
  { id: 'meknes',     name: 'Meknès',      cx: 366, cy: 86,  count: 24,  region: 'Fès-Meknès',                 labelPos: 'none'                      },
  { id: 'kenitra',    name: 'Kénitra',     cx: 335, cy: 68,  count: 19,  region: 'Rabat-Salé-Kénitra',         labelPos: 'none'                      },
  { id: 'tetouan',    name: 'Tétouan',     cx: 370, cy: 20,  count: 17,  region: 'Tanger-Tétouan-Al Hoceïma', labelPos: 'none'                      },
  { id: 'benimellal', name: 'Béni Mellal', cx: 342, cy: 148, count: 14,  region: 'Béni Mellal-Khénifra',       labelPos: 'none'                      },
  { id: 'laayoune',   name: 'Laâyoune',   cx: 141, cy: 352, count: 8,   region: 'Laâyoune-Sakia El Hamra',   labelPos: 'right'                     },
]

const TOTAL = CITIES.reduce((s, c) => s + c.count, 0)

// Morocco outline — clockwise from Tanger (NW tip of Mediterranean opening)
// Each node derived from lat/lon via the coordinate formula above.
const MOROCCO_PATH = [
  // ── Northern Mediterranean coast (east) ──────────────────────────────────
  'M 359,10',
  'Q 366,5 373,5',         // Cape Spartel → near Ceuta
  'L 390,20',              // Tetouan area
  'L 415,32',              // Al Hoceima
  'L 444,32',              // Nador
  // ── Algeria border (south) ───────────────────────────────────────────────
  'C 460,33 470,40 473,52',// Oujda
  'L 480,100',             // Algeria border mid-north
  'L 490,158',             // Figuig area (easternmost point)
  'C 490,185 480,218 472,240',// turns south-west
  'L 460,310',
  'L 456,380',             // SE corner – Algeria / W-Sahara
  // ── Southern boundary (west toward Atlantic) ─────────────────────────────
  'L 380,442',
  'L 273,538',
  'L 118,588',
  'L 29,604',              // SW corner — Mauritania / Atlantic
  // ── Atlantic coast (north) ───────────────────────────────────────────────
  'C 31,582 45,528 60,494',// Dakhla area
  'L 85,430',
  'L 103,396',             // Cape Bojador
  'L 132,340',
  'L 168,304',
  'L 203,300',             // Tan-Tan
  'L 232,280',             // Guelmim
  'L 248,252',             // Tiznit
  'L 247,224',             // Agadir
  'Q 244,202 241,180',     // smooth curve toward Essaouira
  'L 259,148',             // Safi
  'L 279,108',             // El Jadida
  'L 306,96',              // Casablanca
  'L 329,80',              // Rabat
  'L 335,68',              // Kénitra
  'L 350,32',              // Larache
  'L 353,20',              // Asilah
  'Z',                     // close → Tanger (359,10)
].join(' ')

// Dot radius proportional to merchant count
function dotR(count: number): number {
  return 3.5 + (count / MAX_COUNT) * 7.5
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function MoroccoMap() {
  const locale = useLocale()
  const t      = useTranslations('map')
  const isRTL  = locale === 'ar'
  const font   = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif'

  const [active, setActive] = useState<CityData | null>(null)

  const LABELED = new Set(['casablanca', 'rabat', 'marrakech', 'tanger', 'fes', 'agadir', 'oujda', 'laayoune'])

  const toggle = (city: CityData) =>
    setActive(a => (a?.id === city.id ? null : city))

  return (
    <div
      data-aos="fade-up"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          direction: isRTL ? 'rtl' : 'ltr',
          minHeight: '440px',
        }}
      >

        {/* ──────────────── SVG Map ──────────────── */}
        <div
          style={{
            flex: '1 1 340px',
            position: 'relative',
            padding: '24px 20px',
            borderInlineEnd: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <svg
            viewBox="0 0 500 620"
            width="100%"
            height="auto"
            style={{ display: 'block', maxHeight: '500px', margin: '0 auto' }}
            role="img"
            aria-label="Morocco merchants distribution map"
          >
            <defs>
              {/* ─ Morocco fill gradient ─ */}
              <linearGradient id="mgr-fill" x1="0.2" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#1C5E38" />
                <stop offset="50%"  stopColor="#0F3D2A" />
                <stop offset="100%" stopColor="#092418" />
              </linearGradient>

              {/* ─ Subtle inner radial (premium depth) ─ */}
              <radialGradient id="mgr-radial" cx="45%" cy="35%" r="55%">
                <stop offset="0%"   stopColor="rgba(46,139,87,0.25)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>

              {/* ─ Clip to Morocco outline ─ */}
              <clipPath id="morocco-clip">
                <path d={MOROCCO_PATH} />
              </clipPath>

              {/* ─ Dot grid pattern inside country ─ */}
              <pattern id="dot-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="0.7" fill="rgba(255,255,255,0.07)" />
              </pattern>

              {/* ─ Normal glow for city dots ─ */}
              <filter id="dot-glow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="3.5" result="b" />
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>

              {/* ─ Active city stronger glow ─ */}
              <filter id="dot-glow-hi" x="-120%" y="-120%" width="340%" height="340%">
                <feGaussianBlur stdDeviation="7" result="b" />
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Background dot grid (full SVG) */}
            <rect width="500" height="620" fill="transparent" />

            {/* Drop shadow for depth */}
            <path
              d={MOROCCO_PATH}
              fill="rgba(0,0,0,0.45)"
              transform="translate(4,6)"
              style={{ filter: 'blur(10px)' }}
            />

            {/* Morocco filled silhouette */}
            <path d={MOROCCO_PATH} fill="url(#mgr-fill)" />

            {/* Dot grid clipped inside Morocco */}
            <rect
              width="500" height="620"
              fill="url(#dot-grid)"
              clipPath="url(#morocco-clip)"
            />

            {/* Radial depth overlay clipped to Morocco */}
            <rect
              width="500" height="620"
              fill="url(#mgr-radial)"
              clipPath="url(#morocco-clip)"
            />

            {/* Morocco border stroke */}
            <path
              d={MOROCCO_PATH}
              fill="none"
              stroke="rgba(240,180,41,0.40)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />

            {/* ─ City dots ─ */}
            {CITIES.map((city, i) => {
              const r     = dotR(city.count)
              const isAct = active?.id === city.id
              const lp    = city.labelPos
              const show  = LABELED.has(city.id)

              // Label anchor + offset
              let lx = city.cx + r + 7
              let ly = city.cy + 4
              let ta: 'start' | 'end' | 'middle' = 'start'
              if (lp === 'left')  { lx = city.cx - r - 6; ta = 'end' }
              if (lp === 'below') { lx = city.cx; ly = city.cy + r + 13; ta = 'middle' }

              return (
                <g
                  key={city.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${city.name}: ${city.count}`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setActive(city)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => toggle(city)}
                  onKeyDown={e => e.key === 'Enter' && toggle(city)}
                >
                  {/* Pulse ring 1 */}
                  <circle
                    cx={city.cx} cy={city.cy}
                    r={r * 1.9}
                    fill="rgba(240,180,41,0.22)"
                    style={{
                      animation: `mgr-pulse ${2.4 + i * 0.12}s ease-out infinite`,
                      animationDelay: `${i * 0.28}s`,
                      transformOrigin: `${city.cx}px ${city.cy}px`,
                    }}
                  />
                  {/* Pulse ring 2 (staggered, smaller) */}
                  <circle
                    cx={city.cx} cy={city.cy}
                    r={r * 1.3}
                    fill="rgba(240,180,41,0.30)"
                    style={{
                      animation: `mgr-pulse ${2.4 + i * 0.12}s ease-out infinite`,
                      animationDelay: `${i * 0.28 + 1.2}s`,
                      transformOrigin: `${city.cx}px ${city.cy}px`,
                    }}
                  />

                  {/* Active selection ring */}
                  {isAct && (
                    <circle
                      cx={city.cx} cy={city.cy}
                      r={r + 6}
                      fill="none"
                      stroke="#F0B429"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                      style={{ animation: 'mgr-spin 4s linear infinite', transformOrigin: `${city.cx}px ${city.cy}px` }}
                    />
                  )}

                  {/* Solid dot */}
                  <circle
                    cx={city.cx} cy={city.cy}
                    r={r}
                    fill={isAct ? '#FFD256' : '#F0B429'}
                    stroke="rgba(255,255,255,0.35)"
                    strokeWidth="1"
                    filter={isAct ? 'url(#dot-glow-hi)' : 'url(#dot-glow)'}
                  />

                  {/* Label */}
                  {show && lp !== 'none' && (
                    <text
                      x={lx} y={ly}
                      textAnchor={ta}
                      fontSize={isAct ? 11 : 10}
                      fontWeight={isAct ? 700 : city.count > 60 ? 600 : 500}
                      fill={isAct ? '#FFD256' : 'rgba(255,255,255,0.90)'}
                      fontFamily="Plus Jakarta Sans, Inter, sans-serif"
                      paintOrder="stroke"
                      stroke="rgba(9,36,24,0.8)"
                      strokeWidth="3"
                      style={{ pointerEvents: 'none' }}
                    >
                      {city.name}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Floating tooltip for cities without inline label */}
            {active && !LABELED.has(active.id) && (() => {
              const tx = Math.min(active.cx + 14, 440)
              const ty = Math.max(active.cy - 26, 8)
              const w  = active.name.length * 6.5 + 18
              return (
                <g style={{ pointerEvents: 'none' }}>
                  <rect x={tx} y={ty} width={w} height={19} rx={5} ry={5}
                    fill="rgba(10,35,24,0.93)"
                    stroke="rgba(240,180,41,0.35)" strokeWidth="1"
                  />
                  <text x={tx + 9} y={ty + 13}
                    fontSize="10" fontWeight="600"
                    fill="#FFFFFF"
                    fontFamily="Plus Jakarta Sans, Inter, sans-serif"
                  >
                    {active.name}
                  </text>
                </g>
              )
            })()}

            {/* Keyframes */}
            <style>{`
              @keyframes mgr-pulse {
                0%   { transform: scale(1);   opacity: 0.8; }
                60%  { transform: scale(2.6); opacity: 0;   }
                100% { transform: scale(1);   opacity: 0;   }
              }
              @keyframes mgr-spin {
                from { transform: rotate(0deg); }
                to   { transform: rotate(360deg); }
              }
            `}</style>
          </svg>

          {/* Total badge — bottom corner */}
          <div
            style={{
              position: 'absolute',
              bottom: '28px',
              insetInlineStart: '28px',
              background: 'rgba(10,35,24,0.92)',
              border: '1px solid rgba(240,180,41,0.28)',
              borderRadius: '12px',
              padding: '10px 16px',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: '22px', color: '#F0B429', lineHeight: 1 }}>
              {TOTAL}+
            </div>
            <div style={{ fontFamily: font, fontSize: '11px', color: 'rgba(255,255,255,0.50)', marginTop: '3px' }}>
              {t('total_merchants')}
            </div>
          </div>
        </div>

        {/* ──────────────── Stats panel ──────────────── */}
        <div
          style={{
            flex: '0 1 292px',
            minWidth: '220px',
            padding: '28px 22px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <p style={{ fontFamily: font, fontWeight: 700, fontSize: '15px', color: '#FFFFFF', margin: '0 0 18px' }}>
            {t('city_ranking')}
          </p>

          {/* Ranked city list */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[...CITIES]
              .sort((a, b) => b.count - a.count)
              .map((city, rank) => {
                const isAct = active?.id === city.id
                const barW  = (city.count / MAX_COUNT) * 100
                return (
                  <div
                    key={city.id}
                    onMouseEnter={() => setActive(city)}
                    onMouseLeave={() => setActive(null)}
                    onClick={() => toggle(city)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '7px 10px', borderRadius: '8px', cursor: 'pointer',
                      background: isAct ? 'rgba(240,180,41,0.10)' : 'transparent',
                      border: `1px solid ${isAct ? 'rgba(240,180,41,0.28)' : 'transparent'}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    {/* Rank number */}
                    <span style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '11px', fontWeight: 700, minWidth: '16px', textAlign: 'center',
                      color: rank < 3 ? '#F0B429' : 'rgba(255,255,255,0.28)',
                    }}>
                      {rank + 1}
                    </span>

                    {/* City name + bar */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{
                          fontFamily: font, fontSize: '13px',
                          fontWeight: isAct ? 700 : 500,
                          color: isAct ? '#FFFFFF' : 'rgba(255,255,255,0.72)',
                          transition: 'color 0.15s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {city.name}
                        </span>
                        <span style={{
                          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', fontWeight: 700, flexShrink: 0, marginInlineStart: '6px',
                          color: isAct ? '#F0B429' : 'rgba(255,255,255,0.38)',
                          transition: 'color 0.15s',
                        }}>
                          {city.count}
                        </span>
                      </div>
                      {/* Bar */}
                      <div style={{ height: '3px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${barW}%`, borderRadius: '99px',
                          background: isAct
                            ? 'linear-gradient(90deg,#F0B429,#FFD256)'
                            : rank < 3
                              ? 'rgba(240,180,41,0.55)'
                              : 'rgba(255,255,255,0.18)',
                          transition: 'background 0.15s',
                        }} />
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>

          {/* Detail / hint card */}
          <div style={{ marginTop: '14px' }}>
            {active ? (
              <div style={{
                padding: '14px 16px',
                background: 'rgba(240,180,41,0.07)',
                border: '1px solid rgba(240,180,41,0.22)',
                borderRadius: '12px',
                transition: 'all 0.2s',
              }}>
                <div style={{ fontFamily: font, fontWeight: 700, fontSize: '14px', color: '#FFFFFF', marginBottom: '2px' }}>
                  {active.name}
                </div>
                <div style={{ fontFamily: font, fontSize: '11px', color: 'rgba(255,255,255,0.50)', marginBottom: '8px' }}>
                  {active.region}
                </div>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: '22px', color: '#F0B429', lineHeight: 1 }}>
                  {active.count}
                </div>
                <div style={{ fontFamily: font, fontSize: '11px', color: 'rgba(255,255,255,0.42)', marginTop: '2px', marginBottom: active.slug ? '10px' : 0 }}>
                  {t('hover_count_suffix')}
                </div>
                {active.slug && (
                  <a
                    href={`/${locale}/caisse-enregistreuse-${active.slug}`}
                    style={{
                      fontFamily: font, fontSize: '12px', fontWeight: 600, color: '#F0B429',
                      textDecoration: 'none', borderBottom: '1px solid rgba(240,180,41,0.35)',
                      paddingBottom: '1px', display: 'inline-block',
                    }}
                  >
                    {t('hover_link')} {isRTL ? '←' : '→'}
                  </a>
                )}
              </div>
            ) : (
              <div style={{
                padding: '14px 16px', textAlign: 'center',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
              }}>
                <div style={{ fontSize: '22px', marginBottom: '6px' }}>🗺️</div>
                <div style={{ fontFamily: font, fontSize: '12px', color: 'rgba(255,255,255,0.30)' }}>
                  {t('hover_hint')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
