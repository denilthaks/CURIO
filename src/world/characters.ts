// Stylised low-poly story characters built from primitives (original geometry,
// no external models). Poses are procedural and blend smoothly; animation
// never blocks dialogue, which lives in HTML.

import * as THREE from 'three';

export type Pose = 'idle' | 'talk' | 'point' | 'wave' | 'celebrate';

interface Look {
  skin: string;
  hair: string;
  tunic: string;
  accent: string;
  legs: string;
  hairStyle: 'braid' | 'bun' | 'short' | 'hood';
  prop?: 'lantern' | 'hammer' | 'basket' | 'scroll';
}

export const LOOKS: Record<string, Look> = {
  mira: { skin: '#e8b48f', hair: '#3b2416', tunic: '#0f766e', accent: '#f2b134', legs: '#2a3b4f', hairStyle: 'hood', prop: 'lantern' },
  sigrun: { skin: '#f0c4a0', hair: '#c4572a', tunic: '#7a4a2a', accent: '#d9c8a4', legs: '#3d2e22', hairStyle: 'braid', prop: 'hammer' },
  tove: { skin: '#c98d68', hair: '#1f1a17', tunic: '#b8691f', accent: '#2dd4bf', legs: '#4a3626', hairStyle: 'bun', prop: 'basket' },
  astrid: { skin: '#f3cfb3', hair: '#e9d18a', tunic: '#1d3a63', accent: '#f2b134', legs: '#16243a', hairStyle: 'short', prop: 'scroll' },
};

export interface Character {
  group: THREE.Group;
  setPose(pose: Pose): void;
  update(time: number, delta: number, reducedMotion: boolean): void;
  dispose(): void;
}

