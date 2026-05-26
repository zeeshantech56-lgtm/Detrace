/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  UploadCloud, Lock, CheckCircle2, AlertCircle, ScanLine,
  SlidersHorizontal, Download, Cpu, RotateCcw, Eye,
  Activity, ArrowRight, UserPlus, LogIn, X, Paintbrush, Eraser, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp
} from 'firebase/firestore';
import {
  auth,
  db,
  isFirebaseConfigured,
  handleFirestoreError,
  OperationType
} from './firebase';

// --- MINIMALIST ARTISTIC LOGO ---
const DetraceLogo: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg id="detrace_logo_svg" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="40" height="40" rx="8" fill="#1A1A1A" />
    {/* Fine background target overlay */}
    <circle cx="20" cy="20" r="14" stroke="#F9F8F6" strokeWidth="0.5" strokeDasharray="2 2" strokeOpacity="0.3" />
    <circle cx="20" cy="20" r="10" stroke="#F9F8F6" strokeWidth="0.75" strokeOpacity="0.15" />
    
    {/* Outer secure shield / bounding bracket pattern */}
    <path d="M10 15V10H15" stroke="#F9F8F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M30 15V10H25" stroke="#F9F8F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 25V30H15" stroke="#F9F8F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M30 25V30H25" stroke="#F9F8F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

    {/* The core 'trace' thread, represented by an elegant segmented diagonal wave path, cut through by the orange de-trace barrier */}
    <path d="M14 26C16 22 20 22 20 20C20 18 24 18 26 14" stroke="#F9F8F6" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />

    {/* Elegant slash representing the "De-trace" (erasing trails) */}
    <line x1="12" y1="28" x2="28" y2="12" stroke="#C16E3E" strokeWidth="2.5" strokeLinecap="round" />

    {/* Target reticle dot in center */}
    <circle cx="20" cy="20" r="2" fill="#F9F8F6" />
  </svg>
);

interface Threat {
  id: string;
  label: string;
  value: string;
  risk: 'high' | 'medium' | 'low';
}

interface ScanRecord {
  scanId: string;
  fileName: string;
  originalSize: number;
  sanitizedSize: number;
  engine: string;
  createdAt: any;
}

const generateMockThreats = (): Threat[] => [
  { id: 'gps',  label: 'GPS / Location Data',      value: "37°46'39.1\"N 122°24'59.2\"W", risk: 'high'   },
  { id: 'cam',  label: 'Hardware Profile',          value: "iPhone 14 Pro / 24mm",         risk: 'medium' },
  { id: 'c2pa', label: 'AI Content Credentials',   value: "Provenance Active (Verified)",  risk: 'high'   },
  { id: 'hash', label: 'File Fingerprint Hash',     value: "8f4c2b9a...e71d",              risk: 'low'    }
];

