import type { JSX } from 'react';
import type { Metadata } from 'next';
import { ResultsView } from './ResultsView';
import './results.css';

export const metadata: Metadata = {
  title: 'My Results · Initial Baseball',
  robots: { index: false, follow: false },
};

export default function MyResultsPage(): JSX.Element {
  return <main className="page-shell"><section className="daily-card">
    <p className="eyebrow">Initial Baseball</p>
    <h1>My Results</h1>
    <p>Daily, Archive, and Classic results saved in this browser. Some older games may not be available.</p>
    <p>Clearing site data removes these results. Games played on other devices won’t appear here.</p>
    <p><a href="/">Back to today’s Daily</a> · <a href="/archive">Play the archive</a></p>
    <ResultsView />
  </section></main>;
}
