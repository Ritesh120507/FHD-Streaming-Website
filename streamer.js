/**
 * NovaStream - Streamer Controller Module
 * Handles 1080p60 screen capture, WebRTC host connection, Firestore signaling & viewer tracking
 */

import { doc, setDoc, updateDoc, onSnapshot, collection, addDoc, deleteDoc, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initFirebase } from './firebase-config.js';
import { getCurrentUser } from './auth.js';
import { RTC_CONFIG, captureDisplayMedia, captureMicrophone, mixAudioStreams, optimizeSenderParameters, enhanceSDP, startStatsMonitor, prioritize4KCodecs } from './webrtc.js';

let activeStream = null;
let micStream = null;
let peerConnection = null;
let currentRoomId = null;
let stopStatsMonitor = null;
let roomUnsubscribe = null;
let candidatesUnsubscribe = null;
let isHostMicMuted = false;
let qualityEnforcerInterval = null;

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Start streaming from this device
 */
export async function startStream(options = {}, callbacks = {}) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error("You must be signed in with Google to start streaming.");
  }

  const { db } = initFirebase();
  if (!db) {
    throw new Error("Firebase database is not initialized.");
  }

  const {
    resolution = '1080p',
    frameRate = 60,
    bitrateMbps = 10,
    includeMic = false
  } = options;

  const {
    onStreamReady,
    onViewerConnected,
    onViewerDisconnected,
    onViewerVoiceReceived,
    onStatsUpdate,
    onStreamEnded,
    onError
  } = callbacks;

  try {
    // 1. Capture Screen / Display Media with 1080p60 & System Audio
    const displayStream = await captureDisplayMedia({
      resolution,
      frameRate,
      includeAudio: true,
      contentHint: 'motion'
    });
    activeStream = displayStream;

    // Handle user stopping screen share via browser floating bar
    const videoTrack = displayStream.getVideoTracks()[0];
    videoTrack.onended = () => {
      console.log("[NovaStream] Display track ended by user.");
      stopStream();
    };

    // 2. Optional: Capture & mix microphone
    let finalAudioTrack = null;
    if (includeMic) {
      micStream = await captureMicrophone();
      finalAudioTrack = mixAudioStreams(displayStream, micStream);
    } else if (displayStream.getAudioTracks().length > 0) {
      finalAudioTrack = displayStream.getAudioTracks()[0];
    }

    // 3. Create WebRTC PeerConnection
    peerConnection = new RTCPeerConnection(RTC_CONFIG);

    // Add video track
    const videoSender = peerConnection.addTrack(videoTrack, activeStream);

    // Initial sender optimization for native resolution & locked 60 FPS
    optimizeSenderParameters(videoSender, bitrateMbps * 1000000, frameRate);

    // Add audio track if present, or add recvonly transceiver so host can receive viewer voice
    let audioSender = null;
    if (finalAudioTrack) {
      audioSender = peerConnection.addTrack(finalAudioTrack, activeStream);
    } else {
      peerConnection.addTransceiver('audio', { direction: 'recvonly' });
    }

    // Listen for incoming viewer voice chat
    peerConnection.ontrack = (event) => {
      if (event.receiver) {
        if ('playoutDelayHint' in event.receiver) {
          event.receiver.playoutDelayHint = 0; // Immediate playout for host voice reception
        }
        if ('jitterBufferTarget' in event.receiver) {
          event.receiver.jitterBufferTarget = 0;
        }
      }
      if (event.track.kind === 'audio') {
        console.log("[NovaStream] Streamer received viewer voice stream!");
        if (onViewerVoiceReceived) {
          onViewerVoiceReceived(event.streams[0] || new MediaStream([event.track]));
        }
      }
    };

    // Prioritize high-efficiency 4K hardware codecs (VP9, AV1, H264)
    prioritize4KCodecs(peerConnection);

    // 4. Generate Room ID and Firestore references
    currentRoomId = generateRoomId();
    const roomRef = doc(db, 'rooms', currentRoomId);
    const callerCandidatesCollection = collection(roomRef, 'callerCandidates');
    const calleeCandidatesCollection = collection(roomRef, 'calleeCandidates');

    // 5. Gather ICE Candidates and push to Firestore
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(callerCandidatesCollection, event.candidate.toJSON()).catch(e => {
          console.warn("[NovaStream] Failed to send caller ICE candidate:", e);
        });
      }
    };

    // Connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log("[NovaStream] Host connection state:", peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        // Enforce maximum bitrate and 60 FPS on connect
        optimizeSenderParameters(videoSender, bitrateMbps * 1000000, frameRate);
      } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
        if (onViewerDisconnected) onViewerDisconnected();
      }
    };

    // Continuous Quality Enforcer: Re-locks 60 FPS & 1:1 native resolution every 2.5s throughout stream
    if (qualityEnforcerInterval) clearInterval(qualityEnforcerInterval);
    qualityEnforcerInterval = setInterval(() => {
      if (peerConnection && videoSender && (peerConnection.connectionState === 'connected' || peerConnection.iceConnectionState === 'connected')) {
        optimizeSenderParameters(videoSender, bitrateMbps * 1000000, frameRate);
      }
    }, 2500);

    // 6. Create SDP Offer with Bitrate Enhancement
    const offer = await peerConnection.createOffer();
    const enhancedSdp = enhanceSDP(offer.sdp, bitrateMbps * 1000);
    const sdpDescription = new RTCSessionDescription({ type: offer.type, sdp: enhancedSdp });
    await peerConnection.setLocalDescription(sdpDescription);

    let remoteDescriptionSet = false;
    const pendingCandidates = [];

    // Save initial room data with Offer
    await setDoc(roomRef, {
      status: 'waiting',
      createdAt: Date.now(),
      settings: {
        resolution,
        frameRate,
        bitrateMbps
      },
      host: {
        uid: user.uid,
        displayName: user.displayName || 'Streamer',
        email: user.email,
        photoURL: user.photoURL || ''
      },
      offer: {
        type: sdpDescription.type,
        sdp: sdpDescription.sdp
      }
    });

    // 7. Listen for Viewer's SDP Answer
    roomUnsubscribe = onSnapshot(roomRef, async (snapshot) => {
      const data = snapshot.data();
      if (!data) return;

      if (!peerConnection.currentRemoteDescription && data.answer) {
        console.log("[NovaStream] Received Answer from viewer:", data.viewer);
        const answerDescription = new RTCSessionDescription(data.answer);
        await peerConnection.setRemoteDescription(answerDescription);
        remoteDescriptionSet = true;

        // Drain any pending callee ICE candidates that arrived before Answer was processed
        for (const cand of pendingCandidates) {
          try {
            await peerConnection.addIceCandidate(cand);
          } catch (e) {
            console.warn("[NovaStream] Error adding queued callee candidate:", e);
          }
        }
        pendingCandidates.length = 0;

        if (data.viewer && onViewerConnected) {
          onViewerConnected(data.viewer);
        }
      }
    });

    // 8. Listen for Viewer ICE candidates (with queueing if remote description not yet set)
    candidatesUnsubscribe = onSnapshot(calleeCandidatesCollection, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const candidateData = change.doc.data();
          if (!candidateData || !candidateData.candidate) return;
          try {
            const candidate = new RTCIceCandidate(candidateData);
            if (remoteDescriptionSet && peerConnection && peerConnection.currentRemoteDescription) {
              await peerConnection.addIceCandidate(candidate);
            } else {
              pendingCandidates.push(candidate);
            }
          } catch (e) {
            console.warn("[NovaStream] Error adding callee ICE candidate:", e);
          }
        }
      });
    });

    // 9. Start live telemetry HUD stats monitor
    if (onStatsUpdate) {
      stopStatsMonitor = startStatsMonitor(peerConnection, onStatsUpdate, 1000);
    }

    // Notify UI that stream is locally ready and active
    if (onStreamReady) {
      onStreamReady({
        roomId: currentRoomId,
        stream: displayStream,
        settings: { resolution, frameRate, bitrateMbps }
      });
    }

    return {
      roomId: currentRoomId,
      stream: displayStream
    };
  } catch (error) {
    console.error("[NovaStream] Start stream failure:", error);
    await stopStream();
    if (onError) onError(error);
    throw error;
  }
}

