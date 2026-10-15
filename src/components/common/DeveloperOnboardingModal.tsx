import React, { useState, useEffect } from 'react';
import { ScreenType } from '../../types';
import {
  HelpCircle,
  CheckCircle2,
  Circle,
  ArrowRight,
  Lightbulb,
  Database,
  Cpu,
  FolderGit2,
  ShieldCheck,
  ChevronRight,
  X,
  ExternalLink,
  Laptop,
  Check,
} from 'lucide-react';
import { HoldToConfirm } from './HoldToConfirm';
import { Alert } from './Alert';

interface DeveloperOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (screen: ScreenType) => void;
}

interface OnboardingStep {
  id: string;
  title: string;
  shortDesc: string;
  targetScreen: ScreenType;
  actionLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  details: string[];
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'step-arch',
    title: '1. Architecture & Laptop Bridge',
    shortDesc: 'Understand the dual-tier Android & laptop bridge architecture',
    targetScreen: 'dashboard',
    actionLabel: 'Explore Dashboard',
    icon: Laptop,
    details: [
      'Native Android app (Kotlin / Jetpack Compose) handles instant mobile idea capture.',
      'Laptop Bridge (FastAPI daemon on port 8000) syncs with your local SQLite database.',
      'Zero unauthenticated cloud egress; all private codebase mutations stay on your machine.',
    ],
  },
  {
    id: 'step-capture',
    title: '2. Local Idea Capture & Vault',
    shortDesc: 'Ideas are saved instantly in browser IndexedDB (100% offline-ready)',
    targetScreen: 'capture',
    actionLabel: 'Try Idea Capture',
    icon: Database,
    details: [
      'Every spark is stored locally into IndexedDB with client-side AES-256 metadata.',
      'Works completely offline without network or bridge connectivity.',
      'Automatic two-way delta sync to your laptop SQLite vault once connected.',
    ],
  },
  {
    id: 'step-vault',
    title: '3. Idea Vault & Categorization',
    shortDesc: 'Organize, search, and manage sparks across domains and stacks',
    targetScreen: 'vault',
    actionLabel: 'Open Idea Vault',
    icon: Lightbulb,
    details: [
      'Categorize ideas into Architecture, Frontend, Backend, Tooling, and Performance.',
      'Full-text instant client-side search with category chips and tag filters.',
      'Seamless markdown exports and instant copy to your clipboard.',
    ],
  },
  {
    id: 'step-repos',
    title: '4. Connected Repos & Diagnostics',
    shortDesc: 'Connect GitHub or local codebases with one-click live diagnostics',
    targetScreen: 'project',
    actionLabel: 'View Repositories',
    icon: FolderGit2,
    details: [
      'Link remote GitHub repositories or local workspace paths with SSRF protection.',
      'One-click live connection diagnostics probe git branch reachability and latency.',
      'Inspect line-by-line file diffs with hunk boundaries and addition/deletion counters.',
    ],
  },
  {
    id: 'step-approval',
    title: '5. Hold-to-Confirm Approval Gate',
    shortDesc: 'Never apply unexpected changes without a 1.5s tactile hold gate',
    targetScreen: 'project',
    actionLabel: 'Inspect Approval Gate',
    icon: ShieldCheck,
    details: [
      'All consequential repository modifications require explicit 1.5-second hold confirmation.',
      'Radial progress ring animation with haptic feedback on mobile touchscreens.',
      'Server-side gate strictly rejects unconfirmed requests with HTTP 403 Forbidden.',
    ],
  },
];

