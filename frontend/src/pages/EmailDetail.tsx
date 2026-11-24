import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from '../components/ui/Spinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import type { EmailDetail } from '../types';

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Plain text keeps its line breaks; HTML is shown as-is inside a sandboxed iframe (no scripts run). */
const toSrcDoc = (body: string) => {
  const content = /<[a-z][\s\S]*>/i.test(body) ? body : `<div style="white-space:pre-wrap">${escapeHtml(body)}</div>`;
  return `<body style="margin:0;font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#14201a">${content}</body>`;
};

export default function EmailDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) api.email(id).then(setEmail).catch(e => setError((e as Error).message));
  }, [id]);

  const when = email && new Date(email.sentAt ?? email.scheduledAt)
    .toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} aria-label="Back" className="rounded p-1 text-2xl leading-none hover:bg-surface">←</button>
          <h1 className="text-xl font-medium">{email?.subject ?? 'Email'}</h1>
        </div>
        {user?.avatarUrl && <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full" />}
      </header>

      {error && <p className="p-10 text-center text-muted">{error}</p>}
      {!error && !email && <div className="grid place-items-center py-24"><Spinner className="h-7 w-7" /></div>}

      {email && (
        <article className="mx-auto max-w-3xl px-6 py-8">
          <div className="flex items-start gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#00a844] font-semibold text-white">
              {email.fromEmail[0].toUpperCase()}
            </span>
            <div className="flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">Sender <span className="font-normal text-muted">&lt;{email.fromEmail}&gt;</span></p>
                <p className="text-xs text-muted">{when}</p>
              </div>
              <p className="text-xs text-muted">to {email.toEmail}</p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <StatusBadge status={email.status} />
            {email.previewUrl && <a href={email.previewUrl} target="_blank" rel="noreferrer" className="text-sm text-brand underline">Open Ethereal preview</a>}
            {email.status === 'failed' && email.error && <span className="text-sm text-red-600">{email.error}</span>}
          </div>

          <iframe title="Email body" sandbox="" srcDoc={toSrcDoc(email.body)} className="mt-6 h-96 w-full rounded-lg border border-line" />
        </article>
      )}
    </div>
  );
}