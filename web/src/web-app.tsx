import React, { useEffect, useMemo, useRef, useState } from 'react';

// Types
type Question = {
  id: string;
  question: string;
  options: string[];
  correct: number[]; // indexes of correct answers (single or multi)
  basis?: string;
  source?: string;
};

type QuestionSet = { questions: Question[] };

type Stats = {
  name: string;
  totalCorrect: number;
  totalQuestions: number;
  testsTaken: number;
  lastPercent?: number;
};

// Normalization helpers
function normalizeOne(raw: any, idx: number): Question | null {
  if (!raw) return null;
  const id = String(raw.id ?? idx + 1);
  const qtext = String(raw.question ?? raw.text ?? '').trim();
  if (!qtext) return null;

  let options: string[] = [];
  if (Array.isArray(raw.options)) {
    options = raw.options.map((t: any) => String(t));
  } else if (raw.options && typeof raw.options === 'object') {
    const keys = Object.keys(raw.options).sort();
    options = keys.map((k) => String((raw.options as any)[k]));
  }

  let correct: number[] = [];
  const corr = raw.correct ?? raw.answer_index;
  if (Array.isArray(corr)) {
    correct = corr
      .map((v) => (typeof v === 'number' ? v : typeof v === 'string' ? v.toUpperCase().charCodeAt(0) - 65 : -1))
      .filter((i) => Number.isFinite(i) && i >= 0 && i < options.length);
  } else if (typeof corr === 'number') {
    if (corr >= 0 && corr < options.length) correct = [corr];
  } else if (typeof corr === 'string' && corr.length) {
    const i = corr.toUpperCase().charCodeAt(0) - 65;
    if (i >= 0 && i < options.length) correct = [i];
  }

  return { id, question: qtext, options, correct, basis: raw.basis ? String(raw.basis) : undefined, source: raw.source ? String(raw.source) : undefined };
}

function normalizeSet(input: any): QuestionSet {
  const root = Array.isArray(input) ? { questions: input } : input || {};
  const items = Array.isArray(root.questions) ? root.questions : [];
  const questions: Question[] = [];
  items.forEach((r: any, i: number) => {
    const q = normalizeOne(r, i);
    if (q && q.options.length > 0) questions.push(q);
  });
  return { questions };
}

// Optional passcode gate
function Gate({ children, onName }: { children: React.ReactNode; onName: (n: string) => void }) {
  const EXPECTED = 'kozaznosa';
  const [ok, setOk] = useState(false);
  const [pwd, setPwd] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('ksh-quiz-pass-ok');
    const savedName = localStorage.getItem('ksh-quiz-username') || '';
    if (saved === '1' && savedName) {
      setOk(true);
      setName(savedName);
      onName(savedName);
    }
  }, [onName]);

  if (ok) return <>{children}</>;

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f1f5f9' }}>
      <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 20px 50px rgba(2,6,23,.12)', padding: 24, width: 400, border: '1px solid #e2e8f0' }}>
        <h1 style={{ margin: '0 0 8px', color: '#0f172a' }}>KSH Quiz</h1>
        <p style={{ margin: '0 0 16px', color: '#475569', fontSize: 14 }}>Wpisz hasło i swoje imię (lub nick).</p>
        <div style={{ display: 'grid', gap: 10 }}>
          <input
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Hasło (friends only)"
            type="password"
            style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: 10 }}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Imię lub nick"
            style={{ width: '100%', height: 40, padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: 10 }}
          />
          {err && <div style={{ color: '#dc2626', fontSize: 13 }}>{err}</div>}
          <button
            onClick={() => {
              if (pwd.trim() !== EXPECTED) {
                setErr('Błędne hasło.');
                return;
              }
              const n = name.trim();
              if (!n) {
                setErr('Podaj imię lub nick.');
                return;
              }
              localStorage.setItem('ksh-quiz-pass-ok', '1');
              localStorage.setItem('ksh-quiz-username', n);
              setOk(true);
              onName(n);
            }}
            style={{ marginTop: 4, width: '100%', height: 40, borderRadius: 10, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 600 }}
          >
            Wejdź
          </button>
        </div>
      </div>
    </div>
  );
}

// Built-in (bundled) sets
const bundledModules = import.meta.glob('./question_sets/*.json', { eager: true }) as Record<string, QuestionSet | { default: QuestionSet }>;

function normalizeBundled(): Record<string, QuestionSet> {
  const out: Record<string, QuestionSet> = {};
  for (const [path, mod] of Object.entries(bundledModules)) {
    const data = (mod as any).default ?? (mod as any);
    const name = path.split('/').pop()!.replace(/\.json$/i, '');
    if (data) out[name] = normalizeSet(data);
  }
  return out;
}

