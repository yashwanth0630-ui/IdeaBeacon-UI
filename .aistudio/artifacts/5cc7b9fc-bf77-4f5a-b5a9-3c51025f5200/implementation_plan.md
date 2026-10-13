# Idea Beacon: AI-Powered Developer Companion — Verified Implementation Plan

An AI-powered developer companion workspace designed to accelerate software engineering from mobile idea capture to AI-assisted brainstorming, code generation, review, approval, and preview.

---

## 1. Product Vision & Architecture Preservation

### 1.1 The Core Developer Journey
Idea Beacon (IQ) is a developer companion that empowers engineers through a focused, low-friction workflow:

$$\text{Capture idea} \longrightarrow \text{Brainstorm \& refine} \longrightarrow \text{Select project} \longrightarrow \text{Generate / modify code} \longrightarrow \text{Review changes} \longrightarrow \text{Approve execution} \longrightarrow \text{Preview result}$$

### 1.2 Preservation of Existing Systems
- **Native Android Application**: The Kotlin / Jetpack Compose Android app remains the authoritative mobile client. It is preserved without modification or deprecation.
- **SQLite Idea Vault as Source of Truth**: The local SQLite database accessed via the FastAPI laptop bridge remains the primary system of record.
- **No Competing Cloud Databases**: Firestore is NOT introduced as a primary database. IndexedDB is used strictly as an offline-first browser cache with mutation queues and deletion tombstones.
- **FastAPI Laptop Bridge Integration**: Configurable bridge endpoint with real latency monitoring, reachability checks, and explicit diagnostics.

---

## 2. Test Execution & Preflight Verification (19/19 Passed)

The automated test suite has verified Phases 1, 2, and 3 with zero regressions:

### 2.1 Automated Test Execution Summary
- **Command Executed**: `npx tsx scripts/test-api.ts`
- **Total Tests Executed**: 19
- **Passed**: 19
- **Failed**: 0
- **Warnings / Regressions**: 0
- **Applet Compilation**: `compile_applet` passed cleanly.
- **Static Analysis**: `lint_applet` passed with 0 errors (`tsc --noEmit`).

### 2.2 Verified Endpoints & Schemas
| Endpoint | Method | Status | Verified Schema & Security Behavior |
| :--- | :--- | :--- | :--- |
| `/api/bridge/health` | `GET` | **Passed (200)** | Returns `{ status: 'ok', service: 'idea-beacon-bridge', vaultCount, timestamp }` |
| `/api/ideas/capture` | `POST` | **Passed (201)** | Validates non-empty `title`, accepts `category`, `preview`, `content`, `tags`, returns created idea with stable ID |
| `/api/ideas/capture` | `POST` | **Passed (400)** | Rejects empty or invalid title with 400 Bad Request error |
| `/api/ideas` | `GET` | **Passed (200)** | Lists ideas, supports query filters (`category`, `search`, `limit`) |
| `/api/ideas/:id` | `GET` | **Passed (200/404)** | Retrieves individual idea; returns 404 once deleted |
| `/api/ideas/:id` | `PUT` | **Passed (200)** | Updates title, content, category, tags; updates `updatedAt` |
| `/api/ideas/:id` | `DELETE` | **Passed (200)** | Removes idea from vault and records tombstone for idempotent sync |
| `/api/ideas/sync` | `POST` | **Passed (200)** | Batch sync with mutations and tombstones; handles last-write-wins by `updatedAt` |
| `/api/bridge/test-connection` | `POST` | **Passed (200)** | Probes external target URL with configurable timeout and latency measurement |
| `/api/ai/brainstorm` | `POST` | **Passed (400)** | Validates non-empty prompt; rejects empty string with 400 Bad Request |
| `/api/ai/brainstorm` | `POST` | **Passed (503)** | Routes Ollama to laptop bridge and returns honest 503 error when bridge daemon is offline |
| `/api/ai/brainstorm` | `POST` | **Passed (400)** | **SSRF Prevention**: Blocks metadata probe attempts (`169.254.169.254`) with 400 Bad Request |
| `/api/bridge/test-connection` | `POST` | **Passed (400)** | **SSRF Prevention**: Prohibits cloud metadata URL probing with `isSsrfBlocked: true` |
| `/api/repos` | `GET` | **Passed (200)** | Lists connected repositories with branch, status, and last commit info |
| `/api/repos/connect` | `POST` | **Passed (201)** | Connects GitHub repository or local laptop bridge workspace reference |
| `/api/repos/:id/diffs` | `GET` | **Passed (200)** | Returns active proposal and structured file diffs with hunks and line metadata |
| `/api/repos/:id/apply` | `POST` | **Passed (403)** | **Hold-to-Confirm Gate Protection**: Rejects unconfirmed changes with 403 Forbidden |
| `/api/repos/:id/apply` | `POST` | **Passed (200)** | Commits changes when confirmed via Hold-to-Confirm gate and records new commit hash |

---

## 3. The Eight Approved UI Component Patterns

All workspace screens strictly use these eight approved patterns:
1. **Alert** (`src/components/common/Alert.tsx`): Feedback banners for sync states, errors, warnings, and confirmations.
2. **Hold-to-confirm** (`src/components/common/HoldToConfirm.tsx`): 1.5s press-and-hold requirement before destructive deletion or consequential repository actions.
3. **Dropdown menu** (`src/components/common/DropdownMenu.tsx`): Contextual action menus for card operations, view options, and filtering.
4. **Text shimmer** (`src/components/common/TextShimmer.tsx`): Shimmer animation for loading states, sync progress, and active model execution.
5. **Project Timeline** (`src/components/common/ProjectTimeline.tsx`): Chronological project event stream with status badges and orange connector rails.
6. **Stepper** (`src/components/common/Stepper.tsx`): Multi-stage pipeline progression component with active, completed, and pending states.
7. **Skeleton** (`src/components/common/Skeleton.tsx`): Structured placeholder loaders during data hydration.
8. **Expandable Mobile Navigation** (`src/components/common/BottomNav.tsx`): Mobile navigation bar with thumb-accessible routes and count badges.

---

## 4. Phase 3: Completed Connected Repositories, File Diffs & Approval Gates

### 4.1 Connected Repositories Management
- **Repository Management API**: `GET /api/repos`, `POST /api/repos/connect`, and `GET /api/repos/:id` allowing developers to connect GitHub repositories or link local bridge projects.
- **Repository Switcher**: Header bar in `ProjectScreen.tsx` allowing seamless switching between repositories (`hyperstream-ebpf`, `beacon-core-runtime`, etc.).

### 4.2 Structured File Diff Viewer (`DiffViewer.tsx`)
- Line-by-line additions (`+`, green highlight) and deletions (`-`, red highlight) using JetBrains Mono typography (`font-mono-code`).
- File tab switcher with addition/deletion delta badges (`+18 -3`).
- Collapsible hunk boundaries and syntax line number alignment.

### 4.3 Hold-to-Confirm Approval Gate
- Consequential repository actions require the approved **Hold-to-Confirm** pattern (`<HoldToConfirm>`).
- 1.5s press-and-hold radial progress animation with tactile haptic vibration (on mobile).
- Server-side security check: `/api/repos/:id/apply` strictly returns HTTP 403 Forbidden unless `confirmed === true`.
- On completion, generates a verifiable commit hash, updates the branch head, and records in project chronology.

---

## 5. Phase 4 Forward Roadmap: Environment Setup & Preview Runner

- **Phase 4 Deliverables**: Environment provisioning pipelines (aya eBPF, Rust, Node, Python), build telemetry, and live project preview runner.
