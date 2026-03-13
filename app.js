// ============================================================
//  NexusStudy — app.js
//
//  👇 COLOQUE SUA CHAVE OPENROUTER AQUI:
const API_KEY = "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";
//
//  Obtenha sua chave gratuita em: https://openrouter.ai/keys
// ============================================================

const MODEL    = "stepfun/step-3.5-flash:free";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const REFERER  = "https://pandorax-arch.github.io/NexusStudy/";
const APP_NAME = "NexusStudy";

// ============================================================
//  MODOS DE ESTUDO
// ============================================================
const MODES = [
  {
    id: "geral", icon: "✨", label: "Tutor Geral",
    prompt: "Você é o NexusStudy, um tutor educacional amigável e inteligente para estudantes brasileiros. Explique conceitos de forma clara, didática e use exemplos do cotidiano. Incentive o raciocínio crítico. Responda sempre em português brasileiro.",
  },
  {
    id: "mat", icon: "🔢", label: "Matemática",
    prompt: "Você é um professor de Matemática paciente e especialista. Explique cada passo claramente, mostre os cálculos e use exemplos práticos. Cubra aritmética, álgebra, geometria, trigonometria e estatística. Responda em português brasileiro.",
  },
  {
    id: "cien", icon: "🔬", label: "Ciências",
    prompt: "Você é um professor de Ciências Naturais (Física, Química, Biologia). Explique fenômenos científicos com clareza, use analogias simples e conecte teoria com prática. Responda em português brasileiro.",
  },
  {
    id: "hist", icon: "🌍", label: "História & Geo",
    prompt: "Você é um professor de História e Geografia. Conte eventos históricos como narrativas envolventes, relacione passado e presente, incentive o pensamento crítico. Responda em português brasileiro.",
  },
  {
    id: "port", icon: "📖", label: "Português & Literatura",
    prompt: "Você é um professor de Língua Portuguesa e Literatura. Ajude com gramática, interpretação de texto, redação e análise literária, incluindo preparação para o ENEM. Responda em português brasileiro.",
  },
  {
    id: "ing", icon: "🇬🇧", label: "Inglês",
    prompt: "You are a friendly English teacher for Brazilian students. Use both Portuguese and English. Explain grammar, vocabulary and cultural context. Adapt the level of English based on the student's proficiency.",
  },
  {
    id: "enem", icon: "📝", label: "ENEM & Vestibular", tag: "HOT",
    prompt: "Você é um especialista em ENEM e vestibulares. Domine o formato, competências e habilidades cobradas. Ajude com redação nota 1000, estratégias de prova e questões de todas as áreas. Responda em português brasileiro.",
  },
  {
    id: "cod", icon: "💻", label: "Programação",
    prompt: "Você é um mentor de programação para estudantes. Explique lógica, algoritmos e linguagens com exemplos claros e comentados. Aborde Python, JavaScript e pensamento computacional. Responda em português brasileiro.",
  },
];

const SUGGESTIONS = [
  { icon: "📐", text: "Como resolver equações de 2º grau?" },
  { icon: "🧬", text: "Me explique a divisão celular" },
  { icon: "📜", text: "Resumo da Revolução Francesa" },
  { icon: "✍️", text: "Dicas para redação nota 1000 no ENEM" },
];

// ============================================================
//  REACT HOOKS
// ============================================================
const { useState, useRef, useEffect, useCallback } = React;

// ============================================================
//  HELPERS
// ============================================================
function now() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function imgToB64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderMd(text) {
  if (!text) return { __html: "" };
  try {
    return { __html: marked.parse(text) };
  } catch {
    return { __html: text.replace(/\n/g, "<br>") };
  }
}

// ============================================================
//  SUB-COMPONENTES
// ============================================================

