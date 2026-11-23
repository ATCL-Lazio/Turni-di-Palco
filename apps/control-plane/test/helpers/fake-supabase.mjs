// In-memory stand-in for the parts of Supabase the control-plane talks to:
// GoTrue `GET /auth/v1/user`, a small PostgREST subset on `/rest/v1/<table>`,
// and edge functions on `/functions/v1/<name>`. Every request is recorded so
// tests can assert which key reached which endpoint.
import http from "node:http";
import crypto from "node:crypto";

const RESERVED_PARAMS = new Set(["select", "limit", "order", "offset", "or", "columns", "on_conflict"]);

function matchesFilter(row, column, rawFilter) {
  const dot = rawFilter.indexOf(".");
  const op = rawFilter.slice(0, dot);
  const value = rawFilter.slice(dot + 1);
  const current = row[column];

  switch (op) {
    case "eq":
      return String(current) === value;
    case "neq":
      return String(current) !== value;
    case "is":
      return value === "null" ? current === null || current === undefined : String(current) === value;
    case "in": {
      const list = value.replace(/^\(|\)$/g, "").split(",");
      return list.includes(String(current));
    }
    case "lt":
      return current !== undefined && current !== null && String(current) < value;
    case "lte":
      return current !== undefined && current !== null && String(current) <= value;
    case "gt":
      return current !== undefined && current !== null && String(current) > value;
    case "gte":
      return current !== undefined && current !== null && String(current) >= value;
    default:
      return true;
  }
}

function applyFilters(rows, searchParams) {
  let result = rows;
  for (const [key, value] of searchParams.entries()) {
    if (RESERVED_PARAMS.has(key)) continue;
    result = result.filter((row) => matchesFilter(row, key, value));
  }
  return result;
}

function project(rows, select) {
  if (!select || select === "*") return rows.map((row) => ({ ...row }));
  const columns = select.split(",").map((column) => column.trim());
  return rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? null])));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(raw);
      }
    });
  });
}

export async function startFakeSupabase({ users = {}, tables = {}, functions = {} } = {}) {
  const db = new Map(Object.entries(tables).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]));
  const requests = [];

  function tableRows(name) {
    if (!db.has(name)) db.set(name, []);
    return db.get(name);
  }

  function send(res, status, body, headers = {}) {
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(body === undefined ? "" : JSON.stringify(body));
  }

  function sendRows(req, res, rows, { total, status = 200 } = {}) {
    const wantsObject = String(req.headers.accept || "").includes("vnd.pgrst.object");
    const headers = {};
    if (String(req.headers.prefer || "").includes("count=exact")) {
      const count = total ?? rows.length;
      headers["content-range"] = count === 0 ? "*/0" : `0-${rows.length - 1}/${count}`;
    }
    if (wantsObject) {
      if (rows.length !== 1) {
        return send(res, 406, {
          code: "PGRST116",
          message: "JSON object requested, multiple (or no) rows returned",
          details: `The result contains ${rows.length} rows`,
          hint: null,
        });
      }
      return send(res, status, rows[0], headers);
    }
    if (req.method === "HEAD") return send(res, status, undefined, headers);
    return send(res, status, rows, headers);
  }

  async function handleRest(req, res, url) {
    const table = decodeURIComponent(url.pathname.slice("/rest/v1/".length));
    const rows = tableRows(table);
    const select = url.searchParams.get("select");
    const returning = String(req.headers.prefer || "").includes("return=representation");

    if (req.method === "GET" || req.method === "HEAD") {
      const matched = applyFilters(rows, url.searchParams);
      const limit = Number.parseInt(url.searchParams.get("limit") || "", 10);
      const limited = Number.isFinite(limit) ? matched.slice(0, limit) : matched;
      return sendRows(req, res, project(limited, select), { total: matched.length });
    }

    const body = await readBody(req);
    requests[requests.length - 1].body = body;

    if (req.method === "POST") {
      const incoming = Array.isArray(body) ? body : [body];
      const created = incoming.map((row) => ({
        id: row.id ?? crypto.randomUUID(),
        created_at: new Date().toISOString(),
        ...row,
      }));
      rows.push(...created);
      return returning ? sendRows(req, res, project(created, select), { status: 201 }) : send(res, 201);
    }

    if (req.method === "PATCH") {
      const matched = applyFilters(rows, url.searchParams);
      for (const row of matched) Object.assign(row, body);
      return returning ? sendRows(req, res, project(matched, select)) : send(res, 204);
    }

    if (req.method === "DELETE") {
      const matched = applyFilters(rows, url.searchParams);
      db.set(
        table,
        rows.filter((row) => !matched.includes(row))
      );
      return returning ? sendRows(req, res, project(matched, select)) : send(res, 204);
    }

    return send(res, 405, { message: "method not allowed" });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://fake.local");
    const entry = {
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      headers: { ...req.headers },
      body: undefined,
    };
    requests.push(entry);

    try {
      if (url.pathname === "/auth/v1/user") {
        const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
        const user = users[token];
        if (!user) {
          return send(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
        }
        return send(res, 200, {
          aud: "authenticated",
          role: "authenticated",
          app_metadata: {},
          user_metadata: {},
          ...user,
        });
      }

      if (url.pathname.startsWith("/rest/v1/")) {
        return await handleRest(req, res, url);
      }

      if (url.pathname.startsWith("/functions/v1/")) {
        entry.body = await readBody(req);
        const name = url.pathname.slice("/functions/v1/".length);
        const handler = functions[name];
        if (!handler) return send(res, 404, { error: `function ${name} not found` });
        const { status = 200, body } = handler(entry);
        return send(res, status, body);
      }

      return send(res, 404, { message: "not found" });
    } catch (error) {
      return send(res, 500, { message: String(error?.message || error) });
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    rows: (table) => tableRows(table),
    clearRequests: () => {
      requests.length = 0;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
