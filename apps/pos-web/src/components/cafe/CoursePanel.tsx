'use client';

import { useCallback, useEffect, useState } from 'react';
import { TRANSLATIONS, type Lang } from '../../lib/i18n';
import { pickName } from '../../lib/names';
import { getStatus as getPrinterStatus, printData } from '../../lib/printer/printer-manager';
import { buildKitchenTicket } from '../../lib/printer/receipt-builder';

interface PanelLine {
  line_id:       string;
  name_ar:       string;
  name_fr:       string | null;
  quantity:      number;
  modifiers:     Array<{ label_ar: string; label_fr?: string | null }>;
  kds_status:    string;
  course_number: number | null;
  allergy_flags: string[];
}

interface PanelOrder {
  order_id:    string;
  table_label: string | null;
  lines:       PanelLine[];
}

interface AllergyDef {
  code:     string;
  label_ar: string;
  label_fr: string;
  label_en: string;
  icon:     string | null;
}

interface CoursePanelProps {
  orderId:        string;
  token:          string;
  lang:           Lang;
  onCoursesFired: () => void;
}

const COURSE_CHOICES = [null, 1, 2, 3] as const;

export function CoursePanel({ orderId, token, lang, onCoursesFired }: CoursePanelProps) {
  const t = TRANSLATIONS[lang].course;

  const [lines, setLines]             = useState<PanelLine[]>([]);
  const [tableLabel, setTableLabel]   = useState<string | null>(null);
  const [allergyDefs, setAllergyDefs] = useState<AllergyDef[]>([]);
  const [error, setError]             = useState('');
  const [busyKey, setBusyKey]         = useState<string | null>(null);
  const [editing, setEditing]         = useState<PanelLine | null>(null);
  const [draft, setDraft]             = useState<string[]>([]);

  const authHeaders = { authorization: `Bearer ${token}` };
  const jsonHeaders = { ...authHeaders, 'content-type': 'application/json' };

  const allergyLabel = (d: AllergyDef) =>
    lang === 'ar' ? d.label_ar : lang === 'fr' ? d.label_fr : d.label_en;

  const load = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/cafe/orders?include_held=1', {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(String(res.status));
      const orders = await res.json() as PanelOrder[];
      const order = orders.find((o) => o.order_id === orderId);
      setLines(order?.lines ?? []);
      setTableLabel(order?.table_label ?? null);
      return true;
    } catch {
      return false;
    }
  }, [orderId, token]);

  const refresh = useCallback(async () => {
    setError((await load()) ? '' : t.errorLoad);
  }, [load, t.errorLoad]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    void fetch('/api/allergies', { headers: { authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.ok) setAllergyDefs(await res.json() as AllergyDef[]);
      })
      .catch(() => { /* picker stays empty */ });
  }, [token]);

  async function changeCourse(line: PanelLine, course: number | null) {
    setBusyKey(line.line_id);
    try {
      const res = await fetch(`/api/cafe/orders/${orderId}/lines/${line.line_id}/course`, {
        method: 'POST', headers: jsonHeaders, body: JSON.stringify({ course_number: course }),
      });
      await refresh();
      if (res.status === 409) setError(t.errorStarted);
      else if (!res.ok) setError(t.errorSave);
    } catch {
      setError(t.errorSave);
    } finally {
      setBusyKey(null);
    }
  }

  async function fireCourse(course: number, groupLines: PanelLine[]) {
    setBusyKey(`fire-${course}`);
    try {
      const res = await fetch(`/api/cafe/orders/${orderId}/fire-course`, {
        method: 'POST', headers: jsonHeaders, body: JSON.stringify({ course_number: course }),
      });
      if (!res.ok) {
        await refresh();
        setError(t.errorFire);
        return;
      }
      const result = await res.json() as { line_ids: string[]; count: number };
      await refresh();

      if (result.count > 0 && getPrinterStatus() === 'connected') {
        const fired = groupLines.filter((l) => result.line_ids.includes(l.line_id));
        const bytes = buildKitchenTicket({
          orderNumber: orderId.slice(0, 8).toUpperCase(),
          tableName:   tableLabel,
          courseName:  t.courseN.replace('{n}', String(course)),
          lines: fired.map((l) => {
            const defs = l.allergy_flags.map((code) => allergyDefs.find((d) => d.code === code));
            return {
              name_ar:       l.name_ar,
              name_fr:       l.name_fr ?? '',
              quantity:      l.quantity,
              modifiers:     l.modifiers.map((m) => ({ label_ar: m.label_ar, label_fr: m.label_fr ?? '' })),
              allergy_flags: l.allergy_flags,
              allergyLabels: defs.map((d, i) => (d ? allergyLabel(d) : l.allergy_flags[i]!)),
              allergyIcons:  defs.map((d) => d?.icon ?? ''),
            };
          }),
          firedAt: new Date().toISOString(),
          lang,
        });
        await printData(bytes).catch(() => { /* silent — printer may be disconnected */ });
      }
      onCoursesFired();
    } catch {
      setError(t.errorFire);
    } finally {
      setBusyKey(null);
    }
  }

  async function saveAllergies() {
    if (!editing) return;
    setBusyKey(`allergy-${editing.line_id}`);
    try {
      const res = await fetch(`/api/cafe/orders/${orderId}/lines/${editing.line_id}/allergies`, {
        method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ allergy_flags: draft }),
      });
      await refresh();
      if (res.ok) setEditing(null);
      else setError(t.errorSave);
    } catch {
      setError(t.errorSave);
    } finally {
      setBusyKey(null);
    }
  }

  const courseNumbers = [...new Set(
    lines.map((l) => l.course_number).filter((n): n is number => n !== null),
  )].sort((a, b) => a - b);

  const groups = [
    { course: null as number | null, title: t.noCourse, lines: lines.filter((l) => l.course_number === null) },
    ...courseNumbers.map((n) => ({
      course: n as number | null,
      title: t.courseN.replace('{n}', String(n)),
      lines: lines.filter((l) => l.course_number === n),
    })),
  ].filter((g) => g.lines.length > 0);

  const arrow = lang === 'ar' ? '←' : '→';

  return (
    <div style={{
      background: '#0F3D2A', borderRadius: '12px', padding: '0.75rem',
      border: '1px solid rgba(255,255,255,0.08)', color: '#fff',
    }}>
      <p style={{ color: '#F0B429', fontWeight: 700, fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
        🍽️ {t.panelTitle}
      </p>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: '8px', padding: '0.4rem 0.6rem', marginBottom: '0.5rem',
          color: '#FCA5A5', fontSize: '0.75rem',
        }}>{error}</div>
      )}

      {lines.length === 0 && !error && (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', margin: 0 }}>{t.empty}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {groups.map((g) => {
          const pending = g.lines.filter((l) => l.kds_status === 'pending');
          return (
            <div key={g.course ?? 'none'}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '0.3rem',
              }}>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 600 }}>
                  {g.title}
                </span>
                {g.course !== null && (pending.length > 0 ? (
                  <button
                    onClick={() => void fireCourse(g.course!, g.lines)}
                    disabled={busyKey !== null}
                    style={{
                      minHeight: '48px', padding: '0 0.9rem', borderRadius: '10px', border: 'none',
                      background: '#F0B429', color: '#0A2318', fontWeight: 800, fontSize: '0.8rem',
                      cursor: busyKey !== null ? 'not-allowed' : 'pointer',
                      opacity: busyKey !== null ? 0.6 : 1,
                    }}
                  >
                    {t.fire} {arrow}
                  </button>
                ) : (
                  <span style={{ color: '#6EE7B7', fontSize: '0.72rem', fontWeight: 700 }}>✓ {t.fired}</span>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {g.lines.map((line) => {
                  const started = line.kds_status !== 'pending';
                  return (
                    <div key={line.line_id} style={{
                      background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.4rem 0.5rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: 0 }}>
                          {line.quantity}× {pickName(lang, line.name_ar, line.name_fr)}
                          {line.course_number !== null && line.kds_status === 'pending' && (
                            <span style={{ color: '#F0B429', fontSize: '0.68rem', marginInlineStart: '0.4rem' }}>
                              {t.held}
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => { setEditing(line); setDraft(line.allergy_flags); }}
                          aria-label={t.allergies}
                          style={{
                            minWidth: '40px', minHeight: '40px', borderRadius: '8px',
                            border: line.allergy_flags.length > 0 ? '1px solid #DC2626' : '1px solid rgba(255,255,255,0.2)',
                            background: line.allergy_flags.length > 0 ? 'rgba(220,38,38,0.25)' : 'transparent',
                            color: '#fff', cursor: 'pointer', fontSize: '0.85rem',
                          }}
                        >
                          {line.allergy_flags.length > 0
                            ? line.allergy_flags.map((code) => allergyDefs.find((d) => d.code === code)?.icon ?? '⚠️').join('')
                            : '⚠️'}
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.35rem' }}>
                        {COURSE_CHOICES.map((c) => {
                          const active = line.course_number === c;
                          return (
                            <button
                              key={c ?? 'none'}
                              onClick={() => void changeCourse(line, c)}
                              disabled={started || busyKey !== null}
                              style={{
                                flex: 1, minHeight: '40px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
                                border: active ? '1px solid #F0B429' : '1px solid rgba(255,255,255,0.2)',
                                background: active ? '#F0B429' : 'transparent',
                                color: active ? '#0A2318' : '#fff',
                                opacity: started ? 0.4 : 1,
                                cursor: started || busyKey !== null ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {c === null ? t.none : c}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div style={{
            background: '#0F3D2A', borderRadius: '16px', padding: '1rem', width: '100%', maxWidth: '360px',
            border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
          }}>
            <p style={{ color: '#F0B429', fontWeight: 700, fontSize: '0.9rem', margin: '0 0 0.2rem' }}>
              {t.allergies}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', margin: '0 0 0.75rem' }}>
              {editing.quantity}× {pickName(lang, editing.name_ar, editing.name_fr)}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.9rem' }}>
              {allergyDefs.map((d) => {
                const on = draft.includes(d.code);
                return (
                  <button
                    key={d.code}
                    onClick={() => setDraft((prev) => on ? prev.filter((c) => c !== d.code) : [...prev, d.code])}
                    aria-pressed={on}
                    style={{
                      minHeight: '48px', padding: '0 0.7rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700,
                      border: on ? '1px solid #DC2626' : '1px solid rgba(255,255,255,0.2)',
                      background: on ? '#DC2626' : 'transparent', color: '#fff', cursor: 'pointer',
                    }}
                  >
                    {d.icon} {allergyLabel(d)}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => void saveAllergies()}
                disabled={busyKey !== null}
                style={{
                  flex: 1, minHeight: '48px', borderRadius: '10px', border: 'none',
                  background: '#F0B429', color: '#0A2318', fontWeight: 800, cursor: 'pointer',
                }}
              >{t.save}</button>
              <button
                onClick={() => setEditing(null)}
                style={{
                  flex: 1, minHeight: '48px', borderRadius: '10px', background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.25)', color: '#fff', cursor: 'pointer',
                }}
              >{t.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
