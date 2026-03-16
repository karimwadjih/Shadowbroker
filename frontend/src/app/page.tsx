"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from 'next/dynamic';
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import WorldviewLeftPanel from "@/components/WorldviewLeftPanel";

import NewsFeed from "@/components/NewsFeed";
import MarketsPanel from "@/components/MarketsPanel";
import FilterPanel from "@/components/FilterPanel";
import FindLocateBar from "@/components/FindLocateBar";
import TopRightControls from "@/components/TopRightControls";
import RadioInterceptPanel from "@/components/RadioInterceptPanel";
import SettingsPanel from "@/components/SettingsPanel";
import MapLegend from "@/components/MapLegend";
import ScaleBar from "@/components/ScaleBar";
import ErrorBoundary from "@/components/ErrorBoundary";
import { DashboardDataProvider } from "@/lib/DashboardDataContext";
import OnboardingModal, { useOnboarding } from "@/components/OnboardingModal";
import ChangelogModal, { useChangelog } from "@/components/ChangelogModal";
import type { SelectedEntity } from "@/types/dashboard";
import { NOMINATIM_DEBOUNCE_MS } from "@/lib/constants";
import { useDataPolling } from "@/hooks/useDataPolling";
import { useReverseGeocode } from "@/hooks/useReverseGeocode";
import { useRegionDossier } from "@/hooks/useRegionDossier";

const MaplibreViewer = dynamic(() => import('@/components/MaplibreViewer'), { ssr: false });

function LocateBar({ onLocate }: { onLocate: (lat: number, lng: number) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const parseCoords = (s: string): { lat: number; lng: number } | null => {
    const m = s.trim().match(/^([+-]?\d+\.?\d*)[,\s]+([+-]?\d+\.?\d*)$/);
    if (!m) return null;
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    return null;
  };

  const handleSearch = async (q: string) => {
    setValue(q);
    const coords = parseCoords(q);
    if (coords) {
      setResults([{ label: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`, ...coords }]);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`, {
          headers: { 'Accept-Language': 'en' },
        });
        const data = await res.json();
        setResults(data.map((r: { display_name: string; lat: string; lon: string }) => ({ label: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) })));
      } catch { setResults([]); }
      setLoading(false);
    }, NOMINATIM_DEBOUNCE_MS);
  };

  const handleSelect = (r: { lat: number; lng: number }) => {
    onLocate(r.lat, r.lng);
    setOpen(false);
    setValue('');
    setResults([]);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-[var(--bg-primary)]/60 backdrop-blur-md border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-[9px] font-mono tracking-[0.15em] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--text-muted)] transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        LOCATE
      </button>
    );
  }

  return (
    <div className="relative w-[420px]">
      <div className="flex items-center gap-2 bg-[var(--bg-primary)]/80 backdrop-blur-md border border-[var(--text-muted)]/60 rounded-lg px-3 py-2 shadow-[0_0_20px_rgba(212,98,42,0.1)]">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)] flex-shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setValue(''); setResults([]); } if (e.key === 'Enter' && results.length > 0) handleSelect(results[0]); }}
          placeholder="Enter coordinates (31.8, 34.8) or place name..."
          className="flex-1 bg-transparent text-[10px] text-[var(--text-primary)] font-mono tracking-wider outline-none placeholder:text-[var(--text-muted)]"
        />
        {loading && <div className="w-3 h-3 border border-[var(--text-secondary)] border-t-transparent rounded-full animate-spin" />}
        <button onClick={() => { setOpen(false); setValue(''); setResults([]); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      {results.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--bg-secondary)]/95 backdrop-blur-md border border-[var(--border-primary)] rounded-lg overflow-hidden shadow-[0_-8px_30px_rgba(0,0,0,0.4)] max-h-[200px] overflow-y-auto styled-scrollbar">
          {results.map((r, i) => (
            <button key={i} onClick={() => handleSelect(r)} className="w-full text-left px-3 py-2 hover:bg-[var(--hover-accent)] transition-colors border-b border-[var(--border-primary)]/50 last:border-0 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)] flex-shrink-0"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <span className="text-[9px] text-[var(--text-secondary)] font-mono truncate">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data, dataVersion, backendStatus } = useDataPolling();
  const { mouseCoords, locationLabel, handleMouseCoords } = useReverseGeocode();
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const [trackedSdr, setTrackedSdr] = useState<any>(null);
  const { regionDossier, regionDossierLoading, handleMapRightClick } = useRegionDossier(selectedEntity, setSelectedEntity);

  const [uiVisible, setUiVisible] = useState(true);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [mapView, setMapView] = useState({ zoom: 2, latitude: 20 });
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<{ lat: number; lng: number }[]>([]);

  const [activeLayers, setActiveLayers] = useState({
    flights: true,
    private: true,
    jets: true,
    military: true,
