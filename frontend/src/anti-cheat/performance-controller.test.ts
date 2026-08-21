import { describe, expect, it } from 'vitest';
import { PerformanceController } from './performance-controller';

describe('PerformanceController face sampling', () => {
  it('targets the evaluated 15 FPS cadence for a YuNet-speed inference', () => {
    const controller = new PerformanceController('face');
    controller.record(40);

    expect(controller.targetFps).toBe(15);
    expect(controller.nextDelayMs()).toBeCloseTo(26.67, 1);
  });

  it('reduces the target FPS when inference cannot meet the 15 FPS frame budget', () => {
    const controller = new PerformanceController('face');
    controller.record(120);

    expect(controller.targetFps).toBe(6);
    expect(controller.nextDelayMs()).toBeCloseTo(46.67, 1);
  });
});
