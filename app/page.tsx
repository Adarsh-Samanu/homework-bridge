"use client";

import { useEffect, useState } from "react";
import { SAMPLES } from "@/lib/samples";
import { COUNTRY_PROFILES } from "@/lib/methods";
import { SUPPORTED_LANGUAGES } from "@/lib/prompt";
import type { WorksheetAnalysis } from "@/lib/types";

export default function Home() {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("es");
  const [country, setCountry] = useState("MX");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMediaType, setImageMediaType] = useState<string | null>(null);
  const [imageKb, setImageKb] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WorksheetAnalysis | null>(null);
  const [wasCached, setWasCached] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  /**
   * Live analysis runs 70-180s, because a large model has to be loaded on
   * demand before it can answer. Without a visible clock a long wait is
   * indistinguishable from a hang, and people close the tab.
   */
  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const started = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [loading]);

  function loadSample(id: string) {
    const sample = SAMPLES.find((s) => s.id === id);
    if (!sample) return;
    setText(sample.text);
    setLanguage(sample.suggestedLanguage);
    setCountry(sample.suggestedCountry);
    setImageBase64(null);
    setImageMediaType(null);
    setResult(null);
    setError(null);
  }

  /**
   * Downscale and re-encode the photo before sending.
   *
   * The previous version walked the raw file bytes and called btoa() on the
   * result, which fails outright on Safari for a large photo ("The string did
   * not match the expected pattern") and, when it did work, produced a
   * multi-megabyte base64 payload — slow to upload and slow for the vision
   * model to read.
   *
   * Canvas re-encoding fixes all of that at once: a worksheet is text on
   * paper, so 1600px on the long edge is plenty to read it, and JPEG at 0.85
   * typically lands under 400KB.
   */
  async function onFile(file: File) {
    setError(null);
    setResult(null);
    try {
      const dataUrl = await downscaleToJpeg(file, 1600, 0.85);
      const [, base64] = dataUrl.split(",");
      setImageBase64(base64);
      setImageMediaType("image/jpeg");
      setImageKb(Math.round((base64.length * 3) / 4 / 1024));
      setText("");
    } catch {
      // Most commonly an iPhone HEIC on a browser that cannot decode it.
      setError(
        "Could not read that image. If it came from an iPhone it may be in HEIC format — " +
          "take a screenshot of it, or set the camera to \u201CMost Compatible\u201D, and try again.",
      );
    }
  }

  function downscaleToJpeg(
    file: File,
    maxEdge: number,
    quality: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no 2d context"));
        // White backdrop: JPEG has no alpha, and a transparent PNG would
        // otherwise flatten to black and hide the worksheet entirely.
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("decode failed"));
      };
      img.src = url;
    });
  }

  async function analyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text || undefined,
          imageBase64: imageBase64 ?? undefined,
          imageMediaType: imageMediaType ?? undefined,
          language,
          schoolingCountry: country,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Something went wrong.");
      setResult(data.analysis as WorksheetAnalysis);
      setWasCached(Boolean(data.cached));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Browser speech synthesis rather than a TTS API: it is free, works offline,
   * and covers many of these languages. Voice availability varies by device, so
   * this is a real feature with a real caveat, not a stub — see the README.
   */
  function speak(content: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = language;
    window.speechSynthesis.speak(utterance);
  }

  const canAnalyze = (text.trim().length > 0 || imageBase64 !== null) && !loading;

  /**
   * Whether this exact combination is pre-rendered.
   *
   * Cache keys are text + language + country, so loading a sample and then
   * changing the language silently drops the request onto the live model,
   * which can take several minutes. Saying so up front is better than letting
   * someone sit in front of a spinner wondering what broke.
   */
  const matchingSample = SAMPLES.find((s) => s.text.trim() === text.trim());
  const willBeInstant =
    !imageBase64 &&
    matchingSample !== undefined &&
    matchingSample.suggestedLanguage === language &&
    matchingSample.suggestedCountry === country;
  const offFastPath = matchingSample !== undefined && !willBeInstant && !imageBase64;

  return (
    <div className="wrap">
      <header>
        <h1>Homework Bridge</h1>
        <p className="lede">
          Your child&rsquo;s worksheet, explained in your language — and worked
          through both the way their school teaches it and the way you learned
          it, side by side.
        </p>
        <p className="muted">
          Translation alone doesn&rsquo;t help. You can already do this math. What
          stops you is that it&rsquo;s written with a method you&rsquo;ve never seen.
        </p>
      </header>

      <section className="card">
        <label>Try it without uploading anything</label>
        <div className="samples">
          {SAMPLES.map((sample) => (
            <button
              key={sample.id}
              className="sample"
              onClick={() => loadSample(sample.id)}
            >
              <strong>{sample.label}</strong>
              <span>{sample.hook}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="row">
          <div className="field">
            <label htmlFor="language">Explain it to me in</label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="country">I went to school in</label>
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {COUNTRY_PROFILES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <label htmlFor="worksheet">The homework</label>
          <textarea
            id="worksheet"
            value={text}
            placeholder="Type or paste the worksheet here, or attach a photo below."
            onChange={(e) => {
              setText(e.target.value);
              setImageBase64(null);
            }}
          />
          <div className="row" style={{ marginTop: "0.75rem", alignItems: "center" }}>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
            {imageBase64 && (
              <span className="muted">
                Photo attached{imageKb !== null && ` — resized to ${imageKb} KB`}.
              </span>
            )}
          </div>
        </div>

        <div style={{ marginTop: "1.1rem" }}>
          <button className="primary" onClick={analyze} disabled={!canAnalyze}>
            {loading
              ? `Reading the worksheet… ${elapsed}s`
              : "Help me help my child"}
          </button>
          {!loading && willBeInstant && (
            <p className="muted" style={{ marginBottom: 0 }}>
              This sample is pre-rendered — results appear instantly.
            </p>
          )}
          {!loading && offFastPath && (
            <p className="muted" style={{ marginBottom: 0 }}>
              You&rsquo;ve changed the language or country for this sample, so it
              will run live — expect several minutes. Set it back to{" "}
              {SUPPORTED_LANGUAGES.find(
                (l) => l.code === matchingSample?.suggestedLanguage,
              )?.name}{" "}
              to get the instant version.
            </p>
          )}
          {loading && (
            <p className="muted" style={{ marginBottom: 0 }}>
              This can take one to three minutes. The model that does the
              explaining is large and has to start up before it can answer —
              please leave this tab open.
            </p>
          )}
        </div>
      </section>

      {error && (
        <section className="card error">
          <strong>Couldn&rsquo;t read that.</strong>
          <p className="muted" style={{ marginBottom: 0 }}>{error}</p>
        </section>
      )}

      {result && (
        <section className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            {result.subject} &middot; {result.gradeLevel}
            {wasCached && " · saved result for this sample worksheet"}
          </p>
          <h2 style={{ marginTop: 0 }}>What they&rsquo;re being asked to do</h2>
          <p>{result.assignment}</p>
          <button onClick={() => speak(result.assignment)}>Read aloud</button>

          <div className="methods">
            <div className="method school">
              <h3>{result.schoolMethod.name}</h3>
              <p className="origin">{result.schoolMethod.origin}</p>
              {result.schoolMethod.steps.map((step, i) => (
                <div className="step" key={i}>
                  <div>{step.explanation}</div>
                  <div className="notation">{step.notation}</div>
                </div>
              ))}
            </div>

            {result.familiarMethod && (
              <div className="method familiar">
                <h3>{result.familiarMethod.name}</h3>
                <p className="origin">{result.familiarMethod.origin}</p>
                {result.familiarMethod.steps.map((step, i) => (
                  <div className="step" key={i}>
                    <div>{step.explanation}</div>
                    <div className="notation">{step.notation}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {result.bridge && (
            <>
              <h2 className="section">How the two line up</h2>
              <p>{result.bridge}</p>
              <button onClick={() => speak(result.bridge!)}>Read aloud</button>
            </>
          )}

          {result.notationWarnings.length > 0 && (
            <>
              <h2 className="section">Watch out for</h2>
              {result.notationWarnings.map((w, i) => (
                <div className="warn" key={i}>{w}</div>
              ))}
            </>
          )}

          {result.jargon.length > 0 && (
            <>
              <h2 className="section">Words from school that don&rsquo;t translate</h2>
              <ul className="plain">
                {result.jargon.map((j, i) => (
                  <li key={i}>
                    <strong>{j.term}</strong> — {j.meaning}
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="section">Ask your child this, instead of giving the answer</h2>
          <ul className="plain">
            {result.questionsToAsk.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
          <button onClick={() => speak(result.questionsToAsk.join(". "))}>
            Read aloud
          </button>
        </section>
      )}

      <footer>
        Built for the Suvidha International Foundation AI Virtual Hackathon 2026.
        Worked examples deliberately use different numbers than the assigned
        problems — this is built to help a parent help, not to do the homework.
      </footer>
    </div>
  );
}
