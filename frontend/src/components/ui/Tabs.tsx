interface Tab<T extends string> { id: T; label: string; count?: number }
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Tab<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex gap-6 border-b border-line">
      {tabs.map(t => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 pb-3 text-sm font-semibold ${value === t.id ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
          {t.label}{t.count !== undefined && <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-xs">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
