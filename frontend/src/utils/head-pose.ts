export type HeadPose = { yaw: number; pitch: number; roll: number };

// MediaPipe returns the facial transformation as a 4x4 row-major rotation and
// translation matrix. Extract only the rotation component for review-only pose.
export function headPoseFromTransformationMatrix(data: readonly number[]): HeadPose | null {
  if (data.length !== 16 || data.some((value) => !Number.isFinite(value))) return null;
  const r00 = data[0]; const r01 = data[1]; const r02 = data[2];
  const r10 = data[4]; const r11 = data[5]; const r12 = data[6];
  const r20 = data[8]; const r21 = data[9]; const r22 = data[10];
  const horizontal = Math.hypot(r00, r10);
  const radiansToDegrees = 180 / Math.PI;
  if (horizontal < 1e-6) return { yaw: Math.atan2(-r02, r11) * radiansToDegrees, pitch: Math.atan2(-r20, horizontal) * radiansToDegrees, roll: 0 };
  return {
    yaw: Math.atan2(r10, r00) * radiansToDegrees,
    pitch: Math.atan2(-r20, horizontal) * radiansToDegrees,
    roll: Math.atan2(r21, r22) * radiansToDegrees,
  };
}

export function ema(previous: number | null, next: number, alpha = 0.3) {
  return previous === null ? next : previous + alpha * (next - previous);
}
