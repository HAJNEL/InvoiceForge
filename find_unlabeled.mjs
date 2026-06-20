import { readFileSync, readdirSync } from 'fs';
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

const files = walk('src');
const tags = ['input', 'select', 'textarea'];
let count = 0;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
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
      const hasLabelAttr = /\b(aria-label|aria-labelledby|title|placeholder|id)\b/.test(tagText);
      if (!hasLabelAttr) {
        const before = src.slice(0, m.index);
        const line = before.split('\n').length;
        const prevLines = before.split('\n').slice(-3).join(' | ').replace(/\s+/g, ' ').slice(-160);
        count++;
        console.log(file.split('\\').join('/') + ':' + line);
        console.log('   PREV: ' + prevLines);
        console.log('   TAG:  ' + tagText.replace(/\s+/g, ' ').slice(0, 110));
      }
    }
  }
}
console.log('\nTotal unlabeled: ' + count);
