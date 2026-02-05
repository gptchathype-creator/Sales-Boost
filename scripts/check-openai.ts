/**
 * Проверка подключения к OpenAI API.
 * Запуск: npx tsx scripts/check-openai.ts
 * Покажет OK или причину ошибки (ключ, лимит, сеть).
 */
import 'dotenv/config';
import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey || apiKey.length < 20) {
  console.error('[OPENAI CHECK] OPENAI_API_KEY не задан или слишком короткий в .env');
  process.exit(1);
}

console.log('[OPENAI CHECK] Проверка API...');
const openai = new OpenAI({ apiKey });

openai.chat.completions
  .create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Say OK' }],
    max_tokens: 5,
  })
  .then((res) => {
    const text = res.choices[0]?.message?.content ?? '';
    console.log('[OPENAI CHECK] OK. Ответ:', text.trim() || '(пусто)');
  })
  .catch((err: unknown) => {
    const e = err as { status?: number; code?: string; message?: string; error?: { code?: string; message?: string } };
    const status = e?.status;
    const code = e?.code ?? (e?.error && typeof e.error === 'object' ? (e.error as { code?: string }).code : undefined);
    const msg = e?.message ?? (e?.error && typeof e.error === 'object' ? (e.error as { message?: string }).message : String(e));

    console.error('[OPENAI CHECK] Ошибка:');
    if (status) console.error('  HTTP status:', status);
    if (code) console.error('  Code:', code);
    console.error('  Message:', msg);

    if (status === 401 || code === 'invalid_api_key') {
      console.error('\n  Возможная причина: неверный или истёкший API ключ. Проверьте OPENAI_API_KEY в .env и https://platform.openai.com/api-keys');
    } else if (status === 429 || code === 'insufficient_quota' || (typeof msg === 'string' && msg.toLowerCase().includes('quota'))) {
      console.error('\n  Возможная причина: закончился баланс или лимит запросов. Пополните счёт: https://platform.openai.com/account/billing');
    } else if (status === 403) {
      console.error('\n  Возможная причина: доступ запрещён (нет прав на модель или закончился баланс).');
    } else if (!status && (msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('network'))) {
      console.error('\n  Возможная причина: нет доступа в интернет или блокировка.');
    }
    process.exit(1);
  });
