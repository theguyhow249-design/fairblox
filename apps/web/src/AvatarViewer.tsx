import { useEffect, useRef } from "react";
import * as THREE from "three";

export type AvatarViewerWearable = {
  slotKey: "hat" | "face" | "neck" | "shoulder" | "back" | "waist" | "gear";
  modelKind:
    | "cap"
    | "blade"
    | "wings"
    | "boombox"
    | "crown"
    | "glasses"
    | "helmet"
    | "halo"
    | "chain"
    | "dino"
    | "custom";
  accent?: string;
  assetScale?: number;
  itemName?: string;
};

export type AvatarViewerProps = {
  skinTone: string;
  shirtColor: string;
  pantsColor: string;
  bodyType: number;
  heightScale: number;
  headScale: number;
  wearables?: AvatarViewerWearable[];
  previewWearable?: AvatarViewerWearable | null;
};

type AvatarRefs = {
  charGroup: THREE.Group;
  headGroup: THREE.Group;
  bodyMesh: THREE.Mesh;
  leftArmMesh: THREE.Mesh;
  rightArmMesh: THREE.Mesh;
  leftHand: THREE.Mesh;
  rightHand: THREE.Mesh;
  leftLegMesh: THREE.Mesh;
  rightLegMesh: THREE.Mesh;
  skinMat: THREE.MeshStandardMaterial;
  shirtMat: THREE.MeshStandardMaterial;
  pantsMat: THREE.MeshStandardMaterial;
  wearablesGroup: THREE.Group;
};

const BASE_HEAD_Y = 2.56;
const DEFAULT_ACCENT = "#7dd3c7";

function applyBodyTypeScale(refs: AvatarRefs, bodyType: number): void {
  const widthScale = 1 + bodyType / 200;
  refs.bodyMesh.scale.x = widthScale;
  const armScale = Math.max(0.92, widthScale * 0.9);
  refs.leftArmMesh.scale.x = armScale;
  refs.rightArmMesh.scale.x = armScale;
  refs.leftHand.scale.x = armScale;
  refs.rightHand.scale.x = armScale;
  const armOffset = 0.62 + (bodyType / 100) * 0.18;
  refs.leftArmMesh.position.x = -armOffset;
  refs.rightArmMesh.position.x = armOffset;
  refs.leftHand.position.x = -armOffset;
  refs.rightHand.position.x = armOffset;
}

function applyHeightScaleVal(refs: AvatarRefs, heightScale: number): void {
  refs.charGroup.scale.y = 0.88 + (heightScale / 100) * 0.28;
}

function applyHeadScaleVal(refs: AvatarRefs, headScale: number): void {
  const s = 0.84 + (headScale / 100) * 0.38;
  refs.headGroup.scale.set(s, s, s);
}

function extractAccentColor(accent?: string): string {
  if (!accent) {
    return DEFAULT_ACCENT;
  }
  const hexMatch = accent.match(/#(?:[0-9a-fA-F]{3}){1,2}/);
  return hexMatch?.[0] ?? accent;
}

function createWearableMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.1,
    emissive: color,
    emissiveIntensity: 0.08,
  });
}

function createWingSide(material: THREE.Material, direction: 1 | -1): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.25 * direction, 0.25, 0.85 * direction, 0.65, 1.25 * direction, 0.18);
  shape.bezierCurveTo(1.0 * direction, -0.1, 0.45 * direction, -0.16, 0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.y = direction === 1 ? Math.PI * 0.06 : Math.PI - Math.PI * 0.06;
  mesh.position.set(direction * 0.12, 0, -0.05);
  return mesh;
}

