import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  ShieldAlert,
  Trash2,
  MapPin,
  Sparkles,
  RefreshCw,
  Play,
  Bell,
  Camera,
  Info,
  X,
  Map as MapIcon,
  Search,
  Eye,
  Check,
  Building,
  ArrowRight,
  TrendingUp,
  FileText
} from "lucide-react";

// Types corresponding to backend response schemas
interface Hotspot {
  id: string;
  zone: string;
  lat: number;
  lon: number;
  composite_risk_score: number;
  risk_tier: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  aqi: number;
  primary_pollutant: string;
  pollution_reason: string; // The dynamically generated non-hardcoded reason!
  pollution_types: string[];
  evidence_sources: string[];
  photo_evidence: boolean;
  predicted_peak_aqi: number;
  recommended_action: string;
  municipal_resource: string;
  complaint_count: number;
  aerosol_index: number;
}

interface MunicipalAlert {
  zone: string;
  priority: number; // 1 = Urgent, 2 = Priority 2
  resource_type: string;
  action: string;
  estimated_response_minutes: number;
}

interface HourlyForecast {
  hour: number;
  aqi: number;
  risk: string;
  key_factor: string;
}

const RESOURCE_LABELS: Record<string, string> = {
  water_mist_cannon: "🚒 Water-mist cannon",
  cleanup_crew: "🧹 Cleanup crew",
  factory_notice: "🏢 Factory notice",
  traffic_diversion: "🔀 Traffic diversion",
  monitoring_van: "🚐 Monitoring van",
};

const RISK_COLORS: Record<string, string> = {
  CRITICAL: "#DC2626", // red-600
  HIGH: "#F43F5E",     // rose-500
  MEDIUM: "#D97706",   // amber-600
  LOW: "#16A34A",      // green-600
};

const RISK_EMOJIS: Record<string, string> = {
  CRITICAL: "🔴",
  HIGH: "🟠",
  MEDIUM: "🟡",
  LOW: "🟢",
};

const PIPELINE_AGENTS = [
  { id: "supervisor", label: "Supervisor Agent", icon: "👑" },
  { id: "vision", label: "Vision Agent", icon: "📷" },
  { id: "sensor", label: "Sensor Agent", icon: "📊" },
  { id: "satellite", label: "Satellite Agent", icon: "🛰️" },
  { id: "forecast", label: "Forecast Agent", icon: "⏱️" },
  { id: "aggregator", label: "Aggregator Agent", icon: "🧪" },
  { id: "critique", label: "Critique Agent", icon: "🔎" },
];

