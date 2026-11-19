// Run a write against the API: busy while it runs, a notice when it fails, then load the view again.
import { useCallback, useState } from 'react';
import { sendPrompt } from '../api/platform';
import type { PromptOptions } from '../api/platform';
import { useApp } from './AppContext';

export function useAction() {
  const { notify, reload } = useApp();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (fn: () => Promise<unknown>, { reloadAfter = true, failure = "Couldn't save" } = {}) => {
      setBusy(true);
      try {
        await fn();
        if (reloadAfter) reload();
        return true;
      } catch (e) {
        notify('err', `${failure}: ${(e as Error).message}`);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [notify, reload],
  );
  return { busy, run };
}

export const SENT_TO_SESSION = 'Started in a new session of its own: open it from your sessions list.';

/**
 * Send a prompt to the agent, or explain why it can't be. With `conversation`, it starts (or continues) a Session of
 * its own; without, it goes into the open chat, or the owner's Session for this page when there's none.
 */
export function usePrompt() {
  const { notify } = useApp();
  return useCallback(
    (text: string, sent?: string, opts?: PromptOptions) => {
      if (sent === undefined) sent = opts?.conversation ? SENT_TO_SESSION : 'Sent to the chat.';
      if (!sendPrompt(text, opts ?? { newSession: true })) {
        notify('warn', 'Prompt buttons work only on the latest version of this page.');
        return false;
      }
      if (sent) notify('warn', sent);
      return true;
    },
    [notify],
  );
}
