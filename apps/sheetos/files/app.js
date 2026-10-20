'use strict';
// SheetOS – a small spreadsheet for ShareOS.
// Cells hold what the user typed (raw); formulas start with "=" and are
// evaluated by our own parser (no eval). Inside ShareOS a CSV file of the box
// can be opened and saved back (values, like LibreOffice does for CSV).

const SOS = window.ShareOS || null;
if (SOS) document.documentElement.setAttribute('data-look', 'shareos');

const MIN_COLS = 26, MIN_ROWS = 100, MAX_COLS = 702, MAX_ROWS = 10000;
const STORE_KEY = 'sheetos.data';   // all apps of the box share one origin: own keys only

function store(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  } catch (e) { return null; }
}

// ---------- cell addresses ----------
function colName(c) {          // 0 -> A, 25 -> Z, 26 -> AA
  let s = '';
  for (c++; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + (c - 1) % 26) + s;
  return s;
}
function colIndex(name) {
  let c = 0;
  for (const ch of name) c = c * 26 + ch.charCodeAt(0) - 64;
  return c - 1;
}
const cellId = (c, r) => colName(c) + (r + 1);
function parseId(id) {
  const m = /^\$?([A-Z]{1,2})\$?(\d{1,5})$/.exec(id.toUpperCase());
  return m ? { c: colIndex(m[1]), r: +m[2] - 1 } : null;
}

// ---------- the sheet ----------
let data = {};                 // "A1" -> raw text
let cols = MIN_COLS, rows = MIN_ROWS;
let file = null;               // { name, editable } when opened from the box
let dirty = false;
let sep = ';';
// decimal mark for showing numbers: from the file, else from the browser language
let dec = /^de|^fr|^es|^it|^pt|^ru|^nl|^pl/i.test(navigator.language || '') ? ',' : '.';

function loadLocal() {
  let d = null;
  try { d = JSON.parse(store(STORE_KEY) || store('sheetos_data') || 'null'); } catch (e) { d = null; }
  setData(d && typeof d === 'object' ? (d.cells || d) : {});
}
function saveLocal() {
  if (file) return;            // a box file is saved with "Speichern"
  store(STORE_KEY, JSON.stringify({ cells: data }));
}
function setData(cells) {
  data = {};
  let maxC = 0, maxR = 0;
  for (const [k, v] of Object.entries(cells || {})) {
    const p = parseId(k);
    if (!p || p.c >= MAX_COLS || p.r >= MAX_ROWS || v === '' || v == null) continue;
    data[cellId(p.c, p.r)] = String(v);
    maxC = Math.max(maxC, p.c + 1); maxR = Math.max(maxR, p.r + 1);
  }
  cols = Math.min(MAX_COLS, Math.max(MIN_COLS, maxC + 2));
  rows = Math.min(MAX_ROWS, Math.max(MIN_ROWS, maxR + 20));
}
function setDirty(v) {
  dirty = v;
  document.getElementById('file-name').classList.toggle('dirty', v && !!file);
}

// ---------- formulas ----------
// grammar: cmp := cat (('='|'<>'|'<'|'>'|'<='|'>=') cat)?
//          cat := add ('&' add)*   add := mul (('+'|'-') mul)*
//          mul := pow (('*'|'/') pow)*   pow := unary ('^' unary)*
//          unary := ('-'|'+') unary | primary
//          primary := number | "text" | ref | ref:ref | NAME(args) | (cmp)
class FErr extends Error {}
const ERR = { ref: '#REF!', div: '#DIV/0!', name: '#NAME?', val: '#VALUE!', circ: '#CIRC!', syn: '#ERR' };

