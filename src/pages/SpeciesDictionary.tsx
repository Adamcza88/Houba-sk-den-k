import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { dbService, Species } from '../lib/db';
import { Book, Plus, Search, Trash2, Edit2, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export function SpeciesDictionary() {
  const { profile } = useAuth();
  const [species, setSpecies] = useState<Species[]>([]);
  const [sightingCounts, setSightingCounts] = useState<Record<string, number>>({});
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isAdding, setIsAdding] = useState(false);
  const [newCommon, setNewCommon] = useState('');
  const [newScientific, setNewScientific] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCommon, setEditCommon] = useState('');
  const [editScientific, setEditScientific] = useState('');

  useEffect(() => {
    if (profile) {
      loadSpecies();
    }
  }, [profile]);

  const loadSpecies = async () => {
    if (!profile) return;
    try {
      const data = await dbService.getSpecies(profile.uid);
      setSpecies(data);
      
      const sightings = await dbService.getAllSightingsBasic(profile.uid);
      const counts: Record<string, number> = {};
      const items: Record<string, number> = {};
      sightings.forEach(s => {
        const norm = s.species.normalized;
        counts[norm] = (counts[norm] || 0) + 1;
        items[norm] = (items[norm] || 0) + (s.count || 1); // default to 1 if count is null
      });
      setSightingCounts(counts);
      setItemCounts(items);
    } catch (err) {
      toast.error('Chyba při načítání slovníku');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newCommon.trim()) return;

    try {
      const added = await dbService.addSpecies(profile.uid, {
        commonName: newCommon.trim(),
        scientificName: newScientific.trim() || null,
        aliases: []
      });
      setSpecies([...species, added].sort((a, b) => a.normalized.localeCompare(b.normalized)));
      setNewCommon('');
      setNewScientific('');
      setIsAdding(false);
      toast.success('Druh přidán');
    } catch (err) {
      toast.error('Chyba při přidávání');
    }
  };

  const handleEditStart = (s: Species) => {
    setEditingId(s.id);
    setEditCommon(s.commonName);
    setEditScientific(s.scientificName || '');
  };

  const handleEditSave = async (id: string) => {
    if (!profile || !editCommon.trim()) return;
    try {
      await dbService.updateSpecies(profile.uid, id, {
        commonName: editCommon.trim(),
        scientificName: editScientific.trim() || null
      });
      setSpecies(species.map(s => s.id === id ? { ...s, commonName: editCommon.trim(), scientificName: editScientific.trim() || null } : s));
      setEditingId(null);
      toast.success('Druh upraven');
    } catch (err) {
      toast.error('Chyba při úpravě');
    }
  };

  const handleDelete = async (id: string) => {
    if (!profile) return;
    if (!window.confirm('Opravdu chcete smazat tento druh ze slovníku?')) return;
    try {
      await dbService.deleteSpecies(profile.uid, id);
      setSpecies(species.filter(s => s.id !== id));
      toast.success('Druh smazán');
    } catch (err) {
      toast.error('Chyba při mazání');
    }
  };

  const filtered = species.filter(s => 
    s.commonName.toLowerCase().includes(search.toLowerCase()) ||
    s.scientificName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif font-bold text-stone-800">Můj slovník druhů</h2>
          <p className="text-stone-500">Spravujte názvy hub pro rychlejší zadávání</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-stone-800 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-stone-700 transition-colors"
        >
          <Plus size={18} />
          Přidat druh
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Český název *</label>
            <input
              type="text"
              required
              value={newCommon}
              onChange={e => setNewCommon(e.target.value)}
              placeholder="Např. Hřib smrkový"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-800/20"
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Latinský název</label>
            <input
              type="text"
              value={newScientific}
              onChange={e => setNewScientific(e.target.value)}
              placeholder="Boletus edulis"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-800/20"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2.5 text-stone-500 hover:bg-stone-100 rounded-xl font-medium">Zrušit</button>
            <button type="submit" className="px-6 py-2.5 bg-stone-800 text-white rounded-xl font-medium">Uložit</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-4 border-b border-stone-100 bg-stone-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input
              type="text"
              placeholder="Hledat ve slovníku..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-800/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-stone-500">Načítání...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Book size={48} className="text-stone-300 mb-4" />
            <p className="text-stone-500 font-medium">Slovník je prázdný nebo nic nebylo nalezeno.</p>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {filtered.map(s => (
              <li key={s.id} className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center hover:bg-stone-50 transition-colors gap-4">
                {editingId === s.id ? (
                  <div className="flex-1 flex flex-col sm:flex-row gap-2 w-full">
                    <input
                      type="text"
                      value={editCommon}
                      onChange={e => setEditCommon(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-800/20 text-sm"
                      placeholder="Český název"
                    />
                    <input
                      type="text"
                      value={editScientific}
                      onChange={e => setEditScientific(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-800/20 text-sm"
                      placeholder="Latinský název"
                    />
                  </div>
                ) : (
                  <div>
                    <div className="font-medium text-stone-800 flex items-center gap-2">
                      {s.commonName}
                      {sightingCounts[s.normalized] > 0 && (
                        <span className="px-2 py-0.5 bg-stone-100 text-stone-500 rounded-full text-xs font-medium">
                          {sightingCounts[s.normalized]} nálezů ({itemCounts[s.normalized]} kusů)
                        </span>
                      )}
                    </div>
                    {s.scientificName && <div className="text-sm text-stone-500 italic">{s.scientificName}</div>}
                  </div>
                )}
                
                <div className="flex gap-2 self-end sm:self-auto">
                  {editingId === s.id ? (
                    <>
                      <button onClick={() => handleEditSave(s.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><Check size={18} /></button>
                      <button onClick={() => setEditingId(null)} className="p-2 text-stone-400 hover:bg-stone-100 rounded-lg"><X size={18} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleEditStart(s)} className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(s.id)} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
