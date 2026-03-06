import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { dbService, Sighting } from '../lib/db';
import { storageService } from '../lib/storage';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Camera, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import toast from 'react-hot-toast';

export function Trash() {
  const { profile } = useAuth();
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const loadDeletedSightings = async () => {
    if (!profile) return;
    try {
      const deletedSightings = await dbService.getDeletedSightings(profile.uid);
      setSightings(deletedSightings);

      // Load photo URLs
      deletedSightings.forEach(s => {
        if (s.photos.length > 0 && !photoUrls[s.id]) {
          storageService.getPhotoUrl(s.photos[0].storagePath).then(url => {
            setPhotoUrls(prev => ({ ...prev, [s.id]: url }));
          }).catch(console.error);
        }
      });
    } catch (error) {
      console.error("Error loading deleted sightings:", error);
      toast.error('Chyba při načítání koše');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeletedSightings();
  }, [profile]);

  const handleRestore = async (id: string) => {
    if (!profile) return;
    try {
      await dbService.restoreSighting(profile.uid, id);
      toast.success('Nález obnoven');
      setSightings(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      toast.error('Chyba při obnově');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!profile) return;
    if (!window.confirm('Opravdu chcete tento nález trvale smazat? Tuto akci nelze vrátit zpět.')) return;
    try {
      await dbService.permanentDeleteSighting(profile.uid, id);
      toast.success('Nález trvale smazán');
      setSightings(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      toast.error('Chyba při mazání');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-stone-800">Koš</h2>
          <p className="text-stone-500">Smazané nálezy ({sightings.length})</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-stone-500">Načítání koše...</div>
      ) : sightings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-200 border-dashed">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 size={24} className="text-stone-400" />
          </div>
          <h3 className="text-lg font-medium text-stone-800 mb-1">Koš je prázdný</h3>
          <p className="text-stone-500 mb-6">Zatím jste nesmazali žádné nálezy.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sightings.map((sighting) => (
            <div
              key={sighting.id}
              className="bg-white rounded-2xl overflow-hidden border border-stone-200 hover:shadow-md transition-shadow group flex items-center p-3 gap-4"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-stone-100 rounded-xl relative overflow-hidden shrink-0 opacity-50">
                {photoUrls[sighting.id] ? (
                  <img
                    src={photoUrls[sighting.id]}
                    alt={sighting.species.commonName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300">
                    <Camera size={24} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 py-1">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h3 className="font-serif font-bold text-lg text-stone-800 truncate line-through">
                    {sighting.species.commonName || 'Neurčeno'}
                  </h3>
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
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <button
                  onClick={() => handleRestore(sighting.id)}
                  className="p-2 text-stone-500 hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors"
                  title="Obnovit"
                >
                  <RefreshCw size={20} />
                </button>
                <button
                  onClick={() => handlePermanentDelete(sighting.id)}
                  className="p-2 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  title="Trvale smazat"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