function tokenize(s) {
  const t = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    let m;
    if ((m = /^(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i)))) { t.push({ k: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
    if (ch === '"') {
      let j = i + 1, v = '';
      for (; j < s.length; j++) {
        if (s[j] === '"') { if (s[j + 1] === '"') { v += '"'; j++; } else break; }
        else v += s[j];
      }
      if (j >= s.length) throw new FErr(ERR.syn);
      t.push({ k: 'str', v }); i = j + 1; continue;
    }
    if ((m = /^\$?[A-Za-z]{1,2}\$?\d{1,5}(:\$?[A-Za-z]{1,2}\$?\d{1,5})?(?![A-Za-z0-9_(])/.exec(s.slice(i)))) { t.push({ k: 'ref', v: m[0].toUpperCase().replace(/\$/g, '') }); i += m[0].length; continue; }
    if ((m = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(s.slice(i)))) { t.push({ k: 'name', v: m[0].toUpperCase() }); i += m[0].length; continue; }
    if ((m = /^(<>|<=|>=)/.exec(s.slice(i)))) { t.push({ k: 'op', v: m[0] }); i += 2; continue; }
    if ('+-*/^&=<>(),;'.includes(ch)) { t.push({ k: 'op', v: ch }); i++; continue; }
    throw new FErr(ERR.syn);
  }
  return t;
}

const toNum = (v) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === '' || v == null) return 0;
  const n = parseNumber(v);
  if (n === null) throw new FErr(ERR.val);
  return n;
};
const toStr = (v) => (typeof v === 'number' ? fmtNum(v) : typeof v === 'boolean' ? (v ? 'WAHR' : 'FALSCH') : String(v ?? ''));
const numsOf = (args) => args.flat(Infinity).filter((v) => typeof v === 'number');

const FUNCS = {
  SUM: (a) => numsOf(a).reduce((s, x) => s + x, 0),
  SUMME: (a) => FUNCS.SUM(a),
  AVG: (a) => { const n = numsOf(a); if (!n.length) throw new FErr(ERR.div); return n.reduce((s, x) => s + x, 0) / n.length; },
  AVERAGE: (a) => FUNCS.AVG(a), MITTELWERT: (a) => FUNCS.AVG(a),
  MIN: (a) => { const n = numsOf(a); return n.length ? Math.min(...n) : 0; },
  MAX: (a) => { const n = numsOf(a); return n.length ? Math.max(...n) : 0; },
  COUNT: (a) => numsOf(a).length, ANZAHL: (a) => FUNCS.COUNT(a),
  COUNTA: (a) => a.flat(Infinity).filter((v) => v !== '' && v != null).length, ANZAHL2: (a) => FUNCS.COUNTA(a),
  ROUND: (a) => { const d = a.length > 1 ? toNum(a[1]) : 0, f = Math.pow(10, d); return Math.round(toNum(a[0]) * f) / f; },
  RUNDEN: (a) => FUNCS.ROUND(a),
  ABS: (a) => Math.abs(toNum(a[0])),
  SQRT: (a) => { const x = toNum(a[0]); if (x < 0) throw new FErr(ERR.val); return Math.sqrt(x); },
  WURZEL: (a) => FUNCS.SQRT(a),
  IF: (a) => (truthy(a[0]) ? (a.length > 1 ? a[1] : true) : (a.length > 2 ? a[2] : false)),
  WENN: (a) => FUNCS.IF(a),
  AND: (a) => a.flat(Infinity).every(truthy), UND: (a) => FUNCS.AND(a),
  OR: (a) => a.flat(Infinity).some(truthy), ODER: (a) => FUNCS.OR(a),
  NOT: (a) => !truthy(a[0]), NICHT: (a) => FUNCS.NOT(a),
  CONCAT: (a) => a.flat(Infinity).map(toStr).join(''), VERKETTEN: (a) => FUNCS.CONCAT(a),
  LEN: (a) => toStr(a[0]).length, LÄNGE: (a) => FUNCS.LEN(a),
  UPPER: (a) => toStr(a[0]).toUpperCase(), LOWER: (a) => toStr(a[0]).toLowerCase(),
  TODAY: () => new Date().toLocaleDateString(), HEUTE: () => FUNCS.TODAY(),
};
function truthy(v) {
  if (Array.isArray(v)) v = v[0];
  if (typeof v === 'string') return v !== '' && v.toUpperCase() !== 'FALSE' && v.toUpperCase() !== 'FALSCH';
  return !!v;
}

