'use client';

import { useState } from 'react';

// ─── data ─────────────────────────────────────────────────────────────────────
const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
const VALUES = [820, 1240, 980, 1450, 1247, 1680, 890];
const TODAY_IDX = 4; // الأربعاء

// ─── chart geometry ───────────────────────────────────────────────────────────
const W = 700;
const H = 260;
const PL = 58;
const PR = 16;
const PT = 20;
const PB = 50;
const IW = W - PL - PR;   // 626
const IH = H - PT - PB;   // 190

const BAR_W = 62;
const STRIDE = Math.round((IW - BAR_W) / (DAYS.length - 1)); // 94

const MAX_VAL = 2000;
const GRID = [500, 1000, 1500];

function toY(v: number): number {
  return PT + IH - (v / MAX_VAL) * IH;
}

function bX(i: number): number {
  return PL + i * STRIDE;
}

// ─── component ────────────────────────────────────────────────────────────────
export default function SalesChart() {
  const [hov, setHov] = useState<number | null>(null);

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        marginTop: '28px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          direction: 'rtl',
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111827' }}>
            مبيعات الأسبوع
          </h2>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '2px 0 0' }}>
            السبت — الجمعة
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 2px' }}>
            إجمالي الأسبوع
          </p>
          <p
            style={{
              fontSize: '22px',
              fontWeight: 800,
              margin: 0,
              color: '#111827',
              direction: 'ltr',
              fontFamily: 'Inter, monospace',
            }}
          >
            MAD 8,307.00
          </p>
        </div>
      </div>

      {/* SVG chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible', display: 'block' }}
        aria-label="مخطط مبيعات الأسبوع"
        role="img"
      >
        {/* Y-axis grid lines */}
        {GRID.map((gv) => {
          const y = toY(gv);
          return (
            <g key={gv}>
              <line
                x1={PL}
                y1={y}
                x2={W - PR}
                y2={y}
                stroke="#F3F4F6"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={PL - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={11}
                fill="#9CA3AF"
                fontFamily="Inter, sans-serif"
              >
                {gv}
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line
          x1={PL}
          y1={PT + IH}
          x2={W - PR}
          y2={PT + IH}
          stroke="#E5E7EB"
          strokeWidth={1}
        />

        {/* Bars */}
        {VALUES.map((val, i) => {
          const x = bX(i);
          const bh = (val / MAX_VAL) * IH;
          const by = PT + IH - bh;
          const isToday = i === TODAY_IDX;
          const isHov = hov === i;
          const fill = isToday ? '#F0B429' : '#0F3D2A';
          const opacity = isHov ? 1 : isToday ? 0.92 : 0.68;

          return (
            <g
              key={i}
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
            >
              {/* Wider invisible hit area */}
              <rect
                x={x}
                y={PT}
                width={BAR_W}
                height={IH}
                fill="transparent"
              />

              {/* Bar */}
              <rect
                x={x}
                y={by}
                width={BAR_W}
                height={bh}
                rx={6}
                ry={6}
                fill={fill}
                opacity={opacity}
                style={{ transition: 'opacity 0.15s ease' }}
              />

              {/* Tooltip */}
              {isHov && (
                <g>
                  <rect
                    x={x + BAR_W / 2 - 44}
                    y={by - 38}
                    width={88}
                    height={26}
                    rx={6}
                    fill="#111827"
                  />
                  <text
                    x={x + BAR_W / 2}
                    y={by - 20}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight="700"
                    fill="#FFFFFF"
                    fontFamily="Inter, sans-serif"
                  >
                    {val.toLocaleString()} MAD
                  </text>
                  <polygon
                    points={`
                      ${x + BAR_W / 2 - 6},${by - 12}
                      ${x + BAR_W / 2 + 6},${by - 12}
                      ${x + BAR_W / 2},${by - 6}
                    `}
                    fill="#111827"
                  />
                </g>
              )}

              {/* Day label */}
              <text
                x={x + BAR_W / 2}
                y={PT + IH + 22}
                textAnchor="middle"
                fontSize={12}
                fill={isToday ? '#F0B429' : '#6B7280'}
                fontWeight={isToday ? '700' : '400'}
                fontFamily="Noto Naskh Arabic, Cairo, sans-serif"
              >
                {DAYS[i]}
              </text>

              {/* Today dot indicator */}
              {isToday && (
                <circle
                  cx={x + BAR_W / 2}
                  cy={PT + IH + 38}
                  r={3}
                  fill="#F0B429"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          marginTop: '4px',
          direction: 'rtl',
          fontSize: '12px',
          color: '#9CA3AF',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '12px',
              height: '12px',
              background: '#F0B429',
              borderRadius: '2px',
              display: 'inline-block',
            }}
          />
          اليوم (الأربعاء)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '12px',
              height: '12px',
              background: '#0F3D2A',
              borderRadius: '2px',
              display: 'inline-block',
              opacity: 0.68,
            }}
          />
          بقية الأسبوع
        </span>
      </div>
    </div>
  );
}
