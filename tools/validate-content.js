#!/usr/bin/env node
// Valida tutti i contenuti JSON in apps/mobile/src/data/ contro lo schema
// del rispettivo dominio (narrative scenes, courses, minigames).
//
// Closes #474 — `npm run validate:content`.
//
// Exit code 0 = tutti i file validi.
// Exit code 1 = almeno un file non valido o uno scenario riferisce un `next`
//               che non esiste nel registry.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'apps', 'mobile', 'src', 'data');
const SCENARIOS_DIRS = [
  path.join(ROOT, 'narrative', 'scenes'),
  path.join(ROOT, 'narrative', 'theaters'),
];
const COURSES_DIR = path.join(ROOT, 'courses');
const MINIGAMES_DIR = path.join(ROOT, 'minigames');

const VALID_STATS = new Set(['presence', 'precision', 'leadership', 'creativity']);

const errors = [];
function report(file, msg) {
  errors.push(`${path.relative(process.cwd(), file)}: ${msg}`);
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .map((name) => path.join(dir, name));
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    report(file, `JSON parse error: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Narrative scenes — replicates `gameplay/narrative.ts:validateScene`.
// ---------------------------------------------------------------------------

function validateScene(file, scene) {
  if (!scene || typeof scene !== 'object') {
    report(file, 'scene must be an object');
    return null;
  }
  for (const field of ['id', 'title', 'setting', 'prompt']) {
    if (typeof scene[field] !== 'string' || !scene[field].length) {
      report(file, `${field} must be a non-empty string`);
    }
  }
  if (!Array.isArray(scene.choices) || scene.choices.length < 2 || scene.choices.length > 4) {
    report(file, 'choices must be an array of 2-4 elements');
    return scene;
  }
  const ids = new Set();
  scene.choices.forEach((choice, idx) => {
    if (typeof choice.id !== 'string' || !choice.id.length) {
      report(file, `choices[${idx}].id required`);
    } else if (ids.has(choice.id)) {
      report(file, `choices[${idx}].id duplicate "${choice.id}"`);
    } else {
      ids.add(choice.id);
    }
    if (typeof choice.label !== 'string' || !choice.label.length) {
      report(file, `choices[${idx}].label required`);
    }
    if (!choice.outcome || typeof choice.outcome !== 'object') {
      report(file, `choices[${idx}].outcome required`);
      return;
    }
    const o = choice.outcome;
    if (typeof o.text !== 'string' || !o.text.length) {
      report(file, `choices[${idx}].outcome.text required`);
    }
    if (!o.rewards || typeof o.rewards !== 'object') {
      report(file, `choices[${idx}].outcome.rewards required`);
    }
    if (o.next !== undefined && o.next !== null && typeof o.next !== 'string') {
      report(file, `choices[${idx}].outcome.next must be string|null`);
    }
    if (choice.requires && typeof choice.requires === 'object') {
      const req = choice.requires;
      if (req.stat != null && !VALID_STATS.has(req.stat)) {
        report(file, `choices[${idx}].requires.stat invalid "${req.stat}"`);
      }
      if (req.min != null && typeof req.min !== 'number') {
        report(file, `choices[${idx}].requires.min must be number`);
      }
    }
  });
  return scene;
}

function validateTheaterScene(file, scene) {
  if (!scene) return;
  if (typeof scene.theatre !== 'string' || !scene.theatre.length) {
    report(file, 'theaters/*.json: "theatre" required (string)');
  }
  if (scene.requires && typeof scene.requires === 'object') {
    const visits = scene.requires.theatreVisits;
    if (visits != null) {
      if (typeof visits !== 'object' || typeof visits.min !== 'number') {
        report(file, 'requires.theatreVisits.min must be number');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Courses — minimal schema (#474 scaffolding).
// ---------------------------------------------------------------------------

function validateCourse(file, course) {
  if (!course || typeof course !== 'object') {
    report(file, 'course must be an object');
    return;
  }
  for (const field of ['id', 'title', 'description']) {
    if (typeof course[field] !== 'string' || !course[field].length) {
      report(file, `${field} required (string)`);
    }
  }
  if (!course.cost || typeof course.cost !== 'object') {
    report(file, 'cost required (object)');
  } else {
    const hasCachet = typeof course.cost.cachet === 'number' && course.cost.cachet >= 0;
    const hasDays = typeof course.cost.loginDays === 'number' && course.cost.loginDays >= 0;
    if (!hasCachet && !hasDays) {
      report(file, 'cost must define at least one of cachet|loginDays (>=0)');
    }
  }
  if (!course.rewards || typeof course.rewards !== 'object') {
    report(file, 'rewards required (object)');
  } else {
    if (!VALID_STATS.has(course.rewards.skill)) {
      report(file, `rewards.skill must be one of ${[...VALID_STATS].join('|')}`);
    }
    if (typeof course.rewards.bonus !== 'number' || course.rewards.bonus <= 0) {
      report(file, 'rewards.bonus must be positive number');
    }
  }
  if (course.cooldownMinutes != null && typeof course.cooldownMinutes !== 'number') {
    report(file, 'cooldownMinutes must be number');
  }
}

// ---------------------------------------------------------------------------
// Minigames — minimal schema (#474 scaffolding).
// ---------------------------------------------------------------------------

function validateMinigame(file, mg) {
  if (!mg || typeof mg !== 'object') {
    report(file, 'minigame must be an object');
    return;
  }
  for (const field of ['id', 'title', 'subtitle']) {
    if (typeof mg[field] !== 'string' || !mg[field].length) {
      report(file, `${field} required (string)`);
    }
  }
  if (mg.type !== 'timing' && mg.type !== 'audio') {
    report(file, 'type must be "timing" or "audio"');
  }
  if (!Array.isArray(mg.rounds) || mg.rounds.length === 0) {
    report(file, 'rounds must be a non-empty array');
  } else {
    mg.rounds.forEach((r, idx) => {
      if (typeof r.label !== 'string' || !r.label.length) {
        report(file, `rounds[${idx}].label required (string)`);
      }
      if (typeof r.tolerance !== 'number' || r.tolerance <= 0) {
        report(file, `rounds[${idx}].tolerance must be positive number`);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Cross-file validation:
//   1. Every `scene.id` must be globally unique across scenes/ and theaters/.
//      The runtime registry would silently overwrite a duplicate at module
//      load (Map.set behaviour); catching it here keeps CI as the gate.
//   2. Every `outcome.next` reference must point to a scene ID that exists
//      in the registered set.
function validateNextReferences(scenes) {
  const seenIds = new Map(); // sceneId → file path of first occurrence
  const allIds = new Set();
  for (const { file, scene } of scenes) {
    if (!scene || typeof scene.id !== 'string') continue;
    if (seenIds.has(scene.id)) {
      report(file, `duplicate scene id "${scene.id}" (first seen in ${path.relative(process.cwd(), seenIds.get(scene.id))})`);
      continue;
    }
    seenIds.set(scene.id, file);
    allIds.add(scene.id);
  }
  for (const { file, scene } of scenes) {
    if (!scene || !Array.isArray(scene.choices)) continue;
    scene.choices.forEach((choice, idx) => {
      const next = choice && choice.outcome && choice.outcome.next;
      if (typeof next !== 'string') return;
      if (!allIds.has(next)) {
        report(file, `choices[${idx}].outcome.next "${next}" does not match any registered scene id`);
      }
    });
  }
}

function main() {
  let count = 0;
  const collectedScenes = [];

  for (const dir of SCENARIOS_DIRS) {
    for (const file of listJsonFiles(dir)) {
      count += 1;
      const data = readJson(file);
      if (data === null) continue;
      const scene = validateScene(file, data);
      if (dir.endsWith(`${path.sep}theaters`)) validateTheaterScene(file, scene);
      collectedScenes.push({ file, scene });
    }
  }

  validateNextReferences(collectedScenes);

  for (const file of listJsonFiles(COURSES_DIR)) {
    count += 1;
    const data = readJson(file);
    if (data !== null) validateCourse(file, data);
  }

  for (const file of listJsonFiles(MINIGAMES_DIR)) {
    count += 1;
    const data = readJson(file);
    if (data !== null) validateMinigame(file, data);
  }

  if (errors.length) {
    process.stderr.write(`[validate-content] ${errors.length} error(s) across ${count} file(s):\n`);
    for (const e of errors) process.stderr.write(`  - ${e}\n`);
    process.exit(1);
  }

  process.stdout.write(`[validate-content] OK: ${count} file(s) validated.\n`);
}

main();