export default function App() {
  // Form inputs
  const [constituency, setConstituency] = useState("Sahibabad");
  const [district, setDistrict] = useState("Ghaziabad");
  const [state, setState] = useState("Uttar Pradesh");
  const [openaqKey, setOpenaqKey] = useState(() => {
    const val = localStorage.getItem("openaq_key") || "";
    if (val.trim() === ".") {
      localStorage.setItem("openaq_key", "");
      return "";
    }
    return val;
  });
  const [openrouterKey, setOpenrouterKey] = useState(() => {
    const val = localStorage.getItem("openrouter_key") || "";
    if (val.trim() === ".") {
      localStorage.setItem("openrouter_key", "");
      return "";
    }
    return val;
  });

  // Files state
  const [uploadedPhotos, setUploadedPhotos] = useState<{ path: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Scan states
  const [scanLoading, setScanLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Pipeline simulation state
  const [pipelineState, setPipelineState] = useState<Record<string, "idle" | "run" | "done">>({});

  // Scanned results from API
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [municipalAlerts, setMunicipalAlerts] = useState<MunicipalAlert[]>([]);
  const [forecastChart, setForecastChart] = useState<HourlyForecast[]>([]);
  const [auditSummary, setAuditSummary] = useState("");
  const [photoCount, setPhotoCount] = useState(0);
  const [sensorCount, setSensorCount] = useState(0);

  // Key testing state
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Leaflet map refs
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Initialize map when results are available or selection changes
  useEffect(() => {
    if (!showResults || hotspots.length === 0) return;

    // Wait until DOM is ready for the map container
    setTimeout(() => {
      const L = (window as any).L;
      if (!L) return;

      const container = document.getElementById("leaflet-map");
      if (!container) return;

      // Find center based on the hotspots
      const centerLat = hotspots.reduce((sum, h) => sum + h.lat, 0) / hotspots.length;
      const centerLon = hotspots.reduce((sum, h) => sum + h.lon, 0) / hotspots.length;

      // Initialize map instance if it doesn't exist
      if (!mapRef.current) {
        mapRef.current = L.map("leaflet-map", {
          zoomControl: true,
          scrollWheelZoom: true,
        }).setView([centerLat, centerLon], 12);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(mapRef.current);
      } else {
        // Pan to center if map exists
        mapRef.current.setView([centerLat, centerLon], mapRef.current.getZoom());
      }

      // Clear existing markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      // Add new markers with risk color divIcons
      hotspots.forEach(h => {
        const isSelected = h.id === selectedHotspotId;
        const color = RISK_COLORS[h.risk_tier] || "#185FA5";
        const emoji = RISK_EMOJIS[h.risk_tier] || "📍";

        const markerIcon = L.divIcon({
          className: "custom-leaflet-marker",
          html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center;">
              <div style="
                width: ${isSelected ? '28px' : '20px'};
                height: ${isSelected ? '28px' : '20px'};
                background-color: ${color};
                border: 2px solid #ffffff;
                border-radius: 50%;
                box-shadow: 0 0 8px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${isSelected ? '14px' : '10px'};
                transition: all 0.25s ease-out;
                animation: ${h.risk_tier === 'CRITICAL' ? 'marker-pulse 2s infinite' : 'none'};
              ">
                ${emoji}
              </div>
            </div>
          `,
          iconSize: [isSelected ? 28 : 20, isSelected ? 28 : 20],
          iconAnchor: [isSelected ? 14 : 10, isSelected ? 14 : 10],
        });

        const marker = L.marker([h.lat, h.lon], { icon: markerIcon })
          .addTo(mapRef.current)
          .bindTooltip(`
            <div class="p-1 font-sans">
              <p class="font-semibold text-gray-900">${h.zone}</p>
              <p class="text-xs text-gray-600">AQI: <b>${h.aqi}</b> (${h.risk_tier})</p>
            </div>
          `, { permanent: false, direction: "top", offset: [0, -10] });

        marker.on("click", () => {
          setSelectedHotspotId(h.id);
        });

        markersRef.current.push(marker);
      });

      // Fit bounds to fit all markers nicely
      if (hotspots.length > 0) {
        const latLngs = hotspots.map(h => [h.lat, h.lon]);
        const bounds = L.latLngBounds(latLngs);
        mapRef.current.fitBounds(bounds, { padding: [40, 40] });
      }

    }, 150);
  }, [showResults, hotspots, selectedHotspotId]);

  // Handle Photo files upload via API
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    await uploadFileList(files);
  };

  const uploadFileList = async (files: FileList) => {
    setUploading(true);
    const newPaths = [...uploadedPhotos];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;

      const formData = new FormData();
      formData.append("photo", file);

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        if (data.ok) {
          newPaths.push({ path: data.path, name: file.name });
        }
      } catch (err) {
        console.error("Failed to upload photo:", file.name, err);
      }
    }

    setUploadedPhotos(newPaths);
    setUploading(false);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files) {
      await uploadFileList(files);
    }
  };

  // Remove uploaded photo report
  const removePhoto = (index: number) => {
    setUploadedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Test OpenAQ API key
  const handleTestOpenaqKey = async () => {
    if (!openaqKey.trim()) {
      setTestResult({ ok: false, message: "⚠️ Please enter your OpenAQ API key first." });
      return;
    }
    setTestingKey(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/test-openaq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openaq_key: openaqKey }),
      });
      const data = await response.json();
      if (response.ok && data.ok) {
        setTestResult({ ok: true, message: data.message });
      } else {
        setTestResult({ ok: false, message: `❌ OpenAQ Error: ${data.error || "Verification failed."}` });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: `❌ OpenAQ Connection error: ${err.message}` });
    } finally {
      setTestingKey(false);
    }
  };

  // Test OpenRouter API key
  const handleTestOpenrouterKey = async () => {
    if (!openrouterKey.trim()) {
      setTestResult({ ok: false, message: "⚠️ Please enter your OpenRouter API key first." });
      return;
    }
    setTestingKey(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/test-openrouter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openrouter_key: openrouterKey }),
      });
      const data = await response.json();
      if (response.ok && data.ok) {
        setTestResult({ ok: true, message: data.message });
      } else {
        setTestResult({ ok: false, message: `❌ OpenRouter Error: ${data.error || "Verification failed."}` });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: `❌ OpenRouter Connection error: ${err.message}` });
    } finally {
      setTestingKey(false);
    }
  };

  // Run multi-agent pipeline simulation
  const runAgentPipelineSimulation = () => {
    const defaultState: Record<string, "idle" | "run" | "done"> = {};
    PIPELINE_AGENTS.forEach(a => {
      defaultState[a.id] = "idle";
    });
    setPipelineState(defaultState);

    // Staggered pipeline animation matching backend progress!
    const timing = [
      { id: "supervisor", start: 0, end: 1000 },
      { id: "vision", start: 800, end: 1800 },
      { id: "sensor", start: 1500, end: 2800 },
      { id: "satellite", start: 2200, end: 3600 },
      { id: "forecast", start: 3000, end: 4400 },
      { id: "aggregator", start: 4000, end: 5400 },
      { id: "critique", start: 5000, end: 6200 },
    ];

    timing.forEach(t => {
      setTimeout(() => {
        setPipelineState(prev => ({ ...prev, [t.id]: "run" }));
      }, t.start);

      setTimeout(() => {
        setPipelineState(prev => ({ ...prev, [t.id]: "done" }));
      }, t.end);
    });
  };

  // Trigger air pollution scan
  const handleRunScan = async () => {
    setScanLoading(true);
    setErrors([]);
    setShowResults(false);

    // Start pipeline progress step simulation
    runAgentPipelineSimulation();

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          constituency,
          district,
          state,
          openaq_key: openaqKey,
          openrouter_key: openrouterKey,
          photo_paths: uploadedPhotos.map(p => p.path),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Scan failed.");
      }

      setHotspots(data.hotspots || []);
      setMunicipalAlerts(data.municipal_alerts || []);
      setForecastChart(data.forecast_chart || []);
      setAuditSummary(data.audit_summary || "");
      setPhotoCount(data.photo_count || 0);
      setSensorCount(data.sensor_count || 0);
      setErrors(data.errors || []);

      if (data.hotspots && data.hotspots.length > 0) {
        setSelectedHotspotId(data.hotspots[0].id);
      }

      // Finish scan successfully
      setTimeout(() => {
        setShowResults(true);
        setScanLoading(false);
      }, 6500); // sync with pipeline animation

    } catch (err: any) {
      setErrors(prev => [...prev, err.message]);
      setScanLoading(false);
    }
  };

  // Get current selected hotspot details
  const selectedHotspot = hotspots.find(h => h.id === selectedHotspotId);

  // Worst hotspot calculation
  const worstHotspot = hotspots.reduce<Hotspot | null>(
    (worst, curr) => (!worst || curr.composite_risk_score > worst.composite_risk_score ? curr : worst),
    null
  );

  // SVG Chart rendering helper
  const renderSvgForecast = () => {
    if (forecastChart.length === 0) return null;
    const width = 500;
    const height = 120;
    const padding = 15;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    const maxAqi = Math.max(...forecastChart.map(f => f.aqi), 300);
    const minAqi = Math.min(...forecastChart.map(f => f.aqi), 50);

    const points = forecastChart.map((f, i) => {
      const x = padding + (i / 23) * graphWidth;
      const y = height - padding - ((f.aqi - minAqi) / (maxAqi - minAqi || 1)) * graphHeight;
      return `${x},${y}`;
    });

    const pathData = `M ${points[0]} L ${points.join(" L ")}`;

    const peakIndex = forecastChart.indexOf(
      forecastChart.reduce((p, c) => (c.aqi > p.aqi ? c : p), forecastChart[0])
    );
    const peakX = padding + (peakIndex / 23) * graphWidth;
    const peakY = height - padding - ((forecastChart[peakIndex].aqi - minAqi) / (maxAqi - minAqi || 1)) * graphHeight;

    const fillPathData = `M ${padding},${height - padding} L ${points.join(" L ")} L ${width - padding},${height - padding} Z`;

    return (
      <svg className="w-full h-28 overflow-visible mt-2" viewBox={`0 0 ${width} ${height}`}>
        {/* Shaded Area */}
        <path d={fillPathData} fill="url(#chart-gradient)" opacity="0.1" />

        {/* Line */}
        <path d={pathData} fill="none" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Peak Node Point */}
        <circle cx={peakX} cy={peakY} r="5" fill="#DC2626" stroke="#FFFFFF" strokeWidth="2" />
        <text
          x={peakX}
          y={peakY - 8}
          textAnchor="middle"
          fontSize="10"
          fontWeight="600"
          fill="#DC2626"
          className="font-sans"
        >
          📈 Peak {forecastChart[peakIndex].aqi} (H{forecastChart[peakIndex].hour})
        </text>

        {/* Labels */}
        {[0, 6, 12, 18, 23].map(hIdx => {
          const x = padding + (hIdx / 23) * graphWidth;
          return (
            <g key={hIdx}>
              <line x1={x} y1={height - padding} x2={x} y2={height - padding + 4} stroke="#94A3B8" strokeWidth="1" />
              <text x={x} y={height} textAnchor="middle" fontSize="9" fill="#94A3B8" className="font-sans">
                {hIdx}h
              </text>
            </g>
          );
        })}

        <defs>
          <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#F8FAFC" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 pb-12">
      {/* ── Brand Header ── */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 md:px-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm select-none">
              AQ
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-1.5 font-display">
                PollutionWatch <span className="text-slate-400 font-normal">| Live Dashboard</span>
              </h1>
              <p className="text-xs text-slate-500">Neighbourhood-level air quality agent analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-slate-100 px-4 py-2 rounded-full border border-slate-200">
            <span className="text-xs font-semibold text-slate-600">📍 {constituency}, {district}</span>
            <span className="h-4 w-[1px] bg-slate-300"></span>
            <span className="text-xs text-slate-500 font-medium">Live Feed</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8 flex flex-col gap-6">
        {/* ── Inputs Card ── */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 bg-slate-50/50 p-4 md:p-5">
            <span className="text-lg">🗺️</span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Constituency Details & Scopes
            </h2>
          </div>

          <div className="p-5 md:p-6 flex flex-col gap-6">
            {/* Location details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-500">Constituency name</span>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={constituency}
                    onChange={e => setConstituency(e.target.value)}
                    placeholder="e.g. Sahibabad"
                    className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-sm focus:border-indigo-600 focus:ring-3 focus:ring-indigo-100 outline-none transition-all text-slate-900"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-500">District</span>
                <input
                  type="text"
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                  placeholder="e.g. Ghaziabad"
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-sm focus:border-indigo-600 focus:ring-3 focus:ring-indigo-100 outline-none transition-all text-slate-900"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-500">State</span>
                <input
                  type="text"
                  value={state}
                  onChange={e => setState(e.target.value)}
                  placeholder="e.g. Uttar Pradesh"
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-sm focus:border-indigo-600 focus:ring-3 focus:ring-indigo-100 outline-none transition-all text-slate-900"
                />
              </label>
            </div>

            {/* API keys config */}
            <div className="border-t border-slate-100 pt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-500 flex justify-between">
                  <span>OpenAQ Key</span>
                  <span className="text-[10px] text-slate-400 font-normal">Needed for live CPCB readings</span>
                </span>
                <input
                  type="password"
                  value={openaqKey}
                  onChange={e => {
                    setOpenaqKey(e.target.value);
                    localStorage.setItem("openaq_key", e.target.value);
                  }}
                  placeholder="Your OpenAQ key"
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-sm focus:border-indigo-600 focus:ring-3 focus:ring-indigo-100 outline-none transition-all font-mono text-slate-900"
                />
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-[10px] text-slate-400">
                    Get free token at{" "}
                    <a
                      href="https://explore.openaq.org/register"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      explore.openaq.org
                    </a>
                  </span>
                  <button
                    type="button"
                    onClick={handleTestOpenaqKey}
                    disabled={testingKey}
                    className="text-[10px] text-indigo-600 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer disabled:text-slate-400"
                  >
                    🔌 Test Key
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-500 flex justify-between">
                  <span>OpenRouter Key (optional)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Please provide your OpenRouter API key</span>
                </span>
                <input
                  type="password"
                  value={openrouterKey}
                  onChange={e => {
                    setOpenrouterKey(e.target.value);
                    localStorage.setItem("openrouter_key", e.target.value);
                  }}
                  placeholder="Your OpenRouter key"
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-sm focus:border-indigo-600 focus:ring-3 focus:ring-indigo-100 outline-none transition-all font-mono text-slate-900"
                />
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-[10px] text-slate-400">
                    Please provide an OpenRouter API key to run scans.
                  </span>
                  <button
                    type="button"
                    onClick={handleTestOpenrouterKey}
                    disabled={testingKey}
                    className="text-[10px] text-indigo-600 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer disabled:text-slate-400"
                  >
                    🔌 Test Key
                  </button>
                </div>
              </div>
            </div>

            {/* ── Upload Area ── */}
            <div className="border-t border-slate-100 pt-5">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-2">
                📷 Citizen Photo Reports <span className="font-normal text-slate-400">(Optional)</span>
              </span>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer relative ${
                  isDragOver ? "border-indigo-600 bg-indigo-50/50" : "border-slate-200 hover:border-slate-400 bg-slate-50/20"
                }`}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="mx-auto w-8 h-8 text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-600">Drop pollution photos here or click to upload</p>
                <p className="text-xs text-slate-400 mt-1">Detects chimneys, street waste fires, or dense construction smoke</p>
              </div>

              {uploadedPhotos.length > 0 && (
                <div className="flex flex-wrap gap-2.5 mt-4">
                  {uploadedPhotos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-2 pr-3 text-xs"
                    >
                      <div className="w-10 h-10 bg-slate-200 rounded-lg object-cover overflow-hidden shadow-xs">
                        <img src={photo.path} alt="Report preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col max-w-[120px] truncate">
                        <span className="font-semibold text-slate-700 truncate">{photo.name}</span>
                        <span className="text-[10px] text-green-600 font-medium">✓ Uploaded</span>
                      </div>
                      <button
                        onClick={() => removePhoto(idx)}
                        className="p-1 hover:bg-slate-200 rounded-lg text-rose-600 ml-1 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Actions Row ── */}
            <div className="border-t border-slate-100 pt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
                <button
                  onClick={handleRunScan}
                  disabled={scanLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl px-6 py-2.5 flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm shadow-indigo-100 active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {scanLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 fill-white" />
                  )}
                  Run pollution scan
                </button>
              </div>

              {testResult && (
                <span
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                    testResult.ok ? "bg-green-50 text-green-700 border border-green-100" : "bg-rose-50 text-rose-700 border border-rose-100"
                  }`}
                >
                  {testResult.message}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ── Status Errors Bar ── */}
        {errors.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col gap-1.5 text-xs text-amber-800 shadow-sm">
            <span className="font-bold flex items-center gap-1.5">⚠️ Process logs and warnings:</span>
            <ul className="list-disc pl-4 flex flex-col gap-1">
              {errors.map((err, idx) => (
                <li key={idx} className="leading-relaxed">{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Agent Pipeline Animation ── */}
        {(scanLoading || showResults) && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <span>⚙️</span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Agent Pipeline Analytics Engine
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
              {PIPELINE_AGENTS.map((agent) => {
                const state = pipelineState[agent.id] || "idle";
                return (
                  <div
                    key={agent.id}
                    className={`border rounded-xl p-3 flex flex-col items-center justify-center text-center transition-all ${
                      state === "run"
                        ? "border-indigo-600 bg-indigo-50 shadow-xs"
                        : state === "done"
                        ? "border-green-600 bg-green-50/50"
                        : "border-slate-200 bg-slate-50 opacity-60"
                    }`}
                  >
                    <span className="text-xl mb-1">{agent.icon}</span>
                    <span className="text-[10px] font-bold truncate max-w-full text-slate-800">
                      {agent.label}
                    </span>
                    <span
                      className={`text-[8px] font-semibold uppercase tracking-wider mt-1 px-1.5 py-0.5 rounded ${
                        state === "run"
                          ? "bg-indigo-600 text-white animate-pulse"
                          : state === "done"
                          ? "bg-green-600 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {state === "run" ? "Active" : state === "done" ? "Finished" : "Standby"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Summary Tiles Grid ── */}
        {showResults && (
          <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Risk counters */}
            {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((tier) => {
              const count = hotspots.filter(h => h.risk_tier === tier).length;
              return (
                <div key={tier} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm text-center flex flex-col justify-center">
                  <span className="text-2xl font-black" style={{ color: RISK_COLORS[tier] }}>
                    {count}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                    {RISK_EMOJIS[tier]} {tier.charAt(0) + tier.slice(1).toLowerCase()} Risk
                  </span>
                </div>
              );
            })}

            {/* Worst Hotspot Indicator */}
            {worstHotspot && (
              <div className="bg-white border-2 border-red-500 rounded-2xl p-4 shadow-md col-span-2 md:col-span-1 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-bold text-red-600 uppercase tracking-widest block">
                    🚨 Worst Hotspot
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 truncate mt-1">
                    {worstHotspot.zone}
                  </h3>
                </div>
                <div className="text-[11px] text-slate-500 mt-2 border-t border-slate-100 pt-2 flex justify-between items-center">
                  <span>AQI: <b className="text-red-600">{worstHotspot.aqi}</b></span>
                  <span>Score: <b className="text-slate-700">{worstHotspot.composite_risk_score}</b></span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Main Panel Grid Layout ── */}
        {showResults && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left and Mid Content Columns */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* OSM Map Card */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col relative h-[380px]">
                <div className="absolute top-3 left-3 z-20 bg-white/95 border border-slate-200 rounded-lg px-3 py-1 text-xs font-semibold text-slate-900 shadow-md flex items-center gap-1.5">
                  📍 {constituency}, {district}
                </div>
                {photoCount > 0 && (
                  <div className="absolute top-3 right-3 z-20 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg px-2.5 py-1 text-[10px] font-bold shadow-sm flex items-center gap-1.5">
                    📷 Citizen Photo Evidence Active
                  </div>
                )}
                {/* Real OpenStreetMap Map div container */}
                <div id="leaflet-map" className="w-full h-full"></div>
              </div>

              {/* Selected Hotspot Details Box */}
              {selectedHotspot && (
                <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col gap-5">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5 font-display">
                      📍 {selectedHotspot.zone}
                    </h3>
                    <span
                      className="text-xs font-bold px-3 py-1 rounded-full border"
                      style={{
                        backgroundColor: `${RISK_COLORS[selectedHotspot.risk_tier]}15`,
                        color: RISK_COLORS[selectedHotspot.risk_tier],
                        borderColor: `${RISK_COLORS[selectedHotspot.risk_tier]}30`,
                      }}
                    >
                      {RISK_EMOJIS[selectedHotspot.risk_tier]} {selectedHotspot.risk_tier} · Score: {selectedHotspot.composite_risk_score}
                    </span>
                  </div>

                  {/* Dynamic Non-Hardcoded Pollution Reason */}
                  <div className="bg-amber-50/50 border-l-4 border-amber-600 p-4 rounded-r-xl text-xs leading-relaxed text-slate-900">
                    <span className="font-bold text-amber-800 flex items-center gap-1.5 mb-1">
                      🔍 Dynamic Pollution Cause Analysis
                    </span>
                    {selectedHotspot.pollution_reason}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">AQI</span>
                      <span className="text-lg font-extrabold mt-1 block" style={{ color: RISK_COLORS[selectedHotspot.risk_tier] }}>
                        {selectedHotspot.aqi}
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Predicted Peak</span>
                      <span className="text-lg font-extrabold text-rose-600 mt-1 block">
                        {selectedHotspot.predicted_peak_aqi}
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Primary Pollutant</span>
                      <span className="text-lg font-extrabold text-slate-900 mt-1 block">
                        {selectedHotspot.primary_pollutant}
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Aerosol Index</span>
                      <span className="text-lg font-extrabold text-slate-900 mt-1 block">
                        {selectedHotspot.aerosol_index}
                      </span>
                    </div>
                  </div>

                  {/* Recommendation action dispatch order details */}
                  <div
                    className="p-4 rounded-xl text-xs flex flex-col gap-1 border"
                    style={{
                      backgroundColor: `${RISK_COLORS[selectedHotspot.risk_tier]}05`,
                      borderColor: `${RISK_COLORS[selectedHotspot.risk_tier]}15`,
                    }}
                  >
                    <span className="font-bold uppercase tracking-wider text-[10px]" style={{ color: RISK_COLORS[selectedHotspot.risk_tier] }}>
                      📋 Recommended dispatch action
                    </span>
                    <p className="text-slate-800 leading-relaxed font-medium">{selectedHotspot.recommended_action}</p>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <span
                      className="text-xs font-semibold px-3 py-1.5 rounded-full border flex items-center gap-1.5"
                      style={{
                        backgroundColor: `${RISK_COLORS[selectedHotspot.risk_tier]}10`,
                        color: RISK_COLORS[selectedHotspot.risk_tier],
                        borderColor: `${RISK_COLORS[selectedHotspot.risk_tier]}25`,
                      }}
                    >
                      {RESOURCE_LABELS[selectedHotspot.municipal_resource] || selectedHotspot.municipal_resource}
                    </span>

                    <div className="flex gap-1.5 flex-wrap">
                      {selectedHotspot.pollution_types.map(t => (
                        <span key={t} className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 rounded-md px-2 py-1 uppercase tracking-wide font-medium">
                          {t}
                        </span>
                      ))}
                      {selectedHotspot.evidence_sources.map(src => (
                        <span
                          key={src}
                          className={`text-[10px] border rounded-md px-2 py-1 uppercase tracking-wide font-semibold ${
                            src === "vision"
                              ? "bg-rose-50 border-rose-200 text-rose-600"
                              : "bg-indigo-50 border-indigo-200 text-indigo-600"
                          }`}
                        >
                          {src === "vision" ? "📷 vision" : src}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* 24-hour Forecast Graph */}
              <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                  <TrendingUp className="w-4 h-4 text-slate-700" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    24-Hour Air Quality Index (AQI) Forecast
                  </h3>
                </div>
                {renderSvgForecast()}
              </section>
            </div>

            {/* Sidebar Column (Municipal Alerts and list of hotspots) */}
            <div className="flex flex-col gap-6">
              
              {/* Municipal alerts box with full border color MATCHING alert indicator color! */}
              {municipalAlerts.length > 0 && (
                <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                    <Bell className="w-4 h-4 text-red-600" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Municipal Dispatch Orders
                    </h2>
                  </div>

                  <div className="flex flex-col gap-3">
                    {municipalAlerts.map((alert, idx) => {
                      const isUrgent = alert.priority === 1;
                      const borderCol = isUrgent ? "#DC2626" : "#D97706";
                      const bgCol = isUrgent ? "#FEF2F2" : "#FEF3C7";
                      
                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl flex flex-col gap-2 transition-all shadow-xs"
                          style={{
                            border: `2px solid ${borderCol}`, // ISSUE 4 FIX: full matching border color!
                            backgroundColor: bgCol,
                          }}
                        >
                          <div className="flex justify-between items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 truncate">
                              📍 {alert.zone}
                            </span>
                            <span
                              className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${
                                isUrgent ? "bg-red-600 text-white" : "bg-amber-600 text-white"
                              }`}
                            >
                              {isUrgent ? "CRITICAL" : "PRIORITY 2"}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-900 font-semibold leading-relaxed">
                            {RESOURCE_LABELS[alert.resource_type] || alert.resource_type}: {alert.action}
                          </p>

                          <div className="text-[10px] text-slate-500 flex items-center gap-1 font-semibold border-t border-black/5 pt-1.5 mt-0.5">
                            <Clock className="w-3.5 h-3.5" />
                            Response within {alert.estimated_response_minutes} minutes
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Hotspots Overview Selector List */}
              <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="text-sm">🎯</span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Hotspots Overview
                  </h2>
                </div>

                <div className="flex flex-col gap-3">
                  {hotspots.map(h => {
                    const isSelected = h.id === selectedHotspotId;
                    return (
                      <div
                        key={h.id}
                        onClick={() => setSelectedHotspotId(h.id)}
                        className={`border rounded-xl p-3.5 cursor-pointer transition-all flex flex-col gap-2 ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50 shadow-xs"
                            : "border-slate-200 hover:border-slate-400 bg-white"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-xs text-slate-900 truncate">{h.zone}</span>
                          <span
                            className="text-[9px] font-bold px-2 py-0.5 rounded-full select-none"
                            style={{
                              backgroundColor: `${RISK_COLORS[h.risk_tier]}15`,
                              color: RISK_COLORS[h.risk_tier],
                            }}
                          >
                            {RISK_EMOJIS[h.risk_tier]} {h.aqi} AQI
                          </span>
                        </div>

                        {/* Reason preview */}
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed font-medium">
                          🔍 {h.pollution_reason}
                        </p>

                        <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-100 pt-2 mt-1">
                          <span className="font-bold text-slate-500">
                            {RESOURCE_LABELS[h.municipal_resource] || h.municipal_resource}
                          </span>
                          <span className="flex gap-1">
                            {h.photo_evidence && <span className="text-rose-600 font-bold">📷 photo</span>}
                            <span>{h.evidence_sources.join(" + ")}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ── Critique Agent Audit briefing summary ── */}
        {showResults && auditSummary && (
          <section className="bg-slate-100 border border-slate-200 rounded-2xl p-5 shadow-inner">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-3">
              <FileText className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Critique Agent Audit Verification
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {auditSummary}
            </p>
            <div className="flex gap-4 mt-4 border-t border-slate-200 pt-3 text-[10px] font-bold">
              {photoCount > 0 && (
                <span className="text-rose-600 flex items-center gap-1">
                  📷 {photoCount} active citizen photos contributed vision telemetry
                </span>
              )}
              {sensorCount > 0 ? (
                <span className="text-green-600 flex items-center gap-1">
                  ✓ {sensorCount} active ground CPCB sensor readings ingested
                </span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1">
                  ⚠️ Simulated ground coordinates populated dynamically
                </span>
              )}
            </div>
          </section>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="max-w-6xl mx-auto mt-8 border-t border-slate-200 pt-6 px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] text-slate-400">
        <span>Data Ingested: OpenAQ CPCB, ISRO Bhuvan (simulated remote thermal), multi-agent forecasting</span>
        <span>Aistudio-Build v2.1 • Supervisor → Sensor, Vision, Satellite, Forecast → Aggregator → Critique QA</span>
      </footer>
    </div>
  );
}
