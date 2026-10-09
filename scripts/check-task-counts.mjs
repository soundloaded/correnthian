#!/usr/bin/env node
/**
 * Recompute `BACKEND_TASKS.md`'s summary from its own entries and fail if the
 * two disagree.
 *
 * §21 has now claimed the wrong totals three times. It says so itself: the
 * version before last claimed 56 tasks and "17 defects, all BACKLOG", the last
 * one claimed 61 tasks and 19 defects while telling the reader it had been
 * recomputed "not from memory". A summary section that is wrong about the file
 * it sits inside is worse than no summary, because every number in it reads as
 * a check someone already ran.
 *
 * The counts are recoverable mechanically — a status lives either in the
 * heading or in the entry's own `**Status:**` line — so this reads them and
 * compares. It also fails on an entry carrying neither, because such an entry
 * cannot be counted by any reader, human or script, and that is how a task
 * silently disappears from every total.
 */
import { readFileSync } from 'node:fs';

const FILE = 'docs/agent/BACKEND_TASKS.md';

/** Task ids and defect ids are one namespace here; defects get their own count. */
const ENTRY = /^(BE|SEC|CHAIN|AUTH|USER|WALLET|ASSET|DEF)-\d+/;
const STATUSES = ['DONE', 'PARTIAL', 'BACKLOG', 'BLOCKED', 'OPEN'];

function statusFrom(text) {
  // The heading first: `· \`DONE\``, which is what a reader sees in a ToC.
  const inHeading = [...text.matchAll(/`(DONE|PARTIAL|BACKLOG|BLOCKED|OPEN)`/g)];
  if (inHeading.length > 0) return inHeading[0][1];
  // Then the entry's own line, which is where the ones without a heading
  // marker keep it.
  const inBody = text.match(/\*\*Status:\*\*\s*`(DONE|PARTIAL|BACKLOG|BLOCKED|OPEN)`/);
  if (inBody) return inBody[1];
  return null;
}

function countEntries(lines) {
  const entries = [];
  let current = null;

  const finish = () => {
    if (!current) return;
    if (ENTRY.test(current.id)) {
      entries.push({ id: current.id, status: statusFrom(current.text) });
    }
    current = null;
  };

  for (const line of lines) {
    const heading = line.match(/^###\s+(.*)/);
    if (heading) {
      finish();
      current = { id: heading[1], text: line };
      continue;
    }
    // A new `##` section ends the last entry too.
    if (/^##\s/.test(line)) {
      finish();
      continue;
    }
    if (current) current.text += `\n${line}`;
  }
  finish();
  return entries;
}

function tally(entries, group) {
  const out = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const uncountable = [];
  for (const e of entries) {
    const isDefect = e.id.startsWith('DEF-');
    if ((group === 'defects') !== isDefect) continue;
    if (!e.status) uncountable.push(e.id);
    else out[e.status] += 1;
  }
  return { out, uncountable };
}

/** The §21 table, read as data rather than as prose. */
function readSummaryTable(lines) {
  const summary = lines.findIndex((l) => l.startsWith('## 21. Summary counts'));
  if (summary === -1) return null;
  const found = new Map();
  for (let i = summary + 1; i < lines.length; i += 1) {
    const row = lines[i].match(/^\|\s*`(DONE|PARTIAL|BACKLOG|BLOCKED|OPEN)`\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/);
    if (row) {
      // Accumulated, not assigned. The table carries `PARTIAL` on two rows —
      // one for tasks, one for defects — and overwriting would read the first
      // row as if it had never been written.
      const at = found.get(row[1]) ?? { tasks: 0, defects: 0 };
      at.tasks += Number(row[2]);
      at.defects += Number(row[3]);
      found.set(row[1], at);
    }
    if (/^\|\s*\*\*Total\*\*/.test(lines[i])) break;
  }
  return found.size > 0 ? found : null;
}

const lines = readFileSync(FILE, 'utf8').split('\n');
const entries = countEntries(lines);
const tasks = tally(entries, 'tasks');
const defects = tally(entries, 'defects');
const summary = readSummaryTable(lines);

const problems = [];

for (const e of entries) {
  if (!e.status) problems.push(`  ${e.id} carries no status — it cannot be counted`);
}

if (!summary) {
  problems.push('  §21 "Summary counts" has no readable table');
} else {
  for (const status of STATUSES) {
    const want = summary.get(status);
    const gotTasks = tasks.out[status];
    const gotDefects = defects.out[status];
    if (!want) {
      // Absent is fine when there is nothing to count — a row of two zeros is
      // noise, and insisting on one would push authors to pad the table.
      if (gotTasks > 0 || gotDefects > 0) {
        problems.push(`  §21 has no \`${status}\` row; entries say tasks=${gotTasks} defects=${gotDefects}`);
      }
      continue;
    }
    if (want.tasks !== gotTasks) {
      problems.push(`  §21 says ${want.tasks} \`${status}\` tasks; the entries say ${gotTasks}`);
    }
    if (want.defects !== gotDefects) {
      problems.push(`  §21 says ${want.defects} \`${status}\` defects; the entries say ${gotDefects}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`\n  ${FILE}: the summary and the entries disagree\n`);
  for (const p of problems) console.error(p);
  console.error(
    '\n  Recompute the counts from the `Status` of every entry, or fix the entry.\n' +
      '  A summary that disagrees with the file it summarises reads as a check that\n' +
      '  already ran, which is worse than having none.\n',
  );
  process.exit(1);
}

const total = (t) => STATUSES.reduce((n, s) => n + t.out[s], 0);
console.log(
  `  task-counts OK — ${total(tasks)} tasks ` +
    `(${STATUSES.map((s) => `${tasks.out[s]} ${s}`).join(', ')}) ` +
    `, ${total(defects)} defects ` +
    `(${STATUSES.map((s) => `${defects.out[s]} ${s}`).join(', ')})`,
);
