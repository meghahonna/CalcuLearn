/**
 * scripts/authoring/authoringPrompts.ts
 *
 * Claude Opus prompts for authoring per-concept content. One prompt per
 * content type, kept in one file for easy iteration.
 *
 * Design principles:
 *   1. Be explicit about audience tier (novice / on_pace / advanced).
 *   2. Demand LaTeX for all math (inline $...$, block $$...$$).
 *   3. Forbid filler ("In this lesson, we will learn...").
 *   4. Keep responses tight — students bounce off walls of text.
 *   5. Always require examples to be solvable and verifiable.
 *   6. Output VALID JSON only — no markdown fences, no commentary.
 */

export type Tier = 'novice' | 'on_pace' | 'advanced'

export const SHARED_SYSTEM = `
You are an expert AP Calculus AB/BC curriculum author with deep
pedagogical experience. You write for high-school students using
the CalcuLearn app — a personalized copilot that supplements their
classroom teacher.

GLOBAL RULES (apply to every response):
- Math must be in LaTeX. Inline: $f(x)$. Block: $$\\\\frac{d}{dx}[f(g(x))] = f'(g(x)) \\\\cdot g'(x)$$.
- Use plain English, conversational tone. No filler ("In this lesson...").
- No emojis. No exclamation marks unless genuinely warranted.
- Write to one student. Use "you", not "we" or "students".
- Be concrete. Avoid hand-waving like "it can be shown that".
- Output VALID JSON only. No markdown fences (no \`\`\`json), no preamble, no commentary.
`.trim()

const TIER_GUIDANCE: Record<Tier, string> = {
  novice: `
NOVICE TIER — the student is struggling, possibly with shaky
algebra/pre-calc background. Goals:
- Use plain English first, formal notation second.
- Prefer concrete numbers over abstract symbols where possible.
- Build intuition with analogies (speedometer, zoom-in, slope of a hill).
- Acknowledge that this can feel hard. Be encouraging without being saccharine.
- Avoid jargon; if you must use a term, define it on the spot.
- Sentences short. Paragraphs short.
`.trim(),
  on_pace: `
ON-PACE TIER — the student is keeping up with the class, has seen
the concept, but wants reinforcement and clarity. Goals:
- Standard textbook clarity, but tighter and more conversational.
- Connect this concept to neighbors (what came before, what's next).
- Highlight the most common sticking points proactively.
- LaTeX freely, but still with English glue between formulas.
`.trim(),
  advanced: `
ADVANCED TIER — the student is ahead and wants depth. Goals:
- Get to the formal statement quickly.
- Include the underlying intuition for why the rule is TRUE
  (not just how to apply it).
- Reference adjacent ideas (limits, continuity, linear approximation).
- Suggest one stretch question or extension at the end.
- It's OK to be terse; this student doesn't need handholding.
`.trim(),
}

export interface PromptPair {
  system: string
  user: string
}

// ---------- 1. Explanation ----------
export function explanationPrompt(args: {
  conceptId: string
  conceptName: string
  tier: Tier
  framingIndex: number
  framingHint?: string
  prerequisites: string[]
}): PromptPair {
  return {
    system: SHARED_SYSTEM,
    user: `
TASK: Author a single explanation of "${args.conceptName}" for the
${args.tier} tier (framing #${args.framingIndex}).

${TIER_GUIDANCE[args.tier]}

${args.framingHint ? `FRAMING ANGLE: ${args.framingHint}` : ''}

PREREQUISITES the student is assumed to know: ${args.prerequisites.join(', ') || 'none'}.

Output JSON with this exact shape (and ONLY this shape):
{
  "tier": "${args.tier}",
  "framing_index": ${args.framingIndex},
  "body_md": "<the explanation, 150-400 words, with LaTeX>",
  "intuition_md": "<one-paragraph analogy or visual mental model, 50-120 words>"
}
`.trim(),
  }
}

