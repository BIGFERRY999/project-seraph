import React, { useState, useEffect } from 'react';
import { 
  X, 
  Grid, 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  Camera, 
  MapPin, 
  Compass, 
  Layers, 
  Radio, 
  Eye
} from 'lucide-react';
import { TelemetryContact } from '../../types/tactical';

interface SurveillanceWallProps {
  cameras: TelemetryContact[];
  isOpen: boolean;
  onClose: () => void;
  onSelectCamera: (camera: TelemetryContact) => void;
}

export const SurveillanceWall: React.FC<SurveillanceWallProps> = ({
  cameras,
  isOpen,
  onClose,
  onSelectCamera,
}) => {
  const [gridCols, setGridCols] = useState<2 | 3>(3);
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [frameStamp, setFrameStamp] = useState<number>(Date.now());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Auto-refresh camera frames every 3.5 seconds
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setFrameStamp(Date.now());
    }, 3500);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const regions = ['ALL', 'ASIA / PACIFIC', 'EUROPE', 'AMERICAS', 'MIDDLE EAST'];

  const filteredCameras = cameras.filter(cam => {
    if (selectedRegion === 'ALL') return true;
    const city = (cam.cameraCity || cam.name || '').toUpperCase();
    if (selectedRegion === 'ASIA / PACIFIC') return city.includes('TOKYO') || city.includes('SYDNEY') || city.includes('HONOLULU');
    if (selectedRegion === 'EUROPE') return city.includes('LONDON') || city.includes('PARIS') || city.includes('ROME') || city.includes('TALLINN') || city.includes('WARENDORF');
    if (selectedRegion === 'AMERICAS') return city.includes('NEW YORK') || city.includes('SAN FRANCISCO') || city.includes('AUSTIN') || city.includes('CALGARY');
    if (selectedRegion === 'MIDDLE EAST') return city.includes('DUBAI') || city.includes('GIBRALTAR');
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-[#04060a]/95 backdrop-blur-xl flex flex-col p-4 select-none font-mono animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1b2333]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-950/80 border border-purple-500/50 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-950/40">
            <Camera className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-white tracking-wider">
                TACTICAL OPTICAL MATRIX // SOC VIDEO WALL
              </h1>
              <span className="text-[10px] bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded border border-purple-500/40">
                {filteredCameras.length} STREAMS ACTIVE
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">
              Synchronized Multi-Aperture Surveillance Feeds · Real-Time Optical Ingest
            </p>
          </div>
        </div>

        {/* Center Region Filter Buttons */}
        <div className="hidden lg:flex items-center gap-1.5 bg-[#0b101d] border border-[#1b2333] p-1 rounded-xl text-xs">
          {regions.map((reg) => (
            <button
              key={reg}
              type="button"
              onClick={() => setSelectedRegion(reg)}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                selectedRegion === reg
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {reg}
            </button>
          ))}
        </div>

        {/* Right Toolbar */}
        <div className="flex items-center gap-2">
          {/* Grid Layout Switcher */}
          <div className="flex items-center bg-[#0b101d] border border-[#1b2333] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setGridCols(2)}
              className={`px-2 py-1 text-xs rounded transition-all cursor-pointer ${
                gridCols === 2 ? 'bg-purple-600 text-white font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              2x2
            </button>
            <button
              type="button"
              onClick={() => setGridCols(3)}
              className={`px-2 py-1 text-xs rounded transition-all cursor-pointer ${
                gridCols === 3 ? 'bg-purple-600 text-white font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              3x3
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 bg-[#0e1320] border border-[#1b2333] hover:bg-[#151c2e] text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Video Wall'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Wall Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-rose-950/40 border border-rose-500/50 hover:bg-rose-900/50 text-rose-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Close Surveillance Wall"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Camera Video Stream Grid */}
      <div className={`flex-1 overflow-y-auto mt-4 grid gap-3 ${
        gridCols === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
      }`}>
        {filteredCameras.map((cam) => {
          const videoSrc = cam.videoUrl ? `${cam.videoUrl}?t=${frameStamp}` : undefined;

          return (
            <div
              key={cam.id}
              className="group relative bg-black rounded-xl overflow-hidden border border-[#1f283d] hover:border-purple-500/70 transition-all flex flex-col shadow-lg"
            >
              {/* Top Card Bar */}
              <div className="absolute top-0 inset-x-0 z-10 bg-gradient-to-b from-black/90 to-transparent p-2.5 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span className="font-bold text-white tracking-wide">{cam.callsign}</span>
                  <span className="text-[10px] text-purple-300 bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-500/30">
                    {cam.cameraCity || 'GLOBAL'}
                  </span>
                </div>
                <span className="text-[10px] text-cyan-400 font-bold bg-black/60 px-1.5 py-0.2 rounded">
                  OPTICAL 1080P
                </span>
              </div>

              {/* Feed Display (Image / Video) */}
              <div className="relative w-full h-56 bg-[#030508] flex items-center justify-center overflow-hidden">
                {cam.feedType === 'mp4' ? (
                  <video
                    src={cam.videoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={videoSrc}
                    alt={cam.name}
                    className="w-full h-full object-cover transition-opacity duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80';
                    }}
                  />
                )}

                {/* CRT Scanline Overlay */}
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />

                {/* Tactical Corner Brackets */}
                <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-purple-500/60 pointer-events-none" />
                <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-purple-500/60 pointer-events-none" />
                <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-purple-500/60 pointer-events-none" />
                <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-purple-500/60 pointer-events-none" />
              </div>

              {/* Bottom Telemetry & Navigation Bar */}
              <div className="p-2.5 bg-[#0b101c] border-t border-[#1b2333] flex items-center justify-between text-[10px] text-zinc-300">
                <div className="space-y-0.5 truncate max-w-[220px]">
                  <p className="font-bold text-white truncate">{cam.name}</p>
                  <p className="text-zinc-500 text-[9px] truncate">{cam.cameraProvider || cam.country}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 font-bold">AZ {cam.heading}°</span>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCamera(cam);
                      onClose();
                    }}
                    className="flex items-center gap-1 bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white px-2 py-1 rounded border border-purple-500/50 transition-all font-bold cursor-pointer"
                    title="Lock onto camera on 3D globe"
                  >
                    <Eye className="w-3 h-3" />
                    <span>FLY TO</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
