/* =====================================================================
   xlsx.mini — بديل مصغّر لـSheetJS يغطي ما يستعمله النظام الإداري الموحّد فقط:
     XLSX.utils.book_new / aoa_to_sheet / book_append_sheet / sheet_to_json
     XLSX.write(wb, { bookType:'xlsx', type:'array' })  → Uint8Array
     XLSX.read(buf, { type:'array' })                   → Promise<workbook>
   الكتابة: zip بطريقة التخزين (بلا ضغط) — Excel يقبلها.
   القراءة: فك الضغط بـDecompressionStream المدمجة في المتصفح، وCSV بلا ضغط.
   ===================================================================== */
(function(global){
'use strict';

/* ---------- أدوات ---------- */
const enc = new TextEncoder();
const CRC_T = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++){ let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
function crc32(buf){ let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,''); }
function colName(i){ let s = ''; i++; while (i > 0){ const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26; } return s; }

/* ---------- كاتب ZIP (تخزين بلا ضغط) ---------- */
function zip(files){
  const parts = [], central = []; let off = 0;
  const dt = new Date(), dosT = ((dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() / 2)) & 0xFFFF;
  const dosD = (((dt.getFullYear() - 1980) << 9) | ((dt.getMonth() + 1) << 5) | dt.getDate()) & 0xFFFF;
  for (const f of files){
    const name = enc.encode(f.name), data = f.data, crc = crc32(data);
    const lh = new Uint8Array(30 + name.length), v = new DataView(lh.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, 0, true);
    v.setUint16(10, dosT, true); v.setUint16(12, dosD, true);
    v.setUint32(14, crc, true); v.setUint32(18, data.length, true); v.setUint32(22, data.length, true);
    v.setUint16(26, name.length, true); v.setUint16(28, 0, true);
    lh.set(name, 30);
    const ch = new Uint8Array(46 + name.length), c = new DataView(ch.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, dosT, true); c.setUint16(14, dosD, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    ch.set(name, 46);
    parts.push(lh, data); central.push(ch); off += lh.length + data.length;
  }
  const cSize = central.reduce((s, x) => s + x.length, 0);
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cSize, true); e.setUint32(16, off, true);
  const all = parts.concat(central, [end]);
  const total = all.reduce((s, x) => s + x.length, 0), out = new Uint8Array(total);
  let p = 0; for (const a of all){ out.set(a, p); p += a.length; }
  return out;
}

/* ---------- قارئ ZIP ---------- */
async function inflateRaw(bytes){
  if (typeof DecompressionStream === 'undefined') throw new Error('المتصفح لا يدعم فك ضغط ملفات Excel.');
  const ds = new DecompressionStream('deflate-raw');
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(buf);
}
async function unzip(bytes){
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 66000; i--) if (v.getUint32(i, true) === 0x06054b50){ end = i; break; }
  if (end < 0) throw new Error('الملف ليس ملف Excel صالحاً.');
  const count = v.getUint16(end + 10, true); let p = v.getUint32(end + 16, true);
  const out = {}, dec = new TextDecoder();
  for (let i = 0; i < count; i++){
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true);
    const nlen = v.getUint16(p + 28, true), elen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true);
    const lho = v.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    const lnlen = v.getUint16(lho + 26, true), lelen = v.getUint16(lho + 28, true);
    const start = lho + 30 + lnlen + lelen;
    const raw = bytes.subarray(start, start + csize);
    out[name] = { method, raw };
    p += 46 + nlen + elen + clen;
  }
  const files = {};
  for (const k of Object.keys(out)){
    const f = out[k];
    files[k] = f.method === 0 ? f.raw : await inflateRaw(f.raw);
  }
  return files;
}

