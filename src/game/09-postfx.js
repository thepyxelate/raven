/* ================= post-processing ================= */
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.18, 0.3, 1.45);
composer.addPass(bloom);
// sense of speed: the picture streaks outward from the vanishing point (sharp in the middle, blurred at the edges),
// the corners darken and the colours split slightly; all of it scales with speed and nitro
const speedFx = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, amt: { value: 0 }, vig: { value: 0 }, ctr: { value: new THREE.Vector2(0.5, 0.52) } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
  fragmentShader: [
    'uniform sampler2D tDiffuse; uniform float amt; uniform float vig; uniform vec2 ctr; varying vec2 vUv;',
    'void main() {',
    '  vec2 d = vUv - ctr; float r = length( d ), w = amt * smoothstep( 0.1, 0.7, r );',
    '  float j = fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );',
    '  vec3 c = vec3( 0.0 );',
    '  for ( int i = 0; i < 10; i++ ) { float t = ( float( i ) + j ) / 10.0; c += texture2D( tDiffuse, vUv - d * w * t ).rgb; }',
    '  c /= 10.0;',
    '  c.r = mix( c.r, texture2D( tDiffuse, vUv - d * w * 1.25 ).r, 0.35 ); c.b = mix( c.b, texture2D( tDiffuse, vUv + d * w * 0.25 ).b, 0.35 );',
    '  c *= 1.0 - vig * smoothstep( 0.3, 0.95, r );',
    '  gl_FragColor = vec4( c, 1.0 );',
    '}'].join('\n')
});
speedFx.enabled = false; composer.addPass(speedFx);
composer.addPass(new OutputPass());

function resize() {
  const r = stage.getBoundingClientRect();
  const w = Math.max(1, Math.floor(r.width)), h = Math.max(1, Math.floor(r.height));
  renderer.setSize(w, h, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 1.1 ? 42 : 30;
  camera.updateProjectionMatrix();
  invalidate();
}
new ResizeObserver(resize).observe(stage);
resize();
