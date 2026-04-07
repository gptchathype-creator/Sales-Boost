/**
 * Один раз прогоняет три демо-стенограммы через evaluateSessionV2 + generateCallSummary + generateReplyImprovements
 * и пишет JSON в admin-frontend/src/data/demo-example-reports/*.json для страницы /demo-call (без вызова API при клике).
 *
 * Запуск из корня репозитория (нужен OPENAI_API_KEY в .env):
 *   npx tsx scripts/generate-demo-example-reports.ts
 */
import 'dotenv/config';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { evaluateDemoExampleFromTranscript } from '../src/voice/demoExampleEvaluation';

const ROOT = process.cwd();
const TRANSCRIPTS_PATH = path.join(ROOT, 'admin-frontend/src/data/demo-example-transcripts.json');
const OUT_DIR = path.join(ROOT, 'admin-frontend/src/data/demo-example-reports');

type Tier = 'weak' | 'medium' | 'strong';

async function main() {
  if (!existsSync(TRANSCRIPTS_PATH)) {
    throw new Error(`Запускайте из корня репозитория. Не найден: ${TRANSCRIPTS_PATH}`);
  }
  const transcriptsJson = JSON.parse(readFileSync(TRANSCRIPTS_PATH, 'utf8')) as Record<
    string,
    { role: string; text: string }[]
  >;
  mkdirSync(OUT_DIR, { recursive: true });
  const keys: Tier[] = ['weak', 'medium', 'strong'];
  for (const tier of keys) {
    const transcript = transcriptsJson[tier];
    if (!Array.isArray(transcript)) {
      throw new Error(`Missing transcript for ${tier}`);
    }
    console.log(`[demo-reports] Evaluating ${tier} (${transcript.length} turns)...`);
    const result = await evaluateDemoExampleFromTranscript(transcript);
    const outPath = path.join(OUT_DIR, `${tier}.json`);
    writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
    console.log(`[demo-reports] Wrote ${outPath} (score ${result.totalScore})`);
  }
  console.log('[demo-reports] Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
