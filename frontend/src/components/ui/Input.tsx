import { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

const base = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm placeholder:text-muted/70';
interface FieldProps { label: string; hint?: string }

export function Input({ label, hint, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm font-medium">
      {label}<input {...rest} className={`${base} mt-1 font-normal`} />
      {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}
export function Textarea({ label, hint, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block text-sm font-medium">
      {label}<textarea {...rest} className={`${base} mt-1 font-normal`} />
      {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}