// ---------- 2. Worked Example ----------
export function examplePrompt(args: {
  conceptName: string
  tier: Tier
  exampleIndex: number
}): PromptPair {
  return {
    system: SHARED_SYSTEM,
    user: `
TASK: Author a worked example for "${args.conceptName}" at the
${args.tier} tier (example #${args.exampleIndex}).

${TIER_GUIDANCE[args.tier]}

REQUIREMENTS:
- Choose a problem appropriate for the tier (novice = simplest case;
  advanced = composed/nested case).
- Break the solution into 3-6 steps.
- For each step, include WHY we do it, not just what.
- The "why" is the teaching moment; do not skip it.

Output JSON with this exact shape (NO additional fields like "stretch" or "extension" — put any extension idea inside the last step's why_md):
{
  "tier": "${args.tier}",
  "problem_md": "<problem statement with LaTeX>",
  "steps": [
    { "step_md": "<the math we do>", "why_md": "<why we do it>" }
  ]
}
`.trim(),
  }
}

// ---------- 3. Misconceptions ----------
export function misconceptionsPrompt(args: {
  conceptName: string
  count: number
}): PromptPair {
  return {
    system: SHARED_SYSTEM,
    user: `
TASK: Author the ${args.count} most common student misconceptions
about "${args.conceptName}".

REQUIREMENTS:
- Pull from real classroom experience: things students actually do wrong.
- For each: name the misconception, describe it, explain why it's wrong,
  and write a SOCRATIC response — a question (not a lecture) that nudges
  the student to spot their own error.
- Socratic response should be 1-3 sentences. End with a question.

Output a JSON ARRAY of ${args.count} objects, each with this exact shape:
[
  {
    "short_name": "<lower_snake_case_name>",
    "description_md": "<what the student incorrectly believes or does, with example>",
    "why_wrong_md": "<the actual mistake, briefly>",
    "socratic_response_md": "<1-3 sentence Socratic prompt ending in a question>"
  }
]

Output ONLY the array (starts with [, ends with ]). No object wrapper, no commentary.
`.trim(),
  }
}

// ---------- 4. Check-for-Understanding ----------
export function checksPrompt(args: {
  conceptName: string
  tier: Tier
  count: number
}): PromptPair {
  return {
    system: SHARED_SYSTEM,
    user: `
TASK: Author ${args.count} check-for-understanding questions for
"${args.conceptName}" at the ${args.tier} tier.

${TIER_GUIDANCE[args.tier]}

REQUIREMENTS:
- These are LIGHTWEIGHT probes inserted mid-explanation, not full
  practice problems. Should take a student 15-60 seconds.
- Mix formats: multiple choice, fill-in-blank, "spot the mistake",
  "what comes next".
- Provide an "expected_pattern" — a short regex or keyword list the
  app can use to classify the student's answer. Keep it forgiving.

Output a JSON ARRAY of ${args.count} objects, each:
[
  {
    "tier": "${args.tier}",
    "question_md": "<the prompt>",
    "expected_answer_md": "<the correct answer, brief>",
    "expected_pattern": "<regex or keyword list>"
  }
]

Output ONLY the array. No object wrapper, no commentary.
`.trim(),
  }
}

// ---------- 5. Deep Dive ----------
export function deepDivePrompt(args: {
  conceptName: string
  angle: string
}): PromptPair {
  return {
    system: SHARED_SYSTEM,
    user: `
TASK: Write a "Why does this work?" deep-dive for "${args.conceptName}"
on the angle: "${args.angle}".

REQUIREMENTS:
- Audience: advanced student who wants to know WHY, not just HOW.
- 200-500 words. Build the derivation/intuition step by step.
- LaTeX freely.
- End with one provocative follow-up question or extension.

Output JSON with this exact shape:
{ "title": "<title>", "body_md": "<the deep dive>" }
`.trim(),
  }
}

// ---------- 6. Application ----------
export function applicationPrompt(args: {
  conceptName: string
  context: 'physics' | 'economics' | 'biology' | 'engineering' | 'everyday'
}): PromptPair {
  return {
    system: SHARED_SYSTEM,
    user: `
TASK: Author an application problem for "${args.conceptName}" in
the context of ${args.context}.

REQUIREMENTS:
- Real-world scenario, not a contrived "math problem in disguise".
- Student must MODEL the situation with calculus, then solve.
- Provide a solution outline (not full step-by-step) — enough that
  a student knows when their answer is right.

Output JSON with this exact shape:
{
  "context": "${args.context}",
  "problem_md": "<scenario + question>",
  "solution_outline_md": "<approach + final answer>"
}
`.trim(),
  }
}
