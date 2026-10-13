import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(express.json());

// Enable CORS for web, laptop bridge, and companion clients
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Initialize Google Gen AI with server-side API key
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
let aiClient: GoogleGenAI | null = null;
try {
  aiClient = apiKey ? new GoogleGenAI({ apiKey }) : new GoogleGenAI();
} catch (e) {
  console.warn('GoogleGenAI initialized with default credentials or fallback', e);
}

// -------------------------------------------------------------
// In-Memory SQLite Vault Mirror & Seed Data
// Matches native SQLite Idea Vault & FastAPI Bridge contract
// -------------------------------------------------------------
export interface IdeaRecord {
  id: string;
  title: string;
  category: string;
  preview: string;
  content: string;
  tags: string[];
  status: 'synced' | 'unsynced' | 'syncing' | 'error';
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

const ideaVault: Map<string, IdeaRecord> = new Map();
const tombstoneVault: Set<string> = new Set();

// Seed initial developer ideas
const SEED_IDEAS: IdeaRecord[] = [
  {
    id: 'idea-seed-001',
    title: 'Offline-First SQLite Sync Engine',
    category: 'systems',
    preview: 'Two-way delta sync between mobile Jetpack Compose vault and laptop FastAPI bridge.',
    content: 'Full offline-first sync protocol supporting deletion tombstones, vector clocks, and conflict resolution.',
    tags: ['#sync', '#sqlite', '#fastapi'],
    status: 'synced',
    isDemo: true,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'idea-seed-002',
    title: 'Multi-Agent Code Synthesis Pipeline',
    category: 'architecture',
    preview: 'Autonomous decomposition of specs into incremental git patches with hold-to-confirm approval.',
    content: 'Deconstruct high-level idea requirements into atomic git commit plans. Always gate repository modifications with hold-to-confirm.',
    tags: ['#agents', '#gemini', '#workflow'],
    status: 'synced',
    isDemo: true,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'idea-seed-003',
    title: 'Tailscale Laptop Bridge Mesh',
    category: 'devtools',
    preview: 'Configurable secure peer-to-peer bridge allowing mobile and web companions to query local Ollama.',
    content: 'Zero-config Tailscale node discovery allowing Idea Beacon companion to execute local Ollama models with honest latency measurements.',
    tags: ['#mesh', '#ollama', '#devtools'],
    status: 'synced',
    isDemo: true,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

SEED_IDEAS.forEach((idea) => ideaVault.set(idea.id, idea));

// -------------------------------------------------------------
// 1. Core FastAPI-Compatible Idea Vault Endpoints
// Reuses exact POST /api/ideas/capture schema and contracts
// -------------------------------------------------------------

// POST /api/ideas/capture - Primary Idea Capture endpoint
app.post('/api/ideas/capture', (req, res) => {
  try {
    const { id, title, category, preview, content, tags } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Idea title is required and cannot be empty',
      });
    }

    const ideaId = id || `idea-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const newIdea: IdeaRecord = {
      id: ideaId,
      title: title.trim(),
      category: category || 'systems',
      preview: preview || (content ? content.slice(0, 120) : 'Captured via Idea Beacon companion'),
      content: content || '',
      tags: Array.isArray(tags) ? tags : ['#spark'],
      status: 'synced',
      isDemo: false,
      createdAt: req.body.createdAt || now,
      updatedAt: now,
    };

    ideaVault.set(ideaId, newIdea);
    tombstoneVault.delete(ideaId); // In case re-captured

    return res.status(201).json({
      success: true,
      idea: newIdea,
      message: 'Idea captured successfully in vault',
    });
  } catch (err: any) {
    console.error('Error in /api/ideas/capture:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error capturing idea',
    });
  }
});

// GET /api/ideas - List all ideas with filtering
app.get('/api/ideas', (req, res) => {
  try {
    const { category, search, limit } = req.query;
    let list = Array.from(ideaVault.values());

    if (category && typeof category === 'string' && category !== 'all') {
      list = list.filter((i) => i.category.toLowerCase() === category.toLowerCase());
    }

    if (search && typeof search === 'string') {
      const q = search.trim().toLowerCase();
      list = list.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        i.content.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    if (limit && !isNaN(Number(limit))) {
      list = list.slice(0, Number(limit));
    }

    return res.json({
      success: true,
      ideas: list,
      count: list.length,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ideas/:id - Retrieve single idea
app.get('/api/ideas/:id', (req, res) => {
  const idea = ideaVault.get(req.params.id);
  if (!idea) {
    return res.status(404).json({ success: false, error: 'Idea not found' });
  }
  return res.json({ success: true, idea });
});

// PUT /api/ideas/:id - Update existing idea
app.put('/api/ideas/:id', (req, res) => {
  const { id } = req.params;
  const existing = ideaVault.get(id);

  if (!existing) {
    return res.status(404).json({ success: false, error: 'Idea not found in vault' });
  }

  const { title, category, preview, content, tags, status } = req.body;
  const updated: IdeaRecord = {
    ...existing,
    title: title !== undefined ? title : existing.title,
    category: category !== undefined ? category : existing.category,
    preview: preview !== undefined ? preview : existing.preview,
    content: content !== undefined ? content : existing.content,
    tags: Array.isArray(tags) ? tags : existing.tags,
    status: status || 'synced',
    updatedAt: new Date().toISOString(),
  };

  ideaVault.set(id, updated);
  return res.json({
    success: true,
    idea: updated,
    message: 'Idea updated successfully',
  });
});

// DELETE /api/ideas/:id - Remove idea with tombstone
app.delete('/api/ideas/:id', (req, res) => {
  const { id } = req.params;
  if (!ideaVault.has(id)) {
    return res.status(404).json({ success: false, error: 'Idea not found in vault' });
  }

  ideaVault.delete(id);
  tombstoneVault.add(id);

  return res.json({
    success: true,
    id,
    message: 'Idea removed from vault and tombstone recorded',
  });
});

// POST /api/ideas/sync - Batch idempotent synchronization
app.post('/api/ideas/sync', (req, res) => {
  try {
    const { mutations = [], tombstones = [] } = req.body;
    const syncedIds: string[] = [];
    const tombstoneIds: string[] = [];

    // Process client tombstones
    if (Array.isArray(tombstones)) {
      for (const t of tombstones) {
        if (t && t.id) {
          ideaVault.delete(t.id);
          tombstoneVault.add(t.id);
          tombstoneIds.push(t.id);
        }
      }
    }

    // Process client mutations
    if (Array.isArray(mutations)) {
      for (const item of mutations) {
        if (!item || !item.id || tombstoneVault.has(item.id)) continue;

        const existing = ideaVault.get(item.id);
        if (!existing) {
          ideaVault.set(item.id, {
            ...item,
            status: 'synced',
            updatedAt: item.updatedAt || new Date().toISOString(),
          });
          syncedIds.push(item.id);
        } else {
          // Last write wins by updatedAt
          const clientTime = new Date(item.updatedAt || 0).getTime();
          const serverTime = new Date(existing.updatedAt || 0).getTime();
          if (clientTime >= serverTime) {
            ideaVault.set(item.id, {
              ...item,
              status: 'synced',
            });
            syncedIds.push(item.id);
          }
        }
      }
    }

    const currentIdeas = Array.from(ideaVault.values());

    return res.json({
      success: true,
      syncedIds,
      tombstoneIds,
      serverIdeas: currentIdeas,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 2. Bridge & Connectivity Verification Endpoints
// Honest connection testing, ping, and diagnostics
// -------------------------------------------------------------

// GET /api/bridge/health - Bridge health ping
app.get(['/api/bridge/health', '/api/health'], (_req, res) => {
  res.json({
    status: 'ok',
    service: 'idea-beacon-bridge',
    version: '1.2.0',
    vaultCount: ideaVault.size,
    timestamp: new Date().toISOString(),
  });
});

// SSRF Protection Helper:
// Validates external bridge/tunnel URLs against SSRF vectors.
// Prohibits cloud metadata endpoints (169.254.169.254, metadata.google.internal),
// dangerous protocols, and unverified private subnets on cloud instances.
function isSafeBridgeUrl(urlStr: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, reason: 'Protocol must be http: or https:' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check against cloud metadata endpoints
    if (
      hostname === '169.254.169.254' ||
      hostname.includes('metadata.google.internal') ||
      hostname.includes('169.254') ||
      hostname.includes('instance-data')
    ) {
      return { safe: false, reason: 'Access to cloud metadata endpoints is prohibited (SSRF prevention)' };
    }

    // Prohibit arbitrary non-standard ports commonly associated with internal services
    // while permitting typical web and bridge ports (80, 443, 8000, 11434, 3000, 8080)
    const port = parsed.port;
    if (port && !['80', '443', '8000', '8080', '11434', '3000', '5000'].includes(port)) {
      return { safe: false, reason: `Port ${port} is not permitted for bridge proxying` };
    }

    // In production, block private IP address ranges if running on a remote cloud host
    const isCloudHost = process.env.NODE_ENV === 'production' && !process.env.ALLOW_LOCAL_BRIDGE_PROXY;
    if (isCloudHost) {
      if (
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
      ) {
        return { safe: false, reason: 'Arbitrary private internal subnet addresses are blocked on cloud instances' };
      }
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Malformed or invalid URL string' };
  }
}

// POST /api/bridge/test-connection - Test external bridge URL reachability with SSRF protection
app.post('/api/bridge/test-connection', async (req, res) => {
  const { targetUrl, timeoutMs = 3500 } = req.body;

  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).json({
      reachable: false,
      error: 'Target URL is required for connection test',
    });
  }

  // Validate target URL against SSRF vectors
  const safetyCheck = isSafeBridgeUrl(targetUrl);
  if (!safetyCheck.safe) {
    return res.status(400).json({
      reachable: false,
      error: `Security error: ${safetyCheck.reason}`,
      isSsrfBlocked: true,
    });
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const urlToTest = targetUrl.endsWith('/') ? `${targetUrl}health` : `${targetUrl}/health`;
    const response = await fetch(urlToTest, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;
    return res.json({
      reachable: response.ok,
      statusCode: response.status,
      latencyMs,
      targetUrl,
      note: response.ok ? 'Connection established with bridge' : `HTTP ${response.status}`,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    const isTimeout = err.name === 'AbortError';

    return res.json({
      reachable: false,
      latencyMs,
      targetUrl,
      error: isTimeout ? `Connection timed out after ${timeoutMs}ms` : err.message,
      reason: isTimeout
        ? 'TIMEOUT'
        : err.message.includes('ECONNREFUSED')
        ? 'CONNECTION_REFUSED'
        : 'NETWORK_ERROR',
      note: 'Ensure laptop bridge is running and reachable from current network.',
    });
  }
});

// POST /api/bridge/ollama - Proxied Ollama generation through laptop bridge (SSRF protected)
app.post('/api/bridge/ollama', async (req, res) => {
  const { bridgeUrl = 'http://localhost:8000', prompt, model = 'qwen2.5-coder:7b' } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const safetyCheck = isSafeBridgeUrl(bridgeUrl);
  if (!safetyCheck.safe) {
    return res.status(400).json({ error: `Security check failed: ${safetyCheck.reason}` });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const ollamaEndpoint = `${bridgeUrl.replace(/\/$/, '')}/api/ollama/generate`;
    const response = await fetch(ollamaEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama returned status ${response.status}`);
    }

