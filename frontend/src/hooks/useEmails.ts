import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { EmailRow } from '../types';

/** Loads one list and polls so the table updates as the worker sends. */
export function useEmails(kind: 'scheduled' | 'sent', query: string, pollMs = 5000) {
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRows(await api.emails(kind, query)); setError(null); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [kind, query]);

  useEffect(() => {
    const t = setTimeout(load, query ? 300 : 0);          // debounce search typing
    const i = setInterval(load, pollMs);
    return () => { clearTimeout(t); clearInterval(i); };
  }, [load, pollMs, query]);

  return { rows, loading, error, reload: load };
}
