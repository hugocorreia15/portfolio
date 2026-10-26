"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useProgress } from "@react-three/drei";
import { MAPS, type MapId } from "@/lib/maps";
import Overlay from "@/components/ui/Overlay";
import SharkOverlay from "@/components/ui/SharkOverlay";
import Joystick from "@/components/ui/Joystick";

const Scene = dynamic(() => import("@/components/three/Scene"), {
  ssr: false,
  loading: () => <Splash />,
});

function subscribeToPointerType(callback: () => void) {
  const mq = window.matchMedia("(pointer: coarse)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function Splash({ progress = 0, hidden = false }: { progress?: number; hidden?: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center bg-foam transition-opacity duration-700 ${
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink/50">
          Ria de Aveiro
        </p>
        <p className="mt-2 font-display text-4xl text-ink">Hugo Correia</p>
        <p className="mt-4 font-mono text-xs text-ink/55">
          a preparar o moliceiro<span className="sailing-dots" aria-hidden />
        </p>
        <div className="mx-auto mt-5 h-[3px] w-44 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-azulejo transition-[width] duration-300"
            style={{ width: `${Math.max(6, progress)}%` }}
          />
        </div>
        <a
          href="/cv"
          className="mt-6 inline-block font-mono text-[11px] text-ink/45 underline-offset-2 hover:text-azulejo hover:underline"
        >
          skip the boat — read the CV →
        </a>
      </div>
    </div>
  );
}

/** Keeps the splash up until the textures and models have streamed in. */
function LoadingVeil() {
  const { progress, active } = useProgress();
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (active || progress < 100) return;
    const t = setTimeout(() => setDone(true), 300);
    return () => clearTimeout(t);
  }, [active, progress]);
  useEffect(() => {
    // never hold the visitor hostage to a slow asset
    const t = setTimeout(() => setDone(true), 9000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setGone(true), 800);
    return () => clearTimeout(t);
  }, [done]);
  if (gone) return null;
  return <Splash progress={progress} hidden={done} />;
}

export default function PortfolioApp() {
  const [mapId, setMapId] = useState<MapId>("island");
  // targetIndex === null means the user has the helm (free sailing)
  const [targetIndex, setTargetIndex] = useState<number | null>(0);
  const [dockedIndex, setDockedIndex] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [nearPort, setNearPort] = useState<number | null>(null);
  const [visited, setVisited] = useState(false);
  // a shared #section link starts the boat already moored at that pier
  const [startIndex, setStartIndex] = useState<number | null>(null);

  // analog input shared with the boat's frame loop — never goes through React state
  const joystick = useRef({ x: 0, y: 0 });

  // show the joystick on touch devices (?joystick=1 forces it, handy for testing)
  const coarsePointer = useSyncExternalStore(
    subscribeToPointerType,
    () =>
      window.matchMedia("(pointer: coarse)").matches ||
      new URLSearchParams(window.location.search).has("joystick"),
    () => false
  );

  const handleJoystick = useCallback((x: number, y: number) => {
    joystick.current.x = x;
    joystick.current.y = y;
  }, []);

  const stateRef = useRef({ targetIndex, dockedIndex });
  useEffect(() => {
    stateRef.current = { targetIndex, dockedIndex };
  }, [targetIndex, dockedIndex]);

  const navigate = useCallback((index: number) => {
    setVisited(true);
    if (stateRef.current.dockedIndex === index) {
      setTargetIndex(index);
      setPanelOpen(true);
      return;
    }
    setTargetIndex(index);
    setDockedIndex(null);
    setPanelOpen(false);
  }, []);

  // shareable chapters: #publications sails there on load, docking writes the hash
  const mapRef = useRef(mapId);
  useEffect(() => {
    mapRef.current = mapId;
  }, [mapId]);
  const setHash = useCallback((index: number | null) => {
    const id = index === null ? "" : MAPS[mapRef.current].ports[index]?.id;
    const url = `${window.location.pathname}${window.location.search}${id ? `#${id}` : ""}`;
    window.history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("map");
    const id: MapId =
      wanted && wanted in MAPS && !MAPS[wanted as MapId].comingSoon
        ? (wanted as MapId)
        : "island";
    const portIndex = MAPS[id].ports.findIndex((p) => `#${p.id}` === window.location.hash);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off sync from the URL on mount
    if (id !== "island") setMapId(id);
    if (portIndex >= 0) {
      setVisited(true);
      setTargetIndex(portIndex);
      setStartIndex(portIndex);
    }
  }, []);

  const handleArrive = useCallback(
    (index: number) => {
      setDockedIndex(index);
      setPanelOpen(true);
      setHash(index);
    },
    [setHash]
  );

  const handleManualStart = useCallback(() => {
    setVisited(true);
    setTargetIndex(null);
    setDockedIndex(null);
    setPanelOpen(false);
    setHash(null);
  }, [setHash]);

  const handleNearPort = useCallback((index: number | null) => {
    setNearPort(index);
  }, []);

  const handleRequestDock = useCallback(
    (index: number) => {
      setTargetIndex(index);
      setDockedIndex(index);
      setPanelOpen(true);
      setHash(index);
    },
    [setHash]
  );

  // switching maps remounts the scene and sails into the new map's first port
  const handleSwitchMap = useCallback((id: MapId) => {
    if (MAPS[id].comingSoon) return; // gated until the map is ready
    setMapId(id);
    const url = new URL(window.location.href);
    if (id === "island") url.searchParams.delete("map");
    else url.searchParams.set("map", id);
    url.hash = "";
    window.history.replaceState(null, "", url);
    setTargetIndex(0);
    setDockedIndex(null);
    setPanelOpen(false);
    setNearPort(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelOpen(false);
      else {
        const num = Number(e.key);
        if (num >= 1 && num <= MAPS[mapId].ports.length) navigate(num - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, mapId]);

  const map = MAPS[mapId];

  return (
    <div className="fixed inset-0 overflow-hidden bg-foam">
      <Scene
        key={mapId}
        map={map}
        targetIndex={targetIndex}
        dockedIndex={dockedIndex}
        startIndex={startIndex}
        joystick={joystick}
        onArrive={handleArrive}
        onNavigate={navigate}
        onManualStart={handleManualStart}
        onNearPort={handleNearPort}
        onRequestDock={handleRequestDock}
      />
      <Overlay
        map={map}
        mapId={mapId}
        targetIndex={targetIndex}
        dockedIndex={dockedIndex}
        nearPort={nearPort}
        panelOpen={panelOpen}
        showHint={!visited}
        onNavigate={navigate}
        onRequestDock={handleRequestDock}
        onSwitchMap={handleSwitchMap}
        onClose={() => setPanelOpen(false)}
      />
      <SharkOverlay />
      <LoadingVeil />
      {coarsePointer && !panelOpen && (
        <Joystick onChange={handleJoystick} onEngage={handleManualStart} />
      )}
    </div>
  );
}
