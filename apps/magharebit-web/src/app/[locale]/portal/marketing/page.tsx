'use client';

import { useState, useEffect, useCallback } from 'react';
import PortalBreadcrumb from '@/components/portal/PortalBreadcrumb';

// ─── Types ────────────────────────────────────────────────────────────────────

type CampaignStatus   = 'draft' | 'sending' | 'completed';
type CampaignAudience = 'all' | 'bronze' | 'silver' | 'gold';

interface Campaign {
  id:              string;
  title:           string;
  messageTemplate: string;
  targetAudience:  CampaignAudience;
  status:          CampaignStatus;
  recipientCount:  number;
  successCount:    number;
  failCount:       number;
  createdAt:       string;
  sentAt?:         string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AUDIENCE_LABELS: Record<CampaignAudience, string> = {
  all:    'جميع العملاء',
  bronze: 'الفئة البرونزية 🥉',
  silver: 'الفئة الفضية 🥈',
  gold:   'الفئة الذهبية 🥇',
};

const STATUS_META: Record<CampaignStatus, { label: string; color: string; bg: string }> = {
  draft:     { label: 'مسودة',    color: '#374151', bg: '#F3F4F6' },
  sending:   { label: 'جارٍ الإرسال', color: '#92400E', bg: '#FEF3C7' },
  completed: { label: 'مكتملة',   color: '#065F46', bg: '#D1FAE5' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ar-MA', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px', color: '#6B7280' }}>
      <div style={{ fontSize: '56px', marginBottom: '16px' }}>📢</div>
      <p style={{ fontFamily: 'Noto Naskh Arabic, serif', fontSize: '18px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
        لا توجد حملات بعد
      </p>
      <p style={{ fontFamily: 'Noto Naskh Arabic, serif', fontSize: '14px', marginBottom: '24px' }}>
        أنشئ حملة واتساب لإرسال رسائل ترويجية لعملائك
      </p>
      <button onClick={onNew} style={btnStyle('#16A34A', '#FFFFFF')}>
        + إنشاء حملة جديدة
      </button>
    </div>
  );
}

// ─── Shared button style helper ───────────────────────────────────────────────

function btnStyle(bg: string, color: string, sm = false): React.CSSProperties {
  return {
    background: bg, color, border: 'none', borderRadius: '8px',
    padding: sm ? '6px 14px' : '10px 20px',
    fontSize: sm ? '13px' : '14px', fontWeight: 600, cursor: 'pointer',
    fontFamily: 'Noto Naskh Arabic, serif',
    transition: 'opacity 0.15s',
  };
}

// ─── Campaign form modal ──────────────────────────────────────────────────────

interface FormProps {
  initial?: Campaign;
  onSave:   (data: { title: string; messageTemplate: string; targetAudience: CampaignAudience }) => void;
  onClose:  () => void;
  saving:   boolean;
  error?:   string;
}

function CampaignForm({ initial, onSave, onClose, saving, error }: FormProps) {
  const [title,    setTitle]    = useState(initial?.title           ?? '');
  const [template, setTemplate] = useState(initial?.messageTemplate ?? '');
  const [audience, setAudience] = useState<CampaignAudience>(initial?.targetAudience ?? 'all');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ title: title.trim(), messageTemplate: template.trim(), targetAudience: audience });
  }

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontFamily: 'Noto Naskh Arabic, serif', fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>
            {initial ? 'تعديل الحملة' : 'حملة جديدة'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#6B7280' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>عنوان الحملة *</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="مثال: تخفيضات نهاية الشهر"
              required style={inputStyle}
              disabled={saving}
            />
          </div>

          <div>
            <label style={labelStyle}>الجمهور المستهدف</label>
            <select value={audience} onChange={e => setAudience(e.target.value as CampaignAudience)} style={inputStyle} disabled={saving}>
              {(Object.entries(AUDIENCE_LABELS) as [CampaignAudience, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>
              نص الرسالة *
              <span style={{ fontSize: '12px', color: '#9CA3AF', marginRight: '8px' }}>
                (استخدم {'{name}'} لاسم العميل)
              </span>
            </label>
            <textarea
              value={template} onChange={e => setTemplate(e.target.value)}
              placeholder={`مثال:\nمرحباً {name}!\nلدينا عرض خاص اليوم — خصم 20% على جميع المنتجات. 🎉`}
              required rows={6}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '130px' }}
              disabled={saving}
            />
          </div>

          {/* Live preview */}
          {template.trim() && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px' }}>
              <p style={{ fontFamily: 'Noto Naskh Arabic, serif', fontSize: '12px', color: '#065F46', margin: '0 0 6px', fontWeight: 600 }}>
                معاينة (اسم نموذجي: أحمد)
              </p>
              <p style={{ fontFamily: 'Noto Naskh Arabic, serif', fontSize: '13px', color: '#111827', margin: 0, whiteSpace: 'pre-wrap' }}>
                {template.replace(/\{name\}/g, 'أحمد')}
              </p>
            </div>
          )}

          {error && (
            <p style={{ fontFamily: 'Noto Naskh Arabic, serif', fontSize: '13px', color: '#DC2626', margin: 0 }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button type="button" onClick={onClose} style={btnStyle('#F3F4F6', '#374151')} disabled={saving}>
              إلغاء
            </button>
            <button type="submit" style={btnStyle('#16A34A', '#FFFFFF')} disabled={saving}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Confirm send modal ───────────────────────────────────────────────────────

interface SendConfirmProps {
  campaign: Campaign;
  onConfirm: () => void;
  onClose:   () => void;
  sending:   boolean;
  result?: { recipientCount: number; successCount: number; failCount: number };
  error?: string;
}

function SendConfirm({ campaign, onConfirm, onClose, sending, result, error }: SendConfirmProps) {
  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget && !sending) onClose(); }}>
      <div style={{ ...modalStyle, maxWidth: '420px' }}>
        {result ? (
          <>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>
                {result.failCount === 0 ? '✅' : '⚠️'}
              </div>
              <h3 style={{ fontFamily: 'Noto Naskh Arabic, serif', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>
                تم الإرسال
              </h3>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '20px' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '24px', fontWeight: 700, color: '#16A34A', margin: 0 }}>{result.successCount}</p>
                  <p style={{ fontSize: '12px', color: '#6B7280', margin: 0, fontFamily: 'Noto Naskh Arabic, serif' }}>نجح</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '24px', fontWeight: 700, color: '#DC2626', margin: 0 }}>{result.failCount}</p>
                  <p style={{ fontSize: '12px', color: '#6B7280', margin: 0, fontFamily: 'Noto Naskh Arabic, serif' }}>فشل</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '24px', fontWeight: 700, color: '#374151', margin: 0 }}>{result.recipientCount}</p>
                  <p style={{ fontSize: '12px', color: '#6B7280', margin: 0, fontFamily: 'Noto Naskh Arabic, serif' }}>إجمالي</p>
                </div>
              </div>
              <button onClick={onClose} style={btnStyle('#16A34A', '#FFFFFF')}>إغلاق</button>
            </div>
          </>
        ) : (
          <>
            <h3 style={{ fontFamily: 'Noto Naskh Arabic, serif', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
              تأكيد إرسال الحملة
            </h3>
            <p style={{ fontFamily: 'Noto Naskh Arabic, serif', fontSize: '14px', color: '#374151', marginBottom: '16px' }}>
              هل تريد إرسال الحملة <strong>«{campaign.title}»</strong> إلى{' '}
              <strong>{AUDIENCE_LABELS[campaign.targetAudience]}</strong>؟
            </p>
            <p style={{ fontFamily: 'Noto Naskh Arabic, serif', fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
              ملاحظة: لا يمكن التراجع عن الإرسال، وستتغير الحملة إلى «مكتملة».
            </p>
            {error && (
              <p style={{ fontFamily: 'Noto Naskh Arabic, serif', fontSize: '13px', color: '#DC2626', marginBottom: '12px' }}>
                {error}
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={btnStyle('#F3F4F6', '#374151')} disabled={sending}>
                إلغاء
              </button>
              <button onClick={onConfirm} style={btnStyle('#16A34A', '#FFFFFF')} disabled={sending}>
                {sending ? 'جارٍ الإرسال…' : 'إرسال الآن 📤'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 200, padding: '16px',
};

const modalStyle: React.CSSProperties = {
  background: '#FFFFFF', borderRadius: '12px', padding: '24px',
  width: '100%', maxWidth: '540px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  direction: 'rtl',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'Noto Naskh Arabic, serif',
  fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
  border: '1px solid #D1D5DB', borderRadius: '8px',
  fontFamily: 'Noto Naskh Arabic, serif', fontSize: '14px', color: '#111827',
  outline: 'none', direction: 'rtl',
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const [campaigns,    setCampaigns]    = useState<Campaign[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  // Form modal state
  const [showForm,     setShowForm]     = useState(false);
  const [editing,      setEditing]      = useState<Campaign | undefined>(undefined);
  const [formSaving,   setFormSaving]   = useState(false);
  const [formError,    setFormError]    = useState<string | undefined>(undefined);

  // Send modal state
  const [sendTarget,   setSendTarget]   = useState<Campaign | null>(null);
  const [sending,      setSending]      = useState(false);
  const [sendError,    setSendError]    = useState<string | undefined>(undefined);
  const [sendResult,   setSendResult]   = useState<
    { recipientCount: number; successCount: number; failCount: number } | undefined
  >(undefined);

  // ── Fetch campaigns ──────────────────────────────────────────────────────
  // Uses the same .then/.catch/.finally pattern as other portal pages so the
  // React Compiler does not flag synchronous setState inside an effect body.

  const fetchCampaigns = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/portal/whatsapp/campaigns', { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json() as { campaigns?: Campaign[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setCampaigns(data.campaigns ?? []);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'فشل في تحميل الحملات');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void (async () => { fetchCampaigns(); })();
  }, [fetchCampaigns]);

  // ── Create / edit ────────────────────────────────────────────────────────

  function openNew() {
    setEditing(undefined);
    setFormError(undefined);
    setShowForm(true);
  }

  function openEdit(c: Campaign) {
    setEditing(c);
    setFormError(undefined);
    setShowForm(true);
  }

  async function handleFormSave(data: {
    title:           string;
    messageTemplate: string;
    targetAudience:  CampaignAudience;
  }) {
    setFormSaving(true);
    setFormError(undefined);
    try {
      let res: Response;
      if (editing) {
        res = await fetch(`/api/portal/whatsapp/campaigns/${editing.id}`, {
          method:      'PATCH',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify(data),
        });
      } else {
        res = await fetch('/api/portal/whatsapp/campaigns', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify(data),
        });
      }
      const d = await res.json() as { error?: string };
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setShowForm(false);
      await fetchCampaigns();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'حدث خطأ');
    } finally {
      setFormSaving(false);
    }
  }

  // ── Send ─────────────────────────────────────────────────────────────────

  function openSend(c: Campaign) {
    setSendTarget(c);
    setSendError(undefined);
    setSendResult(undefined);
  }

  async function handleSend() {
    if (!sendTarget) return;
    setSending(true);
    setSendError(undefined);
    try {
      const res  = await fetch(`/api/portal/whatsapp/campaigns/${sendTarget.id}/send`, {
        method: 'POST', credentials: 'include',
      });
      const data = await res.json() as {
        recipientCount?: number; successCount?: number; failCount?: number; error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSendResult({
        recipientCount: data.recipientCount ?? 0,
        successCount:   data.successCount   ?? 0,
        failCount:      data.failCount      ?? 0,
      });
      await fetchCampaigns();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'حدث خطأ');
    } finally {
      setSending(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div dir="rtl" style={{ fontFamily: 'Noto Naskh Arabic, serif', minHeight: '100vh', background: '#F9FAFB', padding: '24px' }}>
      <PortalBreadcrumb current="التسويق" />

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            📢 حملات واتساب
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
            أرسل رسائل ترويجية مخصصة لعملائك عبر واتساب
          </p>
        </div>
        <button onClick={openNew} style={btnStyle('#16A34A', '#FFFFFF')}>
          + حملة جديدة
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF', fontSize: '14px' }}>
          جارٍ التحميل…
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#DC2626', fontSize: '14px' }}>
          {error}
          <br />
          <button onClick={fetchCampaigns} style={{ ...btnStyle('#F3F4F6', '#374151', true), marginTop: '12px' }}>
            إعادة المحاولة
          </button>
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState onNew={openNew} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {campaigns.map(c => {
            const meta = STATUS_META[c.status];
            return (
              <div key={c.id} style={{
                background: '#FFFFFF', borderRadius: '12px', padding: '16px 20px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
              }}>
                {/* Status chip */}
                <span style={{
                  background: meta.bg, color: meta.color, borderRadius: '999px',
                  padding: '3px 12px', fontSize: '12px', fontWeight: 600, flexShrink: 0,
                }}>
                  {meta.label}
                </span>

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: '15px', color: '#111827', margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.title}
                  </p>
                  <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                    {AUDIENCE_LABELS[c.targetAudience]}
                    {c.status === 'completed' && (
                      <span style={{ marginRight: '12px' }}>
                        ✅ {c.successCount} نجح &nbsp;|&nbsp;
                        ❌ {c.failCount} فشل &nbsp;|&nbsp;
                        إجمالي {c.recipientCount}
                      </span>
                    )}
                    {c.sentAt && (
                      <span style={{ marginRight: '12px', color: '#9CA3AF' }}>
                        أُرسلت {fmtDate(c.sentAt)}
                      </span>
                    )}
                    {!c.sentAt && (
                      <span style={{ marginRight: '12px', color: '#9CA3AF' }}>
                        أُنشئت {fmtDate(c.createdAt)}
                      </span>
                    )}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  {c.status === 'draft' && (
                    <>
                      <button onClick={() => openEdit(c)} style={btnStyle('#F3F4F6', '#374151', true)}>
                        ✏️ تعديل
                      </button>
                      <button onClick={() => openSend(c)} style={btnStyle('#16A34A', '#FFFFFF', true)}>
                        📤 إرسال
                      </button>
                    </>
                  )}
                  {c.status === 'completed' && (
                    <span style={{ fontSize: '13px', color: '#9CA3AF', padding: '6px 0' }}>مكتملة</span>
                  )}
                  {c.status === 'sending' && (
                    <span style={{ fontSize: '13px', color: '#92400E', padding: '6px 0' }}>⏳ جارٍ الإرسال…</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <CampaignForm
          initial={editing}
          onSave={handleFormSave}
          onClose={() => setShowForm(false)}
          saving={formSaving}
          error={formError}
        />
      )}

      {sendTarget && (
        <SendConfirm
          campaign={sendTarget}
          onConfirm={handleSend}
          onClose={() => {
            if (!sending) {
              setSendTarget(null);
              setSendResult(undefined);
            }
          }}
          sending={sending}
          result={sendResult}
          error={sendError}
        />
      )}
    </div>
  );
}
