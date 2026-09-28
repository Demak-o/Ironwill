// Dev-only: report every line where brace depth returns to <= 0 (finds a prematurely closed IIFE).
const fs = require('fs');
const file = process.argv[2];
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
let d = 0, inS = 0, q = '', paren = 0;
lines.forEach((line, idx) => {
    for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (inS) {
            if (ch === '\\') { j++; continue; }
            if (ch === q) { inS = 0; }
            continue;
        }
        if (ch === "'" || ch === '"') { inS = 1; q = ch; continue; }
        if (ch === '/' && line[j + 1] === '/') { break; }
        if (ch === '{') d++;
        else if (ch === '}') d--;
        if (ch === '(') paren++;
        else if (ch === ')') paren--;
    }
    if (d <= 0) console.log('brace depth ' + d + ' after line ' + (idx + 1) + ': ' + line.trim().slice(0, 80));
});
console.log('final depth', d, 'paren', paren, 'lines', lines.length);