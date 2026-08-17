# Homework Bridge

### A parent who can't read English still can't help with homework after you translate it.

---

## Who I built for

Immigrant parents who want to help with their child's homework and can't — and whose children therefore lose homework support at the language line.

Not parents who can't do the math. **They can do the math.** A parent who finished school in Guadalajara or Hyderabad or Ho Chi Minh City can subtract two-digit numbers. That was never the problem.

## The barrier

The barrier is not language. It's **method**.

Translate *"solve 62 − 27 using a number bond, then regroup from the tens place"* into perfect Spanish and the parent still cannot help. They were taught column subtraction with borrowing. They have never seen a number bond — and there is no Spanish word for it, because the diagram is US-specific pedagogy, not vocabulary.

It gets worse than unfamiliar:

- **Long division is written differently.** In Mexico, Vietnam, and Brazil the divisor goes to the *right* and the quotient *below* it. Same arithmetic, unrecognizable page.
- **`3,5` means three and a half** across most of Latin America. A parent can read the US `3.5` as thirty-five and never know they misread it.
- **`1,00,000` is one lakh** in India. US digit grouping looks like a typo.
- **Subtraction itself differs.** Much of Latin America teaches "equal additions," not borrow-and-cross-out. The written work looks nothing alike even when the answers match.

Translation tools stop at the words. TalkingPoints, ParentSquare, ClassDojo, and Google Lens all translate school communication well — and all of them leave this parent exactly where they started.

## What I built

Photograph or paste the worksheet, pick your language and where you went to school. You get back, in your language:

1. **What the assignment is actually asking** — restated, not translated
2. **The school's method**, worked step by step
3. **The same problem solved the way *you* learned it** ← nothing else does this
4. **The bridge** — which of your steps maps to which of theirs, and where they truly diverge
5. **Notation warnings** — the decimal commas and digit groupings that cause silent misreadings
6. **Three questions to ask your child** — that check understanding without giving away the answer

**The worked examples deliberately use different numbers than the assigned problems.** You cannot copy the output onto the sheet. This is built to help a parent help — not to do the homework.

## How it works

```
photo ──> vision model (transcribes only, never solves) ──┐
                                                          ├──> GLM-5.2 ──> analysis
typed / pasted worksheet ─────────────────────────────────┘
```

Two engineering decisions carry the project:

**Country method knowledge is curated, not improvised.** `lib/methods.ts` encodes specific, checkable differences in how six countries teach arithmetic. A general model knows these differences exist but describes them vaguely and inconsistently. Grounding the prompt in real facts is what makes the side-by-side trustworthy enough to hand a parent.

**Reading and reasoning are separate models.** The first live run had a mid-size vision model confidently claim `62 − 27 = 55` — in Telugu, in the panel a parent is meant to trust. A homework helper that states wrong numbers is worse than no tool at all. So the vision model was demoted to transcription only, and a frontier model (GLM-5.2) does every piece of reasoning. It got the same worksheet completely right, in less time.

Correctness isn't eyeballed — `eval/run.py` re-computes every equation the model writes and fails the run on any mismatch.

## Honest status

Works end to end against the live API. Typed and pasted worksheets are solid. Photo transcription of **handwritten** work is the weakest part and is documented as such. Correctness is measured on a small set of worksheets, not a broad benchmark.

---

**Demo:** _(link)_ · **Repo:** github.com/Adarsh-Samanu/homework-bridge

*Built for the Suvidha International Foundation AI Virtual Hackathon 2026.*