export const DeveloperOnboardingModal: React.FC<DeveloperOnboardingModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('idea_beacon_completed_onboarding_steps');
      return saved ? JSON.parse(saved) : ['step-arch'];
    } catch {
      return ['step-arch'];
    }
  });

  const [dontShowAgain, setDontShowAgain] = useState(() => {
    return localStorage.getItem('idea_beacon_onboarding_dismissed') === 'true';
  });

  const [gateTested, setGateTested] = useState(false);

  // Close on Escape key (Standard Google App modal behavior)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    try {
      localStorage.setItem('idea_beacon_completed_onboarding_steps', JSON.stringify(completedSteps));
    } catch {
      // storage quota or incognito fallback
    }
  }, [completedSteps]);

  const toggleStepCompleted = (stepId: string) => {
    setCompletedSteps((prev) =>
      prev.includes(stepId) ? prev.filter((id) => id !== stepId) : [...prev, stepId]
    );
  };

  const handleDontShowChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setDontShowAgain(checked);
    if (checked) {
      localStorage.setItem('idea_beacon_onboarding_dismissed', 'true');
    } else {
      localStorage.removeItem('idea_beacon_onboarding_dismissed');
    }
  };

  if (!isOpen) return null;

  const currentStep = ONBOARDING_STEPS[activeStepIndex];
  const isCurrentCompleted = completedSteps.includes(currentStep.id);
  const progressPercent = Math.round((completedSteps.length / ONBOARDING_STEPS.length) * 100);

  const handleNavigateToFeature = (screen: ScreenType, stepId: string) => {
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps((prev) => [...prev, stepId]);
    }
    onClose();
    onNavigate(screen);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl bg-[#141210] border border-[#292524] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Google Apps Standard Header: Quick Start Guide */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#292524] bg-[#1a1816]/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#ff6b00]/15 border border-[#ff6b00]/30 flex items-center justify-center text-[#ff6b00] shadow-sm">
              <HelpCircle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#faf8f5] font-display">
                  Quick Start Guide
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono-code font-bold bg-[#ff6b00]/20 text-[#ff6b00] border border-[#ff6b00]/30">
                  5 STEPS
                </span>
              </div>
              <p className="text-[11px] text-[#a8a29e] font-mono-code">
                Google apps style quickstart: local vault, Gemini 3.8 AI &amp; git workflow
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#a8a29e] hover:text-[#faf8f5] hover:bg-[#24211e] transition-colors cursor-pointer"
            aria-label="Close walkthrough"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Strip */}
        <div className="px-6 py-2.5 bg-[#171513] border-b border-[#24211e] flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between text-[11px] font-mono-code text-[#a8a29e] mb-1.5">
              <span>Walkthrough Progress</span>
              <span className="text-[#ff6b00] font-bold">{completedSteps.length} / {ONBOARDING_STEPS.length} Completed ({progressPercent}%)</span>
            </div>
            <div className="w-full h-1.5 bg-[#24211e] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#ff6b00] to-[#ff8533] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Modal Main Body: Split View with Step Navigator and Content Area */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 min-h-0">
          {/* Left Step Navigator (5 cols) */}
          <div className="md:col-span-5 p-4 border-b md:border-b-0 md:border-r border-[#24211e] bg-[#171513]/50 space-y-1.5">
            <span className="text-[10px] font-mono-code font-bold text-[#78716c] uppercase tracking-wider px-2">
              Workflow Phases
            </span>
            {ONBOARDING_STEPS.map((step, idx) => {
              const isSelected = activeStepIndex === idx;
              const isDone = completedSteps.includes(step.id);
              const StepIcon = step.icon;

              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStepIndex(idx)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl flex items-start gap-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#271e16] border border-[#ff6b00]/50 shadow-sm text-[#faf8f5]'
                      : 'hover:bg-[#1e1c1a] border border-transparent text-[#a8a29e]'
                  }`}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStepCompleted(step.id);
                    }}
                    className="mt-0.5 cursor-pointer text-[#78716c] hover:text-[#ff6b00] transition-colors"
                    title={isDone ? 'Mark as incomplete' : 'Mark as complete'}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-[#ff6b00]" />
                    ) : (
                      <Circle className="w-4 h-4 text-[#78716c]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <StepIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#ff6b00]' : 'text-[#a8a29e]'}`} />
                      <span className={`text-xs font-semibold truncate ${isSelected ? 'text-[#ffb693]' : ''}`}>
                        {step.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#78716c] truncate mt-0.5">
                      {step.shortDesc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Step Detail View (7 cols) */}
          <div className="md:col-span-7 p-6 flex flex-col justify-between space-y-5 bg-[#141210]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono-code text-[#ff6b00] font-bold uppercase tracking-wider">
                  Phase {activeStepIndex + 1} of {ONBOARDING_STEPS.length}
                </span>
                <button
                  onClick={() => toggleStepCompleted(currentStep.id)}
                  className="flex items-center gap-1.5 text-[11px] font-mono-code text-[#a8a29e] hover:text-[#faf8f5] transition-colors cursor-pointer"
                >
                  {isCurrentCompleted ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#ff6b00]" />
                      <span>Completed</span>
                    </>
                  ) : (
                    <>
                      <Circle className="w-3.5 h-3.5" />
                      <span>Mark complete</span>
                    </>
                  )}
                </button>
              </div>

              <div>
                <h3 className="text-lg font-bold text-[#faf8f5] font-display">
                  {currentStep.title}
                </h3>
                <p className="text-xs text-[#a8a29e] mt-1 leading-relaxed">
                  {currentStep.shortDesc}
                </p>
              </div>

              {/* Concrete details list */}
              <div className="space-y-2 pt-2">
                {currentStep.details.map((detail, dIdx) => (
                  <div
                    key={dIdx}
                    className="p-3 rounded-xl bg-[#1b1917] border border-[#292524] flex items-start gap-2.5 text-xs text-[#d6d3d1] leading-relaxed"
                  >
                    <Check className="w-3.5 h-3.5 text-[#ff6b00] flex-shrink-0 mt-0.5" />
                    <span>{detail}</span>
                  </div>
                ))}
              </div>

              {/* Interactive Step 5 Demo: Try the Hold-To-Confirm gate */}
              {currentStep.id === 'step-approval' && (
                <div className="p-3.5 rounded-xl bg-[#1f1a16] border border-[#ff6b00]/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono-code text-[#ff6b00] font-bold">
                      Interactive Practice Gate
                    </span>
                    <span className="text-[10px] text-[#a8a29e] font-mono-code">1.5s press required</span>
                  </div>
                  <p className="text-[11px] text-[#a8a29e]">
                    Press and hold the button below to feel the tactile confirmation mechanism:
                  </p>
                  <HoldToConfirm
                    label={gateTested ? 'Approval Confirmed (Test Passed)' : 'Hold 1.5s to Test Gate'}
                    onConfirm={() => setGateTested(true)}
                    holdDurationMs={1500}
                    variant="primary"
                    disabled={gateTested}
                  />
                  {gateTested && (
                    <p className="text-[11px] font-mono-code text-[#4ade80] flex items-center gap-1 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approval verified! Real repository commits operate through this exact gate.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Step Action Buttons */}
            <div className="pt-4 border-t border-[#24211e] flex items-center justify-between gap-3">
              <button
                onClick={() => handleNavigateToFeature(currentStep.targetScreen, currentStep.id)}
                className="px-4 py-2 rounded-xl bg-[#ff6b00] hover:bg-[#ff8533] text-[#121110] font-bold text-xs flex items-center gap-2 shadow-[0_2px_12px_rgba(255,107,0,0.3)] transition-all cursor-pointer"
              >
                <span>{currentStep.actionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-2">
                {activeStepIndex > 0 && (
                  <button
                    onClick={() => setActiveStepIndex((prev) => prev - 1)}
                    className="px-3 py-1.5 rounded-lg border border-[#292524] text-xs font-semibold text-[#a8a29e] hover:text-[#faf8f5] hover:bg-[#1e1c1a] transition-all cursor-pointer"
                  >
                    Previous
                  </button>
                )}

                {activeStepIndex < ONBOARDING_STEPS.length - 1 ? (
                  <button
                    onClick={() => {
                      if (!completedSteps.includes(currentStep.id)) {
                        setCompletedSteps((prev) => [...prev, currentStep.id]);
                      }
                      setActiveStepIndex((prev) => prev + 1);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#24211e] hover:bg-[#2c2927] border border-[#292524] text-xs font-semibold text-[#faf8f5] transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="px-3 py-1.5 rounded-lg bg-[#271e16] hover:bg-[#33261c] border border-[#ff6b00]/40 text-xs font-semibold text-[#ffb693] transition-all cursor-pointer"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer with "Don't show on startup" option */}
        <div className="px-6 py-3 border-t border-[#24211e] bg-[#141210] flex items-center justify-between text-xs text-[#a8a29e]">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={handleDontShowChange}
              className="rounded border-[#292524] bg-[#1a1816] text-[#ff6b00] focus:ring-[#ff6b00]/30 w-3.5 h-3.5"
            />
            <span className="text-[11px] font-mono-code text-[#78716c]">
              Don&apos;t show this guide on startup
            </span>
          </label>

          <button
            onClick={onClose}
            className="text-[11px] font-mono-code text-[#ff6b00] hover:underline cursor-pointer"
          >
            Close & Start Building →
          </button>
        </div>
      </div>
    </div>
  );
};
