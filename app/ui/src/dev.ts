// `npm run dev` only: outside the artifact frame there is no `platform`, so stand one in that calls the
// API through Vite's proxy and logs prompts to the console. Not part of the built page.
export function installDevPlatform() {
  if (globalThis.platform) return;
  globalThis.platform = {
    async request({ method, path, body }) {
      const res = await fetch(path, { method, body });
      return { status: res.status, body: await res.text() };
    },
    sendPrompt: (text) => console.info('[prompt]', text),
  };
}
