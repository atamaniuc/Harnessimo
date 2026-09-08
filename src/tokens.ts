// An agent spends most of its budget before anything is finished, and the
// largest avoidable line item is the same file read twice. The second read
// costs its full length again and teaches the model nothing it does not
// already hold — and nothing reports it, so nobody fixes it.
//
// Every other rule here answers "is this finished". This one fires while the
// work happens, which is a different kind of gate and is kept separate on
// purpose: a completion check that depended on session state would be a gate
// nobody could reproduce.
//
// What is counted is bytes, converted at four per token. That is an estimate,
// and it is labelled as one wherever it is printed: we cannot see the model's
// context, and a precise number nobody can verify is worse than an approximate
// one that admits it.
import type { ReadDecision, ReadLedger, ReadRecord, ReadState } from "./types.ts";

/** Roughly four bytes to a token across code and prose. An estimate, always. */
export function estimateTokens(bytes: number): number {
  return Math.max(1, Math.ceil(bytes / 4));
}

/** Twenty minutes: long enough to span a task, short enough that a stale entry stops mattering. */
export const DEFAULT_WINDOW_MINUTES = 20;

export function emptyState(): ReadState {
  return { reads: {} };
}

/** Entries older than the window are forgotten: a session that ran long is not one session. */
function withinWindow(state: ReadState, now: number, windowMs: number): ReadState {
  const reads: Record<string, ReadRecord> = {};
  for (const [path, record] of Object.entries(state.reads)) {
    if (now - record.at <= windowMs) reads[path] = record;
  }
  return { reads };
}

/**
 * Should this read happen?
 *
 * Pure: the caller supplies the file's size and mtime, which is what makes the
 * decision testable without a filesystem — and what keeps a rule free of I/O,
 * as CONSTRAINTS #3 requires.
 */
export function decideRead(
  state: ReadState,
  {
    path,
    size,
    mtimeMs,
    now = Date.now(),
    partial = false,
    override = false,
    windowMinutes = DEFAULT_WINDOW_MINUTES,
  }: {
    path: string;
    size: number;
    mtimeMs: number;
    now?: number;
    /** A range read: part of a file is not the file. */
    partial?: boolean;
    /** The caller has said it means this. Always allowed, and counted as an override. */
    override?: boolean;
    windowMinutes?: number;
  },
): { decision: ReadDecision; state: ReadState } {
  const pruned = withinWindow(state, now, windowMinutes * 60_000);

  // A range is not the whole file, so it neither blocks nor records one.
  if (partial) {
    return { decision: { allow: true, reason: "partial read" }, state: pruned };
  }

  const seen = pruned.reads[path];
  const record = (of: Partial<ReadRecord>): ReadState => ({
    reads: {
      ...pruned.reads,
      [path]: {
        size,
        mtimeMs,
        at: now,
        reads: (seen?.reads ?? 0) + 1,
        overrides: (seen?.overrides ?? 0) + (of.overrides ?? 0),
      },
    },
  });

  if (!seen) {
    return { decision: { allow: true, reason: "first read" }, state: record({}) };
  }

  // Changed since it was read: the content really is new.
  if (seen.size !== size || seen.mtimeMs !== mtimeMs) {
    return { decision: { allow: true, reason: "changed since it was read" }, state: record({}) };
  }

  if (override) {
    return {
      decision: { allow: true, reason: "override" },
      state: record({ overrides: 1 }),
    };
  }

  const saved = estimateTokens(size);
  return {
    decision: {
      allow: false,
      reason: "already read, unchanged",
      savedTokens: saved,
      message:
        `${path} was already read in this session and has not changed since — ` +
        `about ${format(saved)} tokens.\n` +
        `  fix:  use what you have. If you truly need it again, read a range, ` +
        `or pass --override and it will be counted as one.`,
    },
    // A refused read is still a fact about the session: it is what the ledger
    // reports as saved, and a saving nobody records is a saving nobody believes.
    state: {
      reads: {
        ...pruned.reads,
        [path]: { ...seen, at: seen.at, refused: (seen.refused ?? 0) + 1 },
      },
    },
  };
}

/** What the session cost, and what it repeated. */
export function ledger(state: ReadState): ReadLedger {
  const entries = Object.entries(state.reads);
  let tokensRead = 0;
  let tokensRepeated = 0;
  let repeated = 0;
  let refused = 0;
  let overrides = 0;

  for (const [, record] of entries) {
    const each = estimateTokens(record.size);
    tokensRead += each * record.reads;
    if (record.reads > 1) {
      repeated += 1;
      tokensRepeated += each * (record.reads - 1);
    }
    refused += record.refused ?? 0;
    overrides += record.overrides ?? 0;
  }

  const biggest = entries
    .map(([path, record]) => ({ path, tokens: estimateTokens(record.size), reads: record.reads }))
    .sort((a, b) => b.tokens * b.reads - a.tokens * a.reads)[0];

  return {
    files: entries.length,
    reads: entries.reduce((n, [, r]) => n + r.reads, 0),
    tokensRead,
    repeated,
    tokensRepeated,
    refused,
    tokensSaved: entries.reduce((n, [, r]) => n + estimateTokens(r.size) * (r.refused ?? 0), 0),
    overrides,
    ...(biggest ? { largest: biggest } : {}),
  };
}

/** 184000 reads as "~184k"; a token count is an estimate and should look like one. */
export function format(tokens: number): string {
  if (tokens >= 1000) return `~${Math.round(tokens / 1000)}k`;
  return `~${tokens}`;
}

/** The ledger as the CLI prints it, so the wording is testable without a terminal. */
export function ledgerReport(l: ReadLedger): string {
  if (l.files === 0) return "harnessimo budget: nothing read through the guard yet.";

  const lines = [
    "harnessimo budget — this session (estimated at 4 bytes per token)\n",
    `  read        ${String(l.files).padStart(4)} file(s), ${format(l.tokensRead)} tokens`,
  ];
  if (l.repeated > 0) {
    const share = Math.round((l.tokensRepeated / l.tokensRead) * 100);
    lines.push(
      `  re-read     ${String(l.repeated).padStart(4)} file(s), ${format(l.tokensRepeated)} tokens` +
        ` — ${share}% of everything read`,
    );
  }
  if (l.refused > 0) {
    lines.push(`  saved       ${String(l.refused).padStart(4)} refused re-read(s), ${format(l.tokensSaved)} tokens`);
  }
  if (l.overrides > 0) {
    lines.push(`  overridden  ${String(l.overrides).padStart(4)} — a rule that gets in the way should be visible`);
  }
  if (l.largest) {
    lines.push(
      `  largest     ${l.largest.path}, read ${l.largest.reads}×, ${format(l.largest.tokens)} each`,
    );
  }
  if (l.repeated > 0) {
    lines.push(
      "",
      "  fix:  a re-read is a session that lost its place. `harnessimo guard read <path>`",
      "        refuses the second read of a file that has not changed.",
    );
  }
  return lines.join("\n");
}
