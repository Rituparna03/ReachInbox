import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { extractEmails, toLocalInput } from '../lib/format';
import { Modal } from './ui/Modal';
import { Input, Textarea } from './ui/Input';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';

const initial = () => ({ subject: '', body: '', start: toLocalInput(new Date(Date.now() + 60_000)), delay: '2', limit: '' });

export function ComposeModal({ open, onClose, onScheduled }: { open: boolean; onClose: () => void; onScheduled: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof ReturnType<typeof initial>) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setRecipients(extractEmails(await file.text()));
  };

  const error = useMemo(() => {
    if (!form.subject.trim() || !form.body.trim()) return 'Subject and body are required';
    if (!recipients.length) return 'Upload a CSV or text file that contains email addresses';
    if (new Date(form.start).getTime() < Date.now() - 60_000) return 'Start time must be in the future';
    return null;
  }, [form, recipients]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (error) return toast('error', error);
    setSubmitting(true);
    try {
      const res = await api.schedule({
        subject: form.subject, body: form.body, recipients,
        startTime: new Date(form.start).toISOString(),
        delaySeconds: Math.max(0, Number(form.delay) || 0),
        hourlyLimit: form.limit ? Number(form.limit) : undefined,
      });
      toast('success', `Scheduled ${res.count} emails`);
      setForm(initial()); setRecipients([]); setFileName('');
      onScheduled(); onClose();
    } catch (err) { toast('error', (err as Error).message); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal open={open} title="Compose new email" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Subject" value={form.subject} onChange={set('subject')} placeholder="Quick question" />
        <Textarea label="Body" rows={5} value={form.body} onChange={set('body')} placeholder="Write your email (HTML allowed)" />
        <div>
          <p className="text-sm font-medium">Leads</p>
          <label className="mt-1 flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-line px-3 py-3 text-sm hover:bg-surface">
            <span className="text-muted">{fileName || 'Upload CSV or text file'}</span>
            <span className="font-semibold text-brand">Browse</span>
            <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={onFile} />
          </label>
          {fileName && <p className="mt-1 text-xs text-muted">{recipients.length} email address{recipients.length === 1 ? '' : 'es'} detected</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Start time" type="datetime-local" value={form.start} onChange={set('start')} />
          <Input label="Delay between emails (s)" type="number" min={0} value={form.delay} onChange={set('delay')} />
          <Input label="Hourly limit" type="number" min={1} value={form.limit} onChange={set('limit')} placeholder="Default" hint="Per sender" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting}>Schedule</Button>
        </div>
      </form>
    </Modal>
  );
}
