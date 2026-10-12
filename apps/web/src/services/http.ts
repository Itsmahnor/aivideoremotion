import {ServiceError} from './types';

/** Base URL of the repo's own API server (apps/api). Configure with VITE_API_URL. Never put secrets in VITE_ variables. */
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000').replace(/\/$/, '');

type Options = RequestInit & {timeoutMs?: number};

export const request = async <T>(path: string, {timeoutMs = 30_000, signal, ...init}: Options = {}): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, {...init, signal: controller.signal});
  } catch (error) {
    if (signal?.aborted) throw new ServiceError('Cancelled.', 'network');
    if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
      throw new ServiceError(`The server at ${API_BASE} did not answer in time.`, 'timeout');
    }
    throw new ServiceError(`Cannot reach the API server at ${API_BASE}.`, 'network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
  const body = (await response.json().catch(() => null)) as ({error?: string; issues?: string[]} & Record<string, unknown>) | null;
  if (!response.ok) {
    const message = [body?.error ?? `Request failed with status ${response.status}.`, ...(body?.issues ?? [])].join('\n');
    throw new ServiceError(message, response.status >= 500 ? 'server' : 'rejected', response.status);
  }
  if (body === null) throw new ServiceError('The server sent a response that is not valid JSON.', 'invalid-response', response.status);
  return body as T;
};

export const jsonBody = (method: string, body: unknown): RequestInit => ({method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
