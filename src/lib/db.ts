import { db } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit, startAfter, serverTimestamp, updateDoc, Timestamp, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { normalizeSpecies, generateGridId, sha256 } from './utils';
import { UserProfile } from './auth';

export interface Species {
  id: string;
  commonName: string;
  scientificName: string | null;
  normalized: string;
  createdAt?: any;
  aliases?: string[];
}

export interface LocationData {
  lat: number | null;
  lon: number | null;
  accuracyM: number | null;
  gridId: string | null;
  privacy: 'exact' | 'grid' | 'hidden';
  gpsSource: 'device' | 'exif' | 'manual' | 'none';
  gpsConfidence: number;
  gpsVerifiedAt: any | null;
  anomalyFlags: string[];
}

export interface PhotoData {
  photoId: string;
  storagePath: string;
  capturedAt: any;
  exifLat?: number | null;
  exifLon?: number | null;
  hash: string;
}

export interface RarityData {
  score: number;
  label: 'neznámé' | 'velmi vzácné' | 'vzácné' | 'časté' | 'velmi časté';
  basisCount: number;
  totalCount?: number;
  southBohemiaCount?: number;
  crCount?: number;
  windowDays: number;
  computedAt: any;
}

export interface Sighting {
  id: string;
  createdAt: any;
  updatedAt: any;
  capturedAt: any;
  source: 'captured_in_app' | 'imported';
  notes: string;
  count: number | null;
  habitatTags: string[];
  deletedAt: any | null;
  species: {
    id: string | null;
    commonName: string;
    scientificName: string | null;
    normalized: string;
  };
  location: LocationData;
  photos: PhotoData[];
  rarity: RarityData;
  dedupeKey: string;
}

