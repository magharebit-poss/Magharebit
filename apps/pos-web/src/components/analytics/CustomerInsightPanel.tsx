'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface CustomerSegment {
  segmentId:            string;
  customerId:           string;
  segment:              string;
  riskScore:            number;
  rfmTotal:             number;
  creditUtilization:    number | null;
  nameAr:               string | null;
  phone:                string | null;
  balance:              number;
  creditLimit:          number;
  daysSinceLastPurchase: number | null;
  purchaseCount:        number;
  totalSpentMad:        number;
}

interface CustomerSuggestion {
  suggestionId:   string;
  customerId:     string;
  suggestionType: string;
  priority:       number;
  details:        { message_ar?: string };
  nameAr:         string | null;
}

interface CustomerInsightPanelProps {
  token: string;
}

function utilizationColor(u: number): string {
  if (u >= 0.75) return '#D32F2F';
  if (u >= 0.50) return '#FF9800';
  return '#2E8B57';
}

export function CustomerInsightPanel({ token }: CustomerInsightPanelProps) {
  const { t: dict } = useLanguage();
  const t   = dict.insights;
  const cur = dict.analytics.currency;

  const [tab, setTab]                         = useState<'risk' | 'suggestions'>('risk');
  const [segments, setSegments]               = useState<CustomerSegment[]>([]);
  const [suggestions, setSuggestions]         = useState<CustomerSuggestion[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [actingId, setActingId]               = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [segRes, sugRes] = await Promise.all([
        fetch('/api/analytics/customer-segments?min_risk=51', { headers }),
        fetch('/api/analytics/customer-suggestions', { headers }),
      ]);
      if (segRes.ok) {
        const d = await segRes.json() as { segments: CustomerSegment[] };
        setSegments(d.segments ?? []);
      }
      if (sugRes.ok) {
        const d = await sugRes.json() as { suggestions: CustomerSuggestion[] };
        setSuggestions(d.suggestions ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function act(suggestionId: string) {
    setActingId(suggestionId);
    try {
      await fetch(`/api/analytics/customer-suggestions/${suggestionId}/act`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuggestions((prev) => prev.filter((s) => s.suggestionId !== suggestionId));
    } finally {
      setActingId(null);
    }
  }

  const sugLabels = t.suggestionTypes as Record<string, string>;

  return (
    <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-[#E0E0E0]">
        <button
          onClick={() => setTab('risk')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            tab === 'risk'
              ? 'text-[#D32F2F] border-b-2 border-[#D32F2F]'
              : 'text-[#757575] hover:text-[#1A1A1A]'
          }`}
        >
          {t.tabRisk}
          {segments.length > 0 && (
            <span className="ms-2 text-xs bg-[#D32F2F] text-white rounded-full px-1.5 py-0.5">
              {segments.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('suggestions')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            tab === 'suggestions'
              ? 'text-[#2E8B57] border-b-2 border-[#2E8B57]'
              : 'text-[#757575] hover:text-[#1A1A1A]'
          }`}
        >
          {t.tabSuggestions}
          {suggestions.length > 0 && (
            <span className="ms-2 text-xs bg-[#FF9800] text-white rounded-full px-1.5 py-0.5">
              {suggestions.length}
            </span>
          )}
        </button>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-[#E2E8F0] rounded h-12" />
            ))}
          </div>
        ) : tab === 'risk' ? (
          segments.length === 0 ? (
            <p className="text-sm text-[#757575] py-4 text-center">
              {t.noRisk}
            </p>
          ) : (
            <div className="space-y-3">
              {segments.map((s) => {
                const util = s.creditUtilization ?? 0;
                const color = utilizationColor(util);
                return (
                  <div
                    key={s.segmentId}
                    className="flex flex-col gap-1.5 py-2 border-b border-[#F5F5F5] last:border-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[#1A1A1A]">
                        {s.nameAr ?? s.phone ?? s.customerId.slice(0, 8)}
                      </span>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: color }}
                      >
                        {s.riskScore}
                      </span>
                    </div>
                    {/* Utilization bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[#F5F5F5] rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, util * 100).toFixed(1)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                      <span className="text-xs text-[#757575] shrink-0">
                        {s.balance.toFixed(0)} / {s.creditLimit.toFixed(0)} {cur}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          suggestions.length === 0 ? (
            <p className="text-sm text-[#757575] py-4 text-center">
              {t.noSuggestions}
            </p>
          ) : (
            <div className="space-y-2">
              {suggestions.map((s) => (
                <div
                  key={s.suggestionId}
                  className="flex items-center justify-between gap-2 py-2 border-b border-[#F5F5F5] last:border-0"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium text-[#1A1A1A] truncate">
                      {s.nameAr ?? s.customerId.slice(0, 8)}
                    </span>
                    <span className="text-xs text-[#757575]">
                      {sugLabels[s.suggestionType] ?? s.suggestionType}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-white bg-[#FF9800] rounded-full px-2 py-0.5">
                      {s.priority}
                    </span>
                    <button
                      onClick={() => act(s.suggestionId)}
                      disabled={actingId === s.suggestionId}
                      className="text-xs bg-[#2E8B57] text-white rounded px-2 py-1 disabled:opacity-50"
                    >
                      {actingId === s.suggestionId ? '…' : t.done}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
