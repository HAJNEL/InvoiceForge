import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

function walk(dir) {
  let out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

// Map a `value={X}` variable (or other token) to a human label, for elements
// that have no adjacent <label> to borrow text from.
const tokenMap = [
  ['value={selectedDistrict}', 'District'],
  ['value={selectedStatus}', 'Status'],
  ['value={formData.truckId}', 'Truck'],
  ['value={formData.licenseRenewalDate}', 'License renewal date'],
  ['value={formData.insuranceExpiryDate}', 'Insurance expiry date'],
  ['value={formData.nextServiceDate}', 'Next service date'],
  ['value={selectedStockStatus}', 'Stock status'],
  ['value={totalsTimeframe}', 'Timeframe'],
  ['value={customersLimit}', 'Top customers limit'],
  ['value={productsLimit}', 'Top products limit'],
  ['value={invitation.email}', 'Email'],
  ['value={sortBy}', 'Sort by'],
  ['value={sortOrder}', 'Sort order'],
  ['value={deliveredDateInput}', 'Delivered date'],
  ['value={editInvQtyValue}', 'Quantity'],
  ['value={editQtyValue}', 'Quantity'],
  ['value={item.stockCode}', 'Stock code'],
  ['value={item.description}', 'Description'],
  ["'qty', Number", 'Quantity'],
  ['value={item.unitPrice}', 'Unit price'],
  ['ref={fileInputRef}', 'Upload logo'],
];
// Per-file token overrides where the same token means different things.
const fileTokenMap = {
  'src/features/trips/TripForm.tsx': [['value={formData.date}', 'Trip date']],
};

const tags = ['input', 'select', 'textarea'];
let total = 0;

for (const file of walk('src')) {
  const fkey = file.split('\\').join('/');
  let src = readFileSync(file, 'utf8');
  const hits = [];

  for (const tag of tags) {
    const re = new RegExp('<' + tag + '\\b', 'g');
    let m;
    while ((m = re.exec(src)) !== null) {
      let i = m.index + m[0].length, depth = 0, end = -1;
      while (i < src.length) {
        const c = src[i];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '>' && depth === 0 && src[i - 1] !== '=') { end = i; break; }
        i++;
      }
      if (end === -1) continue;
      const tagText = src.slice(m.index, end + 1);
      if (/\b(aria-label|aria-labelledby|title|placeholder|id)\b/.test(tagText)) continue;

      const norm = tagText.replace(/\s+/g, ' ');
      let labelAttr = null;

      // dropzone spread inputs
      if (norm.includes('{...getInputProps()}')) {
        labelAttr = ` aria-label="${file.includes('PdfExtractor') ? 'Upload PDF' : 'Upload files'}"`;
      }
      // dynamic reusable field
      else if (norm.includes("value={value || ''}")) {
        labelAttr = ' aria-label={label}';
      }
      if (!labelAttr) {
        // borrow text from an adjacent <label> just before the element
        const ctx = src.slice(Math.max(0, m.index - 240), m.index);
        const lm = [...ctx.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)].pop();
        if (lm) {
          const text = lm[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').replace(/[:&]+$/, '').trim();
          if (text && !text.includes('{') && text.length <= 40) {
            labelAttr = ` aria-label="${text.replace(/&/g, 'and')}"`;
          }
        }
      }
      if (!labelAttr) {
        const rules = [...(fileTokenMap[fkey] || []), ...tokenMap];
        for (const [tok, lab] of rules) {
          if (norm.includes(tok)) { labelAttr = ` aria-label="${lab}"`; break; }
        }
      }
      if (!labelAttr) { console.error('NO LABEL DERIVED: ' + fkey + ' :: ' + norm.slice(0, 90)); continue; }

      // insertion point: right after `<tag`
      const insertAt = m.index + ('<' + tag).length;
      hits.push({ insertAt, labelAttr });
    }
  }

  if (!hits.length) continue;
  hits.sort((a, b) => b.insertAt - a.insertAt); // reverse so offsets stay valid
  for (const h of hits) src = src.slice(0, h.insertAt) + h.labelAttr + src.slice(h.insertAt);
  writeFileSync(file, src);
  total += hits.length;
  console.log('  ' + fkey + ': ' + hits.length);
}
console.log('Applied ' + total + ' aria-label insertions.');
