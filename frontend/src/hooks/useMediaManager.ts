import { useCallback, useEffect, useRef, useState } from "react";
import { MEDIA_CAPTURE_CONSTRAINTS, VISION_POLICY } from "../config/proctoring-policy";

type MediaSource = "camera" | "microphone";
type MediaEventType = "CAMERA_NOT_AVAILABLE" | "CAMERA_TRACK_MUTED" | "CAMERA_TRACK_ENDED" | "CAMERA_PERMISSION_DENIED" | "MIC_NOT_AVAILABLE" | "MIC_TRACK_MUTED" | "MIC_TRACK_ENDED";

interface MediaManagerOptions {
  active: boolean;
  initialStream?: MediaStream;
  onIncident: (eventType: MediaEventType, source: MediaSource, details: string, metadata: Record<string, string | number>) => void;
}

interface FamilyIncident {
  active: boolean;
  cooldownUntil: number;
  incidentId: string | null;
  muteTimer: number | null;
  healthyTimer: number | null;
  recoveryDenialReported: boolean;
}

const createFamily = (): FamilyIncident => ({ active: false, cooldownUntil: 0, incidentId: null, muteTimer: null, healthyTimer: null, recoveryDenialReported: false });
const isLive = (track: MediaStreamTrack | undefined) => Boolean(track && track.readyState === "live" && track.enabled);

