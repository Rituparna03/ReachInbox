import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/Button';
import { SlackControl } from './SlackControl';

export function Header() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3">
        <h1 className="text-lg font-bold text-brand">ReachInbox <span className="font-medium text-ink">Scheduler</span></h1>
        <div className="flex flex-wrap items-center gap-4">
          <SlackControl />
          <div className="flex items-center gap-3">
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full" />
              : <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-white">{user.name[0]}</span>}
            <div className="leading-tight"><p className="text-sm font-semibold">{user.name}</p><p className="text-xs text-muted">{user.email}</p></div>
          </div>
          <Button variant="secondary" onClick={logout}>Logout</Button>
        </div>
      </div>
    </header>
  );
}
