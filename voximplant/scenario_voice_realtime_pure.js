// Voximplant scenario: pure OpenAI Realtime, no backend (no dialog_url).
// Whole communication script is in the session instructions so the model plays
// the virtual customer (buyer) and follows the same logic as our training algorithm.
// Interruptions: Realtime session uses turn_detection with interrupt_response:true —
// when the user (manager) speaks, the current bot response is cancelled automatically.
// customData: { call_id, to, event_url, caller_id, openai_api_key [, instructions ] }

require(Modules.OpenAI);

var REALTIME_INSTRUCTIONS = [
  "=== РОЛЬ (КРИТИЧНО) ===",
  "Ты — ПОКУПАТЕЛЬ (клиент), который САМ ЗВОНИТ в автосалон по объявлению. На другом конце провода — МЕНЕДЖЕР по продажам. Ты его тестируешь: насколько хорошо он общается, даёт информацию, отвечает на вопросы.",
  "Ты НИКОГДА не менеджер. Запрещено говорить фразы менеджера: «Слушаю вас», «Для чего вам машина?», «Какой у вас бюджет?», «Понял, вам важно…» — это говорит менеджер клиенту. Ты — клиент: отвечаешь на вопросы менеджера о себе и задаёшь вопросы о машине, салоне, кредите, записи.",
  "",
  "=== ПЕРВОЕ СООБЩЕНИЕ ===",
  "В НАЧАЛЕ разговора твой первый осмысленный ход — фраза: «Здравствуйте! Я увидел объявление о Chery Arrizo 8 1.6 AMT 2023 года. Он ещё доступен?» Если менеджер первым сказал «Алло» или «Слушаю» — всё равно после короткого ответа-приветствия с твоей стороны произнеси эту фразу (ты позвонил, ты начинаешь). Не повторяй «Алло» — только приветствие и вопрос про машину.",
  "",
  "=== ЕСЛИ ТЕБЯ ПЕРЕБИЛИ (КРИТИЧНО) ===",
  "Когда менеджер тебя перебил (ты не договорил фразу), в истории уже есть твоя предыдущая реплика (полная или обрезанная). ЗАПРЕЩЕНО повторять её с начала или произносить ту же фразу заново. Действуй так: 1) Если перебили на приветствии — считай, что приветствие уже было; ответь коротко («Да, здравствуйте» / «Добрый день») и перейди к сути или дождись следующего вопроса. 2) Если перебили в середине любой другой фразы — не начинай её заново; ответь на то, что сказал менеджер, или продолжай мысль с того места, где остановились, одним коротким предложением. Никогда не копируй одну и ту же длинную реплику дважды. Никогда не «прыгай» на другую тему из-за перебивания — оставайся в контексте диалога.",
  "",
  "=== ФАЗЫ ДИАЛОГА (следуй по порядку) ===",
  "1) first_contact — ты позвонил по объявлению. Жди, что менеджер представится, назовёт салон и уточнит машину. Если не представился — не упрекай вслух, просто двигай разговор дальше.",
  "2) needs_discovery — РАССКАЖИ, для чего тебе машина (поездки на работу, семья, бюджет). Менеджер может спросить — отвечай. Не задавай ты «для чего вам машина» — это он спрашивает тебя.",
  "3) product_presentation — слушай презентацию авто. Задавай вопросы о характеристиках, важных для твоих потребностей. Если менеджер сказал что-то неверно о машине — вырази сомнение.",
  "4) money_and_objections — подними ОДНУ тему: кредит («А в кредит можно? Какие условия?»), или trade-in («А если сдам свою в счёт?»), или цену («Цена кусается, у конкурентов видел дешевле»), или конкурента («Почему именно эта? Видел [другую модель] по той же цене»). После ответа менеджера эту тему больше не поднимай.",
  "5) closing_attempt — покажи готовность двигаться вперёд, если менеджер предложит следующий шаг. Если предложит приехать/тест-драйв — согласись и попробуй зафиксировать дату/время. Если не предложит — подожди 1–2 реплики, потом скажи, что подумаешь.",
  "",
  "=== ТЕМЫ (не возвращайся к закрытой теме) ===",
  "Темы: представление, название салона, уточнение машины, потребности, презентация, кредит, trade-in, возражение, следующий шаг, запись, связь потом. Каждую тему поднимай один раз. Одно уточнение на тему — если ответ неполный. Дальше тему закрывай. Не задавай один и тот же вопрос дважды. Если менеджер дважды ушёл от ответа — заметь и переходи дальше.",
  "",
  "=== РЕАКЦИИ НА ПОВЕДЕНИЕ МЕНЕДЖЕРА ===",
  "- Грубость или токсичный тон: не благодари, не хвали. Коротко и твёрдо: «Простите, но мне не нравится такой тон» / «Это неуместно». При сильной грубости — один раз ответь и завершай разговор.",
  "- Низкие усилия («ок», «хз», одно слово): не говори «спасибо» или «понятно». Скажи: «Можете ответить конкретнее?» / «Мне нужен развёрнутый ответ». Если второй раз подряд — жёстче: «Я задаю конкретные вопросы. Мне нужны нормальные ответы.»",
  "- Уход от вопроса: скажи прямо: «Вы не ответили на мой вопрос» / «Я спрашивал о другом». Не повторяй один и тот же вопрос больше одного раза.",
  "- Отписка («посмотрите на сайте»): «Я звоню именно чтобы узнать от вас, а не с сайта.»",
  "- Нормальное поведение: отвечай естественно и двигай разговор вперёд. Будь реалистичным покупателем — не чрезмерно дружелюбным.",
  "",
  "=== ТАЙМИНГ И ТЕРПЕНИЕ (КРИТИЧНО) ===",
  "Ведёшь себя как живой человек: не спеши, дай менеджеру договорить. Если ты только что задал вопрос — подожди ответа. Не говори «вы не ответили на мой вопрос», если прошло мало времени или реплика менеджера была короткой (Алло, здравствуйте, чем могу помочь). «Вы не ответили» — только если ты явно задал конкретный вопрос и менеджер после паузы ушёл в сторону или отмахнулся. Если не расслышал — скажи: «Извините, не расслышал» или «Повторите, пожалуйста?»",
  "Если менеджер только поздоровался или сказал «Алло», «Слушаю», «Чем могу помочь?» — не придумывай, что он уже спросил про потребности или бюджет. Не выдавай длинный ответ (про работу, семью, бюджет). Ответь коротко: «Добрый день» или «Да, здравствуйте» и повтори вопрос про машину, если нужно, либо просто жди его следующей реплики. Диалог не должен «ломаться» из-за того, что кто-то первым сказал приветствие.",
  "=== ЖЁСТКИЕ ПРАВИЛА ===",
  "Не хвали плохой ответ. Не благодари за грубость или лень. Не повторяй один и тот же вопрос больше одного раза (одно уточнение допускается). Реплики короткие: 1–2 предложения при реакции на плохое поведение. Реакция по силе должна соответствовать проступку.",
  "",
  "=== ЗАВЕРШЕНИЕ ДИАЛОГА ===",
  "Завершай разговор (скажи прощание и дай понять, что разговор закончен), когда: 1) договорились о дате/времени визита или тест-драйва; 2) договорились о следующем контакте; 3) разговор естественно исчерпан (например, «Хорошо, подумаю. Спасибо, до свидания.»); 4) после грубости или неадеквата — коротко попрощайся и закончи. В конце говори чётко, что завершаешь разговор (например: «До свидания», «Пока», «Хорошо, тогда на этом закончим.»).",
  "",
  "=== ТЕХНИЧЕСКИЙ СИГНАЛ ДЛЯ ЗАВЕРШЕНИЯ ЗВОНКА ===",
  "После того как ты произнёс СВОЮ ПОСЛЕДНЮЮ фразу прощания и дал понять, что разговор закончен, ОБЯЗАТЕЛЬНО один раз вызови функцию end_call с кратким описанием причины (например, { \"reason\": \"visit_scheduled\" } или { \"reason\": \"will_think\" }). Не вызывай end_call раньше, чем закончил последнюю реплику, и не вызывай её дважды за один звонок.",
  "",
  "=== ЯЗЫК И СТИЛЬ ===",
  "Язык: только русский. Тон: реалистичный покупатель, не поддакивающий. Длина: 1–3 предложения на реплику (1–2 при реакции на плохое поведение). Без эмодзи, без мета-комментариев. Не выходи из роли.",
].join("\n");

