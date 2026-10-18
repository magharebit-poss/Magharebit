'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { pickName } from '../../lib/names';

interface ForecastItem {
  forecastId:   string;
  productId:    string;
  storeId:      string | null;
  forecastDate: string;
  qtyPredicted: number;
  qtyLower:     number;
  qtyUpper:     number;
  reorderPoint: number;
  modelVersion: string;
}

interface ReorderAlert {
  productId:    string;
  storeId:      string | null;
  nameAr:       string;
  nameFr:       string;
  onHand:       number;
  reorderPoint: number;
  qtyPredicted: number;
  forecastDate: string;
  deficit:      number;
}

interface ForecastWidgetProps {
  token: string;
}

export function ForecastWidget({ token }: ForecastWidgetProps) {
  const { t: dict, lang } = useLanguage();
  const t = dict.forecast;

  const [forecasts, setForecasts]         = useState<ForecastItem[]>([]);
  const [reorderAlerts, setReorderAlerts] = useState<ReorderAlert[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const headers = { Authorization: `Bearer ${token}` };

        const [fcRes, roRes] = await Promise.all([
          fetch('/api/analytics/forecasts?days=7', { headers }),
          fetch('/api/analytics/reorder-alerts',   { headers }),
        ]);

        if (fcRes.ok) {
          const fcData = await fcRes.json() as { forecasts: ForecastItem[] };
          setForecasts(fcData.forecasts ?? []);
        }
        if (roRes.ok) {
          const roData = await roRes.json() as { alerts: ReorderAlert[] };
          setReorderAlerts(roData.alerts ?? []);
        }
      } catch {
        setError('fetch_failed');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [token]);

  // Aggregate total predicted units per date for sparkline preview
  const byDate = forecasts.reduce<Record<string, number>>((acc, f) => {
    acc[f.forecastDate] = (acc[f.forecastDate] ?? 0) + f.qtyPredicted;
    return acc;
  }, {});

  const sortedDates = Object.keys(byDate).sort();

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-[#E0E0E0] shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-[#E2E8F0] rounded w-40" />
          <div className="h-24 bg-[#E2E8F0] rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-[#E0E0E0] shadow-sm text-[#757575] text-sm">
        {t.noForecasts}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 7-day demand preview */}
      <div className="bg-white rounded-2xl p-6 border border-[#E0E0E0] shadow-sm">
        <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4 font-cairo">
          {t.title}
        </h3>

        {sortedDates.length === 0 ? (
          <p className="text-sm text-[#757575]">{t.noForecasts}</p>
        ) : (
          <div className="flex items-end gap-1 h-20">
            {sortedDates.map((date) => {
              const qty    = byDate[date] ?? 0;
              const maxQty = Math.max(...Object.values(byDate));
              const pct    = maxQty > 0 ? (qty / maxQty) * 100 : 0;
              const label  = new Date(date).toLocaleDateString(
                lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-MA' : 'en-GB',
                { weekday: 'short' },
              );
              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-[#2E8B57] rounded-t"
                    style={{ height: `${Math.max(4, pct)}%` }}
                    title={`${qty.toFixed(1)} ${t.units}`}
                  />
                  <span className="text-[10px] text-[#757575]">{label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reorder alerts */}
      <div className="bg-white rounded-2xl p-6 border border-[#E0E0E0] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#1A1A1A] font-cairo">
            {t.reorderTitle}
          </h3>
          {reorderAlerts.length > 0 && (
            <span
              className="text-xs font-semibold bg-[#D32F2F] text-white rounded-full px-2 py-0.5"
            >
              {reorderAlerts.length}
            </span>
          )}
        </div>

        {reorderAlerts.length === 0 ? (
          <p className="text-sm text-[#757575]">{t.noAlerts}</p>
        ) : (
          <div className="space-y-2">
            {reorderAlerts.slice(0, 8).map((a) => {
              const name = pickName(lang, a.nameAr, a.nameFr);
              return (
                <div
                  key={`${a.productId}:${a.storeId ?? 'null'}`}
                  className="flex items-center justify-between gap-2 py-2 border-b border-[#F5F5F5] last:border-0"
                >
                  <span className="text-sm text-[#1A1A1A] truncate flex-1">{name}</span>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-[#757575]">
                    <span>{t.onHand}: <strong className="text-[#1A1A1A]">{a.onHand.toFixed(1)}</strong></span>
                    <span>{t.predicted}: <strong className="text-[#2E8B57]">{a.qtyPredicted.toFixed(1)}</strong></span>
                    <span className="text-[#D32F2F] font-semibold">-{a.deficit.toFixed(1)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
