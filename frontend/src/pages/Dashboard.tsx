import { useState } from 'react';
import { Header } from '../components/Header';
import { EmailTable } from '../components/EmailTable';
import { ComposeModal } from '../components/ComposeModal';
import { Tabs } from '../components/ui/Tabs';
import { Button } from '../components/ui/Button';
import { useEmails } from '../hooks/useEmails';

type Tab = 'scheduled' | 'sent';

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>('scheduled');
  const [query, setQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const scheduled = useEmails('scheduled', tab === 'scheduled' ? query : '');
  const sent = useEmails('sent', tab === 'sent' ? query : '');
  const active = tab === 'scheduled' ? scheduled : sent;

  const composeButton = <Button onClick={() => setComposeOpen(true)}>Compose new email</Button>;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by email, subject or body"
            aria-label="Search emails" className="w-full max-w-sm rounded-lg border border-line bg-white px-3 py-2 text-sm" />
          {composeButton}
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[
          { id: 'scheduled', label: 'Scheduled emails', count: scheduled.rows.length },
          { id: 'sent', label: 'Sent emails', count: sent.rows.length },
        ]} />
        <div className="mt-4 rounded-2xl border border-line bg-white">
          {tab === 'scheduled'
            ? <EmailTable {...active} timeLabel="Scheduled time" timeField="scheduledAt"
                empty={{ title: query ? 'No matches' : 'Nothing scheduled', text: query ? 'Try a different search.' : 'Compose an email and upload your leads to schedule it.', action: query ? undefined : composeButton }} />
            : <EmailTable {...active} timeLabel="Sent time" timeField="sentAt"
                empty={{ title: query ? 'No matches' : 'Nothing sent yet', text: query ? 'Try a different search.' : 'Emails appear here once they go out.' }} />}
        </div>
      </main>
      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} onScheduled={() => { scheduled.reload(); setTab('scheduled'); }} />
    </>
  );
}
