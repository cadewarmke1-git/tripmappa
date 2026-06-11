import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * GenerationCinematicLoader
 * Cinematic loading scene: road / air / water worlds by vehicle, CSS fallback when WebGL unavailable.
 */

const GOLD = "#FFD28C";
const ORANGE = "#FF8C42";
const TAILLIGHT = "#ff6b4a";

const SKY_PHASE_MAP = {
  night: "night",
  pre_dawn: "night",
  sunset: "sunset",
  twilight: "sunset",
  golden_hour: "sunset",
  dusk: "sunset",
  sunrise: "sunset",
  day: "day",
  midday: "day",
};

const BUILDING_COUNT = 22;
const BUILDING_TRACK = 24;

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function shortCity(value) {
  return value?.split(",")[0]?.trim() || value?.trim() || "";
}

function resolveSkyScenePhase(phase) {
  if (!phase) return "sunset";
  const key = String(phase).toLowerCase();
  return SKY_PHASE_MAP[key] || "sunset";
}

function resolveVehicleKind(vehicleType) {
  const raw = String(vehicleType || "").toLowerCase();
  if (raw.includes("truck") || raw.includes("semi") || raw.includes("freight")) return "truck";
  if (raw.includes("rv") || raw.includes("camper") || raw.includes("motorhome")) return "rv";
  if (raw.includes("motorcycle") || raw.includes("moto") || raw.includes("bike")) return "motorcycle";
  if (raw.includes("boat") || raw.includes("ferry") || raw.includes("water")) return "boat";
  if (raw.includes("plane") || raw.includes("flight") || raw.includes("air")) return "plane";
  return "car";
}

function resolveWorldKind(vehicleKind) {
  if (vehicleKind === "plane") return "air";
  if (vehicleKind === "boat") return "water";
  return "road";
}

function computeCityBeatLabel(progress, cityBeats, destination) {
  const p = clamp01(progress);
  if (p >= 0.97 && destination) {
    const dest = shortCity(destination);
    return dest ? { text: `Arriving — ${dest}`, arriving: true } : null;
  }
  const n = cityBeats.length;
  if (!n || p * (n + 1) < 1) return null;
  const idx = Math.min(n - 1, Math.max(0, Math.floor(p * (n + 1)) - 1));
  const city = cityBeats[idx];
  if (!city) return null;
  return { text: `Passing ${shortCity(city)}`, arriving: false };
}

function canUseWebGL() {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setPrefersReducedMotion(media.matches);
    apply();
    if (media.addEventListener) {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
    media.addListener(apply);
    return () => media.removeListener(apply);
  }, []);

  return prefersReducedMotion;
}

function phasePalette(phase) {
  if (phase === "night") {
    return {
      top: "#090b1f",
      horizon: "#32204f",
      glow: "#6973ff",
      fog: "#1a1f35",
      road: "#1d2130",
      lane: "#b8c7ff",
      cloud: "#5f6b99",
      water: "#0f1f3d",
      celestial: "#dbe7ff",
    };
  }
  if (phase === "day") {
    return {
      top: "#79b4f7",
      horizon: "#c6e3ff",
      glow: "#ffe8b0",
      fog: "#9ec8f0",
      road: "#444b57",
      lane: "#fff4be",
      cloud: "#f4f8ff",
      water: "#4ea7dc",
      celestial: "#fff7cc",
    };
  }
  return {
    top: "#3b4a82",
    horizon: "#d99266",
    glow: "#ffd29e",
    fog: "#5a4a6e",
    road: "#343746",
    lane: "#ffe3a1",
    cloud: "#e8d9dd",
    water: "#2e5c85",
    celestial: "#ffd89a",
  };
}

function fallbackGradient(phase) {
  if (phase === "night") {
    return "linear-gradient(180deg, #090b1f 0%, #32204f 42%, #4a3068 100%)";
  }
  if (phase === "day") {
    return "linear-gradient(180deg, #79b4f7 0%, #c6e3ff 42%, #ffe8b0 100%)";
  }
  return "linear-gradient(180deg, #3b4a82 0%, #d99266 42%, #ffd29e 100%)";
}

