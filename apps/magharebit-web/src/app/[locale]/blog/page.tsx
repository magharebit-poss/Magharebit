import { setRequestLocale, getTranslations } from 'next-intl/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import BlogContent from '@/components/blog/BlogContent';
import { pageAlternates, ogBase } from '@/lib/seo';

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  setRequestLocale((await params).locale);
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'blog' });
  return {
    title: t('meta_title'),
    description: t('meta_desc'),
    alternates: pageAlternates(locale, '/blog'),
    openGraph: { ...ogBase(locale), title: t('meta_title'), description: t('meta_desc') },
  };
}

async function getPosts(): Promise<Post[]> {
  const postsDir = path.join(process.cwd(), 'data', 'posts');
  try {
    const files = await fs.readdir(postsDir);
    const posts = await Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map(async (f) => {
          const text = await fs.readFile(path.join(postsDir, f), 'utf8');
          return JSON.parse(text) as Post;
        })
    );
    return posts.sort((a, b) => {
      const da = new Date(a.publishedAt ?? a.date).getTime();
      const db = new Date(b.publishedAt ?? b.date).getTime();
      return db - da;
    });
  } catch {
    return [];
  }
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  setRequestLocale((await params).locale);
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'blog' });
  const posts = await getPosts();
  const isRTL = locale === 'ar';
  const fontFamily = isRTL
    ? 'Noto Naskh Arabic, Cairo, serif'
    : 'Plus Jakarta Sans, Inter, sans-serif';

  return (
    <main style={{ minHeight: '100vh', background: '#0A2318' }}>

      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, #071A10 0%, #0F3D2A 100%)',
          padding: '100px 24px 80px',
          textAlign: 'center',
          direction: isRTL ? 'rtl' : 'ltr',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            background: 'rgba(240,180,41,0.15)',
            color: '#F0B429',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            borderRadius: '999px',
            padding: '6px 16px',
            marginBottom: '20px',
            fontFamily: 'Inter, sans-serif',
            border: '1px solid rgba(240,180,41,0.3)',
          }}
        >
          {t('badge')}
        </span>
        <h1
          style={{
            color: '#FFFFFF',
            fontSize: 'clamp(1.8rem, 5vw, 3rem)',
            fontWeight: 800,
            margin: '0 0 16px',
            fontFamily,
            lineHeight: 1.2,
          }}
        >
          {t('heading')}
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.60)',
            fontSize: '1.1rem',
            maxWidth: '520px',
            margin: '0 auto',
            fontFamily,
            lineHeight: 1.7,
          }}
        >
          {t('sub')}
        </p>
      </section>

      {/* Posts grid with search/filter — client component */}
      <BlogContent posts={posts} locale={locale} />
    </main>
  );
}
