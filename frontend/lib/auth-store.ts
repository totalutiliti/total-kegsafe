import { create } from 'zustand';
import { api } from '@/lib/api';

export const ROLE_HOME: Record<string, string> = {
    ADMIN: '/dashboard',
    MANAGER: '/dashboard',
    LOGISTICS: '/barrels',
    MAINTENANCE: '/barrels',
};

interface User {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'MANAGER' | 'LOGISTICS' | 'MAINTENANCE';
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,

    login: async (email: string, password: string) => {
        // Cookies are set by the server via httpOnly — no localStorage needed
        const { data } = await api.post('/auth/login', { email, password });
        set({ user: data.user, isAuthenticated: true });
    },

    logout: () => {
        // Server clears httpOnly cookies
        api.post('/auth/logout').catch(() => { });
        set({ user: null, isAuthenticated: false });
        window.location.href = '/login';
    },

    checkAuth: async () => {
        try {
            // Cookie is sent automatically — server validates it
            const { data } = await api.get('/auth/me');
            set({ user: data, isAuthenticated: true, isLoading: false });
        } catch {
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },
}));
