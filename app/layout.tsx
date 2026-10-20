import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fitting Room — AI garment photoshoots',
  description: 'Upload a garment. Describe the shoot. Get a hyperrealistic model photo.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body bg-ink text-canvas antialiased">{children}</body>
    </html>
  );
}