export const dbService = {
  // Species Dictionary
  async getSpecies(uid: string): Promise<Species[]> {
    const q = query(collection(db, `users/${uid}/species`), orderBy('normalized'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Species));
  },

  async addSpecies(uid: string, species: Omit<Species, 'id' | 'createdAt' | 'normalized'>): Promise<Species> {
    const normalized = normalizeSpecies(species.commonName);
    const newRef = doc(collection(db, `users/${uid}/species`));
    const data = {
      ...species,
      normalized,
      createdAt: serverTimestamp()
    };
    await setDoc(newRef, data);
    return { id: newRef.id, ...data } as Species;
  },

  async updateSpecies(uid: string, id: string, species: Partial<Omit<Species, 'id' | 'createdAt' | 'normalized'>>): Promise<void> {
    const ref = doc(db, `users/${uid}/species/${id}`);
    const data: any = { ...species };
    if (species.commonName) {
      data.normalized = normalizeSpecies(species.commonName);
    }
    await updateDoc(ref, data);
  },

  async deleteSpecies(uid: string, id: string): Promise<void> {
    const { deleteDoc } = await import('firebase/firestore');
    const ref = doc(db, `users/${uid}/species/${id}`);
    await deleteDoc(ref);
  },

  // Sightings
  async getSightings(uid: string, lastDoc?: QueryDocumentSnapshot<DocumentData>, pageSize = 20, speciesFilter?: string) {
    let q;
    
    if (speciesFilter) {
      // If filtering by species, we might need a composite index for species + capturedAt
      // Try to query just by species and sort client side if needed, or rely on index creation
      q = query(
        collection(db, `users/${uid}/sightings`),
        where('species.normalized', '==', speciesFilter),
        orderBy('capturedAt', 'desc'),
        limit(pageSize)
      );
    } else {
      q = query(
        collection(db, `users/${uid}/sightings`),
        orderBy('capturedAt', 'desc'),
        limit(pageSize)
      );
    }

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }
    const snap = await getDocs(q);
    
    // Filter out deleted items client-side to avoid requiring a composite index
    const allSightings = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sighting));
    const activeSightings = allSightings.filter(s => !s.deletedAt);

    return {
      sightings: activeSightings,
      lastDoc: snap.docs[snap.docs.length - 1]
    };
  },

  async getAllSightingsBasic(uid: string) {
    // Fetch minimal data for stats
    const q = query(collection(db, `users/${uid}/sightings`));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => d.data())
      .filter(d => !d.deletedAt)
      .map(d => ({ species: d.species, count: d.count }));
  },

  async getSighting(uid: string, sightingId: string): Promise<Sighting | null> {
    const snap = await getDoc(doc(db, `users/${uid}/sightings/${sightingId}`));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Sighting) : null;
  },

  async computeRarity(uid: string, normalizedSpecies: string, gridId: string | null, windowDays: number, excludeSightingId?: string): Promise<RarityData> {
    if (!normalizedSpecies || normalizedSpecies === 'neurčeno') {
      return { score: 0, label: 'neznámé', basisCount: 0, totalCount: 0, windowDays: 0, computedAt: serverTimestamp() };
    }

    const { getSpeciesRarity } = await import('./rarityList');
    const rarityInfo = getSpeciesRarity(normalizedSpecies);

    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - windowDays);

    const q = query(
      collection(db, `users/${uid}/sightings`),
      where('species.normalized', '==', normalizedSpecies)
    );
    
    const snap = await getDocs(q);
    
    // Filter client-side to avoid composite index requirements
    const allActiveDocs = snap.docs.filter(d => {
      if (excludeSightingId && d.id === excludeSightingId) return false;
      const data = d.data();
      if (data.deletedAt !== null) return false;
      return true;
    });

    const gridDocs = allActiveDocs.filter(d => {
      const data = d.data();
      if (gridId && data.location?.gridId !== gridId) return false;
      const capturedAt = data.capturedAt?.toDate?.() || new Date(data.capturedAt);
      if (capturedAt < windowStart) return false;
      return true;
    });
    
    const basisCount = gridId ? gridDocs.length + 1 : 1; // including this new one
    const totalCount = allActiveDocs.length + 1; // including this new one

    // Calculate actual days from oldest sighting of this species (all grids)
    let actualDays = 1;
    if (allActiveDocs.length > 0) {
      const timestamps = allActiveDocs.map(d => {
        const val = d.data().capturedAt;
        return (val?.toDate ? val.toDate() : new Date(val)).getTime();
      });
      const oldestTimestamp = Math.min(...timestamps);
      const diffTime = Math.abs(now.getTime() - oldestTimestamp);
      actualDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (actualDays < 1) actualDays = 1;
    }

    return { 
      score: rarityInfo.score, 
      label: rarityInfo.label, 
      basisCount, 
      totalCount,
      windowDays: actualDays, 
      computedAt: serverTimestamp() 
    };
  },

  async computeDedupeKey(uid: string, normalizedSpecies: string, gridId: string | null, capturedAt: Date, photoHash: string): Promise<string> {
    const day = capturedAt.toISOString().split('T')[0];
    const keyString = `${uid}|${normalizedSpecies || 'unknown'}|${gridId || 'nogrid'}|${day}|${photoHash}`;
    return await sha256(keyString);
  },

  async checkDedupe(uid: string, dedupeKey: string): Promise<Sighting | null> {
    const q = query(
      collection(db, `users/${uid}/sightings`),
      where('dedupeKey', '==', dedupeKey)
    );
    const snap = await getDocs(q);
    const activeDocs = snap.docs.filter(d => d.data().deletedAt === null);
    return activeDocs.length === 0 ? null : ({ id: activeDocs[0].id, ...activeDocs[0].data() } as Sighting);
  },

  async saveSighting(uid: string, sightingData: Omit<Sighting, 'id' | 'createdAt' | 'updatedAt'>, existingId?: string): Promise<string> {
    const ref = existingId ? doc(db, `users/${uid}/sightings/${existingId}`) : doc(collection(db, `users/${uid}/sightings`));
    const data = {
      ...sightingData,
      updatedAt: serverTimestamp(),
      ...(existingId ? {} : { createdAt: serverTimestamp() })
    };
    await setDoc(ref, data, { merge: true });
    return ref.id;
  },

  async softDeleteSighting(uid: string, sightingId: string) {
    await updateDoc(doc(db, `users/${uid}/sightings/${sightingId}`), {
      deletedAt: serverTimestamp()
    });
  },

  async restoreSighting(uid: string, sightingId: string) {
    await updateDoc(doc(db, `users/${uid}/sightings/${sightingId}`), {
      deletedAt: null
    });
  },

  async getDeletedSightings(uid: string) {
    const q = query(
      collection(db, `users/${uid}/sightings`),
      orderBy('capturedAt', 'desc')
    );
    const snap = await getDocs(q);
    
    // Filter client-side to avoid composite index requirements
    const deletedSightings = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Sighting))
      .filter(s => !!s.deletedAt);

    return deletedSightings;
  },

  async permanentDeleteSighting(uid: string, sightingId: string) {
    const { deleteDoc } = await import('firebase/firestore');
    const ref = doc(db, `users/${uid}/sightings/${sightingId}`);
    await deleteDoc(ref);
  }
};