function SceneFog({ color }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.Fog(color, 7, 34);
    return () => {
      scene.fog = null;
    };
  }, [scene, color]);
  return null;
}

function Lights({ palette, scenePhase, worldKind }) {
  const night = scenePhase === "night";
  return (
    <>
      <ambientLight intensity={night ? 0.45 : 0.6} color={palette.cloud} />
      <directionalLight position={[3, 6, 4]} intensity={night ? 0.55 : 0.95} color={palette.glow} />
      <directionalLight position={[-5, 3, -4]} intensity={0.25} color="#9bc4ff" />
      {worldKind === "air" && (
        <directionalLight position={[0, 8, -2]} intensity={0.35} color={palette.celestial} />
      )}
    </>
  );
}

function Atmosphere({ palette }) {
  return (
    <group position={[0, 1.5, -6]}>
      <mesh>
        <planeGeometry args={[30, 14]} />
        <meshBasicMaterial color={palette.top} fog={false} />
      </mesh>
      <mesh position={[0, -2.5, 0.01]}>
        <planeGeometry args={[30, 7]} />
        <meshBasicMaterial color={palette.horizon} transparent opacity={0.95} fog={false} />
      </mesh>
    </group>
  );
}

function Stars({ visible }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(60 * 3);
    for (let i = 0; i < 60; i += 1) {
      arr[i * 3] = (Math.sin(i * 33.3) * 0.5 + 0.5) * 18 - 9;
      arr[i * 3 + 1] = (Math.cos(i * 51.1) * 0.5 + 0.5) * 5 + 1;
      arr[i * 3 + 2] = -5 - (i % 7) * 0.15;
    }
    return arr;
  }, []);

  if (!visible) return null;

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.07}
        color="#f7faff"
        transparent
        opacity={0.88}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function Celestial({ phase, palette }) {
  const ref = useRef(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    m.position.x = -3.5 + Math.sin(t * 0.08) * 0.4;
    m.position.y = phase === "night" ? 2.4 + Math.sin(t * 0.15) * 0.15 : 1.8 + Math.sin(t * 0.12) * 0.2;
    m.position.z = -5.2;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[phase === "night" ? 0.35 : 0.5, 20, 20]} />
      <meshBasicMaterial color={palette.celestial} fog={false} />
    </mesh>
  );
}

function HorizonGlow({ palette, scenePhase }) {
  const opacity = scenePhase === "night" ? 0.18 : scenePhase === "day" ? 0.14 : 0.28;
  return (
    <mesh position={[0, -1.25, -5]} scale={[1, 0.5, 1]}>
      <planeGeometry args={[18, 3.2]} />
      <meshBasicMaterial color={palette.glow} transparent opacity={opacity} fog={false} />
    </mesh>
  );
}

function RoadSurface({ palette }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.28, -0.5]}>
      <planeGeometry args={[3.4, 30]} />
      <meshStandardMaterial color={palette.road} roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

function LaneDashes({ palette, speed = 2.4 }) {
  const dashes = useMemo(() => Array.from({ length: 20 }, (_, i) => i), []);
  return (
    <group>
      {dashes.map(i => (
        <LaneDash key={i} index={i} color={palette.lane} speed={speed} />
      ))}
    </group>
  );
}

function LaneDash({ index, color, speed }) {
  const ref = useRef(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime * speed + index * 1.1;
    const z = -((t % 26) - 13);
    m.position.set(0, -1.245, z);
  });
  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.12, 0.005, 0.78]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function ScrollingBuildings({ palette, speed = 2.6 }) {
  const meshRef = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const buildingColor = useMemo(
    () => new THREE.Color(palette.horizon).offsetHSL(0, -0.1, -0.25),
    [palette.horizon]
  );

  const configs = useMemo(
    () =>
      Array.from({ length: BUILDING_COUNT }, (_, i) => ({
        side: i % 2 === 0 ? -1 : 1,
        band: Math.floor(i / 2),
        offset: (i / BUILDING_COUNT) * BUILDING_TRACK,
        h: 0.25 + ((i * 17) % 8) * 0.11,
        w: 0.36 + ((i * 13) % 5) * 0.08,
        d: 0.32 + ((i * 9) % 4) * 0.09,
      })),
    []
  );

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const travel = clock.elapsedTime * speed;
    configs.forEach((cfg, i) => {
      const z = 8 - ((travel + cfg.offset) % BUILDING_TRACK);
      const x = cfg.side * (2.15 + (cfg.band % 3) * 0.45);
      dummy.position.set(x, -1.3 + cfg.h * 0.5, z);
      dummy.scale.set(cfg.w, cfg.h, cfg.d);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, BUILDING_COUNT]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={buildingColor} roughness={0.9} metalness={0.02} />
    </instancedMesh>
  );
}

