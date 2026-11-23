import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { startFakeSupabase } from "./helpers/fake-supabase.mjs";
import { startControlPlane } from "./helpers/control-plane.mjs";
import { ALLOWED_EMAILS, USERS } from "./helpers/fixtures.mjs";

const REASON = "integration test run";

describe("two-step command flow (prepare → execute)", () => {
  let supabase;
  let cp;

  async function prepare(token, body) {
    return cp.post("/api/commands/prepare", {
      token,
      body: { reason: REASON, dryRun: true, ...body },
    });
  }

  async function execute(token, prepared, overrides = {}) {
    return cp.post("/api/commands/execute", {
      token,
      body: {
        commandId: prepared.commandId,
        confirmationToken: prepared.confirmationToken,
        confirmText: "CONFIRM",
        ...overrides,
      },
    });
  }

  function confirmationRow(prepared) {
    return supabase
      .rows("control_plane_confirmations")
      .find((row) => row.metadata?.commandId === prepared.commandId);
  }

  before(async () => {
    supabase = await startFakeSupabase({
      users: USERS,
      tables: {
        events: [
          { id: "e-old", title: "old", created_at: "2020-01-01T00:00:00.000Z" },
          { id: "e-new", title: "new", created_at: "2999-01-01T00:00:00.000Z" },
        ],
      },
      functions: {
        "import-atcl-lazio": () => ({ body: { imported: 3 } }),
        "import-spazio-rossellini": () => ({ status: 502, body: { error: "upstream down" } }),
      },
    });
    cp = await startControlPlane({
      supabaseUrl: supabase.url,
      env: {
        CONTROL_PLANE_ALLOWED_EMAILS: ALLOWED_EMAILS,
        // Audit tables are listed on purpose: the hard denylist must still win.
        CONTROL_PLANE_DB_MUTATE_ALLOWLIST: "events,control_plane_audit,control_plane_roles",
        CONTROL_PLANE_DB_READ_ALLOWLIST: "events,control_plane_executions",
      },
    });
  });

  after(async () => {
    await cp?.stop();
    await supabase?.close();
  });

  beforeEach(() => supabase.clearRequests());

  describe("prepare", () => {
    test("rejects commands outside the allowlist", async () => {
      const res = await prepare("tok-operator", { commandId: "shell.exec" });
      assert.equal(res.status, 400);
    });

    test("requires a reason of at least 8 characters", async () => {
      const res = await prepare("tok-operator", { commandId: "supabase.db.read", reason: "short" });
      assert.equal(res.status, 400);
    });

    test("enforces the command's own minimum role", async () => {
      const res = await prepare("tok-operator", { commandId: "supabase.db.mutate", target: "events" });
      assert.equal(res.status, 403);
    });

    test("creates a pending confirmation row and never stores the raw token", async () => {
      const res = await prepare("tok-operator", {
        commandId: "supabase.db.read",
        target: "events",
        payload: { table: "events", password: "hunter2", apiKey: "abc" },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.dryRun, true);
      assert.match(res.body.commandId, /^cmd_/);
      assert.ok(res.body.confirmationToken.length >= 32);

      const row = confirmationRow(res.body);
      assert.equal(row.status, "pending");
      assert.equal(row.requested_by, USERS["tok-operator"].id);
      assert.equal(row.metadata.payload.password, "[redacted]");
      assert.equal(row.metadata.payload.apiKey, "[redacted]");
      assert.doesNotMatch(JSON.stringify(supabase.rows("control_plane_confirmations")), new RegExp(res.body.confirmationToken));
      assert.doesNotMatch(JSON.stringify(supabase.rows("control_plane_audit")), new RegExp(res.body.confirmationToken));
    });

    test("defaults to dry-run when dryRun is omitted", async () => {
      const res = await cp.post("/api/commands/prepare", {
        token: "tok-operator",
        body: { commandId: "supabase.db.read", target: "events", reason: REASON },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.dryRun, true);
    });
  });

  describe("execute guards", () => {
    test("requires commandId and confirmationToken", async () => {
      const res = await cp.post("/api/commands/execute", {
        token: "tok-operator",
        body: { commandId: "cmd_x", confirmText: "CONFIRM" },
      });
      assert.equal(res.status, 400);
    });

    test("unknown commandId and token is 404", async () => {
      const res = await execute("tok-operator", { commandId: "cmd_missing", confirmationToken: "nope" });
      assert.equal(res.status, 404);
    });

    test("a wrong confirmation token does not unlock a real commandId", async () => {
      const prepared = (await prepare("tok-operator", { commandId: "supabase.db.read", target: "events" })).body;
      const res = await execute("tok-operator", prepared, { confirmationToken: "not-the-token" });
      assert.equal(res.status, 404);
      assert.equal(confirmationRow(prepared).status, "pending");

      // The genuine token still works afterwards.
      const ok = await execute("tok-operator", prepared);
      assert.equal(ok.status, 200);
    });

    test("a token from one command cannot execute another command", async () => {
      const first = (await prepare("tok-operator", { commandId: "supabase.db.read", target: "events" })).body;
      const second = (await prepare("tok-operator", { commandId: "supabase.db.read", target: "events" })).body;
      const res = await execute("tok-operator", { commandId: second.commandId, confirmationToken: first.confirmationToken });
      assert.equal(res.status, 404);
    });

    test("another operator cannot execute someone else's command", async () => {
      const prepared = (await prepare("tok-operator", { commandId: "supabase.db.read", target: "events" })).body;
      const res = await execute("tok-operator2", prepared);
      assert.equal(res.status, 403);
      // Still pending for the owner.
      const ok = await execute("tok-operator", prepared);
      assert.equal(ok.status, 200);
    });

    test("dev_admin can execute a command prepared by an operator", async () => {
      const prepared = (await prepare("tok-operator", { commandId: "supabase.db.read", target: "events" })).body;
      const res = await execute("tok-admin", prepared);
      assert.equal(res.status, 200);
      assert.equal(confirmationRow(prepared).approved_by, USERS["tok-admin"].id);
    });

    test("wrong confirmText consumes the confirmation and marks it rejected", async () => {
      const prepared = (await prepare("tok-operator", { commandId: "supabase.db.read", target: "events" })).body;
      const res = await execute("tok-operator", prepared, { confirmText: "confirm" });
      assert.equal(res.status, 400);
      assert.equal(confirmationRow(prepared).status, "rejected");

      const retry = await execute("tok-operator", prepared);
      assert.equal(retry.status, 404);
    });

    test("a confirmation can be executed only once", async () => {
      const prepared = (await prepare("tok-operator", { commandId: "supabase.db.read", target: "events" })).body;
      assert.equal((await execute("tok-operator", prepared)).status, 200);
      assert.equal((await execute("tok-operator", prepared)).status, 404);
    });

    test("concurrent executes of the same confirmation run it once", async () => {
      const prepared = (await prepare("tok-operator", { commandId: "supabase.db.read", target: "events" })).body;
      const results = await Promise.all([execute("tok-operator", prepared), execute("tok-operator", prepared)]);
      const statuses = results.map((r) => r.status).sort();
      assert.equal(statuses.filter((s) => s === 200).length, 1, `statuses: ${statuses}`);
    });
  });

  describe("execution", () => {
    test("dry-run writes execution log, approves confirmation and audits, without touching data", async () => {
      const prepared = (
        await prepare("tok-admin", {
          commandId: "supabase.db.mutate",
          target: "events",
          payload: { table: "events", action: "delete", match: { id: "e-new" } },
        })
      ).body;
      const res = await execute("tok-admin", prepared);
      assert.equal(res.status, 200);
      assert.equal(res.body.dryRun, true);
      assert.equal(res.body.status, "completed");

      const execution = supabase.rows("control_plane_executions").find((row) => row.id === res.body.executionId);
      assert.equal(execution.status, "succeeded");
      assert.equal(execution.operation, "supabase.db.mutate");
      assert.equal(execution.executed_by, USERS["tok-admin"].id);
      assert.equal(confirmationRow(prepared).status, "approved");

      const audit = supabase.rows("control_plane_audit").find(
        (row) => row.action === "command.execute" && row.resource_id === prepared.commandId
      );
      assert.equal(audit.metadata.dryRun, true);
      assert.ok(supabase.rows("events").some((row) => row.id === "e-new"));

      const writes = supabase.requests.filter((r) => r.path === "/rest/v1/events" && r.method !== "GET");
      assert.equal(writes.length, 0);
    });

    test("internal writes go through the service role key", async () => {
      const prepared = (await prepare("tok-operator", { commandId: "supabase.db.read", target: "events" })).body;
      await execute("tok-operator", prepared);
      const internal = supabase.requests.filter((r) =>
        ["/rest/v1/control_plane_confirmations", "/rest/v1/control_plane_executions", "/rest/v1/control_plane_audit"].includes(r.path)
      );
      assert.ok(internal.length >= 3);
      for (const req of internal) {
        assert.equal(req.headers.apikey, "test-service-role-key", `${req.method} ${req.path}`);
      }
    });

    test("supabase.db.read refuses tables outside the read allowlist", async () => {
      const prepared = (
        await prepare("tok-operator", { commandId: "supabase.db.read", target: "users", dryRun: false })
      ).body;
      const res = await execute("tok-operator", prepared);
      assert.equal(res.status, 200);
      assert.equal(res.body.status, "failed");
      assert.match(res.body.message, /allowlist/);
    });

    test("supabase.db.read returns rows from allowlisted tables", async () => {
      const prepared = (
        await prepare("tok-operator", {
          commandId: "supabase.db.read",
          target: "events",
          dryRun: false,
          payload: { table: "events", filters: [{ column: "id", op: "eq", value: "e-old" }] },
        })
      ).body;
      const res = await execute("tok-operator", prepared);
      assert.equal(res.body.status, "completed");
      assert.deepEqual(
        res.body.result.rows.map((row) => row.id),
        ["e-old"]
      );
    });

    test("supabase.db.mutate never touches control-plane tables, even if allowlisted via env", async () => {
      for (const table of ["control_plane_audit", "control_plane_roles", "public.control_plane_roles"]) {
        const prepared = (
          await prepare("tok-admin", {
            commandId: "supabase.db.mutate",
            target: table,
            dryRun: false,
            payload: { table, action: "insert", values: { user_id: "x", role: "dev_admin" } },
          })
        ).body;
        const res = await execute("tok-admin", prepared);
        assert.equal(res.body.status, "failed", table);
        assert.match(res.body.message, /allowlist/);
      }
      assert.ok(!supabase.rows("control_plane_roles").some((row) => row.user_id === "x"));
    });

    test("supabase.events.cleanup deletes only rows older than the threshold", async () => {
      const prepared = (
        await prepare("tok-operator", {
          commandId: "supabase.events.cleanup",
          target: "events",
          dryRun: false,
          payload: { table: "events", days: 30 },
        })
      ).body;
      const res = await execute("tok-operator", prepared);
      assert.equal(res.body.status, "completed");
      assert.equal(res.body.result.deletedRows, 1);
      assert.deepEqual(
        supabase.rows("events").map((row) => row.id),
        ["e-new"]
      );
    });

    test("supabase.events.cleanup rejects an unsafe timestamp column", async () => {
      const prepared = (
        await prepare("tok-operator", {
          commandId: "supabase.events.cleanup",
          target: "events",
          dryRun: false,
          payload: { table: "events", timestampColumn: "created_at;drop" },
        })
      ).body;
      const res = await execute("tok-operator", prepared);
      assert.equal(res.body.status, "failed");
    });

    test("supabase.events.import only calls allowlisted functions", async () => {
      const prepared = (
        await prepare("tok-operator", {
          commandId: "supabase.events.import",
          target: "../admin",
          dryRun: false,
          payload: { source: "../admin" },
        })
      ).body;
      const res = await execute("tok-operator", prepared);
      assert.equal(res.body.status, "failed");
      assert.equal(supabase.requests.filter((r) => r.path.startsWith("/functions/")).length, 0);
    });

    test("supabase.events.import clamps lookback_days and reports success", async () => {
      const prepared = (
        await prepare("tok-operator", {
          commandId: "supabase.events.import",
          target: "atcl-lazio",
          dryRun: false,
          payload: { source: "atcl-lazio", lookback_days: 99999 },
        })
      ).body;
      const res = await execute("tok-operator", prepared);
      assert.equal(res.body.status, "completed");
      assert.deepEqual(res.body.result, { imported: 3 });
      const call = supabase.requests.find((r) => r.path === "/functions/v1/import-atcl-lazio");
      assert.equal(call.query.lookback_days, "730");
    });

    test("supabase.events.import surfaces edge function failures", async () => {
      const prepared = (
        await prepare("tok-operator", {
          commandId: "supabase.events.import",
          target: "spazio-rossellini",
          dryRun: false,
        })
      ).body;
      const res = await execute("tok-operator", prepared);
      assert.equal(res.body.status, "failed");
      assert.match(res.body.message, /502/);
      const execution = supabase.rows("control_plane_executions").find((row) => row.id === res.body.executionId);
      assert.equal(execution.status, "failed");
    });

    test("render.deployments.trigger fails closed for services outside the registry", async () => {
      const prepared = (
        await prepare("tok-operator", {
          commandId: "render.deployments.trigger",
          target: "srv-not-registered",
          dryRun: false,
        })
      ).body;
      const res = await execute("tok-operator", prepared);
      assert.equal(res.body.status, "failed");
      assert.match(res.body.message, /allowlistato/);
    });
  });

  describe("execution lookup", () => {
    let executionId;

    before(async () => {
      const prepared = (await prepare("tok-operator", { commandId: "supabase.db.read", target: "events" })).body;
      executionId = (await execute("tok-operator", prepared)).body.executionId;
    });

    test("owner can read their execution", async () => {
      const res = await cp.get(`/api/commands/executions/${executionId}`, { token: "tok-operator" });
      assert.equal(res.status, 200);
      assert.equal(res.body.execution.id, executionId);
    });

    test("other non-admin users cannot read it", async () => {
      for (const token of ["tok-operator2", "tok-viewer"]) {
        const res = await cp.get(`/api/commands/executions/${executionId}`, { token });
        assert.equal(res.status, 403, token);
      }
    });

    test("dev_admin can read any execution", async () => {
      const res = await cp.get(`/api/commands/executions/${executionId}`, { token: "tok-admin" });
      assert.equal(res.status, 200);
    });

    test("unknown execution is 404", async () => {
      const res = await cp.get("/api/commands/executions/does-not-exist", { token: "tok-admin" });
      assert.equal(res.status, 404);
    });
  });
});

describe("confirmation expiry", () => {
  let supabase;
  let cp;

  before(async () => {
    supabase = await startFakeSupabase({ users: USERS });
    cp = await startControlPlane({
      supabaseUrl: supabase.url,
      env: { CONTROL_PLANE_ALLOWED_EMAILS: ALLOWED_EMAILS, CONTROL_PLANE_CONFIRM_TTL_MS: "5000" },
    });
  });

  after(async () => {
    await cp?.stop();
    await supabase?.close();
  });

  test("an expired confirmation cannot be executed", { timeout: 15_000 }, async () => {
    const prepared = (
      await cp.post("/api/commands/prepare", {
        token: "tok-operator",
        body: { commandId: "supabase.db.read", target: "events", reason: REASON },
      })
    ).body;
    await new Promise((resolve) => setTimeout(resolve, 5_200));
    const res = await cp.post("/api/commands/execute", {
      token: "tok-operator",
      body: { commandId: prepared.commandId, confirmationToken: prepared.confirmationToken, confirmText: "CONFIRM" },
    });
    assert.ok([404, 410].includes(res.status), `status ${res.status}`);
    const row = supabase.rows("control_plane_confirmations").find((r) => r.metadata?.commandId === prepared.commandId);
    assert.notEqual(row.status, "approved");
    assert.equal(supabase.rows("control_plane_executions").length, 0);
  });
});

describe("global DRY_RUN", () => {
  let supabase;
  let cp;

  before(async () => {
    supabase = await startFakeSupabase({
      users: USERS,
      tables: { events: [{ id: "e1", created_at: "2000-01-01T00:00:00.000Z" }] },
    });
    cp = await startControlPlane({
      supabaseUrl: supabase.url,
      env: {
        CONTROL_PLANE_ALLOWED_EMAILS: ALLOWED_EMAILS,
        CONTROL_PLANE_DB_MUTATE_ALLOWLIST: "events",
        DRY_RUN: "true",
      },
    });
  });

  after(async () => {
    await cp?.stop();
    await supabase?.close();
  });

  test("overrides dryRun:false on prepare, execute and direct mutate", async () => {
    const prepared = (
      await cp.post("/api/commands/prepare", {
        token: "tok-operator",
        body: { commandId: "supabase.events.cleanup", target: "events", reason: REASON, dryRun: false },
      })
    ).body;
    assert.equal(prepared.dryRun, true);
    const res = await cp.post("/api/commands/execute", {
      token: "tok-operator",
      body: { commandId: prepared.commandId, confirmationToken: prepared.confirmationToken, confirmText: "CONFIRM", dryRun: false },
    });
    assert.equal(res.body.dryRun, true);

    const mutate = await cp.post("/api/supabase/db/mutate", {
      token: "tok-admin",
      body: { table: "events", action: "delete", match: { id: "e1" }, dryRun: false },
    });
    assert.equal(mutate.body.dryRun, true);
    assert.equal(supabase.rows("events").length, 1);
  });
});