let cache = {};
const evaluating = new Set();
function value(id) {            // value of a cell: number, string or boolean; throws FErr
  if (id in cache) { const v = cache[id]; if (v instanceof FErr) throw v; return v; }
  if (evaluating.has(id)) throw new FErr(ERR.circ);
  const raw = data[id] ?? '';
  let v;
  if (raw.startsWith('=')) {
    evaluating.add(id);
    try { v = evalFormula(raw.slice(1)); }
    catch (e) { v = e instanceof FErr ? e : new FErr(ERR.syn); }
    finally { evaluating.delete(id); }
  } else {
    const n = parseNumber(raw);
    v = n === null ? raw : n;
  }
  cache[id] = v;
  if (v instanceof FErr) throw v;
  return v;
}
function rangeValues(ref) {
  const [a, b] = ref.split(':'), pa = parseId(a), pb = parseId(b);
  if (!pa || !pb) throw new FErr(ERR.ref);
  const out = [];
  for (let r = Math.min(pa.r, pb.r); r <= Math.max(pa.r, pb.r); r++)
    for (let c = Math.min(pa.c, pb.c); c <= Math.max(pa.c, pb.c); c++) {
      const id = cellId(c, r);
      if (data[id] !== undefined) out.push(value(id));
    }
  return out;
}
function evalFormula(src) {
  const t = tokenize(src);
  let p = 0;
  const peek = () => t[p], isOp = (v) => t[p] && t[p].k === 'op' && t[p].v === v;
  const next = () => t[p++];
  function cmp() {
    const l = cat();
    if (t[p] && t[p].k === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(t[p].v)) {
      const op = next().v, r = cat();
      const both = typeof l === 'number' && typeof r === 'number';
      const x = both ? l : toStr(l).toLowerCase(), y = both ? r : toStr(r).toLowerCase();
      return { '=': x === y, '<>': x !== y, '<': x < y, '>': x > y, '<=': x <= y, '>=': x >= y }[op];
    }
    return l;
  }
  function cat() { let v = add(); while (isOp('&')) { next(); v = toStr(v) + toStr(add()); } return v; }
  function add() {
    let v = mul();
    while (isOp('+') || isOp('-')) { const op = next().v, r = mul(); v = op === '+' ? toNum(v) + toNum(r) : toNum(v) - toNum(r); }
    return v;
  }
  function mul() {
    let v = pow();
    while (isOp('*') || isOp('/')) {
      const op = next().v, r = toNum(pow());
      if (op === '/' && r === 0) throw new FErr(ERR.div);
      v = op === '*' ? toNum(v) * r : toNum(v) / r;
    }
    return v;
  }
  function pow() { let v = unary(); while (isOp('^')) { next(); v = Math.pow(toNum(v), toNum(unary())); } return v; }
  function unary() {
    if (isOp('-')) { next(); return -toNum(unary()); }
    if (isOp('+')) { next(); return toNum(unary()); }
    return primary();
  }
  function primary() {
    const tok = next();
    if (!tok) throw new FErr(ERR.syn);
    if (tok.k === 'num' || tok.k === 'str') return tok.v;
    if (tok.k === 'ref') {
      if (tok.v.includes(':')) return rangeValues(tok.v);
      const id = parseId(tok.v);
      if (!id) throw new FErr(ERR.ref);
      return data[cellId(id.c, id.r)] === undefined ? 0 : value(cellId(id.c, id.r));
    }
    if (tok.k === 'name') {
      if (tok.v === 'TRUE' || tok.v === 'WAHR') return true;
      if (tok.v === 'FALSE' || tok.v === 'FALSCH') return false;
      if (!isOp('(')) throw new FErr(ERR.name);
      next();
      const args = [];
      if (!isOp(')')) {
        do { args.push(cmp()); } while ((isOp(',') || isOp(';')) && next());
      }
      if (!isOp(')')) throw new FErr(ERR.syn);
      next();
      const f = FUNCS[tok.v];
      if (!f) throw new FErr(ERR.name);
      return f(args);
    }
    if (tok.k === 'op' && tok.v === '(') {
      const v = cmp();
      if (!isOp(')')) throw new FErr(ERR.syn);
      next();
      return v;
    }
    throw new FErr(ERR.syn);
  }
  const v = cmp();
  if (p < t.length) throw new FErr(ERR.syn);
  if (Array.isArray(v)) return v.length ? v[0] : 0;
  if (typeof v === 'number' && !isFinite(v)) throw new FErr(ERR.div);
  return v;
}

