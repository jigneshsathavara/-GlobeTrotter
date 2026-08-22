import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'GlobeTrotter — Personalized travel planning',
  description: 'Design multi-city trips, organize every day, and keep your travel budget beautifully under control.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'GlobeTrotter — Personalized travel planning',
    description: 'Plan every stop. Remember every moment.',
    images: [{ url: '/og.png', width: 1680, height: 945, alt: 'GlobeTrotter travel planning' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GlobeTrotter — Personalized travel planning',
    description: 'Plan every stop. Remember every moment.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
