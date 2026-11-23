// The One-Line Laugh — entry program.
//
// Restated spec (read twice, in my own words):
//   Write ONE funny line: a single sentence, at most 200 characters, on any
//   subject. The program writes that text to /output/entry.txt. A house AI
//   judge (a stand-up comic persona) reads entries two at a time and keeps
//   the bigger laugh, weighing, in this order:
//     1. funny + within 200 chars (a line that is not funny, or runs past
//        the limit, loses to any funny line within it),
//     2. a real surprise at the end — a turn the reader did not see coming
//        that still makes sense once it arrives,
//     3. an everyday truth people recognise,
//     4. economy of words — every word earning its place,
//     5. freshness — not a line the reader has heard many times before.
//   The gate: /output/entry.txt must be UTF-8 text of 1-200 characters, not
//   only white space. Ties on win rate go to the smaller text, then to the
//   earlier receipt. The program runs in a sandbox with no network and at
//   most 60 seconds a run; it must be deterministic (the grader runs it
//   twice). No local scorer exists for this bounty — the server grades every
//   entry — so there is no grade-local percentage to report; verification
//   below is end-to-end instead.
//
// Approaches considered:
//   A. Hand-written pool + rubric selection (CHOSEN): a pool of original
//      one-liners, each scored against the judge's five criteria in the
//      judge's own priority order, best one written out. Every candidate is
//      a real joke I wrote and vetted by hand, so quality is controlled;
//      the program's work is the honest selection, and the output is fully
//      deterministic.
//   B. Single hand-crafted line, program outputs it verbatim: simplest,
//      zero moving parts — but no fallback if that one line is weak, and
//      the program does almost nothing.
//   C. Template generator (setup + punchline parts combined): scale, but
//      generated jokes come out flat and often fail criterion 2 (the twist
//      has to still make sense), so the expected quality is lower than a
//      hand-written pool.
//
// Edge cases handled before coding:
//   - Output must be exactly one sentence: one terminal period, no other
//     sentence-ending punctuation, no abbreviations with periods.
//   - 1-200 characters, ASCII only (so characters equal bytes — the
//     tie-break counts bytes), no trailing newline, no trailing space.
//   - Must not reproduce any house fixed text: all lines are original,
//     never copied from a known joke.
//   - No cliché structures (bar jokes, chicken jokes, mother-in-law
//     jokes) — criterion 5 punishes lines the reader has heard before.
//   - The program reads nothing from the network, the environment or the
//     disk beyond this file, and writes only /output/entry.txt.
//   - Deterministic: same output on every run, no randomness, no time.
//
// Run: node main.ts   (Node 22.18+; the grader runs Node 22.23.4)

import { mkdirSync, writeFileSync } from "node:fs";

const OUT_PATH = "/output/entry.txt";
const MAX_CHARS = 200;

// ---------------------------------------------------------------------------
// Candidate one-liners. Every one was written for this bounty and checked by
// hand first: a single declarative sentence, ASCII only, no internal question
// mark or exclamation, no cliché structure, and a twist in the final clause
// that reframes the setup. Scores are per-criterion (0-5) in the judge's
// priority order, with the reason recorded beside each number so the
// selection can be audited.
// ---------------------------------------------------------------------------
interface Candidate {
  text: string;
  // Surprise at the end: does the final clause turn the setup in a way the
  // reader did not see coming, that still makes sense once it arrives?
  surprise: number;
  surpriseWhy: string;
  // Everyday truth: does it name something true of ordinary life that the
  // reader nods at?
  truth: number;
  truthWhy: string;
  // Freshness: does it feel new rather than a line heard many times before?
  fresh: number;
  freshWhy: string;
}

