import { useEffect, useState } from 'react';
import { API_URL, api } from '../lib/api';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import type { SlackStatus } from '../types';

export function SlackControl() {
  const toast = useToast();
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const refresh = () => api.slackStatus().then(setStatus).catch(() => setStatus({ connected: false }));

  useEffect(() => {
    refresh();
    const flag = new URLSearchParams(location.search).get('slack');
    if (flag) {
      flag === 'connected' ? toast('success', 'Slack connected') : toast('error', 'Slack connection failed');
      history.replaceState(null, '', location.pathname);
    }
  }, []);

  if (!status) return null;
  if (!status.connected)
    return <a href={`${API_URL}/api/slack/connect`}><Button variant="secondary">Connect Slack</Button></a>;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted">Slack · {status.channel ?? status.teamName}</span>
      <Button variant="ghost" onClick={async () => {
        try { await api.slackTest(); toast('success', 'Test message sent'); } catch { toast('error', 'Could not send test message'); }
      }}>Send test</Button>
      <Button variant="ghost" onClick={async () => { await api.slackDisconnect(); refresh(); toast('success', 'Slack disconnected'); }}>Disconnect</Button>
    </div>
  );
}
