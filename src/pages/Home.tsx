import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { dbService, Sighting } from '../lib/db';
import { storageService } from '../lib/storage';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Camera, Upload, Search, Leaf } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

export function Home() {
  const { profile } = useAuth();
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState<string>('');
  const [availableSpecies, setAvailableSpecies] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [timeFilter, setTimeFilter] = useState<string>('all');

  const loadSightings = async (isLoadMore = false) => {
    if (!profile) return;
    try {
      const { sightings: newSightings, lastDoc: newLastDoc } = await dbService.getSightings(
        profile.uid,
        isLoadMore ? lastDoc : undefined
      );
      
      if (isLoadMore) {
        setSightings(prev => [...prev, ...newSightings]);
      } else {
        setSightings(newSightings);
        
        // Extract unique species for the filter
        const uniqueSpecies = Array.from(new Set(newSightings.map(s => s.species.commonName))).filter(Boolean);
        setAvailableSpecies(uniqueSpecies.sort());
      }
      
      setLastDoc(newLastDoc);
      setHasMore(newSightings.length === 20);

      // Load photo URLs
      newSightings.forEach(s => {
        if (s.photos.length > 0 && !photoUrls[s.id]) {
          storageService.getPhotoUrl(s.photos[0].storagePath).then(url => {
            setPhotoUrls(prev => ({ ...prev, [s.id]: url }));
          }).catch(console.error);
        }
      });
    } catch (error) {
      console.error("Error loading sightings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSightings();
  }, [profile]);

  const filteredSightings = sightings.filter(s => {
    const matchesSearch = s.species.commonName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpecies = speciesFilter ? s.species.commonName === speciesFilter : true;
    
    let matchesDate = true;
    if (timeFilter !== 'all') {
      const capturedAt = s.capturedAt?.toDate?.() || new Date(s.capturedAt);
      const now = new Date();
      let fromDate = new Date();
      
      switch (timeFilter) {
        case 'week':
          fromDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          fromDate.setMonth(now.getMonth() - 1);
          break;
        case 'halfyear':
          fromDate.setMonth(now.getMonth() - 6);
          break;
        case 'year':
          fromDate.setFullYear(now.getFullYear() - 1);
          break;
        case '5years':
          fromDate.setFullYear(now.getFullYear() - 5);
          break;
      }
      
      matchesDate = capturedAt >= fromDate;
    }

    return matchesSearch && matchesSpecies && matchesDate;
  });

  const getRarityColor = (label: string) => {
    switch (label) {
      case 'velmi vzácné': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'vzácné': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'časté': return 'bg-green-100 text-green-800 border-green-200';
      case 'velmi časté': return 'bg-stone-100 text-stone-800 border-stone-200';
      default: return 'bg-stone-100 text-stone-600 border-stone-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-stone-800">Moje nálezy</h2>
          <p className="text-stone-500">Zaznamenáno {sightings.length} hub</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link
            to="/add"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-stone-800 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-stone-700 transition-colors"
          >
            <Camera size={18} />
            Nový
          </Link>
          <Link
            to="/import"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-stone-200 text-stone-700 px-4 py-2.5 rounded-xl font-medium hover:bg-stone-50 transition-colors"
          >
            <Upload size={18} />
            Import
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input
              type="text"
              placeholder="Hledat podle druhu nebo poznámky..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-800/20 focus:border-stone-800 transition-all"
            />
          </div>
          <select
            value={speciesFilter}
            onChange={(e) => setSpeciesFilter(e.target.value)}
            className="px-4 py-3 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-800/20 focus:border-stone-800 transition-all text-stone-700"
          >
            <option value="">Všechny druhy</option>
            {availableSpecies.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-800/20 focus:border-stone-800 transition-all text-stone-700"
          >
            <option value="all">Za celou dobu</option>
            <option value="week">Za poslední týden</option>
            <option value="month">Za poslední měsíc</option>
            <option value="halfyear">Za poslední půl rok</option>
            <option value="year">Za poslední rok</option>
            <option value="5years">Za posledních 5 let</option>
          </select>
        </div>
      </div>

      {loading && sightings.length === 0 ? (
        <div className="text-center py-12 text-stone-500">Načítání nálezů...</div>
      ) : filteredSightings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-200 border-dashed">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Leaf size={24} className="text-stone-400" />
          </div>
          <h3 className="text-lg font-medium text-stone-800 mb-1">Zatím žádné nálezy</h3>
          <p className="text-stone-500 mb-6">Vyrazte do lesa a zaznamenejte svůj první úlovek!</p>
          <Link
            to="/add"
            className="inline-flex items-center gap-2 bg-stone-800 text-white px-6 py-3 rounded-xl font-medium hover:bg-stone-700 transition-colors"
          >
            <Camera size={20} />
            Přidat první nález
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredSightings.map((sighting) => (
            <Link
              key={sighting.id}
              to={`/sighting/${sighting.id}`}
              className="bg-white rounded-2xl overflow-hidden border border-stone-200 hover:shadow-md transition-shadow group flex items-center p-3 gap-4"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-stone-100 rounded-xl relative overflow-hidden shrink-0">
                {photoUrls[sighting.id] ? (
                  <img
                    src={photoUrls[sighting.id]}
                    alt={sighting.species.commonName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300">
                    <Camera size={24} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 py-1">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h3 className="font-serif font-bold text-lg text-stone-800 truncate">
                    {sighting.species.commonName || 'Neurčeno'}
                  </h3>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getRarityColor(sighting.rarity.label)}`}>
                    {sighting.rarity.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    {format(sighting.capturedAt.toDate(), 'd. MMMM yyyy', { locale: cs })}
                  </div>
                  {sighting.location.lat && (
                    <div className="flex items-center gap-1">
                      <MapPin size={14} />
                      {sighting.location.privacy === 'exact' ? 'Přesná poloha' : 'Oblast'}
                    </div>
                  )}
                </div>
                {sighting.notes && (
                  <p className="text-sm text-stone-500 mt-1 truncate">
                    {sighting.notes}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="text-center pt-4">
          <button
            onClick={() => loadSightings(true)}
            className="px-6 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Načíst další
          </button>
        </div>
      )}
    </div>
  );
}
