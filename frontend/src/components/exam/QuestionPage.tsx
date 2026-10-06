import { QuestionArea } from './QuestionArea';
import { RichContent } from '../common/RichContent';
import type { StudentAnswers, StudentAnswer, StudentQuestion } from '../../types/student-exam';
import { questionDisplayNumbers } from './question-pages';

export function QuestionPage({ questions, allQuestions, answers, marked = [], onAnswerChange, onToggleMark }: { questions: StudentQuestion[]; allQuestions: StudentQuestion[]; answers: StudentAnswers; marked?: number[]; onAnswerChange: (id: number, answer: StudentAnswer) => void; onToggleMark: (id: number) => void }) {
  const displayNumbers = questionDisplayNumbers(allQuestions);
  return <div className="space-y-6">{questions.map((question, index) => {
    const block = question.layout?.block;
    const first = block && (index === 0 || questions[index - 1].layout?.block?.block_id !== block.block_id);
    const questionIndex = allQuestions.findIndex(q => q.id === question.id);
    const displayNumber = displayNumbers[questionIndex]?.label ?? String(questionIndex + 1);
    const groupNumber = displayNumbers[questionIndex]?.groupNumber;
    return <section key={question.id} aria-label={`Question ${displayNumber}`}>
      {first && <div className="mx-auto mb-4 w-full min-w-0 max-w-7xl rounded-lg border border-teal-200 bg-white p-5"><h2 className="font-semibold">{block.kind === 'parent' ? 'Passage / parent stimulus' : 'Question group'}{groupNumber ? ` ${groupNumber}` : ''}: {block.title}{question.layout?.continuation ? ' (continued)' : ''}</h2><RichContent content={block} attemptId={question.attemptId} /></div>}
      <QuestionArea hideNavigation question={question} currentQuestion={questionIndex} displayNumber={displayNumber} totalQuestions={allQuestions.length} answer={answers[question.id]} onAnswerChange={onAnswerChange} onPrevious={() => {}} onNext={() => {}} sequentialNavigation={false} currentAnswerIsValid isSavingNext={false} isMarked={marked.includes(question.id)} onToggleMark={() => onToggleMark(question.id)} />
    </section>;
  })}</div>;
}
