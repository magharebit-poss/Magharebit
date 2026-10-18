'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';

export interface FloorTable {
  table_id:         string;
  label:            string;
  capacity:         number;
  pos_x:            number;
  pos_y:            number;
  status:           'available' | 'occupied' | 'billed' | 'reserved';
  current_order_id: string | null;
}

interface Props {
  token:      string;
  onSelect:   (table: FloorTable) => void;
  onClose:    () => void;
  refreshKey?: number;
}

const STATUS_COLOR: Record<string, string> = {
  available: '#10B981',
  occupied:  '#F0B429',
  billed:    '#EF4444',
  reserved:  '#6B7280',
};

export function TableMap({ token, onSelect, onClose, refreshKey }: Props) {
  const { t } = useLanguage();
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [loading, setLoading] = useState(true);

  const statusLabel: Record<string, string> = {
    available: t.tableMap.statusAvailable,
    occupied:  t.tableMap.statusOccupied,
    billed:    t.tableMap.statusBilled,
    reserved:  t.tableMap.statusReserved,
  };

  useEffect(() => {
    fetch('/api/tables', { headers: { authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setTables)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, refreshKey]);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#0F3D2A', borderRadius: '20px', padding: '1.5rem',
        width: '100%', maxWidth: '620px',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '1rem',
        }}>
          <h2 style={{ color: '#F0B429', fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>
            🪑 {t.tableMap.title}
          </h2>
          <button
            onClick={onClose}
            aria-label={t.payment.close}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.5)', fontSize: '1.5rem', cursor: 'pointer',
            }}
          >×</button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {Object.entries(statusLabel).map(([s, l]) => (
            <div key={s} style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)',
            }}>
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: STATUS_COLOR[s],
              }} />
              {l}
            </div>
          ))}
        </div>

        {/* Floor plan canvas — pos_x/pos_y are stored absolute pixel coordinates, not text layout */}
        <div style={{
          position: 'relative', background: 'rgba(0,0,0,0.2)',
          borderRadius: '12px', height: '380px', overflow: 'hidden',
        }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.4)',
            }}>{t.tableMap.loading}</div>
          )}
          {tables.map(tbl => (
            <button
              key={tbl.table_id}
              onClick={() => onSelect(tbl)}
              style={{
                position: 'absolute',
                left:  `${tbl.pos_x}px`,
                top:   `${tbl.pos_y}px`,
                width:  '120px',
                height: '120px',
                background: `${STATUS_COLOR[tbl.status]}22`,
                border: `2px solid ${STATUS_COLOR[tbl.status]}`,
                borderRadius: '16px',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '0.25rem',
                transition: 'transform 0.15s, opacity 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
            >
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>{tbl.label}</span>
              <span style={{ fontSize: '0.7rem', color: STATUS_COLOR[tbl.status], fontWeight: 600 }}>
                {statusLabel[tbl.status]}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                {t.tableMap.capacity.replace('{n}', String(tbl.capacity))}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
