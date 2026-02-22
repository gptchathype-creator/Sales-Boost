// Voximplant smoke-test scenario for outbound PSTN calls.
// Paste this script into a Voximplant scenario named exactly as VOX_SCENARIO_NAME.
// It expects script_custom_data (JSON string) with:
// { call_id, to, event_url, caller_id, tag }

function postEvent(eventUrl, payload) {
  Net.httpRequest(
    eventUrl,
    function () {},
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
}

VoxEngine.addEventListener(AppEvents.Started, function (e) {
  // Management API (StartScenarios) delivers custom data asynchronously.
  // The most reliable way is to read it via VoxEngine.customData().
  var raw = VoxEngine.customData();
  var data = {};
  try {
    if (typeof raw === "string") {
      data = JSON.parse(raw || "{}");
    } else if (raw && typeof raw === "object") {
      data = raw;
    }
  } catch (err) {
    Logger.write("Failed to parse customData: " + err);
  }

  var callId = data.call_id || ("call_" + Date.now());
  var to = data.to;
  var eventUrl = data.event_url;
  var callerId = data.caller_id || "";
  var tag = data.tag || null;

  if (!to || !eventUrl) {
    Logger.write(
      "Missing 'to' or 'event_url' in customData, got: " + JSON.stringify(data)
    );
    VoxEngine.terminate();
    return;
  }

  // Normalize to E.164: digits only, then ensure + prefix
  to = "+" + String(to).replace(/\D/g, "");
  callerId = callerId ? "+" + String(callerId).replace(/\D/g, "") : "";

  Logger.write("callPSTN to=" + to + " callerId=" + (callerId || "(empty)"));

  var now = new Date().toISOString();
  var call;

  function send(evtName, extra) {
    var payload = {
      call_id: callId,
      to: to,
      vox_call_id: call ? call.id() : null,
      event: evtName,
      ts: new Date().toISOString(),
      details: extra || {},
    };
    if (tag) {
      payload.details = payload.details || {};
      payload.details.tag = tag;
    }
    postEvent(eventUrl, payload);
  }

  call = VoxEngine.callPSTN(to, callerId || undefined);

  send("progress", { reason: "call_initiated" });

  call.addEventListener(CallEvents.Connected, function (ev) {
    ev = ev || {};
    send("connected", { headers: ev.headers || {} });

    // Русский TTS: голос с поддержкой RU. Если TBank не подключён — замени на VoiceList.YandexV3.ru_RU_alena
    try {
      call.say("Это тестовый звонок. Проверка связи. Трубку положу через несколько секунд.", {
        voice: VoiceList.TBank.ru_RU_Anna,
      });
    } catch (err) {
      Logger.write("TTS failed: " + err);
    }

    // Безусловный отбой через 10 сек (TTS ~6 сек + запас). Не проверяем state — hangup() вызываем всегда.
    setTimeout(function () {
      if (call) {
        try {
          call.hangup();
        } catch (e) {
          Logger.write("hangup: " + e);
        }
      }
    }, 10000);
  });

  call.addEventListener(CallEvents.Failed, function (ev) {
    ev = ev || {};
    var cause = ev.code || ev.reason;
    var eventName = "failed";
    if (cause === 486) {
      eventName = "busy";
    } else if (cause === 480 || cause === 408) {
      eventName = "no_answer";
    }
    send(eventName, { code: ev.code, reason: ev.reason });
    VoxEngine.terminate();
  });

  call.addEventListener(CallEvents.Disconnected, function (ev) {
    ev = ev || {};
    send("disconnected", { code: ev.code, reason: ev.reason });
    VoxEngine.terminate();
  });

  // ProgressToneStart and Ringing listeners removed: VoxEngine 7.25 dispatches
  // them with undefined event object, causing "event is undefined" crash.
  // We still get progress from send("progress", { reason: "call_initiated" }) above.
});
