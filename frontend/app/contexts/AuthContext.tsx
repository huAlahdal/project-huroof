import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { API_BASE } from "~/lib/api";
import { getToken as getStoredToken, setToken as setStoredToken, removeToken as removeStoredToken } from "~/lib/tokenStore";
import { resetConnection } from "~/lib/signalr";

// ─── Types ──────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  inGameName: string;
  role: string;
  gamesPlayed: number;
  gamesWon: number;
  isGuest?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (emailOrUsername: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, inGameName: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsGuest: (name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (data: { username?: string; inGameName?: string; email?: string }) => Promise<{ success: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
  isGuest: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Token helpers ──────────────────────────────────────────

/** Build headers with auth token */
export function authHeaders(token?: string | null): Record<string, string> {
  const t = token ?? getStoredToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (t) headers["Authorization"] = `Bearer ${t}`;
  return headers;
}

/** Get the stored token (for SignalR query string) */
export function getToken(): string | null {
  return getStoredToken();
}

// ─── Provider ───────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: getStoredToken(),
    loading: true,
  });

  // Fetch user from /api/auth/me on mount if we have a token
  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setState({ user: null, token: null, loading: false });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: authHeaders(token),
      });
      if (res.ok) {
        const user: User = await res.json();
        setState({ user, token, loading: false });
      } else {
        // Token expired or invalid
        removeStoredToken();
        setState({ user: null, token: null, loading: false });
      }
    } catch {
      setState({ user: null, token: null, loading: false });
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (emailOrUsername: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrUsername, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setStoredToken(data.token);
        setState({ user: data.user, token: data.token, loading: false });
        return { success: true };
      }
      return { success: false, error: data.error || "فشل تسجيل الدخول" };
    } catch {
      return { success: false, error: "فشل الاتصال بالخادم" };
    }
  }, []);

  const register = useCallback(async (email: string, inGameName: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, inGameName, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setStoredToken(data.token);
        setState({ user: data.user, token: data.token, loading: false });
        return { success: true };
      }
      return { success: false, error: data.error || "فشل إنشاء الحساب" };
    } catch {
      return { success: false, error: "فشل الاتصال بالخادم" };
    }
  }, []);

  const loginAsGuest = useCallback(async (name: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setStoredToken(data.token);
        const guestUser: User = { ...data.user, isGuest: true };
        setState({ user: guestUser, token: data.token, loading: false });
        return { success: true };
      }
      return { success: false, error: data.error || "فشل الدخول كضيف" };
    } catch {
      return { success: false, error: "فشل الاتصال بالخادم" };
    }
  }, []);

  const isGuest = state.user?.isGuest === true || state.user?.role === "guest";

  const logout = useCallback(() => {
    removeStoredToken();
    setState({ user: null, token: null, loading: false });
    // Stop SignalR so it doesn't keep reconnecting with an invalid token
    resetConnection().catch(() => {});
  }, []);

  const updateProfile = useCallback(async (data: { username?: string; inGameName?: string; email?: string }) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.ok) {
        // If a new token was returned (e.g. username changed), update it
        if (json.token) {
          setStoredToken(json.token);
        }
        await refreshUser();
        return { success: true };
      }
      return { success: false, error: json.error || "فشل تحديث الملف الشخصي" };
    } catch {
      return { success: false, error: "فشل الاتصال بالخادم" };
    }
  }, [refreshUser]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me/password`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (res.ok) {
        return { success: true };
      }
      return { success: false, error: json.error || "فشل تغيير كلمة المرور" };
    } catch {
      return { success: false, error: "فشل الاتصال بالخادم" };
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, loginAsGuest, logout, updateProfile, changePassword, refreshUser, isGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
