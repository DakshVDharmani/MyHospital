import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

/* ============================================================================
 *  Free 1:1 WebRTC pipeline.
 *
 *  Signaling  : Supabase Realtime broadcast channel `rtc:<room>` (no server).
 *  Transport  : peer-to-peer RTCPeerConnection.
 *  ICE        : Google public STUN only — no paid TURN. This connects for the
 *               common case (at least one peer not behind symmetric NAT);
 *               strict-NAT pairs would need a TURN server, which costs money.
 *
 *  Implements MDN's "perfect negotiation" so either side may (re)negotiate
 *  without glare. Politeness is derived from the two random session ids.
 * ==========================================================================*/

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export type CallStatus =
  | 'idle'
  | 'requesting_media'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed';

interface SignalMsg {
  from: string;
  hello?: true;
  bye?: true;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
}

export interface WebRtcRoom {
  status: CallStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerPresent: boolean;
  micOn: boolean;
  camOn: boolean;
  error: string | null;
  toggleMic: () => void;
  toggleCam: () => void;
  hangUp: () => void;
  retry: () => void;
}

export function useWebRtcRoom(room: string | null, enabled: boolean): WebRtcRoom {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerPresent, setPeerPresent] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const selfIdRef = useRef<string>(crypto.randomUUID());
  const otherIdRef = useRef<string | null>(null);
  const politeRef = useRef<boolean>(false);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const helloTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleMic = useCallback(() => {
    const t = localRef.current?.getAudioTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setMicOn(t.enabled);
    }
  }, []);

  const toggleCam = useCallback(() => {
    const t = localRef.current?.getVideoTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setCamOn(t.enabled);
    }
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const hangUp = useCallback(() => {
    chanRef.current?.send({
      type: 'broadcast',
      event: 'signal',
      payload: { from: selfIdRef.current, bye: true } satisfies SignalMsg,
    });
    if (helloTimerRef.current) {
      clearInterval(helloTimerRef.current);
      helloTimerRef.current = null;
    }
    setStatus('disconnected');
    pcRef.current?.close();
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    if (chanRef.current) {
      void supabase.removeChannel(chanRef.current);
      chanRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !room) return;

    let disposed = false;
    const selfId = selfIdRef.current;
    otherIdRef.current = null;
    setError(null);

    const send = (payload: SignalMsg) => {
      const kind = payload.bye
        ? 'bye'
        : payload.description
          ? payload.description.type
          : payload.candidate !== undefined
            ? 'ice'
            : 'hello';
      console.debug('[rtc] →', kind);
      return chanRef.current?.send({ type: 'broadcast', event: 'signal', payload });
    };

    const buildPc = (stream: MediaStream) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const remote = new MediaStream();
      setRemoteStream(remote);
      pc.ontrack = (e) => {
        e.streams[0]?.getTracks().forEach((t) => {
          if (!remote.getTracks().some((x) => x.id === t.id)) remote.addTrack(t);
        });
      };

      pc.onicecandidate = ({ candidate }) => send({ from: selfId, candidate: candidate?.toJSON() ?? null });

      pc.onnegotiationneeded = async () => {
        try {
          makingOfferRef.current = true;
          await pc.setLocalDescription();
          send({ from: selfId, description: pc.localDescription ?? undefined });
        } catch (err) {
          console.error('negotiation failed', err);
        } finally {
          makingOfferRef.current = false;
        }
      };

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        if (s === 'connected' || s === 'completed') setStatus('connected');
        else if (s === 'disconnected') setStatus('disconnected');
        else if (s === 'failed') {
          setStatus('failed');
          pc.restartIce();
        }
      };

      return pc;
    };

    const handleSignal = async (msg: SignalMsg) => {
      if (msg.from === selfId) return;
      console.debug(
        '[rtc] ←',
        msg.bye ? 'bye' : msg.description?.type ?? (msg.candidate !== undefined ? 'ice' : 'hello'),
        'from',
        msg.from.slice(0, 8),
      );
      const pc = pcRef.current;
      if (!pc) return;

      if (msg.bye) {
        setPeerPresent(false);
        setStatus('disconnected');
        return;
      }

      // A "hello" is any presence ping that carries no SDP / ICE / bye.
      const isHello = !msg.description && msg.candidate === undefined;
      if (isHello) {
        if (!otherIdRef.current) {
          otherIdRef.current = msg.from;
          politeRef.current = selfId < msg.from; // deterministic, symmetric
          if (helloTimerRef.current) {
            clearInterval(helloTimerRef.current);
            helloTimerRef.current = null;
          }
          console.debug('[rtc] peer found', msg.from, 'polite=', politeRef.current);
          setPeerPresent(true);
          setStatus('connecting');
          // Re-announce so a peer that joined first also learns about us.
          send({ from: selfId });
          // The impolite peer drives the initial offer.
          if (!politeRef.current) {
            try {
              makingOfferRef.current = true;
              await pc.setLocalDescription();
              send({ from: selfId, description: pc.localDescription ?? undefined });
            } finally {
              makingOfferRef.current = false;
            }
          }
        }
        return;
      }

      try {
        if (msg.description) {
          const offerCollision =
            msg.description.type === 'offer' &&
            (makingOfferRef.current || pc.signalingState !== 'stable');
          ignoreOfferRef.current = !politeRef.current && offerCollision;
          if (ignoreOfferRef.current) return;

          await pc.setRemoteDescription(msg.description);
          if (msg.description.type === 'offer') {
            await pc.setLocalDescription();
            send({ from: selfId, description: pc.localDescription ?? undefined });
          }
        } else if (msg.candidate !== undefined) {
          try {
            if (msg.candidate) await pc.addIceCandidate(msg.candidate);
          } catch (err) {
            if (!ignoreOfferRef.current) throw err;
          }
        }
      } catch (err) {
        console.error('signal handling failed', err);
      }
    };

    (async () => {
      try {
        setStatus('requesting_media');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localRef.current = stream;
        setLocalStream(stream);
        setMicOn(stream.getAudioTracks()[0]?.enabled ?? false);
        setCamOn(stream.getVideoTracks()[0]?.enabled ?? false);

        buildPc(stream);
        setStatus('waiting');

        const channel = supabase.channel(`rtc:${room}`, {
          config: { broadcast: { self: false } },
        });
        chanRef.current = channel;
        channel.on('broadcast', { event: 'signal' }, ({ payload }) =>
          handleSignal(payload as SignalMsg),
        );
        channel.subscribe((s, err) => {
          console.debug('[rtc] channel', `rtc:${room}`, '->', s, err ?? '');
          if (s === 'SUBSCRIBED') {
            send({ from: selfId }); // hello
            // Re-announce until the peer answers — covers a hello that was
            // broadcast before the other side had subscribed.
            if (helloTimerRef.current) clearInterval(helloTimerRef.current);
            helloTimerRef.current = setInterval(() => {
              if (otherIdRef.current) {
                if (helloTimerRef.current) clearInterval(helloTimerRef.current);
                helloTimerRef.current = null;
                return;
              }
              send({ from: selfId });
            }, 1500);
          } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
            setError(
              'Could not reach the signaling channel (Supabase Realtime). Check that Realtime is enabled for the project.',
            );
            setStatus('failed');
          }
        });
      } catch (err) {
        const e = err as DOMException;
        setError(
          e?.name === 'NotAllowedError'
            ? 'Camera/microphone permission was denied.'
            : e?.name === 'NotFoundError'
              ? 'No camera or microphone was found.'
              : e?.message || 'Could not start the call.',
        );
        setStatus('failed');
      }
    })();

    return () => {
      disposed = true;
      if (helloTimerRef.current) {
        clearInterval(helloTimerRef.current);
        helloTimerRef.current = null;
      }
      pcRef.current?.close();
      pcRef.current = null;
      localRef.current?.getTracks().forEach((t) => t.stop());
      localRef.current = null;
      if (chanRef.current) {
        chanRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: { from: selfId, bye: true } satisfies SignalMsg,
        });
        void supabase.removeChannel(chanRef.current);
        chanRef.current = null;
      }
      setLocalStream(null);
      setRemoteStream(null);
      setPeerPresent(false);
      setStatus('idle');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, enabled, attempt]);

  return {
    status,
    localStream,
    remoteStream,
    peerPresent,
    micOn,
    camOn,
    error,
    toggleMic,
    toggleCam,
    hangUp,
    retry,
  };
}
