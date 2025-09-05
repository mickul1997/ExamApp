import React, { useMemo, useState, useEffect } from 'react';
import { Resizable } from 're-resizable';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  BookOpen,
  RotateCcw,
  Maximize2,
  Minimize2,
  FolderOpen,
  FileJson,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';

// -----------------------------------------------------------------------------
// Type definitions

// Represents a single answer option on a question
interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

// Represents a single question, including a textual basis for the answer
interface Question {
  id: string;
  text: string;
  options: Option[];
  basis: { label: string; href?: string };
}

// A loaded question set with a name and title (from the file name and file)
interface LoadedSet {
  name: string;
  title: string;
  questions: Question[];
}

// -----------------------------------------------------------------------------
// Helper utilities

/**
 * Join class names together, ignoring falsey values.  Useful for conditional
 * classes in JSX.
 */
function classNames(...arr: Array<string | false | undefined>): string {
  return arr.filter(Boolean).join(' ');
}

/**
 * Normalise question sets stored in the "handel" format.  That format uses
 * labelled option keys (e.g. { "A": "…", "B": "…" }) and an array of
 * correct keys.  This helper converts that into our common shape.
 */
function normalizeFromHandel(json: any): { title: string; questions: Question[] } {
  const questions = (json.questions || []).map((q: any, i: number) => {
    const keys = Object.keys(q.options || {}).sort();
    const options: Option[] = keys.map((k) => ({
      id: k,
      text: q.options[k],
      isCorrect: Array.isArray(q.correct) ? q.correct.includes(k) : false,
    }));
    return {
      id: String(q.id ?? i + 1),
      text: q.question || '',
      options,
      basis: { label: q.basis || '', href: '' },
    };
  });
  return {
    title: json.title || json.topic || 'Zestaw pytań',
    questions,
  };
}

/**
 * Normalise more generic question set formats.  Accepts either an array of
 * questions or an object with a `questions` property.  Options can be
 * provided as an array or keyed object.  Correct answers can be given
 * as an array of indices or option letters.
 */
function normalizeGeneric(json: any): { title: string; questions: Question[] } {
  const rootQs = Array.isArray(json) ? json : json.questions || [];
  const questions: Question[] = rootQs.map((q: any, i: number) => {
    let options: Option[] = [];
    if (Array.isArray(q.options)) {
      options = q.options.map((t: any, idx: number) => ({
        id: String.fromCharCode(65 + idx),
        text: String(t),
        isCorrect: Array.isArray(q.correct)
          ? q.correct.includes(idx) || q.correct.includes(String.fromCharCode(65 + idx))
          : q.answer_index === idx,
      }));
    } else if (q.options && typeof q.options === 'object') {
      const keys = Object.keys(q.options).sort();
      options = keys.map((k) => ({
        id: k,
        text: q.options[k],
        isCorrect: Array.isArray(q.correct) ? q.correct.includes(k) : false,
      }));
    }
    return {
      id: String(q.id ?? i + 1),
      text: q.question || q.text || '',
      options,
      basis: { label: q.basis || '', href: q.source || '' },
    };
  });
  return {
    title: json.title || 'Zestaw pytań',
    questions,
  };
}

/**
 * Read a file into a string.  Returns a promise that resolves with the file
 * contents or rejects on error.
 */
