import { evaluateSubmission, normalizeWhitespace } from './scoring';

describe('normalizeWhitespace', () => {
  it('membuang spasi awal/akhir', () => {
    expect(normalizeWhitespace('  filter  ')).toBe('filter');
  });

  it('merapikan spasi ganda di tengah menjadi satu spasi', () => {
    expect(normalizeWhitespace('a   b\t\tc')).toBe('a b c');
  });
});

describe('evaluateSubmission', () => {
  const answers = [
    { answer_text: 'filter', is_case_sensitive: true },
    { answer_text: 'await', is_case_sensitive: false },
  ];

  it('benar saat kunci case-sensitive cocok persis', () => {
    const result = evaluateSubmission({
      submittedAnswer: 'filter',
      answers,
      alreadySolved: false,
      basePoints: 10,
    });
    expect(result).toEqual({ isCorrect: true, earnedPoints: 10, alreadySolved: false });
  });

  it('salah saat case-sensitive tidak cocok huruf besarnya', () => {
    const result = evaluateSubmission({
      submittedAnswer: 'FILTER',
      answers,
      alreadySolved: false,
      basePoints: 10,
    });
    expect(result.isCorrect).toBe(false);
    expect(result.earnedPoints).toBe(0);
  });

  it('benar saat case-insensitive abaikan huruf besar/kecil', () => {
    const result = evaluateSubmission({
      submittedAnswer: 'AWAIT',
      answers,
      alreadySolved: false,
      basePoints: 30,
    });
    expect(result.isCorrect).toBe(true);
    expect(result.earnedPoints).toBe(30);
  });

  it('normalisasi spasi sebelum dibandingkan', () => {
    const result = evaluateSubmission({
      submittedAnswer: '  filter  ',
      answers,
      alreadySolved: false,
      basePoints: 10,
    });
    expect(result.isCorrect).toBe(true);
  });

  it('jawaban kosong tidak pernah benar', () => {
    const result = evaluateSubmission({
      submittedAnswer: '   ',
      answers,
      alreadySolved: false,
      basePoints: 10,
    });
    expect(result.isCorrect).toBe(false);
    expect(result.earnedPoints).toBe(0);
  });

  it('anti poin ganda: sudah pernah benar → earnedPoints 0', () => {
    const result = evaluateSubmission({
      submittedAnswer: 'filter',
      answers,
      alreadySolved: true,
      basePoints: 10,
    });
    expect(result.isCorrect).toBe(true);
    expect(result.earnedPoints).toBe(0);
    expect(result.alreadySolved).toBe(true);
  });

  it('jawaban salah → earnedPoints 0', () => {
    const result = evaluateSubmission({
      submittedAnswer: 'reduce',
      answers,
      alreadySolved: false,
      basePoints: 10,
    });
    expect(result.isCorrect).toBe(false);
    expect(result.earnedPoints).toBe(0);
  });

  it('tanpa kunci jawaban → salah', () => {
    const result = evaluateSubmission({
      submittedAnswer: 'filter',
      answers: [],
      alreadySolved: false,
      basePoints: 10,
    });
    expect(result.isCorrect).toBe(false);
  });
});
