import { defineConfig, normalizePath } from 'vite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// The game is one module split across src/game/NN-name.js files (one per area: garage, physics, audio, world...).
// They share a single scope, so this plugin joins them in file-name order whenever src/game/index.js is loaded,
// and emits a source map so browser errors and breakpoints point at the original part files and lines.
// paths in Vite's forward-slash form, so the checks below also work on Windows
const GAME_DIR = normalizePath(resolve(__dirname, 'src/game'));
const ENTRY = GAME_DIR + '/index.js';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const vlq = (n) => { let v = n < 0 ? (-n << 1) | 1 : n << 1, out = ''; do { let d = v & 31; v >>>= 5; if (v) d |= 32; out += B64[d]; } while (v); return out; };

function joinParts() {
  const files = readdirSync(GAME_DIR).filter((f) => /^\d\d-[\w-]+\.js$/.test(f)).sort();
  const code = [], mappings = [], sources = [], sourcesContent = [];
  let prevSrc = 0, prevLine = 0;
  files.forEach((f, si) => {
    const text = readFileSync(resolve(GAME_DIR, f), 'utf8').replace(/\n$/, '');
    const lines = text.split('\n');
    sources.push(resolve(GAME_DIR, f)); sourcesContent.push(text);
    lines.forEach((line, li) => {
      code.push(line);
      mappings.push(vlq(0) + vlq(si - prevSrc) + vlq(li - prevLine) + vlq(0)); // column 0 of the same line in its part
      prevSrc = si; prevLine = li;
    });
  });
  return { files, code: code.join('\n') + '\n', map: { version: 3, sources, sourcesContent, names: [], mappings: mappings.join(';') } };
}

const gameParts = () => ({
  name: 'raven-game-parts',
  load(id) {
    if (id.split('?')[0] !== ENTRY) return null;
    const { files, code, map } = joinParts();
    for (const f of files) this.addWatchFile(resolve(GAME_DIR, f));
    return { code, map };
  },
  handleHotUpdate({ file, server }) {
    if (file.startsWith(GAME_DIR + '/') && file !== ENTRY) { const m = server.moduleGraph.getModuleById(ENTRY); if (m) server.moduleGraph.invalidateModule(m); server.ws.send({ type: 'full-reload' }); return []; }
  }
});

// base './' lets the built site run from any folder (GitHub Pages serves it under /<repo>/)
// three.js goes in its own chunk: it rarely changes, so browsers keep it cached across game updates
export default defineConfig({
  base: './',
  plugins: [gameParts()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1200, rollupOptions: { output: { manualChunks: (id) => (id.includes('node_modules/three/') ? 'three' : undefined) } } }
});
