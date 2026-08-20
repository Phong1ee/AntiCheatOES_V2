import { describe, expect, it } from 'vitest';
import { YUNET_MODEL_URL, YUNET_PRODUCTION_MODEL_URL } from '../camera-ai.config';

describe('YuNet production asset configuration', () => {
  it('uses a public production path while keeping the development comparison URL', () => {
    expect(YUNET_PRODUCTION_MODEL_URL).toMatch(/models\/camera\/face_detection_yunet_2023mar\.onnx$/);
    if (import.meta.env.DEV) {
      expect(YUNET_MODEL_URL).toBe('/__camera-evaluation-assets/face_detection_yunet_2023mar.onnx');
    } else {
      expect(YUNET_MODEL_URL).toBe(YUNET_PRODUCTION_MODEL_URL);
    }
  });
});
