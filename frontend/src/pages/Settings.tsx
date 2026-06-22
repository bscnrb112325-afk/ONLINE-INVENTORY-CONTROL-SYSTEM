import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSettings } from '../context/SettingsContext';
import { api } from '../api';
import { Save, Building2, Palette, Upload } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'company' | 'appearance'>('company');

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [currency, setCurrency] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [theme, setTheme] = useState('');
  const [font, setFont] = useState('');

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

  return (
    <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
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
    </div>
  );
};

export default Settings;
