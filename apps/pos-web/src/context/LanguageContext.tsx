'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { TRANSLATIONS, getDir, getFontClass, type Lang, type Translations } from '../lib/i18n';

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
  dir: 'rtl' | 'ltr';
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = 'greengo_lang';
const DEFAULT_LANG: Lang = 'ar';

function isValidLang(value: string | null): value is Lang {
  return value === 'ar' || value === 'fr' || value === 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted language on first mount (client-only)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isValidLang(stored)) {
      setLangState(stored);
    }
    setHydrated(true);
  }, []);

  // Reflect language to <html> attributes + body class on every change
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.lang = lang;
    root.dir = getDir(lang);

    const body = document.body;
    body.classList.remove('font-cairo', 'font-inter');
    body.classList.add(getFontClass(lang));
  }, [lang]);

  const setLang = (l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  };

  const value: LanguageContextValue = {
    lang,
    setLang,
    t: TRANSLATIONS[lang],
    dir: getDir(lang),
  };

  // Avoid hydration mismatch — render with default until localStorage is read
  if (!hydrated) {
    return (
      <LanguageContext.Provider value={{ ...value, lang: DEFAULT_LANG, t: TRANSLATIONS[DEFAULT_LANG], dir: getDir(DEFAULT_LANG) }}>
        {children}
      </LanguageContext.Provider>
    );
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}
