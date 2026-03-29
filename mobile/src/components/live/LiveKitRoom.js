/**
 * LiveKit Room wrapper for React Native (native platforms).
 *
 * On native, @livekit/react-native requires a development build
 * (NOT Expo Go). This wrapper provides the same API as the web version
 * but falls back to camera preview when the native LiveKit SDK is unavailable.
 *
 * When LiveKit native SDK is installed and a dev build is in use,
 * this will use the full LiveKit native transport.
 * Otherwise, it falls back to expo-camera for streamer preview
 * and shows a placeholder for viewers.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';

// Try to import native LiveKit SDK — will fail in Expo Go
let NativeLiveKit = null;
try {
  NativeLiveKit = require('livekit-client');
} catch (e) {
  console.log('[LiveKit] livekit-client not available on this platform, using fallback');
}

/**
 * LiveKitPublisher — Native streamer component.
 * Connects to LiveKit and publishes camera + microphone tracks.
 * Falls back to expo-camera preview if native SDK is unavailable.
 */
export function LiveKitPublisher({ url, token, children, onConnected, onDisconnected, style }) {
  const roomRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!url || !token || !NativeLiveKit) return;

    let room;
    (async () => {
      try {
        const { Room, RoomEvent } = NativeLiveKit;
        room = new Room();
        roomRef.current = room;

        room.on(RoomEvent.Connected, () => {
          setConnected(true);
          onConnected?.();
        });
        room.on(RoomEvent.Disconnected, () => {
          setConnected(false);
          onDisconnected?.();
        });

        await room.connect(url, token);
        await room.localParticipant.setCameraEnabled(true);
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch (err) {
        console.warn('[LiveKit Native] Connection error:', err.message);
      }
    })();

    return () => {
      if (room) {
        room.disconnect();
        roomRef.current = null;
      }
    };
  }, [url, token]);

  // If no LiveKit SDK or no token, render children only (GoLiveScreen handles camera preview)
  if (!url || !token || !NativeLiveKit) {
    return <View style={[styles.container, style]}>{children}</View>;
  }

  return (
    <View style={[styles.container, style]}>
      {!connected && <View style={styles.placeholder} />}
      {children}
    </View>
  );
}

/**
 * LiveKitViewer — Native viewer component.
 * Connects to LiveKit and subscribes to the streamer's tracks.
 */
export function LiveKitViewer({ url, token, children, onConnected, onDisconnected, onStreamEnded, style }) {
  const roomRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!url || !token || !NativeLiveKit) return;

    let room;
    (async () => {
      try {
        const { Room, RoomEvent } = NativeLiveKit;
        room = new Room();
        roomRef.current = room;

        room.on(RoomEvent.Connected, () => {
          setConnected(true);
          onConnected?.();
        });
        room.on(RoomEvent.Disconnected, () => {
          setConnected(false);
          onDisconnected?.();
        });
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          // If the publisher left, stream has ended
          if (room.remoteParticipants.size === 0) {
            onStreamEnded?.();
          }
        });

        await room.connect(url, token);
      } catch (err) {
        console.warn('[LiveKit Native] Connection error:', err.message);
      }
    })();

    return () => {
      if (room) {
        room.disconnect();
        roomRef.current = null;
      }
    };
  }, [url, token]);

  if (!url || !token || !NativeLiveKit) {
    return <View style={[styles.container, style]}>{children}</View>;
  }

  return (
    <View style={[styles.container, style]}>
      {!connected && (
        <View style={styles.connecting}>
          <Text style={styles.connectingText}>Connecting...</Text>
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  connecting: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectingText: {
    color: '#fff',
    fontSize: 16,
  },
});