// numbers: "1234.5", "1,5" (German decimal comma), "1.234,5", "1,234.5", "1e3", "12 %"
function parseNumber(s) {
  s = String(s).trim();
  let pct = false;
  if (s.endsWith('%')) { pct = true; s = s.slice(0, -1).trim(); }
  let n = null;
  // leading zeros (postcodes, phone numbers, "007") stay text
  if (/^[-+]?0\d/.test(s)) return null;
  // "1.234" is 1234 where the decimal mark is a comma
  if (dec === ',' && /^[-+]?\d{1,3}(\.\d{3})+$/.test(s)) n = parseFloat(s.replace(/\./g, ''));
  else if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) n = parseFloat(s);
  else if (/^[-+]?\d*,\d+$/.test(s)) n = parseFloat(s.replace(',', '.'));
  else if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) n = parseFloat(s.replace(/,/g, ''));
  if (n === null || !isFinite(n)) return null;
  return pct ? n / 100 : n;
}
function fmtNum(n) {
  const t = Number.isInteger(n) ? String(n) : String(parseFloat(n.toPrecision(12)));
  return dec === ',' ? t.replace('.', ',') : t;
}
function display(id) {
  try {
    const v = value(id);
    if (typeof v === 'number') return { text: fmtNum(v), num: true };
    if (typeof v === 'boolean') return { text: v ? 'WAHR' : 'FALSCH', num: false };
    return { text: String(v), num: false };
  } catch (e) {
    return { text: e instanceof FErr ? e.message : ERR.syn, err: true };
  }
}

// ---------- grid ----------
const colHeadersEl = document.getElementById('col-headers');
const gridBodyEl = document.getElementById('grid-body');
const gridEl = document.getElementById('grid-container');
const activeCellLabel = document.getElementById('active-cell-label');
const formulaInput = document.getElementById('formula-input');
const editor = document.getElementById('cell-editor');

let active = { c: 0, r: 0 }, anchor = { c: 0, r: 0 };
let editing = null;            // { c, r, from: 'cell'|'bar', orig }

