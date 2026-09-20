import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '../types';
import * as db from '../services/databaseService';
import * as auth from '../services/authService';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  cloudMode: boolean;
  loginUser: (login: string, senha: string) => Promise<{ user?: User; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateProfile: (patch: Partial<User>) => Promise<void>;
  salaryCreditedNotice: number;
  markSalaryNoticeRead: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloudMode] = useState(db.isCloudMode());
  const [salaryCreditedNotice, setSalaryCreditedNotice] = useState(0);

  useEffect(() => {
    (async () => {
      const { user: restored, salaryCredited } = await auth.restoreSession();
      if (restored) setUser(restored);
      if (salaryCredited > 0) setSalaryCreditedNotice(salaryCredited);
      setLoading(false);
    })();
  }, []);

  const loginUser = useCallback(async (loginName: string, senha: string) => {
    const result = await auth.login(loginName, senha);
    if (result.user) {
      const { user: updated, credited } = await db.applyWeeklySalary(result.user);
      setUser(updated);
      if (credited > 0) setSalaryCreditedNotice(credited);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    auth.clearSession();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (db.isCloudMode()) {
      await db.reloadCloudCache();
    }
    setUser((current) => {
      if (!current) return current;
      return db.getUserById(current.id) ?? current;
    });
  }, []);

  const updateProfile = useCallback(async (patch: Partial<User>) => {
    setUser((current) => {
      if (!current) return current;
      void db.updateUser(current.id, patch).then((updated) => {
        setUser(updated);
      });
      return current;
    });
  }, []);

  const markSalaryNoticeRead = useCallback(() => setSalaryCreditedNotice(0), []);

  return (
    <AuthContext.Provider
      value={{ user, loading, cloudMode, loginUser, logout, refreshUser, updateProfile, salaryCreditedNotice, markSalaryNoticeRead }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