function buildWearableMesh(
  wearable: AvatarViewerWearable,
  material: THREE.Material,
  preview = false,
): THREE.Object3D {
  const group = new THREE.Group();
  const scaleBoost = (wearable.assetScale ?? 1) * (preview ? 1.05 : 1);

  switch (wearable.modelKind) {
    case "cap": {
      const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.22, 18), material);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.06, 0.22), material);
      capTop.position.y = 0.08;
      brim.position.set(0, -0.02, 0.34);
      group.add(capTop, brim);
      break;
    }
    case "crown": {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 10, 24), material);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      for (let index = 0; index < 5; index += 1) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 8), material);
        const angle = (Math.PI * 2 * index) / 5;
        spike.position.set(Math.cos(angle) * 0.38, 0.18, Math.sin(angle) * 0.38);
        group.add(spike);
      }
      break;
    }
    case "helmet": {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 16), material);
      dome.scale.set(1, 0.88, 1);
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.22, 0.1),
        new THREE.MeshStandardMaterial({ color: "#c9ecff", roughness: 0.12, metalness: 0.45, transparent: true, opacity: 0.82 }),
      );
      visor.position.set(0, 0.02, 0.42);
      group.add(dome, visor);
      break;
    }
    case "halo": {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.05, 10, 32), material);
      halo.rotation.x = Math.PI / 2;
      group.add(halo);
      break;
    }
    case "glasses": {
      const frameMat = new THREE.MeshStandardMaterial({ color: "#151820", roughness: 0.34, metalness: 0.18 });
      const lensMat = new THREE.MeshStandardMaterial({ color: extractAccentColor(wearable.accent), roughness: 0.12, metalness: 0.24, transparent: true, opacity: 0.72 });
      const leftLens = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.04), lensMat);
      const rightLens = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.04), lensMat);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.04), frameMat);
      leftLens.position.x = -0.16;
      rightLens.position.x = 0.16;
      group.add(leftLens, rightLens, bridge);
      break;
    }
    case "chain": {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 28, Math.PI), material);
      ring.rotation.x = Math.PI;
      group.add(ring);
      break;
    }
    case "boombox": {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.22), material);
      const speakerMat = new THREE.MeshStandardMaterial({ color: "#0f1720", roughness: 0.75, metalness: 0.08 });
      const leftSpeaker = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 16), speakerMat);
      const rightSpeaker = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 16), speakerMat);
      leftSpeaker.rotation.x = Math.PI / 2;
      rightSpeaker.rotation.x = Math.PI / 2;
      leftSpeaker.position.set(-0.14, 0, 0.12);
      rightSpeaker.position.set(0.14, 0, 0.12);
      group.add(body, leftSpeaker, rightSpeaker);
      break;
    }
    case "dino": {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.18), material);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.14), material);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 8), material);
      head.position.set(0.22, 0.08, 0);
      tail.position.set(-0.22, -0.02, 0);
      tail.rotation.z = -Math.PI / 2;
      group.add(body, head, tail);
      break;
    }
    case "wings": {
      group.add(createWingSide(material, -1), createWingSide(material, 1));
      break;
    }
    case "blade": {
      const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), material);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.08), material);
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.07, 0.72, 4),
        new THREE.MeshStandardMaterial({ color: "#dce6ef", roughness: 0.18, metalness: 0.52, emissive: extractAccentColor(wearable.accent), emissiveIntensity: 0.08 }),
      );
      blade.position.y = 0.44;
      blade.rotation.z = Math.PI;
      hilt.position.y = -0.1;
      group.add(blade, guard, hilt);
      break;
    }
    case "custom":
    default: {
      const custom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), material);
      group.add(custom);
      break;
    }
  }

  group.scale.setScalar(scaleBoost);
  return group;
}

function getWearableAttachment(slotKey: AvatarViewerWearable["slotKey"]) {
  switch (slotKey) {
    case "hat":
      return { position: new THREE.Vector3(0, BASE_HEAD_Y + 0.5, 0), rotation: new THREE.Euler(0, 0, 0) };
    case "face":
      return { position: new THREE.Vector3(0, BASE_HEAD_Y + 0.04, 0.48), rotation: new THREE.Euler(0, 0, 0) };
    case "neck":
      return { position: new THREE.Vector3(0, 1.96, 0.24), rotation: new THREE.Euler(Math.PI / 2.6, 0, 0) };
    case "shoulder":
      return { position: new THREE.Vector3(0.72, 1.95, 0.04), rotation: new THREE.Euler(0, -0.35, -0.08) };
    case "back":
      return { position: new THREE.Vector3(0, 1.72, -0.34), rotation: new THREE.Euler(0, 0, 0) };
    case "waist":
      return { position: new THREE.Vector3(0, 1.18, 0.1), rotation: new THREE.Euler(0, 0, 0) };
    case "gear":
      return { position: new THREE.Vector3(0.78, 1.02, 0.08), rotation: new THREE.Euler(0.22, 0, -0.42) };
  }
}

