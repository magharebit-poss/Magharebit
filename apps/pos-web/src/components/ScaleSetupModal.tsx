'use client';

import { useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { SCALE_CATALOG, scaleById, type ScaleModel } from '../lib/scale-catalog';
import { scaleConnect, scaleReadWeight, type ScaleConfig } from '../lib/scale-terminal';

// ── Props ────────────────────────────────────────────────────────────────────

interface ScaleSetupModalProps {
  onConnected: (config: ScaleConfig) => void;
  onClose: () => void;
}

// ── Connection phase ─────────────────────────────────────────────────────────

type Phase = 'select' | 'connecting' | 'connected' | 'error';

const DEFAULT_TIMEOUT_MS = 2000;

// ── Component ────────────────────────────────────────────────────────────────

export default function ScaleSetupModal({ onConnected, onClose }: ScaleSetupModalProps) {
  const { t, dir } = useLanguage();
  const st = t.scale;

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [port, setPort] = useState('');
  const [phase, setPhase] = useState<Phase>('select');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testGrams, setTestGrams] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);

  const selected = selectedId ? scaleById(selectedId) : undefined;

  // Group the (optionally filtered) catalog by brand for the selector list.
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? SCALE_CATALOG.filter(
          (s) =>
            s.brand.toLowerCase().includes(q) ||
            s.model.toLowerCase().includes(q),
        )
      : SCALE_CATALOG;
    const byBrand = new Map<string, ScaleModel[]>();
    for (const s of filtered) {
      const list = byBrand.get(s.brand) ?? [];
      list.push(s);
      byBrand.set(s.brand, list);
    }
    return Array.from(byBrand.entries());
  }, [search]);

  const buildConfig = (model: ScaleModel): ScaleConfig => ({
    scaleId: model.id,
    port: port.trim(),
    baudRate: model.baudRate ?? 9600,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });

  const handleConnect = async () => {
    if (!selected || !port.trim()) return;
    setPhase('connecting');
    setErrorMsg(null);
    setTestGrams(null);
    const config = buildConfig(selected);
    try {
      const res = await scaleConnect(config);
      if (res.status === 'Connected') {
        setPhase('connected');
        onConnected(config);
      } else if (res.status === 'Error') {
        setPhase('error');
        setErrorMsg(res.message);
      } else {
        setPhase('error');
        setErrorMsg(st.notConnected);
      }
    } catch (e) {
      setPhase('error');
      setErrorMsg(e instanceof Error ? e.message : st.notConnected);
    }
  };

  const handleTestRead = async () => {
    if (!selected) return;
    setTesting(true);
    setTestGrams(null);
    try {
      const res = await scaleReadWeight(selected.id);
      if (res.status === 'Reading') {
        setTestGrams(res.grams);
      } else if (res.status === 'Unstable') {
        setErrorMsg(st.stabilize);
      } else if (res.status === 'Error') {
        setErrorMsg(res.message);
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : st.notConnected);
    } finally {
      setTesting(false);
    }
  };

  const statusBadge = (model: ScaleModel) => {
    if (model.driverStatus === 'available') {
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#2E8B57]">
          {st.driverAvailable}
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
        {st.driverStub}
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      dir={dir}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <p className="text-base font-bold text-[#1E293B]">⚖ {st.title}</p>
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#1E293B] text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex flex-col gap-4">
          {/* Scale selector */}
          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1.5">
              {st.selectScale}
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={st.selectScale}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E8B57]/30 focus:border-[#2E8B57] mb-2"
            />
            <div className="border border-[#E2E8F0] rounded-xl max-h-56 overflow-y-auto divide-y divide-[#F1F5F9]">
              {grouped.map(([brand, models]) => (
                <div key={brand}>
                  <p className="px-3 py-1.5 text-[11px] font-bold text-[#94A3B8] bg-[#F8FAFC] sticky top-0">
                    {brand}
                  </p>
                  {models.map((m) => {
                    const disabled = m.driverStatus !== 'available';
                    const active = selectedId === m.id;
                    return (
                      <button
                        key={m.id}
                        disabled={disabled}
                        onClick={() => {
                          setSelectedId(m.id);
                          setPhase('select');
                          setErrorMsg(null);
                          setTestGrams(null);
                        }}
                        className={`w-full text-start px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                          disabled
                            ? 'opacity-50 cursor-not-allowed'
                            : active
                              ? 'bg-[#F0FDF4]'
                              : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <span className="flex flex-col">
                          <span className="text-sm font-medium text-[#1E293B]">{m.model}</span>
                          <span className="text-[11px] text-[#94A3B8]">
                            {m.category} · {m.maxWeightKg}kg
                          </span>
                        </span>
                        {statusBadge(m)}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Port input — shown after a scale is selected */}
          {selected && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                  {st.port}
                </label>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="COM3"
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2E8B57]/30 focus:border-[#2E8B57]"
                />
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  Windows: COM1-COM9 · Linux: /dev/ttyUSB*
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                  {st.baudRate}
                </label>
                <input
                  type="text"
                  value={String(selected.baudRate ?? 9600)}
                  readOnly
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-sm font-mono bg-[#F8FAFC] text-[#64748B]"
                />
              </div>

              {/* Connect button */}
              <button
                onClick={handleConnect}
                disabled={!port.trim() || phase === 'connecting'}
                className="w-full py-2.5 rounded-xl bg-[#2E8B57] text-white text-sm font-semibold hover:bg-[#267349] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {phase === 'connecting' ? st.connecting : `▶ ${st.connect}`}
              </button>

              {/* Connected state */}
              {phase === 'connected' && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-[#2E8B57] text-center">
                    ✓ {st.connected}
                  </p>
                  <button
                    onClick={handleTestRead}
                    disabled={testing}
                    className="w-full py-2 rounded-xl border border-[#2E8B57] text-[#2E8B57] text-sm font-medium hover:bg-[#F0FDF4] transition-colors disabled:opacity-50"
                  >
                    ⚖ {st.testRead}
                  </button>
                  {testGrams != null && (
                    <p className="text-center text-lg font-bold text-[#1E293B]">
                      {st.weightResult.replace('{n}', String(testGrams))}
                    </p>
                  )}
                </div>
              )}

              {/* Error */}
              {phase === 'error' && errorMsg && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {errorMsg}
                </p>
              )}
              {phase !== 'error' && errorMsg && (
                <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  {errorMsg}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
