"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { MAPS, type MapId } from "@/lib/maps";
import Overlay from "@/components/ui/Overlay";
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

function Splash() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-foam">
      <div className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink/50">
          Ria de Aveiro
        </p>
        <p className="mt-2 font-display text-4xl text-ink">Hugo Correia</p>
        <p className="mt-4 font-mono text-xs text-ink/55">
          a preparar o moliceiro<span className="sailing-dots" aria-hidden />
        </p>
      </div>
    </div>
  );
}

export default function PortfolioApp() {
  const [mapId, setMapId] = useState<MapId>("island");
  // targetIndex === null means the user has the helm (free sailing)
  const [targetIndex, setTargetIndex] = useState<number | null>(0);
  const [dockedIndex, setDockedIndex] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [nearPort, setNearPort] = useState<number | null>(null);
  const [visited, setVisited] = useState(false);

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

  const handleArrive = useCallback((index: number) => {
    setDockedIndex(index);
    setPanelOpen(true);
  }, []);

  const handleManualStart = useCallback(() => {
    setVisited(true);
    setTargetIndex(null);
    setDockedIndex(null);
    setPanelOpen(false);
  }, []);

  const handleNearPort = useCallback((index: number | null) => {
    setNearPort(index);
  }, []);

  const handleRequestDock = useCallback((index: number) => {
    setTargetIndex(index);
    setDockedIndex(index);
    setPanelOpen(true);
  }, []);

  // switching maps remounts the scene and sails into the new map's first port
  const handleSwitchMap = useCallback((id: MapId) => {
    if (MAPS[id].comingSoon) return; // gated until the map is ready
    setMapId(id);
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
        if (num >= 1 && num <= 6) navigate(num - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const map = MAPS[mapId];

  return (
    <div className="fixed inset-0 overflow-hidden bg-foam">
      <Scene
        key={mapId}
        map={map}
        targetIndex={targetIndex}
        dockedIndex={dockedIndex}
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
      {coarsePointer && !panelOpen && (
        <Joystick onChange={handleJoystick} onEngage={handleManualStart} />
      )}
    </div>
  );
}