function Wheel({ position, speed = 9 }) {
  const ref = useRef(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.x = clock.elapsedTime * speed;
  });
  return (
    <mesh ref={ref} position={position} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.038, 0.038, 0.028, 10]} />
      <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
    </mesh>
  );
}

function Headlights({ visible }) {
  if (!visible) return null;
  return (
    <>
      <pointLight position={[-0.07, 0.05, 0.28]} color="#fff8e0" intensity={0.55} distance={2.2} />
      <pointLight position={[0.07, 0.05, 0.28]} color="#fff8e0" intensity={0.55} distance={2.2} />
      <mesh position={[-0.07, 0.05, 0.26]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshBasicMaterial color="#fffce8" />
      </mesh>
      <mesh position={[0.07, 0.05, 0.26]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshBasicMaterial color="#fffce8" />
      </mesh>
    </>
  );
}

function Taillights() {
  return (
    <>
      <mesh position={[-0.08, 0.06, -0.18]}>
        <sphereGeometry args={[0.014, 6, 6]} />
        <meshBasicMaterial color={TAILLIGHT} />
      </mesh>
      <mesh position={[0.08, 0.06, -0.18]}>
        <sphereGeometry args={[0.014, 6, 6]} />
        <meshBasicMaterial color={TAILLIGHT} />
      </mesh>
    </>
  );
}

function VehicleMesh({ vehicleKind }) {
  if (vehicleKind === "truck") {
    return (
      <group>
        <mesh position={[0, 0.08, 0.05]}>
          <boxGeometry args={[0.3, 0.13, 0.5]} />
          <meshStandardMaterial color={GOLD} roughness={0.55} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.11, -0.32]}>
          <boxGeometry args={[0.24, 0.17, 0.34]} />
          <meshStandardMaterial color={ORANGE} roughness={0.5} metalness={0.12} />
        </mesh>
        <Wheel position={[-0.1, 0.02, 0.18]} />
        <Wheel position={[0.1, 0.02, 0.18]} />
        <Wheel position={[-0.1, 0.02, -0.22]} />
        <Wheel position={[0.1, 0.02, -0.22]} />
        <Taillights />
      </group>
    );
  }
  if (vehicleKind === "rv") {
    return (
      <group>
        <mesh position={[0, 0.11, 0]}>
          <boxGeometry args={[0.28, 0.17, 0.52]} />
          <meshStandardMaterial color={GOLD} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.14, -0.28]}>
          <boxGeometry args={[0.22, 0.12, 0.14]} />
          <meshStandardMaterial color={ORANGE} roughness={0.5} />
        </mesh>
        <Wheel position={[-0.09, 0.02, 0.2]} />
        <Wheel position={[0.09, 0.02, 0.2]} />
        <Wheel position={[-0.09, 0.02, -0.2]} />
        <Wheel position={[0.09, 0.02, -0.2]} />
        <Taillights />
      </group>
    );
  }
  if (vehicleKind === "motorcycle") {
    return (
      <group>
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[0.1, 0.08, 0.24]} />
          <meshStandardMaterial color={ORANGE} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.1, -0.06]}>
          <boxGeometry args={[0.06, 0.06, 0.1]} />
          <meshStandardMaterial color={GOLD} roughness={0.55} />
        </mesh>
        <Wheel position={[0, 0.02, 0.1]} speed={14} />
        <Wheel position={[0, 0.02, -0.1]} speed={14} />
        <Taillights />
      </group>
    );
  }
  if (vehicleKind === "boat") {
    return (
      <group>
        <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.14, 0.42, 10]} />
          <meshStandardMaterial color={GOLD} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.12, -0.04]}>
          <boxGeometry args={[0.06, 0.1, 0.06]} />
          <meshStandardMaterial color={ORANGE} roughness={0.5} />
        </mesh>
      </group>
    );
  }
  if (vehicleKind === "plane") {
    return (
      <group>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.1, 0.09, 0.42]} />
          <meshStandardMaterial color={GOLD} roughness={0.45} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.38, 0.025, 0.1]} />
          <meshStandardMaterial color={ORANGE} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.04, -0.18]}>
          <boxGeometry args={[0.12, 0.04, 0.08]} />
          <meshStandardMaterial color={ORANGE} roughness={0.5} />
        </mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[0.22, 0.11, 0.36]} />
        <meshStandardMaterial color={GOLD} roughness={0.5} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.1, -0.14]}>
        <boxGeometry args={[0.18, 0.09, 0.14]} />
        <meshStandardMaterial color={ORANGE} roughness={0.5} />
      </mesh>
      <Wheel position={[-0.08, 0.02, 0.12]} />
      <Wheel position={[0.08, 0.02, 0.12]} />
      <Wheel position={[-0.08, 0.02, -0.12]} />
      <Wheel position={[0.08, 0.02, -0.12]} />
      <Taillights />
    </group>
  );
}

