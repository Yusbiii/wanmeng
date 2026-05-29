import { useState, useEffect, useRef } from "react";
import { auth, rtdb } from "../firebase";
import { signOut } from "firebase/auth";
import { ref, onValue, set } from "firebase/database";
import { motion, AnimatePresence } from "motion/react";
import { 
  Thermometer, 
  Droplets, 
  Zap, 
  Mic, 
  MicOff, 
  Volume2, 
  LogOut, 
  Wifi, 
  WifiOff, 
  CheckCircle, 
  AlertTriangle, 
  HelpCircle,
  Hash,
  Activity,
  Edit2,
  Check,
  RefreshCw,
  Clock
} from "lucide-react";
import { IoTData, VoiceCommandLog } from "../types";

export default function Dashboard() {
  // Current user metadata
  const user = auth.currentUser;

  // Realtime Database State
  const [data, setData] = useState<IoTData>({
    Suhu: 22.4,
    Kelembapan: 55,
    Relay1: false,
    Relay2: false,
    Relay3: false,
    Relay4: false,
  });

  // Connection Indicator
  const [isConnected, setIsConnected] = useState(false);
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(true);

  // Relay Alias Names (saved in localStorage)
  const [relayNames, setRelayNames] = useState<{ [key: string]: string }>({
    Relay1: "System Exhaust",
    Relay2: "Main Lighting",
    Relay3: "HVAC Pump",
    Relay4: "Auxiliary Power",
  });
  const [editingRelay, setEditingRelay] = useState<string | null>(null);
  const [tempEditName, setTempEditName] = useState("");

  // Speech Recognition States
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceLogs, setVoiceLogs] = useState<VoiceCommandLog[]>([]);
  const [speechApiSupported, setSpeechApiSupported] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Simulation mode (useful when there's no physical ESP32 powered on)
  const [isSimulating, setIsSimulating] = useState(true);

  // Historical state for the sensor graph
  const [history, setHistory] = useState<Array<{ time: string; Temp: number; Humid: number }>>([]);

  // Load Saved Relay Names from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem("rtdb_relay_names");
    if (saved) {
      try {
        setRelayNames(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading relay names:", e);
      }
    }
  }, []);

  // Sync Relay Names
  const saveRelayName = (key: string, newName: string) => {
    if (!newName.trim()) return;
    const updated = { ...relayNames, [key]: newName.trim() };
    setRelayNames(updated);
    localStorage.setItem("rtdb_relay_names", JSON.stringify(updated));
    setEditingRelay(null);
  };

  // Subscribe to Firebase RTDB paths
  useEffect(() => {
    const iotRef = ref(rtdb, "/IoT");
    setIsFirebaseLoading(true);

    const unsubscribe = onValue(iotRef, (snapshot) => {
      setIsFirebaseLoading(false);
      if (snapshot.exists()) {
        const d = snapshot.val();
        const stateData: IoTData = {
          Suhu: typeof d.Suhu === "number" ? d.Suhu : (Number(d.Suhu) || 24.8),
          Kelembapan: typeof d.Kelembapan === "number" ? d.Kelembapan : (Number(d.Kelembapan) || 62),
          Relay1: !!d.Relay1,
          Relay2: !!d.Relay2,
          Relay3: !!d.Relay3,
          Relay4: !!d.Relay4,
        };
        setData(stateData);
        setIsConnected(true);

        const timestamp = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setHistory((prev) => {
          const updated = [...prev, { time: timestamp, Temp: stateData.Suhu, Humid: stateData.Kelembapan }];
          if (updated.length > 20) {
            updated.shift();
          }
          return updated;
        });
      } else {
        setIsConnected(true);
        seedInitialDatabase();
      }
    }, (error) => {
      console.error("Firebase connection error:", error);
      setIsConnected(false);
      setIsFirebaseLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Initialize nodes if they are missing
  const seedInitialDatabase = async () => {
    try {
      await set(ref(rtdb, "/IoT"), {
        Suhu: 24.8,
        Kelembapan: 62.0,
        Relay1: true,
        Relay2: false,
        Relay3: false,
        Relay4: true,
      });
    } catch (e) {
      console.error("Gagal melakukan seeding awal:", e);
    }
  };

  // ESP32 Telemetry simulation loop
  useEffect(() => {
    let interval: any;
    if (isSimulating) {
      interval = setInterval(() => {
        const tempDrift = (Math.random() - 0.5) * 0.6;
        const humidDrift = (Math.random() - 0.5) * 1.2;

        const nextTemp = Math.min(Math.max(data.Suhu + tempDrift, 15), 45);
        const nextHumid = Math.min(Math.max(data.Kelembapan + humidDrift, 30), 95);

        set(ref(rtdb, "/IoT/Suhu"), parseFloat(nextTemp.toFixed(1)));
        set(ref(rtdb, "/IoT/Kelembapan"), parseFloat(nextHumid.toFixed(1)));
      }, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSimulating, data.Suhu, data.Kelembapan]);

  // Turn relay state
  const toggleRelay = async (relayIndex: 1 | 2 | 3 | 4, currentValue: boolean) => {
    try {
      await set(ref(rtdb, `/IoT/Relay${relayIndex}`), !currentValue);
    } catch (e) {
      console.error(`Gagal mengubah Relay ${relayIndex}:`, e);
    }
  };

  const setAllRelays = async (state: boolean) => {
    try {
      await set(ref(rtdb, "/IoT/Relay1"), state);
      await set(ref(rtdb, "/IoT/Relay2"), state);
      await set(ref(rtdb, "/IoT/Relay3"), state);
      await set(ref(rtdb, "/IoT/Relay4"), state);
      speakIndonesian(state ? "Menyalakan semua modul relay." : "Mematikan semua modul relay.");
    } catch (e) {
      console.error("Gagal melakukan aksi global relay:", e);
    }
  };

  // Speech Recognition Configuration
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechApiSupported(true);
      const req = new SpeechRecognition();
      req.continuous = false;
      req.lang = "id-ID";
      req.interimResults = false;
      req.maxAlternatives = 1;

      req.onstart = () => {
        setIsListening(true);
        setTranscript("Mendengarkan... Silakan katakan instruksi.");
      };

      req.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        setTranscript(resultText);
        processVoiceCommand(resultText);
      };

      req.onerror = (event: any) => {
        console.error("Speech Error:", event.error);
        if (event.error === "not-allowed") {
          setTranscript("Akses mikrofon dibatasi iFrame. Klik 'Buka Aplikasi' di pojok kanan.");
        } else {
          setTranscript("Tidak berhasil mendeteksi suara. Silakan ulangi.");
        }
        setIsListening(false);
      };

      req.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = req;
    } else {
      setSpeechApiSupported(false);
    }
  }, [data, relayNames]);

  // Speech synthesis for indonesian
  const speakIndonesian = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "id-ID";
    utterance.rate = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const indonesianVoice = voices.find(voice => voice.lang.includes("id") || voice.lang.includes("ID"));
    if (indonesianVoice) {
      utterance.voice = indonesianVoice;
    }

    utterance.onstart = () => setIsSynthesizing(true);
    utterance.onend = () => setIsSynthesizing(false);
    window.speechSynthesis.speak(utterance);
  };

  // Parser voice triggers
  const processVoiceCommand = async (command: string) => {
    const cleaned = command.toLowerCase().trim();
    let responseText = "";
    let detectedCommand = "Undefined Action";
    let success = false;

    const checkArray = (keywords: string[]) => {
      return keywords.some(keyword => cleaned.includes(keyword));
    };

    // 1. RELAY 1
    if (checkArray(["nyalakan relay 1", "hidupkan relay 1", "nyalakan " + relayNames.Relay1.toLowerCase(), "hidupkan " + relayNames.Relay1.toLowerCase()])) {
      await set(ref(rtdb, "/IoT/Relay1"), true);
      detectedCommand = `Relay 1 ON`;
      responseText = `Berhasil mengaktifkan ${relayNames.Relay1}`;
      success = true;
    } else if (checkArray(["matikan relay 1", "matikan " + relayNames.Relay1.toLowerCase()])) {
      await set(ref(rtdb, "/IoT/Relay1"), false);
      detectedCommand = `Relay 1 OFF`;
      responseText = `Berhasil menonaktifkan ${relayNames.Relay1}`;
      success = true;
    }
    // 2. RELAY 2
    else if (checkArray(["nyalakan relay 2", "hidupkan relay 2", "nyalakan " + relayNames.Relay2.toLowerCase(), "hidupkan " + relayNames.Relay2.toLowerCase()])) {
      await set(ref(rtdb, "/IoT/Relay2"), true);
      detectedCommand = `Relay 2 ON`;
      responseText = `Berhasil mengaktifkan ${relayNames.Relay2}`;
      success = true;
    } else if (checkArray(["matikan relay 2", "matikan " + relayNames.Relay2.toLowerCase()])) {
      await set(ref(rtdb, "/IoT/Relay2"), false);
      detectedCommand = `Relay 2 OFF`;
      responseText = `Berhasil menonaktifkan ${relayNames.Relay2}`;
      success = true;
    }
    // 3. RELAY 3
    else if (checkArray(["nyalakan relay 3", "hidupkan relay 3", "nyalakan " + relayNames.Relay3.toLowerCase(), "hidupkan " + relayNames.Relay3.toLowerCase()])) {
      await set(ref(rtdb, "/IoT/Relay3"), true);
      detectedCommand = `Relay 3 ON`;
      responseText = `Berhasil mengaktifkan ${relayNames.Relay3}`;
      success = true;
    } else if (checkArray(["matikan relay 3", "matikan " + relayNames.Relay3.toLowerCase()])) {
      await set(ref(rtdb, "/IoT/Relay3"), false);
      detectedCommand = `Relay 3 OFF`;
      responseText = `Berhasil menonaktifkan ${relayNames.Relay3}`;
      success = true;
    }
    // 4. RELAY 4
    else if (checkArray(["nyalakan relay 4", "hidupkan relay 4", "nyalakan " + relayNames.Relay4.toLowerCase(), "hidupkan " + relayNames.Relay4.toLowerCase()])) {
      await set(ref(rtdb, "/IoT/Relay4"), true);
      detectedCommand = `Relay 4 ON`;
      responseText = `Berhasil mengaktifkan ${relayNames.Relay4}`;
      success = true;
    } else if (checkArray(["matikan relay 4", "matikan " + relayNames.Relay4.toLowerCase()])) {
      await set(ref(rtdb, "/IoT/Relay4"), false);
      detectedCommand = `Relay 4 OFF`;
      responseText = `Berhasil menonaktifkan ${relayNames.Relay4}`;
      success = true;
    }
    // GLOBAL
    else if (checkArray(["nyalakan semua", "aktifkan semua", "hidupkan semua"])) {
      await set(ref(rtdb, "/IoT/Relay1"), true);
      await set(ref(rtdb, "/IoT/Relay2"), true);
      await set(ref(rtdb, "/IoT/Relay3"), true);
      await set(ref(rtdb, "/IoT/Relay4"), true);
      detectedCommand = `Semua Relay ON`;
      responseText = "Berhasil menyalakan seluruh modul kendali.";
      success = true;
    } else if (checkArray(["matikan semua", "nonaktifkan semua"])) {
      await set(ref(rtdb, "/IoT/Relay1"), false);
      await set(ref(rtdb, "/IoT/Relay2"), false);
      await set(ref(rtdb, "/IoT/Relay3"), false);
      await set(ref(rtdb, "/IoT/Relay4"), false);
      detectedCommand = `Semua Relay OFF`;
      responseText = "Berhasil mematikan seluruh modul kendali.";
      success = true;
    }
    // TEMPERATURE SENSORS
    else if (checkArray(["baca semua", "cek semua", "status semua", "cek status", "status sensor"])) {
      detectedCommand = "Cek Semua Sensor";
      responseText = `Suhu udara ruangan saat ini ${data.Suhu} derajat Celsius, dengan kelembapan udara ${data.Kelembapan} persen.`;
      success = true;
    } else if (checkArray(["baca suhu", "cek suhu", "berapa suhu", "suhunya", "temperatur"])) {
      detectedCommand = "Cek Suhu";
      responseText = `Suhu saat ini terdeteksi ${data.Suhu} derajat Celsius.`;
      success = true;
    } else if (checkArray(["baca kelembapan", "cek kelembapan", "berapa kelembapan", "kelembapannya", "humidity"])) {
      detectedCommand = "Cek Kelembapan";
      responseText = `Kelembapan saat ini mencapai ${data.Kelembapan} persen.`;
      success = true;
    } else {
      detectedCommand = "Komando Gagal";
      responseText = `Mendengar "${command}". Perintah tidak teridentifikasi.`;
      success = false;
    }

    if (responseText) {
      speakIndonesian(responseText);
    }

    const newLog: VoiceCommandLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString("id-ID"),
      text: command,
      detectedCommand,
      response: responseText,
      success
    };

    setVoiceLogs(prev => [newLog, ...prev]);
  };

  const handleStartListening = () => {
    if (!speechApiSupported) {
      alert("Akses mikrofon dibatasi iFrame. Silakan klik tombol 'Buka Aplikasi' di kanan atas layar untuk membukanya di Tab Baru.");
      return;
    }
    try {
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStopListening = () => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  // Math percentages
  const tempPercentage = Math.min(Math.max(((data.Suhu - 15) / 35) * 100, 0), 100);
  const humidPercentage = Math.min(Math.max(data.Kelembapan, 0), 100);

  // Chart path maker
  const generateChartPath = (key: 'Temp' | 'Humid', maxVal: number) => {
    if (history.length === 0) return "";
    const w = 500;
    const h = 100;
    const padding = 10;
    const graphWidth = w - padding * 2;
    const graphHeight = h - padding * 2;

    const points = history.map((item, index) => {
      const idx = index;
      const total = history.length - 1 || 1;
      const x = padding + (idx / total) * graphWidth;
      const val = key === 'Temp' ? item.Temp : item.Humid;
      const y = h - padding - (val / maxVal) * graphHeight;
      return `${x},${y}`;
    });

    return points.join(" ");
  };

  return (
    <div id="dashboard-screen" className="h-screen w-screen bg-[#F1F5F9] flex flex-row font-sans text-slate-900 overflow-hidden">
      
      {/* LEFT SIDEBAR PANEL: Professional Polish design (Dark Slate styled aside) */}
      <aside className="w-72 bg-[#0F172A] flex flex-col p-6 text-slate-300 border-r border-slate-800 shrink-0">
        
        {/* Brand identity */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-xl tracking-tight leading-none">RIDWAN IoT</h1>
              <p className="text-[10px] text-blue-400 font-mono mt-1 opacity-70 uppercase tracking-[0.2em]">Firebase Control Unit</p>
            </div>
          </div>
        </div>

        {/* Dynamic Voice feedback card inside sidebar */}
        <div className="space-y-6 flex-1">
          
          <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50 shadow-inner">
            <div className="flex items-center gap-2 mb-4">
              <span className={`w-2 h-2 rounded-full ${isListening ? "bg-rose-500 animate-ping" : "bg-green-500 animate-pulse"}`}></span>
              <span className="text-[11px] font-bold text-white uppercase tracking-wider">Voice Intelligence</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              {isListening ? (
                <span>Mendengarkan instruksi suara Anda...</span>
              ) : isSynthesizing ? (
                <span>Membacakan laporan status...</span>
              ) : (
                <>
                  Pemicu Perintah:<br />
                  &quot;Baca suhu&quot;<br />
                  &quot;Nyalakan {relayNames.Relay1}&quot;
                </>
              )}
            </p>

            {transcript && (
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 mb-4 break-all">
                &quot;{transcript}&quot;
              </div>
            )}

            <div className="flex justify-center">
              {isListening ? (
                <button 
                  id="btn-stop-mic"
                  onClick={handleStopListening}
                  className="group relative w-12 h-12 rounded-full bg-rose-600 flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <div className="absolute inset-0 rounded-full bg-rose-600 animate-ping opacity-20"></div>
                  <MicOff className="w-5 h-5" />
                </button>
              ) : (
                <button 
                  id="btn-start-mic"
                  onClick={handleStartListening}
                  className="group relative w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <div className="absolute inset-0 rounded-full bg-blue-600 animate-ping opacity-20"></div>
                  <Mic className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Configuration context */}
          <div className="p-4 rounded-xl border border-dashed border-slate-700">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Project Config</p>
            <div className="space-y-2 opacity-65">
              <div className="text-[11px] font-mono truncate">ID: ridwan04-3feba</div>
              <div className="text-[11px] font-mono truncate">RTDB: ridwan04-3feba-default</div>
              <div className="text-[11px] font-mono">Simulasi: {isSimulating ? "AKTIF" : "MATI"}</div>
            </div>
          </div>

        </div>

        {/* Signout & profile block */}
        <div className="mt-auto pt-6 border-t border-slate-800">
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img referrerPolicy="no-referrer" src={user.photoURL} alt="RM" className="w-10 h-10 rounded-full border border-slate-700 shadow-sm" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#1e293b] border border-slate-700 flex items-center justify-center text-xs font-bold text-teal-400">
                {user?.email?.slice(0, 2).toUpperCase() || "RM"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{user?.displayName || user?.email?.split("@")[0] || "Ridwan M."}</p>
              <button id="btn-signout" onClick={handleSignOut} className="text-[11px] text-blue-400 hover:underline">Sign Out</button>
            </div>
          </div>
        </div>

      </aside>

      {/* RIGHT MAIN PANEL DISPLAY */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#F1F5F9]">
        
        {/* Navigation / Header Bar */}
        <header className="h-20 bg-white border-b border-slate-200 px-10 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-slate-800">Node Control Panel</h2>
            <p className="text-xs text-slate-500">Real-time synchronization active via Google Firebase</p>
          </div>
          
          <div className="flex items-center gap-6">
            
            {/* WiFi Connection Indicator */}
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">WiFi Status</span>
              <span className={`text-xs font-semibold flex items-center gap-1 ${isConnected ? "text-green-600" : "text-rose-600"}`}>
                {isConnected ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 inline" />
                    <span>CONNECTED (92ms)</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 inline animate-bounce" />
                    <span>DISCONNECTED</span>
                  </>
                )}
              </span>
            </div>

            <div className="h-8 w-px bg-slate-200"></div>

            {/* Simulated Data Trigger */}
            <button
              id="btn-toggle-simulation"
              onClick={() => setIsSimulating(!isSimulating)}
              className={`px-3 py-1.5 border rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isSimulating 
                  ? "bg-amber-50 text-amber-600 border-amber-200"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              <Activity className="w-3.5 h-3.5 shrink-0" />
              <span>Simulasi: {isSimulating ? "AKTIF" : "MATI"}</span>
            </button>

            <div className="h-8 w-px bg-slate-200"></div>

            {/* Linked Account Google indicator */}
            <span className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-2 border border-slate-200 select-none">
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.92 3.4-1.88 4.44-1.2 1.2-3.08 2.48-6.92 2.48-6.12 0-10.88-4.96-10.88-10.88s4.76-10.88 10.88-10.88c3.32 0 5.64 1.32 7.44 3.04l2.32-2.32C19.24 1.92 16.48 0 12.48 0 5.48 0 0 5.48 0 12.48s5.48 12.48 12.48 12.48c3.76 0 6.64-1.24 8.84-3.52 2.24-2.24 2.96-5.4 2.96-7.88 0-.52-.04-1.04-.12-1.52H12.48z"/>
              </svg>
              Linked Account
            </span>

          </div>
        </header>

        {/* Content Pane Grid */}
        <div className="p-10 grid grid-cols-12 gap-8 flex-1 content-start overflow-y-auto">
          
          {/* Left Column (Suhu + Kelembapan stats) */}
          <section className="col-span-4 flex flex-col gap-6">
            
            {/* Environment temperature gauge card */}
            <div id="card-suhu" className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 flex flex-col items-center text-center relative group">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-[0.2em] mb-2">Environment</span>
              <div className="flex items-center justify-center gap-1 mb-2 relative left-2">
                <span id="txt-suhu-val" className="text-6xl font-black text-slate-800 tracking-tighter">
                  {data.Suhu ? data.Suhu.toFixed(1) : "24.8"}
                </span>
                <span className="text-3xl font-light text-slate-400">°C</span>
              </div>
              <p className="text-xs text-slate-400">Suhu Ruangan Aktif</p>
              
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-6 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-500" 
                  style={{ width: `${tempPercentage}%` }}
                />
              </div>
              <div className="flex justify-between w-full mt-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Low (15°C)</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">High (50°C)</span>
              </div>
            </div>

            {/* Atmosphere humidity sensor card */}
            <div id="card-kelembapan" className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 flex flex-col items-center text-center relative">
              <span className="text-xs font-bold text-teal-600 uppercase tracking-[0.2em] mb-2">Humidity</span>
              <div className="flex items-center justify-center gap-1 mb-2 relative left-2">
                <span id="txt-kelembapan-val" className="text-6xl font-black text-slate-800 tracking-tighter">
                  {data.Kelembapan ? data.Kelembapan.toFixed(1) : "62"}
                </span>
                <span className="text-3xl font-light text-slate-400">%</span>
              </div>
              <p className="text-xs text-slate-400 font-medium text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full mt-1">Kelembapan Stabil</p>
              
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-5 overflow-hidden">
                <div 
                  className="bg-teal-500 h-full transition-all duration-500" 
                  style={{ width: `${humidPercentage}%` }}
                />
              </div>
              <div className="flex justify-between w-full mt-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase font-mono">0%</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase font-mono">100%</span>
              </div>
            </div>

            {/* Historical inline trends box */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tren Grafik</span>
                  <p className="text-[10px] text-slate-400">Visualisasi data per 5 detik</p>
                </div>
                <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  Live
                </span>
              </div>

              {history.length < 2 ? (
                <div className="h-20 flex flex-col items-center justify-center text-slate-400">
                  <Activity className="w-4 h-4 text-slate-300 animate-pulse mb-1" />
                  <span className="text-[10px] italic">Mengumpulkan data...</span>
                </div>
              ) : (
                <div className="h-20 w-full mt-2 overflow-hidden">
                  <svg viewBox="0 0 500 100" className="w-full h-full overflow-visible">
                    <line x1="0" y1="20" x2="500" y2="20" stroke="#f1f5f9" strokeDasharray="3,3" strokeWidth="0.5" />
                    <line x1="0" y1="50" x2="500" y2="50" stroke="#f1f5f9" strokeDasharray="3,3" strokeWidth="0.5" />
                    <line x1="0" y1="80" x2="500" y2="80" stroke="#f1f5f9" strokeDasharray="3,3" strokeWidth="0.5" />

                    {/* Temp Line (Kuning) */}
                    <path
                      d={`M ${generateChartPath('Temp', 50)}`}
                      fill="none"
                      stroke="#eab308"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />

                    {/* Humid Line (Biru) */}
                    <path
                      d={`M ${generateChartPath('Humid', 100)}`}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              )}
            </div>

          </section>

          {/* Right Column (4 Relay cards + detailed voice logs display) */}
          <section className="col-span-8 flex flex-col gap-6">
            
            {/* Group switch header */}
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Active Low Relay Modules</span>
              
              <div className="flex gap-2">
                <button
                  id="btn-all-on"
                  onClick={() => setAllRelays(true)}
                  className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm rounded-lg text-[10px] font-bold text-slate-700 transition"
                >
                  Nyalakan Semua
                </button>
                <button
                  id="btn-all-off"
                  onClick={() => setAllRelays(false)}
                  className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm rounded-lg text-[10px] font-bold text-slate-700 transition"
                >
                  Matikan Semua
                </button>
              </div>
            </div>

            {/* Relays layout matching the mock grid */}
            <div className="grid grid-cols-2 gap-6 flex-1">
              
              {([1, 2, 3, 4] as const).map((num) => {
                const relayKey = `Relay${num}` as keyof IoTData;
                const isVal = data[relayKey] as boolean;
                const titleName = relayNames[relayKey];

                return (
                  <div
                    key={num}
                    id={`relay-card-${num}`}
                    onClick={() => toggleRelay(num, isVal)}
                    className={`bg-white rounded-3xl p-6 shadow-sm border flex flex-col justify-between hover:border-blue-300 transition-all cursor-pointer group ${
                      isVal ? "border-blue-400 ring-2 ring-blue-500/5 shadow" : "border-slate-200 opacity-90 hover:opacity-100"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      
                      <div className="min-w-0 flex-1 mr-2">
                        {/* Relay icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                          isVal ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-blue-200"
                        }`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2" />
                          </svg>
                        </div>

                        {/* Relay edit button triggers */}
                        <div className="flex items-center gap-1">
                          <h3 className="font-bold text-slate-700">Relay {num}</h3>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRelay(relayKey);
                              setTempEditName(titleName);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-500 rounded"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>

                        {editingRelay === relayKey ? (
                          <div className="mt-1 flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-lg" onClick={e => e.stopPropagation()}>
                            <input
                              type="text"
                              value={tempEditName}
                              onChange={(e) => setTempEditName(e.target.value)}
                              className="bg-transparent text-xs text-slate-800 p-1 focus:outline-none w-28"
                              maxLength={16}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => saveRelayName(relayKey, tempEditName)}
                              className="bg-blue-600 hover:bg-blue-700 text-white p-1 rounded"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 font-medium truncate">{titleName}</p>
                        )}
                      </div>

                      {/* Pill toggle */}
                      <div className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors shrink-0 ${
                        isVal ? "bg-blue-600 justify-end" : "bg-slate-200 justify-start"
                      }`}>
                        <div className="w-4 h-4 bg-white rounded-full"></div>
                      </div>

                    </div>

                    {/* Bottom indicator */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mt-4">
                      <span className={isVal ? "text-blue-600" : "text-slate-400"}>
                        {isVal ? "Active" : "Standby"}
                      </span>
                      <span className="text-slate-300 font-mono">Node 0{num}</span>
                    </div>

                  </div>
                );
              })}

            </div>

            {/* Bottom logs display console */}
            <div className="bg-slate-900 rounded-3xl p-6 text-white flex flex-col gap-4 shadow-lg">
              
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1 font-mono">Firebase Real-Time Auth</span>
                  <p className="text-sm font-light text-slate-300">
                    Sistem keamanan aktif untuk User: <span className="font-mono text-blue-200">{user?.email || "Unknown User"}</span>
                  </p>
                </div>
              </div>

              {/* Collapsed command trace monitor */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 max-h-[140px] overflow-y-auto space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-900 pb-1.5 mb-2">Riwayat Instruksi Asisten Suara</p>
                {voiceLogs.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-2 italic font-mono">Belum ada rekaman suara pada sesi ini.</p>
                ) : (
                  voiceLogs.map((log) => (
                    <div key={log.id} className="flex flex-col gap-1 text-[11px] border-b border-slate-900 pb-2 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                        <span>{log.timestamp}</span>
                        <span className={`font-bold ${log.success ? "text-green-500" : "text-rose-500"}`}>{log.detectedCommand}</span>
                      </div>
                      <p className="text-slate-400 italic font-mono">&quot;{log.text}&quot;</p>
                      <p className="text-slate-200 bg-slate-900 px-2 py-0.5 rounded mt-1">{log.response}</p>
                    </div>
                  ))
                )}
              </div>

            </div>

          </section>

        </div>

      </main>

    </div>
  );
}
