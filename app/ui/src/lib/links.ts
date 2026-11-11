// What a source link points at, and GitHub references in free text.

export function sourceKind(url: string | null | undefined): string {
  if (!url) return '';
  if (url.includes('slack.com')) return 'Slack';
  if (url.includes('github.com')) return 'GitHub';
  if (/recording|meeting/i.test(url)) return 'Meeting';
  if (url.includes('claude.ai')) return 'Doc';
  return 'Link';
}

export type Segment = string | { label: string; href: string };

/** Split text into plain parts and links for "#123" / "PR #123" in the configured repository. */
export function linkifyRefs(text: string, repo: string): Segment[] {
  if (!repo) return [text];
  const out: Segment[] = [];
  const re = /(PR )?#(\d{3,5})/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push({ label: m[0], href: `https://github.com/${repo}/${m[1] ? 'pull' : 'issues'}/${m[2]}` });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