/* ---------- الورقة ---------- */
function aoa_to_sheet(aoa){ return { _aoa: (aoa || []).map(r => Array.isArray(r) ? r.slice() : [r]) }; }
function book_new(){ return { SheetNames:[], Sheets:{} }; }
function book_append_sheet(wb, ws, name){
  let nm = String(name || ('Sheet' + (wb.SheetNames.length + 1))).replace(/[\\\/\?\*\[\]:]/g, '-').slice(0, 31) || 'Sheet1';
  let base = nm, i = 2; while (wb.SheetNames.includes(nm)){ nm = (base + i++).slice(0, 31); }
  wb.SheetNames.push(nm); wb.Sheets[nm] = ws; return nm;
}
function sheet_to_json(ws, opts){
  const o = opts || {}, aoa = (ws && ws._aoa) || [];
  const rows = o.blankrows === false ? aoa.filter(r => r.some(c => c !== '' && c != null)) : aoa;
  if (o.header === 1) return rows.map(r => r.map(c => c == null ? (o.defval !== undefined ? o.defval : '') : c));
  const head = (rows[0] || []).map(x => String(x));
  return rows.slice(1).map(r => { const obj = {}; head.forEach((h, i) => obj[h] = r[i] == null ? (o.defval !== undefined ? o.defval : '') : r[i]); return obj; });
}

/* ---------- الكتابة ---------- */
function sheetXML(ws){
  const aoa = ws._aoa || [], cols = ws['!cols'];
  const maxC = aoa.reduce((m, r) => Math.max(m, r.length), 1);
  let x = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>`;
  if (cols && cols.length) x += `<cols>${cols.map((c, i) => `<col min="${i+1}" max="${i+1}" width="${(c && c.wch) || 12}" customWidth="1"/>`).join('')}</cols>`;
  x += `<sheetData>`;
  aoa.forEach((row, r) => {
    x += `<row r="${r+1}">`;
    for (let c = 0; c < row.length; c++){
      const val = row[c];
      if (val === '' || val == null) continue;
      const ref = colName(c) + (r + 1);
      if (typeof val === 'number' && isFinite(val)) x += `<c r="${ref}"><v>${val}</v></c>`;
      else if (typeof val === 'boolean') x += `<c r="${ref}" t="b"><v>${val ? 1 : 0}</v></c>`;
      else if (val instanceof Date) x += `<c r="${ref}" t="inlineStr"><is><t>${esc(val.toISOString().slice(0,10))}</t></is></c>`;
      else x += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(val)}</t></is></c>`;
    }
    x += `</row>`;
  });
  return x + `</sheetData></worksheet>`;
}
function write(wb, opts){
  const o = opts || {}, names = wb.SheetNames;
  const files = [
    { name:'[Content_Types].xml', data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`) },
    { name:'_rels/.rels', data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name:'xl/workbook.xml', data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((nm, i) => `<sheet name="${esc(nm)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`) },
    { name:'xl/_rels/workbook.xml.rels', data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_, i) => `<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`) }
  ];
  names.forEach((nm, i) => files.push({ name:`xl/worksheets/sheet${i+1}.xml`, data: enc.encode(sheetXML(wb.Sheets[nm])) }));
  const out = zip(files);
  if (o.type === 'array') return out;
  if (o.type === 'blob') return new Blob([out], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return out;
}

