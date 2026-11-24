import type { EmailStatus } from '../../types';
const map: Record<EmailStatus, string> = {
  scheduled: 'bg-amber-50 text-amber-700', processing: 'bg-blue-50 text-blue-700',
  sent: 'bg-green-50 text-green-700', failed: 'bg-red-50 text-red-700',
};
export const StatusBadge = ({ status }: { status: EmailStatus }) => (
  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${map[status]}`}>{status}</span>
);
