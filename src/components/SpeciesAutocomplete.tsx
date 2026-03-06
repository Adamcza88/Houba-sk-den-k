import { useState, useEffect } from 'react';
import { dbService, Species } from '../lib/db';
import { useAuth } from '../lib/auth';
import { Search } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (species: Species) => void;
}

export function SpeciesAutocomplete({ value, onChange, onSelect }: Props) {
  const { profile } = useAuth();
  const [speciesList, setSpeciesList] = useState<Species[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (profile) {
      dbService.getSpecies(profile.uid).then(setSpeciesList);
    }
  }, [profile]);

  const filtered = speciesList.filter(s => 
    s.commonName.toLowerCase().includes(value.toLowerCase()) ||
    s.scientificName?.toLowerCase().includes(value.toLowerCase()) ||
    s.aliases?.some(a => a.toLowerCase().includes(value.toLowerCase()))
  );

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder="Druh houby (např. Hřib smrkový)"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-800/20 focus:border-stone-800 transition-all"
        />
      </div>
      
      {isOpen && value && filtered.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-60 overflow-auto">
          {filtered.map(s => (
            <button
              key={s.id}
              className="w-full text-left px-4 py-3 hover:bg-stone-50 border-b border-stone-100 last:border-0"
              onClick={() => {
                onChange(s.commonName);
                onSelect(s);
                setIsOpen(false);
              }}
            >
              <div className="font-medium text-stone-800">{s.commonName}</div>
              {s.scientificName && <div className="text-xs text-stone-500 italic">{s.scientificName}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
