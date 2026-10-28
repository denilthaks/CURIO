// Sky, sea, clouds and ambient particles. Everything here is original,
// procedurally generated geometry; no external assets.

import * as THREE from 'three';

export const PALETTE = {
  skyTop: new THREE.Color('#1d4f91'),
  skyHorizon: new THREE.Color('#9fd8ef'),
  fog: new THREE.Color('#a6d9ee'),
  seaDeep: new THREE.Color('#0b5f8a'),
  seaShallow: new THREE.Color('#2bc4c9'),
  gold: new THREE.Color('#f2b134'),
  teal: new THREE.Color('#2dd4bf'),
};

export function createSky(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(4000, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: PALETTE.skyTop },
      horizon: { value: PALETTE.skyHorizon },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 horizon;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 c = mix(horizon, top, pow(h, 0.55));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.name = 'sky';
  sky.renderOrder = -1;
  return sky;
}

export interface Water {
  mesh: THREE.Mesh;
  update(time: number): void;
}

export function createWater(animated: boolean): Water {
  const geometry = new THREE.PlaneGeometry(6000, 6000, animated ? 160 : 1, animated ? 160 : 1);
  geometry.rotateX(-Math.PI / 2);
  const uniforms = {
    time: { value: 0 },
    deep: { value: PALETTE.seaDeep },
    shallow: { value: PALETTE.seaShallow },
    sunDir: { value: new THREE.Vector3(-0.45, 0.75, 0.35).normalize() },
    fogColor: { value: PALETTE.fog },
    fogNear: { value: 700 },
    fogFar: { value: 2600 },
    amplitude: { value: animated ? 0.35 : 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    vertexShader: /* glsl */ `
      uniform float time;
      uniform float amplitude;
      varying vec3 vWorld;
      varying float vWave;
      void main() {
        vec3 p = position;
        float w = sin(p.x * 0.035 + time * 0.9) * 0.6 + sin(p.z * 0.05 + time * 1.3) * 0.4
                + sin((p.x + p.z) * 0.08 + time * 1.7) * 0.25;
        p.y += w * amplitude;
        vWave = w;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 deep;
      uniform vec3 shallow;
      uniform vec3 sunDir;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      uniform float time;
      varying vec3 vWorld;
      varying float vWave;
      void main() {
        // Shallow turquoise near the island, deep blue offshore.
        float d = length(vWorld.xz) / 420.0;
        vec3 c = mix(shallow, deep, smoothstep(0.55, 1.6, d));
        // Gentle sparkles: cheap procedural glints.
        float glint = sin(vWorld.x * 0.9 + time * 2.0) * sin(vWorld.z * 0.8 - time * 1.6);
        c += vec3(1.0) * smoothstep(0.93, 1.0, glint) * 0.18;
        c += vWave * 0.02;
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
        c = mix(c, vec3(0.75, 0.9, 1.0), fresnel * 0.35);
        float fogF = smoothstep(fogNear, fogFar, length(cameraPosition - vWorld));
        gl_FragColor = vec4(mix(c, fogColor, fogF), 0.94);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'water';
  mesh.position.y = -0.4;
  return {
    mesh,
    update(time) {
      uniforms.time.value = time;
    },
  };
}

export function setWaterAnimated(water: Water, animated: boolean) {
  const m = water.mesh.material as THREE.ShaderMaterial;
  m.uniforms.amplitude.value = animated ? 0.35 : 0;
}

/** Soft low-poly clouds built from merged icospheres. */
export function createClouds(count: number, seed = 7): THREE.Group {
  const group = new THREE.Group();
  group.name = 'clouds';
  const material = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#dceaf5', emissiveIntensity: 0.35, transparent: true, opacity: 0.92, flatShading: true });
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const blob = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < count; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 4 + Math.floor(rand() * 4);
    for (let p = 0; p < puffs; p += 1) {
      const m = new THREE.Mesh(blob, material);
      const r = 14 + rand() * 18;
      m.scale.set(r * 1.4, r * 0.75, r);
      m.position.set((p - puffs / 2) * 18 + rand() * 8, rand() * 6, rand() * 14 - 7);
      cloud.add(m);
    }
    const angle = (i / count) * Math.PI * 2 + rand() * 0.6;
    const radius = 330 + rand() * 380;
    cloud.position.set(Math.cos(angle) * radius, 150 + rand() * 90, Math.sin(angle) * radius);
    cloud.rotation.y = rand() * Math.PI;
    cloud.userData.speed = 0.004 + rand() * 0.006;
    cloud.userData.angle = angle;
    cloud.userData.radius = radius;
    group.add(cloud);
  }
  return group;
}

export function updateClouds(group: THREE.Group, delta: number) {
  for (const cloud of group.children) {
    cloud.userData.angle += cloud.userData.speed * delta;
    cloud.position.x = Math.cos(cloud.userData.angle) * cloud.userData.radius;
    cloud.position.z = Math.sin(cloud.userData.angle) * cloud.userData.radius;
  }
}

/** Golden motes drifting over the island. */
export function createSparkles(count: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 230;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = 8 + Math.random() * 70;
    positions[i * 3 + 2] = Math.sin(a) * r;
    phases[i] = Math.random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, color: { value: PALETTE.gold }, scale: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float time;
      uniform float scale;
      attribute float phase;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y += sin(time * 0.6 + phase) * 3.0;
        p.x += cos(time * 0.3 + phase) * 2.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = scale * 160.0 / -mv.z;
        vAlpha = 0.45 + 0.55 * sin(time * 1.5 + phase * 3.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vAlpha;
        gl_FragColor = vec4(color, a);
      }`,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'sparkles';
  return points;
}
