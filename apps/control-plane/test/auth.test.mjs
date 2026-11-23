import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { startFakeSupabase } from "./helpers/fake-supabase.mjs";
import { startControlPlane } from "./helpers/control-plane.mjs";
import { ALLOWED_EMAILS, USERS, roleTableRows } from "./helpers/fixtures.mjs";

describe("session validation and role resolution", () => {
  let supabase;
  let cp;

  before(async () => {
    supabase = await startFakeSupabase({
      users: USERS,
      tables: { control_plane_roles: roleTableRows() },
    });
    cp = await startControlPlane({
      supabaseUrl: supabase.url,
      env: { CONTROL_PLANE_ALLOWED_EMAILS: ALLOWED_EMAILS },
    });
  });

  after(async () => {
    await cp?.stop();
    await supabase?.close();
  });

  test("health is public and does not leak keys", async () => {
    const res = await cp.get("/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.configuration.supabaseAdminConfigured, true);
    assert.doesNotMatch(JSON.stringify(res.body), /test-service-role-key|test-anon-key/);
  });

  test("missing bearer token is 401", async () => {
    const res = await cp.post("/api/auth/session/validate");
    assert.equal(res.status, 401);
    assert.equal(res.body.valid, false);
  });

  test("non-bearer authorization scheme is treated as missing", async () => {
    const res = await cp.post("/api/auth/session/validate", {
      headers: { authorization: "Basic tok-admin" },
    });
    assert.equal(res.status, 401);
  });

  test("token rejected by Supabase is 401", async () => {
    const res = await cp.post("/api/auth/session/validate", { token: "tok-unknown" });
    assert.equal(res.status, 401);
    assert.equal(res.body.valid, false);
  });

  test("valid user outside CONTROL_PLANE_ALLOWED_EMAILS is 403 even with admin claims", async () => {
    const res = await cp.post("/api/auth/session/validate", { token: "tok-stranger" });
    assert.equal(res.status, 403);
    assert.equal(res.body.valid, false);
  });

  test("email allowlist match is case-insensitive", async () => {
    const res = await cp.post("/api/auth/session/validate", { token: "tok-operator2" });
    assert.equal(res.status, 200);
    assert.equal(res.body.level, "dev_operator");
  });

  test("admin claim from app_metadata grants dev_admin", async () => {
    const res = await cp.post("/api/auth/session/validate", { token: "tok-admin" });
    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.level, "dev_admin");
    assert.equal(res.body.user.id, USERS["tok-admin"].id);
  });

  test("user_metadata roles never grant privileges", async () => {
    const res = await cp.post("/api/auth/session/validate", { token: "tok-viewer" });
    assert.equal(res.status, 200);
    assert.equal(res.body.level, "dev_viewer");
    assert.deepEqual(res.body.roles, ["dev_viewer"]);
  });

  test("role table roles apply and revoked rows are ignored", async () => {
    const res = await cp.post("/api/auth/session/validate", { token: "tok-table" });
    assert.equal(res.status, 200);
    assert.equal(res.body.level, "dev_operator");
    assert.deepEqual(res.body.roles, ["dev_operator"]);
  });

  test("role table is read with the service role key", async () => {
    const roleReads = supabase.requests.filter((r) => r.path === "/rest/v1/control_plane_roles");
    assert.ok(roleReads.length > 0);
    for (const read of roleReads) {
      assert.equal(read.headers.apikey, "test-service-role-key");
      assert.equal(read.query.revoked_at, "is.null");
    }
  });

  test("allowlisted email with no role falls back to dev_admin (documented behaviour)", async () => {
    const res = await cp.post("/api/auth/session/validate", { token: "tok-noroles" });
    assert.equal(res.status, 200);
    assert.equal(res.body.level, "dev_admin");
  });

  test("successful validation writes an audit row without the bearer token", async () => {
    supabase.clearRequests();
    const res = await cp.post("/api/auth/session/validate", {
      token: "tok-admin",
      body: { source: "test-suite", path: "/console" },
    });
    assert.equal(res.status, 200);
    const audit = supabase.rows("control_plane_audit").at(-1);
    assert.equal(audit.action, "auth.session.validate");
    assert.equal(audit.actor_user_id, USERS["tok-admin"].id);
    assert.equal(audit.metadata.source, "test-suite");
    assert.doesNotMatch(JSON.stringify(audit), /tok-admin/);
  });

  test("viewer can read the catalog but privileged commands are flagged unavailable", async () => {
    const res = await cp.get("/api/commands/catalog", { token: "tok-viewer" });
    assert.equal(res.status, 200);
    const byId = Object.fromEntries(res.body.commands.map((c) => [c.id, c]));
    assert.equal(byId["supabase.db.read"].available, true);
    assert.equal(byId["render.deployments.trigger"].available, false);
    assert.equal(byId["supabase.db.mutate"].available, false);
  });

  test("viewer is refused on operator-only routes", async () => {
    for (const [method, url] of [
      ["POST", "/api/commands/prepare"],
      ["POST", "/api/commands/execute"],
      ["POST", "/api/render/deployments"],
      ["POST", "/api/supabase/db/mutate"],
    ]) {
      const res = await cp.request(method, url, { token: "tok-viewer", body: {} });
      assert.equal(res.status, 403, `${method} ${url}`);
    }
  });

  test("protected routes are mounted under /control-plane too", async () => {
    const unauth = await cp.get("/control-plane/api/commands/catalog");
    assert.equal(unauth.status, 401);
    const ok = await cp.get("/control-plane/api/commands/catalog", { token: "tok-viewer" });
    assert.equal(ok.status, 200);
  });
});

describe("fail-closed configuration", () => {
  let supabase;
  let cp;

  before(async () => {
    supabase = await startFakeSupabase({ users: USERS });
    cp = await startControlPlane({
      supabaseUrl: supabase.url,
      // ALLOW_ANY_EMAIL must be ignored in production.
      env: { NODE_ENV: "production", CONTROL_PLANE_ALLOW_ANY_EMAIL: "true", CONTROL_PLANE_ALLOWED_EMAILS: "" },
    });
  });

  after(async () => {
    await cp?.stop();
    await supabase?.close();
  });

  test("empty email allowlist refuses every user, even in production with ALLOW_ANY_EMAIL", async () => {
    const res = await cp.post("/api/auth/session/validate", { token: "tok-admin" });
    assert.equal(res.status, 403);
    const catalog = await cp.get("/api/commands/catalog", { token: "tok-admin" });
    assert.equal(catalog.status, 403);
  });
});

describe("without Supabase configured", () => {
  let cp;

  before(async () => {
    cp = await startControlPlane({
      supabaseUrl: "",
      env: {
        SUPABASE_ANON_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        CONTROL_PLANE_ALLOWED_EMAILS: ALLOWED_EMAILS,
      },
    });
  });

  after(async () => {
    await cp?.stop();
  });

  test("authenticated routes answer 503 instead of letting requests through", async () => {
    const res = await cp.get("/api/commands/catalog", { token: "tok-admin" });
    assert.equal(res.status, 503);
  });
});
