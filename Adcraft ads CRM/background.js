function n(e, t, o) {
  chrome.tabs.query({ url: e }, function(s) {
    s.length > 0 && s.forEach((a) => {
      chrome.tabs.sendMessage(a.id, { action: t, dados: o });
    });
  });
}
async function h(e) {
  return new Promise((t, o) => {
    chrome.storage.local.get([e], function(s) {
      s[e] === void 0 ? o() : t(s[e]);
    });
  });
}
function d(e) {
  const t = new Date(e), o = /* @__PURE__ */ new Date(), s = t.getTime() - o.getTime();
  return s <= 12e4 || s < 0;
}
async function f() {
  const e = await h("notifications"), t = [], o = [];
  let s = 0;
  for (let a of e)
    !a.timeOut && d(`${a.date}T${a.time}`) && (a.timeOut = !0, o.push(a)), a.timeOut && !a.read && s++, t.push(a);
  n("https://web.whatsapp.com/*", "Update_Notificação", { update: t, dispart: o, tam: s });
}
const w = {
  // Nome Da WL Ativa
  name: "AdCraft adss Hub WA CRM",
  // Versão de build
  version: "8.7.8",
  // Chave de criptografia
  cript_key: "ffce211a-7b07-4d91-ba5d-c40bb4034a83",
  //Url do backend Principal
  backend: "https://wpcrm.adcraftads.com/",
  // Url do backend de funções auxiliares
  backend_utils: "https://backend-utils.wascript.com.br/",
  // WebSockets
  webSocket: {
    "multi-atendimento": "https://multi-atendimento.wascript.com.br",
    "api-whatsapp": "https://api-whatsapp.wascript.com.br"
  },
  // Url do painel de gestão
  painel_Gestor: "https://wa.link/zaogqj",
  // Url do audio transcriber
  audio_transcriber: "https://audio-transcriber.wascript.com.br/transcription",
  // Selector de elementos DOM
  domSelector: "https://wpcrm.adcraftads.com/update.php",
  // Limite de mídia no Resposta Rápida
  midiaLimit: 50
};
async function b() {
  try {
    const t = await (await fetch(w.domSelector)).json();
    typeof t == "object" && typeof t.version == "string" && n("https://web.whatsapp.com/*", "Update_DomSelector", { version: t.version });
  } catch (e) {
    console.error("Error ao tentar Capturar o Dom Selector virtual", e);
  }
}
function c() {
  chrome.alarms.get("One_Minute", (e) => {
    e || chrome.alarms.create("One_Minute", { periodInMinutes: 1 });
  }), chrome.alarms.get("Five_Minutes", (e) => {
    e || chrome.alarms.create("Five_Minutes", { periodInMinutes: 5 });
  }), chrome.alarms.get("Ten_Minutes", (e) => {
    e || chrome.alarms.create("Ten_Minutes", { periodInMinutes: 10 });
  }), chrome.alarms.get("Thirty_Minutes", (e) => {
    e || chrome.alarms.create("Thirty_Minutes", { periodInMinutes: 30 });
  });
}
chrome.alarms.onAlarm.addListener((e) => {
  switch (e.name) {
    // 1 Minuto
    case "One_Minute":
      n("https://web.whatsapp.com/*", "Update_Agendamento", {}), n("https://web.whatsapp.com/*", "Update_Status", {}), n("https://web.whatsapp.com/*", "Update_BackupAutomatico", {}), n("https://web.whatsapp.com/*", "Update_MeetAoVivo", {}), f();
      break;
    // 5 Minutos
    case "Five_Minutes":
      n("https://web.whatsapp.com/*", "license_update", {}), n("https://web.whatsapp.com/*", "dispatch_timing_follow", {});
      break;
    // 10 Minutos
    case "Ten_Minutes":
      b();
      break;
    // 30 Minutos
    case "Thirty_Minutes":
      n("https://web.whatsapp.com/*", "Remote-Notificacao", {});
      break;
    // Alarme de manter o sistema ativo
    case "keepAwake":
      chrome.runtime.getPlatformInfo();
      break;
  }
});
const g = () => {
  const e = /* @__PURE__ */ new Date();
  e.setDate(e.getDate() + 1);
  const t = e.getFullYear(), o = String(e.getMonth() + 1).padStart(2, "0"), s = String(e.getDate()).padStart(2, "0");
  return `${t}-${o}-${s}`;
}, M = {
  date: g(),
  items: [
    "respostasRapidas",
    "respostasRapidasAcao",
    "categoria",
    "agendamentos",
    "agendamentosNaoDisparados",
    "sendAfterWhatsAppOpens",
    "crm",
    "contatos",
    "notes",
    "notifications",
    "perfil",
    "userTabs",
    "agrupamentos",
    "relatorio",
    "encomendas",
    "autoatendimento",
    "webhook",
    "IA",
    "status",
    "pinChat",
    "atendimento",
    "backupAutomatico",
    "whatsApi",
    "FollowUp",
    "fluxo"
  ],
  recurrency: "diario",
  time: "10:30"
};
async function A() {
  chrome.storage.local.get(null, (e) => {
    chrome.storage.local.set({
      agendamentos: e.agendamentos || [],
      agendamentosNaoDisparados: e.agendamentosNaoDisparados || [],
      sendAfterWhatsAppOpens: e.sendAfterWhatsAppOpens || !1,
      notifications: e.notifications || [],
      userTabs: e.userTabs || [],
      contatos: e.contatos || [],
      notes: e.notes || [],
      agendaMsg: e.agendaMsg || [],
      perfil: e.perfil || [],
      categoria: e.categoria || [],
      initSystem: e.initSystem || !1,
      backupAutomatico: e.backupAutomatico || M,
      crm: e.crm || [],
      fluxo: e.fluxo || { workflows: [], currentWorkflow: null },
      fluxoFiles: e.fluxoFiles || [],
      agrupamentos: e.agrupamentos || [],
      relatorio: e.relatorio || [],
      encomendas: e.encomendas || [],
      autoatendimento: e.autoatendimento || [],
      FollowUp: e.FollowUp || [],
      webhook: e.webhook || [],
      IA: e.IA || { activeIA: null, keyGemini: "", keyGPT: "" },
      status: e.status || [],
      pinChat: e.pinChat || [],
      atendimento: e.atendimento || void 0,
      whatsApi: e.whatsApi || { active: !1, token: "", userID: "" },
      initDate: e.initDate || !1,
      //Armazena a data em que o plugin foi instalado para validar a utilização de algumas funções do usuário free
      modalLead: e.modalLead || {},
      // Respostas Rapidas OLD
      guardaMsg: e.guardaMsg || [],
      medias: e.medias || [],
      // Respostas Rapidas New
      respostasRapidas: e.respostasRapidas || [],
      respostasRapidasAcao: e.respostasRapidasAcao || []
    });
  });
}
function u() {
  chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, function(e) {
    e.length > 0 && e[0].id !== void 0 ? chrome.tabs.reload(e[0].id) : chrome.tabs.create({ url: "https://web.whatsapp.com" });
  });
}
function k() {
  chrome.runtime.setUninstallURL(`https://wpcrm.adcraftads.com`);
}
function _(e) {
  if (e.reason === "install") {
    console.log("Extension installed, attempting to open demo page...");
    
    fetch(`https://wpcrm.adcraftads.com/home.php`)
      .then((t) => {
        console.log("API Response status:", t.status);
        console.log("API Response ok:", t.ok);
        
        if (!t.ok) {
          throw new Error("Erro na requisição: " + t.status);
        }
        return t.json();
      })
      .then((t) => {
        console.log("API Response data:", t);
        
        if (t.success && t.url) {
          console.log("Opening demo page:", t.url);
          chrome.tabs.create({ url: t.url });
        } else {
          console.warn("API response missing success or url:", t);
          // Fallback: open default demo page
          chrome.tabs.create({ url: "https://wpcrm.adcraftads.com/" });
        }
      })
      .catch((t) => {
        console.error("Erro ao fazer a requisição:", t);
        // Fallback: open default demo page even if API fails
        console.log("Opening fallback demo page...");
        chrome.tabs.create({ url: "https://wpcrm.adcraftads.com" });
      });
  }
}
function i(e) {
  const t = chrome.runtime.getURL(e + "/src/index.html");
  chrome.tabs.query({ url: t }, function(o) {
    o.length > 0 && o.forEach((s) => {
      s.id !== void 0 && chrome.tabs.remove(s.id);
    }), chrome.tabs.create({ url: t });
  });
}
const r = /* @__PURE__ */ new Map(), p = (e, t, o) => {
  o.url && r.set(e, o.url);
}, l = (e) => {
  const t = r.get(e);
  r.delete(e), t && t.includes("https://web.whatsapp") && chrome.runtime.sendMessage({ action: "whatsIsClosed" });
}, m = () => {
  try {
    chrome.tabs.onUpdated.removeListener(p), chrome.tabs.onRemoved.removeListener(l);
  } catch (e) {
    console.error("erro ao remover os ouvintes do WhatsIsOpen", e);
  } finally {
    chrome.tabs.onUpdated.addListener(p), chrome.tabs.onRemoved.addListener(l);
  }
};
c();
m();
chrome.action.onClicked.addListener(() => {
  c(), m(), u();
});
chrome.runtime.onInstalled.addListener(async function(e) {
  _(e), u(), c(), A(), m(), k();
});
chrome.runtime.onMessage.addListener((e, t, o) => {
  switch (e.message) {
    case "CRM":
      i("crm");
      break;
    case "FLOW":
      i("fluxo");
      break;
    case "funnil":
      i("funnil");
      break;
  }
});