function Vehicles({ vehicleKind, worldKind, scenePhase }) {
  const ref = useRef(null);
  const showHeadlights = worldKind === "road" && scenePhase === "night";

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const sway = Math.sin(t * 1.1) * 0.1;
    if (worldKind === "air") {
      g.position.set(sway, 0.15 + Math.sin(t * 0.7) * 0.1, 0.4);
      g.rotation.set(Math.sin(t * 0.4) * 0.04, 0, Math.sin(t * 0.9) * 0.06);
    } else if (worldKind === "water") {
      g.position.set(sway * 0.4, -1.16 + Math.sin(t * 1.4) * 0.05, 0.5);
      g.rotation.set(Math.sin(t * 1.1) * 0.03, 0, Math.sin(t * 0.8) * 0.04);
    } else {
      g.position.set(sway * 0.25, -1.22, 0.75);
      g.rotation.set(0, 0, Math.sin(t * 1.3) * 0.015);
    }
  });

  return (
    <group ref={ref}>
      <VehicleMesh vehicleKind={vehicleKind} />
      <Headlights visible={showHeadlights} />
    </group>
  );
}

function Clouds({ palette, parallax = false }) {
  const groupRef = useRef(null);
  const clouds = useMemo(
    () =>
      Array.from({ length: parallax ? 12 : 7 }, (_, i) => ({
        id: i,
        x: -8 + (i % 6) * 2.8,
        y: 1.6 + (i % 4) * 0.45,
        z: -3.5 - (i % 3) * 1.2,
        s: 0.45 + (i % 5) * 0.22,
        drift: 0.15 + (i % 4) * 0.08,
      })),
    [parallax]
  );

  useFrame(({ clock }) => {
    if (!parallax || !groupRef.current) return;
    const t = clock.elapsedTime;
    groupRef.current.children.forEach((mesh, i) => {
      const cfg = clouds[i];
      mesh.position.x = cfg.x + Math.sin(t * cfg.drift + i) * 0.6;
      mesh.position.z = cfg.z - (t * 0.35 + i * 0.4) % 14;
    });
  });

  return (
    <group ref={groupRef}>
      {clouds.map(cloud => (
        <mesh key={cloud.id} position={[cloud.x, cloud.y, cloud.z]}>
          <sphereGeometry args={[cloud.s, 12, 12]} />
          <meshBasicMaterial color={palette.cloud} transparent opacity={parallax ? 0.32 : 0.22} />
        </mesh>
      ))}
    </group>
  );
}

function Water({ palette }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.32, -1]}>
      <planeGeometry args={[14, 28]} />
      <meshStandardMaterial color={palette.water} roughness={0.2} metalness={0.15} transparent opacity={0.82} />
    </mesh>
  );
}