export function useMediaManager({ active, initialStream, onIncident }: MediaManagerOptions) {
  const [stream, setStream] = useState<MediaStream | undefined>(initialStream);
  const [cameraLive, setCameraLive] = useState(false);
  const [microphoneLive, setMicrophoneLive] = useState(false);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | undefined>(initialStream);
  const familiesRef = useRef<Record<MediaSource, FamilyIncident>>({ camera: createFamily(), microphone: createFamily() });
  const suppressTrackEventsRef = useRef(false);

  const clearTimers = useCallback((family: FamilyIncident) => {
    if (family.muteTimer) window.clearTimeout(family.muteTimer);
    if (family.healthyTimer) window.clearTimeout(family.healthyTimer);
    family.muteTimer = null;
    family.healthyTimer = null;
  }, []);

  const stop = useCallback(() => {
    suppressTrackEventsRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    setStream(undefined);
    setCameraLive(false);
    setMicrophoneLive(false);
  }, []);

  const refreshState = useCallback(() => {
    const current = streamRef.current;
    setCameraLive(isLive(current?.getVideoTracks()[0]));
    setMicrophoneLive(isLive(current?.getAudioTracks()[0]));
  }, []);

  const openIncident = useCallback((source: MediaSource, eventType: MediaEventType, details: string) => {
    if (suppressTrackEventsRef.current) return;
    const family = familiesRef.current[source];
    if (family.active || Date.now() < family.cooldownUntil) return;
    clearTimers(family);
    family.active = true;
    family.incidentId = window.crypto.randomUUID();
    setRecoveryRequired(true);
    onIncident(eventType, source, details, {
      policyVersion: "1", incidentId: family.incidentId, sampleTimestamp: new Date().toISOString(), cooldownMs: VISION_POLICY.mediaHealth.cooldownMs,
    });
  }, [clearTimers, onIncident]);

  const scheduleHealthy = useCallback((source: MediaSource) => {
    const family = familiesRef.current[source];
    if (!family.active || family.healthyTimer) return;
    family.healthyTimer = window.setTimeout(() => {
      const current = streamRef.current;
      const live = source === "camera" ? isLive(current?.getVideoTracks()[0]) : isLive(current?.getAudioTracks()[0]);
      if (live) {
        family.active = false;
        family.incidentId = null;
        family.cooldownUntil = Date.now() + VISION_POLICY.mediaHealth.cooldownMs;
      }
      family.healthyTimer = null;
    }, VISION_POLICY.mediaHealth.recoveryMs);
  }, []);

  const reportRecoveryDenial = useCallback(() => {
    const family = familiesRef.current.camera;
    if (family.recoveryDenialReported) return;
    family.recoveryDenialReported = true;
    if (!family.incidentId) family.incidentId = window.crypto.randomUUID();
    family.active = true;
    setRecoveryRequired(true);
    onIncident("CAMERA_PERMISSION_DENIED", "camera", "Camera and microphone permission was denied during recovery.", {
      policyVersion: "1", incidentId: family.incidentId, sampleTimestamp: new Date().toISOString(), cooldownMs: VISION_POLICY.mediaHealth.cooldownMs,
    });
  }, [onIncident]);

  useEffect(() => {
    if (initialStream && initialStream !== streamRef.current) {
      suppressTrackEventsRef.current = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = initialStream;
      setStream(initialStream);
      refreshState();
      window.setTimeout(() => { suppressTrackEventsRef.current = false; }, 0);
    }
  }, [initialStream, refreshState]);

  useEffect(() => {
    if (!active || !stream) return;
    const listeners: Array<[MediaStreamTrack, "mute" | "unmute" | "ended", () => void]> = [];
    const attach = (track: MediaStreamTrack, source: MediaSource) => {
      const mutedEvent = source === "camera" ? "CAMERA_TRACK_MUTED" : "MIC_TRACK_MUTED";
      const endedEvent = source === "camera" ? "CAMERA_TRACK_ENDED" : "MIC_TRACK_ENDED";
      const onMute = () => {
        refreshState();
        const family = familiesRef.current[source];
        if (!family.muteTimer && !family.active) {
          family.muteTimer = window.setTimeout(() => {
            family.muteTimer = null;
            const current = source === "camera" ? streamRef.current?.getVideoTracks()[0] : streamRef.current?.getAudioTracks()[0];
            if (current?.muted || !isLive(current)) openIncident(source, mutedEvent, `${source === "camera" ? "Camera" : "Microphone"} track is unavailable.`);
          }, VISION_POLICY.mediaHealth.muteDurationMs);
        }
      };
      const onUnmute = () => { refreshState(); scheduleHealthy(source); };
      const onEnded = () => { refreshState(); openIncident(source, endedEvent, `${source === "camera" ? "Camera" : "Microphone"} track ended.`); };
      track.addEventListener("mute", onMute); track.addEventListener("unmute", onUnmute); track.addEventListener("ended", onEnded);
      listeners.push([track, "mute", onMute], [track, "unmute", onUnmute], [track, "ended", onEnded]);
    };
    stream.getVideoTracks().forEach((track) => attach(track, "camera"));
    stream.getAudioTracks().forEach((track) => attach(track, "microphone"));
    const onDeviceChange = () => {
      const current = streamRef.current;
      if (!isLive(current?.getVideoTracks()[0])) openIncident("camera", "CAMERA_NOT_AVAILABLE", "Camera device is unavailable.");
      if (!isLive(current?.getAudioTracks()[0])) openIncident("microphone", "MIC_NOT_AVAILABLE", "Microphone device is unavailable.");
      refreshState();
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
    refreshState();
    return () => {
      listeners.forEach(([track, type, listener]) => track.removeEventListener(type, listener));
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
    };
  }, [active, openIncident, refreshState, scheduleHealthy, stream]);

  const restore = useCallback(async () => {
    if (!active || recovering) return;
    setRecovering(true);
    setRecoveryError(null);
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia(MEDIA_CAPTURE_CONSTRAINTS);
      if (!isLive(nextStream.getVideoTracks()[0]) || !isLive(nextStream.getAudioTracks()[0])) {
        nextStream.getTracks().forEach((track) => track.stop());
        throw new Error("A live camera and microphone are both required.");
      }
      suppressTrackEventsRef.current = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = nextStream;
      setStream(nextStream);
      setCameraLive(true);
      setMicrophoneLive(true);
      window.setTimeout(() => { suppressTrackEventsRef.current = false; }, 0);
      await new Promise<void>((resolve) => window.setTimeout(resolve, VISION_POLICY.mediaHealth.recoveryMs));
      if (!isLive(nextStream.getVideoTracks()[0]) || !isLive(nextStream.getAudioTracks()[0])) throw new Error("Camera or microphone was not stable after recovery.");
      (Object.keys(familiesRef.current) as MediaSource[]).forEach((source) => {
        const family = familiesRef.current[source];
        clearTimers(family);
        family.active = false;
        family.incidentId = null;
        family.recoveryDenialReported = false;
        family.cooldownUntil = Date.now() + VISION_POLICY.mediaHealth.cooldownMs;
      });
      setRecoveryRequired(false);
    } catch (cause) {
      const denied = cause instanceof DOMException && cause.name === "NotAllowedError";
      if (denied) reportRecoveryDenial();
      setRecoveryRequired(true);
      setRecoveryError(cause instanceof Error ? cause.message : "Unable to restore camera and microphone.");
    } finally {
      setRecovering(false);
    }
  }, [active, clearTimers, recovering, reportRecoveryDenial]);

  useEffect(() => () => {
    (Object.keys(familiesRef.current) as MediaSource[]).forEach((source) => clearTimers(familiesRef.current[source]));
    stop();
  }, [clearTimers, stop]);

  return { stream, cameraLive, microphoneLive, recoveryRequired, recovering, recoveryError, restore, stop };
}
