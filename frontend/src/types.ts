export interface User { id: string; name: string; email: string; avatarUrl: string | null }
export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed';
export interface EmailRow {
  id: string; toEmail: string; subject: string; status: EmailStatus;
  scheduledAt: string; sentAt: string | null; previewUrl: string | null; error: string | null;
}
export interface SlackStatus { connected: boolean; channel?: string; teamName?: string }
export interface ScheduleInput {
  subject: string; body: string; recipients: string[]; startTime: string; delaySeconds: number; hourlyLimit?: number;
}
export interface EmailDetail extends EmailRow { body: string; fromEmail: string }
