export interface QualitySignal {
  very_short: boolean;
  nonsense: boolean;
  profanity: boolean;
  filler_count: number;
  anglicism_count: number;
}

const NONSENSE_TOKENS = [
  'хз',
  'не знаю',
  'незнаю',
  'норм',
  'ок',
  'ладно',
  'лол',
  'ща',
  'ясно',
  'тачка топ',
];

// Минимальный список, не логируем конкретные слова в текстах для отчётов
const PROFANITY_TOKENS = ['хер', 'хрень', 'бл*', 'бля', 'сука', 'нахер', 'нахуй', 'пизд'];

const FILLER_WORDS = ['ну', 'типа', 'короче', 'в общем', 'вообще-то', 'значит', 'как бы'];

const ANGLICISMS = ['окей', 'бро', 'вайб', 'кринж', 'чилл', 'вайбовый', 'хайп'];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function countOccurrences(text: string, tokens: string[]): number {
  let count = 0;
  for (const token of tokens) {
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = text.match(re);
    if (matches) count += matches.length;
  }
  return count;
}

export function computeQualitySignal(message: string): QualitySignal {
  const norm = normalize(message);
  const words = norm.length ? norm.split(' ') : [];

  const very_short = norm.length <= 12 || words.length <= 2;

  const nonsense = NONSENSE_TOKENS.some((tok) => norm.includes(tok));

  const profanity = PROFANITY_TOKENS.some((tok) => norm.includes(tok));

  const filler_count = countOccurrences(norm, FILLER_WORDS);
  const anglicism_count = countOccurrences(norm, ANGLICISMS);

  return {
    very_short,
    nonsense,
    profanity,
    filler_count,
    anglicism_count,
  };
}

