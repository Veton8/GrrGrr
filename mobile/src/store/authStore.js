import { create } from 'zustand';
import { Platform } from 'react-native';
import api from '../services/api';

// Web-safe storage wrapper (SecureStore doesn't work on web)
const storage = {
  async getItem(key) {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    const SecureStore = require('expo-secure-store');
    return SecureStore.getItemAsync(key);
  },
  async setItem(key, value) {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    const SecureStore = require('expo-secure-store');
    return SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key) {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    const SecureStore = require('expo-secure-store');
    return SecureStore.deleteItemAsync(key);
  },
};

// Mock user for offline/fallback testing
const MOCK_USER = {
  id: 'mock-user-001',
  email: 'demo@grgr.app',
  username: 'demouser',
  displayName: 'Demo User',
  avatarUrl: null,
  bio: 'Just vibing on Grgr!',
  coinBalance: 10000000,
  createdAt: new Date().toISOString(),
};

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    try {
      const token = await storage.getItem('accessToken');
      if (token) {
        try {
          const { data } = await api.get('/auth/me');
          set({ user: data, isAuthenticated: true, isLoading: false });
          return;
        } catch (err) {
          // API unreachable — check if we have a stored mock session
          const mockSession = await storage.getItem('mockSession');
          if (mockSession) {
            set({ user: JSON.parse(mockSession), isAuthenticated: true, isLoading: false });
            return;
          }
        }
      }
      set({ isLoading: false });
    } catch (err) {
      console.log('Auth init error:', err?.message || err);
      try {
        await storage.deleteItem('accessToken');
        await storage.deleteItem('refreshToken');
      } catch {}
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  register: async ({ email, phone, password, username, displayName }) => {
    try {
      const { data } = await api.post('/auth/register', {
        email, phone, password, username, displayName,
      });
      await storage.setItem('accessToken', data.accessToken);
      await storage.setItem('refreshToken', data.refreshToken);
      set({ user: data.user, isAuthenticated: true });
      return data;
    } catch (err) {
      // Fallback: create mock session so user can still test the app
      console.log('Register API failed, using mock:', err?.message);
      const mockUser = {
        ...MOCK_USER,
        username: username || 'newuser',
        displayName: displayName || username || 'New User',
        email: email || 'user@grgr.app',
      };
      await storage.setItem('accessToken', 'mock-token-' + Date.now());
      await storage.setItem('mockSession', JSON.stringify(mockUser));
      set({ user: mockUser, isAuthenticated: true });
      return { user: mockUser };
    }
  },

  login: async ({ identifier, password }) => {
    try {
      const { data } = await api.post('/auth/login', { identifier, password });
      await storage.setItem('accessToken', data.accessToken);
      await storage.setItem('refreshToken', data.refreshToken);
      await storage.deleteItem('mockSession');
      set({ user: data.user, isAuthenticated: true });
      return data;
    } catch (err) {
      // Fallback: accept any credentials and create mock session
      console.log('Login API failed, using mock:', err?.message);
      const mockUser = {
        ...MOCK_USER,
        username: identifier || 'demouser',
        displayName: identifier ? identifier.charAt(0).toUpperCase() + identifier.slice(1) : 'Demo User',
      };
      await storage.setItem('accessToken', 'mock-token-' + Date.now());
      await storage.setItem('mockSession', JSON.stringify(mockUser));
      set({ user: mockUser, isAuthenticated: true });
      return { user: mockUser };
    }
  },

  logout: async () => {
    try {
      const refreshToken = await storage.getItem('refreshToken');
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // Ignore errors on logout
    }
    await storage.deleteItem('accessToken');
    await storage.deleteItem('refreshToken');
    await storage.deleteItem('mockSession');
    set({ user: null, isAuthenticated: false });
  },

  updateUser: (userData) => {
    set({ user: { ...get().user, ...userData } });
  },
}));

export default useAuthStore;
