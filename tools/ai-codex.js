#!/usr/bin/env node

const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawn } = require("node:child_process");

const argv = process.argv.slice(2);
const shouldPrint = argv.includes("--print");

const templatePath = process.env.AI_PROMPT_TEMPLATE
  ? resolve(process.env.AI_PROMPT_TEMPLATE)
  : resolve("docs/prompt-template.md");

const template = readFileSync(templatePath, "utf-8");

const context = {
  repo_name: process.env.AI_REPO_NAME ?? "",
  repo_overview: process.env.AI_REPO_OVERVIEW ?? "",
  current_branch: process.env.AI_BRANCH ?? "",
  issue_title: process.env.AI_ISSUE_TITLE ?? "",
  issue_body: process.env.AI_ISSUE_BODY ?? "",
  user_request: process.env.AI_USER_REQUEST ?? "",
  target_flow: process.env.AI_TARGET_FLOW ?? "",
  relevant_files: process.env.AI_RELEVANT_FILES ?? "",
  acceptance_criteria: process.env.AI_ACCEPTANCE_CRITERIA ?? "",
  constraints: process.env.AI_CONSTRAINTS ?? "",
  additional_context: process.env.AI_ADDITIONAL_CONTEXT ?? "",
};

const missingFields = Object.entries(context)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingFields.length > 0) {
  process.stderr.write(
    `Warning: missing AI template values: ${missingFields.join(", ")}\n`
  );
}

let prompt = template;
for (const [key, value] of Object.entries(context)) {
  const pattern = new RegExp(`{{\\s*${key}\\s*}}`, "g");
  prompt = prompt.replace(pattern, value);
}

if (shouldPrint) {
  process.stdout.write(prompt);
  process.exit(0);
}

/** Parse a shell-like argument string, respecting single and double quotes. */
function parseShellArgs(str) {
  const args = [];
  const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+)/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    let arg = m[1];
    if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
      arg = arg.slice(1, -1);
    }
    args.push(arg);
  }
  return args;
}

const codexBin = process.env.CODEX_BIN ?? "codex";
const codexArgs = process.env.CODEX_ARGS ? parseShellArgs(process.env.CODEX_ARGS) : [];
const child = spawn(codexBin, codexArgs, { stdio: ["pipe", "inherit", "inherit"] });

child.on("error", (error) => {
  process.stderr.write(`Failed to start codex: ${error.message}\n`);
  process.exit(1);
});

child.stdin.write(prompt);
child.stdin.end();

child.on("close", (code) => {
  process.exit(code ?? 1);
});