// Animação de "pensando"
function Thinking() {
  return (
    <div className="msg-wrap">
      <div className="avatar ai">🎓</div>
      <div className="msg-body">
        <div className="thinking">
          <span>Pensando</span>
          <div className="dots">
            <div className="dot" />
            <div className="dot" />
            <div className="dot" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Mensagem individual
function Msg({ m }) {
  const ai = m.role === "assistant";
  return (
    <div className={`msg-wrap${ai ? "" : " user"}`}>
      {ai  && <div className="avatar ai">🎓</div>}
      <div className="msg-body">
        {m.imgPreview && <img src={m.imgPreview} alt="" className="bubble-img" />}
        <div className={`bubble ${ai ? "ai" : "user"}`}>
          {ai
            ? <span>
                <span dangerouslySetInnerHTML={renderMd(m.content)} />
                {m.streaming && <span className="cursor" />}
              </span>
            : m.content
          }
        </div>
        <div className="msg-time">{m.time}</div>
      </div>
      {!ai && <div className="avatar user">👤</div>}
    </div>
  );
}

// Toast
function Toast({ t }) {
  return (
    <div className={`toast${t.show ? " show" : ""}${t.type === "err" ? " err" : t.type === "ok" ? " ok" : ""}`}>
      {t.msg}
    </div>
  );
}

// ============================================================
//  APP PRINCIPAL
// ============================================================
function App() {
  // Estado
  const [msgs,      setMsgs]      = useState([]);
  const [text,      setText]      = useState("");
  const [mode,      setMode]      = useState(MODES[0]);
  const [busy,      setBusy]      = useState(false);   // carregando (antes do stream)
  const [stream,    setStream]    = useState(false);    // streamando
  const [key,       setKey]       = useState(API_KEY);
  const [imgPrev,   setImgPrev]   = useState(null);
  const [imgB64,    setImgB64]    = useState(null);
  const [toast,     setToast]     = useState({ show: false, msg: "", type: "" });

  // Refs
  const bottomRef = useRef(null);
  const taRef     = useRef(null);
  const fileRef   = useRef(null);
  const abort     = useRef(null);
  const msgsSnap  = useRef(msgs);
  msgsSnap.current = msgs;

  // Scroll automático
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  // Auto-resize textarea
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [text]);

  // ---------- Toast ----------
  const flash = useCallback((msg, type = "") => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(s => ({ ...s, show: false })), 3000);
  }, []);

  // ---------- Imagem ----------
  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { flash("Só imagens são aceitas.", "err"); return; }
    if (f.size > 5_000_000)           { flash("Máximo 5MB por imagem.", "err"); return; }
    setImgPrev(URL.createObjectURL(f));
    setImgB64(await imgToB64(f));
    flash("Imagem anexada ✓", "ok");
  }

  function dropImg() {
    setImgPrev(null);
    setImgB64(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ---------- ENVIAR ----------
  async function send(override) {
    // Texto final
    const userText = (override !== undefined ? String(override) : text).trim();
    if (!userText && !imgB64) return;
    if (busy || stream) return;

    // Validar chave
    const apiKey = key.trim();
    if (!apiKey || apiKey === "COLOQUE_SUA_CHAVE_AQUI") {
      flash("Configure sua chave OpenRouter na barra lateral.", "err");
      return;
    }

    // Captura snapshot do estado ANTES de qualquer setMsgs
    const prevMsgs = msgsSnap.current;
    const snapPrev = imgPrev;
    const snapB64  = imgB64;

    // Adiciona mensagem do usuário à tela
    const uMsg = {
      id:         Date.now(),
      role:       "user",
      content:    userText || "(imagem)",
      imgPreview: snapPrev,
      time:       now(),
    };
    setMsgs(p => [...p, uMsg]);
    setText("");
    dropImg();
    setBusy(true);

    // --------------------------------------------------------
    // Monta o array de mensagens para a API
    //
    // Regra do OpenRouter / GLM:
    //   1. Deve começar com role "user"
    //   2. Deve ALTERNAR user → assistant → user → assistant...
    //   3. Deve TERMINAR com role "user"
    //
    // Estratégia:
    //   [user: instrução do modo] [assistant: OK]
    //   + histórico de conversa anterior (filtrado e validado)
    //   + [user: nova pergunta]
    // --------------------------------------------------------

    // Filtra o histórico anterior para garantir alternância correta
    const validHistory = prevMsgs
      .filter(m =>
        m.content &&
        m.content.trim().length > 0 &&
        !m.content.startsWith("Erro:") &&
        m.streaming !== true
      )
      .map(m => ({
        role:    m.role === "assistant" ? "assistant" : "user",
        content: m.content.trim(),
      }));

    // Garante alternância: remove duplicatas consecutivas de mesmo role
    const cleanHistory = [];
    for (const m of validHistory) {
      if (cleanHistory.length === 0) {
        cleanHistory.push(m);
      } else {
        const last = cleanHistory[cleanHistory.length - 1];
        if (last.role !== m.role) {
          cleanHistory.push(m);
        }
        // Se dois "user" seguidos, substitui o último
        else if (m.role === "user") {
          cleanHistory[cleanHistory.length - 1] = m;
        }
        // Se dois "assistant" seguidos, pula
      }
    }

    // Monta payload final
    const apiMsgs = [
      { role: "user",      content: mode.prompt },
      { role: "assistant", content: "Entendido." },
      ...cleanHistory,
      { role: "user",      content: userText || "Descreva o que vê." },
    ];

    // Debug — abre F12 para ver
    console.log("[Nexus] Enviando para OpenRouter:", JSON.stringify(apiMsgs, null, 2));

    // Cria placeholder da resposta IA
    const aiId = Date.now() + 1;
    setMsgs(p => [...p, { id: aiId, role: "assistant", content: "", time: now(), streaming: true }]);
    setBusy(false);
    setStream(true);

    const ctrl = new AbortController();
    abort.current = ctrl;

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type":       "application/json",
          "Authorization":      "Bearer " + apiKey,
          "HTTP-Referer":       REFERER,
          "X-OpenRouter-Title": APP_NAME,
        },
        body: JSON.stringify({
          model:    MODEL,
          stream:   true,
          messages: apiMsgs,
        }),
      });

      // Trata erro HTTP
      if (!res.ok) {
        let errTxt = "Erro HTTP " + res.status;
        try {
          const j = await res.json();
          console.error("[Nexus] Erro da API:", JSON.stringify(j, null, 2));
          errTxt = j?.error?.message || j?.message || errTxt;
        } catch (_) {}
        throw new Error(errTxt);
      }

      // Lê o stream SSE
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (raw === "[DONE]") break outer;
          try {
            const piece = JSON.parse(raw)?.choices?.[0]?.delta?.content;
            if (piece) {
              acc += piece;
              const snap = acc;
              setMsgs(p => p.map(m => m.id === aiId ? { ...m, content: snap } : m));
            }
          } catch (_) { /* linha incompleta, ignora */ }
        }
      }

      // Finaliza — remove o cursor piscante
      setMsgs(p => p.map(m => m.id === aiId ? { ...m, streaming: false } : m));

    } catch (err) {
      if (err.name === "AbortError") {
        setMsgs(p => p.map(m =>
          m.id === aiId
            ? { ...m, content: (m.content || "") + "\n\n*(parado)*", streaming: false }
            : m
        ));
      } else {
        console.error("[Nexus] Erro:", err);
        setMsgs(p => p.map(m =>
          m.id === aiId
            ? { ...m, content: "Erro: " + err.message, streaming: false }
            : m
        ));
        flash("Erro: " + err.message, "err");
      }
    } finally {
      setStream(false);
      abort.current = null;
    }
  }

  // Enter para enviar, Shift+Enter para nova linha
  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // Troca de modo
  function changeMode(m) {
    setMode(m);
    setMsgs([]);
    flash("Modo: " + m.label, "ok");
  }

  const keyOk = key.trim().length > 10 && key !== "COLOQUE_SUA_CHAVE_AQUI";
  const canSend = !busy && !stream && (text.trim().length > 0 || !!imgB64);

  // ============================================================
  //  RENDER
  // ============================================================
  return (
    <div className="shell">

      {/* ===== SIDEBAR ===== */}
      <aside className="sidebar">

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-row">
            <div className="logo-mark">📚</div>
            <span className="logo-name">NexusStudy</span>
          </div>
          <div className="logo-sub">IA educacional para estudantes</div>
        </div>

        {/* Novo chat */}
        <button className="btn-new" onClick={() => setMsgs([])}>
          + Novo Chat
        </button>

        {/* Modos */}
        <div className="sidebar-label">Modos</div>
        <nav className="mode-list">
          {MODES.map(m => (
            <button
              key={m.id}
              className={`mode-item${mode.id === m.id ? " active" : ""}`}
              onClick={() => changeMode(m)}
            >
              <span className="mode-ico">{m.icon}</span>
              <span className="mode-name">{m.label}</span>
              {m.tag && <span className="mode-tag">{m.tag}</span>}
            </button>
          ))}
        </nav>

        {/* Chave API */}
        <div className="api-box">
          <div className="api-title">Chave OpenRouter</div>
          <div className="api-field">
            <input
              type="password"
              className="api-input"
              placeholder="sk-or-v1-..."
              value={key === "COLOQUE_SUA_CHAVE_AQUI" ? "" : key}
              onChange={e => setKey(e.target.value.trim() || "COLOQUE_SUA_CHAVE_AQUI")}
            />
            <div className={`api-dot${keyOk ? " on" : " off"}`} />
          </div>
          <div className="api-note">
            Grátis em <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a>
          </div>
        </div>
      </aside>

      {/* ===== MAIN ===== */}
      <main className="main">

        {/* Topbar */}
        <header className="topbar">
          <div className="tb-mode">
            <span className="tb-mode-ico">{mode.icon}</span>
            <span className="tb-mode-name">{mode.label}</span>
          </div>
          <div className="tb-sep" />
          <div className="tb-status">
            <div className="tb-dot" />
            <span>{stream ? "Respondendo..." : "Pronto"}</span>
          </div>
          <div className="tb-right">
            {imgPrev && (
              <div className="img-badge">
                <img src={imgPrev} alt="" className="img-badge-thumb" />
                <span>Imagem</span>
                <button className="img-badge-rm" onClick={dropImg}>✕</button>
              </div>
            )}
            {stream && (
              <button className="btn-stop" onClick={() => abort.current?.abort()}>
                ⏹ Parar
              </button>
            )}
          </div>
        </header>

        {/* Chat */}
        <div className="chat">
          {msgs.length === 0 ? (
            <div className="welcome">
              <div className="w-orb">📚</div>
              <h1 className="w-title">Olá! Sou o NexusStudy</h1>
              <p className="w-sub">
                Seu tutor inteligente para todas as matérias. Escolha um modo na barra lateral ou toque em uma sugestão para começar!
              </p>
              <div className="suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <div key={i} className="sug-card" onClick={() => send(s.text)}>
                    <div className="sug-ico">{s.icon}</div>
                    <div className="sug-text">{s.text}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {msgs.map(m => <Msg key={m.id} m={m} />)}
              {busy && <Thinking />}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="input-area">
          {imgPrev && (
            <div className="img-preview-row">
              <div className="img-preview-item">
                <img src={imgPrev} alt="preview" />
                <button className="img-rm" onClick={dropImg}>✕</button>
              </div>
            </div>
          )}

          <div className="input-box">
            <textarea
              ref={taRef}
              className="input-ta"
              placeholder={`Pergunte ao ${mode.label}...`}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              disabled={busy || stream}
            />
            <div className="input-actions">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onFile}
              />
              <button
                className={`ico-btn${imgB64 ? " active" : ""}`}
                title="Anexar imagem"
                onClick={() => fileRef.current?.click()}
                disabled={busy || stream}
              >
                📎
              </button>
              <button
                className="send-btn"
                onClick={() => send()}
                disabled={!canSend}
                title="Enviar (Enter)"
              >
                ↑
              </button>
            </div>
          </div>

          <div className="input-foot">
            <span className="input-hint">
              {mode.icon} {mode.label} &nbsp;·&nbsp; Enter para enviar
            </span>
            <span className="char-c">{text.length}</span>
          </div>
        </div>
      </main>

      {/* Toast */}
      <Toast t={toast} />
    </div>
  );
}

// ============================================================
//  MOUNT
// ============================================================
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