function postEvent(eventUrl, payload) {
  if (!eventUrl) return;
  Net.httpRequest(
    eventUrl,
    function () {},
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      postData: JSON.stringify(payload),
    }
  );
}

VoxEngine.addEventListener(AppEvents.Started, function (e) {
  var raw = VoxEngine.customData();
  var data = {};
  try {
    if (typeof raw === "string") {
      data = JSON.parse(raw || "{}");
    } else if (raw && typeof raw === "object") {
      data = raw;
    }
  } catch (err) {
    Logger.write("voice_realtime_pure: Failed to parse customData: " + err);
  }

  var callId = data.call_id || ("call_" + Date.now());
  var to = data.to;
  var eventUrl = data.event_url;
  var callerId = data.caller_id || "";
  var openaiApiKey = data.openai_api_key || "";

  if (!to || !eventUrl) {
    Logger.write("voice_realtime_pure: Missing 'to' or 'event_url' in customData.");
    VoxEngine.terminate();
    return;
  }

  if (!openaiApiKey || openaiApiKey.length < 10) {
    Logger.write("voice_realtime_pure: Missing or invalid 'openai_api_key' in customData.");
    VoxEngine.terminate();
    return;
  }

  to = "+" + String(to).replace(/\D/g, "");
  callerId = callerId ? "+" + String(callerId).replace(/\D/g, "") : "";
  Logger.write("voice_realtime_pure: to=" + to + " call_id=" + callId);

  var call = VoxEngine.callPSTN(to, callerId || undefined);
  var realtimeClient = null;
  var sessionEnded = false;
  var callTranscript = []; // { role: "manager"|"client", text: "..." } for backend evaluation
  var END_CALL_DELAY_MS = 2000;
  var GOODBYE_PHRASES = ["до свидания", "на этом закончим", "пока", "всего хорошего", "завершаю разговор", "тогда закончим"];
  var hangupScheduled = false;
  function scheduleHangup(reason) {
    if (hangupScheduled) return;
    hangupScheduled = true;
    Logger.write("voice_realtime_pure: scheduling hangup, reason=" + (reason || "goodbye"));
    setTimeout(function () { finish({ reason: reason || "script_end" }); }, END_CALL_DELAY_MS);
  }
  function transcriptLooksLikeGoodbye(transcript) {
    if (!transcript || typeof transcript !== "string") return false;
    var t = transcript.toLowerCase().trim();
    for (var i = 0; i < GOODBYE_PHRASES.length; i++) {
      if (t.indexOf(GOODBYE_PHRASES[i]) !== -1) return true;
    }
    return false;
  }

  function finish(details) {
    if (sessionEnded) return;
    sessionEnded = true;
    try {
      if (realtimeClient) realtimeClient.close();
    } catch (e) {}
    try {
      if (call) call.hangup();
    } catch (e) {}
    var payload = {
      call_id: callId,
      to: to,
      event: "disconnected",
      ts: new Date().toISOString(),
      details: details || {},
    };
    if (callTranscript.length > 0) payload.transcript = callTranscript;
    postEvent(eventUrl, payload);
    VoxEngine.terminate();
  }

  postEvent(eventUrl, {
    call_id: callId,
    to: to,
    vox_call_id: call.id(),
    event: "progress",
    ts: new Date().toISOString(),
    details: { reason: "call_initiated" },
  });

  call.addEventListener(CallEvents.Connected, function (ev) {
    postEvent(eventUrl, {
      call_id: callId,
      to: to,
      vox_call_id: call.id(),
      event: "connected",
      ts: new Date().toISOString(),
      details: ev && ev.headers ? { headers: ev.headers } : {},
    });

    var instructions = (data.instructions && typeof data.instructions === "string" && data.instructions.length > 0)
      ? data.instructions
      : REALTIME_INSTRUCTIONS;

    var tools = [
      {
        type: "function",
        name: "end_call",
        description: "Технический сигнал о том, что сценарий разговора завершён и звонок можно вежливо завершать.",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Краткое текстовое описание причины завершения (например, visit_scheduled, will_think, rude_manager и т.п.).",
            },
          },
          required: [],
        },
      },
    ];

    OpenAI.createRealtimeAPIClient({
      apiKey: openaiApiKey,
      model: (data.model && data.model.length) ? data.model : "gpt-realtime",
      onWebSocketClose: function (event) {
        Logger.write("voice_realtime_pure: WebSocket closed");
        finish({ reason: "websocket_closed" });
      },
    })
      .then(function (client) {
        if (sessionEnded || !call) return;
        realtimeClient = client;

        try {
          realtimeClient.addEventListener(OpenAI.RealtimeAPIEvents.ConversationItemDone, function (ev) {
            if (sessionEnded || !realtimeClient) return;
            var payload = (ev && ev.payload) ? ev.payload : (ev && ev.data) ? ev.data : ev || {};
            var item = (payload && payload.item) ? payload.item : (ev && ev.item) ? ev.item : null;
            if (!item) return;
            if (item.type === "function_call" && item.name === "end_call") {
              var args = {};
              var rawArgs = (item.arguments != null && typeof item.arguments === "string") ? item.arguments.trim() : "";
              try {
                args = rawArgs ? JSON.parse(rawArgs) : {};
              } catch (e) {
                Logger.write("voice_realtime_pure: end_call args parse error: " + e);
              }
              var reason = (args && args.reason) ? String(args.reason) : "script_end";
              Logger.write("voice_realtime_pure: end_call requested, reason=" + reason);
              scheduleHangup(reason);
              return;
            }
            if (item.role === "assistant" && item.content && Array.isArray(item.content)) {
              for (var c = 0; c < item.content.length; c++) {
                var part = item.content[c];
                var transcript = (part && part.transcript != null) ? String(part.transcript) : "";
                if (transcriptLooksLikeGoodbye(transcript)) {
                  Logger.write("voice_realtime_pure: goodbye detected in transcript, scheduling hangup");
                  scheduleHangup("goodbye_transcript");
                  return;
                }
              }
            }
            // Collect transcript for backend evaluation (user = manager, assistant = client)
            if (item.role === "user" || item.role === "assistant") {
              var textParts = [];
              if (item.content && Array.isArray(item.content)) {
                for (var p = 0; p < item.content.length; p++) {
                  var pt = item.content[p];
                  if (pt && pt.transcript != null && String(pt.transcript).trim()) textParts.push(String(pt.transcript).trim());
                }
              }
              var fullText = textParts.join(" ").trim();
              if (fullText) {
                var backRole = item.role === "user" ? "manager" : "client";
                callTranscript.push({ role: backRole, text: fullText });
              }
            }
          });
        } catch (evErr) {
          Logger.write("voice_realtime_pure: addEventListener ConversationItemDone warning: " + evErr);
        }

        try {
          call.sendMediaTo(realtimeClient);
          realtimeClient.sendMediaTo(call);
        } catch (err) {
          Logger.write("voice_realtime_pure: sendMediaTo error: " + err);
          finish({ error: String(err) });
          return;
        }
        try {
          realtimeClient.sessionUpdate({
            session: {
              type: "realtime",
              instructions: instructions,
              audio: {
                input: {
                  turn_detection: {
                    type: "server_vad",
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500,
                  },
                },
              },
              tools: tools,
              tool_choice: "auto",
            },
          });
        } catch (suErr) {
          Logger.write("voice_realtime_pure: sessionUpdate warning: " + suErr);
        }
        try {
          realtimeClient.responseCreate({});
        } catch (rcErr) {
          Logger.write("voice_realtime_pure: responseCreate warning: " + rcErr);
        }
      })
      .catch(function (err) {
        Logger.write("voice_realtime_pure: createRealtimeAPIClient error: " + (err && err.message ? err.message : err));
        finish({ error: String(err && err.message ? err.message : err) });
      });
  });

  call.addEventListener(CallEvents.Failed, function (ev) {
    ev = ev || {};
    var cause = ev.code || ev.reason;
    var eventName = "failed";
    if (cause === 486) eventName = "busy";
    else if (cause === 480 || cause === 408) eventName = "no_answer";
    postEvent(eventUrl, {
      call_id: callId,
      to: to,
      event: eventName,
      ts: new Date().toISOString(),
      details: { code: ev.code, reason: ev.reason },
    });
    VoxEngine.terminate();
  });

  call.addEventListener(CallEvents.Disconnected, function (ev) {
    finish(ev ? { code: ev.code, reason: ev.reason } : {});
  });
});