function buildGrid() {
  colHeadersEl.innerHTML = '<th class="corner"></th>';
  const frag = document.createDocumentFragment();
  for (let c = 0; c < cols; c++) {
    const th = document.createElement('th');
    th.textContent = colName(c);
    frag.appendChild(th);
  }
  colHeadersEl.appendChild(frag);
  const body = document.createDocumentFragment();
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr');
    const h = document.createElement('td');
    h.className = 'row-header';
    h.textContent = r + 1;
    tr.appendChild(h);
    for (let c = 0; c < cols; c++) {
      const td = document.createElement('td');
      td.className = 'cell';
      td.dataset.c = c; td.dataset.r = r;
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
  gridBodyEl.innerHTML = '';
  gridBodyEl.appendChild(body);
  recalc();
}
const tdAt = (c, r) => gridBodyEl.rows[r] && gridBodyEl.rows[r].cells[c + 1];

function recalc() {
  cache = {};
  for (let r = 0; r < rows; r++) {
    const tr = gridBodyEl.rows[r];
    for (let c = 0; c < cols; c++) {
      const td = tr.cells[c + 1], id = cellId(c, r);
      if (data[id] === undefined) {
        if (td.textContent) { td.textContent = ''; td.className = 'cell'; }
        continue;
      }
      const d = display(id);
      td.textContent = d.text;
      td.className = 'cell' + (d.num ? ' num' : '') + (d.err ? ' error' : '');
    }
  }
  paintSelection();
}

function selRange() {
  return { c1: Math.min(active.c, anchor.c), c2: Math.max(active.c, anchor.c), r1: Math.min(active.r, anchor.r), r2: Math.max(active.r, anchor.r) };
}
function paintSelection() {
  gridBodyEl.querySelectorAll('td.in-range, td.active, td.hl').forEach((td) => td.classList.remove('in-range', 'active', 'hl'));
  colHeadersEl.querySelectorAll('th.hl').forEach((th) => th.classList.remove('hl'));
  const s = selRange();
  for (let r = s.r1; r <= s.r2; r++) for (let c = s.c1; c <= s.c2; c++) {
    const td = tdAt(c, r);
    if (td && (s.r1 !== s.r2 || s.c1 !== s.c2)) td.classList.add('in-range');
  }
  const td = tdAt(active.c, active.r);
  if (td) td.classList.add('active');
  if (colHeadersEl.cells[active.c + 1]) colHeadersEl.cells[active.c + 1].classList.add('hl');
  if (gridBodyEl.rows[active.r]) gridBodyEl.rows[active.r].cells[0].classList.add('hl');
  const id = cellId(active.c, active.r);
  const rangeTxt = s.r1 !== s.r2 || s.c1 !== s.c2 ? `${cellId(s.c1, s.r1)}:${cellId(s.c2, s.r2)}` : id;
  activeCellLabel.textContent = rangeTxt;
  document.getElementById('status-sel').textContent = rangeTxt;
  if (!editing || editing.from !== 'bar') formulaInput.value = data[id] ?? '';
  // sum / average of the selection in the status bar, like other spreadsheets
  let sum = 0, n = 0;
  if (s.r1 !== s.r2 || s.c1 !== s.c2) {
    for (let r = s.r1; r <= s.r2; r++) for (let c = s.c1; c <= s.c2; c++) {
      const cid = cellId(c, r);
      if (data[cid] === undefined) continue;
      try { const v = value(cid); if (typeof v === 'number') { sum += v; n++; } } catch (e) { }
    }
  }
  document.getElementById('status-calc').textContent = n ? `Summe ${fmtNum(sum)} · Mittelwert ${fmtNum(sum / n)} · Anzahl ${n}` : '';
}
function select(c, r, extend) {
  active = { c: Math.max(0, Math.min(cols - 1, c)), r: Math.max(0, Math.min(rows - 1, r)) };
  if (!extend) anchor = { ...active };
  paintSelection();
  const td = tdAt(active.c, active.r);
  if (td) td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function setCell(c, r, raw) {
  const id = cellId(c, r);
  raw = String(raw ?? '');
  if ((data[id] ?? '') === raw) return false;
  if (raw === '') delete data[id]; else data[id] = raw;
  setDirty(true);
  return true;
}
function commitChanges() {
  saveLocal();
  recalc();
}

// in-cell editor
function startEdit(initial) {
  const td = tdAt(active.c, active.r);
  if (!td) return;
  const id = cellId(active.c, active.r);
  editing = { c: active.c, r: active.r, from: 'cell', orig: data[id] ?? '' };
  const box = td.getBoundingClientRect(), g = gridEl.getBoundingClientRect();
  editor.style.left = (box.left - g.left + gridEl.scrollLeft) + 'px';
  editor.style.top = (box.top - g.top + gridEl.scrollTop) + 'px';
  editor.style.width = Math.max(box.width, 140) + 'px';
  editor.style.height = box.height + 'px';
  editor.value = initial !== undefined ? initial : editing.orig;
  editor.classList.remove('hidden');
  editor.focus();
  editor.setSelectionRange(editor.value.length, editor.value.length);
}
function endEdit(save, move) {
  if (!editing) return;
  const e = editing;
  editing = null;
  editor.classList.add('hidden');
  if (save) {
    const val = e.from === 'bar' ? formulaInput.value : editor.value;
    if (setCell(e.c, e.r, val)) commitChanges();
  }
  if (move) select(e.c + move.c, e.r + move.r);
  else paintSelection();
  gridEl.focus();
}
editor.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') { ev.preventDefault(); endEdit(true, { c: 0, r: ev.shiftKey ? -1 : 1 }); }
  else if (ev.key === 'Tab') { ev.preventDefault(); endEdit(true, { c: ev.shiftKey ? -1 : 1, r: 0 }); }
  else if (ev.key === 'Escape') { ev.preventDefault(); endEdit(false); }
});
editor.addEventListener('input', () => { formulaInput.value = editor.value; });
editor.addEventListener('blur', () => { if (editing && editing.from === 'cell') endEdit(true); });