// Public folder sets via manifest
async function loadPublicSetsFromManifest(): Promise<Record<string, QuestionSet>> {
  const base = (import.meta as any).env.BASE_URL || '/';
  const norm = base.endsWith('/') ? base.slice(0, -1) : base;
  const manifestURLs = [`${norm}/question_sets/manifest.json`, `/question_sets/manifest.json`];

  let manifestList: string[] | null = null;
  for (const url of manifestURLs) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      let text = await res.text();
      text = text.replace(/^\uFEFF/, '').trim();
      if (text.toLowerCase().startsWith('<!doctype') || text.toLowerCase().startsWith('<html')) continue;
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) {
        manifestList = arr.filter((x) => typeof x === 'string' && x.toLowerCase().endsWith('.json'));
        break;
      }
    } catch {
      // try next
    }
  }
  if (!manifestList) return {};

  const out: Record<string, QuestionSet> = {};
  for (const file of manifestList) {
    const enc = encodeURIComponent(file);
    const urls = [`${norm}/question_sets/${enc}`, `/question_sets/${enc}`];
    let loaded: QuestionSet | null = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        let text = await res.text();
        text = text.replace(/^\uFEFF/, '');
        if (text.trim().toLowerCase().startsWith('<!doctype') || text.trim().toLowerCase().startsWith('<html')) continue;
        const data = JSON.parse(text);
        const normed = normalizeSet(data);
        if (normed && Array.isArray(normed.questions) && normed.questions.length) {
          loaded = normed;
          break;
        }
      } catch {
        // try next
      }
    }
    if (loaded) {
      const name = file.replace(/\.json$/i, '');
      out[name] = loaded;
    }
  }
  return out;
}

// Local file upload
function loadFromFile(file: File): Promise<QuestionSet> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const txt = String(reader.result).replace(/^\uFEFF/, '');
        const data = JSON.parse(txt);
        const normed = normalizeSet(data);
        if (!normed || !Array.isArray(normed.questions) || !normed.questions.length) {
          reject(new Error('Selected file is missing a top-level "questions" array.'));
        } else {
          resolve(normed);
        }
      } catch {
        reject(new Error('Selected file is not valid JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read the selected file.'));
    reader.readAsText(file);
  });
}

