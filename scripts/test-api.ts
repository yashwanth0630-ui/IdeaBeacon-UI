/**
 * Preflight API Test Suite
 * Tests all FastAPI-compatible Idea Vault and Bridge endpoints:
 * - GET /api/bridge/health
 * - POST /api/ideas/capture (with validation of required fields and schemas)
 * - GET /api/ideas (listing and filtering)
 * - GET /api/ideas/:id
 * - PUT /api/ideas/:id
 * - DELETE /api/ideas/:id (with tombstone recording)
 * - POST /api/ideas/sync (batch idempotent delta synchronization)
 * - POST /api/bridge/test-connection
 */

const BASE_URL = 'http://127.0.0.1:3000';

async function runTests() {
  console.log('🧪 Starting Idea Beacon Preflight API Verification Tests...\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string, detail?: any) => {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`, detail || '');
      failed++;
    }
  };

  try {
    // Test 1: GET /api/bridge/health
    const healthRes = await fetch(`${BASE_URL}/api/bridge/health`);
    const healthData = await healthRes.json();
    assert(
      healthRes.status === 200 && healthData.status === 'ok' && healthData.service === 'idea-beacon-bridge',
      'GET /api/bridge/health returns 200 with service metadata',
      healthData
    );

    // Test 2: POST /api/ideas/capture - Validation failure on empty title
    const invalidRes = await fetch(`${BASE_URL}/api/ideas/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    });
    assert(
      invalidRes.status === 400,
      'POST /api/ideas/capture rejects empty title with 400 status code'
    );

    // Test 3: POST /api/ideas/capture - Successful capture
    const testIdeaPayload = {
      title: 'Automated Test Idea',
      category: 'devtools',
      preview: 'Created by automated preflight verification suite.',
      content: 'Detailed specifications for offline verification test.',
      tags: ['#test', '#verification'],
    };

    const captureRes = await fetch(`${BASE_URL}/api/ideas/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testIdeaPayload),
    });
    const captureData = await captureRes.json();
    assert(
      captureRes.status === 201 &&
        captureData.success === true &&
        captureData.idea &&
        captureData.idea.title === testIdeaPayload.title,
      'POST /api/ideas/capture successfully creates idea and returns 201',
      captureData
    );

    const createdId = captureData.idea.id;

    // Test 4: GET /api/ideas - Listing ideas
    const listRes = await fetch(`${BASE_URL}/api/ideas`);
    const listData = await listRes.json();
    assert(
      listRes.status === 200 &&
        listData.success === true &&
        Array.isArray(listData.ideas) &&
        listData.ideas.some((i: any) => i.id === createdId),
      'GET /api/ideas lists ideas including newly captured item',
      { count: listData.count }
    );

    // Test 5: GET /api/ideas/:id - Retrieve single idea
    const getRes = await fetch(`${BASE_URL}/api/ideas/${createdId}`);
    const getData = await getRes.json();
    assert(
      getRes.status === 200 && getData.success === true && getData.idea.id === createdId,
      'GET /api/ideas/:id retrieves the specific idea by ID',
      getData
    );

    // Test 6: PUT /api/ideas/:id - Update idea
    const updateRes = await fetch(`${BASE_URL}/api/ideas/${createdId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Test Idea Title' }),
    });
    const updateData = await updateRes.json();
    assert(
      updateRes.status === 200 &&
        updateData.success === true &&
        updateData.idea.title === 'Updated Test Idea Title',
      'PUT /api/ideas/:id updates idea and preserves ID',
      updateData
    );

    // Test 7: DELETE /api/ideas/:id - Delete idea and record tombstone
    const deleteRes = await fetch(`${BASE_URL}/api/ideas/${createdId}`, {
      method: 'DELETE',
    });
    const deleteData = await deleteRes.json();
    assert(
      deleteRes.status === 200 && deleteData.success === true && deleteData.id === createdId,
      'DELETE /api/ideas/:id deletes idea from vault',
      deleteData
    );

    // Test 8: Verify deletion persists
    const getDeletedRes = await fetch(`${BASE_URL}/api/ideas/${createdId}`);
    assert(
      getDeletedRes.status === 404,
      'GET /api/ideas/:id returns 404 after deletion'
    );

    // Test 9: POST /api/ideas/sync - Idempotent sync with mutations and tombstones
    const syncRes = await fetch(`${BASE_URL}/api/ideas/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mutations: [
          {
            id: 'sync-test-item-99',
            title: 'Synced Item from Client',
            category: 'systems',
            preview: 'Testing idempotent sync',
            content: 'Full synced content',
            tags: ['#sync'],
            updatedAt: new Date().toISOString(),
          },
        ],
        tombstones: [{ id: 'deleted-client-id-01', deletedAt: new Date().toISOString() }],
      }),
    });
    const syncData = await syncRes.json();
    assert(
      syncRes.status === 200 &&
        syncData.success === true &&
        syncData.syncedIds.includes('sync-test-item-99') &&
        syncData.tombstoneIds.includes('deleted-client-id-01'),
      'POST /api/ideas/sync handles mutations and tombstones idempotently',
      syncData
    );

    // Test 10: POST /api/bridge/test-connection - Diagnostic test
    const testConnRes = await fetch(`${BASE_URL}/api/bridge/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: 'http://127.0.0.1:3000/api',
        timeoutMs: 2000,
      }),
    });
    const testConnData = await testConnRes.json();
    assert(
      testConnRes.status === 200 && testConnData.reachable === true,
      'POST /api/bridge/test-connection measures reachability and latency',
      testConnData
    );

    // Test 11: POST /api/ai/brainstorm - Validation on empty prompt
    const emptyBrainstormRes = await fetch(`${BASE_URL}/api/ai/brainstorm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '' }),
    });
    assert(
      emptyBrainstormRes.status === 400,
      'POST /api/ai/brainstorm rejects empty prompt with 400 Bad Request'
    );

    // Test 12: POST /api/ai/brainstorm - Model configuration routing for Ollama via Bridge
    const ollamaRouteRes = await fetch(`${BASE_URL}/api/ai/brainstorm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Generate eBPF ring buffer microservice blueprint',
        model: 'ollama',
        bridgeUrl: 'http://127.0.0.1:8000', // Offline local bridge test
      }),
    });
    const ollamaRouteData = await ollamaRouteRes.json();
    assert(
      ollamaRouteRes.status === 503 &&
        ollamaRouteData.success === false &&
        ollamaRouteData.model === 'ollama' &&
        ollamaRouteData.error.includes('Laptop bridge Ollama unreachable'),
      'POST /api/ai/brainstorm routes to laptop bridge and returns honest 503 error when daemon is offline',
      ollamaRouteData
    );

    // Test 13: POST /api/ai/brainstorm - SSRF Protection on cloud metadata endpoint
    const ssrfBrainstormRes = await fetch(`${BASE_URL}/api/ai/brainstorm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Security probe',
        model: 'ollama',
        bridgeUrl: 'http://169.254.169.254/latest/meta-data/',
      }),
    });
    const ssrfBrainstormData = await ssrfBrainstormRes.json();
    assert(
      ssrfBrainstormRes.status === 400 &&
        ssrfBrainstormData.error.includes('SSRF prevention'),
      'POST /api/ai/brainstorm blocks SSRF attempts against cloud metadata services with 400 Bad Request',
      ssrfBrainstormData
    );

    // Test 14: POST /api/bridge/test-connection - SSRF Protection on probe endpoint
    const ssrfProbeRes = await fetch(`${BASE_URL}/api/bridge/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: 'http://169.254.169.254/computeMetadata/v1/',
      }),
    });
    const ssrfProbeData = await ssrfProbeRes.json();
    assert(
      ssrfProbeRes.status === 400 &&
        ssrfProbeData.isSsrfBlocked === true,
      'POST /api/bridge/test-connection blocks SSRF probe targets with 400 Bad Request',
      ssrfProbeData
    );

    // Test 15: GET /api/repos - List connected repositories
    const reposRes = await fetch(`${BASE_URL}/api/repos`);
    const reposData = await reposRes.json();
    assert(
      reposRes.status === 200 &&
        reposData.success === true &&
        Array.isArray(reposData.repos) &&
        reposData.repos.length >= 2,
      'GET /api/repos returns connected repositories with status and metadata',
      reposData
    );

    // Test 16: POST /api/repos/connect - Connect new repository
    const connectRes = await fetch(`${BASE_URL}/api/repos/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'wasm-kv-store',
        owner: 'idea-beacon',
        url: 'https://github.com/idea-beacon/wasm-kv-store',
        branch: 'main',
        isLocalBridgeLinked: true,
      }),
    });
    const connectData = await connectRes.json();
    assert(
      (connectRes.status === 201 || connectRes.status === 200) &&
        connectData.success === true &&
        connectData.repo.name === 'wasm-kv-store',
      'POST /api/repos/connect connects and registers new repository reference',
      connectData
    );

    // Test 17: GET /api/repos/:id/diffs - Inspect structured file diffs with hunks
    const diffsRes = await fetch(`${BASE_URL}/api/repos/repo-hyperstream-ebpf/diffs`);
    const diffsData = await diffsRes.json();
    assert(
      diffsRes.status === 200 &&
        diffsData.success === true &&
        Array.isArray(diffsData.diffs) &&
        diffsData.diffs.length > 0 &&
        diffsData.diffs[0].hunks.length > 0,
      'GET /api/repos/:id/diffs returns structured file diffs with hunks, line numbers, and additions',
      diffsData
    );

    // Propose fresh diff proposal for repo-hyperstream-ebpf to ensure idempotent test runs
    await fetch(`${BASE_URL}/api/repos/repo-hyperstream-ebpf/propose-diff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'aya-trace: Attach kprobe:tcp_connect & ringbuf export',
        description: 'Generates kernel socket trace buffer probe implementation from idea spec.',
        sourceIdeaTitle: 'HyperStream Probe (eBPF)',
      }),
    });

    // Test 18: POST /api/repos/:id/apply - Gate protection rejects unconfirmed commit
    const unconfirmedApplyRes = await fetch(`${BASE_URL}/api/repos/repo-hyperstream-ebpf/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmed: false,
      }),
    });
    const unconfirmedApplyData = await unconfirmedApplyRes.json();
    assert(
      unconfirmedApplyRes.status === 403 &&
        unconfirmedApplyData.requiresApproval === true &&
        unconfirmedApplyData.error.includes('Hold-to-Confirm'),
      'POST /api/repos/:id/apply enforces Hold-to-Confirm approval gate (rejects with 403 without confirmation)',
      unconfirmedApplyData
    );

    // Test 19: POST /api/repos/:id/apply - Successfully commits when confirmed
    const confirmedApplyRes = await fetch(`${BASE_URL}/api/repos/repo-hyperstream-ebpf/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmed: true,
        commitMessage: 'feat(trace): verified kprobe tcp trace via Hold-to-Confirm gate',
      }),
    });
    const confirmedApplyData = await confirmedApplyRes.json();
    assert(
      confirmedApplyRes.status === 200 &&
        confirmedApplyData.success === true &&
        confirmedApplyData.commitHash &&
        confirmedApplyData.repo.activeProposal.status === 'committed',
      'POST /api/repos/:id/apply commits changes when confirmed via Hold-to-Confirm gate and returns new commit hash',
      confirmedApplyData
    );

    console.log(`\n🏁 Test Run Finished: ${passed} passed, ${failed} failed.\n`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
