import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Radio, 
  Volume2, 
  VolumeX, 
  Activity, 
  Wifi, 
  Disc, 
  Zap, 
  ChevronRight, 
  ChevronLeft,
  Sliders,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { tacticalSound } from '../../tacticalSound';
import { DomainType } from '../../types/tactical';

interface TacticalMicSidePodProps {
  onVoiceCommand?: (command: string, transcript: string) => void;
  onSelectDomain?: (domain: DomainType) => void;
  onFilterSearch?: (query: string) => void;
  onToggleAirDefense?: () => void;
  onToggleVideoWall?: () => void;
  onToggleSandbox?: () => void;
  onToggleDvr?: () => void;
}

export const TacticalMicSidePod: React.FC<TacticalMicSidePodProps> = ({
  onVoiceCommand,
  onSelectDomain,
  onFilterSearch,
  onToggleAirDefense,
  onToggleVideoWall,
  onToggleSandbox,
  onToggleDvr
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [transcript, setTranscript] = useState<string>('');
  const [lastAction, setLastAction] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [micMode, setMicMode] = useState<'PTT' | 'TOGGLE'>('TOGGLE');
  const [audioBars, setAudioBars] = useState<number[]>([15, 25, 40, 65, 80, 50, 30, 20]);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up Web Audio and Speech Recognition on unmount
  useEffect(() => {
    return () => {
      stopAudioAnalysis();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  // Keyboard shortcut: press 'V' to speak
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'v' || e.key === 'V') {
        if (!e.repeat) {
          toggleVoice();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isListening]);

  // Real-time audio frequency visualizer via Web Audio API
  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 32;
      analyser.smoothingTimeConstant = 0.65;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average energy
        let sum = 0;
        const bars: number[] = [];
        for (let i = 0; i < 8; i++) {
          const val = dataArray[i] || 0;
          sum += val;
          bars.push(Math.max(10, Math.min(100, Math.round((val / 255) * 100))));
        }
        setAudioBars(bars);
        setAudioLevel(Math.min(100, Math.round((sum / (8 * 255)) * 100)));

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (err) {
      console.warn('[Helios C2 Mic] MediaStream analyzer error:', err);
    }
  };

  const stopAudioAnalysis = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
    setAudioBars([15, 25, 40, 65, 80, 50, 30, 20]);
  };

  const startVoice = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    tacticalSound.playRadioChirp?.();
    startAudioAnalysis();

    if (!SpeechRec) {
      setIsListening(true);
      setTranscript('BROWSER SPEECH ENGINE OFFLINE');
      setLastAction('AUDIO METER ACTIVE ONLY');
      setTimeout(() => {
        setIsListening(false);
        stopAudioAnalysis();
      }, 4000);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setTranscript('LISTENING // TRANSMIT COMMAND...');
        setLastAction('SECURE TX CH-01 ARMED');
      };

      rec.onresult = (event: any) => {
        const spoken = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join('')
          .trim();

        setTranscript(spoken.toUpperCase());
        onFilterSearch?.(spoken);

        // Voice Command Dispatcher
        const lower = spoken.toLowerCase();
        if (lower.includes('air') || lower.includes('flight') || lower.includes('plane')) {
          onSelectDomain?.('air');
          setLastAction('DOMAIN: AIR OPS');
          tacticalSound.playSelect?.();
        } else if (lower.includes('naval') || lower.includes('maritime') || lower.includes('ship')) {
          onSelectDomain?.('maritime');
          setLastAction('DOMAIN: NAVAL FLEET');
          tacticalSound.playSelect?.();
        } else if (lower.includes('space') || lower.includes('satellite') || lower.includes('orbit')) {
          onSelectDomain?.('space');
          setLastAction('DOMAIN: SPACE / ISS');
          tacticalSound.playSelect?.();
        } else if (lower.includes('camera') || lower.includes('cctv') || lower.includes('surveillance')) {
          onSelectDomain?.('cctv');
          setLastAction('DOMAIN: CCTV MESH');
          tacticalSound.playSelect?.();
        } else if (lower.includes('crisis') || lower.includes('quake') || lower.includes('seismic')) {
          onSelectDomain?.('crisis');
          setLastAction('DOMAIN: SEISMIC / CRISIS');
          tacticalSound.playSelect?.();
        } else if (lower.includes('wall') || lower.includes('video wall')) {
          onToggleVideoWall?.();
          setLastAction('SOC VIDEO WALL TOGGLED');
          tacticalSound.playSelect?.();
        } else if (lower.includes('sandbox') || lower.includes('missile defense')) {
          onToggleSandbox?.();
          setLastAction('MISSION SANDBOX TOGGLED');
          tacticalSound.playSelect?.();
        } else if (lower.includes('dvr') || lower.includes('replay') || lower.includes('history')) {
          onToggleDvr?.();
          setLastAction('4D DVR OPENED');
          tacticalSound.playSelect?.();
        } else if (lower.includes('sam') || lower.includes('dome') || lower.includes('patriot')) {
          onToggleAirDefense?.();
          setLastAction('SAM DOMES TOGGLED');
          tacticalSound.playSelect?.();
        } else if (lower.includes('clear') || lower.includes('reset') || lower.includes('all')) {
          onSelectDomain?.('all');
          onFilterSearch?.('');
          setLastAction('COP RESET: ALL DOMAINS');
          tacticalSound.playSelect?.();
        }

        onVoiceCommand?.(lower, spoken);
      };

      rec.onerror = (err: any) => {
        console.warn('[Helios Voice] Error:', err);
        setLastAction(`ERR: ${err.error || 'ACCESS BLOCKED'}`);
      };

      rec.onend = () => {
        if (micMode === 'TOGGLE' && isListening) {
          try {
            rec.start(); // Keep listening in toggle mode
          } catch {}
        } else {
          setIsListening(false);
          stopAudioAnalysis();
          tacticalSound.playSelect?.();
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.warn('[Helios Voice] Init error:', err);
      setIsListening(false);
      stopAudioAnalysis();
    }
  };

  const stopVoice = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    stopAudioAnalysis();
    tacticalSound.playRadioChirp?.();
    setLastAction('COMMS MUTED // STANDBY');
  };

  const toggleVoice = () => {
    if (isListening) {
      stopVoice();
    } else {
      startVoice();
    }
  };

  return (
    <aside 
      className={`fixed right-4 bottom-20 z-40 font-mono select-none transition-all duration-300 ease-out ${
        isExpanded ? 'w-72' : 'w-16'
      }`}
      aria-label="Tactical Microphone Comms Pod"
    >
      {/* Outer Tactical Armor Shell */}
      <div className={`relative rounded-2xl border backdrop-blur-2xl transition-all duration-300 shadow-2xl ${
        isListening
          ? 'bg-[#080d1a]/95 border-rose-500/70 shadow-rose-500/20 ring-1 ring-rose-400/40'
          : 'bg-[#060a14]/90 border-cyan-500/40 shadow-cyan-500/10 hover:border-cyan-400/60'
      }`}>
        {/* Top Military HUD Accent Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#162238] bg-[#03060f]/60 rounded-t-2xl">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
              isListening ? 'bg-rose-500 animate-ping' : 'bg-emerald-400 animate-pulse'
            }`} />
            <span className="text-[10px] font-black tracking-widest text-zinc-300">
              {isExpanded ? 'TAC-COMMS // PTT' : 'MIC'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isExpanded && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-bold">
                UHF 243.0
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title={isExpanded ? 'Collapse Tactical Mic Pod' : 'Expand Tactical Mic Pod'}
            >
              {isExpanded ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-3 flex flex-col items-center gap-3">
          {/* THE MASTER TACTICAL MICROPHONE BUTTON */}
          <div className="relative flex items-center justify-center">
            {/* Outer Rotating Radar Reticle Ring */}
            <div className={`absolute -inset-2.5 rounded-full border border-dashed transition-all pointer-events-none ${
              isListening
                ? 'border-rose-400/60 animate-spin'
                : 'border-cyan-400/30 hover:border-cyan-400/60'
            }`} style={{ animationDuration: isListening ? '4s' : '16s' }} />

            {/* Concentric Pulse Wave Ring when Transmitting */}
            {isListening && (
              <>
                <div className="absolute -inset-4 rounded-full border border-rose-500/40 animate-ping pointer-events-none" />
                <div className="absolute -inset-7 rounded-full border border-rose-400/20 animate-pulse pointer-events-none" />
              </>
            )}

            {/* Avionics Push-To-Talk Button */}
            <button
              type="button"
              onClick={toggleVoice}
              className={`relative group w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer select-none active:scale-90 ${
                isListening
                  ? 'bg-gradient-to-b from-rose-900/60 via-red-950/80 to-black border-2 border-rose-400 shadow-xl shadow-rose-500/40 ring-4 ring-rose-500/20'
                  : 'bg-gradient-to-b from-cyan-950/60 via-[#071322] to-black border-2 border-cyan-400/70 hover:border-cyan-300 shadow-xl shadow-cyan-500/25 hover:shadow-cyan-400/40 ring-4 ring-cyan-500/10'
              }`}
              title={isListening ? 'Click to MUTE Comms [V]' : 'Click to ENGAGE Tactical Voice Recon [V]'}
            >
              {/* Inner Carbon Texture Overlay */}
              <div className="absolute inset-1 rounded-full bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:4px_4px] pointer-events-none opacity-40" />

              {/* Central Glowing Icon */}
              <div className="relative z-10 flex flex-col items-center">
                {isListening ? (
                  <Mic className="w-8 h-8 text-rose-300 filter drop-shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse" />
                ) : (
                  <Mic className="w-8 h-8 text-cyan-300 filter drop-shadow-[0_0_8px_rgba(0,240,255,0.8)] group-hover:scale-110 transition-transform" />
                )}
                
                <span className={`text-[8px] font-black tracking-wider mt-0.5 ${
                  isListening ? 'text-rose-300 animate-pulse' : 'text-cyan-400 group-hover:text-cyan-200'
                }`}>
                  {isListening ? 'LIVE TX' : 'PUSH'}
                </span>
              </div>
            </button>
          </div>

          {/* Expanded Telemetry Readout */}
          {isExpanded && (
            <div className="w-full flex flex-col gap-2 pt-1 border-t border-[#162238]/60">
              {/* Audio Frequency Equalizer Bar Display */}
              <div className="flex items-center justify-between bg-[#03060f]/80 px-2 py-1.5 rounded-lg border border-[#1b2b45]">
                <div className="flex items-center gap-1">
                  <Activity className={`w-3 h-3 ${isListening ? 'text-rose-400 animate-pulse' : 'text-zinc-500'}`} />
                  <span className="text-[9px] text-zinc-400 font-bold">VU METER:</span>
                </div>

                {/* 8-Band Frequency Bars */}
                <div className="flex items-end gap-1 h-4">
                  {audioBars.map((height, idx) => (
                    <div
                      key={idx}
                      className={`w-1.5 rounded-xs transition-all duration-75 ${
                        isListening
                          ? height > 60
                            ? 'bg-rose-400 shadow-xs shadow-rose-400'
                            : 'bg-amber-400'
                          : 'bg-cyan-500/40'
                      }`}
                      style={{ height: `${isListening ? height : 15}%` }}
                    />
                  ))}
                </div>

                <span className={`text-[9px] font-bold ${isListening ? 'text-rose-300' : 'text-zinc-500'}`}>
                  {isListening ? `${audioLevel}%` : '0%'}
                </span>
              </div>

              {/* Real-Time Transcript HUD Ribbon */}
              <div className="bg-[#040813] border border-cyan-500/30 p-2 rounded-lg min-h-[38px] flex flex-col justify-center">
                <span className="text-[8px] text-cyan-400 font-bold uppercase tracking-wider block">
                  {isListening ? 'RADIO TRANSCRIPTION:' : 'TRANSCEIVER STATUS:'}
                </span>
                <span className="text-[10px] text-white font-mono truncate font-semibold">
                  {transcript || (isListening ? 'Awaiting spoken orders...' : 'Tactical Comms in Standby')}
                </span>
              </div>

              {/* Last Dispatched Action Pill */}
              {lastAction && (
                <div className="flex items-center justify-between px-2 py-1 bg-cyan-950/30 border border-cyan-500/30 rounded text-[9px] text-cyan-300">
                  <span className="flex items-center gap-1 font-bold">
                    <Zap className="w-2.5 h-2.5 text-amber-400" />
                    ACTION:
                  </span>
                  <span className="truncate max-w-[170px] text-white font-medium">{lastAction}</span>
                </div>
              )}

              {/* Mode Controls & Key Hint */}
              <div className="flex items-center justify-between text-[9px] text-zinc-400 pt-0.5">
                <span className="flex items-center gap-1">
                  <span>HOTKEY:</span>
                  <kbd className="px-1 py-0.2 bg-[#121c2e] border border-[#233550] rounded text-cyan-300 font-bold">[V]</kbd>
                </span>

                <button
                  type="button"
                  onClick={() => setMicMode(micMode === 'TOGGLE' ? 'PTT' : 'TOGGLE')}
                  className="px-1.5 py-0.5 rounded border border-[#1b283d] bg-[#0c1322] hover:text-white transition-colors cursor-pointer text-zinc-300"
                  title="Switch between Click-to-Toggle and Push-to-Talk"
                >
                  MODE: <strong className="text-cyan-400">{micMode}</strong>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
