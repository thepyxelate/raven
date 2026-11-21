/* ---- textures and materials ---- */
function roadAtlas() {
  const W = 256, H = 2560, c = mkCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#18181e'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 48000; i++) { const v = 16 + rnd() * 22 | 0; g.fillStyle = `rgba(${v},${v},${v + 5},0.6)`; g.fillRect(rnd() * W, rnd() * H, 1.6, 1.6); }
  const line = (r, w, p, th, col, dash) => {
    const y = r * 256 + 8 + (p / w + 0.5) * 240, h = Math.max(1.6, th / w * 240);
    g.fillStyle = col;
    if (!dash) g.fillRect(0, y - h / 2, W, h); else for (const [a, b] of dash) g.fillRect(a / 16 * W, y - h / 2, (b - a) / 16 * W, h);
  };
  const Y = '#d4a23a', Wt = '#d6d6d0';
  line(0, 11, -5.1, 0.15, Wt); line(0, 11, 5.1, 0.15, Wt); line(0, 11, 0, 0.14, Y, [[0, 4], [8, 12]]);
  line(1, 16, -7.6, 0.16, Wt); line(1, 16, 7.6, 0.16, Wt); line(1, 16, -0.2, 0.12, Y); line(1, 16, 0.2, 0.12, Y);
  for (const s of [-1, 1]) line(1, 16, s * 4.0, 0.14, Wt, [[0, 3], [8, 11]]);
  line(2, 20, -9.5, 0.2, Wt); line(2, 20, 9.5, 0.2, Wt); line(2, 20, -0.26, 0.14, Y); line(2, 20, 0.26, 0.14, Y);
  for (const s of [-1, 1]) line(2, 20, s * 4.5, 0.16, Wt, [[0, 4], [8, 12]]);
  g.fillStyle = '#cfcfca';
  for (let i = 0; i < 15; i += 2) g.fillRect(0, 4 * 256 + 8 + i / 15 * 240 + 2, W, 240 / 15 - 4);
  // more surfaces, so the districts do not all drive on the same street
  const speck = (r, n, lo, hi, tr, tg, tb) => { for (let i = 0; i < n; i++) { const v = lo + rnd() * (hi - lo) | 0; g.fillStyle = `rgba(${v + tr},${v + tg},${v + tb},0.6)`; g.fillRect(rnd() * W, r * 256 + rnd() * 256, 1.6, 1.6); } };
  // 5: old-town cobbles
  g.fillStyle = '#15120f'; g.fillRect(0, 5 * 256, W, 256);
  for (let y = 0; y < 256; y += 6) for (let x = (y / 6 % 2) * 4 - 4; x < W; x += 8) { const v = 30 + rnd() * 28 | 0; g.fillStyle = `rgb(${v + 9},${v + 3},${v})`; g.fillRect(x + 0.6, 5 * 256 + y + 0.6, 6.8, 4.8); }
  line(5, 11, -5.15, 0.2, '#6a655c'); line(5, 11, 5.15, 0.2, '#6a655c');
  // 6: harbor concrete slabs with expansion joints
  g.fillStyle = '#292a2f'; g.fillRect(0, 6 * 256, W, 256); speck(6, 5000, 34, 58, 0, 0, 2);
  g.fillStyle = '#0d0d10'; for (let x = 0; x < W; x += 64) g.fillRect(x, 6 * 256, 2, 256); g.fillRect(0, 6 * 256 + 127, W, 2);
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(8,8,10,0.35)'; g.fillRect(rnd() * W, 6 * 256 + 20 + rnd() * 210, 6 + rnd() * 26, 3 + rnd() * 8); }
  line(6, 11, -5.0, 0.2, Y); line(6, 11, 5.0, 0.2, Y);
  // 7: residential street: no centre line, patched asphalt, parking bays marked along the kerbs
  for (let i = 0; i < 9; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(10,10,13,0.5)' : 'rgba(44,44,50,0.45)'; g.fillRect(rnd() * W, 7 * 256 + 20 + rnd() * 200, 14 + rnd() * 40, 8 + rnd() * 24); }
  line(7, 11, -5.1, 0.12, Wt); line(7, 11, 5.1, 0.12, Wt);
  for (const s of [-1, 1]) line(7, 11, s * 4.2, 0.1, Wt, [[0, 0.25], [5.3, 5.55], [10.6, 10.85]]);
  // 8: boulevard: an avenue with painted cycle lanes along both kerbs
  g.fillStyle = 'rgba(24,104,84,0.6)';
  for (const s of [-1, 1]) { const y0 = 8 * 256 + 8 + ((s * 6.75) / 16 + 0.5) * 240; g.fillRect(0, y0 - 11, W, 22); }
  line(8, 16, -7.7, 0.16, Wt); line(8, 16, 7.7, 0.16, Wt); line(8, 16, -5.9, 0.14, Wt); line(8, 16, 5.9, 0.14, Wt);
  line(8, 16, -0.2, 0.12, Y); line(8, 16, 0.2, 0.12, Y);
  for (const s of [-1, 1]) line(8, 16, s * 3.2, 0.14, Wt, [[0, 3], [8, 11]]);
  // 9: shore street: warm, sun-bleached asphalt
  g.fillStyle = '#2b221e'; g.fillRect(0, 9 * 256, W, 256); speck(9, 6000, 30, 58, 8, 2, 0);
  line(9, 11, -5.1, 0.15, Wt); line(9, 11, 5.1, 0.15, Wt); line(9, 11, 0, 0.14, Wt, [[0, 3], [8, 11]]);
  const t = canvasTex(c); t.flipY = false; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
}
const rowV = (row, t) => (row * 256 + 8 + t * 240) / 2560;
// window mask: alpha = window shape, red = per-window random (who has the light on), green = brightness
function windowData() {
  const N = 256, d = new Uint8Array(N * N * 4);
  for (let cy = 0; cy < 16; cy++) for (let cx = 0; cx < 16; cx++) {
    const r = rnd() * 255 | 0, b = 40 + rnd() * 215 | 0;
    for (let y = 4; y < 12; y++) for (let x = 3; x < 13; x++) { const i = ((cy * 16 + y) * N + cx * 16 + x) * 4; d[i] = r; d[i + 1] = b; d[i + 3] = 255; }
  }
  const t = new THREE.DataTexture(d, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
// win.rgb = glow colour, win.a = share of lit windows (0 = plain surface, 1 = the whole surface glows: neon, lamps).
// Facades are drawn by formula, not by geometry or textures: the box UVs count 3 m bays and 3.5 m floors, and the
// shader places a window in every cell (frame, mullion, blinds, a lit or dark room) and makes the glass a mirror for
// the sky. Detail that would be smaller than a pixel is replaced by its average, so distant towers do not shimmer.
function cityMaterial(winTex) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.02, emissive: '#ffffff', emissiveMap: winTex, side: THREE.DoubleSide, envMapIntensity: 0.9 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 win;\nvarying vec4 vWin;\nvarying vec3 vFx;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvWin = win;\nvFx = vec3( abs( normal.x ), position.y, normal.y );');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', [
      '#include <common>', 'varying vec4 vWin;', 'varying vec3 vFx;',
      'float h21( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }'
    ].join('\n')).replace('#include <color_fragment>', [
      '#include <color_fragment>',
      // real cities are far less saturated than the palette; walls also darken toward the pavement (cheap ambient occlusion)
      'diffuseColor.rgb = mix( vec3( dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) ) ), diffuseColor.rgb, 0.5 );',
      'float vert = 1.0 - step( 0.5, abs( vFx.z ) );',
      'diffuseColor.rgb *= mix( 1.0, 0.72 + 0.28 * smoothstep( 0.0, 7.0, vFx.y ), vert );'
    ].join('\n')).replace('#include <emissivemap_fragment>', [
      'float full = step( 0.99, vWin.a );',
      'totalEmissiveRadiance = vWin.rgb * full * 1.15;',
      'if ( vWin.a > 0.001 && vWin.a < 0.955 ) {',
      '  vec2 fc = vEmissiveMapUv * 16.0, id = floor( fc ), f = fract( fc ), fw = fwidth( fc );',
      '  float far = smoothstep( 0.1, 0.42, max( fw.x, fw.y ) );',
      '  float st = fract( dot( vWin.rgb, vec3( 3.1, 7.7, 5.3 ) ) );', // facade style: punched windows, ribbon windows or curtain wall
      '  vec2 lo = st < 0.4 ? vec2( 0.2, 0.24 ) : st < 0.72 ? vec2( 0.03, 0.3 ) : vec2( 0.025, 0.07 );',
      '  vec2 hi = st < 0.4 ? vec2( 0.8, 0.82 ) : st < 0.72 ? vec2( 0.97, 0.84 ) : vec2( 0.975, 0.95 );',
      '  vec2 e = fw * 1.1 + 0.003;',
      '  vec2 in2 = smoothstep( lo - e, lo + e, f ) * ( 1.0 - smoothstep( hi - e, hi + e, f ) );',
      '  float open = in2.x * in2.y, area = ( hi.x - lo.x ) * ( hi.y - lo.y );',
      '  vec2 g = clamp( ( f - lo ) / ( hi - lo ), 0.0, 1.0 );',
      '  float edge = min( min( g.x, 1.0 - g.x ) * ( hi.x - lo.x ), min( g.y, 1.0 - g.y ) * ( hi.y - lo.y ) );',
      '  float frame = 1.0 - smoothstep( 0.012, 0.03, edge );',
      '  frame = max( frame, ( 1.0 - smoothstep( 0.008, 0.02, abs( g.x - 0.5 ) * ( hi.x - lo.x ) ) ) * step( st, 0.72 ) );',
      '  frame *= open * ( 1.0 - far );',
      '  float glass = mix( open * ( 1.0 - frame ), area * 0.92, far );',
      '  float h1 = h21( id ), h2 = h21( id + 31.7 ), h3 = h21( id.yx + 5.1 );',
      '  float lit = mix( step( 1.0 - vWin.a * 0.55, h1 ), vWin.a * 0.55, far );',
      '  float blind = step( 1.0 - 0.6 * h2 * step( 0.35, h3 ), g.y ) * ( 1.0 - far );',
      // wall relief: a shadow line at every floor slab, a lighter sill under punched windows
      '  float slab = ( 1.0 - smoothstep( 0.0, 0.045, f.y ) ) * ( 1.0 - far );',
      '  float sill = in2.x * ( 1.0 - smoothstep( 0.0, 0.03, abs( f.y - lo.y + 0.03 ) ) ) * step( st, 0.4 ) * ( 1.0 - far );',
      '  vec3 wall = diffuseColor.rgb * ( 1.0 - 0.22 * slab ) * ( 1.0 + 0.25 * sill );',
      '  vec3 pane = mix( vec3( 0.3, 0.35, 0.42 ), vec3( 0.5, 0.48, 0.44 ), blind );',
      '  diffuseColor.rgb = mix( mix( wall, wall * 0.3, frame ), pane, glass );',
      '  roughnessFactor = mix( roughnessFactor, mix( 0.07, 0.6, blind ), glass );',
      '  metalnessFactor = mix( metalnessFactor, mix( 0.92, 0.1, blind ), glass );',
      '  vec3 room = mix( vec3( 1.0, 0.7, 0.4 ), vec3( 0.8, 0.9, 1.0 ), step( 0.78, h2 ) ) * ( 0.5 + 0.7 * h3 );',
      '  room = mix( room * ( 0.7 + 0.3 * g.y ) * mix( 1.0, 0.5, blind ), vec3( 1.0, 0.74, 0.46 ) * 0.8, far );',
      '  totalEmissiveRadiance += room * lit * glass * 0.55;',
      '}',
      // shop windows (win.a just under 1, UVs in metres): posts between panes, doors, a transom, stock on the shelves
      'if ( vWin.a > 0.955 && full < 0.5 ) {',
      '  vec2 q = vEmissiveMapUv; float bay = 2.4, xb = fract( q.x / bay ), ib = floor( q.x / bay );',
      '  float hb = h21( vec2( ib, floor( vWin.r * 255.0 ) ) ), door = step( 0.7, hb );',
      '  float post = 1.0 - smoothstep( 0.035, 0.06, min( xb, 1.0 - xb ) * bay );',
      '  float rail = max( door * ( 1.0 - smoothstep( 0.02, 0.045, abs( q.y - 0.95 ) ) ), 1.0 - smoothstep( 0.025, 0.05, abs( q.y - 2.15 ) ) );',
      '  float frame = max( post, rail );',
      '  float sfar = smoothstep( 0.12, 0.4, fwidth( q.x ) );',
      '  float shelf = mix( step( q.y, 0.35 + 0.95 * h21( vec2( floor( q.x / 0.55 ), ib ) ) ), 0.4, sfar ) * ( 1.0 - door ) * step( q.y, 2.1 );',
      '  diffuseColor.rgb = mix( vec3( 0.2, 0.22, 0.25 ), vec3( 0.05 ), frame );',
      '  roughnessFactor = mix( 0.1, 0.5, frame ); metalnessFactor = mix( 0.6, 0.3, frame );',
      '  totalEmissiveRadiance = vWin.rgb * ( 0.75 + 0.9 * smoothstep( 0.0, 2.6, q.y ) ) * mix( 1.0, 0.3, shelf ) * ( 1.0 - frame );',
      '}'
    ].join('\n'));
  };
  m.customProgramCacheKey = () => 'raven-city-8';
  return m;
}
