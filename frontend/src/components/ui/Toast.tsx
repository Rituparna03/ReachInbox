import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

type Kind = 'success' | 'error';
interface ToastItem { id: number; kind: Kind; text: string }
const Ctx = createContext<(kind: Kind, text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random();
    setItems(i => [...i, { id, kind, text }]);
    setTimeout(() => setItems(i => i.filter(t => t.id !== id)), 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2" aria-live="polite">
        {items.map(t => (
          <div key={t.id} className={`rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${t.kind === 'error' ? 'bg-red-600' : 'bg-brand'}`}>{t.text}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
