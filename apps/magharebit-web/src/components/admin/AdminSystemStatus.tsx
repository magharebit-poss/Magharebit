'use client'

import { useEffect, useState } from 'react'

interface HealthData {
  database: { connected: boolean; database?: string; error?: string }
  whatsapp: { configured: boolean; businessNumber: string }
  environment: string
}

interface Props {
  adminSecret: string
}

export default function AdminSystemStatus({ adminSecret }: Props) {
  const [health, setHealth] = useState<HealthData | null>(null)

  useEffect(() => {
    if (!adminSecret) return
    fetch('/api/admin/health', {
      headers: { 'x-admin-secret': adminSecret },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => setHealth(data))
      .catch(() => null) // silent fail — admin context only
  }, [adminSecret])

  if (!health) return null

  const dot = (on: boolean, amber?: boolean) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: on ? '#22C55E' : amber ? '#F59E0B' : '#9CA3AF',
    flexShrink: 0 as const,
  })

  return (
    <div
      style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        padding: '8px 14px',
        background: '#F9FAFB',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        marginBottom: '16px',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        System
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={dot(health.database.connected, !health.database.connected)} />
        <span style={{ fontSize: '12px', color: health.database.connected ? '#166534' : '#92400E', fontWeight: 500 }}>
          MongoDB {health.database.connected ? `(${health.database.database})` : '(JSON fallback)'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={dot(health.whatsapp.configured)} />
        <span style={{ fontSize: '12px', color: health.whatsapp.configured ? '#166534' : '#6B7280', fontWeight: 500 }}>
          WhatsApp API {health.whatsapp.configured ? '(Green API)' : '(not configured)'}
        </span>
      </div>
    </div>
  )
}