function Waves({ palette }) {
  const lines = useMemo(() => Array.from({ length: 14 }, (_, i) => i), []);
  const refs = useRef([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 1.8;
    lines.forEach((_, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      const z = -10 + ((t + i * 1.4) % 16);
      mesh.position.z = z;
    });
  });

  return (
    <group position={[0, -1.26, -1]}>
      {lines.map(i => (
        <mesh
          key={i}
          ref={el => {
            refs.current[i] = el;
          }}
          position={[0, 0, -10 + i * 1.2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[12, 0.05]} />
          <meshBasicMaterial color={palette.cloud} transparent opacity={0.12 - (i % 5) * 0.015} />
        </mesh>
      ))}
    </group>
  );
}

function Coastline({ palette }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.2, -1.27, -1]}>
      <planeGeometry args={[4, 22]} />
      <meshBasicMaterial color={new THREE.Color(palette.horizon).offsetHSL(0, 0, -0.12)} />
    </mesh>
  );
}

function DistantTerrain({ palette }) {
  const meshes = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        x: -6 + i * 1.7,
        h: 0.4 + (i % 3) * 0.25,
        w: 1.2 + (i % 2) * 0.4,
      })),
    []
  );
  const refs = useRef([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.5;
    meshes.forEach((cfg, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      mesh.position.z = -8 - ((t + i * 0.8) % 10);
    });
  });

  return (
    <group position={[0, -1.5, -6]}>
      {meshes.map((cfg, i) => (
        <mesh
          key={cfg.id}
          ref={el => {
            refs.current[i] = el;
          }}
          position={[cfg.x, cfg.h * 0.5, -8]}
        >
          <boxGeometry args={[cfg.w, cfg.h, 0.8]} />
          <meshStandardMaterial
            color={new THREE.Color(palette.horizon).offsetHSL(0, -0.05, -0.35)}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}

function CameraRig({ worldKind }) {
  useFrame(state => {
    const t = state.clock.elapsedTime;
    if (worldKind === "air") {
      state.camera.position.x = Math.sin(t * 0.15) * 0.12;
      state.camera.position.y = 0.55 + Math.sin(t * 0.35) * 0.05;
      state.camera.position.z = 5.2;
      state.camera.lookAt(0, 0.1, -2);
    } else if (worldKind === "water") {
      state.camera.position.x = Math.sin(t * 0.18) * 0.06;
      state.camera.position.y = 0.05 + Math.sin(t * 0.4) * 0.025;
      state.camera.position.z = 4.6;
      state.camera.lookAt(0, -0.6, -1.5);
    } else {
      state.camera.position.x = Math.sin(t * 0.2) * 0.08;
      state.camera.position.y = 0.2 + Math.sin(t * 0.55) * 0.03;
      state.camera.position.z = 4.8;
      state.camera.lookAt(0, -0.35, -1.8);
    }
  });
  return null;
}

function CinematicScene({ scenePhase, vehicleKind }) {
  const palette = phasePalette(scenePhase);
  const worldKind = resolveWorldKind(vehicleKind);
  const showStars = scenePhase === "night";

  return (
    <>
      <SceneFog color={palette.fog} />
      <Lights palette={palette} scenePhase={scenePhase} worldKind={worldKind} />
      <Atmosphere palette={palette} />
      {showStars && <Stars visible />}
      <Celestial phase={scenePhase} palette={palette} />
      <HorizonGlow palette={palette} scenePhase={scenePhase} />

      {worldKind === "road" && (
        <>
          <RoadSurface palette={palette} />
          <LaneDashes palette={palette} />
          <ScrollingBuildings palette={palette} />
        </>
      )}

      {worldKind === "air" && (
        <>
          <Clouds palette={palette} parallax />
          <DistantTerrain palette={palette} />
        </>
      )}

      {worldKind === "water" && (
        <>
          <Water palette={palette} />
          <Waves palette={palette} />
          <Coastline palette={palette} />
          <Clouds palette={palette} />
        </>
      )}

      {worldKind === "road" && <Clouds palette={palette} />}

      <Vehicles vehicleKind={vehicleKind} worldKind={worldKind} scenePhase={scenePhase} />
      <CameraRig worldKind={worldKind} />
    </>
  );
}

function Overlay({ progress, cityBeats, subtitle, statusMessage, destination }) {
  const p = clamp01(progress);
  const beat = computeCityBeatLabel(p, cityBeats, destination);
  const status = statusMessage || "Preparing your route";

  return (
    <div style={overlayWrapStyle}>
      <div style={overlayTopStyle}>{subtitle}</div>
      {beat && (
        <div style={beat.arriving ? overlayArrivalStyle : overlayBeatStyle}>{beat.text}</div>
      )}
      <div style={overlayBottomStyle}>
        <div style={progressTrackStyle}>
          <div style={{ ...progressFillStyle, width: `${Math.round(p * 100)}%` }} />
        </div>
        <div style={statusStyle}>{status}</div>
      </div>
    </div>
  );
}

function CssFallback({ progress, cityBeats, subtitle, statusMessage, destination, scenePhase, worldKind }) {
  const p = clamp01(progress);
  const gradient = fallbackGradient(scenePhase);

  return (
    <div style={{ ...rootStyle, background: gradient }}>
      <style>
        {`
          @keyframes tripmappa-loader-pan {
            0% { transform: translateX(-15%); }
            50% { transform: translateX(15%); }
            100% { transform: translateX(-15%); }
          }
          @keyframes tripmappa-loader-shimmer {
            0% { transform: translateX(-50%) translateY(0); }
            100% { transform: translateX(-50%) translateY(120%); }
          }
          @keyframes tripmappa-loader-wave {
            0% { transform: translateX(-50%) scaleX(1); }
            50% { transform: translateX(-50%) scaleX(1.08); }
            100% { transform: translateX(-50%) scaleX(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            .tripmappa-loader-pan,
            .tripmappa-loader-shimmer,
            .tripmappa-loader-wave {
              animation: none !important;
            }
          }
        `}
      </style>
      <div style={fallbackBackdropStyle}>
        {worldKind === "water" ? (
          <div className="tripmappa-loader-wave" style={fallbackWaterStyle} />
        ) : worldKind === "air" ? (
          <div style={fallbackCloudStyle} />
        ) : (
          <div className="tripmappa-loader-pan" style={fallbackRoadStyle} />
        )}
        {worldKind !== "air" && (
          <div className="tripmappa-loader-shimmer" style={fallbackShimmerStyle(worldKind)} />
        )}
      </div>
      <Overlay
        progress={p}
        cityBeats={cityBeats}
        subtitle={subtitle}
        statusMessage={statusMessage}
        destination={destination}
      />
    </div>
  );
}

const rootStyle = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  overflow: "hidden",
  background: "linear-gradient(180deg, #263562 0%, #3b4a82 38%, #c27d5a 100%)",
};

const canvasStyle = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

const overlayWrapStyle = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  pointerEvents: "none",
  padding: "20px 20px 18px",
};

const overlayTopStyle = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 0.2,
  color: "rgba(245, 247, 255, 0.92)",
  textShadow: "0 1px 8px rgba(0, 0, 0, 0.45)",
  alignSelf: "flex-start",
};

