import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import { Cpu } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-teal-500/20 border-t-teal-400 rounded-full animate-spin"></div>
          <Cpu className="w-6 h-6 text-teal-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <p className="mt-4 text-xs font-mono uppercase tracking-widest text-slate-500">
          Memuat Sistem Firebase...
        </p>
      </div>
    );
  }

  return (
    <>
      {user ? <Dashboard /> : <Login />}
    </>
  );
}

