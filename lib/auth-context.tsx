"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
  onAuthStateChanged, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  User,
  browserSessionPersistence,
  setPersistence
} from "firebase/auth";
import { getAuthInstance, googleProvider } from "@/lib/firebase";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  signIn: async () => {},
  logOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuthInstance();

    setPersistence(auth, browserSessionPersistence)
      .then(() => {
        // Handle redirect result on page load
        getRedirectResult(auth)
          .then(result => {
            if (result?.user) {
              setUser(result.user);
            }
          })
          .catch(e => console.error("Redirect result error:", e));

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

  const signIn = async () => {
    try {
      await signInWithRedirect(getAuthInstance(), googleProvider);
      // Page will redirect to Google and come back — no result here
    } catch (error: any) {
      console.error("Sign-in error:", error.code, error.message);
    }
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