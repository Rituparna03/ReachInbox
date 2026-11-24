import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../lib/api';
import type { User } from '../types';

interface AuthCtx { user: User | null; loading: boolean; logout: () => Promise<void> }
const Ctx = createContext<AuthCtx>({ user: null, loading: true, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  const logout = useCallback(async () => { await api.logout(); setUser(null); }, []);
  return <Ctx.Provider value={{ user, loading, logout }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
