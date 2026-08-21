# Homework Bridge

### My dad always knew how to do my math homework. He just couldn't get it to me.

> **AI disclosure:** Claude (Anthropic) wrote the code and helped polish this write-up. I directed the project — the idea, the research into how other countries teach math, the design decisions, and the conversation with my dad are mine.

---

## Who I built this for

My dad grew up in India. He learned all of this math there — long division, subtraction with borrowing, all of it. He is good at it.

He speaks Telugu. English is hard for him. And I never learned enough Telugu for him to just explain it to me in Telugu instead.

So when I was in elementary school and middle school and got stuck on a math worksheet, this is what it looked like: I'd be sitting there with the paper, and my dad would be right there, and he *knew the answer* — he'd known it for thirty years — and there was no way for it to get from him to me. He couldn't read the sheet. I couldn't follow his explanation. We were one language apart, at the same table.

I asked him about it while I was building this. He told me something like this would have really helped him back then — he wanted to teach me the way he had learned it, and he couldn't.

I want to be clear about who is locked out here. **It was me.** I was the kid who didn't get help. But the person you have to actually build for is him, because he was the one holding the thing I needed.

## Why translating it wouldn't have fixed us

This took me a while to figure out, and it's the whole reason this isn't just a translation app.

Imagine you handed my dad my worksheet, perfectly translated into Telugu. He still couldn't have helped me. Because the sheet said things like:

> *Use a number bond to decompose the second number, then regroup from the tens place.*

There's no Telugu word for **number bond**. Not because it's a hard translation — because the thing itself doesn't exist in what he learned. It's an American way of teaching. He was taught column subtraction, the one where you cross out and borrow. Translate the sheet and he's just looking at a diagram he's never seen before, now in Telugu. Same wall.

And it's not only the words:

- **Long division is written in a totally different place on the page** in Mexico, Vietnam, and Brazil — divisor on the right, answer underneath. Same math. Looks like a different subject.
- **`3,5` means three and a half** in most of Latin America. A parent can read `3.5` as thirty-five and never find out they got it wrong.
- **`1,00,000` is one lakh** in India. American comma placement looks like a mistake.
- **`187 r 1`** — that `r` means "remainder." Nothing on the worksheet tells you.

TalkingPoints, ParentSquare, ClassDojo, Google Lens — they all translate school stuff, and they do it well. Every single one of them would have left my dad exactly where he was.

## What it does

You take a picture of the worksheet, or paste it in, and pick your language and the country you went to school in. Then, in your language, you get:

1. **What the homework is actually asking for** — said plainly, not word-for-word translated
2. **The way the school wants it done**, worked out step by step
3. **The same problem done the way *you* were taught** ← this is the part that doesn't exist anywhere else
4. **How the two line up** — which of your steps is which of theirs, and the one place they really differ
5. **Notation warnings** — the comma and decimal traps above, so you don't misread a number
6. **Three questions to ask your kid** — that check if they get it without handing them the answer

The worked examples always use **different numbers** than the actual homework. You can't copy them onto the sheet. I did that on purpose — this is for helping your kid, not doing it for them.

> **If you only try one thing: click the third sample — Telugu, India, number bonds.** That's my dad's exact situation. That's the one I built this for.

## How it works

You point it at a worksheet, and two different models split the job:

```
photo ──> a vision model (only copies the text down, never solves) ──┐
                                                                     ├──> GLM-5.2 ──> your answer
typed or pasted worksheet ───────────────────────────────────────────┘
```

**I had to look up how math is actually taught in other countries.** I couldn't just ask the model — when I did, it gave vague, inconsistent answers. So I wrote the real differences down myself, country by country, in `lib/methods.ts`. That file is honestly the heart of this project. It's why the comparison is specific enough to trust.

**And I had to stop letting one model do everything.** My first working version told a Telugu-speaking parent that `62 − 27 = 55`. Confidently. In the exact panel a parent is supposed to trust. That scared me — a homework helper that gets numbers wrong is worse than no homework helper at all, because now the parent looks wrong in front of their kid. So I split it up: the vision model is only allowed to copy the worksheet down, and a much stronger model does all the actual thinking. Then I wrote `eval/run.py`, which re-does every single equation the model writes and fails it if anything is off. The three demo worksheets pass — 8, 16, and 8 equations checked, zero wrong.

## Where it's honest about itself

It works. The three sample worksheets are saved ahead of time so it's instant for you; anything else — your own worksheet, a sample you edited, a different language — runs live and takes one to three minutes, because the big model has to wake up first. Handwritten worksheets are the shakiest part. All of that is written down in the README, not hidden.

---

**Live demo:** https://homework-bridge-rho.vercel.app
**Repo:** https://github.com/Adarsh-Samanu/homework-bridge

*Built for the Suvidha International Foundation AI Virtual Hackathon 2026.*
