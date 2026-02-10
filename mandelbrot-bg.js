import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { getAccentColorNumber, getCanvas, getReducedMotion, supportsWebGL } from './bg-utils.js';

function initMandelbrotBackground() {
  const canvas = getCanvas('bg-canvas');
  if (!canvas) return;
  if (!supportsWebGL()) return;

  const reducedMotion = getReducedMotion();

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  // Top-down orthographic view of a fullscreen shader quad.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  camera.position.set(0, 0, 0.5);

  const accent = getAccentColorNumber();
  const accentColor = new THREE.Color(accent);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      u_center: { value: new THREE.Vector2(-0.743643887, 0.131825904) },
      u_scale: { value: 1.05 },
      u_aspect: { value: 1 },
      u_time: { value: 0 },
      u_color: { value: new THREE.Vector3(accentColor.r, accentColor.g, accentColor.b) },
      u_opacity: { value: 0.22 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;

      uniform vec2 u_center;
      uniform float u_scale;
      uniform float u_aspect;
      uniform float u_time;
      uniform vec3 u_color;
      uniform float u_opacity;

      vec2 cmul(vec2 a, vec2 b) {
        return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
      }

      void main() {
        // Map UV to complex plane (top-down view).
        vec2 p = vUv * 2.0 - 1.0;
        vec2 c = u_center + vec2(p.x * u_scale * u_aspect, p.y * u_scale);

        // Escape-time Mandelbrot.
        const int MAX_ITER = 220;
        vec2 z = vec2(0.0);
        float it = 0.0;
        float m2 = 0.0;

        for (int i = 0; i < MAX_ITER; i++) {
          z = cmul(z, z) + c;
          m2 = dot(z, z);
          if (m2 > 4.0) {
            it = float(i);
            break;
          }
          it = float(i);
        }

        // Inside set: render very faintly.
        float inside = step(m2, 4.0);

        // Smooth iteration count for contour lines.
        float smoothIt = it;
        if (m2 > 4.0) {
          float log_zn = log(m2) / 2.0;
          float nu = log(log_zn / log(2.0)) / log(2.0);
          smoothIt = it + 1.0 - nu;
        }

        // Wireframe-like contours (isolines) outside the set.
        float v = smoothIt / float(MAX_ITER);
        float bands = 26.0;
        float f = abs(fract(v * bands) - 0.5);

        // Animate slight breathing to avoid looking static between zoom rebuilds.
        float wobble = 0.012 * sin(u_time * 0.6);
        float thickness = 0.040 + wobble;
        float line = 1.0 - smoothstep(thickness, thickness + 0.012, f);

        float alphaOutside = line * u_opacity;
        float alphaInside = u_opacity * 0.05;
        float alpha = mix(alphaOutside, alphaInside, inside);

        // Fade out the far exterior a touch so the UI stays readable.
        alpha *= smoothstep(1.8, 0.2, length(p));

        gl_FragColor = vec4(u_color, alpha);
      }
    `,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    material.uniforms.u_aspect.value = w / h;
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  let rafId = 0;
  const clock = new THREE.Clock();

  // Classic-style infinite zoom: continuously reduce scale, then reset.
  const zoomCycleSeconds = 22;
  const scaleStart = 1.05;
  const scaleEnd = 0.0009;

  function renderFrame() {
    const dt = clock.getDelta();
    const t = clock.getElapsedTime();

    const p = (t % zoomCycleSeconds) / zoomCycleSeconds;
    const scale = Math.exp(Math.log(scaleEnd / scaleStart) * p) * scaleStart;

    material.uniforms.u_time.value = t;
    material.uniforms.u_scale.value = scale;
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(renderFrame);
  }

  renderer.render(scene, camera);
  if (!reducedMotion) rafId = requestAnimationFrame(renderFrame);

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (!reducedMotion && !rafId) {
        clock.start();
        rafId = requestAnimationFrame(renderFrame);
      }
    },
    { passive: true }
  );
}

initMandelbrotBackground();
