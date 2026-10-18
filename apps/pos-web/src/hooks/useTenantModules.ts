'use client';

import { useEffect, useState } from 'react';
import { getModules, type ModuleConfig, type BusinessType } from '../lib/modules';
import { TOKEN_KEY } from '../lib/api';

const FALLBACK: ModuleConfig = getModules('grocery');
const CACHE_KEY = 'mgh_tenant_config';
const TENANT_ID = process.env['NEXT_PUBLIC_TENANT_ID'] ?? '';

interface CacheEntry {
  tenantId: string;
  businessType: BusinessType;
  featureFlags: Partial<ModuleConfig>;
}

function readCache(): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (parsed.tenantId !== TENANT_ID) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function useTenantModules(): { modules: ModuleConfig; loading: boolean } {
  const [modules, setModules] = useState<ModuleConfig>(FALLBACK);
  const [loading, setLoading] = useState(true);

  // Keep the previous object when nothing changed so the page does not re-render.
  const applyModules = (next: ModuleConfig) =>
    setModules((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));

  useEffect(() => {
    // Apply cache synchronously — eliminates FOUC on remount for non-grocery tenants
    const cached = readCache();
    if (cached) {
      applyModules(getModules(cached.businessType, cached.featureFlags));
      setLoading(false);
    }

    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    fetch('/api/tenant/config', {
      headers: { authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as {
          businessType: BusinessType;
          featureFlags: Partial<ModuleConfig>;
        };
        applyModules(getModules(data.businessType, data.featureFlags));
        try {
          sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              tenantId: TENANT_ID,
              businessType: data.businessType,
              featureFlags: data.featureFlags,
            } satisfies CacheEntry),
          );
        } catch { /* storage quota — ignore */ }
      })
      .catch(() => { /* keep cached or fallback */ })
      .finally(() => setLoading(false));
  }, []);

  return { modules, loading };
}
