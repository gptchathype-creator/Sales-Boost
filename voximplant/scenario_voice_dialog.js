// Voximplant scenario: голосовой диалог с нашим бэкендом (ASR → LLM → TTS).
// Если передан stream_url — используем WebSocket и получаем ответ чанками (быстрее первый TTS).
// Иначе: POST на dialog_url, один ответ.
// customData: { call_id, to, event_url, caller_id, tag, dialog_url [, stream_url ] }

require(Modules.ASR);
require(Modules.WebSocket);

function postEvent(eventUrl, payload) {
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

function postDialog(dialogUrl, body, callback) {
  Net.httpRequest(
    dialogUrl,
    function (result) {
      var replyText = "";
      var endSession = false;
      var code = result && (result.code != null ? result.code : result.status);
      var raw = (result && result.text) ? String(result.text) : "";
      if (code === 200 && raw && raw.length > 0) {
        var trimmed = raw.trim();
        if (trimmed.charAt(0) === "{") {
          try {
            var data = JSON.parse(raw);
            replyText = (data.reply_text != null) ? String(data.reply_text) : "";
            endSession = data.end_session === true;
          } catch (e) {
            Logger.write("postDialog parse error: " + e);
          }
        } else {
          Logger.write("postDialog non-JSON response (code=200) len=" + raw.length + " start=" + trimmed.substring(0, 40));
        }
      } else {
        Logger.write("postDialog non-200 or empty: code=" + code + " len=" + (raw ? raw.length : 0));
      }
      if (typeof callback === "function") {
        callback(replyText, endSession);
      }
    },
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      postData: JSON.stringify(body),
      timeout: 60,
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
    Logger.write("Failed to parse customData: " + err);
  }

  var voxSessionId = (e && (e.sessionId != null)) ? e.sessionId : null;
  var callId = data.call_id || ("call_" + Date.now());
  var to = data.to;
  var eventUrl = data.event_url;
  var dialogUrl = data.dialog_url;
  var streamUrl = data.stream_url || null;
  var callerId = data.caller_id || "";
  var tag = data.tag || null;

  if (!to || !eventUrl) {
    Logger.write("Missing 'to' or 'event_url' in customData.");
    VoxEngine.terminate();
    return;
  }

  if (!dialogUrl) {
    Logger.write("Missing 'dialog_url' in customData. Set VOICE_DIALOG_BASE_URL and use dialog: true when starting the call.");
    VoxEngine.terminate();
    return;
  }
  var useStream = !!streamUrl;
  if (useStream) Logger.write("voice_dialog: using stream_url (chunked reply)");

  to = "+" + String(to).replace(/\D/g, "");
  callerId = callerId ? "+" + String(callerId).replace(/\D/g, "") : "";

  Logger.write("voice_dialog: to=" + to + " dialog_url=" + dialogUrl);

  var call;
  var asr;
  var sessionEnded = false;
  var asrTurnBusy = false; // only one ASR result per turn

  function send(evtName, extra) {
    var payload = {
      call_id: callId,
      to: to,
      vox_call_id: call ? call.id() : null,
      event: evtName,
      ts: new Date().toISOString(),
      details: extra || {},
    };
    if (voxSessionId != null) payload.vox_session_id = voxSessionId;
    if (tag) {
      payload.details.tag = tag;
    }
    postEvent(eventUrl, payload);
  }

  function sayAndThen(text, next) {
    if (!call || sessionEnded) return;
    if (!text || text.length === 0) {
      if (typeof next === "function") next();
      return;
    }
    try {
      call.say(text, { voice: VoiceList.TBank.ru_RU_Anna });
    } catch (err) {
      Logger.write("TTS say error: " + err);
    }
    if (typeof next === "function") {
      setTimeout(next, Math.max(700, Math.min(8000, text.length * 40)));
    }
  }

  var chunkQueue = [];
  var chunkPlaying = false;
  function playChunkQueue(finalCallback) {
    if (chunkPlaying || chunkQueue.length === 0) {
      if (chunkQueue.length === 0 && typeof finalCallback === "function") finalCallback();
      return;
    }
    var item = chunkQueue.shift();
    if (item === null) {
      chunkPlaying = false;
      if (typeof finalCallback === "function") finalCallback();
      return;
    }
    chunkPlaying = true;
    try {
      call.say(item, { voice: VoiceList.TBank.ru_RU_Anna });
    } catch (err) {
      Logger.write("TTS chunk error: " + err);
    }
    setTimeout(function () {
      chunkPlaying = false;
      playChunkQueue(finalCallback);
    }, Math.max(800, Math.min(6000, (item || "").length * 35)));
  }

  function startASR() {
    if (!call || sessionEnded) return;
    try {
      if (asr) {
        try {
          asr.stop();
        } catch (e) {}
        asr = null;
      }
      asr = VoxEngine.createASR({
        profile: ASRProfileList.TBank.ru_RU,
        singleUtterance: true,
      });
      asr.addEventListener(ASREvents.Result, function (ev) {
        if (sessionEnded) return;
        if (asrTurnBusy) return;
        var text = (ev && (ev.text != null ? ev.text : ev.transcript)) ? String(ev.text || ev.transcript).trim() : "";
        if (!text) return;
        asrTurnBusy = true;
        try {
          if (asr) asr.stop();
        } catch (e) {}
        asr = null;
        Logger.write("ASR result: " + text);
        if (useStream && ws && ws.readyState === 1) {
          chunkQueue = [];
          ws.send(JSON.stringify({ call_id: callId, text: text }));
          return;
        }
        postDialog(dialogUrl, { call_id: callId, text: text, is_final: true }, function (replyText, endSession) {
          if (sessionEnded) return;
          sayAndThen(replyText, function () {
            if (sessionEnded) return;
            onStreamReplyEnd(endSession);
          });
        });
      });
      asr.addEventListener(ASREvents.ASRError, function (ev) {
        Logger.write("ASR error: " + (ev && ev.error ? ev.error : "unknown"));
      });
      call.sendMediaTo(asr);
    } catch (err) {
      Logger.write("createASR/sendMediaTo error: " + err);
    }
  }

  var ws = null;
  function onStreamReplyEnd(endSession) {
    if (sessionEnded) return;
    asrTurnBusy = false;
    if (endSession) {
      sessionEnded = true;
      try {
        if (asr) asr.stop();
      } catch (e) {}
      try {
        if (call) call.hangup();
      } catch (e) {}
      send("disconnected", { reason: "end_session" });
      VoxEngine.terminate();
    } else {
      startASR();
    }
  }

  call = VoxEngine.callPSTN(to, callerId || undefined);
  send("progress", { reason: "call_initiated" });

  call.addEventListener(CallEvents.Connected, function (ev) {
    ev = ev || {};
    send("connected", { headers: ev.headers || {} });

    if (useStream && streamUrl) {
      chunkQueue = [];
      var streamFallbackTimer = null;
      // First phrase via POST (reliable); WebSocket first frame often dropped by proxies (Railway etc.)
      postDialog(dialogUrl, { call_id: callId }, function (firstReplyText, firstEndSession) {
        if (sessionEnded) return;
        sayAndThen(firstReplyText, function () {
          if (sessionEnded) return;
          onStreamReplyEnd(firstEndSession);
        });
      });
      try {
        ws = VoxEngine.createWebSocket(streamUrl);
        ws.onopen = function (ev) {
          Logger.write("voice stream: WebSocket open, first phrase already via POST");
        };
        ws.onmessage = function (e) {
          if (streamFallbackTimer) {
            clearTimeout(streamFallbackTimer);
            streamFallbackTimer = null;
          }
          if (sessionEnded) return;
          var raw = (e && e.text != null) ? String(e.text) : ((e && e.data != null) ? (typeof e.data === "string" ? e.data : String(e.data)) : "");
          if (!raw) return;
          var data = {};
          try {
            data = JSON.parse(raw);
          } catch (err) {
            Logger.write("stream parse error: " + err);
            return;
          }
          if (data.error && data.done === true) {
            Logger.write("voice stream error from backend, fallback to POST: " + (data.error || ""));
            postDialog(dialogUrl, { call_id: callId }, function (replyText, endSession) {
              if (sessionEnded) return;
              sayAndThen(replyText, function () {
                if (sessionEnded) return;
                onStreamReplyEnd(endSession);
              });
            });
            return;
          }
          if (data.chunk) chunkQueue.push(data.chunk);
          if (data.done === true) {
            var endSession = data.end_session === true;
            chunkQueue.push(null);
            playChunkQueue(function () {
              onStreamReplyEnd(endSession);
            });
          }
        };
        ws.onclose = function () {
          if (streamFallbackTimer) {
            clearTimeout(streamFallbackTimer);
            streamFallbackTimer = null;
          }
          Logger.write("voice stream WebSocket closed");
        };
        ws.onerror = function (e) {
          if (streamFallbackTimer) {
            clearTimeout(streamFallbackTimer);
            streamFallbackTimer = null;
          }
          Logger.write("voice stream WebSocket error: " + (e && e.error ? e.error : "unknown"));
          postDialog(dialogUrl, { call_id: callId }, function (replyText, endSession) {
            if (sessionEnded) return;
            sayAndThen(replyText, function () {
              onStreamReplyEnd(endSession);
            });
          });
        };
      } catch (err) {
        Logger.write("createWebSocket error: " + err);
        useStream = false;
        postDialog(dialogUrl, { call_id: callId }, function (replyText, endSession) {
          if (sessionEnded) return;
          sayAndThen(replyText, function () {
            onStreamReplyEnd(endSession);
          });
        });
      }
      return;
    }

    postDialog(dialogUrl, { call_id: callId }, function (replyText, endSession) {
      if (sessionEnded) return;
      sayAndThen(replyText, function () {
        if (sessionEnded) return;
        onStreamReplyEnd(endSession);
      });
    });
  });

  call.addEventListener(CallEvents.Failed, function (ev) {
    ev = ev || {};
    var cause = ev.code || ev.reason;
    var eventName = "failed";
    if (cause === 486) eventName = "busy";
    else if (cause === 480 || cause === 408) eventName = "no_answer";
    send(eventName, { code: ev.code, reason: ev.reason });
    VoxEngine.terminate();
  });

  call.addEventListener(CallEvents.Disconnected, function (ev) {
    sessionEnded = true;
    ev = ev || {};
    try {
      if (asr) asr.stop();
    } catch (e) {}
    send("disconnected", { code: ev.code, reason: ev.reason });
    VoxEngine.terminate();
  });
});
