import { Platform } from 'react-native';
import { io } from 'socket.io-client';

// Default dev server URL — update this if using a tunnel for phone testing
const DEV_SOCKET = 'http://localhost:3000';

const getSocketUrl = () => {
  if (!__DEV__) return 'https://api.grgr.app';
  return DEV_SOCKET;
};
const SOCKET_URL = getSocketUrl();

let liveSocket = null;

const getToken = async () => {
  if (Platform.OS === 'web') {
    return localStorage.getItem('accessToken');
  }
  const SecureStore = require('expo-secure-store');
  return SecureStore.getItemAsync('accessToken');
};

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
