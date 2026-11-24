import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Spinner } from './components/ui/Spinner';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import EmailDetailPage from './pages/EmailDetail';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid h-screen place-items-center"><Spinner /></div>;
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/dashboard" element={user ? <DashboardPage /> : <Navigate to="/" replace />} />
      <Route path="/email/:id" element={user ? <EmailDetailPage /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
