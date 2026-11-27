// The app against a stand-in for `platform`, as the artifact frame provides it.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../src/App';
import { AppProvider } from '../src/state/AppContext';
import { summary, ws } from './fixtures';

type Req = { method: string; path: string; body?: string };

/** A workstream's page as the API returns it, from its dashboard row. */
export const page = (w: ReturnType<typeof ws>, over: object = {}) => ({
  ...w,
  state: 'approved',
  key_points: '',
  epic_label: null,
  epic_url: null,
  updated_at: '2026-11-11T09:00:00+01:00',
  asks: [],
  followups: [],
  deadlines: [],
  prebriefs: [],
  progress: [],
  notes: [],
  ...over,
});

function mockPlatform(data: ReturnType<typeof summary>, pages: Record<string, object> = {}) {
  const calls: Req[] = [];
  globalThis.platform = {
    request: vi.fn(async (req: Req) => {
      calls.push(req);
      const id = req.path.match(/workstreams\/([\w-]+)/)?.[1];
      const w = id && data.workstreams.find((x) => x.id === id);
      if (req.method === 'PATCH' && w) {
        Object.assign(w, JSON.parse(req.body!));
        return { status: 200, body: JSON.stringify(page(w)) };
      }
      if (req.method === 'GET' && w) return { status: 200, body: JSON.stringify(pages[w.id] ?? page(w)) };
      return { status: 200, body: JSON.stringify(data) };
    }),
    sendPrompt: vi.fn(),
  };
  return calls;
}

const renderApp = async () => {
  render(
    <AppProvider>
      <App />
    </AppProvider>,
  );
  await screen.findByText('Live');
};

afterEach(() => {
  globalThis.platform = undefined;
});

const lane = (name: string) => screen.getByRole('region', { name });

it('lists only workstreams, in lanes, with Low collapsed and saying what needs you', async () => {
  mockPlatform(summary([ws({ id: 'Focused', focus: true }), ws({ id: 'Plain' }), ws({ id: 'Quiet', priority: 'low', asks_open: 1 })]));
  await renderApp();
  const list = screen.getByRole('complementary', { name: 'Your Work' });
  expect(within(list).queryByText('Debriefs')).toBeNull();
  expect(within(lane('Focus today')).getByText('Focused')).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'High priority' })).toBeNull(); // empty, and nothing is being dragged
  expect(within(lane('Other')).getByText('Plain')).toBeTruthy();
  expect(within(lane('Low priority')).queryByText('Quiet')).toBeNull();
  expect(within(lane('Low priority')).getByText(/1 need you/)).toBeTruthy();
  fireEvent.click(screen.getByText('Low priority'));
  expect(within(lane('Low priority')).getByText('Quiet')).toBeTruthy();
});

it('opens the debriefs beside the list, from the bar above the pane, and a workstream on click', async () => {
  const data = summary([ws({ id: 'a', ref: 3, name: 'Alpha', asks_open: 2 }), ws({ id: 'b', ref: 4, name: 'Beta' })]);
  data.debriefs = [{ id: 9, title: '2026-11-19 Sync with Cleo', url: null, why: 'You promised the plan.', workstreams: 'W3', meeting_ts: '2026-11-19T09:00:00+01:00', source_name: 'Notetaker', state: 'proposed', started_at: null }];
  const calls = mockPlatform(data);
  await renderApp();
  expect(await screen.findByRole('heading', { name: 'Debriefs', level: 2 })).toBeTruthy();
  const bar = screen.getByRole('navigation', { name: 'Inbox' });
  expect(within(bar).getByRole('button', { name: /Debriefs/ }).getAttribute('aria-current')).toBe('page');
  expect(within(bar).queryByRole('button', { name: /Suggested/ })).toBeNull(); // nothing to approve
  expect(screen.getByText('2026-11-19 Sync with Cleo')).toBeTruthy();
  expect(screen.getByRole('button', { name: /^W3Alpha$/ })).toBeTruthy(); // the workstream it touches, as a chip
  await act(async () => {
    fireEvent.click(screen.getByLabelText('W4 Beta'));
  });
  expect(await screen.findByRole('heading', { name: 'Beta', level: 2 })).toBeTruthy();
  expect(screen.getByLabelText('W4 Beta').getAttribute('aria-current')).toBe('page');
  expect(calls.some((c) => c.method === 'GET' && c.path.startsWith('/api/workstreams/b'))).toBe(true);
});