const CANDIDATES: Candidate[] = [
  {
    text: "I downloaded a sleep app to fix my sleep, and now I stay up until 3am watching graphs of how badly I sleep.",
    surprise: 5,
    surpriseWhy: "ironic reversal: the fix itself causes the problem",
    truth: 5,
    truthWhy: "everyone with a sleep tracker has stayed up staring at sleep data",
    fresh: 4,
    freshWhy: "sleep-app jokes exist, but the graphs-of-how-badly-I-sleep angle is new",
  },
  {
    text: "My password manager remembers everything about me and still trusts me with nothing.",
    surprise: 4,
    surpriseWhy: "neat paradox, more clever than surprising",
    truth: 4,
    truthWhy: "everyone is locked out by their own security",
    fresh: 5,
    freshWhy: "unusual angle, no familiar setup",
  },
  {
    text: "I asked AI to write my dating profile and it described me as a self-starter who works well alone, which is the nicest way anyone has ever called me single.",
    surprise: 5,
    surpriseWhy: "the final clause reframes the whole setup as a polite insult",
    truth: 4,
    truthWhy: "dating profiles and AI-written bios are everyday now, but narrower than sleep",
    fresh: 5,
    freshWhy: "on-theme for AI agents, no familiar joke structure",
  },
  {
    text: "My to-do list still has an item from 2022 that I keep moving to tomorrow, and at this point I'm just keeping it alive out of respect for its persistence.",
    surprise: 4,
    surpriseWhy: "the persistent one turns out to be the task, not me",
    truth: 5,
    truthWhy: "everyone has a task that has outlived its deadline by years",
    fresh: 4,
    freshWhy: "to-do jokes are common, the respect-for-its-persistence turn is not",
  },
  {
    text: "My fitness tracker says I burned 400 calories today, mostly from walking to the fridge to check if anything new appeared since the last time I looked.",
    surprise: 3,
    surpriseWhy: "the fridge check is telegraphed once the tracker is mentioned",
    truth: 5,
    truthWhy: "the pointless fridge check is universal",
    fresh: 3,
    freshWhy: "fridge-checking is a well-worn trope",
  },
  {
    text: "I hired a personal trainer to hold me accountable and now I pay $50 an hour for a man to watch me lie about how many push-ups I did.",
    surprise: 5,
    surpriseWhy: "paying someone to watch you lie reverses accountability completely",
    truth: 5,
    truthWhy: "everyone has inflated a rep count",
    fresh: 4,
    freshWhy: "trainer jokes are common, the watch-me-lie angle is fresher",
  },
  {
    text: "I bought a standing desk so I would sit less, and now I stand all day doing exactly what I used to do sitting down, only with sorer feet.",
    surprise: 3,
    surpriseWhy: "the ending is a shrug, not a turn",
    truth: 4,
    truthWhy: "standing desks that change nothing are familiar",
    fresh: 3,
    freshWhy: "standing-desk jokes are a known bit",
  },
  {
    text: "I asked my smart fridge what's for dinner and it said whatever I bought and forgot about, which is the most honest answer any appliance has ever given me.",
    surprise: 4,
    surpriseWhy: "the fridge answers with a fact I already knew, dressed as honesty",
    truth: 4,
    truthWhy: "forgotten groceries are an everyday truth",
    fresh: 4,
    freshWhy: "smart-fridge jokes exist, this answer is specific",
  },
  {
    text: "My plants died, my fish died, but the sourdough starter I abandoned in 2021 is somehow still alive, which tells me everything I need to know about commitment.",
    surprise: 4,
    surpriseWhy: "the abandoned thing outlives the cared-for things",
    truth: 4,
    truthWhy: "pandemic sourdough starters are a shared memory",
    fresh: 5,
    freshWhy: "no familiar joke structure, specific and odd",
  },
  {
    text: "I set my alarm for 6am and my phone for 6:05, 6:10 and 6:15, because nothing says I trust myself like four chances to fail before breakfast.",
    surprise: 4,
    surpriseWhy: "four alarms as four chances to fail reframes the habit",
    truth: 5,
    truthWhy: "multiple alarms are nearly universal",
    fresh: 3,
    freshWhy: "alarm jokes are common",
  },
];

// ---------------------------------------------------------------------------
// Rubric — the judge's criteria in the judge's own priority order.
//   surprise 35 + truth 25 + economy 20 + freshness 20 = 100.
// Economy is computed, not hand-assigned: the judge says length for its own
// sake does not count, and economy means no wasted words — a one-liner needs
// a setup AND a twist, so the sweet spot is 90-160 characters. Shorter
// risks a thin setup; longer risks dead weight.
// ---------------------------------------------------------------------------
function economyScore(chars: number): number {
  if (chars >= 90 && chars <= 160) return 20;
  if (chars < 90) return 17;
  if (chars <= 185) return 17;
  return 14;
}

interface Scored {
  candidate: Candidate;
  chars: number;
  bytes: number;
  surprise: number;
  truth: number;
  economy: number;
  fresh: number;
  total: number;
}

function scoreAll(): Scored[] {
  return CANDIDATES.map((c) => {
    const chars = [...c.text].length;
    const bytes = Buffer.byteLength(c.text, "utf8");
    const economy = economyScore(chars);
    return {
      candidate: c,
      chars,
      bytes,
      surprise: c.surprise * 7,
      truth: c.truth * 5,
      economy,
      fresh: c.fresh * 4,
      total: c.surprise * 7 + c.truth * 5 + economy + c.fresh * 4,
    };
  });
}

// Gate: UTF-8 (ASCII here), 1-200 characters, not only white space, exactly
// one sentence — one terminal period and no other sentence-ending mark.
function gatePass(text: string): string | null {
  if (!/^[\x00-\x7F]*$/.test(text)) return "non-ASCII characters";
  const chars = [...text].length;
  if (chars < 1 || chars > MAX_CHARS) return `length ${chars} outside 1-${MAX_CHARS}`;
  if (text.trim().length === 0) return "only white space";
  if (text !== text.trim()) return "leading or trailing white space";
  if ((text.match(/\./g) || []).length !== 1) return "not exactly one sentence";
  if (!text.endsWith(".")) return "does not end with a period";
  if (/[?!]/.test(text)) return "contains a question or exclamation mark";
  return null;
}

const scored = scoreAll();

// Every candidate must pass the gate, not just the winner — a candidate
// that cannot be submitted is not a candidate.
for (const s of scored) {
  const problem = gatePass(s.candidate.text);
  if (problem) throw new Error(`candidate fails gate (${problem}): ${s.candidate.text}`);
}

for (const s of scored) {
  console.log(
    `${s.total}/100  ${s.chars}ch  surprise=${s.surprise} truth=${s.truth} economy=${s.economy} fresh=${s.fresh}  :: ${s.candidate.text}`,
  );
}

// Winner: highest total; ties go to the smaller text (the competition's own
// tie-break), then to the earliest candidate. Note on this run: the sleep-app
// line and the personal-trainer line both score 96/100 — the tie is real in
// my scoring (both have a full reversal, a universal truth and a fresh
// angle), and the smaller text breaks it: 107 chars beats 132, and the
// shorter line is also the tighter one on the judge's economy criterion.
const best = scored
  .slice()
  .sort((a, b) => b.total - a.total || a.bytes - b.bytes)[0];

mkdirSync("/output", { recursive: true });
writeFileSync(OUT_PATH, best.candidate.text, "utf8");
console.log(`\nWrote ${best.chars} characters to ${OUT_PATH}`);
