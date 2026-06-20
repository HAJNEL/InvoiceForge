import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { 
  FileText, Mail, Lock, Eye, EyeOff, CheckCircle2, 
  XSquare, ArrowRight, Loader2, HelpCircle 
} from 'lucide-react';
import { TeamMember, Settings } from '../../types';

export function TeamRegister() {
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('code') || '';
  const navigate = useNavigate();

  // Load States
  const [checkingInvite, setCheckingInvite] = useState(true);
  const [invitation, setInvitation] = useState<TeamMember | null>(null);
  const [ownerSettings, setOwnerSettings] = useState<Settings | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Form inputs
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Strength checkers
  const hasMinLen = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const meetsCriteria = hasMinLen && hasUpper && hasSpecial;

  useEffect(() => {
    async function verifyInvite() {
      if (!inviteCode) {
        setErrorMessage('No invitation code found in the registration link.');
        setCheckingInvite(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'team_members'), 
          where('inviteCode', '==', inviteCode),
          where('status', '==', 'pending')
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setErrorMessage('This invitation link is invalid or has already been used.');
          setCheckingInvite(false);
          return;
        }

        const docSnap = snapshot.docs[0];
        const memberData = { id: docSnap.id, ...docSnap.data() } as TeamMember;
        setInvitation(memberData);

        // Fetch owner settings for brand styling/logo
        const settingsRef = doc(db, 'settings', memberData.ownerId);
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          setOwnerSettings(settingsSnap.data() as Settings);
        }
      } catch (err) {
        console.error("Invite lookup error:", err);
        setErrorMessage('Error validating invitation. Please check your internet connection.');
      } finally {
        setCheckingInvite(false);
      }
    }

    verifyInvite();
  }, [inviteCode]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;

    if (!meetsCriteria) {
      setErrorMessage('Your password does not meet the specified security requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Confirm password must match the original password.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // 1. Create firebase auth credentials
      const userCredential = await createUserWithEmailAndPassword(auth, invitation.email, password);
      const newUser = userCredential.user;

      // 2. Clear pending invitation by creating active document with uid as the document ID
      const newMemberDocRef = doc(db, 'team_members', newUser.uid);
      const oldMemberDocRef = doc(db, 'team_members', invitation.id);

      const updatedMemberData: TeamMember = {
        ...invitation,
        id: newUser.uid,
        userId: newUser.uid,
        status: 'active',
        updatedAt: new Date().toISOString()
      };

      await setDoc(newMemberDocRef, updatedMemberData);
      await deleteDoc(oldMemberDocRef);

      // 3. Clear sessions and navigate directly to mobile-friendly dashboard
      navigate('/team-dashboard');
    } catch (err: unknown) {
      console.error("Team registration error:", err);
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to create account. Please contact your administrator.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingInvite) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-brand-primary animate-spin mb-4" />
        <span className="text-xs font-semibold text-zinc-400 font-mono tracking-widest">VERIFYING PORTAL ADMITTANCE...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        
        {/* Branding Logo */}
        <div className="text-center mb-10 animate-fade-in">
          {ownerSettings?.sidebarLogoBase64 ? (
            <img 
              src={ownerSettings.sidebarLogoBase64} 
              alt="Owner Logo" 
              className="inline-flex w-16 h-16 rounded-2xl object-contain bg-zinc-900 duration-300 p-2 shadow-xl shadow-zinc-900/10 mb-5"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-primary text-white mb-6 shadow-xl shadow-brand-primary/20">
              <FileText className="w-8 h-8" />
            </div>
          )}
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 uppercase">Team Workspace</h1>
          <p className="text-zinc-500 text-xs mt-1">Accept invitation & complete portal registration</p>
        </div>

        {/* Error State Case */}
        {errorMessage && !invitation && (
          <div className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-xl shadow-zinc-200/50 text-center space-y-4 animate-scale-up">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto">
              <XSquare className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 text-sm">Expired or Invalid Link</h3>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{errorMessage}</p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-all shadow-md"
            >
              Back to Login
            </button>
          </div>
        )}

        {/* Content Form Case */}
        {invitation && (
          <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-2xl shadow-zinc-200/50 relative overflow-hidden animate-slide-up">
            
            {/* Inline warning/error banner */}
            {errorMessage && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs mb-6 border border-red-100 flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0 mt-1.5"></span>
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

            <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-2xl mb-6 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent font-bold text-xs uppercase shrink-0">
                {invitation.firstName.charAt(0)}{invitation.lastName.charAt(0)}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Invited Collaborator</p>
                <p className="text-xs font-bold text-zinc-800 capitalize leading-snug">
                  {invitation.firstName} {invitation.lastName}
                </p>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              
              {/* Ready-only Email */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                  placeholder='email' 
                    type="email" 
                    value={invitation.email}
                    disabled
                    className="w-full pl-10 pr-4 py-3 bg-zinc-100 border border-zinc-200 rounded-xl text-xs text-zinc-500 font-medium cursor-not-allowed select-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">Passkey Credentials</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all placeholder:text-zinc-400"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">Confirm password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all placeholder:text-zinc-400"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {/* Security strength check indicator */}
              <div className="bg-zinc-50 border border-zinc-150 p-3.5 rounded-2xl space-y-2 text-[11px] text-zinc-500">
                <p className="font-bold text-[10px] text-zinc-700 uppercase tracking-wide flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
                  Passkey Security Guidelines
                </p>
                <div className="space-y-1 font-mono">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${hasMinLen ? 'text-emerald-500' : 'text-zinc-300'}`} />
                    <span>Minimum 8 total characters</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${hasUpper ? 'text-emerald-500' : 'text-zinc-300'}`} />
                    <span>At least 1 uppercase letter</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${hasSpecial ? 'text-emerald-500' : 'text-zinc-300'}`} />
                    <span>At least 1 special symbol</span>
                  </div>
                </div>
              </div>

              {/* Submission Button */}
              <button 
                type="submit" 
                disabled={loading || !meetsCriteria || password !== confirmPassword}
                className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-40 disabled:cursor-not-allowed group shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registering Portal credentials...
                  </>
                ) : (
                  <>
                    Activate Portal Access
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
