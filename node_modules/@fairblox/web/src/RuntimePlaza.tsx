import { useEffect, useRef } from "react";
import type { GameMapData } from "@fairblox/types";
import * as THREE from "three";

type RuntimePlazaProps = {
  mapData: GameMapData;
  playerPosition: { x: number; y: number; z: number };
  playerCount: number;
};

type CrowdBot = {
  body: THREE.Mesh;
  head: THREE.Mesh;
  marker: THREE.Sprite;
  radius: number;
  angle: number;
  speed: number;
};

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

export function RuntimePlaza({ mapData, playerPosition, playerCount }: RuntimePlazaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerPositionRef = useRef(playerPosition);
  playerPositionRef.current = playerPosition;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0f223a");
    scene.fog = new THREE.Fog("#091425", 18, 90);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);
    camera.position.set(0, 13, 20);

    const hemiLight = new THREE.HemisphereLight("#78ccff", "#194127", 0.68);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight("#ffffff", 0.82);
    keyLight.position.set(12, 16, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight("#4fd1c5", 1.4, 40, 2);
    rimLight.position.set(-10, 8, -12);
    scene.add(rimLight);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(26, 64),
      new THREE.MeshStandardMaterial({ color: "#2ea84d", roughness: 0.92, metalness: 0.08 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const plazaRing = new THREE.Mesh(
      new THREE.RingGeometry(8, 13.5, 64),
      new THREE.MeshStandardMaterial({ color: "#5f5cb6", roughness: 0.42, metalness: 0.12 }),
    );
    plazaRing.rotation.x = -Math.PI / 2;
    plazaRing.position.y = 0.05;
    scene.add(plazaRing);

    const lanternGeometry = new THREE.SphereGeometry(0.42, 16, 12);
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      const lantern = new THREE.Mesh(
        lanternGeometry,
        new THREE.MeshStandardMaterial({
          color: index % 2 === 0 ? "#f59e0b" : "#fb7185",
          emissive: index % 2 === 0 ? "#8f4500" : "#7f1734",
          emissiveIntensity: 0.9,
        }),
      );
      lantern.position.set(Math.cos(angle) * 11, 4.8, Math.sin(angle) * 11);
      scene.add(lantern);
    }

    const boothGeometry = new THREE.BoxGeometry(3.4, 2.4, 2.2);
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      const booth = new THREE.Mesh(
        boothGeometry,
        new THREE.MeshStandardMaterial({
          color: index % 2 === 0 ? "#ea580c" : "#0ea5e9",
          roughness: 0.72,
          metalness: 0.14,
        }),
      );
      booth.castShadow = true;
      booth.position.set(Math.cos(angle) * 15.5, 1.2, Math.sin(angle) * 15.5);
      booth.lookAt(0, 1.2, 0);
      scene.add(booth);
    }

    const worldMaterial = new THREE.MeshStandardMaterial({ color: "#9bb2c7", roughness: 0.62, metalness: 0.16 });
    mapData.objects.forEach((object) => {
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(object.size.x, object.size.y, object.size.z),
        new THREE.MeshStandardMaterial({
          color: /^#[0-9a-fA-F]{6}$/.test(object.color) ? object.color : "#8aa1b8",
          roughness: 0.66,
          metalness: 0.18,
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
      new THREE.CapsuleGeometry(0.55, 1.3, 6, 10),
      new THREE.MeshStandardMaterial({ color: "#f97316", roughness: 0.44, metalness: 0.06 }),
    );
    playerBody.castShadow = true;
    const playerHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.46, 18, 14),
      new THREE.MeshStandardMaterial({ color: "#f6c8a2", roughness: 0.4, metalness: 0.05 }),
    );
    playerHead.castShadow = true;
    playerHead.position.y = 1.35;
    const youLabel = buildNameSprite("YOU", "rgba(9, 23, 36, 0.9)");
    youLabel.position.set(0, 2.5, 0);
    playerGroup.add(playerBody, playerHead, youLabel);
    scene.add(playerGroup);

    const bots: CrowdBot[] = [];
    const botCount = Math.max(4, Math.min(playerCount - 1, 14));
    for (let index = 0; index < botCount; index += 1) {
      const hue = (index * 37) % 360;
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.42, 1.05, 5, 8),
        new THREE.MeshStandardMaterial({ color: `hsl(${hue}, 78%, 56%)`, roughness: 0.5, metalness: 0.05 }),
      );
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 14, 12),
        new THREE.MeshStandardMaterial({ color: "#f4c09a", roughness: 0.36, metalness: 0.06 }),
      );
      const marker = buildNameSprite(`VIP ${index + 1}`, "rgba(236, 72, 153, 0.85)");
      const radius = 5.2 + (index % 4) * 2.2;
      const angle = (index / Math.max(botCount, 1)) * Math.PI * 2;
      const speed = 0.35 + (index % 5) * 0.07;

      body.castShadow = true;
      head.castShadow = true;
      scene.add(body, head, marker);
      bots.push({ body, head, marker, radius, angle, speed });
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
      playerGroup.position.set(nextPosition.x, nextPosition.y + 1.05, nextPosition.z);
      const orbitRadius = 8.5;
      camera.position.x = nextPosition.x + Math.cos(elapsedTime * 0.22) * orbitRadius;
      camera.position.z = nextPosition.z + Math.sin(elapsedTime * 0.22) * orbitRadius;
      camera.position.y = 8.6 + Math.sin(elapsedTime * 0.7) * 0.55;
      camera.lookAt(nextPosition.x, nextPosition.y + 1.1, nextPosition.z);

      bots.forEach((bot, index) => {
        bot.angle += delta * bot.speed;
        const wave = Math.sin(elapsedTime * (1.7 + index * 0.08)) * 0.14;
        const x = Math.cos(bot.angle) * bot.radius;
        const z = Math.sin(bot.angle) * bot.radius;
        bot.body.position.set(x, 1 + wave, z);
        bot.head.position.set(x, 2.02 + wave, z);
        bot.marker.position.set(x, 2.88 + wave, z);
      });

      rimLight.intensity = 1.2 + Math.sin(elapsedTime * 1.8) * 0.3;
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
  }, [mapData, playerCount]);

  return <div className="runtime-plaza runtime-world" ref={containerRef} aria-label="3D runtime plaza" />;
}
