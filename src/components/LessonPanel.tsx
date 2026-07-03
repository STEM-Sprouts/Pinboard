/**
 * Lesson tutorials (lessons.md): pick a lesson, walk it ONE step at a time —
 * kids read one card, do one thing, press Next. Hints stay hidden until
 * asked. The last stage is "Check my work", which runs the real checks
 * against the project state and a headless simulation, never code text.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Lightbulb } from 'lucide-react';
import type { Lesson } from '../lessons/lessonTypes';

interface LessonPanelProps {
  lessons: Lesson[];
  activeLessonId: string | null;
  checkResults: Record<string, boolean>;
  checking: boolean;
  locateMessage: string | null;
  showHintsAutomatically: boolean;
  onSelectLesson: (id: string | null) => void;
  onCheckWork: () => void;
  onLocateBlock: (query: string) => void;
  onClose?: () => void;
}

export default function LessonPanel(props: LessonPanelProps) {
  const active = props.lessons.find((lesson) => lesson.id === props.activeLessonId) ?? null;
  return (
    <div data-testid="lesson-panel" className="h-full flex flex-col bg-[linear-gradient(180deg,#f7faf6,#ffffff)]">
      <div className="px-5 py-4 border-b-2 border-ink flex justify-between items-center bg-white">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Lessons</p>
          <span className="block text-base font-bold text-ink truncate mt-1">{active ? active.title : 'Choose a lesson'}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {active && (
            <button
              data-testid="lesson-back"
              onClick={() => props.onSelectLesson(null)}
              className="ss-btn ss-btn-ghost px-3 py-1.5 text-xs"
            >
              All lessons
            </button>
          )}
          {props.onClose && (
            <button
              data-testid="lesson-close"
              onClick={props.onClose}
              className="text-ink font-bold text-sm px-1 hover:opacity-60"
              title="Close lessons"
              aria-label="Close lessons"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="p-4 md:p-5 flex-1 overflow-y-auto">
        {props.locateMessage && (
          <div className="mb-4 rounded-2xl border-2 border-ink bg-primary/20 px-4 py-3 text-sm font-medium text-ink shadow-[3px_3px_0_#111]">
            {props.locateMessage}
          </div>
        )}
        {!active ? (
          <LessonList lessons={props.lessons} onSelectLesson={props.onSelectLesson} />
        ) : (
          // Key by lesson id so switching lessons restarts at step 1.
          <LessonSteps
            key={active.id}
            lesson={active}
            checkResults={props.checkResults}
            checking={props.checking}
            showHintsAutomatically={props.showHintsAutomatically}
            onCheckWork={props.onCheckWork}
            onLocateBlock={props.onLocateBlock}
          />
        )}
      </div>
    </div>
  );
}

function LessonList({ lessons, onSelectLesson }: Pick<LessonPanelProps, 'lessons' | 'onSelectLesson'>) {
  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <p className="text-sm text-gray-600 max-w-xl">
          Pick a mission card. Each lesson opens into a full-page walkthrough with its own steps and checks.
        </p>
        <span className="hidden sm:inline-flex rounded-full border-2 border-ink bg-white px-3 py-1 text-xs font-semibold text-gray-600 shadow-[2px_2px_0_#111]">
          {lessons.length} lessons
        </span>
      </div>
      <ul className="grid gap-4">
        {lessons.map((lesson, index) => (
          <li key={lesson.id}>
            <button
              data-testid={`lesson-item-${lesson.id}`}
              onClick={() => onSelectLesson(lesson.id)}
              className="group ss-card w-full overflow-hidden text-left bg-white transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#111]"
            >
              <div className="p-4 md:p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-primary text-lg font-bold text-ink shadow-[3px_3px_0_#111]">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-ink">{lesson.title}</span>
                      <span className="rounded-full border border-ink/20 bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                        {lesson.steps.length} steps
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      about {lesson.estimatedMinutes} min. Open this mission to work through it one card at a time.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t-2 border-dashed border-gray-200 pt-3 text-xs font-semibold text-gray-500">
                  <span>Step-by-step lesson</span>
                  <span className="transition-transform group-hover:translate-x-0.5">Open lesson →</span>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LessonSteps({
  lesson,
  checkResults,
  checking,
  showHintsAutomatically,
  onCheckWork,
  onLocateBlock,
}: {
  lesson: Lesson;
  checkResults: Record<string, boolean>;
  checking: boolean;
  showHintsAutomatically: boolean;
  onCheckWork: () => void;
  onLocateBlock: (query: string) => void;
}) {
  // Stages: one per step, plus the final "Check my work" stage.
  const totalStages = lesson.steps.length + 1;
  const [stage, setStage] = useState(0);
  const [hintIndex, setHintIndex] = useState(0);
  const onCheckStage = stage === lesson.steps.length;
  const step = onCheckStage ? null : lesson.steps[stage];

  useEffect(() => {
    if (showHintsAutomatically && step?.hints.length) setHintIndex(step.hints.length);
  }, [showHintsAutomatically, step?.id]);

  const passedCount = lesson.checks.filter((c) => checkResults[c.id]).length;
  const allPassed = passedCount === lesson.checks.length && lesson.checks.length > 0;
  const anyResults = lesson.checks.some((c) => checkResults[c.id] !== undefined);

  const goTo = (next: number) => {
    setStage(Math.max(0, Math.min(totalStages - 1, next)));
    setHintIndex(0);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Progress: "Step 2 of 5" + segments */}
      <div className="ss-card bg-white p-4">
        <p className="text-xs font-bold text-ink mb-2" data-testid="lesson-progress">
          {onCheckStage ? 'Last part — check your work!' : `Step ${stage + 1} of ${lesson.steps.length}`}
        </p>
        <div className="flex gap-1">
          {Array.from({ length: totalStages }).map((_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full border border-ink ${
                i < stage ? 'bg-primary' : i === stage ? 'bg-primary-deep' : 'bg-white'
              }`}
            />
          ))}
        </div>
      </div>

      {!onCheckStage && step && (
        <div className="ss-card bg-white p-5 md:p-6" data-testid={`lesson-step-${step.id}`}>
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-lg font-bold text-ink">{step.title}</h3>
            {step.locate && (
              <button
                data-testid={`lesson-locate-${step.id}`}
                onClick={() => onLocateBlock(step.locate!)}
                className="ss-btn ss-btn-ghost px-3 py-1.5 text-[11px]"
              >
                Locate block
              </button>
            )}
          </div>
          <p className="mt-3 text-sm text-gray-700 leading-relaxed">{step.instructions}</p>

          {step.hints.length > 0 && (
            <div className="mt-3">
              {hintIndex < step.hints.length ? (
                <button
                  data-testid="lesson-hint"
                  onClick={() => setHintIndex((i) => i + 1)}
                  className="ss-btn ss-btn-ghost px-3 py-1.5 text-xs"
                >
                  <Lightbulb size={13} /> Need a hint?
                </button>
              ) : null}
              {step.hints.slice(0, hintIndex).map((hint, i) => (
                <p key={i} className="mt-2 text-xs text-gray-700 bg-yellow-50 border-2 border-ink rounded-lg p-2">
                  💡 {hint}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {onCheckStage && (
        <div className="ss-card bg-white p-5 md:p-6">
          <h3 className="text-lg font-bold text-ink mb-2">Did it work? Let's find out!</h3>
          <p className="text-xs text-gray-600 mb-3">
            Pinboard runs your program and checks the real result — not just how the blocks look.
          </p>
          <button data-testid="check-work" onClick={onCheckWork} disabled={checking} className="ss-btn ss-btn-primary w-full px-3 py-2 text-sm">
            {checking ? 'Checking…' : 'Check my work'}
          </button>

          <ul className="mt-3 space-y-2">
            {lesson.checks.map((checkDef) => {
              const result = checkResults[checkDef.id];
              const state = result === undefined ? 'pending' : result ? 'passed' : 'failed';
              return (
                <li
                  key={checkDef.id}
                  data-testid={`check-${checkDef.id}`}
                  data-passed={state === 'passed' ? 'true' : 'false'}
                  className={`text-xs font-medium flex items-start gap-1.5 rounded-lg border-2 border-ink p-2 ${
                    state === 'passed' ? 'bg-primary/30' : state === 'failed' ? 'bg-red-100' : 'bg-white'
                  }`}
                >
                  <span>{state === 'passed' ? '✅' : state === 'failed' ? '❌' : '⬜'}</span>
                  <span className="text-ink">{checkDef.description}</span>
                </li>
              );
            })}
          </ul>

          {allPassed && (
            <div data-testid="lesson-complete" className="mt-4 bg-primary border-2 border-ink rounded-2xl p-4 text-center shadow-[4px_4px_0_#111]">
              <p className="text-sm font-bold text-ink">🎉 You did it!</p>
              <p className="text-xs text-ink mt-0.5">Mission complete. Pick another lesson, or keep building!</p>
            </div>
          )}
          {!allPassed && anyResults && !checking && (
            <p className="mt-2 text-xs text-gray-600">
              Not all green yet — go back through the steps, fix it, and check again. That's real engineering!
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-auto pb-1">
        <button
          data-testid="lesson-prev"
          onClick={() => goTo(stage - 1)}
          disabled={stage === 0}
          className="ss-btn ss-btn-ghost px-3 py-2 text-sm"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <button
          data-testid="lesson-next"
          onClick={() => goTo(stage + 1)}
          disabled={stage === totalStages - 1}
          className="ss-btn ss-btn-primary px-3 py-2 text-sm"
        >
          Next <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
