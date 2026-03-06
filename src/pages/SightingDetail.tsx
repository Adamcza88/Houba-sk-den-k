import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { dbService, Sighting } from '../lib/db';
import { storageService } from '../lib/storage';
import { normalizeSpecies, generateGridId } from '../lib/utils';
import { SpeciesAutocomplete } from '../components/SpeciesAutocomplete';
import { MapPin, Calendar, Clock, Tag, Trash2, Edit3, ChevronLeft, AlertTriangle, X, Check, Camera, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export function SightingDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [sighting, setSighting] = useState<Sighting | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editSpecies, setEditSpecies] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLon, setEditLon] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile && id) {
      dbService.getSighting(profile.uid, id).then(async (data) => {
        setSighting(data);
        if (data) {
          setEditSpecies(data.species.commonName);
          setEditNotes(data.notes || '');
          const dateObj = data.capturedAt.toDate();
          setEditDate(format(dateObj, 'yyyy-MM-dd'));
          setEditTime(format(dateObj, 'HH:mm'));
          setEditLat(data.location.lat ? data.location.lat.toString() : '');
          setEditLon(data.location.lon ? data.location.lon.toString() : '');
        }
        if (data && data.photos.length > 0) {
          const urls = await Promise.all(
            data.photos.map(p => storageService.getPhotoUrl(p.storagePath))
          );
          setPhotoUrls(urls);
        }
        setLoading(false);
      }).catch(err => {
        console.error(err);
        toast.error('Nepodařilo se načíst detail nálezu');
        setLoading(false);
      });
    }
  }, [profile, id]);

  const handleDelete = async () => {
    if (!profile || !id) return;
    try {
      await dbService.softDeleteSighting(profile.uid, id);
      toast.success('Nález smazán');
      navigate('/');
    } catch (err) {
      toast.error('Chyba při mazání');
    }
  };

  const handleSaveEdit = async () => {
    if (!profile || !sighting || !id) return;
    setSaving(true);
    try {
      const normalized = normalizeSpecies(editSpecies);
      
      const [year, month, day] = editDate.split('-').map(Number);
      const [hours, minutes] = editTime.split(':').map(Number);
      const newCapturedAt = new Date(year, month - 1, day, hours, minutes);
      
      const latParsed = editLat ? parseFloat(editLat) : null;
      const lonParsed = editLon ? parseFloat(editLon) : null;
      const latNum = Number.isNaN(latParsed) ? null : latParsed;
      const lonNum = Number.isNaN(lonParsed) ? null : lonParsed;
      
      const newGridId = (latNum !== null && lonNum !== null) 
        ? generateGridId(latNum, lonNum, profile.settings.gridSizeM || 1000) 
        : null;

      // Recompute rarity
      const rarity = await dbService.computeRarity(
        profile.uid,
        normalized,
        newGridId || sighting.location.gridId,
        profile.settings.rarityWindowDays,
        id
      );

      const updatedSighting = {
        ...sighting,
        notes: editNotes,
        capturedAt: Timestamp.fromDate(newCapturedAt),
        location: {
          ...sighting.location,
          lat: latNum,
          lon: lonNum,
          gridId: newGridId
        },
        species: {
          ...sighting.species,
          commonName: editSpecies || 'Neurčeno',
          normalized
        },
        rarity
      };

      await dbService.saveSighting(profile.uid, updatedSighting, id);
      
      setSighting(updatedSighting);
      setIsEditing(false);
      toast.success('Nález upraven');
    } catch (err) {
      console.error(err);
      toast.error('Chyba při ukládání úprav');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-stone-500">Načítání...</div>;
  if (!sighting) return <div className="p-8 text-center text-stone-500">Nález nenalezen</div>;

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
    <div className="max-w-3xl mx-auto space-y-6">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors font-medium"
      >
        <ChevronLeft size={20} />
        Zpět
      </button>

      <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-6 sm:p-8">
          {/* Header with Edit/Delete */}
          <div className="flex justify-between items-start gap-4 mb-6">
            <div className="flex-1">
              {isEditing ? (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-stone-700 mb-1">Druh</label>
                  <SpeciesAutocomplete
                    value={editSpecies}
                    onChange={setEditSpecies}
                    onSelect={(s) => setEditSpecies(s.commonName)}
                  />
                </div>
              ) : (
                <>
                  <h1 className="text-3xl font-serif font-bold text-stone-900 mb-2">
                    {sighting.species.commonName || 'Neurčeno'}
                  </h1>
                  {sighting.species.scientificName && (
                    <p className="text-stone-500 italic">{sighting.species.scientificName}</p>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              {isEditing ? (
                <>
                  <button 
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                  </button>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors"
                  >
                    <X size={20} />
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors"
                  >
                    <Edit3 size={20} />
                  </button>
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </>
              )}
            </div>
          </div>

          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
                <h3 className="text-xl font-bold text-stone-900 mb-2">Smazat nález?</h3>
                <p className="text-stone-500 mb-6">Opravdu chcete smazat tento nález? Bude přesunut do koše.</p>
                <div className="flex gap-3 justify-end">
                  <button 
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 text-stone-600 font-medium hover:bg-stone-100 rounded-xl transition-colors"
                  >
                    Zrušit
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 text-white font-medium hover:bg-red-700 rounded-xl transition-colors"
                  >
                    Smazat
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Small Photo Thumbnail */}
          {photoUrls.length > 0 && !isEditing && (
            <div className="flex gap-4 overflow-x-auto pb-4 mb-4 snap-x">
              {photoUrls.map((url, i) => (
                <div key={i} className="w-32 h-32 sm:w-40 sm:h-40 shrink-0 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 snap-start">
                  <img 
                    src={url} 
                    alt={`Foto ${i+1}`} 
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-stone-600">
                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                  <Calendar size={20} className="text-stone-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-stone-900">Datum nálezu</p>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-800/20 text-sm"
                    />
                  ) : (
                    <p className="text-sm">{format(sighting.capturedAt.toDate(), 'd. MMMM yyyy', { locale: cs })}</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-stone-600">
                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                  <Clock size={20} className="text-stone-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-stone-900">Čas</p>
                  {isEditing ? (
                    <input
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="mt-1 w-full px-3 py-1.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-800/20 text-sm"
                    />
                  ) : (
                    <p className="text-sm">{format(sighting.capturedAt.toDate(), 'HH:mm')}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 text-stone-600">
                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center shrink-0 mt-1">
                  <MapPin size={20} className="text-stone-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-stone-900">Lokalita</p>
                  {isEditing ? (
                    <div className="mt-1 space-y-2">
                      <input
                        type="number"
                        step="any"
                        placeholder="Zeměpisná šířka (např. 49.123)"
                        value={editLat}
                        onChange={(e) => setEditLat(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-800/20 text-sm"
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="Zeměpisná délka (např. 14.123)"
                        value={editLon}
                        onChange={(e) => setEditLon(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-800/20 text-sm"
                      />
                    </div>
                  ) : (
                    <p className="text-sm mt-1">
                      {sighting.location.lat ? (
                        sighting.location.privacy === 'exact' 
                          ? `${sighting.location.lat.toFixed(5)}, ${sighting.location.lon?.toFixed(5)}`
                          : `Oblast (Grid: ${sighting.location.gridId})`
                      ) : 'Bez polohy'}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-stone-600">
                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                  <Tag size={20} className="text-stone-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-stone-900">Počet výskytů</p>
                  <p className="text-sm">{sighting.rarity.totalCount || 1}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100">
            <h3 className="text-sm font-medium text-stone-900 mb-2">Poznámka</h3>
            {isEditing ? (
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-800/20 resize-none text-sm"
                placeholder="Žádná poznámka..."
              />
            ) : (
              <p className="text-stone-600 whitespace-pre-wrap">{sighting.notes || <span className="text-stone-400 italic">Bez poznámky</span>}</p>
            )}
          </div>

          {!isEditing && sighting.location.lat && sighting.location.lon && (
            <div className="mt-8">
              <h3 className="text-sm font-medium text-stone-900 mb-4">Poloha na mapě</h3>
              <div className="h-64 rounded-2xl overflow-hidden border border-stone-200">
                <MapContainer
                  center={[sighting.location.lat, sighting.location.lon]}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <Marker position={[sighting.location.lat, sighting.location.lon]} />
                </MapContainer>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-stone-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-medium text-stone-900">Statistika vzácnosti</h3>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getRarityColor(sighting.rarity.label)}`}>
                {sighting.rarity.label}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
                <div className="text-2xl font-serif font-bold text-stone-800 mb-1">{sighting.rarity.basisCount}</div>
                <div className="text-xs text-stone-500 uppercase tracking-wider font-medium">Výskyt v oblasti</div>
              </div>
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
                <div className="text-2xl font-serif font-bold text-stone-800 mb-1">{sighting.rarity.windowDays}</div>
                <div className="text-xs text-stone-500 uppercase tracking-wider font-medium">Dní historie</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
                <div className="text-2xl font-serif font-bold text-stone-800 mb-1">{(sighting.rarity.totalCount || 1).toLocaleString('cs-CZ')}</div>
                <div className="text-xs text-stone-500 uppercase tracking-wider font-medium">Výskyt v Jižních Čechách</div>
              </div>
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
                <div className="text-2xl font-serif font-bold text-stone-800 mb-1">{(sighting.rarity.totalCount || 1).toLocaleString('cs-CZ')}</div>
                <div className="text-xs text-stone-500 uppercase tracking-wider font-medium">Výskyt v ČR</div>
              </div>
            </div>
            
            <p className="text-xs text-stone-400 mt-4 text-center">
              Vzácnost se určuje podle oficiálního seznamu hub v ČR. Statistika zobrazuje počet vašich nálezů daného druhu.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
