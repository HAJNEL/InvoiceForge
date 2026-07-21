import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { ArrowLeft, Camera, Loader2, Mail, Phone, User as UserIcon, Bell, Save, ShieldCheck, X, CalendarCheck } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { useAuth } from '../../core/hooks/useAuth';
import { TeamMember } from '../../types';
import { GOOGLE_OAUTH_CLIENT_ID, requestCalendarToken } from '../../lib/googleCalendar';

// Downscale a selected image to a small square-ish base64 string so it fits
// comfortably inside the team_members Firestore document (1MB doc limit).
function fileToResizedBase64(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load image.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported.'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function TeamProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Editable fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [pushoverUserKey, setPushoverUserKey] = useState('');
  const [photoBase64, setPhotoBase64] = useState('');
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const [togglingCalendar, setTogglingCalendar] = useState(false);

  const signedInWithGoogle = useMemo(
    () => (auth.currentUser?.providerData || []).some(p => p.providerId === 'google.com'),
    []
  );

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'team_members', user.uid));
        if (!active) return;
        if (!snap.exists()) {
          setNotFound(true);
          return;
        }
        const data = { id: snap.id, ...snap.data() } as TeamMember;
        setProfile(data);
        setFirstName(data.firstName || '');
        setLastName(data.lastName || '');
        setPhone(data.phone || '');
        setPushoverUserKey(data.pushoverUserKey || '');
        setPhotoBase64(data.photoBase64 || '');
        setCalendarSyncEnabled(Boolean(data.calendarSyncEnabled));
      } catch (err) {
        console.error('Failed to load profile:', err);
        toast.error('Load Failed', { description: 'Could not load your profile. Please try again.' });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  const handlePickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid File', { description: 'Please choose an image file.' });
      return;
    }
    try {
      const b64 = await fileToResizedBase64(file);
      setPhotoBase64(b64);
    } catch (err) {
      console.error('Image processing failed:', err);
      toast.error('Image Error', { description: 'Could not process that image.' });
    }
  };

  // Toggle Google Calendar sync. Enabling first triggers the Google consent
  // screen so we confirm calendar access before persisting the preference.
  const handleToggleCalendar = async () => {
    if (!user || togglingCalendar) return;
    const next = !calendarSyncEnabled;
    setTogglingCalendar(true);
    try {
      if (next) {
        if (!GOOGLE_OAUTH_CLIENT_ID) {
          toast.error('Not Configured', { description: 'Google Calendar sync is not configured for this app yet.' });
          return;
        }
        // Force the consent prompt so the member explicitly grants calendar access.
        await requestCalendarToken(true);
      }
      await updateDoc(doc(db, 'team_members', user.uid), {
        calendarSyncEnabled: next,
        updatedAt: new Date().toISOString()
      });
      setCalendarSyncEnabled(next);
      toast.success(next ? 'Calendar Sync Enabled' : 'Calendar Sync Disabled', {
        description: next
          ? 'You can now sync trips to your Google Calendar from the dashboard.'
          : 'Trips will no longer sync to your Google Calendar.'
      });
    } catch (err) {
      console.error('Calendar toggle failed:', err);
      toast.error('Could Not Enable', {
        description: err instanceof Error ? err.message : 'Google Calendar permission was not granted.'
      });
    } finally {
      setTogglingCalendar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!firstName.trim()) {
      toast.error('Name Required', { description: 'Please enter your first name.' });
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'team_members', user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        pushoverUserKey: pushoverUserKey.trim(),
        photoBase64: photoBase64 || '',
        updatedAt: new Date().toISOString()
      });
      toast.success('Profile Saved', { description: 'Your personal details have been updated.' });
      navigate('/team-dashboard');
    } catch (err) {
      console.error('Failed to save profile:', err);
      toast.error('Save Failed', { description: 'Could not save your profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const initial = (firstName || profile?.firstName || auth.currentUser?.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-zinc-150 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          title="Back to dashboard"
          onClick={() => navigate('/team-dashboard')}
          className="p-2 -ml-2 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-all"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
        </button>
        <h1 className="text-sm font-black uppercase tracking-tight text-zinc-900">My Profile</h1>
      </header>

      <main className="w-full max-w-xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="w-10 h-10 text-brand-primary animate-spin mb-4" />
            <span className="text-xs font-semibold text-zinc-400 font-mono tracking-widest uppercase">Loading Profile...</span>
          </div>
        ) : notFound ? (
          <div className="bg-white rounded-3xl p-8 border border-zinc-200 text-center space-y-2 shadow-sm">
            <h3 className="font-bold text-zinc-900 text-sm">Profile Unavailable</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              We couldn't find your team member profile. Please contact your administrator.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Avatar */}
            <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-sm flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-zinc-900 text-white flex items-center justify-center overflow-hidden border border-zinc-200 shadow-sm">
                  {photoBase64 ? (
                    <img src={photoBase64} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-black uppercase">{initial}</span>
                  )}
                </div>
                <button
                  type="button"
                  title="Change photo"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center border-2 border-white shadow-md hover:bg-zinc-800 transition-all"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePickPhoto}
                  className="hidden"
                />
              </div>
              {photoBase64 && (
                <button
                  type="button"
                  onClick={() => setPhotoBase64('')}
                  className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-red-500 hover:text-red-600"
                >
                  <X className="w-3 h-3" /> Remove Photo
                </button>
              )}
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                {signedInWithGoogle ? 'Signed in with Google' : 'Signed in with Email'}
              </div>
            </div>

            {/* Personal details */}
            <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-sm space-y-4">
              <p className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest font-mono">Personal Details</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="First Name" icon={<UserIcon className="w-4 h-4 text-zinc-400" />}>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full pl-10 pr-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
                    required
                  />
                </Field>
                <Field label="Last Name" icon={<UserIcon className="w-4 h-4 text-zinc-400" />}>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full pl-10 pr-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
                  />
                </Field>
              </div>

              <Field label="Email (login identity — read only)" icon={<Mail className="w-4 h-4 text-zinc-400" />}>
                <input
                  type="email"
                  value={profile?.email || auth.currentUser?.email || ''}
                  readOnly
                  disabled
                  className="w-full pl-10 pr-3 py-2.5 bg-zinc-100 border border-zinc-200 rounded-xl text-sm text-zinc-500 cursor-not-allowed"
                />
              </Field>

              <Field label="Phone Number" icon={<Phone className="w-4 h-4 text-zinc-400" />}>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +27 82 000 0000"
                  className="w-full pl-10 pr-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
                />
              </Field>

              <Field label="Pushover Notification Key (optional)" icon={<Bell className="w-4 h-4 text-zinc-400" />}>
                <input
                  type="text"
                  value={pushoverUserKey}
                  onChange={(e) => setPushoverUserKey(e.target.value)}
                  placeholder="Your personal Pushover user key"
                  className="w-full pl-10 pr-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all"
                />
              </Field>
            </div>

            {/* Google Calendar sync (available to every team member; the Google
                account is chosen in the consent popup when enabling). */}
            <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-sm space-y-4">
                <p className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest font-mono">Integrations</p>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                      <CalendarCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-zinc-900">Sync with Google Calendar</p>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Add upcoming trips to your Google Calendar, then sync new or rescheduled trips from the dashboard.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={calendarSyncEnabled}
                    title={calendarSyncEnabled ? 'Disable Google Calendar sync' : 'Enable Google Calendar sync'}
                    onClick={handleToggleCalendar}
                    disabled={togglingCalendar}
                    className={`relative shrink-0 w-12 h-7 rounded-full transition-all disabled:opacity-50 ${
                      calendarSyncEnabled ? 'bg-brand-primary' : 'bg-zinc-300'
                    }`}
                  >
                    <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all flex items-center justify-center ${
                      calendarSyncEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}>
                      {togglingCalendar && <Loader2 className="w-3 h-3 text-zinc-400 animate-spin" />}
                    </span>
                  </button>
                </div>
              </div>

            {/* Save */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/team-dashboard')}
                className="flex-1 py-3 rounded-2xl font-bold text-sm text-zinc-500 hover:bg-zinc-100 transition-all border border-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-[2] bg-brand-primary text-white py-3 rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-zinc-800 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Profile
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>
        {children}
      </div>
    </div>
  );
}