async function readFileAsText(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(String(reader.result));
    reader.onerror = rej;
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * Attempt to parse a JSON string into a question set.  Tries the "handel"
 * format first, falling back to the generic format.  Returns null if the
 * input isn't valid JSON.
 */
function tryParseSet(text: string): { title: string; questions: Question[] } | null {
  try {
    const json = JSON.parse(text);
    return json.questions ? normalizeFromHandel(json) : normalizeGeneric(json);
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Fallback sample set
//
// If the user hasn't loaded any question sets yet, we display a small
// fallback quiz so they can try the app.  Once they load their own sets, this
// fallback is no longer shown.  Feel free to modify the sample questions.

const FALLBACK_SET: { title: string; questions: Question[] } = {
  title: 'Przykładowy zestaw',
  questions: [
    {
      id: 'q1',
      text: 'Wskaż spółki osobowe (zaznacz wszystkie prawidłowe).',
      options: [
        { id: 'A', text: 'Spółka jawna', isCorrect: true },
        { id: 'B', text: 'Spółka komandytowa', isCorrect: true },
        { id: 'C', text: 'Spółka z o.o.', isCorrect: false },
        { id: 'D', text: 'Prosta spółka akcyjna', isCorrect: false },
      ],
      basis: {
        label: 'KSH – Tytuł II: Spółki osobowe (sp.j., sp.p., sp.k., sp.k.a.)',
        href: '',
      },
    },
    {
      id: 'q2',
      text: 'Kto jest przedsiębiorcą w rozumieniu art. 431 KC?',
      options: [
        { id: 'A', text: 'Osoba fizyczna prowadząca działalność we własnym imieniu', isCorrect: true },
        { id: 'B', text: 'Wyłącznie spółki kapitałowe', isCorrect: false },
        { id: 'C', text: 'Jedynie osoby prawne', isCorrect: false },
        { id: 'D', text: 'Tylko podmioty wpisane do KRS', isCorrect: false },
      ],
      basis: {
        label: 'KC art. 431; Prawo przedsiębiorców art. 3–4',
        href: '',
      },
    },
  ],
};

/**
 * Randomly shuffle an array and return the first n elements.  Used to choose
 * a subset of questions for the quiz.
 */
function sampleArray<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, Math.min(n, a.length)));
}

// -----------------------------------------------------------------------------
// Main React component

