import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import { User, Key, LogOut, Eye, EyeOff } from 'lucide-react';

interface UserHeaderProps {
  user: any;
  onLogout: () => void;
}

export const UserHeader: React.FC<UserHeaderProps> = ({ user, onLogout }) => {
  const [showModal, setShowModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/users/update-pos-password', {
        userId: user.id,
        currentPassword,
        newPassword
      });
      return res.data;
    },
    onSuccess: () => {
      setShowModal(false);
      setCurrentPassword('');
      setNewPassword('');
      const toast = document.createElement('div');
      toast.className = 'toast toast-top toast-end z-[9999]';
      toast.innerHTML = `<div class="alert alert-success"><span>Password updated successfully.</span></div>`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || 'Failed to update password';
      alert(msg);
    }
  });

  return (
    <div className="flex items-center justify-between bg-base-100 p-4 rounded-xl shadow-sm border border-base-200 mb-6">
      <div className="flex items-center gap-3">
        <div className="avatar placeholder">
          <div className="bg-primary text-primary-content rounded-full w-10">
            <span className="text-xl">{user?.name?.charAt(0).toUpperCase()}</span>
          </div>
        </div>
        <div>
          <h3 className="font-bold">{user?.name}</h3>
          <span className="text-xs opacity-70 capitalize">{user?.role}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button 
          className="btn btn-sm btn-outline" 
          onClick={() => setShowModal(true)}
        >
          <Key size={14} /> Change Password
        </button>
        <button 
          className="btn btn-sm btn-ghost text-error" 
          onClick={onLogout}
        >
          <LogOut size={14} /> Lock
        </button>
      </div>

      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Change Password</h3>
            <div className="space-y-4">
              <div className="form-control">
                <label className="label"><span className="label-text font-bold">Current Password</span></label>
                <div className="relative">
                  <input 
                    type={showCurrentPassword ? "text" : "password"} 
                    className="input input-bordered w-full pr-10"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <button 
                    type="button"
                    className="absolute inset-y-0 right-3 flex items-center text-base-content/50 hover:text-base-content"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text font-bold">New Password</span></label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    className="input input-bordered w-full pr-10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button 
                    type="button"
                    className="absolute inset-y-0 right-3 flex items-center text-base-content/50"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={() => changePasswordMutation.mutate()}
                disabled={changePasswordMutation.isPending || !currentPassword || !newPassword}
              >
                {changePasswordMutation.isPending ? <span className="loading loading-spinner loading-sm"></span> : 'Save Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
