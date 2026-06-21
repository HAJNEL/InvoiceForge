import React, { useState, useMemo } from 'react';
import {
  Users, Plus, Mail, Copy, Check, RefreshCw, Edit, Trash2,
  X, Lock, Shield, User, MessageSquare, AlertCircle, Loader2,
  ChevronLeft, ChevronRight, Bell, Send
} from 'lucide-react';
import { useTeamMembers } from '../hooks/useTeamMembers';
import { sendNotification, TEST_NOTIFICATION } from '../../../lib/notifications';
import { TeamMember } from '../../../types';
import { cn } from '../../../lib/utils';

// Pushover user keys are typically 30 alphanumeric characters. Used for a soft
// (non-blocking) format warning — Pushover's API remains the source of truth.
const PUSHOVER_KEY_PATTERN = /^[a-zA-Z0-9]{30}$/;

export function TeamMembersSection() {
  const { 
    members, 
    loading: listLoading, 
    addTeamMember, 
    updateTeamMember, 
    deleteTeamMember
  } = useTeamMembers();

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const totalPages = Math.ceil(members.length / itemsPerPage);

  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return members.slice(startIndex, startIndex + itemsPerPage);
  }, [members, currentPage]);

  // Dialog & Toast States
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<TeamMember | null>(null);
  
  // Create success state within the modal
  const [createdMember, setCreatedMember] = useState<TeamMember | null>(null);

  // Notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form Fields
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [formValues, setFormValues] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'viewer' as 'viewer' | 'editor',
    note: '',
    pushoverUserKey: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTestingPushover, setIsTestingPushover] = useState(false);
  const [rolesModalMember, setRolesModalMember] = useState<TeamMember | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const handleOpenRoles = (member: TeamMember) => {
    setRolesModalMember(member);
    setSelectedRoles(member.roles || []);
  };

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleOpenAdd = () => {
    setEditingMember(null);
    setCreatedMember(null);
    setFormValues({
      firstName: '',
      lastName: '',
      email: '',
      role: 'viewer',
      note: '',
      pushoverUserKey: ''
    });
    setFieldErrors({});
    setShowModal(true);
  };

  const handleOpenEdit = (member: TeamMember) => {
    setEditingMember(member);
    setCreatedMember(null);
    setFormValues({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      role: member.role,
      note: member.note || '',
      pushoverUserKey: member.pushoverUserKey || ''
    });
    setFieldErrors({});
    setShowModal(true);
  };

  // Field level validation on blur
  const validateField = (fieldName: string, val: string) => {
    const errors = { ...fieldErrors };
    if (fieldName === 'firstName' && !val.trim()) {
      errors.firstName = 'First name is required';
    } else if (fieldName === 'firstName') {
      delete errors.firstName;
    }

    if (fieldName === 'lastName' && !val.trim()) {
      errors.lastName = 'Last name is required';
    } else if (fieldName === 'lastName') {
      delete errors.lastName;
    }

    if (fieldName === 'email') {
      if (!val.trim()) {
        errors.email = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        errors.email = 'Please provide a valid email format';
      } else if (!editingMember && members.some(m => m.email.toLowerCase() === val.trim().toLowerCase())) {
        errors.email = 'This email is already on your team';
      } else {
        delete errors.email;
      }
    }

    setFieldErrors(errors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Final check
    const errors: { [key: string]: string } = {};
    if (!formValues.firstName.trim()) errors.firstName = 'First name is required';
    if (!formValues.lastName.trim()) errors.lastName = 'Last name is required';
    if (!editingMember) {
      if (!formValues.email.trim()) {
        errors.email = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formValues.email)) {
        errors.email = 'Please provide a valid email format';
      } else if (members.some(m => m.email.toLowerCase() === formValues.email.trim().toLowerCase())) {
        errors.email = 'This email is already on your team';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    if (editingMember) {
      // Edit updates role, note, first/last names
      const success = await updateTeamMember(editingMember.id, {
        firstName: formValues.firstName.trim(),
        lastName: formValues.lastName.trim(),
        role: formValues.role,
        note: formValues.note.trim(),
        pushoverUserKey: formValues.pushoverUserKey.trim()
      });
      setIsSubmitting(false);
      if (success) {
        showToast(`Team member details updated`);
        setShowModal(false);
      }
    } else {
      // Generate standard invitation code
      const inviteCode = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
      const newMember = await addTeamMember({
        firstName: formValues.firstName.trim(),
        lastName: formValues.lastName.trim(),
        email: formValues.email.trim().toLowerCase(),
        role: formValues.role,
        note: formValues.note.trim(),
        pushoverUserKey: formValues.pushoverUserKey.trim(),
        inviteCode
      });
      setIsSubmitting(false);
      if (newMember) {
        setCreatedMember(newMember);
        showToast(`Invitation created successfully`);
      }
    }
  };

  const handleCopyLink = (member: TeamMember) => {
    const fullUrl = `${window.location.origin}/register/team?code=${member.inviteCode}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedId(member.id);
      showToast("Registration link copied to clipboard!");
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const handleResendInvite = (member: TeamMember) => {
    showToast(`Invite resent to ${member.email}`);
  };

  // Send a test Pushover notification against the member's saved key, via the
  // shared notifications client. The app token lives server-side only.
  const handleTestPushover = async () => {
    if (!editingMember) return;
    setIsTestingPushover(true);
    try {
      const result = await sendNotification({
        to: { type: 'member', id: editingMember.id },
        ...TEST_NOTIFICATION,
      });
      showToast(
        result.success ? 'Test notification sent' : (result.error || 'Failed to send test notification.'),
        result.success ? 'success' : 'info'
      );
    } finally {
      setIsTestingPushover(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    const success = await deleteTeamMember(showDeleteConfirm);
    if (success) {
      showToast(`Removed ${showDeleteConfirm.firstName} ${showDeleteConfirm.lastName} from the team`);
      setShowDeleteConfirm(null);
    }
  };

  // Compute disabled button state
  const isFormInvalid = 
    !formValues.firstName.trim() || 
    !formValues.lastName.trim() || 
    (!editingMember && (!formValues.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formValues.email))) ||
    Object.keys(fieldErrors).length > 0;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden relative">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-zinc-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-zinc-800 text-xs font-semibold tracking-wide animate-fade-in animate-bounce">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-accent"></div>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Card Header & Button */}
      <div className="p-8 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-brand-accent/10 rounded-2xl">
            <Users className="w-6 h-6 text-brand-accent" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Team Members</h3>
            <p className="text-sm text-zinc-500 mt-0.5">Invite people to access and manage your trips</p>
          </div>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 bg-brand-primary text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-all self-start sm:self-center shadow-md shadow-zinc-900/10"
        >
          <Plus className="w-4 h-4" />
          Add Team Member
        </button>
      </div>

      {/* Main List */}
      <div className="p-8">
        {listLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-brand-accent animate-spin mb-2" />
            <span className="text-xs text-zinc-400 font-mono">LOADING TEAM DATA...</span>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-zinc-200 rounded-3xl p-6 bg-zinc-50/20">
            <div className="w-12 h-12 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto mb-4">
              <Users className="w-5 h-5 text-zinc-400" />
            </div>
            <h4 className="text-sm font-bold text-zinc-900">No team members yet</h4>
            <p className="text-xs text-zinc-550 mt-1 max-w-sm mx-auto">
              Add someone to start collaborating on your delivery dispatches and trip checklists.
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-4 inline-flex items-center gap-1 bg-zinc-900 text-white text-[11px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl hover:bg-zinc-800 transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Your First Member
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="pb-3 text-[10px] font-black uppercase tracking-wider text-zinc-400">Name</th>
                  <th className="pb-3 text-[10px] font-black uppercase tracking-wider text-zinc-400">Email</th>
                  <th className="pb-3 text-[10px] font-black uppercase tracking-wider text-zinc-400">Role</th>
                  <th className="pb-3 text-[10px] font-black uppercase tracking-wider text-zinc-400">Status</th>
                  <th className="pb-3 text-[10px] font-black uppercase tracking-wider text-zinc-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {paginatedMembers.map((member) => (
                  <tr key={member.id} className="group hover:bg-zinc-50/50 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center border border-zinc-200">
                          <span className="text-xs font-bold text-zinc-700 uppercase">
                            {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-zinc-900 capitalize leading-tight">
                            {member.firstName} {member.lastName}
                          </div>
                          {member.note && (
                            <span className="text-[10px] text-zinc-400 italic bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-100 inline-block mt-1">
                              {member.note}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-sm font-medium text-zinc-650">{member.email}</td>
                    <td className="py-4">
                      <div className="flex flex-col gap-1.5 items-start justify-center">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-bold capitalize px-2.5 py-1 rounded-xl border w-fit",
                          member.role === 'editor' 
                            ? "bg-amber-50 text-amber-700 border-amber-150" 
                            : "bg-blue-50 text-blue-700 border-blue-150"
                        )}>
                          <Shield className="w-3 h-3 stroke-[2.5]" />
                          {member.role}
                        </span>
                        {member.roles && member.roles.length > 0 && (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {member.roles.map((r) => (
                              <span 
                                key={r} 
                                className="inline-block text-[9px] font-extrabold px-1.5 py-0.5 bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-md whitespace-nowrap"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4">
                      <span className={cn(
                        "px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-xl border",
                        member.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-zinc-50 text-zinc-500 border-zinc-200'
                      )}>
                        {member.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        
                        {/* Copy Invite FAB Link */}
                        <button
                          type="button"
                          onClick={() => handleCopyLink(member)}
                          className="p-2 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded-xl transition-all relative group"
                          title="Copy Invite Link"
                        >
                          {copiedId === member.id ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        {/* Resend button */}
                        {member.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleResendInvite(member)}
                            className="p-2 text-zinc-400 hover:text-amber-600 hover:bg-zinc-100 rounded-xl transition-all"
                            title="Resend Invite Note"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(member)}
                          className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-zinc-100 rounded-xl transition-all"
                          title="Edit Details"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Setup Roles Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenRoles(member)}
                          className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-zinc-100 rounded-xl transition-all"
                          title="Setup Roles"
                        >
                          <Shield className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(member)}
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Remove Team Member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-150 bg-zinc-50/50">
              <span className="text-xs text-zinc-500 font-medium">
                Showing <span className="font-bold text-zinc-800">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-bold text-zinc-800">{Math.min(currentPage * itemsPerPage, members.length)}</span> of <span className="font-bold text-zinc-800">{members.length}</span> members
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pNum = i + 1;
                    if (totalPages > 5 && Math.abs(currentPage - pNum) > 1 && pNum !== 1 && pNum !== totalPages) {
                      if (Math.abs(currentPage - pNum) === 2) {
                        return <span key={pNum} className="text-xs text-zinc-400 font-bold px-0.5">...</span>;
                      }
                      return null;
                    }
                    return (
                      <button
                        key={pNum}
                        type="button"
                        onClick={() => setCurrentPage(pNum)}
                        className={cn(
                          "w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg border transition",
                          currentPage === pNum 
                            ? "bg-brand-primary border-brand-primary text-white" 
                            : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                        )}
                      >
                        {pNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* CRUD MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 max-w-lg w-full overflow-hidden animate-fade-in relative">
            
            {/* Header */}
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-brand-primary uppercase tracking-tight">
                  {editingMember ? 'Edit Team Member' : 'Invite Team Member'}
                </h3>
                <p className="text-zinc-500 text-xs mt-0.5">
                  {editingMember ? 'Manage roles and metadata of this user.' : 'Enter contact info to provide portal parameters.'}
                </p>
              </div>
              <button 
              title='setShowModal'
                onClick={() => setShowModal(false)}
                className="p-1 px-2.5 rounded-lg text-zinc-400 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200 text-xs transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdMember ? (
              /* Success states with full copy visual */
              <div className="p-6 space-y-6 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-950 text-sm">Team Member Saved!</h4>
                  <p className="text-zinc-500 text-xs mt-1">Copy and share this registration link with them to complete workspace access.</p>
                </div>

                <div className="bg-zinc-50 border border-zinc-150 p-3.5 rounded-2xl flex items-center gap-3 justify-between">
                  <span className="text-[11px] font-mono text-zinc-500 truncate select-all">
                    {window.location.origin}/register/team?code={createdMember.inviteCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const fullUrl = `${window.location.origin}/register/team?code=${createdMember.inviteCode}`;
                      navigator.clipboard.writeText(fullUrl).then(() => {
                        showToast("Invite link copied!");
                        setShowModal(false);
                      });
                    }}
                    className="flex shrink-0 items-center gap-1.5 bg-brand-primary hover:bg-zinc-955 text-white text-[10px] font-black uppercase tracking-wide px-3.5 py-2 rounded-xl transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy Link
                  </button>
                </div>

                <button
                  onClick={() => setShowModal(false)}
                  className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-bold text-xs uppercase"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              /* Core editing form */
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* First Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">First Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="text"
                        value={formValues.firstName}
                        onBlur={(e) => validateField('firstName', e.target.value)}
                        onChange={(e) => setFormValues({ ...formValues, firstName: e.target.value })}
                        className={cn(
                          "w-full pl-10 pr-3.5 py-2.5 bg-zinc-50 border rounded-xl text-xs focus:ring-2 focus:ring-brand-accent/20 focus:outline-none transition-all",
                          fieldErrors.firstName ? "border-red-500 bg-red-50/20" : "border-zinc-200"
                        )}
                        placeholder="John"
                        required
                      />
                    </div>
                    {fieldErrors.firstName && (
                      <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {fieldErrors.firstName}
                      </p>
                    )}
                  </div>

                  {/* Last Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Last Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="text"
                        value={formValues.lastName}
                        onBlur={(e) => validateField('lastName', e.target.value)}
                        onChange={(e) => setFormValues({ ...formValues, lastName: e.target.value })}
                        className={cn(
                          "w-full pl-10 pr-3.5 py-2.5 bg-zinc-50 border rounded-xl text-xs focus:ring-2 focus:ring-brand-accent/20 focus:outline-none transition-all",
                          fieldErrors.lastName ? "border-red-500 bg-red-50/20" : "border-zinc-200"
                        )}
                        placeholder="Doe"
                        required
                      />
                    </div>
                    {fieldErrors.lastName && (
                      <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {fieldErrors.lastName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Email (Readonly during edit) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Email Address</label>
                  <div className="relative">
                    {editingMember ? (
                      <>
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                          type="email"
                          value={formValues.email}
                          disabled
                          className="w-full pl-10 pr-10 py-2.5 bg-zinc-100 border border-zinc-200 rounded-xl text-xs text-zinc-500 cursor-not-allowed font-medium select-none"
                          title="Email cannot be changed after creation"
                        />
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400" title="Email cannot be changed after creation">
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                      </>
                    ) : (
                      <>
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                          type="email"
                          value={formValues.email}
                          onBlur={(e) => validateField('email', e.target.value)}
                          onChange={(e) => setFormValues({ ...formValues, email: e.target.value })}
                          className={cn(
                            "w-full pl-10 pr-3.5 py-2.5 bg-zinc-50 border rounded-xl text-xs focus:ring-2 focus:ring-brand-accent/20 focus:outline-none transition-all",
                            fieldErrors.email ? "border-red-500 bg-red-50/20" : "border-zinc-200"
                          )}
                          placeholder="client@company.com"
                          required
                        />
                      </>
                    )}
                  </div>
                  {fieldErrors.email && (
                    <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {fieldErrors.email}
                    </p>
                  )}
                  {editingMember && (
                    <p className="text-[9px] text-zinc-400 italic">Email address cannot be changed after creation.</p>
                  )}
                </div>

                {/* Role Switcher */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Collaborator Role</label>
                  <div className="grid grid-cols-2 gap-2 bg-zinc-50 border border-zinc-200 p-1.5 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setFormValues({ ...formValues, role: 'viewer' })}
                      className={cn(
                        "py-2.5 text-xs font-bold rounded-xl transition-all border flex items-center justify-center gap-1.5",
                        formValues.role === 'viewer' 
                          ? "bg-white text-blue-700 shadow-sm border-zinc-200" 
                          : "text-zinc-500 hover:text-zinc-700 border-transparent bg-transparent"
                      )}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      Viewer (Read-only)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormValues({ ...formValues, role: 'editor' })}
                      className={cn(
                        "py-2.5 text-xs font-bold rounded-xl transition-all border flex items-center justify-center gap-1.5",
                        formValues.role === 'editor' 
                          ? "bg-white text-amber-700 shadow-sm border-zinc-200" 
                          : "text-zinc-500 hover:text-zinc-700 border-transparent bg-transparent"
                      )}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Editor (Check-off)
                    </button>
                  </div>
                </div>

                {/* Note */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Internal Notes (Optional)</label>
                  <input
                    type="text"
                    value={formValues.note}
                    onChange={(e) => setFormValues({ ...formValues, note: e.target.value })}
                    className="w-full p-2.5 border border-zinc-200 rounded-xl bg-zinc-50 focus:ring-2 focus:ring-brand-accent/20 focus:outline-none text-xs"
                    placeholder="e.g. Handles Cape Town dispatch trucks"
                  />
                </div>

                {/* Pushover User Key */}
                {(() => {
                  const keyTrimmed = formValues.pushoverUserKey.trim();
                  const looksInvalid = keyTrimmed.length > 0 && !PUSHOVER_KEY_PATTERN.test(keyTrimmed);
                  const savedKey = (editingMember?.pushoverUserKey || '').trim();
                  const isDirty = keyTrimmed !== savedKey;
                  const canTest = !!editingMember && keyTrimmed.length > 0 && !isDirty;
                  return (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Pushover User Key (Optional)</label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Bell className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                          <input
                            type="text"
                            value={formValues.pushoverUserKey}
                            onChange={(e) => setFormValues({ ...formValues, pushoverUserKey: e.target.value })}
                            className={cn(
                              "w-full pl-10 pr-3.5 py-2.5 bg-zinc-50 border rounded-xl text-xs font-mono focus:ring-2 focus:ring-brand-accent/20 focus:outline-none transition-all",
                              looksInvalid ? "border-amber-400 bg-amber-50/20" : "border-zinc-200"
                            )}
                            placeholder="30-character key from Pushover"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                          />
                        </div>
                        {editingMember && (
                          <button
                            type="button"
                            onClick={handleTestPushover}
                            disabled={!canTest || isTestingPushover}
                            title={isDirty && keyTrimmed.length > 0 ? "Save changes before sending a test" : "Send a test notification"}
                            className="flex shrink-0 items-center gap-1.5 bg-brand-primary text-white px-3.5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isTestingPushover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            Test
                          </button>
                        )}
                      </div>
                      {looksInvalid ? (
                        <p className="text-[10px] font-bold text-amber-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> This doesn't look like a standard 30-character Pushover key. You can still save it.
                        </p>
                      ) : (
                        <p className="text-[9px] text-zinc-400 italic">
                          {editingMember && isDirty && keyTrimmed.length > 0
                            ? 'Save changes before sending a test notification.'
                            : 'Used to send this member push notifications. Save, then send a test to verify.'}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Form Action */}
                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-50 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-5 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isFormInvalid || isSubmitting}
                    className="flex items-center justify-center gap-1.5 bg-brand-primary text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {editingMember ? 'Save Changes' : 'Invite Member'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}



      {/* DELETE DIALOG */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 max-w-sm w-full p-6 text-center animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mx-auto mb-4">
              <Trash2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <h3 className="font-bold text-zinc-900 text-base leading-tight">Remove Team Member?</h3>
            <p className="text-zinc-500 text-xs mt-2 leading-relaxed">
              Are you sure you want to remove <span className="font-black text-zinc-800">{showDeleteConfirm.firstName} {showDeleteConfirm.lastName}</span>? They will lose access to the portal parameters immediately.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETUP ROLES DIALOG */}
      {rolesModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 max-w-md w-full overflow-hidden animate-fade-in relative text-left">
            
            {/* Header */}
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-brand-primary uppercase tracking-tight flex items-center gap-2">
                  <Shield className="w-5 h-5 text-brand-accent" />
                  Setup Roles
                </h3>
                <p className="text-zinc-550 text-xs mt-0.5">
                  Assign active roles for <span className="font-extrabold text-zinc-800">{rolesModalMember.firstName} {rolesModalMember.lastName}</span>
                </p>
              </div>
              <button
                title='setRolesModalMember' 
                onClick={() => setRolesModalMember(null)}
                className="p-1 px-2.5 rounded-lg text-zinc-400 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200 text-xs transition-colors"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Checklist */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-zinc-500 leading-relaxed">
                Configure specific warehouse and logistic roles. These roles define their responsibilities on the team dashboard and trip lists.
              </p>

              <div className="space-y-2">
                {[
                  { id: 'Stock Counter', label: 'Stock Counter', desc: 'Responsible for performing inventory and stock item count verifications.' },
                  { id: 'Assembler', label: 'Assembler', desc: 'Prepares and packages items for order and route dispatch.' },
                  { id: 'Loader', label: 'Loader', desc: 'Verifies correct inventory units are successfully loaded onboard transport trucks.' },
                  { id: 'Delivered Checker', label: 'Delivered Checker', desc: 'Checks Off individual route components and receipt validations upon delivery.' }
                ].map((roleOption) => {
                  const isChecked = selectedRoles.includes(roleOption.id);
                  return (
                    <label 
                      key={roleOption.id}
                      className={cn(
                        "flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer select-none",
                        isChecked 
                          ? "bg-zinc-55 border-brand-accent/50 shadow-xs" 
                          : "border-zinc-200 hover:bg-zinc-50/40"
                      )}
                    >
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedRoles(prev => prev.filter(r => r !== roleOption.id));
                          } else {
                            setSelectedRoles(prev => [...prev, roleOption.id]);
                          }
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent"
                      />
                      <div>
                        <span className="text-xs font-bold text-zinc-900 block leading-tight">
                          {roleOption.label}
                        </span>
                        <span className="text-[10px] text-zinc-500 mt-0.5 block leading-normal">
                          {roleOption.desc}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 mt-6">
                <button
                  type="button"
                  onClick={() => setRolesModalMember(null)}
                  className="px-5 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setIsSubmitting(true);
                    const success = await updateTeamMember(rolesModalMember.id, {
                      roles: selectedRoles
                    });
                    setIsSubmitting(false);
                    if (success) {
                      showToast(`Successfully saved roles for ${rolesModalMember.firstName}`);
                      setRolesModalMember(null);
                    }
                  }}
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-1.5 bg-brand-primary text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Roles
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
