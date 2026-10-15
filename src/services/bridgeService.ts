/**
 * Laptop Bridge Connection & Sync Service
 * Manages connectivity checks, latency measurement, mixed-content detection,
 * and authoritative idea capture through the FastAPI laptop bridge.
 */

import { IdeaEntity } from '../db/schemas';
import { BeaconIndexedDB } from '../db/BeaconIndexedDB';

export type BridgeStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'MIXED_CONTENT_BLOCKED' | 'TIMEOUT';

export interface BridgeDiagnostics {
  status: BridgeStatus;
  url: string;
  latencyMs?: number;
  message: string;
  vaultCount?: number;
  lastChecked: string;
  isLocalhost: boolean;
}

const DEFAULT_BRIDGE_URL = 'http://localhost:8000';
const SETTING_BRIDGE_URL = 'idea_beacon_bridge_url';
const SETTING_COMPANION_MODE = 'idea_beacon_companion_mode';

class BridgeService {
  private currentUrl: string = DEFAULT_BRIDGE_URL;
  private currentStatus: BridgeStatus = 'DISCONNECTED';
  private lastDiagnostics: BridgeDiagnostics | null = null;
  private listeners: Set<(diag: BridgeDiagnostics) => void> = new Set();

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const saved = await BeaconIndexedDB.getSetting(SETTING_BRIDGE_URL, DEFAULT_BRIDGE_URL);
      this.currentUrl = saved || DEFAULT_BRIDGE_URL;
    } catch {
      this.currentUrl = DEFAULT_BRIDGE_URL;
    }
  }

  public subscribe(listener: (diag: BridgeDiagnostics) => void): () => void {
    this.listeners.add(listener);
    if (this.lastDiagnostics) {
      listener(this.lastDiagnostics);
    }
    return () => this.listeners.delete(listener);
  }

  private notify(diag: BridgeDiagnostics) {
    this.lastDiagnostics = diag;
    this.currentStatus = diag.status;
    this.listeners.forEach((fn) => fn(diag));
  }

  public getBridgeUrl(): string {
    return this.currentUrl;
  }

  public async setBridgeUrl(url: string): Promise<BridgeDiagnostics> {
    const cleanUrl = url.trim().replace(/\/$/, '');
    this.currentUrl = cleanUrl || DEFAULT_BRIDGE_URL;
    await BeaconIndexedDB.setSetting(SETTING_BRIDGE_URL, this.currentUrl);
    return this.checkConnection();
  }

  /**
   * Performs an honest connectivity check with timeout & mixed-content detection.
   */
  public async checkConnection(targetUrl?: string): Promise<BridgeDiagnostics> {
    const url = (targetUrl || this.currentUrl).trim().replace(/\/$/, '');
    const startTime = Date.now();
    const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isHttpTarget = url.startsWith('http://');
    const isLocal = url.includes('localhost') || url.includes('127.0.0.1');

    this.notify({
      status: 'CONNECTING',
      url,
      message: `Probing bridge at ${url}...`,
      lastChecked: new Date().toISOString(),
      isLocalhost: isLocal,
    });

    // 1. Only attempt direct browser fetch if safe from mixed-content blocks
    if (!isHttpsPage || !isHttpTarget || url === '/api' || url === '') {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      try {
        const pingUrl = url === '/api' || url === '' ? '/api/bridge/health' : `${url}/api/bridge/health`;
        const directResponse = await fetch(pingUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timeoutId);

        const latencyMs = Date.now() - startTime;
        if (directResponse.ok) {
          const data = await directResponse.json();
          const diag: BridgeDiagnostics = {
            status: 'CONNECTED',
            url,
            latencyMs,
            message: `Connected (${latencyMs}ms)`,
            vaultCount: data.vaultCount,
            lastChecked: new Date().toISOString(),
            isLocalhost: isLocal,
          };
          this.notify(diag);
          return diag;
        }
      } catch {
        clearTimeout(timeoutId);
      }
    }

    // 2. Check the server-side proxy tester in case bridge is accessible via server
    try {
      const testRes = await fetch('/api/bridge/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: url, timeoutMs: 3000 }),
      });
      const testData = await testRes.json();

      if (testData.reachable) {
        const diag: BridgeDiagnostics = {
          status: 'CONNECTED',
          url,
          latencyMs: testData.latencyMs,
          message: `Bridge reachable (${testData.latencyMs}ms)`,
          lastChecked: new Date().toISOString(),
          isLocalhost: isLocal,
        };
        this.notify(diag);
        return diag;
      }
    } catch {
      // Ignore proxy error and return honest disconnected state
    }

    const elapsed = Date.now() - startTime;
    const diag: BridgeDiagnostics = {
      status: elapsed >= 3000 ? 'TIMEOUT' : 'DISCONNECTED',
      url,
      message: `Unreachable at ${url}. Operating in local companion cache mode.`,
      lastChecked: new Date().toISOString(),
      isLocalhost: isLocal,
    };
    this.notify(diag);
    return diag;
  }

  /**
   * Captures idea: attempts bridge/server POST /api/ideas/capture first,
   * falls back safely to IndexedDB with queued sync if offline.
   */
  public async captureIdea(
    ideaData: Omit<IdeaEntity, 'id' | 'createdAt' | 'updatedAt' | 'relativeTime'> & { id?: string }
  ): Promise<{ idea: IdeaEntity; viaBridge: boolean; message: string }> {
    // Always use same-origin /api/ideas/capture to prevent mixed-content blocks and connection drops
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch('/api/ideas/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ideaData),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        const serverIdea: IdeaEntity = result.idea;

        // Save into IndexedDB cache marked as synced
        await BeaconIndexedDB.captureIdea({
          ...serverIdea,
          status: 'synced',
        });

        return {
          idea: serverIdea,
          viaBridge: true,
          message: 'Saved directly to SQLite Idea Vault',
        };
      }
    } catch {
      clearTimeout(timeoutId);
    }

    // Offline / Fallback: Save to IndexedDB with unsynced status
    const localSaved = await BeaconIndexedDB.captureIdea({
      ...ideaData,
      status: 'unsynced',
    });

    return {
      idea: localSaved,
      viaBridge: false,
      message: 'Saved locally to IndexedDB cache (queued for bridge sync)',
    };
  }

  /**
   * Syncs pending mutations to the bridge
   */
  public async syncVault(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    const targetBase = this.currentStatus === 'CONNECTED' && this.currentUrl !== '/api'
      ? this.currentUrl
      : window.location.origin;

    return BeaconIndexedDB.syncWithRemote(targetBase);
  }

  /**
   * Fetches connected repositories from bridge
   */
  public async getRepositories(): Promise<any[]> {
    try {
      const res = await fetch('/api/repos');
      if (res.ok) {
        const data = await res.json();
        return data.repos || [];
      }
    } catch (err) {
      console.warn('Failed to fetch repositories from bridge:', err);
    }
    return [];
  }

  /**
   * Connects a new GitHub repository or local bridge workspace
   */
  public async connectRepository(payload: {
    name: string;
    url?: string;
    branch?: string;
    isLocalBridgeLinked?: boolean;
  }): Promise<{ success: boolean; repo?: any; error?: string }> {
    try {
      const res = await fetch('/api/repos/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, repo: data.repo };
      }
      return { success: false, error: data.error || 'Failed to connect repository' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error connecting repository' };
    }
  }

  /**
   * Runs live connection testing and diagnostics on a connected repository
   */
  public async testRepository(repoId: string): Promise<{
    success: boolean;
    latencyMs?: number;
    branch?: string;
    lastCommit?: { hash: string; message: string; author: string; timestamp: string };
    gitChecks?: { urlReachable: boolean; branchValid: boolean; diffsReady: boolean; isLocalBridgeLinked: boolean };
    activeProposalSummary?: { id: string; title: string; status: string; filesCount: number } | null;
    error?: string;
  }> {
    try {
      const res = await fetch(`/api/repos/${repoId}/diagnostics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return {
          success: true,
          latencyMs: data.latencyMs,
          branch: data.branch,
          lastCommit: data.lastCommit,
          gitChecks: data.gitChecks,
          activeProposalSummary: data.activeProposalSummary,
        };
      }
      return { success: false, error: data.error || 'Failed to run repository diagnostics' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error running diagnostics' };
    }
  }

  /**
   * Fetches pending diffs for a repository
   */
  public async getRepositoryDiffs(repoId: string): Promise<{ proposal: any; diffs: any[] }> {
    try {
      const res = await fetch(`/api/repos/${repoId}/diffs`);
      if (res.ok) {
        const data = await res.json();
        return { proposal: data.proposal, diffs: data.diffs || [] };
      }
    } catch (err) {
      console.warn('Failed to fetch diffs for repo:', repoId, err);
    }
    return { proposal: null, diffs: [] };
  }

  /**
   * Proposes a new code diff specification for a repository
   */
  public async proposeDiff(
    repoId: string,
    payload: { title: string; description?: string; sourceIdeaTitle?: string }
  ): Promise<{ success: boolean; proposal?: any; error?: string }> {
    try {
      const res = await fetch(`/api/repos/${repoId}/propose-diff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, proposal: data.proposal };
      }
      return { success: false, error: data.error || 'Failed to propose diff' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Applies and commits changes to repository with explicit Hold-to-Confirm gate
   */
  public async applyRepositoryChanges(
    repoId: string,
    confirmed: boolean,
    commitMessage?: string
  ): Promise<{ success: boolean; commitHash?: string; message?: string; error?: string; requiresApproval?: boolean }> {
    try {
      const res = await fetch(`/api/repos/${repoId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed, commitMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        return {
          success: true,
          commitHash: data.commitHash,
          message: data.message,
        };
      }
      return {
        success: false,
        error: data.error,
        requiresApproval: data.requiresApproval,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export const bridgeService = new BridgeService();
