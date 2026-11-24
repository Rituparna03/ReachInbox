import type { EmailDetail, EmailRow, ScheduleInput, SlackStatus, User } from '../types';
export const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:4000');
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  }
  return res.json();
}

export const api = {
  me: () => request<User>('/api/me'),
  logout: () => request<{ ok: true }>('/api/logout', { method: 'POST' }),
  emails: (status: 'scheduled' | 'sent', q = '') => request<EmailRow[]>(`/api/emails?status=${status}&q=${encodeURIComponent(q)}`),
    email: (id: string) => request<EmailDetail>(`/api/emails/${id}`),
  schedule: (input: ScheduleInput) =>
    request<{ batchId: string; count: number }>('/api/emails/schedule', { method: 'POST', body: JSON.stringify(input) }),
  slackStatus: () => request<SlackStatus>('/api/slack/status'),
  slackDisconnect: () => request<{ ok: true }>('/api/slack', { method: 'DELETE' }),
  slackTest: () => request<{ delivered: boolean }>('/api/slack/test', { method: 'POST' }),
};
