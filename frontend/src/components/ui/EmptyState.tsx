import { ReactNode } from 'react';
export const EmptyState = ({ title, text, action }: { title: string; text: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
    <p className="font-semibold">{title}</p>
    <p className="max-w-sm text-sm text-muted">{text}</p>
    {action && <div className="mt-2">{action}</div>}
  </div>
);