// formula bar
formulaInput.addEventListener('focus', () => {
  editing = { c: active.c, r: active.r, from: 'bar', orig: data[cellId(active.c, active.r)] ?? '' };
});
formulaInput.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') { ev.preventDefault(); endEdit(true, { c: 0, r: 1 }); }
  else if (ev.key === 'Escape') { ev.preventDefault(); formulaInput.value = editing ? editing.orig : ''; endEdit(false); }
});
formulaInput.addEventListener('blur', () => { if (editing && editing.from === 'bar') endEdit(true); });

// mouse
let dragging = false;
gridBodyEl.addEventListener('mousedown', (ev) => {
  const td = ev.target.closest('td.cell');
  if (!td) return;
  if (editing) endEdit(true);
  ev.preventDefault();
  gridEl.focus();
  select(+td.dataset.c, +td.dataset.r, ev.shiftKey);
  dragging = true;
});
gridBodyEl.addEventListener('mouseover', (ev) => {
  if (!dragging) return;
  const td = ev.target.closest('td.cell');
  if (td) { active = { c: +td.dataset.c, r: +td.dataset.r }; paintSelection(); }
});
addEventListener('mouseup', () => { dragging = false; });
gridBodyEl.addEventListener('dblclick', (ev) => { if (ev.target.closest('td.cell')) startEdit(); });

// keyboard on the grid
gridEl.tabIndex = 0;
gridEl.addEventListener('keydown', (ev) => {
  if (editing) return;
  const k = ev.key, ctrl = ev.ctrlKey || ev.metaKey;
  const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  if (moves[k]) { ev.preventDefault(); select(active.c + moves[k][0], active.r + moves[k][1], ev.shiftKey); return; }
  if (k === 'Enter') { ev.preventDefault(); select(active.c, active.r + (ev.shiftKey ? -1 : 1)); return; }
  if (k === 'Tab') { ev.preventDefault(); select(active.c + (ev.shiftKey ? -1 : 1), active.r); return; }
  if (k === 'Home') { ev.preventDefault(); select(0, ctrl ? 0 : active.r, ev.shiftKey); return; }
  if (k === 'PageDown' || k === 'PageUp') { ev.preventDefault(); select(active.c, active.r + (k === 'PageDown' ? 20 : -20), ev.shiftKey); return; }
  if (k === 'F2') { ev.preventDefault(); startEdit(); return; }
  if (k === 'Delete' || k === 'Backspace') {
    ev.preventDefault();
    const s = selRange();
    let changed = false;
    for (let r = s.r1; r <= s.r2; r++) for (let c = s.c1; c <= s.c2; c++) changed = setCell(c, r, '') || changed;
    if (changed) commitChanges();
    return;
  }
  if (ctrl && k.toLowerCase() === 'a') { ev.preventDefault(); anchor = { c: 0, r: 0 }; active = { c: cols - 1, r: rows - 1 }; paintSelection(); return; }
  if (!ctrl && !ev.altKey && k.length === 1) { ev.preventDefault(); startEdit(k); }
});

// copy / paste as tab separated text (works with other spreadsheets)
document.addEventListener('copy', (ev) => {
  if (editing || document.activeElement !== gridEl) return;
  const s = selRange(), lines = [];
  for (let r = s.r1; r <= s.r2; r++) {
    const row = [];
    for (let c = s.c1; c <= s.c2; c++) row.push(data[cellId(c, r)] === undefined ? '' : display(cellId(c, r)).text);
    lines.push(row.join('\t'));
  }
  ev.clipboardData.setData('text/plain', lines.join('\n'));
  ev.preventDefault();
});
document.addEventListener('paste', (ev) => {
  if (editing || document.activeElement !== gridEl) return;
  const text = ev.clipboardData.getData('text/plain');
  if (!text) return;
  ev.preventDefault();
  const table = parseCSV(text.replace(/\r?\n$/, ''), text.includes('\t') ? '\t' : detectSep(text));
  let changed = false;
  table.forEach((row, i) => row.forEach((v, j) => {
    if (active.c + j < MAX_COLS && active.r + i < MAX_ROWS) changed = setCell(active.c + j, active.r + i, v) || changed;
  }));
  if (changed) { growTo(active.c + Math.max(...table.map((r) => r.length)), active.r + table.length); commitChanges(); }
});
function growTo(c, r) {
  if (c <= cols && r <= rows) return;
  cols = Math.min(MAX_COLS, Math.max(cols, c + 2));
  rows = Math.min(MAX_ROWS, Math.max(rows, r + 20));
  buildGrid();
}

