import { useEffect, useRef } from "react";
import type { GameMapData } from "@fairblox/types";
import * as THREE from "three";

type RuntimePlazaProps = {
  mapData: GameMapData;
  playerPosition: { x: number; y: number; z: number };
  playerFacing: number;
  playerCount: number;
  collectedObjectIds: string[];
};

type CrowdBot = {
  group: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  marker: THREE.Sprite;
  radius: number;
  angle: number;
  speed: number;
};

const BOT_NAMES = ["Nova", "Jax", "Lumi", "Pixel", "Kai", "Mira", "Zed", "Echo", "Vega", "Skye"];

function buildNameSprite(label: string, background: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create runtime label canvas.");
  }

  context.fillStyle = background;
  context.strokeStyle = "rgba(255, 255, 255, 0.32)";
  context.lineWidth = 4;
  context.beginPath();
  context.roundRect(10, 12, 236, 72, 28);
  context.fill();
  context.stroke();

  context.font = "700 34px 'Trebuchet MS', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#f8fcff";
  context.fillText(label, 128, 49);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.8, 1.05, 1);
  return sprite;
}

export function RuntimePlaza({ mapData, playerPosition, playerFacing, playerCount, collectedObjectIds }: RuntimePlazaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerPositionRef = useRef(playerPosition);
  playerPositionRef.current = playerPosition;
  const playerFacingRef = useRef(playerFacing);
  playerFacingRef.current = playerFacing;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#161a1f");
    scene.fog = new THREE.Fog("#13171c", 34, 120);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 220);
    camera.position.set(0, 8, 12);

    const hemiLight = new THREE.HemisphereLight("#a7b8c6", "#1d221f", 1.05);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight("#f4ead8", 1.32);
    keyLight.position.set(14, 21, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -35;
    keyLight.shadow.camera.right = 35;
    keyLight.shadow.camera.top = 35;
    keyLight.shadow.camera.bottom = -35;
    scene.add(keyLight);

    const rimLight = new THREE.PointLight("#87b9ad", 1.6, 52, 2);
    rimLight.position.set(-10, 8, -12);
    scene.add(rimLight);

    const amberLight = new THREE.PointLight("#d7ab6a", 1.35, 46, 2);
    amberLight.position.set(12, 8, 10);
    scene.add(amberLight);

    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(120, 32, 24),
      new THREE.MeshBasicMaterial({ color: "#1d232b", side: THREE.BackSide }),
    );
    scene.add(skyDome);

    const distantRing = new THREE.Mesh(
      new THREE.TorusGeometry(30, 2.8, 18, 64),
      new THREE.MeshStandardMaterial({ color: "#20262d", roughness: 0.96, metalness: 0.02 }),
    );
    distantRing.rotation.x = Math.PI / 2;
    distantRing.position.y = -0.4;
    scene.add(distantRing);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(26, 64),
      new THREE.MeshStandardMaterial({ color: "#2d5741", roughness: 0.96, metalness: 0.02 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const outerWalk = new THREE.Mesh(
      new THREE.RingGeometry(17.2, 22.5, 64),
      new THREE.MeshStandardMaterial({ color: "#353e47", roughness: 0.92, metalness: 0.03 }),
    );
    outerWalk.rotation.x = -Math.PI / 2;
    outerWalk.position.y = 0.03;
    scene.add(outerWalk);

    const plazaBase = new THREE.Mesh(
      new THREE.CylinderGeometry(16, 17.8, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: "#6f7883", roughness: 0.82, metalness: 0.04 }),
    );
    plazaBase.position.y = 0.55;
    plazaBase.receiveShadow = true;
    scene.add(plazaBase);

    const plazaDeck = new THREE.Mesh(
      new THREE.CylinderGeometry(14.8, 16.2, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: "#a7adb8", roughness: 0.66, metalness: 0.04 }),
    );
    plazaDeck.position.y = 1.12;
    plazaDeck.receiveShadow = true;
    scene.add(plazaDeck);

    const plazaRing = new THREE.Mesh(
      new THREE.RingGeometry(6.2, 10.8, 64),
      new THREE.MeshStandardMaterial({ color: "#59626c", roughness: 0.54, metalness: 0.08 }),
    );
    plazaRing.rotation.x = -Math.PI / 2;
    plazaRing.position.y = 1.14;
    scene.add(plazaRing);

    const path = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.15, 5),
      new THREE.MeshStandardMaterial({ color: "#a98757", roughness: 0.9, metalness: 0.02 }),
    );
    path.position.set(10, 1.18, 13);
    path.rotation.y = -0.35;
    path.receiveShadow = true;
    scene.add(path);

    const portalPadGeometry = new THREE.CylinderGeometry(1.9, 2.2, 0.24, 28);
    const obbyPortal = new THREE.Mesh(
      portalPadGeometry,
      new THREE.MeshStandardMaterial({ color: "#22d3ee", emissive: "#0e7490", emissiveIntensity: 0.7, roughness: 0.22, metalness: 0.16 }),
    );
    obbyPortal.position.set(-10.5, 1.24, 10.5);
    obbyPortal.castShadow = true;
    scene.add(obbyPortal);
    const obbyPortalSign = buildNameSprite("OBBY", "rgba(34, 211, 238, 0.9)");
    obbyPortalSign.position.set(-10.5, 3.5, 10.5);
    obbyPortalSign.scale.set(2.5, 0.95, 1);
    scene.add(obbyPortalSign);

    const minigamePortal = new THREE.Mesh(
      portalPadGeometry,
      new THREE.MeshStandardMaterial({ color: "#fb7185", emissive: "#9f1239", emissiveIntensity: 0.7, roughness: 0.22, metalness: 0.16 }),
    );
    minigamePortal.position.set(10.5, 1.24, 10.5);
    minigamePortal.castShadow = true;
    scene.add(minigamePortal);
    const minigamePortalSign = buildNameSprite("MINIGAME", "rgba(251, 113, 133, 0.92)");
    minigamePortalSign.position.set(10.5, 3.5, 10.5);
    minigamePortalSign.scale.set(3.2, 0.95, 1);
    scene.add(minigamePortalSign);

    const fountainBase = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.8, 0.9, 24),
      new THREE.MeshStandardMaterial({ color: "#c7ccd4", roughness: 0.52, metalness: 0.06 }),
    );
    fountainBase.position.set(0, 1.55, 0);
    fountainBase.castShadow = true;
    fountainBase.receiveShadow = true;
    scene.add(fountainBase);

    const fountainBowl = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.9, 0.5, 24),
      new THREE.MeshStandardMaterial({ color: "#84a6b8", emissive: "#1c2d37", emissiveIntensity: 0.16, roughness: 0.34, metalness: 0.22 }),
    );
    fountainBowl.position.set(0, 2.15, 0);
    scene.add(fountainBowl);

    const fountainCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.65, 2.2, 16),
      new THREE.MeshStandardMaterial({ color: "#d5d9df", roughness: 0.42, metalness: 0.12 }),
    );
    fountainCore.position.set(0, 2.9, 0);
    scene.add(fountainCore);

    const fountainTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.74, 18, 14),
      new THREE.MeshStandardMaterial({ color: "#9ab6c5", emissive: "#2e414c", emissiveIntensity: 0.24, roughness: 0.28, metalness: 0.14 }),
    );
    fountainTop.position.set(0, 4.25, 0);
    scene.add(fountainTop);

    const shopText = buildNameSprite("SHOP", "rgba(38, 50, 63, 0.96)");
    shopText.position.set(0, 8.6, -9.6);
    shopText.scale.set(4.8, 1.7, 1);
    scene.add(shopText);

    const lanternGeometry = new THREE.SphereGeometry(0.42, 16, 12);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: "#8f9acd", roughness: 0.46, metalness: 0.18 });
    const poleGeometry = new THREE.CylinderGeometry(0.15, 0.18, 7.6, 10);
    const poleTopGeometry = new THREE.SphereGeometry(0.22, 10, 8);
    const wireMaterial = new THREE.MeshStandardMaterial({ color: "#9f6b2f", roughness: 0.88, metalness: 0.04 });
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      const radius = 13.8;
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.set(Math.cos(angle) * radius, 4.7, Math.sin(angle) * radius);
      pole.castShadow = true;
      scene.add(pole);
      const poleTop = new THREE.Mesh(poleTopGeometry, poleMaterial);
      poleTop.position.set(Math.cos(angle) * radius, 8.45, Math.sin(angle) * radius);
      scene.add(poleTop);
      const lantern = new THREE.Mesh(
        lanternGeometry,
        new THREE.MeshStandardMaterial({
          color: index % 2 === 0 ? "#d9bc89" : "#b9a7c6",
          emissive: index % 2 === 0 ? "#6a5432" : "#4f4457",
          emissiveIntensity: 0.86,
        }),
      );
      lantern.position.set(Math.cos(angle) * 12.3, 7.5, Math.sin(angle) * 12.3);
      lantern.castShadow = true;
      scene.add(lantern);
    }

    for (let index = 0; index < 8; index += 1) {
      const fromAngle = (index / 8) * Math.PI * 2;
      const toAngle = ((index + 1) / 8) * Math.PI * 2;
      const points = [
        new THREE.Vector3(Math.cos(fromAngle) * 13.8, 8.05, Math.sin(fromAngle) * 13.8),
        new THREE.Vector3(
          Math.cos((fromAngle + toAngle) / 2) * 13.1,
          7.25,
          Math.sin((fromAngle + toAngle) / 2) * 13.1,
        ),
        new THREE.Vector3(Math.cos(toAngle) * 13.8, 8.05, Math.sin(toAngle) * 13.8),
      ];
      const curve = new THREE.CatmullRomCurve3(points);
      const geometry = new THREE.TubeGeometry(curve, 12, 0.05, 6, false);
      const wire = new THREE.Mesh(geometry, wireMaterial);
      scene.add(wire);
    }

    for (let index = 0; index < 4; index += 1) {
      const angle = (index / 4) * Math.PI * 2 + Math.PI / 4;
      const bench = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.28, 0.9),
        new THREE.MeshStandardMaterial({ color: "#a16207", roughness: 0.86, metalness: 0.03 }),
      );
      bench.position.set(Math.cos(angle) * 9.2, 1.58, Math.sin(angle) * 9.2);
      bench.lookAt(0, 1.58, 0);
      bench.castShadow = true;
      scene.add(bench);
    }

    const boothGeometry = new THREE.BoxGeometry(3.4, 2.4, 2.2);
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      const boothGroup = new THREE.Group();
      const booth = new THREE.Mesh(
        boothGeometry,
        new THREE.MeshStandardMaterial({
          color: index % 2 === 0 ? "#8e5c3e" : "#48667a",
          roughness: 0.74,
          metalness: 0.04,
        }),
      );
      booth.castShadow = true;
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(4, 0.36, 2.8),
        new THREE.MeshStandardMaterial({ color: "#d7ceb9", roughness: 0.88, metalness: 0.01 }),
      );
      roof.position.y = 1.55;
      const boothSign = buildNameSprite(index % 2 === 0 ? "UPGRADES" : "CRATES", "rgba(24, 28, 32, 0.92)");
      boothSign.position.set(0, 2.9, 0);
      boothSign.scale.set(2.2, 0.86, 1);
      boothGroup.add(booth, roof, boothSign);
      boothGroup.position.set(Math.cos(angle) * 15.5, 2.32, Math.sin(angle) * 15.5);
      boothGroup.lookAt(0, 2.1, 0);
      scene.add(boothGroup);
    }

    const trunkGeometry = new THREE.CylinderGeometry(0.22, 0.32, 2.6, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#6b4b28", roughness: 0.96, metalness: 0.01 });
    const leafMaterial = new THREE.MeshStandardMaterial({ color: "#55775f", roughness: 0.92, metalness: 0.01 });
    for (let index = 0; index < 14; index += 1) {
      const angle = (index / 14) * Math.PI * 2;
      const radius = 20 + (index % 3) * 1.5;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = 2.3;
      trunk.castShadow = true;
      tree.add(trunk);
      for (let layer = 0; layer < 3; layer += 1) {
        const leaves = new THREE.Mesh(
          new THREE.ConeGeometry(1.6 - layer * 0.2, 2.2, 6),
          leafMaterial,
        );
        leaves.position.y = 3.8 + layer * 0.95;
        leaves.castShadow = true;
        tree.add(leaves);
      }
      tree.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      scene.add(tree);
    }

    mapData.objects.forEach((object) => {
      if (collectedObjectIds.includes(object.id)) {
        return;
      }
      const objectColor = /^#[0-9a-fA-F]{6}$/.test(object.color) ? object.color : "#8aa1b8";
      const materialTuning = object.material === "neon"
        ? { roughness: 0.18, metalness: 0.08, emissive: objectColor, emissiveIntensity: 0.22 }
        : object.material === "metal"
          ? { roughness: 0.32, metalness: 0.42, emissive: "#000000", emissiveIntensity: 0 }
          : object.material === "glass"
            ? { roughness: 0.1, metalness: 0.16, emissive: "#000000", emissiveIntensity: 0, transparent: true, opacity: 0.72 }
            : object.material === "wood"
              ? { roughness: 0.84, metalness: 0.04, emissive: "#000000", emissiveIntensity: 0 }
              : { roughness: 0.58, metalness: 0.1, emissive: "#000000", emissiveIntensity: 0 };
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(object.size.x, object.size.y, object.size.z),
        new THREE.MeshStandardMaterial({
          color: objectColor,
          ...materialTuning,
        }),
      );
      block.position.set(object.position.x, object.position.y + object.size.y / 2, object.position.z);
      block.rotation.set(
        THREE.MathUtils.degToRad(object.rotation.x),
        THREE.MathUtils.degToRad(object.rotation.y),
        THREE.MathUtils.degToRad(object.rotation.z),
      );
      block.castShadow = true;
      block.receiveShadow = true;
      scene.add(block);
    });

    mapData.checkpoints.forEach((checkpoint) => {
      const marker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 0.32, 20),
        new THREE.MeshStandardMaterial({ color: "#f2b84b", emissive: "#7a5600", emissiveIntensity: 0.5 }),
      );
      marker.position.set(checkpoint.position.x, checkpoint.position.y + 0.2, checkpoint.position.z);
      marker.castShadow = true;
      scene.add(marker);
    });

    const spawn = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 0.28, 24),
      new THREE.MeshStandardMaterial({ color: "#4fd1c5", emissive: "#0f4a45", emissiveIntensity: 0.52 }),
    );
    spawn.position.set(mapData.spawn.x, mapData.spawn.y + 0.15, mapData.spawn.z);
    spawn.castShadow = true;
    scene.add(spawn);

    const playerGroup = new THREE.Group();
    const playerBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.45, 0.76),
      new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.5, metalness: 0.08 }),
    );
    playerBody.castShadow = true;
    const playerHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 18, 14),
      new THREE.MeshStandardMaterial({ color: "#c9773f", roughness: 0.42, metalness: 0.03 }),
    );
    playerHead.castShadow = true;
    playerHead.position.y = 1.2;
    const playerBackpack = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.72, 0.34),
      new THREE.MeshStandardMaterial({ color: "#05070d", roughness: 0.46, metalness: 0.08 }),
    );
    playerBackpack.position.set(0, 0.12, -0.48);
    const armGeometry = new THREE.BoxGeometry(0.28, 1.05, 0.28);
    const legGeometry = new THREE.BoxGeometry(0.32, 0.94, 0.32);
    const limbMaterial = new THREE.MeshStandardMaterial({ color: "#c9773f", roughness: 0.52, metalness: 0.02 });
    const playerLeftArm = new THREE.Mesh(armGeometry, limbMaterial);
    const playerRightArm = new THREE.Mesh(armGeometry, limbMaterial);
    const playerLeftLeg = new THREE.Mesh(legGeometry, limbMaterial);
    const playerRightLeg = new THREE.Mesh(legGeometry, limbMaterial);
    playerLeftArm.position.set(-0.78, 0.05, 0);
    playerRightArm.position.set(0.78, 0.05, 0);
    playerLeftLeg.position.set(-0.28, -1.06, 0);
    playerRightLeg.position.set(0.28, -1.06, 0);
    playerLeftArm.castShadow = true;
    playerRightArm.castShadow = true;
    playerLeftLeg.castShadow = true;
    playerRightLeg.castShadow = true;
    const youLabel = buildNameSprite("YOU", "rgba(9, 23, 36, 0.9)");
    youLabel.position.set(0, 2.5, 0);
    playerGroup.add(playerBody, playerHead, playerBackpack, playerLeftArm, playerRightArm, playerLeftLeg, playerRightLeg, youLabel);
    scene.add(playerGroup);

    const bots: CrowdBot[] = [];
    const botCount = Math.max(4, Math.min(playerCount - 1, 14));
    for (let index = 0; index < botCount; index += 1) {
      const hue = (index * 37) % 360;
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 1.25, 0.65),
        new THREE.MeshStandardMaterial({ color: `hsl(${hue}, 78%, 56%)`, roughness: 0.48, metalness: 0.04 }),
      );
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.33, 14, 12),
        new THREE.MeshStandardMaterial({ color: "#f4c09a", roughness: 0.36, metalness: 0.06 }),
      );
      const leftArm = new THREE.Mesh(armGeometry, limbMaterial);
      const rightArm = new THREE.Mesh(armGeometry, limbMaterial);
      const leftLeg = new THREE.Mesh(legGeometry, limbMaterial);
      const rightLeg = new THREE.Mesh(legGeometry, limbMaterial);
      leftArm.position.set(-0.6, 0.02, 0);
      rightArm.position.set(0.6, 0.02, 0);
      leftLeg.position.set(-0.2, -0.94, 0);
      rightLeg.position.set(0.2, -0.94, 0);
      const marker = buildNameSprite(BOT_NAMES[index % BOT_NAMES.length] ?? `VIP ${index + 1}`, "rgba(236, 72, 153, 0.85)");
      const radius = 5.2 + (index % 4) * 2.2;
      const angle = (index / Math.max(botCount, 1)) * Math.PI * 2;
      const speed = 0.35 + (index % 5) * 0.07;

      body.castShadow = true;
      head.castShadow = true;
      leftArm.castShadow = true;
      rightArm.castShadow = true;
      leftLeg.castShadow = true;
      rightLeg.castShadow = true;
      head.position.y = 1.05;
      marker.position.set(0, 2.42, 0);
      group.add(body, head, leftArm, rightArm, leftLeg, rightLeg, marker);
      scene.add(group);
      bots.push({ group, body, head, leftArm, rightArm, leftLeg, rightLeg, marker, radius, angle, speed });
    }

    let rafId = 0;
    let lastFrameTime = performance.now();
    let elapsedTime = 0;

    const setSize = () => {
      const width = Math.max(container.clientWidth, 300);
      const height = Math.max(container.clientHeight, 220);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    setSize();
    const resizeObserver = new ResizeObserver(() => setSize());
    resizeObserver.observe(container);

    const animate = () => {
      const now = performance.now();
      const delta = Math.min((now - lastFrameTime) / 1000, 0.05);
      lastFrameTime = now;
      elapsedTime += delta;

      const nextPosition = playerPositionRef.current;
      const stride = Math.sin(elapsedTime * 5.2) * 0.18;
      playerGroup.position.set(nextPosition.x, nextPosition.y + 2.12, nextPosition.z);
      playerLeftArm.rotation.x = stride;
      playerRightArm.rotation.x = -stride;
      playerLeftLeg.rotation.x = -stride;
      playerRightLeg.rotation.x = stride;
      playerGroup.rotation.y = playerFacingRef.current;
      camera.position.x += ((nextPosition.x + 0.5) - camera.position.x) * 0.06;
      camera.position.z += ((nextPosition.z + 9.4) - camera.position.z) * 0.06;
      camera.position.y += ((nextPosition.y + 7.2) - camera.position.y) * 0.06;
      camera.lookAt(nextPosition.x, nextPosition.y + 2.35, nextPosition.z - 1.4);

      bots.forEach((bot, index) => {
        bot.angle += delta * bot.speed;
        const wave = Math.sin(elapsedTime * (1.7 + index * 0.08)) * 0.12;
        const x = Math.cos(bot.angle) * bot.radius;
        const z = Math.sin(bot.angle) * bot.radius;
        const strideWave = Math.sin(elapsedTime * (3.2 + index * 0.16)) * 0.26;
        bot.group.position.set(x, 2.02 + wave, z);
        bot.group.rotation.y = Math.atan2(-Math.cos(bot.angle), Math.sin(bot.angle));
        bot.leftArm.rotation.x = strideWave;
        bot.rightArm.rotation.x = -strideWave;
        bot.leftLeg.rotation.x = -strideWave;
        bot.rightLeg.rotation.x = strideWave;
      });

      rimLight.intensity = 1.2 + Math.sin(elapsedTime * 1.8) * 0.3;
      fountainTop.position.y = 4.25 + Math.sin(elapsedTime * 2.2) * 0.12;
      shopText.material.rotation = Math.sin(elapsedTime * 0.8) * 0.02;
      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      container.removeChild(renderer.domElement);
      scene.traverse((object: THREE.Object3D) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite)) {
          return;
        }
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
        }
        const material = object.material;
        if (Array.isArray(material)) {
          material.forEach((entry) => entry.dispose());
        } else {
          material.dispose();
        }
      });
      renderer.dispose();
    };
  }, [collectedObjectIds, mapData, playerCount]);

  return <div className="runtime-plaza runtime-world" ref={containerRef} aria-label="3D runtime plaza" />;
}