export function AvatarViewer({
  skinTone,
  shirtColor,
  pantsColor,
  bodyType,
  heightScale,
  headScale,
  wearables = [],
  previewWearable = null,
}: AvatarViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const avatarRefsRef = useRef<AvatarRefs | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#13171c");

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
    camera.position.set(0, 2.4, 7.4);
    camera.lookAt(0, 1.6, 0);

    scene.add(new THREE.HemisphereLight("#b4c4d8", "#1a1e14", 0.82));

    const keyLight = new THREE.DirectionalLight("#f5e8d0", 1.45);
    keyLight.position.set(5, 9, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 22;
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 8;
    keyLight.shadow.camera.bottom = -2;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#a0c0f0", 0.48);
    fillLight.position.set(-6, 3, 4);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight("#8090c0", 1.1, 18);
    rimLight.position.set(-2, 5, -4);
    scene.add(rimLight);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1.75, 2.05, 0.2, 40),
      new THREE.MeshStandardMaterial({ color: "#22292f", roughness: 0.76, metalness: 0.06 }),
    );
    platform.position.y = -0.1;
    platform.receiveShadow = true;
    scene.add(platform);

    const glowRing = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 1.76, 64),
      new THREE.MeshStandardMaterial({
        color: "#3d8fd4",
        emissive: "#1a4a72",
        emissiveIntensity: 0.7,
        roughness: 0.28,
        side: THREE.DoubleSide,
      }),
    );
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = 0.012;
    scene.add(glowRing);

    const skinMat = new THREE.MeshStandardMaterial({ color: skinTone, roughness: 0.58, metalness: 0.02 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.52, metalness: 0.04 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.72, metalness: 0.02 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: "#111118", roughness: 0.82, metalness: 0.04 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: "#080408" });

    const charGroup = new THREE.Group();
    scene.add(charGroup);

    const headGroup = new THREE.Group();
    headGroup.position.y = BASE_HEAD_Y;
    charGroup.add(headGroup);

    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.88, 0.88), skinMat);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    const eyeGeo = new THREE.BoxGeometry(0.115, 0.135, 0.052);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.195, 0.06, 0.447);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.195, 0.06, 0.447);
    headGroup.add(leftEye, rightEye);

    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.1, 0.56), shirtMat);
    bodyMesh.position.y = 1.6;
    bodyMesh.castShadow = true;
    charGroup.add(bodyMesh);

    const armGeo = new THREE.BoxGeometry(0.3, 0.96, 0.3);
    const leftArmMesh = new THREE.Mesh(armGeo, shirtMat);
    const rightArmMesh = new THREE.Mesh(armGeo, shirtMat);
    leftArmMesh.position.set(-0.64, 1.5, 0);
    rightArmMesh.position.set(0.64, 1.5, 0);
    leftArmMesh.castShadow = true;
    rightArmMesh.castShadow = true;
    charGroup.add(leftArmMesh, rightArmMesh);

    const handGeo = new THREE.BoxGeometry(0.28, 0.26, 0.28);
    const leftHand = new THREE.Mesh(handGeo, skinMat);
    const rightHand = new THREE.Mesh(handGeo, skinMat);
    leftHand.position.set(-0.64, 0.97, 0);
    rightHand.position.set(0.64, 0.97, 0);
    charGroup.add(leftHand, rightHand);

    const legGeo = new THREE.BoxGeometry(0.36, 0.94, 0.38);
    const leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
    const rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
    leftLegMesh.position.set(-0.22, 0.58, 0);
    rightLegMesh.position.set(0.22, 0.58, 0);
    leftLegMesh.castShadow = true;
    rightLegMesh.castShadow = true;
    charGroup.add(leftLegMesh, rightLegMesh);

    const shoeGeo = new THREE.BoxGeometry(0.38, 0.18, 0.44);
    const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
    const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
    leftShoe.position.set(-0.22, 0.1, 0.03);
    rightShoe.position.set(0.22, 0.1, 0.03);
    charGroup.add(leftShoe, rightShoe);

    const wearablesGroup = new THREE.Group();
    charGroup.add(wearablesGroup);

    avatarRefsRef.current = {
      charGroup,
      headGroup,
      bodyMesh,
      leftArmMesh,
      rightArmMesh,
      leftHand,
      rightHand,
      leftLegMesh,
      rightLegMesh,
      skinMat,
      shirtMat,
      pantsMat,
      wearablesGroup,
    };

    applyBodyTypeScale(avatarRefsRef.current, bodyType);
    applyHeightScaleVal(avatarRefsRef.current, heightScale);
    applyHeadScaleVal(avatarRefsRef.current, headScale);

    const setSize = () => {
      const w = Math.max(container.clientWidth, 180);
      const h = Math.max(container.clientHeight, 260);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    setSize();
    const ro = new ResizeObserver(() => setSize());
    ro.observe(container);

    let rafId = 0;
    let elapsed = 0;
    let lastTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      elapsed += dt;

      charGroup.rotation.y = elapsed * 0.55;
      headGroup.position.y = BASE_HEAD_Y + Math.sin(elapsed * 1.9) * 0.038;

      const swing = Math.sin(elapsed * 1.9) * 0.09;
      leftArmMesh.rotation.x = swing;
      rightArmMesh.rotation.x = -swing;
      leftHand.rotation.x = swing;
      rightHand.rotation.x = -swing;

      rimLight.intensity = 0.88 + Math.sin(elapsed * 2.3) * 0.22;
      (glowRing.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.55 + Math.sin(elapsed * 1.4) * 0.2;

      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };
    rafId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
      avatarRefsRef.current = null;
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      scene.traverse((obj: THREE.Object3D) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else if (mat) (mat as THREE.Material).dispose();
        }
      });
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const refs = avatarRefsRef.current;
    if (!refs) return;
    refs.skinMat.color.set(skinTone);
    refs.shirtMat.color.set(shirtColor);
    refs.pantsMat.color.set(pantsColor);
  }, [skinTone, shirtColor, pantsColor]);

  useEffect(() => {
    const refs = avatarRefsRef.current;
    if (!refs) return;
    applyBodyTypeScale(refs, bodyType);
    applyHeightScaleVal(refs, heightScale);
    applyHeadScaleVal(refs, headScale);
  }, [bodyType, heightScale, headScale]);

  useEffect(() => {
    const refs = avatarRefsRef.current;
    if (!refs) return;

    while (refs.wearablesGroup.children.length > 0) {
      const child = refs.wearablesGroup.children[0];
      refs.wearablesGroup.remove(child);
    }

    const mergedWearables = new Map<AvatarViewerWearable["slotKey"], AvatarViewerWearable>();
    for (const wearable of wearables) {
      mergedWearables.set(wearable.slotKey, wearable);
    }
    if (previewWearable) {
      mergedWearables.set(previewWearable.slotKey, previewWearable);
    }

    for (const wearable of mergedWearables.values()) {
      const preview = previewWearable?.slotKey === wearable.slotKey && previewWearable.modelKind === wearable.modelKind;
      const attachment = getWearableAttachment(wearable.slotKey);
      const mat = createWearableMaterial(extractAccentColor(wearable.accent));
      const mesh = buildWearableMesh(wearable, mat, preview);
      mesh.position.copy(attachment.position);
      mesh.rotation.copy(attachment.rotation);
      refs.wearablesGroup.add(mesh);
    }
  }, [previewWearable, wearables]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, borderRadius: "inherit", overflow: "hidden" }}
      aria-label="3D avatar preview"
    />
  );
}
