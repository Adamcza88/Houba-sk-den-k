import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const storageService = {
  async uploadPhoto(uid: string, sightingId: string, photoId: string, file: File | Blob): Promise<string> {
    const path = `users/${uid}/sightings/${sightingId}/${photoId}.jpg`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return path;
  },

  async getPhotoUrl(path: string): Promise<string> {
    return await getDownloadURL(ref(storage, path));
  }
};