export function createCharacter(key: string): Character {
  const look = LOOKS[key] ?? LOOKS.mira;
  const group = new THREE.Group();
  group.name = `character-${key}`;
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const mat = (color: string) => {
    const m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    materials.push(m);
    return m;
  };
  const geo = <T extends THREE.BufferGeometry>(g: T) => {
    geometries.push(g);
    return g;
  };
  const skin = mat(look.skin);
  const hair = mat(look.hair);
  const tunic = mat(look.tunic);
  const accent = mat(look.accent);
  const legs = mat(look.legs);
  const dark = mat('#1b1b22');

  const root = new THREE.Group(); // bobs / jumps
  group.add(root);

  // Legs
  const legGeo = geo(new THREE.BoxGeometry(0.22, 0.75, 0.24));
  const legL = new THREE.Mesh(legGeo, legs);
  const legR = new THREE.Mesh(legGeo, legs);
  legL.position.set(-0.15, 0.38, 0);
  legR.position.set(0.15, 0.38, 0);
  root.add(legL, legR);
  const bootGeo = geo(new THREE.BoxGeometry(0.26, 0.16, 0.34));
  const bootL = new THREE.Mesh(bootGeo, dark);
  const bootR = new THREE.Mesh(bootGeo, dark);
  bootL.position.set(-0.15, 0.08, 0.04);
  bootR.position.set(0.15, 0.08, 0.04);
  root.add(bootL, bootR);

  // Torso (tapered tunic) + belt
  const torso = new THREE.Group();
  torso.position.y = 0.72;
  root.add(torso);
  const body = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.3, 0.46, 0.95, 7)), tunic);
  body.position.y = 0.45;
  torso.add(body);
  const belt = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.4, 0.42, 0.1, 7)), accent);
  belt.position.y = 0.3;
  torso.add(belt);

  // Head
  const head = new THREE.Group();
  head.position.y = 1.15;
  torso.add(head);
  const face = new THREE.Mesh(geo(new THREE.IcosahedronGeometry(0.34, 1)), skin);
  face.position.y = 0.2;
  head.add(face);
  const eyeGeo = geo(new THREE.SphereGeometry(0.045, 6, 6));
  const eyeL = new THREE.Mesh(eyeGeo, dark);
  const eyeR = new THREE.Mesh(eyeGeo, dark);
  eyeL.position.set(-0.12, 0.24, 0.3);
  eyeR.position.set(0.12, 0.24, 0.3);
  head.add(eyeL, eyeR);

  // Hair styles
  if (look.hairStyle === 'hood') {
    // Open at the front (+z) so the face shows.
    const hood = new THREE.Mesh(geo(new THREE.SphereGeometry(0.42, 10, 6, Math.PI / 2 + 0.75, Math.PI * 2 - 1.5, 0, Math.PI * 0.62)), tunic);
    hood.material.side = THREE.DoubleSide;
    hood.position.set(0, 0.24, -0.04);
    hood.rotation.x = -0.25;
    head.add(hood);
    const fringe = new THREE.Mesh(geo(new THREE.SphereGeometry(0.35, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.3)), hair);
    fringe.position.set(0, 0.25, 0.02);
    head.add(fringe);
    const cape = new THREE.Mesh(geo(new THREE.ConeGeometry(0.62, 1.15, 7, 1, true)), tunic);
    cape.position.set(0, 0.42, -0.08);
    torso.add(cape);
  } else {
    // Crown covers the top of the head; a back piece frames the face.
    const cap = new THREE.Mesh(geo(new THREE.SphereGeometry(0.37, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.36)), hair);
    cap.position.set(0, 0.22, -0.02);
    const back = new THREE.Mesh(geo(new THREE.SphereGeometry(0.37, 10, 5, Math.PI / 2 + 0.9, Math.PI * 2 - 1.8, 0, Math.PI * 0.62)), hair);
    back.position.set(0, 0.22, -0.02);
    (back.material as THREE.Material).side = THREE.DoubleSide;
    head.add(cap, back);
    if (look.hairStyle === 'braid') {
      for (let i = 0; i < 4; i += 1) {
        const knot = new THREE.Mesh(geo(new THREE.IcosahedronGeometry(0.1 - i * 0.012, 0)), hair);
        knot.position.set(0, 0.1 - i * 0.17, -0.34);
        head.add(knot);
      }
    } else if (look.hairStyle === 'bun') {
      const bun = new THREE.Mesh(geo(new THREE.IcosahedronGeometry(0.16, 0)), hair);
      bun.position.set(0, 0.55, -0.12);
      head.add(bun);
    }
  }
  if (key === 'astrid') {
    const torc = new THREE.Mesh(geo(new THREE.TorusGeometry(0.25, 0.04, 6, 12)), accent);
    torc.rotation.x = Math.PI / 2;
    torc.position.y = 0.93;
    torso.add(torc);
  }

  // Arms pivot at the shoulders
  const makeArm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.38, 0.88, 0);
    const upper = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.09, 0.5, 3, 6)), tunic);
    upper.position.y = -0.32;
    const hand = new THREE.Mesh(geo(new THREE.IcosahedronGeometry(0.1, 0)), skin);
    hand.position.y = -0.66;
    pivot.add(upper, hand);
    torso.add(pivot);
    return { pivot, hand };
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // Props in the left hand
  if (look.prop) {
    const prop = new THREE.Group();
    if (look.prop === 'lantern') {
      const glass = new THREE.Mesh(geo(new THREE.BoxGeometry(0.2, 0.26, 0.2)), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
      materials.push(glass.material as THREE.Material);
      const lid = new THREE.Mesh(geo(new THREE.ConeGeometry(0.16, 0.12, 4)), dark);
      lid.position.y = 0.19;
      prop.add(glass, lid);
      const light = new THREE.PointLight('#ffcf70', 2.5, 7, 2);
      light.position.y = 0;
      prop.add(light);
    } else if (look.prop === 'hammer') {
      const handle = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 5)), mat('#6b4a2c'));
      const headM = new THREE.Mesh(geo(new THREE.BoxGeometry(0.28, 0.13, 0.13)), mat('#8a8f99'));
      headM.position.y = 0.3;
      prop.add(handle, headM);
    } else if (look.prop === 'basket') {
      const basket = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.2, 0.15, 0.22, 7)), mat('#a87b3f'));
      const fruit = new THREE.Mesh(geo(new THREE.IcosahedronGeometry(0.1, 0)), mat('#d94b3f'));
      fruit.position.y = 0.12;
      prop.add(basket, fruit);
    } else if (look.prop === 'scroll') {
      const scroll = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 6)), mat('#f7f0e1'));
      scroll.rotation.z = Math.PI / 2;
      prop.add(scroll);
    }
    prop.position.y = -0.78;
    armL.pivot.add(prop);
  }

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });

  // ---- Animation ----
  let pose: Pose = 'idle';
  let poseStarted = 0;
  const current = { armL: 0.1, armR: -0.1, armRx: 0, armLx: 0, head: 0, lift: 0 };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  return {
    group,
    setPose(next) {
      if (next !== pose) {
        pose = next;
        poseStarted = performance.now() / 1000;
      }
    },
    update(time, delta, reducedMotion) {
      const t = time;
      const since = t - poseStarted;
      const target = { armL: 0.12, armR: -0.12, armRx: 0, armLx: 0, head: 0, lift: 0 };
      switch (pose) {
        case 'talk':
          target.armR = -0.35 - Math.sin(t * 3.1) * 0.25;
          target.armRx = -0.6 - Math.sin(t * 2.3) * 0.2;
          target.head = Math.sin(t * 2.6) * 0.08;
          break;
        case 'point':
          target.armRx = -1.45;
          target.armR = -0.15;
          target.head = 0.05;
          break;
        case 'wave':
          target.armR = -2.6 + Math.sin(t * 7) * 0.35;
          break;
        case 'celebrate':
          target.armL = 2.5;
          target.armR = -2.5;
          target.lift = reducedMotion ? 0 : Math.max(0, Math.sin(since * 6)) * 0.35;
          break;
        default:
          target.armL = 0.12 + Math.sin(t * 1.3) * 0.03;
          target.armR = -0.12 - Math.sin(t * 1.3) * 0.03;
      }
      const k = reducedMotion ? 1 : Math.min(1, delta * 8);
      for (const key of Object.keys(current) as (keyof typeof current)[]) current[key] = lerp(current[key], target[key], k);
      armL.pivot.rotation.z = current.armL;
      armR.pivot.rotation.z = current.armR;
      armR.pivot.rotation.x = current.armRx;
      armL.pivot.rotation.x = current.armLx;
      head.rotation.x = current.head;
      root.position.y = current.lift;
      if (!reducedMotion) {
        torso.scale.y = 1 + Math.sin(t * 2) * 0.012; // breathing
        head.rotation.y = Math.sin(t * 0.7) * 0.12;
      }
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
