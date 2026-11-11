// The artifact host injects `platform` into the page: request() reaches the agent's API server, sendPrompt()
// types into the open chat. Both exist only in the docked preview beside the chat, on the latest version.

interface PlatformResponse {
  status: number;
  body: string;
}

interface Platform {
  request(req: { method: string; path: string; body?: string }): Promise<PlatformResponse>;
  sendPrompt?(text: string): void;
}

declare global {
  // eslint-disable-next-line no-var
  var platform: Platform | undefined;
}

export const hasPlatform = (): boolean => typeof globalThis.platform?.request === 'function';

export const canPrompt = (): boolean => typeof globalThis.platform?.sendPrompt === 'function';

export function sendPrompt(text: string): boolean {
  if (!canPrompt()) return false;
  globalThis.platform!.sendPrompt!(text);
  return true;
}

export const rawRequest = (req: { method: string; path: string; body?: string }) => globalThis.platform!.request(req);
