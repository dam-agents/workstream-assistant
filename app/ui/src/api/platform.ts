// The artifact host injects `platform` into the page: request() reaches the agent's API server, sendPrompt()
// sends a prompt to the agent. Both exist only on the latest version.
//
// sendPrompt options: `conversation: key` starts (or, with the same key, continues) a Session of its own for that
// conversation, so a debrief or an ask doesn't land in the middle of whatever the chat is doing; `newSession: true`
// lets a button work outside the chat too, while beside the chat it still goes into the chat.

interface PlatformResponse {
  status: number;
  body: string;
}

interface Platform {
  request(req: { method: string; path: string; body?: string }): Promise<PlatformResponse>;
  sendPrompt?(text: string, opts?: PromptOptions): void;
}

export interface PromptOptions {
  newSession?: boolean;
  conversation?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var platform: Platform | undefined;
}

export const hasPlatform = (): boolean => typeof globalThis.platform?.request === 'function';

export const canPrompt = (): boolean => typeof globalThis.platform?.sendPrompt === 'function';

/** A conversation key the platform accepts: 1–64 letters, digits, dots, underscores or hyphens. */
export const conversationKey = (...parts: (string | number)[]): string =>
  parts.join('-').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64);

export function sendPrompt(text: string, opts: PromptOptions = { newSession: true }): boolean {
  if (!canPrompt()) return false;
  globalThis.platform!.sendPrompt!(text, opts);
  return true;
}

export const rawRequest = (req: { method: string; path: string; body?: string }) => globalThis.platform!.request(req);
