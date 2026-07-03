/**
 * Lesson tutorials (lessons.md): pick a lesson, walk it ONE step at a time —
 * kids read one card, do one thing, press Next. Hints stay hidden until
 * asked. The last stage is "Check my work", which runs the real checks
 * against the project state and a headless simulation, never code text.
 */
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Lightbulb } from 'lucide-react';
import type { Lesson } from '../lessons/lessonTypes';

interface LessonPanelProps {
  lessons: Lesson[];
  activeLessonId: string | null;
  checkResults: Record<string, boolean>;
  checking: boolean;
  onSelectLesson: (id: string | null) => void;
  onCheckWork: () => void;
  onClose: () => void;
}

export default function LessonPanel(props: LessonPanelProps) {
  const active = props.lessons.find((lesson) => lesson.id === props.activeLessonId) ?? null;
  return (
    <div data-testid="lesson-panel" className="h-full flex flex-col bg-surface border-r-2 border-ink">
      <div className="px-4 py-3 border-b-2 border-ink flex justify-between items-center bg-primary">
        <span className="text-sm font-bold text-ink truncate">{active ? active.title : 'Lessons'}</span>
        <div className="flex items-center gap-2 shrink-0">
          {active && (
            <button
              data-testid="lesson-back"
              onClick={() => props.onSelectLesson(null)}
              className="text-xs font-semibold text-ink underline underline-offset-2 hover:no-underline"
            >
              all lessons
            </button>
          )}
          <button
            data-testid="lesson-close"
            onClick={props.onClose}
            className="text-ink font-bold text-sm px-1 hover:opacity-60"
            title="Close lessons"
            aria-label="Close lessons"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="p-3 flex-1 overflow-y-auto">
        {!active ? (
          <LessonList lessons={props.lessons} onSelectLesson={props.onSelectLesson} />
        ) : (
          // Key by lesson id so switching lessons restarts at step 1.
          <LessonSteps
            key={active.id}
            lesson={active}
            checkResults={props.checkResults}
            checking={props.checking}
            onCheckWork={props.onCheckWork}
          />
        )}
      </div>
    </div>
  );
}

function LessonList({ lessons, onSelectLesson }: Pick<LessonPanelProps, 'lessons' | 'onSelectLesson'>) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-3 px-1">
        Pick a mission — each one walks you through it step by step. 🌱
      </p>
      <ul className="space-y-3">
        {lessons.map((lesson, index) => (
          <li key={lesson.id}>
            <button
              data-testid={`lesson-item-${lesson.id}`}
              onClick={() => onSelectLesson(lesson.id)}
              className="ss-card w-full text-left p-3 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_#111] transition-all"
            >
              <span className="inline-flex items-center justify-center w-6 h-6 mr-2 bg-primary border-2 border-ink rounded-md text-xs font-bold text-ink">
                {index + 1}
              </span>
              <span className="text-sm font-bold text-ink">{lesson.title}</span>
              <span className="block text-xs text-gray-500 mt-1 ml-8">
                {lesson.steps.length} steps · about {lesson.estimatedMinutes} min
              </span>
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
  onCheckWork,
}: {
  lesson: Lesson;
  checkResults: Record<string, boolean>;
  checking: boolean;
  onCheckWork: () => void;
}) {
  // Stages: one per step, plus the final "Check my work" stage.
  const totalStages = lesson.steps.length + 1;
  const [stage, setStage] = useState(0);
  const [hintIndex, setHintIndex] = useState(0);
  const onCheckStage = stage === lesson.steps.length;
  const step = onCheckStage ? null : lesson.steps[stage];

  const passedCount = lesson.checks.filter((c) => checkResults[c.id]).length;
  const allPassed = passedCount === lesson.checks.length && lesson.checks.length > 0;
  const anyResults = lesson.checks.some((c) => checkResults[c.id] !== undefined);

  const goTo = (next: number) => {
    setStage(Math.max(0, Math.min(totalStages - 1, next)));
    setHintIndex(0);
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Progress: "Step 2 of 5" + segments */}
      <div>
        <p className="text-xs font-bold text-ink mb-1.5" data-testid="lesson-progress">
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
        <div className="ss-card p-4" data-testid={`lesson-step-${step.id}`}>
          <h3 className="text-base font-bold text-ink mb-2">{step.title}</h3>
          <p className="text-sm text-gray-700 leading-relaxed">{step.instructions}</p>

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
        <div className="ss-card p-4">
          <h3 className="text-base font-bold text-ink mb-2">Did it work? Let's find out!</h3>
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
            <div data-testid="lesson-complete" className="mt-3 bg-primary border-2 border-ink rounded-xl p-3 text-center">
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

      <div className="flex gap-2 mt-auto pb-1">
        <button
          data-testid="lesson-prev"
          onClick={() => goTo(stage - 1)}
          disabled={stage === 0}
          className="ss-btn ss-btn-ghost flex-1 px-3 py-2 text-sm"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <button
          data-testid="lesson-next"
          onClick={() => goTo(stage + 1)}
          disabled={stage === totalStages - 1}
          className="ss-btn ss-btn-primary flex-1 px-3 py-2 text-sm"
        >
          Next <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
