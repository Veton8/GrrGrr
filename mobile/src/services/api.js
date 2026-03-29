import axios from 'axios';
import { Platform } from 'react-native';

// In dev, web uses localhost; native (phone) uses tunnel or LAN IP
const LAN_IP = '192.168.1.5'; // <-- your PC's local IP
const TUNNEL_URL = 'https://araeostyle-hypertechnically-louis.ngrok-free.dev'; // <-- ngrok tunnel for external access

const getApiUrl = () => {
  if (!__DEV__) return 'https://api.grgr.app/api';
  if (Platform.OS === 'web') return 'http://localhost:3000/api';
  return `${TUNNEL_URL}/api`;
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
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'bypass-tunnel-reminder': 'true', // skip localtunnel interstitial
  },
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
