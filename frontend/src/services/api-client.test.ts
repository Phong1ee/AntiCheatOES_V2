// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from './api-client';
vi.mock('./auth.storage', () => ({ authStorage: { getToken: () => 'test-token', clearToken: vi.fn() } }));

it('preserves multipart file bytes and authorization instead of serializing FormData as JSON', async () => {
  const form = new FormData();
  const file = new File(['binary-media'], 'sample.wav', { type: 'audio/wav' });
  form.append('file', file);
  let captured: InternalAxiosRequestConfig | undefined;
  await apiClient.post('/upload', form, { adapter: async config => {
    captured = config;
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  } });
  expect(captured?.data).toBe(form);
  expect(captured?.data.get('file')).toBe(file);
  expect(captured?.headers.get('Content-Type')).not.toBe('application/json');
  expect(captured?.headers.get('Authorization')).toBe('Bearer test-token');
});

it('retains JSON serialization for ordinary API requests', async () => {
  let captured: InternalAxiosRequestConfig | undefined;
  await apiClient.post('/question', { question_text: 'Example' }, { adapter: async config => {
    captured = config;
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  } });
  expect(captured?.headers.get('Content-Type')).toBe('application/json');
  expect(JSON.parse(captured?.data)).toEqual({ question_text: 'Example' });
});
