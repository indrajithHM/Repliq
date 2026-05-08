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

    // Set persistence first
    setPersistence(auth, browserSessionPersistence)
      .then(() => {
        //console.log("📌 Auth persistence set to session");
        
        // Now listen for auth state
        const unsubscribe = onAuthStateChanged(
          auth,
          (firebaseUser) => {
            //console.log("🔄 Auth state changed:", firebaseUser?.email || "No user");
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
      //console.log("🔑 Starting sign-in with popup...");
      const result = await signInWithPopup(getAuthInstance(), googleProvider);
      //console.log("✅ Sign-in successful:", result.user.email);
      // onAuthStateChanged will handle updating the user state
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        //console.log("User closed the popup");
      } else {
        console.error("Sign-in error:", error.code, error.message);
      }
    }
  };

  const logOut = async () => {
    try {
      await signOut(getAuthInstance());
     // console.log("👋 Signed out");
      // onAuthStateChanged will handle updating the user state
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