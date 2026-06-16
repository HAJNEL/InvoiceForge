import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider 
} from 'firebase/auth';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { Mail, Lock, Chrome, ArrowRight } from 'lucide-react';
import { NRLogo } from '../../components/Logo';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [publicLogo, setPublicLogo] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadPublicLogo() {
      try {
        const q = query(collection(db, 'settings'), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docData = snap.docs[0].data();
          if (docData.sidebarLogoBase64) {
            setPublicLogo(docData.sidebarLogoBase64);
          }
        }
      } catch (err) {
        console.error("Failed to load public logo:", err);
      }
    }
    loadPublicLogo();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Perform immediate team member check for navigation
      const q = query(
        collection(db, 'team_members'),
        where('userId', '==', user.uid),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        navigate('/team-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      // Perform immediate team member check for navigation
      const q = query(
        collection(db, 'team_members'),
        where('userId', '==', user.uid),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        navigate('/team-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-6">
            {publicLogo ? (
              <img 
                src={publicLogo} 
                alt="Brand Logo" 
                className="w-20 h-20 rounded-2xl object-contain bg-zinc-900 p-2 shadow-xl shadow-zinc-900/15 border border-zinc-800"
                referrerPolicy="no-referrer"
              />
            ) : (
              <NRLogo className="w-16 h-16 shadow-xl shadow-red-500/20" variant="red-square" />
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 border-b-0">Welcome back</h1>
          <p className="text-zinc-500 mt-2">Sign in to manage your invoices with InvoiceForge</p>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-xl shadow-zinc-200/50">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-6 border border-red-100 flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0"></span>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1.5 uppercase tracking-wider text-[10px]">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all placeholder:text-zinc-400"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-zinc-700 uppercase tracking-wider text-[10px]">Password</label>
                <a href="#" className="text-[10px] uppercase font-bold tracking-widest text-brand-accent hover:underline">Forgot?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all placeholder:text-zinc-400"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold text-sm tracking-widest uppercase hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? "Authenticating..." : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-100"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
              <span className="bg-white px-4 text-zinc-400">Or continue with</span>
            </div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full border border-zinc-200 py-3 rounded-xl font-bold text-[10px] tracking-widest uppercase hover:bg-zinc-50 transition-all flex items-center justify-center gap-2 mb-6"
          >
            <Chrome className="w-4 h-4 text-brand-accent" />
            Continue with Google
          </button>

          <p className="text-center text-sm text-zinc-500">
            Don't have an account? {' '}
            <Link to="/register" className="text-brand-accent font-bold hover:underline">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
