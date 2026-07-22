
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useSettings } from '../context/SettingsContext';
import { api } from '../api';
import { Save, Building2, Palette, Upload, Users, Eye, EyeOff, Lock, MessageSquare, CheckCircle, XCircle, Clock, Send } from 'lucide-react';
import { UserHeader } from '../components/UserHeader';

const availableThemes = [
  "light", "dark", "cupcake", "corporate", "synthwave", "retro", 
  "cyberpunk", "valentine", "halloween", "garden", "forest", "aqua", 
  "lofi", "pastel", "fantasy", "wireframe", "black", "luxury", 
  "dracula", "cmyk", "autumn", "business", "acid", "lemonade", 
  "night", "coffee", "winter", "dim", "nord", "sunset"
];

const availableFonts = [
  "Inter", "Roboto", "Outfit", "Playfair Display",
  "Open Sans", "Lato", "Montserrat", "Poppins",
  "Nunito", "Raleway", "Ubuntu", "Merriweather",
  "Noto Sans", "Quicksand", "Oswald"
];

const Settings = () => {
  const { settings, refreshSettings } = useSettings();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'company' | 'appearance' | 'admin'>('company');

  // Lock Screen
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const [userName, setUserName] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    setIsUnlocking(true);
    try {
      const res = await api.post('/users/verify-pos', {
        name: userName,
        password: unlockPassword
      });
      if (res.data.success) {
        const userRole = res.data.user.role;
        if (userRole === 'admin' || userRole === 'manager') {
          setIsUnlocked(true);
          setLoggedInUser(res.data.user);
        } else {
          setUnlockError('Access Denied: Only Admin and Manager can access Settings.');
        }
      }
    } catch (err: any) {
      setUnlockError('Incorrect username or password.');
    } finally {
      setIsUnlocking(false);
    }
  };

  // Fetch users for admin panel
  const { data: users, isLoading: isUsersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
    enabled: activeTab === 'admin',
  });

  const createUserMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/users', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreateModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserModule('dashboard');
      const toast = document.createElement('div');
      toast.className = 'toast toast-top toast-end z-[9999]';
      toast.innerHTML = `<div class="alert alert-success"><span>User created successfully.</span></div>`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || 'Failed to create user';
      alert(msg);
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, newPassword }: { id: string, newPassword: string }) => {
      await api.post(`/users/${id}/reset-password`, { newPassword });
    },
    onSuccess: () => {
      setResetPasswordUserId(null);
      setNewResetPassword('');
      const toast = document.createElement('div');
      toast.className = 'toast toast-top toast-end z-[9999]';
      toast.innerHTML = `<div class="alert alert-success"><span>Password reset successfully.</span></div>`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || 'Failed to reset password';
      alert(msg);
    }
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string, role: string }) => {
      await api.patch(`/users/${id}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      const toast = document.createElement('div');
      toast.className = 'toast toast-top toast-end z-[9999]';
      toast.innerHTML = `<div class="alert alert-success"><span>User role updated successfully.</span></div>`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
  });

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [currency, setCurrency] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [theme, setTheme] = useState('');
  const [font, setFont] = useState('');

  // Create User State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [newUserModule, setNewUserModule] = useState('dashboard');
  const [showPassword, setShowPassword] = useState(false);
  
  // Reset Password State
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);



  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName || '');
      setLogoUrl(settings.logoUrl || '');
      setCurrency(settings.currency || '');
      setTaxRate(settings.taxRate || '0');
      setTheme(settings.theme || 'light');
      setFont(settings.font || 'Inter');
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.put('/settings', payload);
    },
    onSuccess: () => {
      // Force refresh of settings context
      refreshSettings();
      queryClient.invalidateQueries({ queryKey: ['globalSettings'] });
      
      const toast = document.createElement('div');
      toast.className = 'toast toast-top toast-end z-[9999]';
      toast.innerHTML = `<div class="alert alert-success"><span>Settings updated successfully.</span></div>`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate({
      companyName,
      logoUrl,
      currency,
      taxRate: parseFloat(taxRate) || 0,
      theme,
      font
    });
  };

  const handleThemePreview = (previewTheme: string) => {
    setTheme(previewTheme);
    document.documentElement.setAttribute('data-theme', previewTheme);
  };

  const handleFontPreview = (previewFont: string) => {
    setFont(previewFont);
    document.body.style.fontFamily = `"${previewFont}", sans-serif`;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-[80vh] py-8 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 px-4">
        <div className="card w-full max-w-sm bg-base-100 shadow-2xl border border-base-200">
          <div className="card-body">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Lock size={32} />
              </div>
            </div>
            <h2 className="card-title text-center block text-2xl mb-1">Settings Locked</h2>
            <p className="text-center text-base-content/60 text-sm mb-6">To login enter username and password.</p>
            
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="form-control">
                <label className="label"><span className="label-text font-bold">Username</span></label>
                <input 
                  type="text" 
                  className="input input-bordered w-full" 
                  placeholder="e.g. Admin" 
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text font-bold">Password</span></label>
                <div className="relative">
                  <input 
                    type={showUnlockPassword ? "text" : "password"} 
                    className="input input-bordered w-full pr-10" 
                    placeholder="••••••••" 
                    value={unlockPassword}
                    onChange={(e) => setUnlockPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button"
                    className="absolute inset-y-0 right-3 flex items-center text-base-content/50 hover:text-base-content"
                    onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                  >
                    {showUnlockPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              
              {unlockError && (
                <div className="alert alert-error text-sm p-3 rounded-lg">
                  {unlockError}
                </div>
              )}
              
              <button 
                type="submit" 
                className="btn btn-primary w-full mt-4"
                disabled={isUnlocking || !userName || !unlockPassword}
              >
                {isUnlocking ? <span className="loading loading-spinner loading-sm"></span> : 'Unlock Settings'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
      {loggedInUser && (
        <UserHeader 
          user={loggedInUser} 
          onLogout={() => {
            setIsUnlocked(false);
            setLoggedInUser(null);
            setUnlockPassword('');
          }} 
        />
      )}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-base-content flex items-center gap-2">
            ⚙️ Settings
          </h2>
          <p className="text-base-content/70 mt-1">Configure global application preferences.</p>
        </div>
      </div>

      <div className="tabs tabs-boxed mb-6 bg-base-200/50 p-1 inline-flex w-full md:w-auto">
        <a 
          className={`tab px-6 transition-all ${activeTab === 'company' ? 'tab-active shadow-sm font-bold bg-base-100' : ''}`}
          onClick={() => setActiveTab('company')}
        >
          <Building2 size={16} className="mr-2" />
          Company Details
        </a> 
        <a 
          className={`tab px-6 transition-all ${activeTab === 'appearance' ? 'tab-active shadow-sm font-bold bg-base-100' : ''}`}
          onClick={() => setActiveTab('appearance')}
        >
          <Palette size={16} className="mr-2" />
          Appearance
        </a> 
        <a 
          className={`tab px-6 transition-all ${activeTab === 'admin' ? 'tab-active shadow-sm font-bold bg-base-100' : ''}`}
          onClick={() => setActiveTab('admin')}
        >
          <Users size={16} className="mr-2" />
          Admin & Users
        </a>

      </div>

      <form onSubmit={handleSave} className="bg-base-100 shadow-md rounded-2xl border border-base-200 overflow-hidden">
        
        {activeTab === 'company' && (
          <div className="p-6 space-y-6 animate-in slide-in-from-bottom-2 duration-300">
            <h3 className="font-bold text-xl border-b border-base-200 pb-2">Business Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-control">
                <label className="label font-semibold">Company Name</label>
                <input 
                  type="text" 
                  className="input input-bordered w-full" 
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. ZuriShop Inc."
                  required
                />
              </div>

              <div className="form-control">
                <label className="label font-semibold flex justify-between">
                  <span>Logo URL or Upload</span>
                </label>
                <div className="flex gap-4">
                  <div className="flex-1 flex flex-col gap-3">
                    <input 
                      type="text" 
                      className="input input-bordered w-full" 
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="Paste image URL here..."
                    />
                    <div className="divider my-0 text-xs opacity-50">OR</div>
                    <div className="relative">
                      <input 
                        type="file" 
                        accept="image/*"
                        className="file-input file-input-bordered file-input-primary w-full" 
                        onChange={handleImageUpload}
                      />
                    </div>
                  </div>
                  {logoUrl && (
                    <div className="avatar">
                      <div className="w-24 h-24 rounded-lg bg-base-200 border border-base-300 p-2">
                        <img src={logoUrl} alt="Logo preview" className="object-contain" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-control">
                <label className="label font-semibold">Currency Code/Symbol</label>
                <input 
                  type="text" 
                  className="input input-bordered w-full" 
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="e.g. KSh or $"
                  required
                />
              </div>

              <div className="form-control">
                <label className="label font-semibold">Default Tax Rate (%)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="input input-bordered w-full" 
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  placeholder="e.g. 16.00"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="p-6 space-y-8 animate-in slide-in-from-bottom-2 duration-300">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Fonts */}
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-bold text-lg">Typography</span>
                </label>
                <select 
                  className="select select-bordered w-full bg-base-200"
                  value={font}
                  onChange={(e) => handleFontPreview(e.target.value)}
                  style={{ fontFamily: `"${font}", sans-serif` }}
                >
                  {availableFonts.map(f => (
                    <option key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>
                      {f}
                    </option>
                  ))}
                </select>
                <label className="label">
                  <span className="label-text-alt opacity-70">Changes the global font family</span>
                </label>
              </div>

              {/* Themes */}
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-bold text-lg">UI Theme</span>
                  <span className="badge badge-primary">{theme}</span>
                </label>
                <select 
                  className="select select-bordered w-full capitalize bg-base-200"
                  value={theme}
                  onChange={(e) => handleThemePreview(e.target.value)}
                >
                  {availableThemes.map(t => (
                    <option key={t} value={t} className="capitalize">
                      {t}
                    </option>
                  ))}
                </select>
                <label className="label">
                  <span className="label-text-alt opacity-70">Changes the global color palette</span>
                </label>
              </div>
            </div>
            
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="p-6 space-y-8 animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center border-b border-base-200 pb-2">
              <h3 className="font-bold text-xl">User Management</h3>
              <button 
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                + New Account
              </button>
            </div>
            
            <div className="overflow-x-auto border border-base-200 rounded-xl">
              <table className="table w-full">
                <thead className="bg-base-200 text-base-content">
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isUsersLoading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8">
                        <span className="loading loading-spinner loading-md"></span>
                      </td>
                    </tr>
                  ) : users?.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-base-content/60">No users found</td>
                    </tr>
                  ) : (
                    users?.map((u: any) => (
                      <tr key={u.id} className="hover">
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="avatar">
                              <div className="mask mask-squircle w-10 h-10">
                                {u.avatarDriveId ? (
                                  <img src={u.avatarDriveId} alt="Avatar" />
                                ) : (
                                  <div className="bg-primary text-primary-content grid place-items-center w-full h-full font-bold">
                                    {u.name?.charAt(0)}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="font-bold">{u.name}</div>
                              <div className="text-xs opacity-50">ID: {u.id.substring(0,8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td>{u.email}</td>
                        <td>
                          <span className={`badge badge-sm ${u.role === 'admin' ? 'badge-primary' : u.role === 'manager' ? 'badge-secondary' : 'badge-ghost'}`}>
                            {u.role || 'user'}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <select 
                              className="select select-bordered select-sm w-32"
                              value={u.role || 'user'}
                              onChange={(e) => {
                                updateUserRoleMutation.mutate({ id: u.id, role: e.target.value });
                              }}
                              disabled={updateUserRoleMutation.isPending}
                            >
                              <option value="cashier">Cashier</option>
                              <option value="manager">Manager</option>
                              <option value="admin">Admin</option>
                              <option value="supplier">Supplier</option>
                            </select>
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => setResetPasswordUserId(u.id)}
                            >
                              Reset Pass
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-base-200/50 p-4 border-t border-base-200 flex justify-end">
          <button 
            type="submit" 
            className="btn btn-primary px-8 shadow-lg shadow-primary/20"
            disabled={updateSettingsMutation.isPending}
          >
            {updateSettingsMutation.isPending ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <Save size={18} className="mr-2" />
            )}
            Save Configuration
          </button>
        </div>
      </form>



      {/* Create User Modal */}
      {showCreateModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Create New Account</h3>
            <div className="space-y-4">
              <div className="form-control">
                <label className="label font-semibold">Full Name</label>
                <input 
                  type="text" 
                  className="input input-bordered" 
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="form-control">
                <label className="label font-semibold">Email Address</label>
                <input 
                  type="email" 
                  className="input input-bordered" 
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. john@example.com"
                />
              </div>
              <div className="form-control">
                <label className="label font-semibold">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    className="input input-bordered w-full pr-10" 
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Strong password"
                  />
                  <button 
                    type="button"
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-base-content/50 hover:text-base-content"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="form-control">
                <label className="label font-semibold">Role</label>
                <select 
                  className="select select-bordered"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                >
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="supplier">Supplier</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label font-semibold">Primary Module</label>
                <select 
                  className="select select-bordered"
                  value={newUserModule}
                  onChange={(e) => setNewUserModule(e.target.value)}
                >
                  <option value="dashboard">Dashboard</option>
                  <option value="inventory">Inventory</option>
                  <option value="point_of_sale">Point of Sale</option>
                  <option value="orders_pipeline">Orders Pipeline</option>
                  <option value="manager_approvals">Manager Approvals</option>
                  <option value="supplier_portal">Supplier Portal</option>
                  <option value="settings">Settings</option>
                </select>
              </div>
            </div>
            <div className="modal-action">
              <button 
                type="button"
                className="btn" 
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn btn-primary" 
                onClick={() => {
                  createUserMutation.mutate({
                    name: newUserName,
                    email: newUserEmail,
                    password: newUserPassword,
                    role: newUserRole,
                    module: newUserModule
                  });
                }}
                disabled={createUserMutation.isPending || !newUserName || !newUserEmail || !newUserPassword}
              >
                {createUserMutation.isPending ? <span className="loading loading-spinner loading-sm"></span> : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordUserId && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Reset Password</h3>
            <div className="space-y-4">
              <div className="form-control">
                <label className="label font-semibold">New Password</label>
                <div className="relative">
                  <input 
                    type={showResetPassword ? "text" : "password"} 
                    className="input input-bordered w-full pr-10" 
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    placeholder="New strong password"
                  />
                  <button 
                    type="button"
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-base-content/50 hover:text-base-content"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                  >
                    {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-action">
              <button 
                type="button"
                className="btn" 
                onClick={() => setResetPasswordUserId(null)}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn btn-warning" 
                onClick={() => {
                  resetPasswordMutation.mutate({
                    id: resetPasswordUserId,
                    newPassword: newResetPassword
                  });
                }}
                disabled={resetPasswordMutation.isPending || !newResetPassword}
              >
                {resetPasswordMutation.isPending ? <span className="loading loading-spinner loading-sm"></span> : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
