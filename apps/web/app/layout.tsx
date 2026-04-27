import type { JSX } from 'react';
import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: 'Daily Inning by Initial Baseball',
  description: 'A daily baseball guessing game. Score an inning and compare how the field did.',
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
