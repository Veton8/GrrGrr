import { useEffect, useRef } from 'react';
import { connectMessagesSocket, disconnectMessagesSocket } from '../services/socket';
import useMessageStore from '../store/messageStore';
import useAuthStore from '../store/authStore';

/**
 * Hook that connects the messages namespace socket on mount and
 * routes incoming events into the message store.
 *
 * Mount this once at the top level (e.g. inside AppNavigator when authenticated).
 */
export default function useMessagesSocket() {
  const socketRef = useRef(null);
  const { isAuthenticated } = useAuthStore();
  const addNewMessage = useMessageStore((s) => s.addNewMessage);

  useEffect(() => {
    if (!isAuthenticated) return;

    let mounted = true;

    connectMessagesSocket().then((socket) => {
      if (!mounted) {
        socket.disconnect();
        return;
      }
      socketRef.current = socket;

      socket.on('dm:message', (message) => {
        addNewMessage(message.conversationId, message);
      });

      socket.on('connect_error', (err) => {
        console.warn('[MessagesSocket] Connection error:', err.message);
      });
    });

    return () => {
      mounted = false;
      disconnectMessagesSocket();
      socketRef.current = null;
    };
  }, [isAuthenticated]);

  return socketRef;
}
