import { type Level, levelFor } from './format.ts'
import { ALERT_CHOICES, REFRESH_CHOICES, type Settings } from './settings.ts'
import type { ProviderId, ProviderUsage } from './types.ts'

export interface PanelPayload {
  providers: {
    id: string
    name: string
    error?: string
    stale?: boolean
    windows: { label: string; usedPercent: number; level: Level; resetsAt: string | null }[]
  }[]
  fetchedAt: string
  /** Which Providers the Panel can switch on and off. Ordered, so the list is stable. */
  allProviders: { id: string; name: string; visible: boolean }[]
  settings: { refreshSeconds: number; alertAtPercent: number }
  /** Which interval options and thresholds to offer, so the choices live in `settings.ts`. */
  choices: { refreshSeconds: number[]; alertAtPercent: number[] }
  /** Open with the Settings section showing, because the user asked for it from the tray. */
  openSettings: boolean
}

/**
 * The values to offer for a dropdown, with the current one guaranteed to be among them.
 *
 * `settings.json` is documented as hand-editable, so a value outside the built-in choices is
 * legitimate. Without this the dropdown would silently display the first choice instead, showing the
 * user 70% while the app was alerting at 20%.
 */
export function choicesWithCurrent(values: readonly number[], current: number): number[] {
  return [...new Set([...values, current])].sort((a, b) => a - b)
}

