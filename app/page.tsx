"use client";

import { useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WorksheetAnalysis | null>(null);

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

  async function onFile(file: File) {
    const buffer = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    setImageBase64(btoa(binary));
    setImageMediaType(file.type || "image/jpeg");
    setText("");
    setResult(null);
    setError(null);
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
            {imageBase64 && <span className="muted">Photo attached.</span>}
          </div>
        </div>

        <div style={{ marginTop: "1.1rem" }}>
          <button className="primary" onClick={analyze} disabled={!canAnalyze}>
            {loading ? "Reading the worksheet…" : "Help me help my child"}
          </button>
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
