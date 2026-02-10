import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { getAccentColorNumber, getCanvas, getReducedMotion, supportsWebGL } from './bg-utils.js';

function initMandelbrotBackground() {
  const canvas = getCanvas('bg-canvas');
  if (!canvas) return;
  if (!supportsWebGL()) return;

  const reducedMotion = getReducedMotion();

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
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
      u_maxIter: { value: 140 },
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
      uniform int u_maxIter;
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
        // Keep the loop bound constant for the shader compiler; limit work at runtime via u_maxIter.
        const int MAX_ITER_CAP = 160;
        vec2 z = vec2(0.0);
        float it = 0.0;
        float m2 = 0.0;

        for (int i = 0; i < MAX_ITER_CAP; i++) {
          if (i >= u_maxIter) {
            it = float(u_maxIter);
            break;
          }
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
        float denom = max(1.0, float(u_maxIter));
        float v = smoothIt / denom;
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

  const centerValue = material.uniforms.u_center.value;
  // Seahorse Valley (well-known deep-zoom location).
  const targetCenterX = -0.743643887037151;
  const targetCenterY = 0.13182590420533;

  function updateCenter(progress, timeSeconds) {
    // Keep the camera *in* the seahorse valley: spiral gently around the target
    // with a small radius that shrinks as we zoom in.
    const eased = progress * progress * (3 - 2 * progress); // smoothstep
    const wobble = 0.02 * Math.sin(timeSeconds * 0.06);
    const angle = 2 * Math.PI * (eased * 0.9 + wobble);

    const radiusStart = 0.00075;
    const radiusEnd = 0.00002;
    const radius = radiusStart * Math.pow(1 - eased, 1.5) + radiusEnd;

    const dx = Math.cos(angle) * radius;
    const dy = Math.sin(angle) * radius * 0.82;

    // Ease in from a slightly wider "valley entrance" so the cycle clearly approaches the target.
    const entranceX = targetCenterX - 0.0026;
    const entranceY = targetCenterY - 0.0019;
    const approach = Math.min(1, eased / 0.28);
    const baseX = entranceX + (targetCenterX - entranceX) * approach;
    const baseY = entranceY + (targetCenterY - entranceY) * approach;

    centerValue.set(baseX + dx, baseY + dy);
  }

  let qualityScale = 1;
  let lastW = 0;
  let lastH = 0;
  let lastPixelRatio = 0;

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    // Mandelbrot shaders are iteration-heavy; keep DPR conservative.
    const basePixelRatio = Math.min(dpr, 1.25);
    const pixelRatio = Math.max(0.6, Math.min(1.0, qualityScale)) * basePixelRatio;

    if (w !== lastW || h !== lastH) {
      renderer.setSize(w, h, false);
      material.uniforms.u_aspect.value = w / h;
      lastW = w;
      lastH = h;
    }

    if (Math.abs(pixelRatio - lastPixelRatio) > 0.001) {
      renderer.setPixelRatio(pixelRatio);
      lastPixelRatio = pixelRatio;
    }
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  let rafId = 0;
  const clock = new THREE.Clock();
  let avgFrameMs = 16;
  let frameCount = 0;

  // Classic-style infinite zoom: continuously reduce scale, then reset.
  const zoomCycleSeconds = 22;
  // Start closer-in so the seahorse valley is visible earlier in the cycle.
  const scaleStart = 0.38;
  const scaleEnd = 0.00004;

  function renderFrame() {
    const dt = clock.getDelta();
    const t = clock.getElapsedTime();

    if (!reducedMotion) {
      const frameMs = Math.min(100, dt * 1000);
      avgFrameMs = avgFrameMs * 0.9 + frameMs * 0.1;
      frameCount++;

      // Light adaptive quality: lower DPR and iterations if the device struggles.
      if (frameCount % 20 === 0) {
        if (avgFrameMs > 22 && qualityScale > 0.7) {
          qualityScale = Math.max(0.7, qualityScale - 0.1);
          material.uniforms.u_maxIter.value = 110;
          resize();
        } else if (avgFrameMs < 17 && qualityScale < 1) {
          qualityScale = Math.min(1, qualityScale + 0.05);
          material.uniforms.u_maxIter.value = 140;
          resize();
        }
      }
    }

    const p = (t % zoomCycleSeconds) / zoomCycleSeconds;
    const scale = Math.exp(Math.log(scaleEnd / scaleStart) * p) * scaleStart;

    material.uniforms.u_time.value = t;
    updateCenter(p, t);
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
