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

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    try {
      const token = await storage.getItem('accessToken');
      if (token) {
        // Detect stale mock tokens and clear them
        if (token.startsWith('mock-token-')) {
          console.log('Clearing stale mock token — please log in again.');
          await storage.deleteItem('accessToken');
          await storage.deleteItem('refreshToken');
          await storage.deleteItem('mockSession');
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        try {
          const { data } = await api.get('/auth/me');
          set({ user: data, isAuthenticated: true, isLoading: false });
          return;
        } catch (err) {
          // Token invalid or expired and refresh also failed — force re-login
          console.log('Auth validation failed:', err?.message);
          await storage.deleteItem('accessToken');
          await storage.deleteItem('refreshToken');
          await storage.deleteItem('mockSession');
        }
      }
      set({ user: null, isAuthenticated: false, isLoading: false });
    } catch (err) {
      console.log('Auth init error:', err?.message || err);
      try {
        await storage.deleteItem('accessToken');
        await storage.deleteItem('refreshToken');
        await storage.deleteItem('mockSession');
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
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        (err.message === 'Network Error'
          ? 'Cannot reach server. Make sure the backend is running and your device is on the same network.'
          : 'Registration failed. Please try again.');
      throw new Error(message);
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
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        (err.message === 'Network Error'
          ? 'Cannot reach server. Make sure the backend is running and your device is on the same network.'
          : 'Login failed. Please try again.');
      throw new Error(message);
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
