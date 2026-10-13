import React, { useState, useEffect } from 'react';
import { ScreenType } from '../../types';
import { INITIAL_SETUP_STEPS } from '../../data/initialData';
import { ArrowLeft, Check, Terminal, Play, Pause, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { Alert } from '../common/Alert';

interface EnvironmentSetupScreenProps {
  onBack: () => void;
  onNavigate: (screen: ScreenType) => void;
}

export const EnvironmentSetupScreen: React.FC<EnvironmentSetupScreenProps> = ({
  onBack,
  onNavigate,
}) => {
  const [steps, setSteps] = useState(INITIAL_SETUP_STEPS);
  const [activeStepIndex, setActiveStepIndex] = useState(2); // Step 3 (0-indexed 2)
  const [progress, setProgress] = useState(68);
  const [isPaused, setIsPaused] = useState(false);
  const [isLogsExpanded, setIsLogsExpanded] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [logs, setLogs] = useState([
    '08:42:13 Compiling aya-obj v0.1.0 (clang-17 backend)',
    '08:42:14 Generating endian-native BTF relocation tables',
    '08:42:15 Binding tracepoint: sys_enter_execve → TC filter',
    '08:42:16 Linking kernel BPF object via LLVM-17 linker',
    '>> cargo build --target bpfel-unknown-none',
  ]);

  // Simulate progress when not paused
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Complete step 3 and advance to step 4
          setSteps((s) =>
            s.map((step, idx) =>
              idx === 2 ? { ...step, status: 'completed' as const } : idx === 3 ? { ...step, status: 'active' as const } : step
            )
          );
          setActiveStepIndex(3);
          setLogs((l) => [
            ...l,
            '08:42:18 BPF verifier bytecode verification PASSED (1,024 instructions verified)',
            '>> Pipeline execution completed successfully.',
          ]);
          setFeedback('All 4 environment setup pipeline stages completed & verified!');
          clearInterval(interval);
          return 100;
        }
        return prev + 4;
      });
    }, 600);

    return () => clearInterval(interval);
  }, [isPaused]);

  const togglePause = () => {
    setIsPaused(!isPaused);
    setFeedback(isPaused ? 'Pipeline resumed.' : 'Pipeline paused by operator.');
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleResetPipeline = () => {
    setSteps(INITIAL_SETUP_STEPS);
    setActiveStepIndex(2);
    setProgress(35);
    setIsPaused(false);
    setFeedback('Pipeline restarted from Step 1.');
    setTimeout(() => setFeedback(null), 2500);
  };

  return (
    <div className="flex flex-col w-full px-4 pt-2 pb-28 max-w-lg mx-auto space-y-4">
      {/* Top Header (Matches Image 14.jpeg) */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#faf8f5] hover:bg-[#24211e] active:scale-95 transition-all"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-[18px] font-bold text-[#faf8f5] truncate font-display">
            Environment Setup
          </h1>
          <p className="text-[11px] font-mono-code text-[#ffb693] truncate">
            HyperStream Probe · Rust aya-rs
          </p>
        </div>

        <span className="px-2.5 py-1 rounded-full text-[11px] font-mono-code font-bold bg-[#ff6b00]/20 text-[#ff6b00] border border-[#ff6b00]/30">
          ● {activeStepIndex + 1} of 4
        </span>
      </div>

      {feedback && (
        <Alert
          type="info"
          message={feedback}
          onDismiss={() => setFeedback(null)}
        />
      )}

      {/* Target Badge Card (Matches Image 14.jpeg) */}
      <div className="rounded-2xl bg-[#1d1b19] border border-[#292524] p-3.5 space-y-1 shadow-md">
        <div className="flex items-center justify-between text-[11px] font-mono-code text-[#78716c]">
          <div className="flex items-center gap-2">
            <span>aarch64-ebpf</span>
            <span>·</span>
            <span>Rust 1.75 nightly</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono-code bg-[#ff6b00]/15 text-[#ffb693] font-bold">
            Active Target
          </span>
        </div>
        <h2 className="text-[16px] font-bold text-[#faf8f5] font-display">
          HyperStream Probe
        </h2>
      </div>

      {/* Stepper Pipeline (Pattern 6 - Matches Image 14.jpeg) */}
      <div className="rounded-2xl bg-[#1d1b19] border border-[#292524] p-4.5 space-y-4 shadow-md">
        <div className="flex items-center justify-between text-[11px] font-mono-code">
          <span className="text-[#ffb693] font-bold">PIPELINE STEPS</span>
          <span className="text-[#78716c]">Step {activeStepIndex + 1} of 4</span>
        </div>

        {/* Step Nodes */}
        <div className="space-y-4 relative">
          {/* Vertical connecting line */}
          <div className="absolute left-3.5 top-3 bottom-3 w-0.5 bg-[#292524]" />

          {/* STEP 1: Check runtime */}
          <div className="flex items-start gap-3 relative z-10">
            <div className="w-7 h-7 rounded-full bg-[#ff6b00] text-[#121110] flex items-center justify-center flex-shrink-0 shadow-[0_0_10px_rgba(255,107,0,0.3)]">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div className="flex-1 space-y-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-[#faf8f5]">Check runtime</h3>
                <span className="text-[11px] font-mono-code text-[#78716c]">240ms</span>
              </div>
              <p className="text-[12px] text-[#a8a29e] leading-snug">
                Host kernel 6.8.0-ok with BTF enabled. LLVM 17 detected
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="px-2 py-0.5 rounded bg-[#121110] text-[10px] font-mono-code text-[#e2bfb0] border border-[#292524]">
                  btf: enabled
                </span>
                <span className="px-2 py-0.5 rounded bg-[#121110] text-[10px] font-mono-code text-[#e2bfb0] border border-[#292524]">
                  clang 17.0.6
                </span>
              </div>
            </div>
          </div>

          {/* STEP 2: Prepare environment */}
          <div className="flex items-start gap-3 relative z-10">
            <div className="w-7 h-7 rounded-full bg-[#ff6b00] text-[#121110] flex items-center justify-center flex-shrink-0 shadow-[0_0_10px_rgba(255,107,0,0.3)]">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div className="flex-1 space-y-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-[#faf8f5]">Prepare environment</h3>
                <span className="text-[11px] font-mono-code text-[#78716c]">1.18s</span>
              </div>
              <p className="text-[12px] text-[#a8a29e] leading-snug">
                Isolated Cargo target directory initialized at /dev/shm/hyperstream
              </p>
              <div className="pt-1">
                <span className="px-2 py-0.5 rounded bg-[#121110] text-[10px] font-mono-code text-[#e2bfb0] border border-[#292524]">
                  bpfel-unknown-none target ready
                </span>
              </div>
            </div>
          </div>

          {/* STEP 3: Install libraries (Active) */}
          <div className="flex items-start gap-3 relative z-10">
            <div className="w-7 h-7 rounded-full bg-[#121110] border-2 border-[#ff6b00] flex items-center justify-center flex-shrink-0 shadow-[0_0_14px_rgba(255,107,0,0.4)]">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff6b00] animate-beacon" />
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff6b00]" />
                  <h3 className="text-[13px] font-bold text-[#faf8f5]">Install libraries</h3>
                </div>
                <span className="text-[11px] font-mono-code text-[#ffb693] font-bold">
                  {progress}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="p-3 rounded-xl bg-[#121110] border border-[#ff6b00]/30 space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-mono-code text-[#ffbd58]">
                  <RefreshCw className={`w-3.5 h-3.5 ${!isPaused ? 'animate-spin' : ''}`} />
                  <span className="truncate">Compiling aya-bpf v0.1.30 &amp; tokio...</span>
                </div>
                <div className="h-2 bg-[#24211e] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#ff6b00] to-[#ffbd58] rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(255,107,0,0.6)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono-code text-[#78716c]">
                  <span>cargo bpf-probe --target=x86_64</span>
                  <span className="text-[#ffb693] font-bold">3.4 MB/s</span>
                </div>
                <span className="text-[10px] font-mono-code text-[#a8a29e] block">
                  Artifact: libbpf-rs-0.23.0 linking
                </span>
              </div>
            </div>
          </div>

          {/* STEP 4: Verify setup (Pending) */}
          <div className="flex items-start gap-3 relative z-10 opacity-70">
            <div className="w-7 h-7 rounded-full bg-[#121110] border-2 border-[#78716c] flex items-center justify-center flex-shrink-0" />
            <div className="flex-1 space-y-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-[#faf8f5]">Verify setup</h3>
                <span className="text-[11px] font-mono-code text-[#78716c]">Pending</span>
              </div>
              <p className="text-[12px] text-[#78716c] leading-snug">
                Awaiting BPF verifier smoke test &amp; ring buffer map validation
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Terminal Logs Drawer (Matches Image 14.jpeg) */}
      <div className="rounded-2xl bg-[#1d1b19] border border-[#292524] overflow-hidden shadow-md">
        <button
          onClick={() => setIsLogsExpanded(!isLogsExpanded)}
          className="w-full px-4 py-3 bg-[#211f1d] border-b border-[#292524] flex items-center justify-between text-[12px] font-mono-code text-[#faf8f5] hover:bg-[#2c2927] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#ff6b00]" />
            <span className="font-bold">Terminal Logs</span>
          </div>
          <div className="flex items-center gap-2 text-[#78716c]">
            <span className="text-[11px]">stdout.trace</span>
            {isLogsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </button>

        <div className={`p-3.5 bg-[#121110] font-mono-code text-[11px] text-[#e2bfb0] space-y-1 overflow-x-auto leading-relaxed ${isLogsExpanded ? 'max-h-72' : 'max-h-36'} overflow-y-auto`}>
          {logs.map((log, index) => (
            <div
              key={index}
              className={log.startsWith('>>') ? 'text-[#ff6b00] font-bold pt-1' : ''}
            >
              {log}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Action Controls (Matches Image 14.jpeg) */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <button
          onClick={togglePause}
          className="h-11 rounded-xl bg-[#24211e] hover:bg-[#2c2927] border border-[#292524] text-[#faf8f5] font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
        >
          {isPaused ? <Play className="w-4 h-4 text-[#ffb693]" /> : <Pause className="w-4 h-4 text-[#ff6b00]" />}
          <span>{isPaused ? 'Resume' : 'Pause'}</span>
        </button>

        <button
          onClick={() => setIsLogsExpanded(!isLogsExpanded)}
          className="h-11 rounded-xl bg-[#ff6b00] hover:bg-[#ff7a1a] text-[#121110] font-bold text-[13px] flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(255,107,0,0.3)] active:scale-95 transition-all cursor-pointer"
        >
          <Terminal className="w-4 h-4" />
          <span>{isLogsExpanded ? 'Hide Logs' : 'View Logs'}</span>
        </button>
      </div>

      <button
        onClick={handleResetPipeline}
        className="w-full text-center text-[11px] font-mono-code text-[#78716c] hover:text-[#a8a29e] py-1 transition-colors"
      >
        Restart Toolchain Setup Pipeline
      </button>
    </div>
  );
};
