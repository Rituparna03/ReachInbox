import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EmailRow } from '../types';
import { formatDateTime } from '../lib/format';
import { Spinner } from './ui/Spinner';
import { EmptyState } from './ui/EmptyState';
import { StatusBadge } from './ui/StatusBadge';

interface Props {
  rows: EmailRow[]; loading: boolean; error: string | null;
  timeLabel: string; timeField: 'scheduledAt' | 'sentAt';
  empty: { title: string; text: string; action?: ReactNode };
}

/** One table for both tabs: only the time column and empty state differ. */
export function EmailTable({ rows, loading, error, timeLabel, timeField, empty }: Props) {
  const navigate = useNavigate();
  if (loading) return <div className="grid place-items-center py-20"><Spinner className="h-7 w-7" /></div>;
  if (error) return <EmptyState title="Couldn't load emails" text={error} />;
  if (!rows.length) return <EmptyState {...empty} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-muted">
          <tr>{['Email', 'Subject', timeLabel, 'Status'].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} onClick={() => navigate(`/email/${r.id}`)} className="cursor-pointer border-t border-line hover:bg-surface/60">
              <td className="px-4 py-3 font-medium">{r.toEmail}</td>
              <td className="max-w-xs truncate px-4 py-3">{r.subject}</td>
              <td className="whitespace-nowrap px-4 py-3">{formatDateTime(r[timeField])}</td>
              <td className="px-4 py-3">
                <StatusBadge status={r.status} />
                {r.previewUrl && (
                  <a href={r.previewUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                    className="ml-3 text-xs text-brand underline">preview</a>
                )}
                {r.status === 'failed' && r.error && <span className="ml-2 text-xs text-muted" title={r.error}>why?</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}