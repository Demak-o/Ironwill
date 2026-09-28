// Dev-only: print the brace depth before each top-level-looking line, to spot an unclosed block.
const fs = require('fs');
const lines = fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/);
let d = 0, inS = 0, q = '', inBlockComment = false;
lines.forEach((line, idx) => {
    const before = d;
    let trimmed = '';
    for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (inBlockComment) {
            if (ch === '*' && line[j + 1] === '/') { inBlockComment = false; j++; }
            continue;
        }
        if (inS) {
            if (ch === '\\') { j++; continue; }
            if (ch === q) { inS = 0; }
            continue;
        }
        if (ch === '/' && line[j + 1] === '*') { inBlockComment = true; j++; continue; }
        if (ch === '/' && line[j + 1] === '/') { break; }
        if (ch === "'" || ch === '"') { inS = 1; q = ch; continue; }
        if (ch === '{') d++;
        else if (ch === '}') d--;
    }
    trimmed = line.trim();
    if (/^(Game\.prototype\.[A-Za-z]|IW\.|function |var |\}\)\(\);)/.test(trimmed) || /^Game\.prototype/.test(trimmed)) {
        console.log('depth ' + before + ' -> ' + d + '  line ' + (idx + 1) + ': ' + trimmed.slice(0, 60));
    }
});
console.log('final depth', d);