import axios from 'axios';
import { Platform } from 'react-native';

// Default dev server URL — update this if using a tunnel for phone testing
const DEV_API = 'http://localhost:3000/api';

const getApiUrl = () => {
  if (!__DEV__) return 'https://api.grgr.app/api';
  return DEV_API;
};
const API_URL = getApiUrl();

// Web-safe storage
const getToken = async (key) => {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  const SecureStore = require('expo-secure-store');
  return SecureStore.getItemAsync(key);
};

const setToken = async (key, value) => {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  const SecureStore = require('expo-secure-store');
  return SecureStore.setItemAsync(key, value);
};

const deleteToken = async (key) => {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  const SecureStore = require('expo-secure-store');
  return SecureStore.deleteItemAsync(key);
};

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach access token
api.interceptors.request.use(async (config) => {
  const token = await getToken('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await getToken('refreshToken');
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        await setToken('accessToken', data.accessToken);
        await setToken('refreshToken', data.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch {
        await deleteToken('accessToken');
        await deleteToken('refreshToken');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
