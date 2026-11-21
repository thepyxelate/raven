import * as THREE from 'three';

// A detached canvas, and a texture made from one (sRGB colour by default, sharp at grazing angles).
export const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export function canvasTex(canvas, srgb = true) { const t = new THREE.CanvasTexture(canvas); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
