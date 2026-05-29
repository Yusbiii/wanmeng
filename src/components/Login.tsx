import React, { useState } from "react";
import { auth, googleProvider } from "../firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup 
} from "firebase/auth";
import { motion } from "motion/react";
import { LogIn, UserPlus, AlertCircle, Cpu, Cloud } from "lucide-react";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Translate firebase error codes to Indonesian
  const getErrorMessage = (code: string) => {
    switch (code) {
      case "auth/invalid-email":
        return "Format email tidak valid.";
      case "auth/user-disabled":
        return "Pengguna ini telah dinonaktifkan.";
      case "auth/user-not-found":
        return "Pengguna tidak ditemukan. Silakan mendaftar terlebih dahulu.";
      case "auth/wrong-password":
        return "Password salah. Masukkan password dengan benar.";
      case "auth/email-already-in-use":
        return "Email sudah terdaftar. Silakan masuk menggunakan email ini.";
      case "auth/weak-password":
        return "Password terlalu lemah. Minimal 6 karakter.";
      case "auth/invalid-credential":
        return "Kredensial salah atau tidak valid.";
      default:
        return "Terjadi kesalahan. Silakan coba kembali.";
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Silakan isi semua kolom email dan password.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      setError(getErrorMessage(err?.code || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error(err);
      if (err?.code !== "auth/popup-closed-by-user") {
        setError(getErrorMessage(err?.code || ""));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-screen" className="min-h-screen bg-[#F1F5F9] text-slate-900 flex flex-col items-center justify-center p-6 selection:bg-blue-600 selection:text-white">
      
      {/* Decorative center ambient background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_60%,transparent_100%)] pointer-events-none" />

      {/* Auth visual card container */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl p-8 relative z-10"
      >
        {/* Branding header block */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/10 mb-4 text-white">
            <Cpu className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 text-center font-sans">
            RIDWAN IoT UNIT
          </h1>
          <p className="text-slate-400 text-xs text-center mt-1 font-medium tracking-wide uppercase">
            Sistem Sinkronisasi Firebase Real-time
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 mb-6">
          <button
            type="button"
            id="tab-login"
            onClick={() => { setIsRegister(false); setError(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
              !isRegister 
                ? "bg-white text-blue-600 shadow-sm border border-slate-200" 
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In
          </button>
          
          <button
            type="button"
            id="tab-register"
            onClick={() => { setIsRegister(true); setError(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
              isRegister 
                ? "bg-white text-blue-600 shadow-sm border border-slate-200" 
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Sign Up
          </button>
        </div>

        {/* Custom state warning notifications */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Forms elements */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              id="input-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Secure Password
            </label>
            <input
              id="input-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              required
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          <button
            id="btn-submit-auth"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/10 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span className="w-4.5 h-4.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : isRegister ? (
              <>
                <UserPlus className="w-4 h-4" />
                Registrasi Akun Baru
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Masuk ke Dashboard
              </>
            )}
          </button>

        </form>

        {/* Separator tag */}
        <div className="relative my-7 flex items-center justify-center">
          <div className="border-t border-slate-100 w-full absolute"></div>
          <span className="bg-white border border-slate-100 px-3 py-0.5 text-[9px] text-slate-400 uppercase tracking-widest relative z-10 rounded-full font-mono">
            atau gunakan
          </span>
        </div>

        {/* Google OAuth trigger */}
        <button
          id="btn-google-auth"
          type="button"
          disabled={loading}
          onClick={handleGoogleAuth}
          className="w-full py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl shadow-sm transition active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer"
        >
          {/* Styled Google G letter */}
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 15.01 1 12 1 7.24 1 3.22 3.73 1.34 7.74l3.87 3C6.12 7.74 8.78 5.04 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.45 12.3c0-.82-.07-1.6-.21-2.3H12v4.4h6.43c-.28 1.44-1.09 2.66-2.32 3.48l3.6 2.8c2.1-1.94 3.74-4.8 3.74-8.38z"
            />
            <path
              fill="#FBBC05"
              d="M5.21 14.76c-.23-.69-.36-1.43-.36-2.2s.13-1.51.36-2.2l-3.87-3C.48 9.17 0 10.53 0 12s.48 2.83 1.34 4.64l3.87-3z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.6-2.8c-1.1.74-2.52 1.17-4.36 1.17-3.22 0-5.88-2.7-6.79-5.7l-3.87 3C3.22 20.27 7.24 23 12 23z"
            />
          </svg>
          <span>Sign In with Google</span>
        </button>

        {/* Sync security tag */}
        <div className="mt-8 text-center text-[10px] text-slate-400 flex items-center justify-center gap-1">
          <Cloud className="w-3.5 h-3.5 text-blue-500" />
          <span>Real-time Secure Sync via Google Cloud Systems</span>
        </div>

      </motion.div>
    </div>
  );
}