export function toPanelPayload(
  results: ProviderUsage[],
  now: Date,
  options: {
    settings: Settings
    allProviders: readonly { id: ProviderId; name: string }[]
    openSettings?: boolean
  },
): PanelPayload {
  const visible = new Set(options.settings.visibleProviders)
  return {
    fetchedAt: now.toISOString(),
    providers: results
      .filter(result => visible.has(result.id))
      .map(result => ({
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
    allProviders: options.allProviders.map(p => ({ ...p, visible: visible.has(p.id) })),
    settings: {
      refreshSeconds: options.settings.refreshSeconds,
      alertAtPercent: options.settings.alertAtPercent,
    },
    choices: {
      refreshSeconds: choicesWithCurrent(REFRESH_CHOICES, options.settings.refreshSeconds),
      alertAtPercent: choicesWithCurrent(ALERT_CHOICES, options.settings.alertAtPercent),
    },
    openSettings: options.openSettings ?? false,
  }
}

/** JSON that is safe to place inside a <script> element. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export const PANEL_WIDTH = 320
/**
 * Fixed, and the Panel scrolls inside it.
 *
 * Sizing the window to its content meant a page-to-shell round trip per render, which is how a long
 * provider error used to be clipped; the shell cannot measure the page without that channel. A fixed
 * height with `overflow-y: auto` cannot clip anything and costs one scrollbar.
 */
export const PANEL_HEIGHT = 420

const STYLE = `
:root { color-scheme: light dark; --bg:#fff; --fg:#111827; --muted:#6b7280; --track:#e5e7eb; --card:#f3f4f6;
  --ok:#16a34a; --warn:#ca8a04; --critical:#dc2626; }
@media (prefers-color-scheme: dark) { :root { --bg:#111827; --fg:#f3f4f6; --muted:#9ca3af; --track:#374151;
  --card:#1f2937; --ok:#4ade80; --warn:#facc15; --critical:#f87171; } }
* { box-sizing: border-box; }
body { margin:0; padding:12px; background:var(--bg); color:var(--fg); font:13px system-ui, "Segoe UI", sans-serif;
  overflow-y:auto; }
section { background:var(--card); border-radius:10px; padding:10px 12px; margin-bottom:10px; }
h2 { margin:0 0 8px; font-size:13px; font-weight:600; }
.row { margin-bottom:8px; } .row:last-child { margin-bottom:0; }
.head { display:flex; justify-content:space-between; margin-bottom:3px; }
.reset, .note, footer { color:var(--muted); font-size:11px; }
.bar { height:6px; border-radius:3px; background:var(--track); overflow:hidden; }
.fill { height:100%; border-radius:3px; }
.ok { background:var(--ok); } .warn { background:var(--warn); } .critical { background:var(--critical); }
.error { color:var(--critical); font-size:12px; margin-top:6px; }
footer { display:flex; align-items:center; justify-content:space-between; gap:8px; }
button.gear { background:none; border:0; color:var(--muted); font:inherit; padding:2px 6px; border-radius:6px;
  cursor:pointer; }
button.gear:hover, button.gear:focus-visible { background:var(--card); color:var(--fg); outline:none; }
#settings[hidden] { display:none; }
.field { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; }
.field:last-child { margin-bottom:0; }
.field span { color:var(--fg); }
select { font:inherit; color:var(--fg); background:var(--bg); border:1px solid var(--track);
  border-radius:6px; padding:2px 4px; }
.providers { border-top:1px solid var(--track); margin-top:10px; padding-top:10px; }
.check { display:flex; align-items:center; gap:8px; margin-bottom:6px; cursor:pointer; }
.check:last-child { margin-bottom:0; }
.check input { margin:0; accent-color:var(--ok); }
.note { margin-top:10px; }
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
var settingsOpen = current.openSettings;
var CHOICES = current.choices;
var BRIDGE = typeof window.__electrobunSendToHost === 'function';
function send(message) {
  if (window.__electrobunSendToHost) window.__electrobunSendToHost(message);
}
function select(value, options) {
  var node = el('select');
  options.forEach(function (o) {
    var option = el('option', '', o.label);
    option.value = String(o.value);
    if (o.value === value) option.selected = true;
    node.appendChild(option);
  });
  return node;
}
function field(label, control) {
  var row = el('div', 'field');
  row.appendChild(el('span', '', label));
  row.appendChild(control);
  return row;
}
function renderSettings(payload) {
  var box = el('section');
  box.id = 'settings';
  box.hidden = !settingsOpen;

  var interval = select(payload.settings.refreshSeconds, CHOICES.refreshSeconds.map(function (s) {
    return { value: s, label: s < 60 ? s + 's' : s / 60 + ' min' };
  }));
  interval.addEventListener('change', function () {
    send({ type: 'settings', patch: { refreshSeconds: Number(interval.value) } });
  });
  box.appendChild(field('Refresh every', interval));

  var alertAt = select(payload.settings.alertAtPercent, CHOICES.alertAtPercent.map(function (p) {
    return { value: p, label: p + '% used' };
  }));
  alertAt.addEventListener('change', function () {
    send({ type: 'settings', patch: { alertAtPercent: Number(alertAt.value) } });
  });
  box.appendChild(field('Warn me at', alertAt));

  var group = el('div', 'providers');
  group.appendChild(el('div', 'note', 'Show in the tray'));
  payload.allProviders.forEach(function (p) {
    var label = el('label', 'check');
    var box2 = el('input');
    box2.type = 'checkbox';
    box2.checked = p.visible;
    box2.addEventListener('change', function () {
      send({ type: 'providerVisibility', id: p.id, visible: box2.checked });
    });
    label.appendChild(box2);
    label.appendChild(el('span', '', p.name));
    group.appendChild(label);
  });
  box.appendChild(group);
  if (!BRIDGE) {
    // Without the bridge nothing here can reach the app, so say so rather than letting the user
    // move controls that silently do nothing.
    box.appendChild(el('div', 'error', 'Settings cannot be saved: the app bridge is unavailable.'));
  }
  return box;
}
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
  if (!payload.providers.length) {
    var empty = el('section');
    empty.appendChild(el('div', 'note', 'No providers shown. Turn one on below.'));
    root.appendChild(empty);
  }
  root.appendChild(renderSettings(payload));

  document.getElementById('updated').textContent = 'Updated ' + new Date(payload.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
window.render = render;
// Called by the shell when Settings was asked for from the tray and the Panel already existed.
window.openSettings = function () {
  settingsOpen = true;
  var node = document.getElementById('settings');
  if (node) node.hidden = false;
};
document.getElementById('gear').addEventListener('click', function () {
  settingsOpen = !settingsOpen;
  document.getElementById('settings').hidden = !settingsOpen;
});
render(current);
setInterval(function () { render(current); }, 30000);
`

/** What the Panel's Settings section can ask the shell to do. */
export type PanelMessage =
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'providerVisibility'; id: ProviderId; visible: boolean }

/**
 * Reads a message the Panel sent with `__electrobunSendToHost`.
 *
 * The page sends `JSON.stringify(message)`, and Electrobun then parses that detail a *second* time
 * before handing it to the shell, so what arrives is normally the decoded object. Accepting only a
 * string silently drops every message, which is exactly the bug this guards: the Panel appeared to
 * work while its Settings did nothing.
 */
export function parsePanelMessage(detail: unknown): PanelMessage | null {
  let value = detail
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>

  if (record.type === 'settings') {
    const patch = record.patch
    if (typeof patch !== 'object' || patch === null) return null
    return { type: 'settings', patch: patch as Partial<Settings> }
  }
  if (record.type === 'providerVisibility') {
    const id = record.id
    if (id !== 'claude' && id !== 'opencode-go') return null
    return { type: 'providerVisibility', id, visible: Boolean(record.visible) }
  }
  return null
}

export function renderPanelHtml(payload: PanelPayload): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>AI Usage</title><style>${STYLE}</style></head>
<body><div id="root"></div>
<footer><button id="gear" class="gear" type="button" title="Settings">Settings</button><span id="updated"></span></footer>
<script>window.__INITIAL__ = ${scriptJson(payload)};${SCRIPT}</script></body></html>`
}