    const data = await response.json();
    return res.json({
      success: true,
      text: data.response || data.text || '',
      model,
      source: 'laptop-bridge-ollama',
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    return res.status(503).json({
      success: false,
      error: `Laptop bridge Ollama unreachable at ${bridgeUrl}: ${err.message}`,
      fallbackRecommended: true,
    });
  }
});

// -------------------------------------------------------------
// 3. AI Brainstorming & Agent Endpoints (Server-side GenAI)
// Uses gemini-3.8-flash (standard & Google Search Grounding),
// configurable gemini-4-argon for complex reasoning,
// and local Ollama routing through the configured laptop bridge.
// -------------------------------------------------------------
app.post('/api/ai/brainstorm', async (req, res) => {
  try {
    const { prompt, model = 'gemini-3.8-flash', useSearchGrounding = false, bridgeUrl = 'http://localhost:8000' } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Handle local Ollama model routing through the configured laptop bridge
    if (model === 'ollama') {
      const safetyCheck = isSafeBridgeUrl(bridgeUrl);
      if (!safetyCheck.safe) {
        return res.status(400).json({
          success: false,
          error: `Security error: ${safetyCheck.reason}`,
          model: 'ollama',
        });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        const ollamaEndpoint = `${bridgeUrl.replace(/\/$/, '')}/api/ollama/generate`;
        const response = await fetch(ollamaEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'qwen2.5-coder:7b',
            prompt: `You are Idea Beacon IQ's developer architecture co-pilot. Analyze and create a technical specification for: ${prompt}`,
            stream: false,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Ollama returned status ${response.status}`);
        }

        const data = await response.json();
        const rawText = data.response || data.text || '';
        return res.json({
          success: true,
          model: 'ollama:qwen2.5-coder:7b',
          source: 'laptop-bridge-ollama',
          rawText,
          sources: [],
          webSearchQueries: [],
        });
      } catch (err: any) {
        clearTimeout(timeoutId);
        return res.status(503).json({
          success: false,
          error: `Laptop bridge Ollama unreachable at ${bridgeUrl}: ${err.message}`,
          model: 'ollama',
          source: 'laptop-bridge',
        });
      }
    }

    // Initialize or verify server-side Gemini client
    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '',
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }

    // Determine target Gemini model: gemini-3.8-flash (standard/grounded) or gemini-4-argon (complex)
    const targetModel = model === 'gemini-4-argon' ? 'gemini-4-argon' : 'gemini-3.8-flash';
    const config: any = {};

    // Enable Google Search Grounding when requested (supported natively by gemini-3.8-flash)
    if (useSearchGrounding && targetModel === 'gemini-3.8-flash') {
      config.tools = [{ googleSearch: {} }];
    }

    const systemPrompt = `You are Idea Beacon IQ's developer architecture co-pilot.
Produce an actionable, high-density technical microservice/architecture specification for the given developer idea.
Output your response as structured JSON with the following keys:
{
  "architectureFlow": "Concise technical dataflow diagram or summary (e.g. Ingress TC Hook -> BPF RingBuffer -> User Space Exporter)",
  "recommendedLibraries": [
    { "name": "library-name", "version": "semantic-version", "reason": "brief technical reason" }
  ],
  "requirements": [
    { "label": "Environment/OS/Runtime", "value": "specific version or flag requirements" }
  ],
  "roadmap": [
    "Phase 1: Foundation & Prototyping",
    "Phase 2: Core Implementation",
    "Phase 3: Telemetry & Hardening"
  ],
  "summary": "2-sentence executive summary of the architecture"
}
Ensure all keys are provided. If outputting JSON, format cleanly without conversational fluff.`;

    const response = await aiClient.models.generateContent({
      model: targetModel,
      contents: `${systemPrompt}\n\nUser Request: "${prompt}"`,
      config,
    });

    const text = response.text || '';
    const groundingChunks = (response.candidates?.[0] as any)?.groundingMetadata?.groundingChunks || [];
    const webSearchQueries = (response.candidates?.[0] as any)?.groundingMetadata?.webSearchQueries || [];

    const sources = groundingChunks
      .map((chunk: any) => ({
        title: chunk.web?.title || 'Web Documentation',
        url: chunk.web?.uri || '',
      }))
      .filter((s: any) => s.url);

    // Attempt to parse JSON from model output
    let parsedSpec = null;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedSpec = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Keep parsedSpec as null; client can use rawText
    }

    return res.json({
      success: true,
      model: targetModel,
      rawText: text,
      spec: parsedSpec,
      sources,
      webSearchQueries,
    });
  } catch (err: any) {
    console.error('Error generating brainstorm response:', err);
    const rawError = err.message || '';
    const isQuotaExceeded =
      rawError.includes('429') ||
      rawError.includes('RESOURCE_EXHAUSTED') ||
      rawError.includes('Quota exceeded');

    let cleanErrorMessage = err.message || 'Failed to generate brainstorm content with Gemini API';
    if (isQuotaExceeded) {
      cleanErrorMessage = `Gemini API rate limit reached (RESOURCE_EXHAUSTED). Free tier quota exceeded for model ${req.body.model || 'gemini-3.8-flash'}.`;
    }

    return res.status(isQuotaExceeded ? 429 : 500).json({
      success: false,
      error: cleanErrorMessage,
      code: isQuotaExceeded ? 'RESOURCE_EXHAUSTED' : 'GENAI_ERROR',
      model: req.body.model || 'gemini-3.8-flash',
      rawError,
    });
  }
});

// -------------------------------------------------------------
// 3. Connected Repositories, Diffs & Hold-to-Confirm Approval Gate
// Consequential repository modifications require explicit confirmation
// -------------------------------------------------------------

interface DiffLineRecord {
  type: 'context' | 'add' | 'del';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

interface DiffHunkRecord {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLineRecord[];
}

interface CodeDiffFileRecord {
  path: string;
  status: 'modified' | 'added' | 'deleted';
  additions: number;
  deletions: number;
  hunks: DiffHunkRecord[];
}

interface ChangeProposalRecord {
  id: string;
  repoId: string;
  title: string;
  description: string;
  sourceIdeaTitle?: string;
  diffs: CodeDiffFileRecord[];
  status: 'pending_review' | 'approved' | 'rejected' | 'committed';
  requiresApproval: boolean;
  createdAt: string;
  commitMessage?: string;
  committedHash?: string;
}

interface RepositoryRecord {
  id: string;
  name: string;
  owner: string;
  url: string;
  branch: string;
  status: 'connected' | 'syncing' | 'diverged' | 'offline';
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    timestamp: string;
  };
  isLocalBridgeLinked?: boolean;
  activeProposal?: ChangeProposalRecord;
  history: Array<{ hash: string; message: string; author: string; timestamp: string }>;
}

const repositoryVault: Map<string, RepositoryRecord> = new Map();

// Seed initial repositories
const SEED_REPOS: RepositoryRecord[] = [
  {
    id: 'repo-hyperstream-ebpf',
    name: 'hyperstream-ebpf',
    owner: 'idea-beacon',
    url: 'https://github.com/idea-beacon/hyperstream-ebpf',
    branch: 'master',
    status: 'connected',
    lastCommit: {
      hash: '4b9f1a2',
      message: 'feat(trace): pin ring buffer to /sys/fs/bpf/hyperstream_ring',
      author: 'Alex Chen',
      timestamp: '20 minutes ago',
    },
    isLocalBridgeLinked: true,
    history: [
      { hash: '4b9f1a2', message: 'feat(trace): pin ring buffer to /sys/fs/bpf/hyperstream_ring', author: 'Alex Chen', timestamp: '20 minutes ago' },
      { hash: '8f12a04', message: 'chore(aya): bump aya-rs to 0.12.0', author: 'Alex Chen', timestamp: '3 hours ago' },
      { hash: '3e01bc9', message: 'init: bootstrap aya eBPF loader pipeline', author: 'Alex Chen', timestamp: '1 day ago' },
    ],
    activeProposal: {
      id: 'prop-aya-trace-01',
      repoId: 'repo-hyperstream-ebpf',
      title: 'aya-trace: Attach kprobe:tcp_connect & ringbuf export',
      description: 'Generates kernel socket trace buffer probe implementation from idea spec.',
      sourceIdeaTitle: 'HyperStream Probe (eBPF)',
      status: 'pending_review',
      requiresApproval: true,
      createdAt: new Date().toISOString(),
      diffs: [
        {
          path: 'src/probes/tcp_probe.rs',
          status: 'modified',
          additions: 18,
          deletions: 3,
          hunks: [
            {
              oldStart: 14,
              oldLines: 7,
              newStart: 14,
              newLines: 22,
              lines: [
                { type: 'context', content: 'use aya_bpf::bindings::sock;', oldLineNum: 14, newLineNum: 14 },
                { type: 'context', content: 'use aya_bpf::macros::kprobe;', oldLineNum: 15, newLineNum: 15 },
                { type: 'del', content: '-// TODO: Attach kprobe to tcp_v4_connect', oldLineNum: 16 },
                { type: 'del', content: '-// Pending architecture verification', oldLineNum: 17 },
                { type: 'del', content: '-fn placeholder() {}', oldLineNum: 18 },
                { type: 'add', content: '+#[kprobe]', newLineNum: 16 },
                { type: 'add', content: '+pub fn tcp_v4_connect(ctx: ProbeContext) -> u32 {', newLineNum: 17 },
                { type: 'add', content: '+    let sock: *const sock = ctx.arg(0).unwrap_or(core::ptr::null());', newLineNum: 18 },
                { type: 'add', content: '+    if sock.is_null() { return 0; }', newLineNum: 19 },
                { type: 'add', content: '+    let dport = unsafe { (*sock).__sk_common.skc_dport };', newLineNum: 20 },
                { type: 'add', content: '+    let mut event = SocketTraceEvent {', newLineNum: 21 },
                { type: 'add', content: '+        timestamp_ns: bpf_ktime_get_ns(),', newLineNum: 22 },
                { type: 'add', content: '+        dest_port: u16::from_be(dport),', newLineNum: 23 },
                { type: 'add', content: '+        pid: bpf_get_current_pid_tgid() as u32,', newLineNum: 24 },
                { type: 'add', content: '+    };', newLineNum: 25 },
                { type: 'add', content: '+    let _ = RING_BUF.output(&event, BPF_RB_FORCE_WAKEUP);', newLineNum: 26 },
                { type: 'add', content: '+    0', newLineNum: 27 },
                { type: 'add', content: '+}' , newLineNum: 28 },
                { type: 'context', content: '', oldLineNum: 19, newLineNum: 29 },
                { type: 'context', content: 'static RING_BUF: RingBuf = RingBuf::pinned("/sys/fs/bpf/hyperstream_ring");', oldLineNum: 20, newLineNum: 30 },
              ],
            },
          ],
        },
        {
          path: 'Cargo.toml',
          status: 'modified',
          additions: 3,
          deletions: 1,
          hunks: [
            {
              oldStart: 22,
              oldLines: 4,
              newStart: 22,
              newLines: 6,
              lines: [
                { type: 'context', content: '[dependencies]', oldLineNum: 22, newLineNum: 22 },
                { type: 'del', content: '-aya = "0.11"', oldLineNum: 23 },
                { type: 'add', content: '+aya = { version = "0.12", features = ["async_io"] }', newLineNum: 23 },
                { type: 'add', content: '+aya-log = "0.2"', newLineNum: 24 },
                { type: 'add', content: '+aya-bpf = "0.1"', newLineNum: 25 },
                { type: 'context', content: 'tokio = { version = "1.36", features = ["full"] }', oldLineNum: 24, newLineNum: 26 },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'repo-beacon-core-runtime',
    name: 'beacon-core-runtime',
    owner: 'idea-beacon',
    url: 'https://github.com/idea-beacon/beacon-core-runtime',
    branch: 'main',
    status: 'connected',
    lastCommit: {
      hash: '9c21fe0',
      message: 'refactor(sync): optimize tombstone eviction window',
      author: 'Sarah Lin',
      timestamp: '2 hours ago',
    },
    isLocalBridgeLinked: true,
    history: [
      { hash: '9c21fe0', message: 'refactor(sync): optimize tombstone eviction window', author: 'Sarah Lin', timestamp: '2 hours ago' },
      { hash: '2a44dd1', message: 'feat(storage): SQLite schema v2 migrations', author: 'Sarah Lin', timestamp: '1 day ago' },
    ],
  },
];

SEED_REPOS.forEach((r) => repositoryVault.set(r.id, r));

// GET /api/repos - List all connected repositories
app.get('/api/repos', (_req, res) => {
  try {
    const repos = Array.from(repositoryVault.values());
    return res.json({
      success: true,
      repos,
      count: repos.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/repos/connect - Connect a repository
app.post('/api/repos/connect', (req, res) => {
  try {
    const { name, owner = 'idea-beacon', url, branch = 'main', isLocalBridgeLinked = false } = req.body;

    if (!name && !url) {
      return res.status(400).json({
        success: false,
        error: 'Repository name or URL is required',
      });
    }

    const repoName = name || (url ? url.split('/').pop()?.replace(/\.git$/, '') : 'unnamed-repo');
    const repoId = `repo-${repoName.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;

    if (repositoryVault.has(repoId)) {
      return res.json({
        success: true,
        repo: repositoryVault.get(repoId),
        message: 'Repository already connected',
      });
    }

    const newRepo: RepositoryRecord = {
      id: repoId,
      name: repoName,
      owner,
      url: url || `https://github.com/${owner}/${repoName}`,
      branch,
      status: 'connected',
      lastCommit: {
        hash: Math.random().toString(16).slice(2, 9),
        message: 'Initial connected reference',
        author: 'Idea Beacon Companion',
        timestamp: 'just now',
      },
      isLocalBridgeLinked,
      history: [
        {
          hash: Math.random().toString(16).slice(2, 9),
          message: 'Initial connected reference',
          author: 'Idea Beacon Companion',
          timestamp: 'just now',
        },
      ],
    };

    repositoryVault.set(repoId, newRepo);

    return res.status(201).json({
      success: true,
      repo: newRepo,
      message: 'Repository successfully connected',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/repos/:id - Get single repository details
app.get('/api/repos/:id', (req, res) => {
  const repo = repositoryVault.get(req.params.id);
  if (!repo) {
    return res.status(404).json({ success: false, error: 'Repository not found' });
  }
  return res.json({ success: true, repo });
});

// GET /api/repos/:id/diffs - Get active change proposal & diffs
app.get('/api/repos/:id/diffs', (req, res) => {
  const repo = repositoryVault.get(req.params.id);
  if (!repo) {
    return res.status(404).json({ success: false, error: 'Repository not found' });
  }
  return res.json({
    success: true,
    repoId: repo.id,
    proposal: repo.activeProposal || null,
    diffs: repo.activeProposal?.diffs || [],
  });
});

// POST /api/repos/:id/propose-diff - Generate or set a change proposal from an idea
app.post('/api/repos/:id/propose-diff', (req, res) => {
  const repo = repositoryVault.get(req.params.id);
  if (!repo) {
    return res.status(404).json({ success: false, error: 'Repository not found' });
  }

  const { title, description, sourceIdeaTitle, diffs } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, error: 'Proposal title is required' });
  }

  const proposalId = `prop-${Date.now()}`;
  const newProposal: ChangeProposalRecord = {
    id: proposalId,
    repoId: repo.id,
    title,
    description: description || 'Generated architectural change from idea',
    sourceIdeaTitle,
    diffs: diffs || [
      {
        path: `src/features/${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.ts`,
        status: 'added',
        additions: 12,
        deletions: 0,
        hunks: [
          {
            oldStart: 0,
            oldLines: 0,
            newStart: 1,
            newLines: 12,
            lines: [
              { type: 'add', content: '+// Architecture implementation from Idea Beacon IQ', newLineNum: 1 },
              { type: 'add', content: `+// Spec: ${title}`, newLineNum: 2 },
              { type: 'add', content: '+export async function initializeModule() {', newLineNum: 3 },
              { type: 'add', content: '+  console.log("Module initialized via verified gate");', newLineNum: 4 },
              { type: 'add', content: '+  return { ready: true };', newLineNum: 5 },
              { type: 'add', content: '+};', newLineNum: 6 },
            ],
          },
        ],
      },
    ],
    status: 'pending_review',
    requiresApproval: true,
    createdAt: new Date().toISOString(),
  };

  repo.activeProposal = newProposal;
  return res.status(201).json({ success: true, proposal: newProposal });
});

// POST /api/repos/:id/apply - Apply/Commit changes with Hold-to-Confirm approval gate
app.post('/api/repos/:id/apply', (req, res) => {
  const repo = repositoryVault.get(req.params.id);
  if (!repo) {
    return res.status(404).json({ success: false, error: 'Repository not found' });
  }

  const { confirmed, commitMessage } = req.body;

  // Strict approval gate enforcement:
  // Consequential modifications to codebases or git history MUST be explicitly confirmed
  if (confirmed !== true) {
    return res.status(403).json({
      success: false,
      error: 'Consequential action requires explicit Hold-to-Confirm gate approval',
      requiresApproval: true,
    });
  }

  if (!repo.activeProposal || repo.activeProposal.status === 'committed') {
    return res.status(400).json({
      success: false,
      error: 'No pending change proposal to apply to this repository',
    });
  }

  const newHash = Math.random().toString(16).slice(2, 9);
  const finalMessage = commitMessage || repo.activeProposal.title || 'feat: apply AI idea specification';
  const now = new Date().toISOString();

  const newCommit = {
    hash: newHash,
    message: finalMessage,
    author: 'Idea Beacon AI Companion',
    timestamp: 'just now',
  };

  repo.lastCommit = newCommit;
  repo.history.unshift(newCommit);
  repo.activeProposal.status = 'committed';
  repo.activeProposal.committedHash = newHash;
  repo.activeProposal.commitMessage = finalMessage;

  return res.json({
    success: true,
    commitHash: newHash,
    repo,
    message: `Changes successfully committed to branch ${repo.branch} (commit ${newHash})`,
    timestamp: now,
  });
});

// -------------------------------------------------------------
// 4. Vite Development Server / Static Asset Handler
// -------------------------------------------------------------
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Idea Beacon server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
