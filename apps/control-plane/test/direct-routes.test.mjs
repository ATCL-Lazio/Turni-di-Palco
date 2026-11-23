import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { startFakeSupabase } from "./helpers/fake-supabase.mjs";
import { ANON_KEY, SERVICE_ROLE_KEY, startControlPlane } from "./helpers/control-plane.mjs";
import { ALLOWED_EMAILS, USERS } from "./helpers/fixtures.mjs";

describe("direct privileged routes", () => {
  let supabase;
  let cp;

  before(async () => {
    supabase = await startFakeSupabase({
      users: USERS,
      tables: {
        events: [
          { id: "e1", title: "uno", status: "draft" },
          { id: "e2", title: "due", status: "live" },
        ],
        secrets_table: [{ id: "s1", value: "classified" }],
        control_plane_audit: [
          { id: "a1", action: "db.read", actor_user_id: "u", metadata: { result: "error", reason: "boom" } },
        ],
        control_plane_executions: [
          { id: "x1", operation: "supabase.db.read", status: "succeeded", started_at: "2026-01-01T00:00:00.000Z", finished_at: "2026-01-01T00:00:02.000Z" },
        ],
      },
      functions: {
        "app-version": () => ({ body: { version: "1.4.2" } }),
      },
    });
    cp = await startControlPlane({
      supabaseUrl: supabase.url,
      env: {
        CONTROL_PLANE_ALLOWED_EMAILS: ALLOWED_EMAILS,
        CONTROL_PLANE_DB_MUTATE_ALLOWLIST: "events,control_plane_executions",
        CONTROL_PLANE_DB_READ_ALLOWLIST: "events,control_plane_audit,control_plane_executions",
        CONTROL_PLANE_ALLOWED_ORIGINS: "https://console.example.test",
        RENDER_SERVICE_IDS_JSON: JSON.stringify([{ id: "srv-allowed", name: "api" }]),
      },
    });
  });

  after(async () => {
    await cp?.stop();
    await supabase?.close();
  });

  beforeEach(() => supabase.clearRequests());

  describe("POST /api/supabase/db/read", () => {
    test("viewer can read an allowlisted table with filters and limit", async () => {
      const res = await cp.post("/api/supabase/db/read", {
        token: "tok-viewer",
        body: { table: "public.events", filters: { eq: { status: "live" } }, limit: 10 },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.table, "events");
      assert.deepEqual(
        res.body.rows.map((row) => row.id),
        ["e2"]
      );
    });

    test("tables outside the allowlist are 403", async () => {
      const res = await cp.post("/api/supabase/db/read", { token: "tok-admin", body: { table: "secrets_table" } });
      assert.equal(res.status, 403);
      assert.equal(supabase.requests.filter((r) => r.path === "/rest/v1/secrets_table").length, 0);
    });

    test("malformed table names are 400", async () => {
      for (const table of ["events;drop table x", "../events", "", "auth.users"]) {
        const res = await cp.post("/api/supabase/db/read", { token: "tok-admin", body: { table } });
        assert.equal(res.status, 400, JSON.stringify(table));
      }
    });

    test("unsafe select clauses and filter columns are neutralised", async () => {
      const res = await cp.post("/api/supabase/db/read", {
        token: "tok-viewer",
        body: {
          table: "events",
          select: "id,title;delete",
          filters: { eq: { "status) or (1=1": "x" } },
        },
      });
      assert.equal(res.status, 200);
      const call = supabase.requests.find((r) => r.path === "/rest/v1/events");
      assert.equal(call.query.select, "*");
      assert.ok(!Object.keys(call.query).some((key) => key.includes(")")));
    });

    test("limit is clamped to 500", async () => {
      await cp.post("/api/supabase/db/read", { token: "tok-viewer", body: { table: "events", limit: 100000 } });
      const call = supabase.requests.find((r) => r.path === "/rest/v1/events");
      assert.equal(call.query.limit, "500");
    });
  });

  describe("POST /api/supabase/db/mutate", () => {
    test("control-plane tables stay denied even when allowlisted via env", async () => {
      const res = await cp.post("/api/supabase/db/mutate", {
        token: "tok-admin",
        body: { table: "control_plane_executions", action: "update", values: { status: "succeeded" }, match: { id: "x1" } },
      });
      assert.equal(res.status, 403);
    });

    test("tables outside the mutate allowlist are 403", async () => {
      const res = await cp.post("/api/supabase/db/mutate", {
        token: "tok-admin",
        body: { table: "secrets_table", action: "delete", match: { id: "s1" } },
      });
      assert.equal(res.status, 403);
      assert.equal(supabase.rows("secrets_table").length, 1);
    });

    test("operators cannot delete", async () => {
      const res = await cp.post("/api/supabase/db/mutate", {
        token: "tok-operator",
        body: { table: "events", action: "delete", match: { id: "e1" } },
      });
      assert.equal(res.status, 403);
      assert.equal(supabase.rows("events").length, 2);
    });

    test("update and delete without match are refused (no full-table writes)", async () => {
      for (const body of [
        { table: "events", action: "update", values: { status: "x" } },
        { table: "events", action: "delete" },
        { table: "events", action: "delete", match: { "id) or (1=1": "x" } },
      ]) {
        const res = await cp.post("/api/supabase/db/mutate", { token: "tok-admin", body });
        assert.notEqual(res.status, 200, JSON.stringify(body));
      }
      assert.ok(supabase.rows("events").every((row) => row.status !== "x"));
      assert.equal(supabase.rows("events").length, 2);
    });

    test("unknown actions are refused", async () => {
      const res = await cp.post("/api/supabase/db/mutate", {
        token: "tok-admin",
        body: { table: "events", action: "truncate" },
      });
      assert.equal(res.status, 400);
    });

    test("dryRun does not touch data but is audited", async () => {
      const res = await cp.post("/api/supabase/db/mutate", {
        token: "tok-admin",
        body: { table: "events", action: "delete", match: { id: "e1" }, dryRun: true },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.dryRun, true);
      assert.equal(supabase.rows("events").length, 2);
      const audit = supabase.rows("control_plane_audit").at(-1);
      assert.equal(audit.action, "db.mutate");
      assert.equal(audit.metadata.dryRun, true);
    });

    test("operator update applies only to matched rows and is audited", async () => {
      const res = await cp.post("/api/supabase/db/mutate", {
        token: "tok-operator",
        body: { table: "events", action: "update", values: { status: "archived" }, match: { id: "e1" } },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.affectedRows, 1);
      const byId = Object.fromEntries(supabase.rows("events").map((row) => [row.id, row.status]));
      assert.deepEqual(byId, { e1: "archived", e2: "live" });
      const audit = supabase.rows("control_plane_audit").at(-1);
      assert.equal(audit.actor_user_id, USERS["tok-operator"].id);
      assert.equal(audit.metadata.affectedRows, 1);
    });

    test("admin delete with match removes only that row", async () => {
      const res = await cp.post("/api/supabase/db/mutate", {
        token: "tok-admin",
        body: { table: "events", action: "delete", match: { id: "e1" } },
      });
      assert.equal(res.status, 200);
      assert.deepEqual(
        supabase.rows("events").map((row) => row.id),
        ["e2"]
      );
    });
  });

  describe("read-only dashboards", () => {
    test("audit feed maps rows for viewers", async () => {
      const res = await cp.get("/api/audit/recent?limit=5", { token: "tok-viewer" });
      assert.equal(res.status, 200);
      const entry = res.body.entries.find((row) => row.id === "a1");
      assert.equal(entry.result, "error");
      assert.equal(entry.reason, "boom");
    });

    test("db ops feed computes durations", async () => {
      const res = await cp.get("/api/db/ops", { token: "tok-viewer" });
      assert.equal(res.status, 200);
      const op = res.body.operations.find((row) => row.id === "x1");
      assert.equal(op.durationMs, 2000);
    });

    test("dashboard metrics report the caller's role", async () => {
      const res = await cp.get("/api/dashboard/metrics", { token: "tok-operator" });
      assert.equal(res.status, 200);
      const role = res.body.metrics.find((m) => m.id === "metric-role-level");
      assert.equal(role.value, "dev_operator");
    });

    test("dashboards require authentication", async () => {
      for (const url of ["/api/audit/recent", "/api/db/ops", "/api/dashboard/metrics", "/api/render/services"]) {
        const res = await cp.get(url);
        assert.equal(res.status, 401, url);
      }
    });
  });

  describe("Render routes", () => {
    test("deploy trigger refuses services outside the registry", async () => {
      const res = await cp.post("/api/render/deployments", {
        token: "tok-operator",
        body: { serviceId: "srv-someone-else", dryRun: true },
      });
      assert.equal(res.status, 400);
    });

    test("deploy trigger dry-run resolves registry names and is audited", async () => {
      const res = await cp.post("/api/render/deployments", {
        token: "tok-operator",
        body: { serviceId: "api", dryRun: true },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.serviceId, "srv-allowed");
      assert.equal(res.body.dryRun, true);
      const audit = supabase.rows("control_plane_audit").at(-1);
      assert.equal(audit.action, "render.deployments.trigger");
    });

    test("without RENDER_API_KEY the deployments list is 503, not a call with an empty key", async () => {
      const res = await cp.get("/api/render/deployments?serviceId=srv-allowed", { token: "tok-viewer" });
      assert.equal(res.status, 503);
    });

    test("services health reports unconfigured without RENDER_API_KEY", async () => {
      const res = await cp.get("/api/render/services/health", { token: "tok-viewer" });
      assert.equal(res.status, 200);
      assert.equal(res.body.source, "fallback_unconfigured");
      assert.equal(res.body.services[0].status, "unconfigured");
    });
  });

  describe("mobile version badge", () => {
    test("calls app-version with the anon key, never the service role key", async () => {
      const res = await cp.get("/api/badges/mobile-version");
      assert.equal(res.status, 200);
      assert.equal(res.body.message, "v1.4.2");

      const call = supabase.requests.find((r) => r.path === "/functions/v1/app-version");
      assert.ok(call, "app-version was not called");
      assert.equal(call.headers.apikey, ANON_KEY);
      assert.equal(call.headers.authorization, `Bearer ${ANON_KEY}`);
      assert.doesNotMatch(JSON.stringify(call.headers), new RegExp(SERVICE_ROLE_KEY));
    });
  });

  describe("CORS and headers", () => {
    test("unknown origins are refused before auth", async () => {
      const res = await cp.get("/api/commands/catalog", {
        token: "tok-admin",
        headers: { origin: "https://evil.example.test" },
      });
      assert.equal(res.status, 403);
      assert.equal(supabase.requests.filter((r) => r.path === "/auth/v1/user").length, 0);
    });

    test("allowed origin is echoed back, never a wildcard", async () => {
      const res = await cp.request("OPTIONS", "/api/commands/catalog", {
        headers: { origin: "https://console.example.test" },
      });
      assert.equal(res.status, 204);
      assert.equal(res.headers.get("access-control-allow-origin"), "https://console.example.test");
    });

    test("security headers are set", async () => {
      const res = await cp.get("/health");
      assert.equal(res.headers.get("x-frame-options"), "DENY");
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
      assert.equal(res.headers.get("x-powered-by"), null);
    });

    test("unknown endpoints are 404 JSON", async () => {
      const res = await cp.get("/api/nope");
      assert.equal(res.status, 404);
      assert.equal(res.body.ok, false);
    });
  });
});

describe("rate limiting", () => {
  let cp;

  before(async () => {
    cp = await startControlPlane({ supabaseUrl: "", env: { CONTROL_PLANE_RATE_LIMIT_PER_MIN: "3" } });
  });

  after(async () => {
    await cp?.stop();
  });

  test("requests past the per-minute limit get 429, health stays exempt", async () => {
    const statuses = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await cp.get("/api/commands/catalog")).status);
    assert.deepEqual(statuses.slice(0, 3), [401, 401, 401]);
    assert.deepEqual(statuses.slice(3), [429, 429]);
    assert.equal((await cp.get("/health")).status, 200);
  });

  test("the /api prefix does not give a second bucket", async () => {
    const res = await cp.get("/commands/catalog");
    assert.equal(res.status, 429);
  });
});
