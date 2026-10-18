import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

// Development testing ONLY — verifies Green API is correctly wired
// Returns 403 in production
export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const result = await sendWhatsAppMessage({
    to: process.env.WHATSAPP_BUSINESS_NUMBER ?? '212619522487',
    message: `✅ Test MAGHAREBIT — Green API fonctionne correctement!\n\n${new Date().toLocaleString('fr-MA')}`,
  })

  return NextResponse.json(result)
}
