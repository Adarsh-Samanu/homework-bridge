#!/usr/bin/env python3
"""
Model A/B for worksheet analysis.

Runs the same worksheet through the app's real /api/analyze route with a model
override, so the prompt under test is the one the app actually ships rather
than a copy that can drift.

The arithmetic check is the point. A homework helper that returns confident
wrong numbers is worse than no tool at all, so correctness is scored
automatically instead of eyeballed: every "A - B = C" and "A x B = C" the model
writes is re-computed and compared.

Usage:  python3 eval/run.py            # all models
        python3 eval/run.py GLM-5.2    # substring filter
"""
import json
import re
import sys
import time
import urllib.request

ENDPOINT = "http://localhost:3000/api/analyze"
import os
LANG = os.environ.get("EVAL_LANG", "te")

MODELS = [
    "deepseek-ai/DeepSeek-V3.2",           # fast, non-reasoning, cheap
    "MiniMaxAI/MiniMax-M3",
    "zai-org/GLM-5.2",                     # reasoning; correct but unpredictable
]

WORKSHEET = """Name: ____________________  Date: __________
Module 3 - Subtraction with Regrouping

Use a number bond to decompose the second number, then subtract.
Remember to regroup from the tens place when you cannot subtract.

1)  62 - 27 = ______
2)  84 - 39 = ______
3)  71 - 45 = ______

Draw your number bond for problem 2 in the space below."""

# Negative lookahead: do not match the head of a chained expression like
# "62 - 27 = 62 - 20 - 7", where the RHS continues into another operator.
# Without it the checker reports correct decomposition steps as errors.
TAIL = r"(?!\s*[-−+x×*/\d])"
SUB = re.compile(r"(\d{1,6})\s*[-−]\s*(\d{1,6})\s*=\s*(\d{1,6})" + TAIL)
MUL = re.compile(r"(\d{1,4})\s*[x×*]\s*(\d{1,4})\s*=\s*(\d{1,7})" + TAIL)
ADD = re.compile(r"(\d{1,6})\s*\+\s*(\d{1,6})\s*=\s*(\d{1,6})" + TAIL)


def collect_text(node, out):
    if isinstance(node, str):
        out.append(node)
    elif isinstance(node, list):
        for v in node:
            collect_text(v, out)
    elif isinstance(node, dict):
        for v in node.values():
            collect_text(v, out)


def check_arithmetic(analysis):
    chunks = []
    collect_text(analysis, chunks)
    blob = "\n".join(chunks)
    good, bad = 0, []
    for rx, op in ((SUB, lambda a, b: a - b), (MUL, lambda a, b: a * b), (ADD, lambda a, b: a + b)):
        for m in rx.finditer(blob):
            a, b, c = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if op(a, b) == c:
                good += 1
            else:
                bad.append(f"{m.group(0).strip()} (should be {op(a, b)})")
    return good, bad


def run(model):
    payload = json.dumps({
        "text": WORKSHEET,
        "language": LANG,
        "schoolingCountry": "IN",
        "modelOverride": model,
    }).encode()
    req = urllib.request.Request(
        ENDPOINT, data=payload, headers={"Content-Type": "application/json"}
    )
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            body = json.load(resp)
    except Exception as e:
        return {"model": model, "elapsed": time.time() - started, "error": str(e)[:120]}
    elapsed = time.time() - started
    if "error" in body:
        return {"model": model, "elapsed": elapsed, "error": body["error"][:120]}

    a = body["analysis"]
    good, bad = check_arithmetic(a)
    fam = a.get("familiarMethod") or {}
    return {
        "model": model,
        "elapsed": elapsed,
        "grade": a.get("gradeLevel", ""),
        "jargon": len(a.get("jargon", [])),
        "school_steps": len((a.get("schoolMethod") or {}).get("steps", [])),
        "fam_steps": len(fam.get("steps", [])),
        "fam_name": (fam.get("name") or "")[:40],
        "math_ok": good,
        "math_bad": bad,
        "bridge_len": len(a.get("bridge") or ""),
    }


def main():
    wanted = sys.argv[1] if len(sys.argv) > 1 else ""
    models = [m for m in MODELS if wanted.lower() in m.lower()]
    results = []
    for m in models:
        print(f"\n=== {m} ===", flush=True)
        r = run(m)
        results.append(r)
        if "error" in r:
            print(f"  FAILED after {r['elapsed']:.0f}s: {r['error']}", flush=True)
            continue
        verdict = "CLEAN" if not r["math_bad"] else f"{len(r['math_bad'])} WRONG"
        print(f"  {r['elapsed']:.0f}s | grade={r['grade']} | jargon={r['jargon']} "
              f"| steps {r['school_steps']}/{r['fam_steps']} | arithmetic: {r['math_ok']} ok, {verdict}",
              flush=True)
        print(f"  familiar method: {r['fam_name']}", flush=True)
        for b in r["math_bad"][:4]:
            print(f"    WRONG: {b}", flush=True)

    print("\n\n================ SUMMARY ================")
    print(f"{'model':<40} {'secs':>5} {'ok':>4} {'wrong':>6}")
    for r in results:
        if "error" in r:
            print(f"{r['model']:<40} {r['elapsed']:>5.0f}  FAILED")
        else:
            print(f"{r['model']:<40} {r['elapsed']:>5.0f} {r['math_ok']:>4} {len(r['math_bad']):>6}")


if __name__ == "__main__":
    main()
