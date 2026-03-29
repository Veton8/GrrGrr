/**
 * LiveKit Room wrapper for Web.
 * Uses @livekit/components-react which provides React hooks and components
 * that work with the browser's native WebRTC implementation.
 */
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  LiveKitRoom as LKRoom,
  VideoTrack,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

/**
 * LiveKitPublisher — Connects to a LiveKit room and publishes local camera + mic.
 * Used on the Go Live screen for the streamer.
 *
 * @param {Object} props
 * @param {string} props.url - LiveKit server URL (wss://...)
 * @param {string} props.token - LiveKit access token (publisher)
 * @param {React.ReactNode} props.children - Overlay content (chat, controls, etc.)
 * @param {Function} [props.onConnected] - Callback when connected to room
 * @param {Function} [props.onDisconnected] - Callback when disconnected
 * @param {Object} [props.style] - Container style
 */
export function LiveKitPublisher({ url, token, children, onConnected, onDisconnected, style }) {
  if (!url || !token) {
    return <View style={[styles.container, style]}>{children}</View>;
  }

  return (
    <LKRoom
      serverUrl={url}
      token={token}
      connect={true}
      video={true}
      audio={true}
      onConnected={onConnected}
      onDisconnected={onDisconnected}
      style={{ width: '100%', height: '100%' }}
    >
      <View style={[styles.container, style]}>
        <PublisherVideoView />
        {children}
      </View>
    </LKRoom>
  );
}

function PublisherVideoView() {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const localCameraTrack = tracks.find(
    (t) => t.participant.isLocal && t.source === Track.Source.Camera
  );

  if (!localCameraTrack) {
    return <View style={styles.placeholder} />;
  }

  return (
    <VideoTrack
      trackRef={localCameraTrack}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}

/**
 * LiveKitViewer — Connects to a LiveKit room and subscribes to the streamer's video.
 * Used on the Live Viewer screen.
 *
 * @param {Object} props
 * @param {string} props.url - LiveKit server URL
 * @param {string} props.token - LiveKit access token (subscriber)
 * @param {React.ReactNode} props.children - Overlay content
 * @param {Function} [props.onConnected] - Callback when connected
 * @param {Function} [props.onDisconnected] - Callback when disconnected
 * @param {Function} [props.onStreamEnded] - Callback when remote publisher disconnects
 * @param {Object} [props.style] - Container style
 */
export function LiveKitViewer({ url, token, children, onConnected, onDisconnected, onStreamEnded, style }) {
  if (!url || !token) {
    return <View style={[styles.container, style]}>{children}</View>;
  }

  return (
    <LKRoom
      serverUrl={url}
      token={token}
      connect={true}
      video={false}
      audio={false}
      onConnected={onConnected}
      onDisconnected={onDisconnected}
      style={{ width: '100%', height: '100%' }}
    >
      <View style={[styles.container, style]}>
        <ViewerVideoView onStreamEnded={onStreamEnded} />
        {children}
      </View>
    </LKRoom>
  );
}

function ViewerVideoView({ onStreamEnded }) {
  const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone], {
    onlySubscribed: true,
  });
  const remoteCameraTrack = tracks.find(
    (t) => !t.participant.isLocal && t.source === Track.Source.Camera
  );
  const remoteParticipants = useRemoteParticipants();

  // If there are no remote participants, the streamer has left
  React.useEffect(() => {
    if (remoteParticipants.length === 0 && onStreamEnded) {
      // Small delay to avoid false triggers during reconnection
      const timer = setTimeout(() => {
        if (remoteParticipants.length === 0) onStreamEnded();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [remoteParticipants.length, onStreamEnded]);

  if (!remoteCameraTrack) {
    return <View style={styles.placeholder} />;
  }

  return (
    <VideoTrack
      trackRef={remoteCameraTrack}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
    />
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
});
