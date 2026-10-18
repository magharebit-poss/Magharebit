'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface Post {
  slug: string;
  title: Record<string, string>;
  excerpt: Record<string, string>;
  date: string;
  publishedAt?: string;
  readTime: number;
  category: string;
  emoji?: string;
  coverGradient?: string;
}

interface Props {
  posts: Post[];
  locale: string;
}

const CATEGORY_FILTERS = ['الكل', 'دليل', 'نصائح', 'أخبار'];

export default function BlogContent({ posts, locale }: Props) {
  const t = useTranslations('blog');
  const isRTL = locale === 'ar';
  const fontFamily = isRTL
    ? 'Noto Naskh Arabic, Cairo, serif'
    : 'Plus Jakarta Sans, Inter, sans-serif';

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('الكل');

  const filtered = posts.filter((p) => {
    const title = (p.title[locale] ?? p.title['fr'] ?? '').toLowerCase();
    const excerpt = (p.excerpt[locale] ?? p.excerpt['fr'] ?? '').toLowerCase();
    const q = search.trim().toLowerCase();
    const matchSearch = q === '' || title.includes(q) || excerpt.includes(q);
    const matchCat = activeCategory === 'الكل' || p.category === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <section
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '40px 24px 80px',
        direction: isRTL ? 'rtl' : 'ltr',
      }}
    >
      {/* Search + Category filters */}
      <div style={{ marginBottom: '36px' }}>
        {/* Search input */}
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <span
            style={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              ...(isRTL ? { right: '14px' } : { left: '14px' }),
              fontSize: '16px',
              pointerEvents: 'none',
            }}
          >
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={locale === 'ar' ? 'ابحث في المقالات...' : locale === 'fr' ? 'Rechercher des articles...' : 'Search articles...'}
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: isRTL ? '11px 44px 11px 16px' : '11px 16px 11px 44px',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              fontSize: '14px',
              fontFamily,
              color: '#FFFFFF',
              background: 'rgba(255,255,255,0.07)',
              outline: 'none',
              direction: isRTL ? 'rtl' : 'ltr',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {CATEGORY_FILTERS.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  background: isActive ? '#F0B429' : 'rgba(255,255,255,0.07)',
                  color: isActive ? '#0A2318' : 'rgba(255,255,255,0.70)',
                  border: isActive ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '999px',
                  padding: '6px 18px',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily,
                  transition: 'all 0.2s ease',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results count */}
      {search.trim() && (
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: '20px', fontFamily }}>
          {filtered.length} نتيجة لـ &quot;{search}&quot;
        </p>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <p style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '15px', fontFamily }}>
            {t('not_found')}
          </p>
          {(search.trim() || activeCategory !== 'الكل') && (
            <button
              onClick={() => { setSearch(''); setActiveCategory('الكل'); }}
              style={{
                marginTop: '16px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                padding: '8px 20px',
                fontSize: '13px',
                color: 'rgba(255,255,255,0.70)',
                cursor: 'pointer',
                fontFamily,
              }}
            >
              {locale === 'ar' ? 'مسح الفلاتر' : locale === 'fr' ? 'Effacer les filtres' : 'Clear filters'}
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '28px',
          }}
        >
          {filtered.map((post) => {
            const gradient = post.coverGradient ?? 'linear-gradient(135deg, #0F3D2A, #1A6B45)';
            const emoji = post.emoji ?? '📄';

            return (
              <Link
                key={post.slug}
                href={`/${locale}/blog/${post.slug}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <article
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  className="card-feature-hover"
                >
                  {/* Cover */}
                  <div
                    style={{
                      height: '160px',
                      background: gradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: '64px', lineHeight: 1 }}>{emoji}</span>
                  </div>

                  <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Category badge */}
                    <div style={{ marginBottom: '12px' }}>
                      <span
                        style={{
                          background: 'rgba(240,180,41,0.12)',
                          color: '#F0B429',
                          fontSize: '11px',
                          fontWeight: 700,
                          borderRadius: '999px',
                          padding: '3px 10px',
                          fontFamily: 'Inter, sans-serif',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          border: '1px solid rgba(240,180,41,0.25)',
                        }}
                      >
                        {post.category}
                      </span>
                    </div>

                    {/* Title */}
                    <h2
                      style={{
                        fontSize: '17px',
                        fontWeight: 700,
                        margin: '0 0 10px',
                        color: '#FFFFFF',
                        lineHeight: 1.4,
                        fontFamily,
                        flex: 0,
                      }}
                    >
                      {post.title[locale] ?? post.title['fr']}
                    </h2>

                    {/* Excerpt */}
                    <p
                      style={{
                        fontSize: '14px',
                        color: 'rgba(255,255,255,0.60)',
                        lineHeight: 1.7,
                        margin: '0 0 20px',
                        fontFamily,
                        flex: 1,
                      }}
                    >
                      {post.excerpt[locale] ?? post.excerpt['fr']}
                    </p>

                    {/* Footer */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '16px',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)', fontFamily: 'Inter, sans-serif' }}>
                        ⏱ {post.readTime} {t('min_read')}
                      </span>
                      <span style={{ color: '#F0B429', fontSize: '13px', fontWeight: 700, fontFamily }}>
                        {t('read_more')}
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
