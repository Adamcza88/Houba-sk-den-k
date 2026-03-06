import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Save, Shield, Map, Clock, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export function Settings() {
  const { profile, updateSettings } = useAuth();
  const [saving, setSaving] = useState(false);

  const [settings, setLocalSettings] = useState(profile?.settings || {
    locationPrivacyDefault: 'grid',
    gridSizeM: 1000,
    importNoGpsBehavior: 'pick_on_map',
    rarityWindowDays: 365,
    rarityGridSizeM: 1000,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(settings as any);
      toast.success('Nastavení uloženo');
    } catch (error) {
      toast.error('Chyba při ukládání');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif font-bold text-stone-800">Nastavení</h2>
          <p className="text-stone-500">Přizpůsobte si chování deníku a soukromí</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-stone-800 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-stone-700 transition-colors disabled:opacity-50"
        >
          <Save size={18} />
          Uložit
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
        
        {/* Trash Section */}
        <div className="p-6 border-b border-stone-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-stone-800">Koš</h3>
                <p className="text-sm text-stone-500">Správa smazaných nálezů</p>
              </div>
            </div>
            <Link
              to="/trash"
              className="px-4 py-2 bg-stone-100 text-stone-700 rounded-xl font-medium hover:bg-stone-200 transition-colors"
            >
              Otevřít koš
            </Link>
          </div>
        </div>
        
        {/* Privacy Section */}
        <div className="p-6 border-b border-stone-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Shield size={20} />
            </div>
            <h3 className="text-lg font-bold text-stone-800">Soukromí polohy</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Výchozí přesnost ukládání</label>
              <select
                value={settings.locationPrivacyDefault}
                onChange={(e) => setLocalSettings({ ...settings, locationPrivacyDefault: e.target.value as any })}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-800/20 focus:border-stone-800"
              >
                <option value="exact">Přesná poloha (GPS souřadnice)</option>
                <option value="grid">Oblast (Grid, např. 1x1 km)</option>
                <option value="hidden">Skrytá (neukládat polohu)</option>
              </select>
              <p className="text-xs text-stone-500 mt-2">
                Toto nastavení se použije pro nové nálezy. Vaše data jsou vždy soukromá, toto určuje pouze detail uložení.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Velikost oblasti (Grid Size)</label>
              <select
                value={settings.gridSizeM}
                onChange={(e) => setLocalSettings({ ...settings, gridSizeM: Number(e.target.value) })}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-800/20 focus:border-stone-800"
              >
                <option value={500}>500 metrů</option>
                <option value={1000}>1 kilometr</option>
                <option value={2000}>2 kilometry</option>
                <option value={5000}>5 kilometrů</option>
              </select>
            </div>
          </div>
        </div>

        {/* Import Section */}
        <div className="p-6 border-b border-stone-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <Map size={20} />
            </div>
            <h3 className="text-lg font-bold text-stone-800">Import z galerie</h3>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Když fotka nemá GPS</label>
            <select
              value={settings.importNoGpsBehavior}
              onChange={(e) => setLocalSettings({ ...settings, importNoGpsBehavior: e.target.value as any })}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-800/20 focus:border-stone-800"
            >
              <option value="pick_on_map">Vybrat na mapě (připravujeme)</option>
              <option value="leave_empty">Ponechat bez polohy</option>
            </select>
          </div>
        </div>

        {/* Rarity Section */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
              <Clock size={20} />
            </div>
            <h3 className="text-lg font-bold text-stone-800">Výpočet vzácnosti</h3>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Časové okno pro výpočet</label>
            <select
              value={settings.rarityWindowDays}
              onChange={(e) => setLocalSettings({ ...settings, rarityWindowDays: Number(e.target.value) })}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-800/20 focus:border-stone-800"
            >
              <option value={90}>Posledních 90 dní</option>
              <option value={180}>Poslední půlrok</option>
              <option value={365}>Poslední rok</option>
              <option value={9999}>Za celou dobu</option>
            </select>
            <p className="text-xs text-stone-500 mt-2">
              Vzácnost se počítá porovnáním s vašimi historickými nálezy ve stejné oblasti za toto období.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
