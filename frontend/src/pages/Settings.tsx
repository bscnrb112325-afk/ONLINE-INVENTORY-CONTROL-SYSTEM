import React, { useState, useEffect } from 'react';
import { User, Store, Bell, Palette, Save, Settings as SettingsIcon } from 'lucide-react';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('store');

  // Load saved preferences
  const [storeDetails, setStoreDetails] = useState(() =>
    JSON.parse(localStorage.getItem('storeDetails') || '{"name":"OICS","phone":"","address":"","enableOnline":true}')
  );
  const [notifications, setNotifications] = useState(() =>
    JSON.parse(localStorage.getItem('notifications') || '{"lowStock":true,"newOrders":true,"ai":true}')
  );
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system');
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('fontSize') || 'normal');
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('fontFamily') || 'sans');

  // Apply theme when changed
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
      root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
    } else {
      root.setAttribute('data-theme', theme);
      root.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  // Apply font family when changed
  useEffect(() => {
    const root = document.documentElement;
    if (['sans', 'serif', 'mono'].includes(fontFamily)) {
      root.style.fontFamily = '';
      root.classList.remove('font-sans', 'font-serif', 'font-mono');
      root.classList.add(`font-${fontFamily}`);
    } else {
      root.classList.remove('font-sans', 'font-serif', 'font-mono');
      root.style.fontFamily = fontFamily;
    }
  }, [fontFamily]);

  // Apply font size when changed
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = fontSize === 'small' ? '14px' : fontSize === 'large' ? '18px' : '16px';
  }, [fontSize]);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const handleSaveStore = () => {
    localStorage.setItem('storeDetails', JSON.stringify(storeDetails));
    alert('Store details saved!');
  };

  const handleSaveNotifications = () => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
    alert('Notification preferences saved!');
  };

  const tabs = [
    { id: 'store',         label: 'Store Details',   icon: <Store size={18} /> },
    { id: 'appearance',    label: 'Appearance',      icon: <Palette size={18} /> },
    { id: 'notifications', label: 'Notifications',   icon: <Bell size={18} /> },
  ];

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <SettingsIcon size={28} className="text-primary" />
        <div>
          <h2 className="text-3xl font-extrabold text-base-content tracking-tight">Settings</h2>
          <p className="text-base-content/60 mt-0.5">Manage store configuration and system preferences.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Tab Navigation */}
        <div className="w-full md:w-56 shrink-0 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-content shadow-md'
                  : 'text-base-content/70 hover:bg-base-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-base-100 border border-base-200 rounded-2xl shadow-sm overflow-hidden">

          {/* ── STORE DETAILS ─────────────────────────────────────────── */}
          {activeTab === 'store' && (
            <div className="p-8 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-base-content">Store Details</h3>
                <p className="text-sm text-base-content/60 mt-1">Configure your store and POS information.</p>
              </div>
              <div className="divider" />

              <div className="space-y-5">
                <div className="form-control">
                  <label className="label"><span className="label-text font-semibold">Store Name</span></label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={storeDetails.name}
                    onChange={e => setStoreDetails({ ...storeDetails, name: e.target.value })}
                  />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text font-semibold">Contact Phone Number</span></label>
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="+254700000000"
                    value={storeDetails.phone}
                    onChange={e => setStoreDetails({ ...storeDetails, phone: e.target.value })}
                  />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text font-semibold">Store Address</span></label>
                  <textarea
                    className="textarea textarea-bordered h-24"
                    placeholder="Enter full physical address"
                    value={storeDetails.address}
                    onChange={e => setStoreDetails({ ...storeDetails, address: e.target.value })}
                  />
                </div>
                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-4">
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={storeDetails.enableOnline}
                      onChange={e => setStoreDetails({ ...storeDetails, enableOnline: e.target.checked })}
                    />
                    <span className="label-text font-medium">Enable Online Storefront (ZuriShop)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button className="btn btn-primary gap-2" onClick={handleSaveStore}>
                  <Save size={16} /> Save Changes
                </button>
              </div>
            </div>
          )}

          {/* ── APPEARANCE ─────────────────────────────────────────────── */}
          {activeTab === 'appearance' && (
            <div className="p-8 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-base-content">Appearance</h3>
                <p className="text-sm text-base-content/60 mt-1">Customize the look and feel of your dashboard.</p>
              </div>
              <div className="divider" />

              {/* Theme */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">Theme Preference</h4>
                <div className="flex items-center justify-between bg-base-200/50 p-4 rounded-xl border border-base-200">
                  <div>
                    <span className="font-semibold text-sm block">Current Theme</span>
                    <span className="text-xs text-base-content/60 capitalize">
                      {theme === 'system' ? 'Auto (System Default)' : theme}
                    </span>
                  </div>
                  <details className="dropdown dropdown-end">
                    <summary className="btn m-1 capitalize">
                      {theme === 'system' ? 'Select Theme' : theme}
                      <svg width="12px" height="12px" className="h-2 w-2 fill-current opacity-60 inline-block ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048">
                        <path d="M1799 349l242 241-1017 1017L7 590l242-241 775 775 775-775z" />
                      </svg>
                    </summary>
                    <ul className="dropdown-content bg-base-100 border border-base-200 rounded-box z-[1] w-64 p-2 shadow-2xl h-80 overflow-y-auto">
                      {['system','light','dark','cupcake','bumblebee','emerald','corporate','synthwave','retro','cyberpunk','valentine','halloween','garden','forest','aqua','lofi','pastel','fantasy','wireframe','black','luxury','dracula','cmyk','autumn','business','acid','lemonade','night','coffee','winter','dim','nord','sunset'].map(t => (
                        <li key={t}>
                          <button
                            className={`flex justify-between items-center w-full px-4 py-3 hover:bg-base-200 transition-colors rounded-lg ${theme === t ? 'bg-primary/10 text-primary font-bold' : ''}`}
                            onClick={() => { handleThemeChange(t); (document.activeElement as HTMLElement)?.blur(); }}
                            data-theme={t === 'system' ? 'light' : t}
                          >
                            <span className="capitalize">{t}</span>
                            <div className="flex gap-1">
                              <span className="bg-primary w-2.5 h-4 rounded-sm shadow-sm" />
                              <span className="bg-secondary w-2.5 h-4 rounded-sm shadow-sm" />
                              <span className="bg-accent w-2.5 h-4 rounded-sm shadow-sm" />
                              <span className="bg-neutral w-2.5 h-4 rounded-sm shadow-sm" />
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              </div>

              {/* Typography */}
              <div className="space-y-4 pt-6 border-t border-base-200">
                <h4 className="font-semibold text-sm">Typography</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-control">
                    <label className="label"><span className="label-text font-semibold">Font Family</span></label>
                    <select className="select select-bordered w-full" value={fontFamily}
                      onChange={e => { setFontFamily(e.target.value); localStorage.setItem('fontFamily', e.target.value); }}>
                      <optgroup label="System">
                        <option value="sans">System Default (Sans-Serif)</option>
                        <option value="serif">System Serif</option>
                        <option value="mono">System Monospace</option>
                      </optgroup>
                      <optgroup label="Web Safe">
                        <option value="Arial, sans-serif">Arial</option>
                        <option value="Helvetica, sans-serif">Helvetica</option>
                        <option value="'Times New Roman', serif">Times New Roman</option>
                        <option value="Georgia, serif">Georgia</option>
                        <option value="Verdana, sans-serif">Verdana</option>
                        <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                      </optgroup>
                    </select>
                  </div>
                  <div className="form-control">
                    <label className="label"><span className="label-text font-semibold">UI Scale / Font Size</span></label>
                    <select className="select select-bordered w-full" value={fontSize}
                      onChange={e => { setFontSize(e.target.value); localStorage.setItem('fontSize', e.target.value); }}>
                      <option value="small">Small (Compact)</option>
                      <option value="normal">Normal (Default)</option>
                      <option value="large">Large (Accessible)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── NOTIFICATIONS ──────────────────────────────────────────── */}
          {activeTab === 'notifications' && (
            <div className="p-8 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-base-content">Notification Preferences</h3>
                <p className="text-sm text-base-content/60 mt-1">Choose which alerts you want to receive.</p>
              </div>
              <div className="divider" />

              <div className="space-y-4">
                {[
                  { key: 'lowStock',  title: 'Low Stock Alerts',                  desc: 'Get notified when items drop below their reorder threshold.' },
                  { key: 'newOrders', title: 'New Orders (ZuriShop)',              desc: 'Receive an alert when a customer places an order online.' },
                  { key: 'ai',        title: 'AI Procurement Recommendations',    desc: 'Daily digest of stock forecasting and price adjustments.' },
                ].map(({ key, title, desc }) => (
                  <div key={key} className="flex items-center justify-between p-4 border border-base-200 rounded-xl">
                    <div>
                      <h4 className="font-bold text-sm">{title}</h4>
                      <p className="text-xs text-base-content/60 mt-0.5">{desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={notifications[key]}
                      onChange={e => setNotifications({ ...notifications, [key]: e.target.checked })}
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4">
                <button className="btn btn-primary gap-2" onClick={handleSaveNotifications}>
                  <Save size={18} /> Save Preferences
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Settings;
