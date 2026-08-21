# Devpost submission copy

## How we built it

Next.js and React on Vercel, with two models doing separate jobs through Featherless AI. GLM-5.2 does all the reasoning and writes the explanation in the parent's language. A Qwen3-VL vision model transcribes photos and is never allowed to solve anything.

The most important piece isn't a model at all — it's `lib/methods.ts`, a file where we wrote down how six countries actually teach arithmetic. Asked directly, the model gave vague and inconsistent answers, so that knowledge had to be researched and encoded by hand.

## Challenges we ran into

The vision model got the math wrong. Our first working version told a Telugu-speaking parent that `62 - 27 = 55` — confidently, in the exact panel a parent is supposed to trust. A homework helper that states wrong numbers is worse than no tool at all, because now the parent looks wrong in front of their kid.

That forced a redesign: the vision model was demoted to copying text down, and a stronger model does every bit of reasoning. We also wrote `eval/run.py`, which re-computes every equation the model writes and fails the run if anything is off.

Speed was the other problem. Worksheets took four to seven minutes at first. That's now 8–20 seconds, and the three demo worksheets are pre-rendered so they load instantly.

## Accomplishments that we're proud of

It works, and the part that makes it different works: a parent sees the school's method and their own method side by side, in their language, with the arithmetic verified rather than assumed. The three demo worksheets pass with 8, 16, and 8 equations checked and zero errors.

It's also deployed and fast — a sample worksheet returns in under half a second in production.

## What we learned

Don't trust a model with arithmetic. It will be wrong confidently, in a language you can't read, in the place it matters most — so check it in code instead of hoping.

And keep going when something breaks. Nearly everything about this project failed at least once — models timing out, API keys dying mid-build, uploads crashing on Safari. Fixing them one at a time is what turned it into something real.

## What's next for Homework Bridge

Higher-level math, up through algebra and calculus, where the gap between how it's taught here and abroad gets wider rather than narrower.

More countries — six are covered now. Better handwriting support. And testing with real families instead of just my own: one interview shaped this, ten would shape it better.
