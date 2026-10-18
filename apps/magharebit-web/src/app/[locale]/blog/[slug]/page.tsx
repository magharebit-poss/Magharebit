import { getTranslations } from 'next-intl/server';
import { promises as fs } from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

interface Post {
  slug: string;
  title: Record<string, string>;
  excerpt: Record<string, string>;
  content: Record<string, string>;
  date: string;
  publishedAt?: string;
  readTime: number;
  category: string;
  emoji?: string;
  coverGradient?: string;
}

async function getPost(slug: string): Promise<Post | null> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'posts', `${slug}.json`);
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text) as Post;
  } catch {
    return null;
  }
}

async function getAllPosts(): Promise<Post[]> {
  try {
    const dir = path.join(process.cwd(), 'data', 'posts');
    const files = await fs.readdir(dir);
    const posts = await Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map(async (f) => {
          try {
            const text = await fs.readFile(path.join(dir, f), 'utf8');
            const p = JSON.parse(text) as Post;
            if (!p.slug) p.slug = f.replace('.json', '');
            return p;
          } catch {
            return null;
          }
        })
    );
    return posts.filter((p): p is Post => p !== null);
  } catch {
    return [];
  }
}

/** Parse plain-text content: split on double newline, ## lines become <h2>. */
function parseContent(raw: string): { type: 'h2' | 'p'; text: string }[] {
  return raw
    .split('\n\n')
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith('## ')) {
        return { type: 'h2' as const, text: block.slice(3).trim() };
      }
      return { type: 'p' as const, text: block };
    });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: 'Not found' };
  return {
    title: `${post.title[locale] ?? post.title['fr']} | MAGHAREBIT Blog`,
    description: post.excerpt[locale] ?? post.excerpt['fr'],
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const post = await getPost(slug);

  if (!post) notFound();

  const [t, allPosts] = await Promise.all([
    getTranslations({ locale, namespace: 'blog' }),
    getAllPosts(),
  ]);
  const relatedPosts = allPosts
    .filter((p) => p.slug !== slug)
    .slice(0, 2);
  const isRTL = locale === 'ar';
  const fontFamily = isRTL
    ? 'Noto Naskh Arabic, Cairo, serif'
    : 'Plus Jakarta Sans, Inter, sans-serif';

  const rawContent = post.content[locale] ?? post.content['fr'] ?? '';
  const blocks = parseContent(rawContent);

  const displayDate = post.publishedAt ?? post.date;
  const gradient = post.coverGradient ?? 'linear-gradient(135deg, #0F3D2A, #1A6B45)';
  const emoji = post.emoji ?? '📄';

  return (
    <main style={{ minHeight: '100vh', background: '#0A2318' }}>

      {/* Cover hero */}
      <div
        style={{
          height: '260px',
          background: gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <span style={{ fontSize: '80px', lineHeight: 1 }}>{emoji}</span>
        {/* back link overlay */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            ...(isRTL ? { right: '24px' } : { left: '24px' }),
          }}
        >
          <Link
            href={`/${locale}/blog`}
            style={{
              color: 'rgba(255,255,255,0.80)',
              textDecoration: 'none',
              fontSize: '14px',
              fontFamily,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(0,0,0,0.25)',
              padding: '6px 14px',
              borderRadius: '999px',
            }}
          >
            {t('back')}
          </Link>
        </div>
      </div>

      {/* Article */}
      <article
        style={{
          maxWidth: '760px',
          margin: '0 auto',
          padding: '48px 24px 24px',
          direction: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {/* Category badge */}
        <div style={{ marginBottom: '16px' }}>
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
        <h1
          style={{
            fontSize: 'clamp(1.6rem, 4vw, 2.5rem)',
            fontWeight: 800,
            color: '#FFFFFF',
            lineHeight: 1.3,
            margin: '0 0 20px',
            fontFamily,
          }}
        >
          {post.title[locale] ?? post.title['fr']}
        </h1>

        {/* Meta */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.45)',
            marginBottom: '40px',
            fontFamily: 'Inter, sans-serif',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: '20px',
            flexWrap: 'wrap',
          }}
        >
          <span>{displayDate}</span>
          <span aria-hidden="true">·</span>
          <span>
            ⏱ {post.readTime} {t('min_read')}
          </span>
        </div>

        {/* Parsed content */}
        <div>
          {blocks.map((block, i) => {
            if (block.type === 'h2') {
              return (
                <h2
                  key={i}
                  style={{
                    color: '#F0B429',
                    fontSize: '22px',
                    fontWeight: 700,
                    margin: '36px 0 14px',
                    fontFamily,
                    lineHeight: 1.4,
                  }}
                >
                  {block.text}
                </h2>
              );
            }
            return (
              <p
                key={i}
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: '16px',
                  lineHeight: 1.85,
                  margin: '0 0 18px',
                  fontFamily,
                }}
              >
                {block.text}
              </p>
            );
          })}
        </div>
      </article>

      {/* Related posts */}
      {relatedPosts.length > 0 && (
        <div
          style={{
            maxWidth: '760px',
            margin: '0 auto',
            padding: '0 24px 48px',
            direction: isRTL ? 'rtl' : 'ltr',
          }}
        >
          <h3
            style={{
              color: 'rgba(255,255,255,0.50)',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: '20px',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {locale === 'ar' ? 'مقالات ذات صلة' : locale === 'fr' ? 'Articles connexes' : 'Related articles'}
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            {relatedPosts.map((rp) => {
              const rGradient = rp.coverGradient ?? 'linear-gradient(135deg, #0F3D2A, #1A6B45)';
              const rEmoji = rp.emoji ?? '📄';
              const rTitle = rp.title[locale] ?? rp.title['fr'] ?? '';
              const rExcerpt = rp.excerpt[locale] ?? rp.excerpt['fr'] ?? '';
              return (
                <Link
                  key={rp.slug}
                  href={`/${locale}/blog/${rp.slug}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      transition: 'border-color 0.2s ease',
                    }}
                  >
                    {/* Mini cover */}
                    <div
                      style={{
                        height: '90px',
                        background: rGradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '36px',
                      }}
                    >
                      {rEmoji}
                    </div>
                    {/* Content */}
                    <div style={{ padding: '16px' }}>
                      <p
                        style={{
                          color: '#FFFFFF',
                          fontSize: '15px',
                          fontWeight: 700,
                          margin: '0 0 6px',
                          fontFamily,
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {rTitle}
                      </p>
                      <p
                        style={{
                          color: 'rgba(255,255,255,0.45)',
                          fontSize: '13px',
                          margin: 0,
                          fontFamily,
                          lineHeight: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {rExcerpt}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Share buttons */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 24px 32px', direction: isRTL ? 'rtl' : 'ltr' }}>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily, fontSize: '13px', color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
            {locale === 'ar' ? 'شارك هذا المقال' : locale === 'fr' ? 'Partager cet article' : 'Share this article'}:
          </span>
          {(() => {
            const postUrl = `https://magharebit.com/${locale}/blog/${slug}`;
            const title = post.title[locale] ?? post.title['fr'] ?? '';
            const shareLinks: Array<{ key: string; href: string; bg: string; label: string; paths: React.ReactNode }> = [
              {
                key: 'facebook',
                href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`,
                bg: '#1877F2',
                label: 'Facebook',
                paths: <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />,
              },
              {
                key: 'linkedin',
                href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`,
                bg: '#0A66C2',
                label: 'LinkedIn',
                paths: <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />,
              },
              {
                key: 'x',
                href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(title)}`,
                bg: '#000',
                label: 'X',
                paths: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />,
              },
            ];
            return shareLinks.map((s) => (
              <a
                key={s.key}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${s.label} share`}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.80)',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = s.bg; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = s.bg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.80)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
                  {s.paths}
                </svg>
              </a>
            ));
          })()}
        </div>
      </div>

      {/* Bottom CTA card */}
      <div
        style={{
          maxWidth: '760px',
          margin: '0 auto',
          padding: '0 24px 80px',
          direction: isRTL ? 'rtl' : 'ltr',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #0F3D2A 0%, #1A5C3A 100%)',
            border: '1px solid rgba(240,180,41,0.25)',
            borderRadius: '20px',
            padding: '40px 36px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🚀</div>
          <h3
            style={{
              color: '#FFFFFF',
              fontSize: '22px',
              fontWeight: 800,
              margin: '0 0 10px',
              fontFamily,
            }}
          >
            {t('cta_title')}
          </h3>
          <p
            style={{
              color: 'rgba(255,255,255,0.60)',
              fontSize: '15px',
              margin: '0 0 28px',
              fontFamily,
            }}
          >
            {t('cta_sub')}
          </p>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Link
              href={`/${locale}/demo`}
              style={{
                background: '#F0B429',
                color: '#0A2318',
                fontWeight: 700,
                fontSize: '15px',
                padding: '12px 28px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontFamily,
                display: 'inline-block',
              }}
            >
              {t('cta_btn')}
            </Link>
            <a
              href="https://wa.me/212619522487"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'transparent',
                color: 'rgba(255,255,255,0.80)',
                fontWeight: 600,
                fontSize: '15px',
                padding: '12px 28px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontFamily,
                display: 'inline-block',
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            >
              💬 {t('cta_wa')}
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