// ---------- quick functions ----------
// a selected range gets its function in the cell below (column) or to the
// right (row); a single cell sums the numbers directly above it
function quick(fn) {
  const s = selRange();
  let target, range;
  if (s.r1 !== s.r2 || s.c1 !== s.c2) {
    if (s.c1 === s.c2 || s.r2 - s.r1 >= s.c2 - s.c1) target = { c: s.c1, r: s.r2 + 1 };
    else target = { c: s.c2 + 1, r: s.r1 };
    range = `${cellId(s.c1, s.r1)}:${cellId(s.c2, s.r2)}`;
  } else {
    let r = active.r - 1;
    while (r >= 0 && data[cellId(active.c, r)] !== undefined) r--;
    if (r === active.r - 1) { setMsg('Erst Zellen markieren – oder unter einer Zahlenspalte klicken.'); return; }
    target = { ...active };
    range = `${cellId(active.c, r + 1)}:${cellId(active.c, active.r - 1)}`;
  }
  growTo(target.c + 1, target.r + 1);
  setCell(target.c, target.r, `=${fn}(${range})`);
  commitChanges();
  select(target.c, target.r);
}
['sum', 'avg', 'min', 'max'].forEach((f) => document.getElementById('calc-' + f).addEventListener('click', () => quick(f.toUpperCase())));

