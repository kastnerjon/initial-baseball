import type { JSX } from 'react';
import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: 'Initial Baseball',
  description: 'A daily baseball initials guessing game.',
  openGraph: {
    title: 'Initial Baseball',
    description: 'A daily baseball initials guessing game.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
