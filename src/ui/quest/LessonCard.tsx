import { useState } from 'react';
import type { LessonContent } from '../../engine/types';
import { CodeBlock } from './common';

const EXAMPLE_LABEL: Record<NonNullable<LessonContent['example']>['kind'], string> = {
  sql: 'SQL example',
  python: 'Python example',
  excel: 'Spreadsheet example',
  dax: 'DAX example',
  text: 'Example',
};

interface Props {
  lesson: LessonContent;
  /** True when the player has read this lesson before (e.g. on a replay). */
  seenBefore: boolean;
  action: string;
  onContinue: () => void;
}

/**
 * A reusable theory card. Content comes from quest data; the same design
 * serves SQL, Python, Excel, KPI and modelling lessons.
 */
export function LessonCard({ lesson, seenBefore, action, onContinue }: Props) {
  // Returning learners get a compact recap they can expand.
  const [expanded, setExpanded] = useState(!seenBefore);

  return (
    <section className={`lesson-card${expanded ? '' : ' lesson-card--compact'}`} aria-label={`Lesson: ${lesson.concept}`}>
      <header className="lesson-head">
        <p className="lesson-concept"><span aria-hidden="true">💡 </span>{lesson.concept}</p>
        <p className="lesson-objective"><strong>You’ll learn to:</strong> {lesson.objective}</p>
      </header>

      {seenBefore && (
        <p className="lesson-seen">
          You’ve read this lesson before.{' '}
          <button type="button" className="link-button" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'Show the short version' : 'Review the full lesson'}
          </button>
        </p>
      )}

      {expanded && (
        <>
          <div className="lesson-block lesson-block--plain">
            <h3>In plain English</h3>
            <p>{lesson.plainEnglish}</p>
          </div>
          <div className="lesson-block lesson-block--analogy">
            <h3><span aria-hidden="true">🧭 </span>Think of it like this</h3>
            <p>{lesson.analogy}</p>
          </div>
          {lesson.example && (
            <details className="lesson-block lesson-block--example" open>
              <summary>{EXAMPLE_LABEL[lesson.example.kind]}</summary>
              <CodeBlock code={lesson.example.code} />
              {lesson.example.caption && <p className="lesson-caption">{lesson.example.caption}</p>}
            </details>
          )}
          <details className="lesson-block" open>
            <summary>Why it matters</summary>
            <p>{lesson.whyItMatters}</p>
          </details>
          <details className="lesson-block lesson-block--mistake" open>
            <summary><span aria-hidden="true">⚠️ </span>Common mistake</summary>
            <p>{lesson.commonMistake}</p>
          </details>
          {lesson.simplification && (
            <p className="lesson-simplification"><strong>Keeping it simple:</strong> {lesson.simplification}</p>
          )}
        </>
      )}

      <div className="lesson-takeaway">
        <p className="lesson-takeaway-label">Takeaway</p>
        <p>{lesson.takeaway}</p>
      </div>

      <div className="actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={onContinue}>{action} <span aria-hidden="true">→</span></button>
      </div>
    </section>
  );
}