export default function App(): JSX.Element {
  // Application stages: setup (choose set), quiz (answer questions), results
  const [stage, setStage] = useState<'setup' | 'quiz' | 'results'>('setup');

  // Window sizing: users can set a custom size, or click the fit toggle to
  // automatically scale the app to fit the available space.
  const [size, setSize] = useState({ width: 960, height: 680 });
  const [fit, setFit] = useState(false);

  // Loaded question sets and current selection
  const [sets, setSets] = useState<LoadedSet[]>([]);
  const [selectedSetName, setSelectedSetName] = useState<string>('');
  const currentSet = useMemo(() => sets.find((s) => s.name === selectedSetName) || null, [sets, selectedSetName]);

  // Quiz state: chosen questions, current index, answers and results
  const [numQuestions, setNumQuestions] = useState<number>(5);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [showResults, setShowResults] = useState<boolean>(false);

  // On initial render, load the fallback set so the app has something to
  // display.  Users can later load their own sets via the file pickers.
  useEffect(() => {
    setSets([
      {
        name: 'fallback.json',
        title: FALLBACK_SET.title,
        questions: FALLBACK_SET.questions,
      },
    ]);
    setSelectedSetName('fallback.json');
    setNumQuestions(Math.min(5, FALLBACK_SET.questions.length));
  }, []);

  // Derived values for convenience
  const q = quizQuestions[idx];
  const total = quizQuestions.length;
  const progress = useMemo(() => {
    const answered = quizQuestions.filter((qq) => (answers[qq.id] || []).length > 0).length;
    return Math.round((answered / Math.max(1, total)) * 100);
  }, [answers, quizQuestions, total]);
  const allAnswered = total > 0 && quizQuestions.every((qq) => (answers[qq.id] || []).length > 0);

  // Handle file selection (folder or individual files).  Reads each JSON file
  // and normalises it.  If valid question sets are loaded, they replace the
  // fallback set.  The first loaded set is selected by default.
  async function handlePickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const loaded: LoadedSet[] = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.json')) continue;
      try {
        const text = await readFileAsText(file);
        const parsed = tryParseSet(text);
        if (parsed) {
          loaded.push({ name: file.name, title: parsed.title, questions: parsed.questions });
        }
      } catch {
        // ignore parse errors
      }
    }
    if (loaded.length) {
      setSets(loaded);
      setSelectedSetName(loaded[0].name);
      setNumQuestions(Math.min(loaded[0].questions.length, 20));
    }
    // Reset the input so the same files can be selected again
    e.target.value = '';
  }

  // Begin the quiz: sample questions and reset state
  function startQuiz() {
    const base = currentSet || sets[0];
    if (!base) return;
    const chosen = sampleArray(base.questions, numQuestions);
    setQuizQuestions(chosen);
    setAnswers({});
    setIdx(0);
    setShowResults(false);
    setStage('quiz');
  }

  // Selecting answers: handle single or multiple choice
  function togglePick(optionId: string) {
    const cur = quizQuestions[idx];
    if (!cur) return;
    const correctIds = cur.options.filter((o) => o.isCorrect).map((o) => o.id);
    const isMulti = correctIds.length > 1;
    setAnswers((prev) => {
      const current = new Set(prev[cur.id] || []);
      if (isMulti) {
        if (current.has(optionId)) {
          current.delete(optionId);
        } else {
          current.add(optionId);
        }
      } else {
        current.clear();
        current.add(optionId);
      }
      return { ...prev, [cur.id]: Array.from(current) };
    });
  }

  // Navigation and finishing
  const next = () => setIdx((i) => Math.min(i + 1, total - 1));
  const prev = () => setIdx((i) => Math.max(i - 1, 0));
  function finishQuiz() {
    setShowResults(true);
    setStage('results');
  }

  return (
    <div className="w-full h-full grid place-items-center p-3 bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Resizable container */}
      <Resizable
        size={fit ? undefined : size}
        onResizeStop={(e, dir, ref, d) => setSize({ width: size.width + d.width, height: size.height + d.height })}
        enable={{ bottomRight: true, right: true, bottom: true }}
        minWidth={760}
        minHeight={560}
        maxWidth={1500}
        className={classNames(
          'relative rounded-3xl shadow-xl bg-white border border-slate-200 overflow-hidden',
          fit && 'w-[min(95vw,1500px)] h-[min(90vh,960px)]'
        )}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b bg-slate-50/60 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Badge className="text-slate-700">Quiz Trainer</Badge>
              {stage !== 'setup' && (
                <div className="text-sm text-slate-500">
                  {currentSet?.title || sets[0]?.title}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFit((v) => !v)}
                title={fit ? 'Switch to manual size' : 'Fit to window'}
              >
                {fit ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStage('setup')}> 
                <RotateCcw className="h-4 w-4 mr-2" /> Start
              </Button>
            </div>
          </div>
          {/* Body */}
          <div className="flex-1 overflow-auto px-5 pb-5">
            {/* SETUP STAGE */}
            {stage === 'setup' && (
              <div className="max-w-3xl mx-auto pt-6">
                <h2 className="text-xl md:text-2xl font-semibold text-slate-800 mb-4">
                  Choose a question set
                </h2>
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <FolderOpen className="h-4 w-4" />
                      <span>
                        Load folder <code>question_sets</code> (JSON)
                      </span>
                      <input
                        type="file"
                        multiple
                        // @ts-ignore: webkitdirectory is a non-standard attribute supported in Chromium-based browsers
                        webkitdirectory="true"
                        directory="true"
                        className="hidden"
                        onChange={handlePickFiles}
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <FileJson className="h-4 w-4" />
                      <span>or a single JSON file</span>
                      <input
                        type="file"
                        accept="application/json"
                        className="hidden"
                        onChange={handlePickFiles}
                      />
                    </label>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-xs text-slate-500">Available sets</span>
                    <select
                      value={selectedSetName}
                      onChange={(e) => setSelectedSetName(e.target.value)}
                      className="w-full md:w-80 h-9 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      {sets.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.title} ({s.name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-xs text-slate-500">Number of questions</span>
                    <Input
                      type="number"
                      min={1}
                      max={currentSet?.questions.length || 50}
                      value={numQuestions}
                      onChange={(e) =>
                        setNumQuestions(
                          Math.max(
                            1,
                            Math.min(
                              parseInt(e.target.value || '1', 10),
                              currentSet?.questions.length || 50,
                            ),
                          ),
                        )
                      }
                      className="w-32"
                    />
                    <div className="text-xs text-slate-500">
                      This set contains {currentSet?.questions.length ?? FALLBACK_SET.questions.length} questions.
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button onClick={startQuiz}>Start test</Button>
                  </div>
                </div>
              </div>
            )}
            {/* QUIZ STAGE */}
            {stage === 'quiz' && q && (
              <div className="max-w-3xl mx-auto pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-slate-500">
                    Question {idx + 1} of {total}
                  </div>
                  <div className="w-48">
                    <Progress value={progress} className="h-2" />
                  </div>
                </div>
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-800 mb-4">
                  {q.text}
                </h2>
                <div className="grid gap-2">
                  {q.options.map((opt) => {
                    const sel = new Set(answers[q.id] || []);
                    const isSelected = sel.has(opt.id);
                    // Define dynamic classes for the selection state
                    const base = 'w-full text-left px-4 py-3 rounded-2xl border transition-all';
                    const palette = isSelected
                      ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-300 scale-[1.01]'
                      : 'border-slate-200 hover:bg-slate-50 hover:scale-[1.005]';
                    return (
                      <motion.button
                        key={opt.id}
                        whileTap={{ scale: 0.995 }}
                        onClick={() => togglePick(opt.id)}
                        className={classNames(base, palette)}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={classNames(
                              'inline-flex h-5 w-5 rounded-md border items-center justify-center text-[11px]',
                              isSelected
                                ? 'border-blue-500 bg-blue-500 text-white'
                                : 'border-slate-300 text-slate-400',
                            )}
                          >
                            {opt.id}
                          </span>
                          <span>{opt.text}</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={prev} disabled={idx === 0}>
                      Back
                    </Button>
                    <Button variant="secondary" onClick={next} disabled={idx === total - 1}>
                      Next
                    </Button>
                  </div>
                  <Button onClick={finishQuiz} disabled={!allAnswered}>
                    Finish &amp; show results
                  </Button>
                </div>
              </div>
            )}
            {/* RESULTS STAGE */}
            {stage === 'results' && showResults && (
              <div className="max-w-4xl mx-auto pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl md:text-2xl font-semibold text-slate-800">Results</h2>
                  <div className="w-56">
                    <Progress value={100} className="h-2" />
                  </div>
                </div>
                <div className="grid gap-3">
                  {quizQuestions.map((qq, i) => {
                    const sel = new Set(answers[qq.id] || []);
                    const correctList = qq.options.filter((o) => o.isCorrect);
                    const ok = correctList.length === sel.size && correctList.every((o) => sel.has(o.id));
                    return (
                      <div
                        key={qq.id}
                        className={classNames(
                          'p-4 rounded-2xl border',
                          ok ? 'border-green-200 bg-green-50/60' : 'border-red-200 bg-red-50/60',
                        )}
                      >
                        {/* Question header with status icon */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm text-slate-500">
                              Question {i + 1}
                              {correctList.length > 1 && (
                                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                  Multiple
                                </span>
                              )}
                            </div>
                            <div className="font-medium text-slate-800 leading-snug">
                              {qq.text}
                            </div>
                          </div>
                          {ok ? (
                            <CheckCircle2 className="h-5 w-5 text-green-700" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-700" />
                          )}
                        </div>
                        {/* Options with styling based on correctness & selection */}
                        <div className="mt-2 space-y-1 text-sm">
                          {qq.options.map((opt) => {
                            const picked = sel.has(opt.id);
                            const isCorr = opt.isCorrect;
                            // Determine classes: bold always for correct answers; additional colour if selected
                            let textColor = 'text-slate-700';
                            if (picked && isCorr) textColor = 'text-green-700';
                            if (picked && !isCorr) textColor = 'text-red-700';
                            return (
                              <div
                                key={opt.id}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                              >
                                <span
                                  className={classNames(
                                    'inline-flex h-4 w-4 rounded-md border items-center justify-center text-[10px] font-medium',
                                    isCorr ? 'border-green-400 bg-green-100' : 'border-slate-300 bg-white',
                                    picked && !isCorr && 'border-red-400 bg-red-100',
                                  )}
                                >
                                  {opt.id}
                                </span>
                                <span className={classNames(isCorr && 'font-semibold', textColor)}>
                                  {opt.text}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {/* Basis / explanation */}
                        {qq.basis?.label && (
                          <div className="mt-2 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <BookOpen className="h-3 w-3" /> Basis:
                            </span>{' '}
                            {qq.basis.href ? (
                              <a
                                href={qq.basis.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {qq.basis.label}
                              </a>
                            ) : (
                              <span className="italic">{qq.basis.label}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <Button variant="secondary" onClick={() => setStage('quiz')}>Return to test</Button>
                  <Button onClick={() => setStage('setup')}>New test</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Resizable>
      {/* Usage hint */}
      <div className="absolute bottom-2 left-3 text-[11px] text-slate-500 max-w-xs md:max-w-md">
        Hint: Load a folder containing JSON question sets or a single JSON file. After answering all questions, finish to see your score. Use the corner handle to resize the window or the maximise button to fit it to your screen.
      </div>
    </div>
  );
}