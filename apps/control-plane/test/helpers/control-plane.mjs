// Boots the real control-plane server (src/server.mjs) in a child process,
// pointed at a fake Supabase, on a free local port with an isolated pending store.
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_ENTRY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/server.mjs");

export const ANON_KEY = "test-anon-key";
export const SERVICE_ROLE_KEY = "test-service-role-key";

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

export async function startControlPlane({ supabaseUrl, env = {} } = {}) {
  const port = await freePort();
  // A fresh cwd keeps dotenv from loading a developer's local .env.
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "control-plane-test-"));

  const child = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: workDir,
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      CONTROL_PLANE_PORT: String(port),
      CONTROL_PLANE_PENDING_STORE_PATH: path.join(workDir, "pending-confirmations.json"),
      CONTROL_PLANE_RATE_LIMIT_PER_MIN: "5000",
      SUPABASE_URL: supabaseUrl || "",
      SUPABASE_ANON_KEY: ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10_000;
  for (;;) {
    if (child.exitCode !== null) {
      throw new Error(`control-plane exited early (${child.exitCode}):\n${output}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`control-plane did not start in time:\n${output}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  async function request(method, urlPath, { token, body, headers = {} } = {}) {
    const response = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: response.status, headers: response.headers, body: json };
  }

  return {
    baseUrl,
    workDir,
    output: () => output,
    get: (urlPath, options) => request("GET", urlPath, options),
    post: (urlPath, options) => request("POST", urlPath, options),
    request,
    stop: async () => {
      if (child.exitCode === null) {
        const exited = new Promise((resolve) => child.once("exit", resolve));
        child.kill();
        await exited;
      }
      fs.rmSync(workDir, { recursive: true, force: true });
    },
  };
}