// ---------- CSV ----------
function detectSep(text) {
  const head = text.split(/\r?\n/).slice(0, 5).join('\n');
  const count = (ch) => (head.match(new RegExp(ch === '\t' ? '\t' : '\\' + ch, 'g')) || []).length;
  return [';', ',', '\t'].sort((a, b) => count(b) - count(a))[0];
}
// decimal comma when the numbers in the file have one (or ";" separates: German Excel)
function detectDec(text, delim) {
  if (delim === ',') return '.';
  if (/(^|[;\t])-?\d+,\d+([;\t\r\n]|$)/m.test(text)) return ',';
  if (/(^|[;\t])-?\d+\.\d+([;\t\r\n]|$)/m.test(text)) return '.';
  return delim === ';' ? ',' : dec;
}
function parseCSV(text, delim) {
  const out = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); out.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row); }
  return out;
}
function usedSize() {
  let mc = 0, mr = 0;
  for (const k of Object.keys(data)) { const p = parseId(k); mc = Math.max(mc, p.c + 1); mr = Math.max(mr, p.r + 1); }
  return { mc, mr };
}
// cells as typed; formulas become their result – what other programs expect in a CSV
// (typed text stays exactly as it is: leading zeros, "1,5", dates …)
function toCSV(delim, eol = '\r\n') {
  const { mc, mr } = usedSize();
  cache = {};
  const lines = [];
  for (let r = 0; r < mr; r++) {
    const row = [];
    for (let c = 0; c < mc; c++) {
      const id = cellId(c, r);
      const raw = data[id];
      let v = raw === undefined ? '' : raw.startsWith('=') ? display(id).text : raw;
      if (/["\r\n]/.test(v) || v.includes(delim) || /^\s|\s$/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      row.push(v);
    }
    lines.push(row.join(delim));
  }
  return lines.join(eol) + (lines.length ? eol : '');
}
function hasFormulas() { return Object.values(data).some((v) => v.startsWith('=')); }
function loadTable(table) {
  const cells = {};
  table.forEach((row, r) => row.forEach((v, c) => { if (v !== '') cells[cellId(c, r)] = v; }));
  setData(cells);
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const baseName = () => (file ? file.name.replace(/\.[^.]+$/, '') : 'sheetos');

document.getElementById('csv-export-btn').addEventListener('click', () => download(baseName() + '.csv', '﻿' + toCSV(sep), 'text/csv;charset=utf-8'));
document.getElementById('json-export-btn').addEventListener('click', () => download(baseName() + '.json', JSON.stringify({ sheetos: 1, cells: data }, null, 2), 'application/json'));

const sepSelect = document.getElementById('sep-select');
sepSelect.value = store('sheetos.sep') || ';';
sep = sepSelect.value;
sepSelect.addEventListener('change', () => { sep = sepSelect.value; store('sheetos.sep', sep); if (file) setDirty(true); });

document.getElementById('file-import').addEventListener('change', async (ev) => {
  const f = ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  if (dirty && file && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
  const text = (await f.text()).replace(/^﻿/, '');
  try {
    if (/\.json$/i.test(f.name)) {
      const j = JSON.parse(text);
      setData(j && typeof j === 'object' ? (j.cells || j) : {});
    } else {
      sep = detectSep(text); sepSelect.value = sep; dec = detectDec(text, sep);
      loadTable(parseCSV(text, sep));
    }
  } catch (e) { setMsg('Datei nicht lesbar: ' + e.message); return; }
  file = null;
  document.getElementById('save-btn').classList.add('hidden');
  document.getElementById('file-name').textContent = f.name;
  setDirty(false);
  saveLocal();
  buildGrid();
  select(0, 0);
  setMsg(`${f.name} geöffnet.`);
});

document.getElementById('new-btn').addEventListener('click', () => {
  if (!confirm(file ? 'Neue leere Tabelle? Die Datei auf der Box bleibt unverändert.' : 'Tabelle wirklich leeren?')) return;
  file = null;
  document.getElementById('save-btn').classList.add('hidden');
  document.getElementById('file-name').textContent = '';
  setData({});
  setDirty(false);
  store(STORE_KEY, null);
  buildGrid();
  select(0, 0);
});

// ---------- the file of the box ----------
let saving = false;
async function saveToBox() {
  if (!file || !file.editable || saving) return;
  if (editing) endEdit(true);
  if (hasFormulas() && !saveToBox.warned) {
    saveToBox.warned = true;
    if (!confirm('CSV speichert nur Werte – Formeln werden dabei durch ihr Ergebnis ersetzt (wie in anderen Tabellenprogrammen). Für Formeln zusätzlich „JSON ⭳“ nutzen.\n\nTrotzdem speichern?')) return;
  }
  saving = true;
  setMsg('Speichere …');
  try {
    // keep what the file had: byte order mark and line ends
    await SOS.file.save(new Blob([(file.bom ? '﻿' : '') + toCSV(sep, file.eol)], { type: 'text/csv' }));
    setDirty(false);
    setMsg(`${file.name} gespeichert.`);
  } catch (e) {
    setMsg('Speichern fehlgeschlagen: ' + e.message);
  } finally { saving = false; }
}
document.getElementById('save-btn').addEventListener('click', saveToBox);
addEventListener('keydown', (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); if (file) saveToBox(); else document.getElementById('json-export-btn').click(); }
});
addEventListener('beforeunload', (ev) => { if (dirty && file) { ev.preventDefault(); ev.returnValue = ''; } });

function setMsg(t) { document.getElementById('status-msg').textContent = t; }

async function openBoxFile() {
  const info = await SOS.file.info();
  const raw = await SOS.file.text();
  const text = raw.replace(/^﻿/, '');
  file = { name: SOS.file.name, editable: info.mode === 'edit', bom: raw !== text, eol: /\r\n/.test(text) || !/\n/.test(text) ? '\r\n' : '\n' };
  sep = /\.tsv$/i.test(file.name) ? '\t' : detectSep(text);
  dec = detectDec(text, sep);
  sepSelect.value = sep;
  loadTable(parseCSV(text, sep));
  document.getElementById('file-name').textContent = file.name + (file.editable ? '' : ' (nur lesen)');
  document.getElementById('save-btn').classList.toggle('hidden', !file.editable);
  document.title = file.name + ' – SheetOS';
  setDirty(false);
  buildGrid();
  select(0, 0);
  setMsg(file.editable ? 'Strg+S speichert zurück auf die Box.' : 'Nur lesen.');
}

// ---------- start ----------
if (SOS && SOS.file) {
  openBoxFile().catch((e) => { setMsg('Datei konnte nicht geöffnet werden: ' + e.message); loadLocal(); buildGrid(); select(0, 0); });
} else {
  loadLocal();
  buildGrid();
  select(0, 0);
}
gridEl.focus();
