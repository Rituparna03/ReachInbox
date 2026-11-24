import { API_URL } from '../lib/api';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

export default function LoginPage() {
  const failed = new URLSearchParams(location.search).get('error');
  const field = 'w-full rounded-lg bg-[#f3f5f4] px-3 py-3 text-sm placeholder:text-muted disabled:cursor-not-allowed';
  return (
    <main className="grid min-h-screen place-items-center bg-white p-6">
      <div className="w-full max-w-[372px] rounded-xl border border-line px-10 py-12">
        <h1 className="text-center text-3xl font-bold">Login</h1>
        {failed && <p className="mt-4 rounded-lg bg-red-50 p-2 text-center text-sm text-red-700">Login failed. Try again.</p>}

        <a href={`${API_URL}/auth/google`}
          className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-[#e4f4ea] py-2.5 text-sm font-medium hover:bg-[#d3ecdc]">
          <GoogleIcon /> Login with Google
        </a>

        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" /> or sign up through email <span className="h-px flex-1 bg-line" />
        </div>

        {/* Shown to match the design; email/password sign-in isn't implemented, Google only. */}
        <div className="space-y-3" title="Email sign-in isn't available. Use Google.">
          <input disabled placeholder="Email ID" aria-label="Email ID" className={field} />
          <input disabled type="password" placeholder="Password" aria-label="Password" className={field} />
        </div>
        <button disabled className="mt-6 w-full cursor-not-allowed rounded-lg bg-[#00a844] py-2.5 text-sm font-medium text-white opacity-60">
          Login
        </button>
      </div>
    </main>
  );
}