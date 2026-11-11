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

it('shows one plain list while nothing is prioritised', async () => {
  mockPlatform(summary([ws({ id: 'a' }), ws({ id: 'b' })]));
  await renderApp();
  expect(screen.queryByText('Normal', { selector: 'span' })).toBeNull();
  expect(screen.getAllByText('Detail →')).toHaveLength(2);
});

it('stacks by priority, with Low collapsed', async () => {
  mockPlatform(summary([ws({ id: 'Focused', focus: true }), ws({ id: 'Plain' }), ws({ id: 'Quiet', priority: 'low', asks_open: 1 })]));
  await renderApp();
  expect(screen.getByText('Focus today')).toBeTruthy();
  const low = screen.getByText('Low priority').closest('details')!;
  expect(low.open).toBe(false);
  expect(within(low).getByText(/1 need you/)).toBeTruthy();
});

it('saves a priority and focus as the owner, without opening the workstream', async () => {
  const calls = mockPlatform(summary([ws({ id: 'a' })]));
  await renderApp();
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'high' } });
  });
  await act(async () => {
    fireEvent.click(screen.getByText('☆ Today'));
  });
  const patches = calls.filter((c) => c.method === 'PATCH').map((c) => [c.path.split('?')[0], JSON.parse(c.body!)]);
  expect(patches).toEqual([
    ['/api/workstreams/a', { priority: 'high' }],
    ['/api/workstreams/a', { focus: true }],
  ]);
  expect(calls.some((c) => c.method === 'GET' && c.path.startsWith('/api/workstreams/a'))).toBe(false);
  expect(await screen.findByText('Focus today')).toBeTruthy(); // focus wins over its new High priority
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
