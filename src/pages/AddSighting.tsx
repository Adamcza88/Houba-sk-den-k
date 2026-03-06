import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { dbService, LocationData, PhotoData } from '../lib/db';
import { storageService } from '../lib/storage';
import { generateGridId, normalizeSpecies, sha256 } from '../lib/utils';
import { identifyMushroom, fileToBase64 } from '../lib/ai';
import { SpeciesAutocomplete } from '../components/SpeciesAutocomplete';
import { Camera, MapPin, Loader2, Image as ImageIcon, X, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function AddSighting() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [speciesName, setSpeciesName] = useState('');
  const [notes, setNotes] = useState('');
  
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [identifying, setIdentifying] = useState(false);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
      
      // Auto-identify if species is empty
      if (!speciesName) {
        await handleIdentify(file);
      }
    }
  };

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

  const getLocation = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      toast.error('Geolokace není podporována vaším prohlížečem');
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const confidence = accuracy <= 20 ? 0.9 : accuracy <= 80 ? 0.7 : 0.4;
        const anomalyFlags = accuracy > 80 ? ['low_accuracy'] : [];
        
        setLocation({
          lat: latitude,
          lon: longitude,
          accuracyM: accuracy,
          gridId: generateGridId(latitude, longitude, profile?.settings.gridSizeM || 1000),
          privacy: profile?.settings.locationPrivacyDefault || 'grid',
          gpsSource: 'device',
          gpsConfidence: confidence,
          gpsVerifiedAt: new Date(),
          anomalyFlags
        });
        setLocating(false);
        toast.success('Poloha úspěšně načtena');
      },
      (error) => {
        console.error(error);
        toast.error('Nepodařilo se získat polohu. Zkontrolujte oprávnění.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSave = async () => {
    if (!profile) return;
    if (!photo) {
      toast.error('Přidejte prosím fotografii');
      return;
    }

    setSaving(true);
    try {
      const capturedAt = new Date();
      const normalized = normalizeSpecies(speciesName);
      
      // Calculate hash for dedupe
      const arrayBuffer = await photo.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const photoHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const gridId = location?.gridId || null;
      const dedupeKey = await dbService.computeDedupeKey(profile.uid, normalized, gridId, capturedAt, photoHash);

      // Check dedupe
      const existing = await dbService.checkDedupe(profile.uid, dedupeKey);
      let sightingId = existing?.id;

      if (existing) {
        const merge = window.confirm('Byl nalezen podobný záznam ze stejného dne a místa. Chcete tuto fotografii přidat k existujícímu nálezu?');
        if (!merge) {
          // Change dedupe key slightly to force new entry
          sightingId = undefined;
        }
      }

      // Upload photo
      const photoId = crypto.randomUUID();
      const storagePath = await storageService.uploadPhoto(profile.uid, sightingId || 'temp', photoId, photo);
      
      const photoData: PhotoData = {
        photoId,
        storagePath,
        capturedAt,
        hash: photoHash,
        exifLat: location?.lat,
        exifLon: location?.lon
      };

      if (sightingId && existing) {
        // Merge
        await dbService.saveSighting(profile.uid, {
          ...existing,
          photos: [...existing.photos, photoData]
        }, sightingId);
        toast.success('Fotografie přidána k existujícímu nálezu');
      } else {
        // Create new
        const rarity = await dbService.computeRarity(profile.uid, normalized, gridId, profile.settings.rarityWindowDays);
        
        const newSightingId = await dbService.saveSighting(profile.uid, {
          capturedAt,
          source: 'captured_in_app',
          notes,
          count: null,
          habitatTags: [],
          deletedAt: null,
          species: {
            id: null, // We'd look this up ideally
            commonName: speciesName || 'Neurčeno',
            scientificName: null,
            normalized
          },
          location: location || {
            lat: null, lon: null, accuracyM: null, gridId: null,
            privacy: profile.settings.locationPrivacyDefault,
            gpsSource: 'none', gpsConfidence: 0, gpsVerifiedAt: null, anomalyFlags: []
          },
          photos: [photoData],
          rarity,
          dedupeKey
        });

        // Move photo to correct path if we used 'temp'
        // In a real app, we'd generate the ID first or use a cloud function.
        // For MVP, we'll just keep it in the temp path or generate ID client-side.
        // Actually, let's just use the generated ID.
        
        toast.success('Nález úspěšně uložen');
        navigate(`/sighting/${newSightingId}`);
      }
    } catch (error) {
      console.error(error);
      toast.error('Chyba při ukládání nálezu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
      <div className="p-6 border-b border-stone-100">
        <h2 className="text-2xl font-serif font-bold text-stone-800">Nový nález</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Photo Upload */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Fotografie</label>
          {photoPreview ? (
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-stone-100 border border-stone-200">
              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              <button
                onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur rounded-full text-stone-700 hover:bg-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="aspect-video rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 flex flex-col items-center justify-center text-stone-500 hover:bg-stone-100 hover:border-stone-400 transition-colors cursor-pointer"
            >
              <Camera size={48} className="mb-4 text-stone-400" />
              <p className="font-medium">Klepněte pro vyfocení nebo výběr</p>
              <p className="text-sm mt-1">JPG, PNG (max. 10MB)</p>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handlePhotoSelect}
            className="hidden"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Poloha</label>
          <div className="flex items-center gap-3">
            <button
              onClick={getLocation}
              disabled={locating}
              className="flex-1 flex items-center justify-center gap-2 bg-stone-100 text-stone-700 px-4 py-3 rounded-xl font-medium hover:bg-stone-200 transition-colors disabled:opacity-50"
            >
              {locating ? <Loader2 size={20} className="animate-spin" /> : <MapPin size={20} />}
              {location ? 'Aktualizovat polohu' : 'Získat aktuální polohu'}
            </button>
            {location && (
              <div className="px-4 py-3 bg-green-50 text-green-700 rounded-xl border border-green-200 text-sm font-medium flex items-center gap-2">
                <MapPin size={16} />
                Uloženo ({Math.round(location.accuracyM || 0)}m)
              </div>
            )}
          </div>
        </div>

        {/* Species */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-stone-700">Druh</label>
            {photo && (
              <button
                onClick={() => handleIdentify(photo)}
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

        {/* Details */}
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Poznámka</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Kde rostla, s kým jste byli..."
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
          disabled={saving || !photo}
          className="flex items-center gap-2 bg-stone-800 text-white px-8 py-3 rounded-xl font-medium hover:bg-stone-700 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 size={20} className="animate-spin" />}
          Uložit nález
        </button>
      </div>
    </div>
  );
}