/**
 * End current active stream and clean up Firestore room
 */
export async function stopStream() {
  if (qualityEnforcerInterval) {
    clearInterval(qualityEnforcerInterval);
    qualityEnforcerInterval = null;
  }

  if (stopStatsMonitor) {
    stopStatsMonitor();
    stopStatsMonitor = null;
  }

  if (roomUnsubscribe) {
    roomUnsubscribe();
    roomUnsubscribe = null;
  }

  if (candidatesUnsubscribe) {
    candidatesUnsubscribe();
    candidatesUnsubscribe = null;
  }

  if (peerConnection) {
    try {
      peerConnection.close();
    } catch (e) {}
    peerConnection = null;
  }

  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }

  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
  }

  // Update Firestore room status to ended
  if (currentRoomId) {
    try {
      const { db } = initFirebase();
      if (db) {
        const roomRef = doc(db, 'rooms', currentRoomId);
        await updateDoc(roomRef, {
          status: 'ended',
          endedAt: Date.now()
        });
      }
    } catch (e) {
      console.warn("[NovaStream] Could not mark room as ended:", e);
    }
    currentRoomId = null;
  }
}

export function getActiveStream() {
  return activeStream;
}

export function getCurrentRoomId() {
  return currentRoomId;
}

/**
 * Toggle or set streamer microphone mute state
 */
export function setStreamerMicMuted(muted) {
  isHostMicMuted = Boolean(muted);
  if (micStream) {
    micStream.getAudioTracks().forEach(track => {
      track.enabled = !isHostMicMuted;
    });
  }
  return isHostMicMuted;
}

export function getStreamerMicMuted() {
  return isHostMicMuted;
}