// App
export default function WebApp() {
  const [sets, setSets] = useState<Record<string, QuestionSet>>(() => normalizeBundled());
  const [setName, setSetName] = useState<string>('');
  const [all, setAll] = useState<Question[] | null>(null);
  const [count, setCount] = useState(5);
  const [picked, setPicked] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const didUpdateStats = useRef(false);

  useEffect(() => {
    loadPublicSetsFromManifest()
      .then((pub) => {
        const merged = { ...normalizeBundled(), ...pub };
        setSets(merged);
        if (!setName) {
          const first = Object.keys(merged)[0] || '';
          setSetName(first);
          setAll(first ? merged[first].questions : null);
        }
      })
      .catch(() => {
        const b = normalizeBundled();
        setSets((prev) => (Object.keys(prev).length ? prev : b));
        if (!setName) {
          const first = Object.keys(b)[0] || '';
          setSetName(first);
          setAll(first ? b[first].questions : null);
        }
      });
  }, []);

  useEffect(() => {
    if (!setName) {
      setAll(null);
      return;
    }
    const data = sets[setName];
    setAll(data?.questions ?? null);
    setPicked([]);
    setAnswers({});
    setSubmitted(false);
  }, [setName, sets]);

  function start() {
    if (!all || all.length === 0) {
      alert('No questions found. Add JSONs to src/question_sets (bundled) or list them in public/question_sets/manifest.json.');
      return;
    }
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    const sel = shuffled.slice(0, Math.min(count, shuffled.length));
    setPicked(sel);
    const init: Record<string, number[]> = {};
    sel.forEach((q) => (init[q.id] = []));
    setAnswers(init);
    setSubmitted(false);
  }

  const score = useMemo(() => {
    if (!submitted) return 0;
    return picked.reduce((s, q) => {
      const sel = new Set(answers[q.id] || []);
      const corr = q.correct.slice().sort();
      const ok = sel.size === corr.length && corr.every((i) => sel.has(i));
      return s + (ok ? 1 : 0);
    }, 0);
  }, [submitted, picked, answers]);
  const percent = useMemo(() => (picked.length ? Math.round((score / picked.length) * 100) : 0), [score, picked.length]);
  const answeredCount = useMemo(() => picked.reduce((n, q) => n + ((answers[q.id] || []).length > 0 ? 1 : 0), 0), [answers, picked]);
  const progressPct = useMemo(() => (picked.length ? Math.round((answeredCount / picked.length) * 100) : 0), [answeredCount, picked.length]);

  function readStats(): Stats {
    const raw = localStorage.getItem('ksh-quiz-stats');
    if (!raw) return { name: userName || (localStorage.getItem('ksh-quiz-username') || ''), totalCorrect: 0, totalQuestions: 0, testsTaken: 0 };
    try {
      const p = JSON.parse(raw);
      return {
        name: String(p.name || userName || localStorage.getItem('ksh-quiz-username') || ''),
        totalCorrect: Number(p.totalCorrect || 0),
        totalQuestions: Number(p.totalQuestions || 0),
        testsTaken: Number(p.testsTaken || 0),
        lastPercent: typeof p.lastPercent === 'number' ? p.lastPercent : undefined,
      };
    } catch {
      return { name: userName || (localStorage.getItem('ksh-quiz-username') || ''), totalCorrect: 0, totalQuestions: 0, testsTaken: 0 };
    }
  }
  function writeStats(s: Stats) { localStorage.setItem('ksh-quiz-stats', JSON.stringify(s)); }

  useEffect(() => {
    if (!submitted) { didUpdateStats.current = false; return; }
    if (didUpdateStats.current) return;
    const prev = readStats();
    const next: Stats = {
      name: userName || prev.name || (localStorage.getItem('ksh-quiz-username') || ''),
      totalCorrect: prev.totalCorrect + score,
      totalQuestions: prev.totalQuestions + picked.length,
      testsTaken: prev.testsTaken + 1,
      lastPercent: percent,
    };
    writeStats(next);
    didUpdateStats.current = true;
  }, [submitted, score, picked.length, percent, userName]);

  const averagePercent = useMemo(() => {
    const s = readStats();
    return s.totalQuestions ? Math.round((s.totalCorrect / s.totalQuestions) * 100) : 0;
  }, [submitted]);

  // Choose one alternative link once per mount
  const altLink = useMemo(() => {
    const list = [
      { href: 'https://kariera.lidl.pl/', label: 'Lidl' },
      { href: 'https://pracawbiedronce.pl/', label: 'Biedronka' },
      { href: 'https://praca.zabka.pl/', label: 'Żabka' },
    ];
    return list[Math.floor(Math.random() * list.length)];
  }, []);

  function resultComment(p: number): JSX.Element {
    if (p > 80) return <div style={{ color: '#16a34a' }}>Dobra robota! Świetny wynik!</div>;
    if (p >= 50 && p <= 70) return <div style={{ color: '#64748b' }}>Meh — można lepiej.</div>;
    if (p >= 40 && p < 50) return <div style={{ color: '#dc2626' }}>You better focus or else.</div>;
    if (p < 30) return (
      <div style={{ color: '#dc2626' }}>
        Damn... może lepiej zajrzyj tutaj:
        {' '}<a href={altLink.href} target="_blank" rel="noreferrer">{altLink.label}</a>
        <div>
          <a
            href={altLink.href}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#2563eb', textDecoration: 'underline', wordBreak: 'break-all' }}
          >
            {altLink.href}
          </a>
        </div>
      </div>
    );
    return <div style={{ color: '#dc2626' }}>You wish Kidyba was still here huh?</div>;
  }

  return (
    <Gate onName={(n) => setUserName(n)}>
      <div className="max-w-5xl mx-auto my-10 px-4">
        <header className="sticky top-0 z-10 mb-4 rounded-xl border border-slate-200 bg-gradient-to-b from-slate-100/90 to-slate-200/90 backdrop-blur-sm shadow-sm animate-fade">
          <div className="flex items-center gap-3 px-3 py-2">
            <h1 className="m-0 text-lg text-slate-900 font-semibold">KSH Quiz</h1>
            <div className="ml-auto text-sm text-slate-600 flex items-center gap-3">
              <span>Użytkownik: <strong>{userName || localStorage.getItem('ksh-quiz-username') || '-'}</strong></span>
              <span>Średnia: <strong>{averagePercent}%</strong></span>
            </div>
          </div>
        </header>

        <section className="card p-4 flex items-center gap-3">
          <label className="text-sm text-slate-700 flex items-center gap-2">
            <span>Zestaw:</span>
            <select value={setName} onChange={(e) => setSetName(e.target.value)} className="input w-64">
              {Object.keys(sets).length === 0 && <option value="">(brak zestawów)</option>}
              {Object.keys(sets).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700 flex items-center gap-2">
            Liczba pytań:
            <input type="number" min={1} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} className="w-20 h-9 rounded-xl border border-slate-300 px-2" />
          </label>

          <button onClick={start} className="btn btn-primary h-9">Start</button>

          {/* Upload JSON fallback */}
          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-slate-600">or import JSON:</label>
            <input
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const data = await loadFromFile(file);
                  const name = file.name.replace(/\.json$/i, '');
                  setSets((prev) => ({ ...prev, [name]: data }));
                  setSetName(name);
                  setAll(data.questions);
                  setPicked([]);
                  setAnswers({});
                  setSubmitted(false);
                  alert(`Loaded ${data.questions.length} questions from ${file.name}`);
                } catch (err: any) {
                  alert(String(err?.message || err));
                }
              }}
            />
          </div>
        </section>

        {picked.length > 0 && !submitted && (
          <div className="card mt-4 p-4">
            <div className="mb-3" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', marginBottom: 6 }}>
                <span>Postęp</span>
                <span>{answeredCount}/{picked.length} ({progressPct}%)</span>
              </div>
              <div style={{ height: 8, background: '#e2e8f0', borderRadius: 9999 }}>
                <div style={{ width: `${progressPct}%`, height: '100%', background: '#0f172a', borderRadius: 9999, transition: 'width .2s ease' }} />
              </div>
            </div>
            {picked.map((q, idx) => (
              <div key={q.id} className="mb-4">
                <div className="font-semibold mb-2 text-slate-900" style={{ fontWeight: 600, marginBottom: 8, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{idx + 1}. {q.question}</span>
                  {q.correct.length > 1 && (
                    <span className="ml-2 text-xs" style={{ fontSize: 12, padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 9999 }}>multiple</span>
                  )}
                </div>
                <div className="grid gap-2" style={{ display: 'grid', gap: 8 }}>
                  {q.options.map((opt, i) => {
                    const isMulti = q.correct.length > 1;
                    const pickedSet = new Set(answers[q.id] || []);
                    const checked = pickedSet.has(i);
                    return (
                      <label
                        key={i}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${checked ? 'bg-slate-50 border-slate-300' : 'bg-white border-slate-200'}`}
                        style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 10, border: '1px solid #e2e8f0', background: checked ? '#f8fafc' : '#fff' }}
                      >
                        <input
                          type={isMulti ? 'checkbox' : 'radio'}
                          name={q.id}
                          checked={checked}
                          onChange={() =>
                            setAnswers((prev) => {
                              const cur = new Set(prev[q.id] || []);
                              if (isMulti) {
                                if (cur.has(i)) cur.delete(i); else cur.add(i);
                              } else {
                                cur.clear(); cur.add(i);
                              }
                              return { ...prev, [q.id]: Array.from(cur) };
                            })
                          }
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            <button onClick={() => setSubmitted(true)} className="btn h-10 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold">Submit</button>
          </div>
        )}

        {submitted && (
          <div className="card mt-4 p-4">
            <h2 className="mt-0">Wynik: {score}/{picked.length} ({percent}%)</h2>
            <div className="my-2">{resultComment(percent)}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, marginBottom: 12 }}>
              <span className="chip" style={{ background: '#ecfdf5', color: '#065f46' }}>✓ poprawna wybrana</span>
              <span className="chip" style={{ background: '#fef2f2', color: '#991b1b' }}>✗ błędna wybrana</span>
              <span className="chip" style={{ background: '#fffbeb', color: '#92400e' }}>⚠ poprawna pominięta</span>
            </div>
            {picked.map((q, idx) => {
              const selSet = new Set(answers[q.id] || []);
              return (
                <div key={q.id} style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>
                    {idx + 1}. {q.question}
                  </div>
                  {q.options.map((opt, i) => {
                    const isRight = q.correct.includes(i);
                    const isChosen = selSet.has(i);
                    let cls = 'answer-neutral';
                    let prefix = '–';
                    if (isRight && isChosen) { cls = 'answer-correct'; prefix = '✓'; }
                    else if (!isRight && isChosen) { cls = 'answer-wrong'; prefix = '✗'; }
                    else if (isRight && !isChosen) { cls = 'answer-missed'; prefix = '✓'; }
                    return (
                      <div key={i} className={`answer-row ${cls}`}>
                        {`${prefix} ${opt}`}
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 6, fontSize: 13, color: '#475569' }}>
                    Źródło: {q.basis || '\u2014'} {q.source ? <a href={q.source} target="_blank" rel="noreferrer">[link]</a> : null}
                  </div>
                </div>
              );
            })}
            <button onClick={() => { setPicked([]); setSubmitted(false); }} className="btn btn-secondary">Back</button>
          </div>
        )}
      </div>
    </Gate>
  );
}
