export interface AnswerKey {
  answer_text: string;
  is_case_sensitive: boolean;
}

export interface EvaluateSubmissionInput {
  submittedAnswer: string;
  answers: readonly AnswerKey[];
  alreadySolved: boolean;
  basePoints: number;
}

export interface EvaluateSubmissionResult {
  isCorrect: boolean;
  earnedPoints: number;
  alreadySolved: boolean;
}

export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function evaluateSubmission(input: EvaluateSubmissionInput): EvaluateSubmissionResult {
  const normalizedInput = normalizeWhitespace(input.submittedAnswer);

  const isCorrect =
    normalizedInput.length > 0 &&
    input.answers.some((answer) => {
      const normalizedAnswer = normalizeWhitespace(answer.answer_text);
      if (normalizedAnswer.length === 0) {
        return false;
      }
      if (answer.is_case_sensitive) {
        return normalizedInput === normalizedAnswer;
      }
      return normalizedInput.toLowerCase() === normalizedAnswer.toLowerCase();
    });

  const earnedPoints = isCorrect && !input.alreadySolved ? input.basePoints : 0;

  return {
    isCorrect,
    earnedPoints,
    alreadySolved: input.alreadySolved,
  };
}
