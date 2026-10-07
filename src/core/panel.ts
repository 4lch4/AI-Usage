import { type Level, levelFor } from './format.ts'
import type { ProviderUsage } from './types.ts'

export interface PanelPayload {
  providers: {
    id: string
    name: string
    error?: string
    stale?: boolean
    windows: { label: string; usedPercent: number; level: Level; resetsAt: string | null }[]
  }[]
  fetchedAt: string
}

export function toPanelPayload(results: ProviderUsage[], now: Date): PanelPayload {
  return {
    fetchedAt: now.toISOString(),
    providers: results.map(result => ({
      id: result.id,
      name: result.name,
      error: result.error,
      stale: result.stale,
      windows: result.windows.map(w => ({
        label: w.label,
        usedPercent: w.usedPercent,
        level: levelFor(w.usedPercent),
        resetsAt: w.resetsAt?.toISOString() ?? null,
      })),
    })),
  }
}

/** JSON that is safe to place inside a <script> element. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export const PANEL_WIDTH = 320
export const PANEL_HEIGHT = 300

const STYLE = `
:root { color-scheme: light dark; --bg:#fff; --fg:#111827; --muted:#6b7280; --track:#e5e7eb; --card:#f3f4f6;
  --ok:#16a34a; --warn:#ca8a04; --critical:#dc2626; }
@media (prefers-color-scheme: dark) { :root { --bg:#111827; --fg:#f3f4f6; --muted:#9ca3af; --track:#374151;
  --card:#1f2937; --ok:#4ade80; --warn:#facc15; --critical:#f87171; } }
* { box-sizing: border-box; }
body { margin:0; padding:12px; background:var(--bg); color:var(--fg); font:13px system-ui, "Segoe UI", sans-serif; overflow:hidden; }
section { background:var(--card); border-radius:10px; padding:10px 12px; margin-bottom:10px; }
h2 { margin:0 0 8px; font-size:13px; font-weight:600; }
.row { margin-bottom:8px; } .row:last-child { margin-bottom:0; }
.head { display:flex; justify-content:space-between; margin-bottom:3px; }
.reset, .note, footer { color:var(--muted); font-size:11px; }
.bar { height:6px; border-radius:3px; background:var(--track); overflow:hidden; }
.fill { height:100%; border-radius:3px; }
.ok { background:var(--ok); } .warn { background:var(--warn); } .critical { background:var(--critical); }
.error { color:var(--critical); font-size:12px; margin-top:6px; }
footer { text-align:right; }
`

const SCRIPT = `
function duration(ms) {
  var m = Math.floor(Math.max(0, ms) / 60000);
  if (m < 1) return '<1m';
  var d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  if (d > 0) return d + 'd ' + h + 'h';
  if (h > 0) return h + 'h ' + (m % 60) + 'm';
  return m + 'm';
}
function el(tag, cls, text) {
  var node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
var current = window.__INITIAL__;
function render(payload) {
  current = payload;
  var root = document.getElementById('root');
  root.replaceChildren();
  payload.providers.forEach(function (p) {
    var card = el('section');
    card.appendChild(el('h2', '', p.name + (p.stale ? ' (stale)' : '')));
    p.windows.forEach(function (w) {
      var row = el('div', 'row');
      var head = el('div', 'head');
      head.appendChild(el('span', '', w.label));
      head.appendChild(el('span', '', Math.round(w.usedPercent * 10) / 10 + '%'));
      row.appendChild(head);
      var bar = el('div', 'bar');
      var fill = el('div', 'fill ' + w.level);
      fill.style.width = Math.min(100, w.usedPercent) + '%';
      bar.appendChild(fill);
      row.appendChild(bar);
      if (w.resetsAt) row.appendChild(el('div', 'reset', 'Resets in ' + duration(new Date(w.resetsAt) - Date.now())));
      card.appendChild(row);
    });
    if (p.error) card.appendChild(el('div', 'error', p.error));
    root.appendChild(card);
  });
  document.getElementById('updated').textContent = 'Updated ' + new Date(payload.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
window.render = render;
render(current);
setInterval(function () { render(current); }, 30000);
`

export function renderPanelHtml(payload: PanelPayload): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>AI Usage</title><style>${STYLE}</style></head>
<body><div id="root"></div><footer id="updated"></footer>
<script>window.__INITIAL__ = ${scriptJson(payload)};${SCRIPT}</script></body></html>`
}
