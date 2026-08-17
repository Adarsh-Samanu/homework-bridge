# Homework Bridge

**A parent who can't read English still can't help with homework after you translate it.**

That's the assumption this project rejects. Translate *"solve 24 × 6 using the box method and show your partial products"* into Spanish and the parent still can't help — not because of the words, but because they were taught column multiplication and have never seen a grid. They can do this math. They've been locked out of it by a method.

Homework Bridge reads a worksheet and returns, in the parent's language: what's being asked, the method the school expects, **and the same problem solved the way the parent learned it back home**, with an explicit map between the two.

---

## Who this is for

A parent who:

- Doesn't read English well enough to parse a worksheet
- **Can already do the math** — this is not a tutoring app for adults
- Learned it with a different algorithm, different notation, or both
- Wants to help their child, not do the homework for them

The person locked out of learning here is the child, whose at-home support collapses at the language line. The person we build the interface for is the parent.

---

## What it actually does

| Output | Why it's there |
|---|---|
| **The assignment, restated** | Not a translation of the instructions — a plain statement of the task |
| **School's method, worked** | Step by step, on a problem *of the same shape* as the assigned one |
| **The parent's method, worked** | The same problem, their algorithm, their notation. This is the part nothing else does |
| **The bridge** | Which of their steps maps to which of the school's, and where the two genuinely diverge |
| **Notation warnings** | Decimal commas, digit grouping, division layout — the silent misreadings |
| **Untranslatable jargon** | "Number bond", "exit ticket", "regrouping" — explained, not translated |
| **Three questions to ask** | Specific to this worksheet, designed to check understanding without giving anything away |

**Worked examples deliberately use different numbers than the assigned problems.** A parent should not be able to copy the output onto the sheet. That constraint is enforced in the system prompt, and it's a product decision, not a limitation.

---

## Why this isn't a translation wrapper

Existing tools (TalkingPoints, ParentSquare, ClassDojo, Google Lens) already translate school communication well. They stop at language. The barrier this project targets starts *after* translation:

- **Long division** is written with the divisor to the *right* and the quotient *below* it in Mexico, Vietnam, and Brazil — not above a bracket. Same arithmetic, unrecognizable page.
- **`3,5` means three and a half** in most of Latin America. A parent may read the US `3.5` as thirty-five.
- **`1,00,000` is one lakh** in India. US digit grouping looks like a typo, and vice versa.
- **Subtraction** is taught as "equal additions" in much of Latin America and Brazil, not US-style borrow-and-cross-out. The written work looks completely different despite matching answers.
- **"Number bond"** has no equivalent term in any language, because the named diagram is US-specific pedagogy.

These are encoded as curated, checkable facts in [`lib/methods.ts`](lib/methods.ts) rather than left to the model to improvise. That file is the substance of the project.

---

## Built vs. mocked

Being precise about this, per §07 and §11 of the hackathon handbook.

### Fully built and verified
- Next.js app, UI, state, and the full request/response path (`app/page.tsx`, `app/api/analyze/route.ts`)
- Country method profiles for Mexico/Central America, India, Vietnam, China, Brazil, Philippines (`lib/methods.ts`) — hand-researched, not model-generated
- Prompt construction with country-specific grounding (`lib/prompt.ts`)
- Shared JSON Schema driving structured extraction for both providers (`lib/schema.ts`)
- Provider adapter with two complete implementations — Featherless and Claude (`lib/providers/`)
- Three preloaded sample worksheets so the demo can be exercised with no upload (`lib/samples.ts`)
- Photo upload and camera capture, base64-encoded client-side
- Read-aloud via the browser's `SpeechSynthesis` API
- Sample loading, language/country selection, and error surfacing — **verified in-browser**; TypeScript compiles clean

### Not yet verified end to end
- **The model call itself has not been run against a live API key.** Both adapters are written and typecheck, but neither has been exercised against a real endpoint yet. Until that happens, the quality of the method comparison is a design claim, not a measured result.
- **`FEATHERLESS_VISION_MODEL` is unset by default.** It must name an image-capable model from the current Featherless catalog. A text-only id there fails at request time.
- **Photo OCR of handwritten worksheets is untested** and is the highest-risk part of the build. Printed and typed worksheets are the safer path; the paste-text input exists partly as a fallback.

### Deliberately simple
- **Read-aloud uses browser speech synthesis, not a TTS API.** It's free, works offline, and covers many of these languages — but voice availability varies by device and OS, and some languages will fall back to a default voice or stay silent. A hosted TTS service would be more reliable and would cost money on every request.
- **No accounts, no storage, no database.** Worksheets are sent, analyzed, and dropped. For a tool handling photographs of children's schoolwork, not storing anything is a feature.

---

## Running it

```bash
git clone https://github.com/Adarsh-Samanu/homework-bridge.git
cd homework-bridge
npm install
cp .env.example .env.local   # then fill in a key
npm run dev
```

Open http://localhost:3000 and click a sample worksheet — no upload needed.

### Configuration

| Variable | Purpose |
|---|---|
| `MODEL_PROVIDER` | `featherless` (default) or `claude` |
| `FEATHERLESS_API_KEY` | Featherless key |
| `FEATHERLESS_VISION_MODEL` | **Required.** An image-capable model id from the Featherless catalog |
| `ANTHROPIC_API_KEY` | Only needed with `MODEL_PROVIDER=claude` |

Switching providers is one environment variable. Both paths satisfy the same JSON Schema, so the UI is unaffected.

---

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**, deployed on Vercel
- **Featherless AI** via the OpenAI-compatible `openai` client — default provider
- **Anthropic SDK** — alternate provider
- Browser **Web Speech API** for read-aloud
- No database, no auth, no persistence

---

## Required disclosures (§08)

**AI tools used to build this project:**
- **Claude Opus 5** (Anthropic), via **Claude Code** — used as a coding assistant for essentially all application code, and for research and drafting of the country method profiles. All method claims were reviewed before inclusion.

**Models the application calls at runtime:**
- **Featherless AI** (default provider) — serves open-weight models through an OpenAI-compatible API. The specific vision model is set via `FEATHERLESS_VISION_MODEL` and is not hardcoded.
- **Claude Opus 5** (`claude-opus-5`, Anthropic) — alternate provider, selected with `MODEL_PROVIDER=claude`.

**Datasets:**
- None. No training, no fine-tuning, no scraped or collected data.
- The country method profiles in `lib/methods.ts` are hand-written reference material authored for this project.
- The three sample worksheets in `lib/samples.ts` are original, written for this project. They are not real student work and contain no student data.

---

## License

MIT