/* ---------- القراءة ---------- */
function parseCSV(text){
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++){
    const ch = text[i];
    if (q){
      if (ch === '"'){ if (text[i+1] === '"'){ cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',' || ch === ';' || ch === '\t'){ row.push(cell); cell = ''; }
    else if (ch === '\n'){ row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length){ row.push(cell); rows.push(row); }
  return rows.map(r => r.map(c => { const t = c.trim(); if (t !== '' && /^-?\d+(\.\d+)?$/.test(t)) return parseFloat(t); return c; }));
}
function xmlDoc(bytes){ return new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml'); }
function cellText(el){
  // <is><t>..</t></is> أو <si><t>..</t></si> مع أجزاء <r><t>
  return Array.from(el.getElementsByTagName('t')).map(t => t.textContent).join('');
}
async function read(buf, opts){
  let bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4B)){
    const aoa = parseCSV(new TextDecoder().decode(bytes));
    return { SheetNames:['CSV'], Sheets:{ CSV:{ _aoa: aoa } } };
  }
  const files = await unzip(bytes);
  const shared = [];
  if (files['xl/sharedStrings.xml']){
    const doc = xmlDoc(files['xl/sharedStrings.xml']);
    Array.from(doc.getElementsByTagName('si')).forEach(si => shared.push(cellText(si)));
  }
  const wbDoc = files['xl/workbook.xml'] ? xmlDoc(files['xl/workbook.xml']) : null;
  const relDoc = files['xl/_rels/workbook.xml.rels'] ? xmlDoc(files['xl/_rels/workbook.xml.rels']) : null;
  const rels = {};
  if (relDoc) Array.from(relDoc.getElementsByTagName('Relationship')).forEach(r => rels[r.getAttribute('Id')] = r.getAttribute('Target'));
  const names = [], Sheets = {};
  const sheetEls = wbDoc ? Array.from(wbDoc.getElementsByTagName('sheet')) : [];
  sheetEls.forEach((s, i) => {
    const nm = s.getAttribute('name') || ('Sheet' + (i + 1));
    const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let target = rels[rid] || ('worksheets/sheet' + (i + 1) + '.xml');
    target = target.replace(/^\//, '').replace(/^xl\//, '');
    const key = Object.keys(files).find(k => k === 'xl/' + target) || Object.keys(files).find(k => k.endsWith(target));
    if (!key) return;
    names.push(nm); Sheets[nm] = { _aoa: sheetAOA(xmlDoc(files[key]), shared) };
  });
  if (!names.length){
    const key = Object.keys(files).find(k => /xl\/worksheets\/.*\.xml$/.test(k));
    if (key){ names.push('Sheet1'); Sheets.Sheet1 = { _aoa: sheetAOA(xmlDoc(files[key]), shared) }; }
  }
  return { SheetNames:names, Sheets };
}
function sheetAOA(doc, shared){
  const aoa = [];
  Array.from(doc.getElementsByTagName('row')).forEach(rowEl => {
    const rIdx = parseInt(rowEl.getAttribute('r'), 10);
    const r = (isFinite(rIdx) ? rIdx : aoa.length + 1) - 1;
    const row = aoa[r] || (aoa[r] = []);
    Array.from(rowEl.getElementsByTagName('c')).forEach(c => {
      const ref = c.getAttribute('r') || '';
      const m = ref.match(/^([A-Z]+)/);
      let ci = row.length;
      if (m){ ci = 0; for (const ch of m[1]) ci = ci * 26 + (ch.charCodeAt(0) - 64); ci--; }
      const t = c.getAttribute('t');
      let val = '';
      if (t === 'inlineStr'){ const is = c.getElementsByTagName('is')[0]; val = is ? cellText(is) : ''; }
      else {
        const vEl = c.getElementsByTagName('v')[0];
        const raw = vEl ? vEl.textContent : '';
        if (t === 's') val = shared[parseInt(raw, 10)] || '';
        else if (t === 'b') val = raw === '1';
        else if (t === 'str' || t === 'e') val = raw;
        else { const nv = parseFloat(raw); val = raw === '' ? '' : (isFinite(nv) ? nv : raw); }
      }
      row[ci] = val;
    });
  });
  for (let i = 0; i < aoa.length; i++) if (!aoa[i]) aoa[i] = [];
  return aoa.map(r => { for (let i = 0; i < r.length; i++) if (r[i] === undefined) r[i] = ''; return r; });
}

/* zip متاح للخارج ليبني ملفات OOXML أخرى (مثل مستندات Word) بنفس الكاتب */
global.XLSX = { version:'mini-1.0', utils:{ book_new, aoa_to_sheet, book_append_sheet, sheet_to_json }, write, read, zip };
})(typeof window !== 'undefined' ? window : this);
