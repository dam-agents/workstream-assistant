// Run a write against the API: busy while it runs, a notice when it fails, then load the view again.
import { useCallback, useState } from 'react';
import { sendPrompt } from '../api/platform';
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

/** Send a prompt into the open chat, or explain why it can't be. */
export function usePrompt() {
  const { notify } = useApp();
  return useCallback(
    (text: string, sent = 'Sent to the chat. If nothing arrives, open a chat first (send any message), then click again.') => {
      if (!sendPrompt(text)) {
        notify('warn', 'Prompt buttons work only in the docked preview beside the chat.');
        return false;
      }
      if (sent) notify('warn', sent);
      return true;
    },
    [notify],
  );
}
