import { Platform } from 'react-native';
import { io } from 'socket.io-client';

// In dev, web uses localhost; native (phone) uses tunnel or LAN IP
const LAN_IP = '192.168.1.5'; // <-- your PC's local IP
const TUNNEL_URL = 'https://araeostyle-hypertechnically-louis.ngrok-free.dev'; // <-- ngrok tunnel for external access

const getSocketUrl = () => {
  if (!__DEV__) return 'https://api.grgr.app';
  if (Platform.OS === 'web') return 'http://localhost:3000';
  return TUNNEL_URL;
};
const SOCKET_URL = getSocketUrl();

let liveSocket = null;
let messagesSocket = null;

const getToken = async () => {
  if (Platform.OS === 'web') {
    return localStorage.getItem('accessToken');
  }
  const SecureStore = require('expo-secure-store');
  return SecureStore.getItemAsync('accessToken');
};

// ── Live socket ──────────────────────────────────────────────────────
export async function connectLiveSocket() {
  const token = await getToken();
  liveSocket = io(`${SOCKET_URL}/live`, {
    auth: { token },
    transports: ['websocket'],
  });
  return liveSocket;
}

export function getLiveSocket() {
  return liveSocket;
}

export function disconnectLiveSocket() {
  if (liveSocket) {
    liveSocket.disconnect();
    liveSocket = null;
  }
}

// ── Messages socket ──────────────────────────────────────────────────
export async function connectMessagesSocket() {
  const token = await getToken();
  messagesSocket = io(`${SOCKET_URL}/messages`, {
    auth: { token },
    transports: ['websocket'],
  });
  return messagesSocket;
}

export function getMessagesSocket() {
  return messagesSocket;
}

export function disconnectMessagesSocket() {
  if (messagesSocket) {
    messagesSocket.disconnect();
    messagesSocket = null;
  }
}