it('Focus today on a workstream page saves the focus', async () => {
  const calls = mockPlatform(summary([ws({ id: 'a', ref: 1, name: 'Alpha' })]));
  await renderApp();
  fireEvent.click(screen.getByLabelText('W1 Alpha'));
  const focus = await screen.findByText('Focus today', { selector: 'button' });
  await act(async () => {
    fireEvent.click(focus);
  });
  const patches = calls.filter((c) => c.method === 'PATCH').map((c) => [c.path.split('?')[0], JSON.parse(c.body!)]);
  expect(patches).toEqual([['/api/workstreams/a', { focus: true }]]);
});

it('splits to-dos into what needs you and what waits on others', async () => {
  const data = summary([ws({ id: 'a', name: 'Alpha', asks_open: 1 })]);
  const t = data.generated_at;
  mockPlatform(data, {
    a: page(data.workstreams[0], {
      asks: [{ id: 1, workstream_id: 'a', text: 'Send the plan', asked_by: 'Cleo', source: 'Slack', url: 'https://x/1', ts: t }],
      followups: [{ id: 2, workstream_id: 'a', text: 'Ben: staging access', waiting_on: 'Ben', next_step: '', source: 'Slack', url: 'https://x/2', ts: t }],
    }),
  });
  await renderApp();
  fireEvent.click(screen.getByLabelText('a Alpha'));
  const todos = await screen.findByRole('region', { name: 'To-dos' });
  expect(within(todos).getByText('Send the plan')).toBeTruthy();
  expect(within(todos).queryByText('Ben: staging access')).toBeNull();
  fireEvent.click(within(todos).getByText('Others'));
  expect(within(todos).getByText('Ben: staging access')).toBeTruthy();
  expect(within(todos).queryByText('Send the plan')).toBeNull();
});

it('falls back to the snapshot without platform', async () => {
  render(
    <AppProvider>
      <App />
    </AppProvider>,
  );
  expect(await screen.findByText('Snapshot')).toBeTruthy();
  expect(screen.getByText(/only in the docked preview/)).toBeTruthy();
});

it('shows the snapshot at once while the first live answer is on its way', async () => {
  const el = document.createElement('script');
  el.id = 'snapshot';
  el.type = 'application/json';
  el.textContent = JSON.stringify({ summary: summary([ws({ id: 'From snapshot' })]), workstreams: {} });
  document.body.appendChild(el);
  globalThis.platform = { request: vi.fn(() => new Promise<never>(() => {})), sendPrompt: vi.fn() }; // never answers
  try {
    render(
      <AppProvider>
        <App />
      </AppProvider>,
    );
    expect(await screen.findByText('From snapshot')).toBeTruthy();
    expect(screen.getByText('Updating…')).toBeTruthy();
  } finally {
    el.remove();
  }
});

it('"Work on it" sends the ask, with the owner\'s extra context, into a session of its own', async () => {
  const data = summary([ws({ id: 'a', ref: 3, name: 'Release', asks_open: 1 })]);
  mockPlatform(data, {
    a: page(data.workstreams[0], {
      asks: [{ id: 7, workstream_id: 'a', text: 'Post the plan', asked_by: 'Owner (promise)', source: 'Slack #leads', url: 'https://x/p1', ts: data.generated_at }],
    }),
  });
  await renderApp();
  fireEvent.click(screen.getByLabelText('W3 Release'));
  fireEvent.click(await screen.findByText('Work on it'));
  fireEvent.change(screen.getByPlaceholderText(/Extra context/), { target: { value: 'Draft it in my voice' } });
  fireEvent.click(screen.getByText('Start a session'));
  const sent = (globalThis.platform!.sendPrompt as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
  expect(sent).toMatch(/^Let's work on this ask in W3 \(Release\), ask #7:/);
  expect(sent).toContain('"Post the plan"');
  expect(sent).toContain('https://x/p1');
  expect(sent).toContain('Draft it in my voice');
  // Its own Session, continued when the same ask is sent again.
  expect((globalThis.platform!.sendPrompt as ReturnType<typeof vi.fn>).mock.calls[0][1]).toEqual({ conversation: 'ask-7' });
  expect(screen.queryByPlaceholderText(/Extra context/)).toBeNull();
});

it('Ask agent to refresh starts a session of its own', async () => {
  mockPlatform(summary([ws({ id: 'a' })]));
  await renderApp();
  fireEvent.click(screen.getByLabelText('Ask agent to refresh'));
  const [text, opts] = (globalThis.platform!.sendPrompt as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(text).toMatch(/^Refresh all workstreams/);
  expect(opts.conversation).toMatch(/^refresh-\d+-all$/);
});
