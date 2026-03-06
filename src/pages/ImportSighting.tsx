import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { dbService, LocationData, PhotoData } from '../lib/db';
import { storageService } from '../lib/storage';
import { generateGridId, normalizeSpecies } from '../lib/utils';
import { identifyMushroom, fileToBase64 } from '../lib/ai';
import { SpeciesAutocomplete } from '../components/SpeciesAutocomplete';
import { Upload, Image as ImageIcon, MapPin, Calendar, Loader2, X, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';
import exifr from 'exifr';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function LocationPicker({ position, setPosition }: { position: [number, number] | null, setPosition: (pos: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

interface ImportedPhoto {
  file: File;
  preview: string;
  exifData: any;
  lat: number | null;
  lon: number | null;
  date: Date | null;
  hash: string;
}

export function ImportSighting() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<ImportedPhoto[]>([]);
  const [speciesName, setSpeciesName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  
  const [manualLocation, setManualLocation] = useState<[number, number] | null>(null);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    // Check if we need to show map
    if (photos.length > 0 && profile?.settings.importNoGpsBehavior === 'pick_on_map') {
      const hasGps = photos.some(p => p.lat !== null && p.lon !== null);
      setShowMap(!hasGps);
    } else {
      setShowMap(false);
    }
  }, [photos, profile]);

  const handleIdentify = async (fileToIdentify: File) => {
    setIdentifying(true);
    try {
      const base64 = await fileToBase64(fileToIdentify);
      const result = await identifyMushroom(base64, fileToIdentify.type);
      
      if (result && result.commonName) {
        if (result.confidence > 50) {
          setSpeciesName(result.commonName);
          toast.success(`Rozpoznáno: ${result.commonName} (${result.confidence}%)`);
        } else {
          toast('Houba rozpoznána s nízkou jistotou.', { icon: '⚠️' });
          setSpeciesName(result.commonName);
        }
      } else {
        toast.error("Nepodařilo se spolehlivě rozpoznat houbu.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Chyba při rozpoznávání houby.");
    } finally {
      setIdentifying(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const newPhotos: ImportedPhoto[] = [];
    
    for (const file of files) {
      try {
        // Read EXIF
        const exifData = await exifr.parse(file, true);
        const gps = await exifr.gps(file);
        
        let date = null;
        if (exifData?.DateTimeOriginal) {
          date = new Date(exifData.DateTimeOriginal);
        } else if (file.lastModified) {
          date = new Date(file.lastModified);
        }

        // Calculate hash
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Create preview
        const preview = URL.createObjectURL(file);

        newPhotos.push({
          file,
          preview,
          exifData,
          lat: gps?.latitude || null,
          lon: gps?.longitude || null,
          date,
          hash
        });
      } catch (err) {
        console.error("Error parsing EXIF for", file.name, err);
        // Add anyway without EXIF
        const preview = URL.createObjectURL(file);
        newPhotos.push({
          file, preview, exifData: null, lat: null, lon: null, date: new Date(file.lastModified), hash: crypto.randomUUID()
        });
      }
    }

    setPhotos(prev => [...prev, ...newPhotos]);
    
    // Auto-identify from the first photo if species is empty
    if (!speciesName && newPhotos.length > 0) {
      await handleIdentify(newPhotos[0].file);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const newPhotos = [...prev];
      URL.revokeObjectURL(newPhotos[index].preview);
      newPhotos.splice(index, 1);
      return newPhotos;
    });
  };

  const handleSave = async () => {
    if (!profile) return;
    if (photos.length === 0) {
      toast.error('Vyberte alespoň jednu fotografii');
      return;
    }

    if (showMap && !manualLocation) {
      toast.error('Vyberte polohu na mapě');
      return;
    }

    setSaving(true);
    try {
      const primaryPhoto = photos[0];
      const capturedAt = primaryPhoto.date || new Date();
      const normalized = normalizeSpecies(speciesName);
      
      let location: LocationData = {
        lat: null, lon: null, accuracyM: null, gridId: null,
        privacy: profile.settings.locationPrivacyDefault,
        gpsSource: 'none', gpsConfidence: 0, gpsVerifiedAt: null, anomalyFlags: []
      };

      if (primaryPhoto.lat && primaryPhoto.lon) {
        location = {
          lat: primaryPhoto.lat,
          lon: primaryPhoto.lon,
          accuracyM: 10,
          gridId: generateGridId(primaryPhoto.lat, primaryPhoto.lon, profile.settings.gridSizeM),
          privacy: profile.settings.locationPrivacyDefault,
          gpsSource: 'exif',
          gpsConfidence: 0.6,
          gpsVerifiedAt: new Date(),
          anomalyFlags: []
        };
      } else if (showMap && manualLocation) {
        location = {
          lat: manualLocation[0],
          lon: manualLocation[1],
          accuracyM: 50,
          gridId: generateGridId(manualLocation[0], manualLocation[1], profile.settings.gridSizeM),
          privacy: profile.settings.locationPrivacyDefault,
          gpsSource: 'manual',
          gpsConfidence: 0.8,
          gpsVerifiedAt: new Date(),
          anomalyFlags: []
        };
      } else if (profile.settings.importNoGpsBehavior === 'pick_on_map') {
        toast.error('Některé fotky nemají GPS. Uloženo bez polohy.');
      }

      const gridId = location.gridId;
      const dedupeKey = await dbService.computeDedupeKey(profile.uid, normalized, gridId, capturedAt, primaryPhoto.hash);

      const rarity = await dbService.computeRarity(profile.uid, normalized, gridId, profile.settings.rarityWindowDays);
      
      const sightingId = await dbService.saveSighting(profile.uid, {
        capturedAt,
        source: 'imported',
        notes,
        count: null,
        habitatTags: [],
        deletedAt: null,
        species: {
          id: null,
          commonName: speciesName || 'Neurčeno',
          scientificName: null,
          normalized
        },
        location,
        photos: [],
        rarity,
        dedupeKey
      });

      const uploadedPhotos: PhotoData[] = [];
      for (const p of photos) {
        const photoId = crypto.randomUUID();
        const storagePath = await storageService.uploadPhoto(profile.uid, sightingId, photoId, p.file);
        uploadedPhotos.push({
          photoId,
          storagePath,
          capturedAt: p.date || new Date(),
          hash: p.hash,
          exifLat: p.lat || (showMap && manualLocation ? manualLocation[0] : null),
          exifLon: p.lon || (showMap && manualLocation ? manualLocation[1] : null)
        });
      }

      await dbService.saveSighting(profile.uid, {
        capturedAt, source: 'imported', notes, count: null, habitatTags: [], deletedAt: null,
        species: { id: null, commonName: speciesName || 'Neurčeno', scientificName: null, normalized },
        location, rarity, dedupeKey,
        photos: uploadedPhotos
      }, sightingId);

      toast.success('Nález úspěšně importován');
      navigate(`/sighting/${sightingId}`);
      
    } catch (error) {
      console.error(error);
      toast.error('Chyba při importu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
      <div className="p-6 border-b border-stone-100">
        <h2 className="text-2xl font-serif font-bold text-stone-800">Import z galerie</h2>
        <p className="text-stone-500 mt-1">Vyberte fotky, aplikace z nich přečte datum a polohu.</p>
      </div>

      <div className="p-6 space-y-8">
        {/* Photo Selection */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-stone-700">Vybrané fotografie</label>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-sm font-medium text-stone-800 hover:text-stone-600 flex items-center gap-1"
            >
              <Upload size={16} /> Přidat další
            </button>
          </div>
          
          <input
            type="file"
            accept="image/*"
            multiple
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
          />

          {photos.length === 0 ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="aspect-video sm:aspect-[21/9] rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 flex flex-col items-center justify-center text-stone-500 hover:bg-stone-100 hover:border-stone-400 transition-colors cursor-pointer"
            >
              <ImageIcon size={48} className="mb-4 text-stone-400" />
              <p className="font-medium">Klepněte pro výběr fotografií</p>
              <p className="text-sm mt-1">Můžete vybrat více fotek najednou</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-stone-100 border border-stone-200 group">
                  <img src={p.preview} alt={`Preview ${i}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur rounded-full text-stone-700 hover:bg-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                  
                  <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-1">
                    {p.date && (
                      <div className="flex items-center gap-1 text-[10px] text-white font-medium bg-black/40 backdrop-blur px-2 py-0.5 rounded-full w-fit">
                        <Calendar size={10} />
                        {format(p.date, 'd.M.yyyy')}
                      </div>
                    )}
                    <div className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full w-fit ${p.lat ? 'bg-green-500/80 text-white backdrop-blur' : 'bg-red-500/80 text-white backdrop-blur'}`}>
                      <MapPin size={10} />
                      {p.lat ? 'GPS OK' : 'Bez GPS'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-6">
          {showMap && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-stone-700">
                Chybí GPS. Vyberte polohu na mapě:
              </label>
              <div className="h-64 rounded-xl overflow-hidden border border-stone-200">
                <MapContainer
                  center={[49.8175, 15.4730]} // Center of CZ
                  zoom={7}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <LocationPicker position={manualLocation} setPosition={setManualLocation} />
                </MapContainer>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-stone-700">Druh (společný pro všechny fotky)</label>
              {photos.length > 0 && (
                <button
                  onClick={() => handleIdentify(photos[0].file)}
                  disabled={identifying}
                  className="text-xs font-medium text-stone-600 hover:text-stone-900 flex items-center gap-1 disabled:opacity-50"
                >
                  {identifying ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  Rozpoznat z fotky
                </button>
              )}
            </div>
            <SpeciesAutocomplete
              value={speciesName}
              onChange={setSpeciesName}
              onSelect={(s) => setSpeciesName(s.commonName)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Společná poznámka</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-stone-800/20 focus:border-stone-800 transition-all resize-none"
            />
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-stone-100 bg-stone-50 flex justify-end gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 rounded-xl font-medium text-stone-600 hover:bg-stone-200 transition-colors"
        >
          Zrušit
        </button>
        <button
          onClick={handleSave}
          disabled={saving || photos.length === 0}
          className="flex items-center gap-2 bg-stone-800 text-white px-8 py-3 rounded-xl font-medium hover:bg-stone-700 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 size={20} className="animate-spin" />}
          Importovat
        </button>
      </div>
    </div>
  );
}
