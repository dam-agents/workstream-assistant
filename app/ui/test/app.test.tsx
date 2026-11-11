// The app against a stand-in for `platform`, as the artifact frame provides it.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../src/App';
import { AppProvider } from '../src/state/AppContext';
import { summary, ws } from './fixtures';

type Req = { method: string; path: string; body?: string };

function mockPlatform(data: ReturnType<typeof summary>) {
  const calls: Req[] = [];
  globalThis.platform = {
    request: vi.fn(async (req: Req) => {
      calls.push(req);
      const id = req.path.match(/workstreams\/([\w-]+)/)?.[1];
      if (req.method === 'PATCH' && id) {
        const w = data.workstreams.find((x) => x.id === id)!;
        Object.assign(w, JSON.parse(req.body!));
        return { status: 200, body: JSON.stringify(w) };
      }
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

it('stacks four lanes, with Low collapsed and saying what needs you', async () => {
  mockPlatform(summary([ws({ id: 'Focused', focus: true }), ws({ id: 'Plain' }), ws({ id: 'Quiet', priority: 'low', asks_open: 1 })]));
  await renderApp();
  expect(within(lane('Focus today')).getByText('Focused')).toBeTruthy();
  expect(within(lane('High priority')).getByText(/Drag here what matters most/)).toBeTruthy();
  expect(within(lane('Normal')).getByText('Plain')).toBeTruthy();
  expect(within(lane('Low priority')).queryByText('Quiet')).toBeNull();
  expect(within(lane('Low priority')).getByText(/1 need you/)).toBeTruthy();
  fireEvent.click(screen.getByText('Low priority'));
  expect(within(lane('Low priority')).getByText('Quiet')).toBeTruthy();
});

it('focus toggles without opening the workstream', async () => {
  const calls = mockPlatform(summary([ws({ id: 'a' })]));
  await renderApp();
  await act(async () => {
    fireEvent.click(screen.getByText('☆ Today'));
  });
  const patches = calls.filter((c) => c.method === 'PATCH').map((c) => [c.path.split('?')[0], JSON.parse(c.body!)]);
  expect(patches).toEqual([['/api/workstreams/a', { focus: true }]]);
  expect(calls.some((c) => c.method === 'GET' && c.path.startsWith('/api/workstreams/a'))).toBe(false);
});

it('offers a drag handle per row, and the handle does not open the workstream', async () => {
  const calls = mockPlatform(summary([ws({ id: 'a', ref: 3 }), ws({ id: 'b' })]));
  await renderApp();
  const handle = screen.getByLabelText('Drag W3 to reprioritise');
  fireEvent.click(handle);
  expect(calls.some((c) => c.path.startsWith('/api/workstreams/a'))).toBe(false);
  expect(screen.getAllByLabelText(/to reprioritise/)).toHaveLength(2);
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

it('"Work on it" sends the ask, with the owner\'s extra context, into the chat', async () => {
  const data = summary([ws({ id: 'a', ref: 3, name: 'Release', asks_open: 1 })]);
  const page = {
    ...data.workstreams[0],
    state: 'approved',
    key_points: '',
    epic_label: null,
    epic_url: null,
    updated_at: data.generated_at,
    asks: [{ id: 7, workstream_id: 'a', text: 'Post the plan', asked_by: 'Owner (promise)', source: 'Slack #leads', url: 'https://x/p1', ts: data.generated_at }],
    followups: [],
    deadlines: [],
    prebriefs: [],
    progress: [],
    notes: [],
  };
  mockPlatform(data);
  (globalThis.platform!.request as ReturnType<typeof vi.fn>).mockImplementation(async (req: Req) => ({
    status: 200,
    body: JSON.stringify(req.path.startsWith('/api/workstreams/a') ? page : data),
  }));
  await renderApp();
  fireEvent.click(screen.getByText('Release'));
  fireEvent.click(await screen.findByText('Work on it'));
  fireEvent.change(screen.getByPlaceholderText(/Extra context/), { target: { value: 'Draft it in my voice' } });
  fireEvent.click(screen.getByText('Send to chat'));
  const sent = (globalThis.platform!.sendPrompt as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
  expect(sent).toMatch(/^Let's work on this ask in W3 \(Release\), ask #7:/);
  expect(sent).toContain('"Post the plan"');
  expect(sent).toContain('https://x/p1');
  expect(sent).toContain('Draft it in my voice');
  expect(screen.queryByPlaceholderText(/Extra context/)).toBeNull();
});
