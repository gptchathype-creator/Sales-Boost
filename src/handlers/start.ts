import { Context } from 'telegraf';
import { getUserOrCreate, isAdmin } from '../utils';
import { prisma } from '../db';
import { Markup } from 'telegraf';

const MENU_HINT = 'Быстрые действия — в меню (иконка слева от поля ввода).';

function buildLandingText(fullName: string) {
  return (
    `Привет, ${fullName}!` +
    '\n\n' +
    '🚗 Sales Boost — тренажёр диалога с клиентом по продаже автомобилей.' +
    '\n\n' +
    'Он помогает:\n' +
    '• отрабатывать общение с требовательным клиентом;\n' +
    '• получать разбор ответов и рекомендации;\n' +
    '• видеть сильные стороны и точки роста в продажах.\n\n' +
    MENU_HINT +
    '\n\nВыберите, что хотите сделать:'
  );
}

/** Main menu: Start training, Settings, Admin — all vertical, one per row. */
export function mainMenuButtons(ctx: Context) {
  const rows: any[] = [
    [Markup.button.callback('🚀 Начать тренировку', 'start_training')],
    [Markup.button.callback('🔧 Настройки', 'settings')],
  ];
  if (isAdmin(ctx)) {
    rows.push([Markup.button.callback('🔐 Админ', 'admin_menu')]);
  }
  return Markup.inlineKeyboard(rows);
}

export async function showMainMenu(ctx: Context): Promise<void> {
  await ctx.reply(MENU_HINT);
}

const MAIN_MENU_SIMPLE = 'Главное меню';

/** Shows main menu. When edit=true and ctx has callbackQuery, edits the message. When simple=true, shows only "Главное меню" + 3 buttons. */
export async function showMainMenuContent(ctx: Context, options?: { edit?: boolean; simple?: boolean }): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const user = await prisma.user.findUnique({ where: { telegramId } });
  const hasUser = user && user.fullName !== `User ${telegramId}`;
  const text = options?.simple
    ? MAIN_MENU_SIMPLE
    : hasUser
      ? buildLandingText(user.fullName)
      : '👋 Добро пожаловать! Для начала работы укажите ваше полное имя. Отправьте /start';
  const keyboard = mainMenuButtons(ctx);

  const canEdit = options?.edit && ctx.callbackQuery?.message && 'message_id' in ctx.callbackQuery.message;
  if (canEdit) {
    const msg = ctx.callbackQuery!.message as { message_id: number };
    await ctx.telegram.editMessageText(ctx.chat!.id, msg.message_id, undefined, text, keyboard);
  } else {
    await ctx.reply(text, keyboard);
  }
}

export async function handleStart(ctx: Context) {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    return ctx.reply('Ошибка: не удалось определить ваш ID.');
  }

  let user = await prisma.user.findUnique({
    where: { telegramId },
  });

  if (!user) {
    await ctx.reply(
      '👋 Добро пожаловать! Для начала работы укажите ваше полное имя.'
    );
    return;
  }

  if (user.fullName === `User ${telegramId}`) {
    await ctx.reply(
      '👋 Добро пожаловать! Для начала работы укажите ваше полное имя.'
    );
    return;
  }

  await ctx.reply(buildLandingText(user.fullName), mainMenuButtons(ctx));
}

export async function handleNameInput(ctx: Context, name: string) {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    return ctx.reply('Ошибка: не удалось определить ваш ID.');
  }

  if (name.length < 2 || name.length > 100) {
    return ctx.reply('Имя должно быть от 2 до 100 символов. Попробуйте еще раз.');
  }

  const user = await getUserOrCreate(telegramId, name);
  
  // Check if user should be admin (by username or ID)
  const shouldBeAdmin = isAdmin(ctx);
  if (shouldBeAdmin && user.role !== 'admin') {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'admin' },
    });
  }
  
  if (user.fullName !== name) {
    await prisma.user.update({
      where: { id: user.id },
      data: { fullName: name },
    });
  }

  await ctx.reply(buildLandingText(name), mainMenuButtons(ctx));
}
