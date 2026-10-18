import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from '../context/LanguageContext';
import { ActivationGate } from '../components/ActivationGate';

export const metadata: Metadata = {
  title: 'GreenGo POS',
  description: 'GreenGo POS — Cashier Web Interface',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased font-cairo">
        <LanguageProvider>
          <ActivationGate>
            {children}
          </ActivationGate>
        </LanguageProvider>
      </body>
    </html>
  );
}