const overlayBeatStyle = {
  alignSelf: "center",
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: 0.3,
  color: "#fff8ee",
  textShadow: "0 2px 16px rgba(0, 0, 0, 0.5)",
  textAlign: "center",
};

const overlayArrivalStyle = {
  ...overlayBeatStyle,
  fontSize: 24,
  color: GOLD,
};

const overlayBottomStyle = {
  alignSelf: "stretch",
  maxWidth: 480,
  margin: "0 auto",
  width: "100%",
};

const progressTrackStyle = {
  width: "100%",
  height: 4,
  borderRadius: 999,
  overflow: "hidden",
  background: "rgba(255, 255, 255, 0.2)",
};

const progressFillStyle = {
  height: "100%",
  borderRadius: 999,
  transition: "width 320ms ease-out",
  background: `linear-gradient(90deg, ${GOLD} 0%, ${ORANGE} 100%)`,
};

const statusStyle = {
  marginTop: 8,
  fontSize: 11,
  letterSpacing: 0.2,
  color: "rgba(245, 247, 255, 0.78)",
  textAlign: "center",
};

const fallbackBackdropStyle = {
  position: "absolute",
  inset: 0,
};

const fallbackRoadStyle = {
  position: "absolute",
  left: "50%",
  bottom: "-8%",
  width: "34%",
  height: "64%",
  transform: "translateX(-50%)",
  clipPath: "polygon(36% 0, 64% 0, 100% 100%, 0 100%)",
  background: "linear-gradient(180deg, #3f4454 0%, #2e3342 100%)",
  animation: "tripmappa-loader-pan 10s ease-in-out infinite",
};

