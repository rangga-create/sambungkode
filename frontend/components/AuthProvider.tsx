"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { api } from "@/lib/api";
import { auth } from "@/lib/firebase";
import type { Profile } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  signOutUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(auth === null);

  useEffect(() => {
    if (!auth) {
      return;
    }

    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        try {
          const me = await api<Profile>("/me");
          setProfile(me);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const signOutUser = useCallback(async () => {
    if (auth) {
      await signOut(auth);
    }
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ user, profile, loading, signOutUser }),
    [user, profile, loading, signOutUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
