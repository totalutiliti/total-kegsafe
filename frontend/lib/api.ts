import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3009';

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true, // Send httpOnly cookies automatically
});

// Response interceptor — automatic token refresh via cookie
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                // Refresh token is sent automatically via httpOnly cookie
                await axios.post(`${API_BASE_URL}/api/auth/refresh`, {}, { withCredentials: true });
                return api(originalRequest);
            } catch {
                // Refresh failed — redirect to login
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error);
    }
);