const fallbackWaterStyle = {
  position: "absolute",
  left: "50%",
  bottom: 0,
  width: "100%",
  height: "55%",
  transform: "translateX(-50%)",
  background: "linear-gradient(180deg, rgba(46,92,133,0.3) 0%, rgba(15,31,61,0.85) 100%)",
  animation: "tripmappa-loader-wave 4s ease-in-out infinite",
};

const fallbackCloudStyle = {
  position: "absolute",
  inset: "18% 8% 35%",
  background:
    "radial-gradient(ellipse 45% 30% at 25% 40%, rgba(255,255,255,0.22) 0%, transparent 70%)," +
    "radial-gradient(ellipse 40% 25% at 70% 55%, rgba(255,255,255,0.18) 0%, transparent 70%)",
};

function fallbackShimmerStyle(worldKind) {
  if (worldKind === "water") {
    return {
      position: "absolute",
      left: "50%",
      bottom: "18%",
      width: "60%",
      height: "3px",
      background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
      transform: "translateX(-50%)",
      animation: "tripmappa-loader-shimmer 2.4s linear infinite",
    };
  }
  return {
    position: "absolute",
    left: "50%",
    bottom: "2%",
    width: "3px",
    height: "52%",
    background: `linear-gradient(180deg, rgba(255,210,140,0) 0%, ${GOLD} 28%, rgba(255,210,140,0) 56%)`,
    transform: "translateX(-50%)",
    animation: "tripmappa-loader-shimmer 1.8s linear infinite",
  };
}

function useCanvasDpr() {
  const [maxDpr, setMaxDpr] = useState(() => {
    if (typeof window === "undefined") return 1.5;
    return window.matchMedia("(max-width: 768px), (pointer: coarse)").matches ? 1 : 1.5;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia("(max-width: 768px), (pointer: coarse)");
    const apply = () => setMaxDpr(media.matches ? 1 : 1.5);
    apply();
    if (media.addEventListener) {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
    media.addListener(apply);
    return () => media.removeListener(apply);
  }, []);

  return [1, maxDpr];
}

function usePauseWhenHidden() {
  const [frameloop, setFrameloop] = useState("always");

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const sync = () => setFrameloop(document.hidden ? "never" : "always");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return frameloop;
}

export default function GenerationCinematicLoader({
  progress = 0,
  subtitle = "Scouting routes, stops, and smarter city handoffs.",
  statusMessage = "",
  cityBeats = [],
  destination = "",
  vehicleType = "Car",
  skyPhase = "sunset",
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [webglReady, setWebglReady] = useState(false);
  const dpr = useCanvasDpr();
  const frameloop = usePauseWhenHidden();

  useEffect(() => {
    setWebglReady(canUseWebGL());
  }, []);

  const scenePhase = resolveSkyScenePhase(skyPhase);
  const vehicleKind = resolveVehicleKind(vehicleType);
  const worldKind = resolveWorldKind(vehicleKind);
  const p = clamp01(progress);

  if (!webglReady || reducedMotion) {
    return (
      <CssFallback
        progress={p}
        cityBeats={cityBeats}
        subtitle={subtitle}
        statusMessage={statusMessage}
        destination={destination}
        scenePhase={scenePhase}
        worldKind={worldKind}
      />
    );
  }

  return (
    <div style={rootStyle}>
      <Canvas
        dpr={dpr}
        frameloop={frameloop}
        camera={{ position: [0, 0.2, 4.8], fov: 45, near: 0.1, far: 60 }}
        gl={{ antialias: dpr[1] > 1, alpha: true, powerPreference: "high-performance" }}
        style={canvasStyle}
      >
        <CinematicScene scenePhase={scenePhase} vehicleKind={vehicleKind} />
      </Canvas>
      <Overlay
        progress={p}
        cityBeats={cityBeats}
        subtitle={subtitle}
        statusMessage={statusMessage}
        destination={destination}
      />
    </div>
  );
}
