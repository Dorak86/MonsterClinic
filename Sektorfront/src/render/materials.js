// Gemeinsame Materialien mit Nebel-des-Krieges-Einbindung und prozedurale Texturen

import * as THREE from 'three';

export const TILE = 2; // Meter pro Feld

export const shared = {
  fowTex: { value: null },
  fowSize: { value: new THREE.Vector2(1, 1) },
  terTex: { value: null },
  time: { value: 0 },
};

export const TEAM_COLORS = {
  0: new THREE.Color(0x9aa3ad),
  1: new THREE.Color(0x2f9dff),
  2: new THREE.Color(0xff4532),
};
export const TEAM_CSS = { 0: '#9aa3ad', 1: '#2f9dff', 2: '#ff4532' };

const FOW_VERT_DECL = 'varying vec3 vFowPos;';
const FOW_VERT = `
  {
    vec4 fowP = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      fowP = instanceMatrix * fowP;
    #endif
    vFowPos = (modelMatrix * fowP).xyz;
  }
`;
const FOW_FRAG_DECL = `
uniform sampler2D fowTex;
uniform vec2 fowSize;
varying vec3 vFowPos;
`;
const FOW_FRAG = `
  {
    vec2 fuv = vFowPos.xz / fowSize;
    float fw = texture2D(fowTex, fuv).r;
    if (fuv.x < 0.0 || fuv.y < 0.0 || fuv.x > 1.0 || fuv.y > 1.0) fw = 0.75;
    float lum = dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(lum) * vec3(0.55, 0.62, 0.8), fw * 0.7) * (1.0 - fw * 0.8);
  }
`;

export function patchFow(mat, extra = {}) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    if (prev) prev(shader, r);
    shader.uniforms.fowTex = shared.fowTex;
    shader.uniforms.fowSize = shared.fowSize;
    if (extra.territory) shader.uniforms.terTex = shared.terTex;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + FOW_VERT_DECL)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + FOW_VERT);
    let fs = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FOW_FRAG_DECL + (extra.territory ? 'uniform sampler2D terTex;\n' : ''))
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n' + FOW_FRAG);
    if (extra.territory) {
      fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec4 terr = texture2D(terTex, vFowPos.xz / fowSize);
          diffuseColor.rgb = mix(diffuseColor.rgb, terr.rgb * 0.7, terr.a * 0.1);
        }`);
    }
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'fow' + (extra.territory ? 't' : '') + (mat.type);
  return mat;
}

const cache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color, roughness: opts.r ?? 0.6, metalness: opts.m ?? 0.2,
    emissive: opts.e ?? 0x000000, emissiveIntensity: opts.ei ?? 1,
    flatShading: !!opts.flat, vertexColors: !!opts.vc,
    transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
    map: opts.map || null,
  });
  patchFow(m);
  cache.set(key, m);
  return m;
}

export function canvasTex(size, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function noiseFill(g, s, base, amp, scale = 1) {
  const img = g.createImageData(s, s);
  for (let i = 0; i < s * s; i++) {
    const v = base + (Math.random() - 0.5) * amp;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  if (scale) {
    // weiche Flecken
    for (let k = 0; k < 220; k++) {
      const x = Math.random() * s, y = Math.random() * s, r = 6 + Math.random() * 30 * scale;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const a = Math.random() * 0.12;
      const c = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
      gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        g.save(); g.translate(ox, oy); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
      }
    }
  }
}

export function groundDetailTex() {
  return canvasTex(512, (g, s) => {
    noiseFill(g, s, 225, 50, 1);
    // kleine Steinchen
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = Math.random() * 2.2 + 0.4;
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '40,35,30' : '255,250,240'},${0.15 + Math.random() * 0.25})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: true });
}

export function heightToNormalTex(size = 256, strength = 2) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const hgt = new Float32Array(size * size);
  // Mehrschichtiges Rauschen
  const rnd = new Float32Array(size * size).map(() => Math.random());
  const blur = (src, r) => {
    const out = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let s = 0, n = 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        s += src[((y + dy + size) % size) * size + ((x + dx + size) % size)]; n++;
      }
      out[y * size + x] = s / n;
    }
    return out;
  };
  const b1 = blur(rnd, 1), b2 = blur(rnd, 3);
  for (let i = 0; i < hgt.length; i++) hgt[i] = b1[i] * 0.6 + b2[i] * 1.4;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const hl = hgt[y * size + ((x - 1 + size) % size)], hr = hgt[y * size + ((x + 1) % size)];
    const hu = hgt[((y - 1 + size) % size) * size + x], hd = hgt[((y + 1) % size) * size + x];
    let nx = (hl - hr) * strength, ny = (hu - hd) * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    nx /= l; ny /= l; nz /= l;
    const i = (y * size + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255;
    img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
    img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function softDotTex() {
  return canvasTex(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  });
}

export function smokeTex() {
  return canvasTex(128, (g, s) => {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * s * 0.22;
      const x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d;
      const r = s * (0.15 + Math.random() * 0.2);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.32)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
    }
  });
}

export function scorchTex() {
  return canvasTex(128, (g, s) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * s * 0.25;
      const x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d;
      const r = s * (0.08 + Math.random() * 0.22);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(20,16,14,0.35)');
      gr.addColorStop(1, 'rgba(20,16,14,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
    }
    // weiche Kante zu Weiß
    const gr = g.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  });
}

export function treadTex() {
  return canvasTex(64, (g, s) => {
    g.fillStyle = '#2a2a2c';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#3a3a3e' : '#1c1c1e';
      g.fillRect(0, i * (s / 8), s, s / 16);
    }
  }, { repeat: true });
}

export function panelTex() {
  // feine Blechfugen für Fahrzeuge und Gebäude
  return canvasTex(256, (g, s) => {
    g.fillStyle = '#e8e8e8';
    g.fillRect(0, 0, s, s);
    noiseFill(g, s, 232, 18, 0.5);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      g.beginPath(); g.moveTo(0, i * 64 + 1); g.lineTo(s, i * 64 + 1); g.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const y = Math.floor(i / 2) * 64, x = (i % 2) * 128 + (Math.floor(i / 2) % 2) * 64;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 60; i++) {
      g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 1.2, 0, 7); g.fill();
    }
  }, { repeat: true });
}
