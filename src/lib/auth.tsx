import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, db, isFirebaseConfigured } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface UserSettings {
  locationPrivacyDefault: 'exact' | 'grid' | 'hidden';
  gridSizeM: number;
  importNoGpsBehavior: 'pick_on_map' | 'leave_empty';
  rarityWindowDays: number;
  rarityGridSizeM: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  settings: UserSettings;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const defaultSettings: UserSettings = {
  locationPrivacyDefault: 'grid',
  gridSizeM: 1000,
  importNoGpsBehavior: 'pick_on_map',
  rarityWindowDays: 365,
  rarityGridSizeM: 1000,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setError("Firebase není nakonfigurován. Prosím nastavte VITE_FIREBASE_* proměnné prostředí.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              settings: defaultSettings,
            };
            await setDoc(userRef, {
              ...newProfile,
              createdAt: serverTimestamp(),
              lastLoginAt: serverTimestamp(),
            });
            setProfile(newProfile);
          } else {
            await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
            setProfile(userSnap.data() as UserProfile);
          }
        } catch (err: any) {
          console.error("Error fetching user profile:", err);
          if (err.message?.includes("Database '(default)' not found") || err.code === 'not-found') {
            setError("Databáze Firestore ještě nebyla vytvořena. Jděte do Firebase Console > Firestore Database a klikněte na 'Create database'.");
          } else {
            setError("Chyba při načítání profilu z databáze. Zkontrolujte bezpečnostní pravidla Firestore.");
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Auth error:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setError(`Doména ${window.location.hostname} není povolena ve Firebase. Přidejte ji v konzoli Firebase (Authentication > Settings > Authorized domains).`);
      } else if (err.code === 'auth/popup-closed-by-user') {
        // Uživatel zavřel okno, ignorujeme nebo zobrazíme jen upozornění
        console.log("Přihlášení zrušeno uživatelem.");
      } else {
        // Pro ostatní chyby nezablokujeme UI, ale ukážeme alert/toast (zde zatím do konzole a alert)
        alert(err.message || "Chyba při přihlašování.");
      }
    }
  };

  const logout = async () => {
    if (!isFirebaseConfigured) return;
    await signOut(auth);
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user || !profile || !isFirebaseConfigured) return;
    const updatedSettings = { ...profile.settings, ...newSettings };
    await setDoc(doc(db, 'users', user.uid), { settings: updatedSettings }, { merge: true });
    setProfile({ ...profile, settings: updatedSettings });
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, error, signInWithGoogle, logout, updateSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
