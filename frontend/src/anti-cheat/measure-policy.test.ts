import { describe, expect, it } from 'vitest';

import {
  defaultAntiCheatMeasures,
  hasEnabledMonitoringGroup,
  setMonitoringGroupEnabled,
} from './measure-policy';

describe('anti-cheat monitoring group policy', () => {
  it('reports anti-cheat inactive when every monitoring group is disabled', () => {
    let measures = defaultAntiCheatMeasures();
    measures = setMonitoringGroupEnabled(measures, 'browser', false);
    measures = setMonitoringGroupEnabled(measures, 'camera', false);
    measures = setMonitoringGroupEnabled(measures, 'microphone', false);

    expect(hasEnabledMonitoringGroup(measures)).toBe(false);
  });

  it('reports anti-cheat active when any monitoring group is enabled', () => {
    let measures = defaultAntiCheatMeasures();
    measures = setMonitoringGroupEnabled(measures, 'browser', false);
    measures = setMonitoringGroupEnabled(measures, 'camera', false);
    measures = setMonitoringGroupEnabled(measures, 'microphone', true);

    expect(hasEnabledMonitoringGroup(measures)).toBe(true);
  });
});
