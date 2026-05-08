"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
  onAuthStateChanged, 
  signInWithPopup,
  signOut, 
  User,
  browserSessionPersistence,
  setPersistence
} from "firebase/auth";
import { getAuthInstance, googleProvider } from "@/lib/firebase";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signIn: () => void;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  signIn: () => {},
  logOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuthInstance();
    setPersistence(auth, browserSessionPersistence)
      .then(() => {
        const unsubscribe = onAuthStateChanged(
          auth,
          (firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);
          },
          (error) => {
            console.error("Auth state error:", error);
            setLoading(false);
          }
        );
        return () => unsubscribe();
      })
      .catch((error) => {
        console.error("Persistence error:", error);
        setLoading(false);
      });
  }, []);

  // Must NOT be async — popup must open in same call stack as button click
  const signIn = () => {
    signInWithPopup(getAuthInstance(), googleProvider)
      .catch((error: any) => {
        if (error.code !== "auth/popup-closed-by-user") {
          console.error("Sign-in error:", error.code, error.message);
        }
      });
  };

  const logOut = async () => {
    try {
      await signOut(getAuthInstance());
    } catch (error) {
      console.error("Sign-out error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);