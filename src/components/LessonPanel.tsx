/**
 * Minimal lesson panel (implemenation_plam/lessons.md): pick a lesson, follow
 * short steps, and press "Check my work" — checks run against the project
 * state and a headless simulation, never the generated text.
 */
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

export default function LessonPanel({
  lessons,
  activeLessonId,
  checkResults,
  checking,
  onSelectLesson,
  onCheckWork,
  onClose,
}: LessonPanelProps) {
  const active = lessons.find((lesson) => lesson.id === activeLessonId) ?? null;

  return (
    <div data-testid="lesson-panel" className="h-full flex flex-col bg-white">
      <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
        <span className="text-sm font-semibold text-gray-700">
          {active ? active.title : 'Lessons'}
        </span>
        <div className="flex items-center gap-2">
          {active && (
            <button
              data-testid="lesson-back"
              onClick={() => onSelectLesson(null)}
              className="text-xs text-gray-500 hover:text-gray-800"
            >
              ← all lessons
            </button>
          )}
          <button
            data-testid="lesson-close"
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 text-sm font-bold px-1"
            title="Close lessons"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        {!active && (
          <ul className="space-y-2">
            {lessons.map((lesson, index) => (
              <li key={lesson.id}>
                <button
                  data-testid={`lesson-item-${lesson.id}`}
                  onClick={() => onSelectLesson(lesson.id)}
                  className="w-full text-left border border-gray-200 rounded-lg p-3 hover:border-primary hover:bg-gray-50"
                >
                  <span className="text-sm font-semibold text-gray-800">
                    {index + 1}. {lesson.title}
                  </span>
                  <span className="block text-xs text-gray-500 mt-1">
                    ~{lesson.estimatedMinutes} min
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {active && (
          <div className="space-y-4">
            <ol className="space-y-3">
              {active.steps.map((step, index) => (
                <li key={step.id} className="text-sm">
                  <span className="font-semibold text-gray-800">
                    {index + 1}. {step.title}
                  </span>
                  <p className="text-gray-600 mt-0.5">{step.instructions}</p>
                  {step.hints.map((hint, hintIndex) => (
                    <p key={hintIndex} className="text-xs text-gray-400 mt-1">
                      💡 {hint}
                    </p>
                  ))}
                </li>
              ))}
            </ol>

            <div className="border-t border-gray-100 pt-3">
              <button
                data-testid="check-work"
                onClick={onCheckWork}
                disabled={checking}
                className="w-full px-3 py-2 bg-accent text-white rounded-md font-semibold text-sm hover:bg-[#00654c] disabled:opacity-50"
              >
                {checking ? 'Checking…' : 'Check my work'}
              </button>
              <ul className="mt-3 space-y-1.5">
                {active.checks.map((checkDef) => {
                  const result = checkResults[checkDef.id];
                  const state = result === undefined ? 'pending' : result ? 'passed' : 'failed';
                  return (
                    <li
                      key={checkDef.id}
                      data-testid={`check-${checkDef.id}`}
                      data-passed={state === 'passed' ? 'true' : 'false'}
                      className={`text-xs flex items-start gap-1.5 ${
                        state === 'passed' ? 'text-green-700' : state === 'failed' ? 'text-red-600' : 'text-gray-500'
                      }`}
                    >
                      <span>{state === 'passed' ? '✅' : state === 'failed' ? '❌' : '⬜'}</span>
                      <span>{checkDef.description}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