// --- EDITORIAL AUTH MODAL ---
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'signin' | 'signup' | null;
  setType: (type: 'signin' | 'signup') => void;
  onAuthSuccess: (firebaseUser: any) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, type, setType, onAuthSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Please provide both email and physical passphrase.");
      return;
    }
    setLoading(true);
    setErrorMsg('');

    try {
      if (type === 'signup') {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (db) {
          const userRef = doc(db, 'users', credential.user.uid);
          await setDoc(userRef, {
            uid: credential.user.uid,
            email: credential.user.email,
            credits: 5,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
        onAuthSuccess(credential.user);
      } else {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        onAuthSuccess(credential.user);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An authentication boundary anomaly occurred.");
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      
      // Ensure user document exists or initialize safely in Firestore
      if (db) {
        const userRef = doc(db, 'users', credential.user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: credential.user.uid,
            email: credential.user.email,
            credits: 5,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }

      onAuthSuccess(credential.user);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Google Provider verification error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth_portal_modal" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1A1A1A]/70 backdrop-blur-sm">
      <div className="bg-[#FCFAF7] rounded-none p-10 w-full max-w-md relative shadow-2xl border border-[#1A1A1A]">
        <button id="close_auth_modal" onClick={onClose} className="absolute top-6 right-6 text-slate-500 hover:text-black">
          <X className="w-5 h-5" />
        </button>
        <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-[#C16E3E] block mb-2">
          Secure Authentication
        </span>
        <h2 className="text-3xl font-serif text-[#1A1A1A] mb-3 tracking-tight font-black italic">
          {type === 'signin' ? 'Ethereal Access' : 'Create Identity'}
        </h2>
        <p className="text-sm text-slate-600 mb-6 font-light leading-relaxed">
          {type === 'signin' 
            ? 'Sign in to confirm your identity parameters and sync historical logs.' 
            : 'Join the atelier to activate global metadata purging and remote secure logging.'}
        </p>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 mb-5 font-sans flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="leading-tight">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <input 
            type="email" 
            placeholder="Email address" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-[#FAF9F6] rounded-none border border-[#1A1A1A]/20 focus:border-[#C16E3E] outline-none transition-all font-sans text-sm text-[#1A1A1A]" 
            required
          />
          <input 
            type="password" 
            placeholder="Passphrase" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-[#FAF9F6] rounded-none border border-[#1A1A1A]/20 focus:border-[#C16E3E] outline-none transition-all font-sans text-sm text-[#1A1A1A]" 
            required
            minLength={6}
          />
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-[#1A1A1A] hover:bg-[#C16E3E] text-[#F9F8F6] rounded-none text-xs uppercase tracking-widest font-bold transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? 'Transmitting...' : type === 'signin' ? 'Verify Identity' : 'Register Member'}
          </button>
        </form>

        <div className="relative flex items-center justify-center my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#1A1A1A]/10"></div></div>
          <span className="relative bg-[#FCFAF7] px-3 text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Federated Identity</span>
        </div>

        <button 
          onClick={signInWithGoogle}
          disabled={loading}
          className="w-full py-3.5 border border-[#1A1A1A] bg-white text-[#1A1A1A] hover:bg-[#FAF9F6] rounded-none text-xs uppercase tracking-widest font-bold transition-colors flex items-center justify-center gap-2.5"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.86-3.577-7.86-8s3.53-8 7.86-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C18.155 1.141 15.39 0 12.24 0 5.58 0 0 5.37 0 12s5.58 12 12.24 12c6.96 0 11.57-4.89 11.57-11.79 0-.795-.085-1.4-.19-1.925H12.24z"/>
          </svg>
          Authorize via Google
        </button>

        <div className="mt-8 text-center border-t border-[#1A1A1A]/10 pt-6">
          <button onClick={() => setType(type === 'signin' ? 'signup' : 'signin')} className="text-xs uppercase tracking-wider font-bold text-slate-500 hover:text-[#C16E3E] transition-colors">
            {type === 'signin' ? "Don't have an identity? Register" : "Already registered? Verify signature"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── SIZE-MATCHED BLOB EXPORT ──────────────────────────────────────────────
async function exportMatchedBlob(canvas: HTMLCanvasElement, originalFile: File): Promise<Blob> {
  const mime = originalFile.type || 'image/jpeg';

  if (mime === 'image/png' || mime === 'image/webp') {
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), mime);
    });
  }

  const target = originalFile.size;
  let lo = 0.05;
  let hi = 1.0;
  let best: Blob | null = null;
  let bestDiff = Infinity;

  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const blob: Blob = await new Promise((r) => {
      canvas.toBlob((b) => r(b || new Blob()), 'image/jpeg', mid);
    });
    const diff = Math.abs(blob.size - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = blob;
    }
    const ratio = blob.size / target;
    if (ratio < 0.97) {
      lo = mid;
    } else if (ratio > 1.03) {
      hi = mid;
    } else {
      break;
    }
  }

  return best || new Blob();
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'review' | 'processing' | 'done'>('idle');
  const [cleanUrl, setCleanUrl] = useState<string | null>(null);
  const [, setCleanBlob] = useState<Blob | null>(null);
  const [stats, setStats] = useState({ old: '0', new: '0', delta: '—' });
  const [engineUsed, setEngineUsed] = useState('');
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);

  const [scanProgress, setScanProgress] = useState(0);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | null>(null);
  const [credits, setCredits] = useState(5);
  const [scanLogs, setScanLogs] = useState<ScanRecord[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [brushSize, setBrushSize] = useState(25);
  const [settings, setSettings] = useState({ stripExif: true, scrambleHash: true });

  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Fetch metrics helper
  const fetchUserMetrics = async (uid: string) => {
    if (!db) return;
    const pathForGet = `users/${uid}`;
    try {
      const uSnap = await getDoc(doc(db, 'users', uid));
      if (uSnap.exists()) {
        setCredits(uSnap.data().credits ?? 0);
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.GET, pathForGet);
    }
  };

  // Fetch scan logs helper
  const fetchScanLogs = async (uid: string) => {
    if (!db) return;
    const pathForScans = `users/${uid}/scans`;
    try {
      const q = query(collection(db, 'users', uid, 'scans'), orderBy('createdAt', 'desc'));
      const qSnap = await getDocs(q);
      const records: ScanRecord[] = [];
      qSnap.forEach((docSnap) => {
        const d = docSnap.data();
        records.push({
          scanId: docSnap.id,
          fileName: d.fileName || 'unnamed_matrix.bin',
          originalSize: d.originalSize || 0,
          sanitizedSize: d.sanitizedSize || 0,
          engine: d.engine || 'Atelier Secure',
          createdAt: d.createdAt ? d.createdAt.toDate() : new Date()
        });
      });
      setScanLogs(records);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.LIST, pathForScans);
    }
  };

  // Load and subscribe to Firebase Auth and user configuration parameters
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fireUser) => {
      if (fireUser) {
        setCurrentUser(fireUser);
        await fetchUserMetrics(fireUser.uid);
        await fetchScanLogs(fireUser.uid);
      } else {
        setCurrentUser(null);
        const storedCredits = localStorage.getItem('detrace_credits');
        setCredits(storedCredits ? parseInt(storedCredits) : 5);
        loadLocalLogs();
      }
    });
    return () => unsub();
  }, []);

  const loadLocalLogs = () => {
    try {
      const storedLogs = localStorage.getItem('detrace_scans');
      if (storedLogs) {
        setScanLogs(JSON.parse(storedLogs));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── Load file ──────────────────────────────────────────────────────────────
  const loadFile = (f: File) => {
    if (!f || !f.type.startsWith('image/')) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setStatus('scanning');
    setScanProgress(0);
    setThreats([]);
    setCleanUrl(null);
    setCleanBlob(null);

    let p = 0;
    const iv = setInterval(() => {
      p += 5;
      setScanProgress(p);
      if (p >= 100) {
        clearInterval(iv);
        setThreats(generateMockThreats());
        setStatus('review');
      }
    }, 40);
  };

  // Load image when previewUrl changes
  useEffect(() => {
    if (previewUrl) {
      const img = new Image();
      img.onload = () => {
        setLoadedImage(img);
        imgRef.current = img;
      };
      img.src = previewUrl;
    } else {
      setLoadedImage(null);
      imgRef.current = null;
    }
  }, [previewUrl]);

  // Draw image onto canvases when mounted or loaded
  useEffect(() => {
    if (status === 'review' && loadedImage) {
      [canvasRef, maskCanvasRef].forEach((ref) => {
        const canvas = ref.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = loadedImage.naturalWidth;
            canvas.height = loadedImage.naturalHeight;
            if (ref === canvasRef) {
              ctx.drawImage(loadedImage, 0, 0);
            } else {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
          }
        }
      });
    }
  }, [status, loadedImage]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (cleanUrl) URL.revokeObjectURL(cleanUrl);
    };
  }, [previewUrl, cleanUrl]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadFile(e.dataTransfer.files[0]);
    }
  }, [previewUrl]);

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (cleanUrl) URL.revokeObjectURL(cleanUrl);
    setFile(null);
    setPreviewUrl(null);
    setCleanUrl(null);
    setCleanBlob(null);
    setStatus('idle');
    setThreats([]);
    setEngineUsed('');
    imgRef.current = null;
  };

  const getCoords = (e: MouseEvent | React.MouseEvent) => {
    const c = maskCanvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    const scaleX = c.width / r.width;
    const scaleY = c.height / r.height;
    return {
      x: (e.clientX - r.left) * scaleX,
      y: (e.clientY - r.top) * scaleY,
    };
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDrawing.current || !maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d');
    const c = maskCanvasRef.current;
    if (!ctx || !c || !lastPoint.current) return;
    const { x, y } = getCoords(e);

    ctx.strokeStyle = '#C16E3E'; // Artistic Terracotta ink for drawing
    ctx.lineWidth = brushSize * (c.width / c.getBoundingClientRect().width);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPoint.current = { x, y };
  }, [brushSize]);

  const stopDrawing = useCallback(() => {
    isDrawing.current = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', stopDrawing);
  }, [onMouseMove]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext('2d');
    if (!ctx) return;
    isDrawing.current = true;
    const { x, y } = getCoords(e);
    lastPoint.current = { x, y };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stopDrawing);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stopDrawing);
    };
  }, [onMouseMove, stopDrawing]);

  const clearMask = () => {
    const c = maskCanvasRef.current;
    if (c) {
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, c.width, c.height);
      }
    }
  };

  const handleLogout = async () => {
    if (isFirebaseConfigured && auth) {
      await signOut(auth);
    }
    setCurrentUser(null);
    setCredits(5);
    localStorage.removeItem('detrace_credits');
    loadLocalLogs();
  };

  // ── Core Processing Engine ─────────────────────────────────────────────────
  const processImage = async () => {
    if (credits <= 0) {
      setAuthMode('signup');
      return;
    }
    if (!imgRef.current || !file) return;

    const srcImg = imgRef.current;
    const W = srcImg.naturalWidth;
    const H = srcImg.naturalHeight;

    const offBase = document.createElement('canvas');
    offBase.width = W;
    offBase.height = H;
    const baseCtx = offBase.getContext('2d');
    if (!baseCtx) return;
    baseCtx.drawImage(srcImg, 0, 0);

    const offMask = document.createElement('canvas');
    offMask.width = W;
    offMask.height = H;
    const maskCtx = offMask.getContext('2d');
    if (maskCtx && maskCanvasRef.current) {
      maskCtx.drawImage(maskCanvasRef.current, 0, 0);
    }

    setStatus('processing');

    await new Promise((r) => setTimeout(r, 1600));

    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(offBase, 0, 0);

    const imgData = ctx.getImageData(0, 0, W, H);
    const d = imgData.data;
    const maskImgData = maskCtx ? maskCtx.getImageData(0, 0, W, H) : null;
    const maskData = maskImgData ? maskImgData.data : null;

    if (maskData) {
      const radius = 10;
      const tmp = new Uint8ClampedArray(d);

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const idx = (y * W + x) * 4;
          if (maskData[idx + 3] > 10) {
            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            for (let dy = -radius; dy <= radius; dy++) {
              for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
                  const nidx = (ny * W + nx) * 4;
                  if (maskData[nidx + 3] <= 10) {
                    rSum += tmp[nidx];
                    gSum += tmp[nidx + 1];
                    bSum += tmp[nidx + 2];
                    count++;
                  }
                }
              }
            }
            if (count > 0) {
              d[idx] = rSum / count;
              d[idx + 1] = gSum / count;
              d[idx + 2] = bSum / count;
            } else {
              const srcIdx = Math.max(0, idx - 15 * 4);
              d[idx] = tmp[srcIdx];
              d[idx + 1] = tmp[srcIdx + 1];
              d[idx + 2] = tmp[srcIdx + 2];
            }
          }
        }
      }
    }

    if (settings.scrambleHash) {
      const STEP = 25;
      for (let i = 0; i < d.length; i += 4 * STEP) {
        d[i] = Math.max(0, Math.min(255, d[i] + (Math.floor(Math.random() * 3) - 1)));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + (Math.floor(Math.random() * 3) - 1)));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + (Math.floor(Math.random() * 3) - 1)));
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const outBlob = await exportMatchedBlob(out, file);
    const outUrl = URL.createObjectURL(outBlob);
    const fmt = (file.type || 'image/jpeg').split('/')[1].toUpperCase();

    const origKB = (file.size / 1024).toFixed(1);
    const outKB = (outBlob.size / 1024).toFixed(1);
    const pct = ((outBlob.size - file.size) / file.size) * 100;
    const delta = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';

    if (cleanUrl) URL.revokeObjectURL(cleanUrl);

    const activeEngine = `Atelier Engine V3 · size-matched ${fmt}`;
    setStats({ old: origKB, new: outKB, delta });
    setEngineUsed(activeEngine);
    setCleanBlob(outBlob);
    setCleanUrl(outUrl);

    const nextCredits = Math.max(0, credits - 1);
    setCredits(nextCredits);

    // PERSISTENCE ENGINE: Firebase Firestore vs Browser Local Sandbox
    if (currentUser) {
      if (isFirebaseConfigured && db) {
        const userPath = `users/${currentUser.uid}`;
        const newScanId = 'scan_' + Math.random().toString(36).substr(2, 9);
        try {
          // Decrement credits securely
          await updateDoc(doc(db, 'users', currentUser.uid), {
            credits: nextCredits,
            updatedAt: serverTimestamp()
          });

          // Append historical purge audit ledger row
          await setDoc(doc(db, 'users', currentUser.uid, 'scans', newScanId), {
            scanId: newScanId,
            fileName: file.name,
            originalSize: parseFloat(origKB),
            sanitizedSize: parseFloat(outKB),
            engine: activeEngine,
            createdAt: serverTimestamp()
          });

          // Sync database outputs right away
          await fetchScanLogs(currentUser.uid);
        } catch (err: any) {
          handleFirestoreError(err, OperationType.WRITE, userPath);
        }
      } else {
        // Logged into local pseudo session
        saveLocalScan(file.name, parseFloat(origKB), parseFloat(outKB), activeEngine);
      }
    } else {
      // Unauthenticated client mode
      localStorage.setItem('detrace_credits', String(nextCredits));
      saveLocalScan(file.name, parseFloat(origKB), parseFloat(outKB), activeEngine);
    }

    setStatus('done');
  };

  const saveLocalScan = (name: string, oldSz: number, newSz: number, engine: string) => {
    try {
      const records = [...scanLogs];
      const newRec: ScanRecord = {
        scanId: 'local_' + Math.random().toString(36).substr(2, 9),
        fileName: name,
        originalSize: oldSz,
        sanitizedSize: newSz,
        engine,
        createdAt: new Date()
      };
      records.unshift(newRec);
      setScanLogs(records);
      localStorage.setItem('detrace_scans', JSON.stringify(records));
    } catch (e) {
      console.error(e);
    }
  };

  const downloadName = file
    ? `detrace_${file.name.replace(/\.[^.]+$/, '')}.${file.name.split('.').pop() || 'jpg'}`
    : 'detrace_secured.jpg';

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#1A1A1A] font-sans selection:bg-[#C16E3E]/20 selection:text-[#C16E3E] flex flex-col relative overflow-x-hidden">
      <AuthModal 
        isOpen={!!authMode} 
        onClose={() => setAuthMode(null)} 
        type={authMode} 
        setType={setAuthMode}
        onAuthSuccess={(userObj) => {
          setCurrentUser(userObj);
          if (isFirebaseConfigured) {
            fetchUserMetrics(userObj.uid);
            fetchScanLogs(userObj.uid);
          }
        }}
      />

      {/* ASYMMETRIC GRID CANVAS WRAPPER */}
      <div className="flex-grow flex flex-col lg:grid lg:grid-cols-[80px_1fr] relative z-10">

        {/* LEFT DECORATIVE RAIL (AS ARTISTIC ADORNMENT) */}
        <aside className="hidden lg:flex flex-col justify-between items-center py-12 border-r border-[#1A1A1A]/10 bg-[#FAF9F6] h-full min-h-screen">
          <span className="vertical-text text-[9px] uppercase tracking-[0.35em] font-semibold opacity-40 text-[#1A1A1A]">
            STUDIO ARCHIVE — SECURE META PROTOCOL
          </span>
          <div className="w-10 h-10 border border-[#1A1A1A]/20 flex items-center justify-center rotate-45 transform bg-white hover:scale-115 transition-transform animate-pulse">
            <div className="w-4 h-4 bg-[#C16E3E] rounded-none scale-75" />
          </div>
          <span className="vertical-text text-[9px] uppercase tracking-[0.35em] font-semibold opacity-40 text-[#1A1A1A]">
            ESTABLISHED MMXXVI
          </span>
        </aside>

        {/* RIGHT WORKSPACE MODULE */}
        <div className="flex flex-col min-h-screen">

          {/* HEADER */}
          <header className="border-b border-[#1A1A1A]/10 bg-[#FCFAF7]/90 backdrop-blur-md px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3.5 group cursor-pointer" onClick={reset}>
              <DetraceLogo className="w-9 h-9 transition-transform duration-300 group-hover:rotate-90" />
              <div className="flex flex-col">
                <span className="font-serif text-[22px] tracking-tight font-black leading-none text-[#1A1A1A]">
                  Detrace
                </span>
                <span className="text-[9px] uppercase tracking-widest font-semibold text-[#C16E3E] mt-0.5">
                  Anonymity Workspace
                </span>
              </div>
            </div>

            {/* Verification badge indicating live cloud status */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isFirebaseConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isFirebaseConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
              <span className="text-[9px] uppercase tracking-widest font-bold text-slate-500">
                {isFirebaseConfigured ? 'Live Firebase Linked' : 'Sandbox Browser Environment'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {currentUser ? (
                <div id="profile_row_element" className="flex items-center gap-4">
                  <div className="hidden md:flex flex-col text-right">
                    <span className="text-[10px] font-mono text-[#1A1A1A] max-w-[200px] truncate">{currentUser.email}</span>
                    <span className="text-[8px] uppercase font-bold tracking-wider text-[#C16E3E]">Verified identity</span>
                  </div>
                  <button 
                    onClick={handleLogout} 
                    className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-slate-500 hover:text-[#C16E3E] transition-colors px-3 py-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              ) : (
                <>
                  <button 
                    onClick={() => setAuthMode('signin')} 
                    className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-[#1A1A1A] hover:text-[#C16E3E] transition-colors px-3 py-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" /> Sign In
                  </button>
                  <button 
                    onClick={() => setAuthMode('signup')} 
                    className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold bg-[#1A1A1A] hover:bg-[#C16E3E] text-[#F9F8F6] px-5 py-2.5 transition-all shadow-sm"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Join Atelier
                  </button>
                </>
              )}
            </div>
          </header>

          {/* APP BODY BLOCK */}
          <main className="flex-grow max-w-7xl mx-auto px-6 py-12 md:py-16 w-full flex flex-col justify-center gap-16">
            <AnimatePresence mode="wait">

              {/* IDLE VIEW */}
              {status === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center"
                >
                  
                  {/* Left Editorial Info Block */}
                  <div className="lg:col-span-6 flex flex-col justify-center text-left py-4">
                    <span className="text-[12px] uppercase tracking-[0.3em] font-bold text-[#C16E3E] mb-3 inline-block">
                      Featured Technology Series — V3.0
                    </span>
                    <h1 className="font-serif text-[56px] md:text-[76px] leading-[0.9] font-black italic text-[#1A1A1A] mb-6">
                      Anonymity<br />
                      <span className="not-italic text-[#1A1A1A] relative">
                        &amp; Silence.
                      </span>
                    </h1>
                    <p className="max-w-md text-[16px] leading-relaxed text-[#4A4A4A] font-light mb-8">
                      An exploration of visual weight and hidden metadata. Secure your images by cleaning internal telemetry data, painting over digital watermarks, and cryptographic hash scrambling while preserving the exact original file size.
                    </p>
                    <div className="flex flex-wrap items-center gap-6">
                      <button 
                        onClick={() => document.getElementById('upload')?.click()}
                        className="px-8 py-4.5 bg-[#1A1A1A] text-white text-[11px] uppercase tracking-widest font-bold hover:bg-[#C16E3E] transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                      >
                        Launch Inspector <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex flex-col">
                        <span className="font-serif italic text-xs text-[#C16E3E]">Target Resolution</span>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Size Match Guaranteed</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Premium Image Drop Frame */}
                  <div className="lg:col-span-6 flex justify-center">
                    <div
                      onDrop={onDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => document.getElementById('upload')?.click()}
                      className="group w-full max-w-lg aspect-[3/4] border-2 border-dashed border-[#1A1A1A]/20 hover:border-[#C16E3E] bg-[#FCFAF7] p-8 flex flex-col justify-between relative cursor-pointer transition-all duration-300 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-[#C16E3E]/5"
                    >
                      <div className="text-right">
                        <span className="text-[9px] font-mono tracking-widest uppercase opacity-45">Fig 01 — Input Matrix</span>
                      </div>

                      <div className="flex flex-col items-center justify-center py-10">
                        <div className="relative w-16 h-16 mb-6">
                          <div className="absolute inset-0 border border-[#1A1A1A]/10 group-hover:rotate-45 group-hover:border-[#C16E3E] transition-all duration-500 rounded-none bg-white flex items-center justify-center">
                            <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-[#C16E3E] transition-colors" />
                          </div>
                        </div>
                        <h3 className="font-serif italic text-2xl text-[#1A1A1A] mb-1">Drag your image onto the canvas</h3>
                        <p className="text-[11px] uppercase tracking-widest text-[#C16E3E] font-bold">or browse device</p>
                      </div>

                      <div className="border-t border-[#1A1A1A]/10 pt-4 flex justify-between items-center text-[10px] uppercase tracking-wider text-slate-400 font-semibold font-sans">
                        <span>JPEG, PNG, WEBP</span>
                        <span className="text-[#C16E3E] font-extrabold">{credits} {isFirebaseConfigured ? 'Database' : 'Local'} Credits Available</span>
                      </div>

                      <input type="file" id="upload" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={(e) => {
                        if (e.target.files && e.target.files[0]) loadFile(e.target.files[0]);
                      }} />
                    </div>
                  </div>

                </motion.div>
              )}

              {/* SCANNING */}
              {status === 'scanning' && (
                <motion.div
                  key="scanning"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="max-w-md mx-auto my-12 text-center bg-[#FAF9F6] p-10 border border-[#1A1A1A]/10"
                >
                  <div className="w-16 h-16 mx-auto mb-8 relative flex items-center justify-center">
                    <div className="absolute inset-0 border border-[#1A1A1A]/10 rounded-full" />
                    <div className="absolute inset-0 border border-t-[#C16E3E] rounded-full animate-spin" />
                    <ScanLine className="w-5 h-5 text-[#C16E3E]" />
                  </div>
                  <h2 className="font-serif italic text-2xl text-[#1A1A1A] mb-4">Deconstructing Image Matrices</h2>
                  <div className="w-full bg-[#E2E2DF] h-[2px] mb-4 overflow-hidden">
                    <div className="bg-[#C16E3E] h-full transition-all duration-75" style={{ width: `${scanProgress}%` }} />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Fig 02 · {scanProgress}% complete · probing layers
                  </p>
                </motion.div>
              )}

              {/* REVIEW / WORKSPACE PANELS */}
              {((status === 'review' || status === 'processing' || status === 'done') && file) && (
                <motion.div
                  key="workspace"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col h-full"
                >
                  {/* Subtle navigation toolbar */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 pb-6 border-b border-[#1A1A1A]/10 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#1A1A1A] flex items-center justify-center">
                        <Activity className="w-4 h-4 text-[#F9F8F6]" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#C16E3E] block leading-none mb-1">Active Atelier</span>
                        <h2 className="text-xl font-serif text-[#1A1A1A] font-black italic leading-none">{file.name}</h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] uppercase tracking-wider font-bold bg-[#FAF9F6] border border-[#1A1A1A]/10 px-3 py-1.5 text-slate-600">
                        Credits remaining: <strong className="text-[#C16E3E]">{credits}</strong>
                      </span>
                      <button onClick={reset} className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5 text-slate-500 hover:text-black transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" /> Start Over
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* LEFT PANEL: interactive image frame */}
                    <div className="lg:col-span-7 flex flex-col gap-4">
                      <div className="bg-[#E2E2DF] border border-[#1A1A1A]/30 p-4 aspect-[4/3] flex flex-col items-center justify-center relative overflow-hidden group shadow-lg min-h-[340px] md:min-h-[400px]">
                        
                        <div className="absolute top-4 left-4 z-20 px-3 py-1.5 bg-[#FAF9F6] border border-[#1A1A1A]/20 flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A] shadow-sm pointer-events-none">
                          <Eye className="w-3 h-3 text-[#C16E3E]" /> 
                          {status === 'review' ? 'Inpaint & Mask layer' : 'Isolated output'}
                        </div>

                        {status === 'review' ? (
                          <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-[#FCFAF7]">
                            {previewUrl && (
                              <>
                                <canvas ref={canvasRef} className="absolute max-w-full max-h-full object-contain pointer-events-none" />
                                <canvas ref={maskCanvasRef} className="absolute max-w-full max-h-full object-contain cursor-crosshair z-10 opacity-70"
                                  onMouseDown={startDrawing} />
                              </>
                            )}
                            <div className="absolute bottom-4 z-20 px-4 py-2 bg-[#1A1A1A] text-[#F9F8F6] text-[10px] uppercase tracking-wider font-bold pointer-events-none flex items-center gap-1.5 shadow-xl">
                              <Paintbrush className="w-3.5 h-3.5 text-[#C16E3E]" /> 
                              Paint over watermarks to remove
                            </div>
                          </div>
                        ) : (
                          <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-[#FCFAF7]">
                            {cleanUrl && <img src={cleanUrl} alt="Output Matrix" className="max-w-full max-h-full object-contain" />}
                          </div>
                        )}

                        {status === 'review' && (
                          <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                            <div className="w-full h-[1px] bg-[#C16E3E] shadow-[0_0_10px_#C16E3E] animate-scan-line" />
                          </div>
                        )}
                      </div>

                      {/* Brush dimension styling */}
                      {status === 'review' && (
                        <div className="bg-[#FAF9F6] border border-[#1A1A1A]/10 p-5 shadow-sm flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                              <Paintbrush className="w-3.5 h-3.5 text-[#C16E3E]" />
                              Watermark mask tool diameter
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-800 bg-[#E2E2DF] px-2 py-0.5">
                              {brushSize}px
                            </span>
                          </div>
                          <div className="flex items-center gap-6">
                            <input
                              type="range"
                              min="5"
                              max="80"
                              value={brushSize}
                              onChange={(e) => setBrushSize(parseInt(e.target.value))}
                              className="flex-grow accent-[#C16E3E] cursor-pointer h-1 bg-[#E2E2DF]"
                            />
                            <button
                              onClick={clearMask}
                              className="flex items-center gap-1 px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-slate-600 bg-white hover:bg-slate-50 transition-all rounded-none border border-[#1A1A1A]/20"
                            >
                              <Eraser className="w-3.5 h-3.5" /> Clear Ink
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* RIGHT PANEL: settings configs or download triggers */}
                    <div className="lg:col-span-5 flex flex-col h-full gap-5">
                      
                      {/* REVIEW PARAMS */}
                      {status === 'review' && (
                        <div className="bg-[#FAF9F6] border border-[#1A1A1A]/15 p-6 shadow-md flex-grow flex flex-col">
                          <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 border border-[#1A1A1A]/20 rotate-45 transform bg-white flex items-center justify-center">
                                <AlertCircle className="w-3.5 h-3.5 text-[#C16E3E] -rotate-45" />
                              </div>
                              <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A] tracking-tight">Anomalies Located</h3>
                            </div>
                            <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-500 font-bold px-2 py-0.5 tracking-wider uppercase">
                              4 Items
                            </span>
                          </div>

                          <div className="space-y-2 mb-6">
                            {threats.map((t) => (
                              <div key={t.id} className="p-3 border border-[#1A1A1A]/5 bg-white">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[12px] font-bold text-[#1A1A1A] tracking-tight">{t.label}</span>
                                  <span className="text-[8px] px-1.5 py-0.5 bg-rose-50 text-rose-700 font-bold uppercase rounded tracking-widest border border-rose-100">
                                    {t.risk}
                                  </span>
                                </div>
                                <span className="text-[11px] font-mono text-slate-500 break-all leading-tight">{t.value}</span>
                              </div>
                            ))}
                          </div>

                          {/* Control parameters */}
                          <div className="border-t border-[#1A1A1A]/10 pt-5 mb-6 flex flex-col gap-4">
                            <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                              <SlidersHorizontal className="w-3 h-3 text-[#C16E3E]" /> Sanitization parameters
                            </h4>
                            
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex flex-col">
                                <span className="text-[12px] font-bold text-[#1A1A1A]">Strip Exif Block Metadata</span>
                                <span className="text-[10px] text-slate-400 leading-none mt-0.5">Clears cameras, timing & locations</span>
                              </div>
                              <button
                                aria-label="Strip Exif"
                                onClick={() => setSettings(s => ({ ...s, stripExif: !s.stripExif }))}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${settings.stripExif ? 'bg-[#C16E3E]' : 'bg-slate-300'}`}
                              >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settings.stripExif ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                              </button>
                            </div>

                            <div className="flex items-center justify-between text-sm pt-3 border-t border-[#1A1A1A]/5">
                              <div className="flex flex-col">
                                <span className="text-[12px] font-bold text-[#1A1A1A]">Scramble File Hash noise</span>
                                <span className="text-[10px] text-slate-400 leading-none mt-0.5">Clears digital watermarks</span>
                              </div>
                              <button
                                aria-label="Scramble Hash"
                                onClick={() => setSettings(s => ({ ...s, scrambleHash: !s.scrambleHash }))}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${settings.scrambleHash ? 'bg-[#C16E3E]' : 'bg-slate-300'}`}
                              >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settings.scrambleHash ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                              </button>
                            </div>
                          </div>

                          <button
                            onClick={processImage}
                            disabled={false}
                            className="w-full py-4.5 bg-[#1A1A1A] hover:bg-[#C16E3E] text-white text-[11px] uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5" /> Execute metadata purge
                          </button>
                        </div>
                      )}

                      {/* DONE VIEW */}
                      {status === 'done' && (
                        <div className="bg-[#FAF9F6] border border-[#1A1A1A]/15 p-6 shadow-md flex-grow flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-5">
                              <div className="w-6 h-6 border border-[#1A1A1A]/20 rotate-45 transform bg-white flex items-center justify-center">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 -rotate-45" />
                              </div>
                              <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A] tracking-tight">Purge Successful</h3>
                            </div>

                            <div className="space-y-4 mb-6">
                              <div className="flex justify-between items-center py-2 border-b border-[#1A1A1A]/5">
                                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Original Size</span>
                                <span className="text-sm font-mono font-bold text-[#1A1A1A]">{stats.old} KB</span>
                              </div>
                              <div className="flex justify-between items-center py-2 border-b border-[#1A1A1A]/5">
                                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Sanitized Size</span>
                                <span className="text-sm font-mono font-bold text-[#1A1A1A]">{stats.new} KB</span>
                              </div>
                              <div className="flex justify-between items-center py-2 border-b border-[#1A1A1A]/5">
                                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Size Delta</span>
                                <span className="text-sm font-mono font-bold text-[#C16E3E]">{stats.delta}</span>
                              </div>
                              <div className="flex flex-col gap-1.5 py-2">
                                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Purge Engine</span>
                                <span className="text-xs font-mono text-slate-600 break-all leading-tight">{engineUsed}</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <a
                              href={cleanUrl || '#'}
                              download={downloadName}
                              className="w-full py-4.5 bg-[#C16E3E] hover:bg-[#1A1A1A] text-white text-[11px] uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                              <Download className="w-3.5 h-3.5" /> Download Secured Output
                            </a>
                            <button
                              onClick={reset}
                              className="w-full py-3 border border-[#1A1A1A]/20 bg-white hover:bg-[#FAF9F6] text-[#1A1A1A] text-[10px] uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Secure Another Image
                            </button>
                          </div>
                        </div>
                      )}

                      {/* PROCESSING STATE */}
                      {status === 'processing' && (
                        <div className="bg-[#FAF9F6] border border-[#1A1A1A]/15 p-6 shadow-md flex-grow flex flex-col justify-center items-center py-16">
                          <Cpu className="w-10 h-10 text-[#C16E3E] animate-pulse mb-4" />
                          <h3 className="font-serif italic font-bold text-lg text-[#1A1A1A] mb-2">Executing Purge</h3>
                          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Running cryptographical scrambling...</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* HISTORY LEDGER SECTION */}
                  {scanLogs.length > 0 && (
                    <div className="mt-16 pt-10 border-t border-[#1A1A1A]/10">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 border border-[#1A1A1A]/20 rotate-45 transform bg-white flex items-center justify-center">
                            <Lock className="w-3.5 h-3.5 text-[#C16E3E] -rotate-45" />
                          </div>
                          <h3 className="font-serif italic font-bold text-xl text-[#1A1A1A]">Historical Audit Ledger</h3>
                        </div>
                        <span className="text-[9px] uppercase tracking-widest font-bold text-slate-400">
                          {scanLogs.length} Scans Archived
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-[#1A1A1A]/20 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                              <th className="py-4 font-bold">Scan ID</th>
                              <th className="py-4 font-bold">Filename</th>
                              <th className="py-4 font-bold">Original</th>
                              <th className="py-4 font-bold">Sanitized</th>
                              <th className="py-4 font-bold">Sanitization Engine</th>
                              <th className="py-4 font-bold text-right">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1A1A1A]/5 text-sm font-sans text-slate-700">
                            {scanLogs.map((log) => (
                              <tr key={log.scanId} className="hover:bg-[#FAF9F6]">
                                <td className="py-4 font-mono text-[11px] font-bold text-slate-500">{log.scanId}</td>
                                <td className="py-4 font-medium text-[#1A1A1A]">{log.fileName}</td>
                                <td className="py-4 font-mono text-xs">{log.originalSize} KB</td>
                                <td className="py-4 font-mono text-xs">{log.sanitizedSize} KB</td>
                                <td className="py-4 text-xs italic text-slate-500">{log.engine}</td>
                                <td className="py-4 text-right font-mono text-xs text-slate-550">
                                  {new Date(log.createdAt).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </motion.div>
              )}

            </AnimatePresence>
          </main>

          {/* FOOTER */}
          <footer className="border-t border-[#1A1A1A]/10 bg-[#FCFAF7] px-8 py-8 mt-auto">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <DetraceLogo className="w-7 h-7" />
                <span className="text-[11px] uppercase tracking-widest font-bold text-slate-500">
                  © MMXXVI Detrace Lab · All rights reserved.
                </span>
              </div>
              <div className="flex gap-6 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                <a href="#" className="hover:text-[#C16E3E] transition-colors">Workspace Parameters</a>
                <a href="#" className="hover:text-[#C16E3E] transition-colors">Privacy Protocol</a>
                <a href="#" className="hover:text-[#C16E3E] transition-colors">Terms of Atelier</a>
              </div>
            </div>
          </footer>

        </div>
      </div>
    </div>
  );
}
