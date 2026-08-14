import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestFullscreenOrThrow } from './fullscreen';

describe('requestFullscreenOrThrow', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects when a browser resolves requestFullscreen without entering fullscreen', async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('document', {
      documentElement: { requestFullscreen },
      fullscreenElement: null,
    });

    await expect(requestFullscreenOrThrow()).rejects.toThrow('did not enter fullscreen');
    expect(requestFullscreen).toHaveBeenCalledOnce();
  });
});
