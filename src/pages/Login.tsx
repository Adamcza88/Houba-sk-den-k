import { useAuth } from '../lib/auth';
import { MapPin, AlertCircle } from 'lucide-react';

export function Login() {
  const { signInWithGoogle, loading, error } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-100">Načítání...</div>;
  }

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="p-8 text-center">
          <div className="w-20 h-20 bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <MapPin size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-900 mb-2">Houbařský Deník</h1>
          <p className="text-stone-500 mb-8">Zaznamenávejte své nálezy, sledujte vzácnost a budujte svůj osobní atlas hub.</p>
          
          {error && (
            <div className={`p-4 rounded-xl text-sm flex flex-col items-center gap-2 text-left mb-6 ${error.includes('PROHLÍŽEČ ZABLOKOVAL') ? 'bg-amber-50 border-2 border-amber-400 text-amber-900' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              <div className="flex items-center gap-2 font-bold w-full justify-center">
                <AlertCircle size={24} />
                <span>{error.includes('PROHLÍŽEČ') ? 'Akce vyžadována' : 'Chyba přihlášení'}</span>
              </div>
              <p className="text-center font-medium">
                {error}
              </p>
            </div>
          )}
          
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border border-stone-200 text-stone-800 px-6 py-4 rounded-xl font-medium hover:bg-stone-50 transition-colors shadow-sm"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Přihlásit se přes Google
          </button>
          
          <div className="mt-6 text-left bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
            <p className="font-bold mb-1">Důležité kroky ve Firebase:</p>
            <ol className="list-decimal ml-4 mt-2 space-y-2 text-xs">
              <li><strong>Povolit doménu:</strong> Authentication &gt; Settings &gt; Authorized domains &gt; Přidat <strong>{window.location.hostname}</strong></li>
              <li><strong>Vytvořit databázi:</strong> Firestore Database &gt; Create database (zvolte lokaci a produkční mód)</li>
              <li><strong>Povolit Storage:</strong> Storage &gt; Get started</li>
            </ol>
          </div>
        </div>
        <div className="bg-stone-50 p-6 border-t border-stone-100 text-center">
          <p className="text-xs text-stone-400">
            Vaše data jsou soukromá a bezpečně uložená.
          </p>
        </div>
      </div>
    </div>
  );
}
