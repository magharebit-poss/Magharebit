'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { pickName } from '../../lib/names';

export interface ModifierOption {
  label_ar:    string;
  label_fr:    string;
  price_delta: number;
}

export interface ModifierGroup {
  modifier_id:   string;
  group_name_ar: string;
  group_name_fr: string;
  required:      boolean;
  multi_select:  boolean;
  options:       ModifierOption[];
}

export interface SelectedModifier extends ModifierOption {}

interface Props {
  token:         string;
  productId:     string;
  productNameAr: string;
  basePrice:     number;
  onConfirm:     (modifiers: SelectedModifier[], finalPrice: number) => void;
  onClose:       () => void;
}

export function ModifierPicker({
  token, productId, productNameAr, basePrice, onConfirm, onClose,
}: Props) {
  const { t, lang } = useLanguage();
  const [groups,   setGroups]   = useState<ModifierGroup[]>([]);
  const [selected, setSelected] = useState<Map<string, SelectedModifier[]>>(new Map());
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch(`/api/modifiers?product_id=${productId}`, {
      headers: { authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setGroups)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, productId]);

  function toggleOption(group: ModifierGroup, opt: ModifierOption) {
    setSelected(prev => {
      const next = new Map(prev);
      const current = next.get(group.modifier_id) ?? [];
      if (group.multi_select) {
        const exists = current.some(o => o.label_ar === opt.label_ar);
        next.set(group.modifier_id, exists
          ? current.filter(o => o.label_ar !== opt.label_ar)
          : [...current, opt]);
      } else {
        const alreadySelected = current.length === 1 && current[0]!.label_ar === opt.label_ar;
        next.set(group.modifier_id, alreadySelected ? [] : [opt]);
      }
      return next;
    });
  }

  function isSelected(groupId: string, opt: ModifierOption): boolean {
    return (selected.get(groupId) ?? []).some(o => o.label_ar === opt.label_ar);
  }

  const allMods: SelectedModifier[] = Array.from(selected.values()).flat();
  const modTotal  = allMods.reduce((s, m) => s + m.price_delta, 0);
  const finalPrice = basePrice + modTotal;
  const requiredMet = groups.filter(g => g.required)
    .every(g => (selected.get(g.modifier_id) ?? []).length > 0);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1010,
    }}>
      <div style={{
        background: '#0F3D2A', borderRadius: '20px', padding: '1.5rem',
        width: '100%', maxWidth: '420px', maxHeight: '85vh', overflowY: 'auto',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', gap: '1rem',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ color: '#F0B429', fontWeight: 700, fontSize: '1rem', margin: 0 }}>
              {productNameAr}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', margin: 0 }}>
              {t.modifiers.selectAddons}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t.payment.close}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.5)', fontSize: '1.5rem', cursor: 'pointer',
            }}
          >×</button>
        </div>

        {loading && (
          <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontSize: '0.9rem' }}>
            {t.modifiers.loading}
          </p>
        )}

        {/* Modifier groups */}
        {groups.map(group => (
          <div key={group.modifier_id}>
            <p style={{
              color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem',
              fontWeight: 600, marginBottom: '0.5rem',
            }}>
              {pickName(lang, group.group_name_ar, group.group_name_fr)}
              {group.required && (
                <span style={{ color: '#EF4444', marginInlineEnd: '0.3rem', fontSize: '0.75rem' }}>*</span>
              )}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {group.options.map((opt, i) => {
                const sel = isSelected(group.modifier_id, opt);
                return (
                  <button key={i} onClick={() => toggleOption(group, opt)} style={{
                    padding: '0.45rem 0.85rem',
                    background: sel ? '#F0B429' : 'rgba(255,255,255,0.07)',
                    color: sel ? '#0A2318' : '#fff',
                    border: sel ? '1px solid #F0B429' : '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '999px', cursor: 'pointer',
                    fontSize: '0.82rem', fontWeight: sel ? 700 : 400,
                    transition: 'all 0.15s',
                  }}>
                    {pickName(lang, opt.label_ar, opt.label_fr)}
                    {opt.price_delta > 0 && (
                      <span style={{ marginInlineEnd: '0.3rem', opacity: 0.7, fontSize: '0.75rem' }}>
                        +{opt.price_delta}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Price + confirm */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: '1rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', margin: 0 }}>
              {t.modifiers.total}
            </p>
            <p style={{ color: '#F0B429', fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
              {finalPrice.toFixed(2)} {t.modifiers.currencySuffix}
            </p>
          </div>
          <button
            onClick={() => requiredMet && onConfirm(allMods, finalPrice)}
            disabled={!requiredMet}
            style={{
              padding: '0.75rem 1.5rem',
              background: requiredMet ? '#F0B429' : 'rgba(255,255,255,0.1)',
              color: requiredMet ? '#0A2318' : 'rgba(255,255,255,0.3)',
              fontWeight: 700, border: 'none', borderRadius: '12px',
              cursor: requiredMet ? 'pointer' : 'not-allowed', fontSize: '0.95rem',
            }}>
            {t.modifiers.addToOrder} {lang === 'ar' ? '←' : '→'}
          </button>
        </div>
      </div>
    </div>
  );
}
