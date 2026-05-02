import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kishi Work Agent',
  description: 'Secure Slack + Gemini + Google Workspace work agent',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}