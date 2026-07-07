import React from 'react';
import * as coach from './coach.js';
import { isStepSummary } from './prompts.js';
import { guardInput, guardOutput } from './guard.js';
const { useState, useEffect, useRef } = React;

// Offline text-to-speech (browser SpeechSynthesis) — accessibility for lower-literacy / L1 learners.
function ttsStrip(t) { return String(t || '').replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim(); }
let _ttsId = null;
function speak(text, id) {
  try {
    const synth = window.speechSynthesis; if (!synth) return;
    const wasThis = synth.speaking && _ttsId === id;
    synth.cancel(); _ttsId = null;
    if (wasThis) return; // second click on the same message = stop
    const u = new SpeechSynthesisUtterance(ttsStrip(text));
    u.lang = 'es-ES'; u.rate = 0.95;
    const v = (synth.getVoices() || []).find((x) => /^es(\b|[-_])/i.test(x.lang));
    if (v) u.voice = v;
    _ttsId = id; u.onend = () => { _ttsId = null; };
    synth.speak(u);
  } catch (e) {}
}
function SpeakBtn({ text, id }) {
  return (
    <button onClick={() => speak(text, id)} title="Escuchar" aria-label="Escuchar"
      className="mt-1.5 text-navy-300 hover:text-brand-500 transition flex items-center gap-1 text-[11px] font-bold">
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14" /></svg>
      Escuchar
    </button>
  );
}

// ---- tiny markdown-lite renderer (## heading, **bold**, - bullets, blank lines) ----
function inline(text, keyBase) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p)
      ? <strong key={keyBase + '-' + i}>{p.slice(2, -2)}</strong>
      : <React.Fragment key={keyBase + '-' + i}>{p}</React.Fragment>
  );
}
function Rich({ text }) {
  const lines = String(text || '').split('\n');
  const out = [];
  lines.forEach((ln, i) => {
    const t = ln.trim();
    if (t.startsWith('## ')) out.push(<p key={i} className="font-black text-navy-700 text-base mt-2 mb-1">{inline(t.slice(3), 'h' + i)}</p>);
    else if (t.startsWith('# ')) out.push(<p key={i} className="font-black text-navy-700 text-lg mt-2 mb-1">{inline(t.slice(2), 'h' + i)}</p>);
    else if (t.startsWith('- ') || t.startsWith('• ')) out.push(<p key={i} className="flex gap-2"><span>•</span><span>{inline(t.slice(2), 'b' + i)}</span></p>);
    else if (t === '') out.push(<div key={i} className="h-2" />);
    else out.push(<p key={i}>{inline(ln, 'p' + i)}</p>);
  });
  return <div className="space-y-1 leading-relaxed">{out}</div>;
}

const Spinner = () => (
  <span className="inline-flex gap-1 items-center">
    <span className="w-2 h-2 bg-brand-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-2 h-2 bg-brand-300 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
    <span className="w-2 h-2 bg-brand-300 rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
  </span>
);

/**
 * Reusable Gallito chat backed by the local LLM.
 * props: systemPrompt, intro (first assistant message), introCard {title, body, tip},
 *        header {title, subtitle}, mascotSrc, completeLabel, onComplete, onEvent, storageKey
 */
export function GallitoChat({ systemPrompt, systemPromptFor, temperature, maxTokens, intro, introCard, header, mascotSrc, completeLabel = 'Completar paso', onComplete, onEvent, step, finishButton = false, hideHeader = false, starters }) {
  const [stage, setStage] = useState('intro'); // intro | loading | chat | nowebgpu | error
  const [progress, setProgress] = useState({ progress: 0, text: '' });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const endRef = useRef(null);
  const convId = useRef(null);
  const ev = (name, data) => { try { onEvent && onEvent(name, { ...(data || {}), conversation_id: convId.current, step }); } catch (e) {} };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  async function start() {
    convId.current = (crypto?.randomUUID ? crypto.randomUUID() : 'c-' + Date.now());
    const model = coach.getSelectedModel();
    // Already loaded this session → straight to chat (no re-download, no loading screen).
    if (coach.engineReady(model)) { setMessages([{ role: 'assistant', content: intro }]); setStage('chat'); ev('chat_started', { model, cached: true }); return; }
    if (!coach.webgpuAvailable()) { setStage('nowebgpu'); return; }
    setStage('loading'); setProgress({ progress: 0, text: 'Preparando…' });
    ev('model_load_start', { model });
    try {
      await coach.getEngine(model, (r) => setProgress({ progress: r.progress || 0, text: r.text || '' }));
      setMessages([{ role: 'assistant', content: intro }]);
      setStage('chat');
      ev('chat_started', { model, mock: coach.MOCK });
    } catch (e) {
      if (String(e.message).includes('NO_WEBGPU')) setStage('nowebgpu');
      else { setErrMsg(String(e.message || e)); setStage('error'); }
      ev('model_load_error', { error: String(e.message || e) });
    }
  }

  const softShownRef = useRef(new Set());
  async function send(textArg) {
    const text = (typeof textArg === 'string' ? textArg : input).trim();
    if (!text || typing || done) return;
    setInput('');
    const history = [...messages, { role: 'user', content: text }];
    ev('student_msg', { text });
    // Deterministic safety guardrail BEFORE the model (crisis / violence / prompt-injection).
    const g = guardInput(text);
    if (g.block) { setMessages([...history, { role: 'assistant', content: g.response }]); ev('guard_' + g.kind, { text }); return; }
    setMessages([...history, { role: 'assistant', content: '' }]);
    setTyping(true);
    try {
      const sys = systemPromptFor ? systemPromptFor(text) : systemPrompt;
      const llmMessages = [{ role: 'system', content: sys }, ...history];
      const raw = await coach.chat(llmMessages, {
        temperature: temperature ?? 0.5,
        max_tokens: maxTokens ?? 180,
        frequency_penalty: 0.5,
        presence_penalty: 0.4,
        onToken: (_d, fullText) => setMessages((prev) => {
          const next = prev.slice();
          next[next.length - 1] = { role: 'assistant', content: fullText };
          return next;
        }),
      });
      let full = guardOutput(raw); // catch any leaked system-prompt / role text
      // Soft nets (once per conversation): distress → trusted-adult suggestion; dream → realistic
      // Plan B. Deterministic, so they fire reliably even when the small model forgets.
      if (g.soft && !softShownRef.current.has(g.soft) && !isStepSummary(full) && !(g.soft === 'dream' && /plan b/i.test(full))) {
        full += g.note; softShownRef.current.add(g.soft); ev('guard_' + g.soft, { text });
      }
      if (full !== raw) setMessages((prev) => { const next = prev.slice(); next[next.length - 1] = { role: 'assistant', content: full }; return next; });
      ev('ai_msg', { text: full });
      if (isStepSummary(full)) { setDone(true); ev('step_summary', {}); }
    } catch (e) {
      setMessages((prev) => {
        const next = prev.slice();
        next[next.length - 1] = { role: 'assistant', content: '⚠️ Tuve un problema para responder. Intenta de nuevo en un momento.' };
        return next;
      });
      ev('ai_error', { error: String(e.message || e) });
    } finally {
      setTyping(false);
    }
  }

  // ---------- INTRO ----------
  if (stage === 'intro') {
    return (
      <div className="flex-1 flex flex-col">
        {!hideHeader && <Header header={header} mascotSrc={mascotSrc} />}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 bg-cream-50">
          <div className="max-w-2xl mx-auto">
            <div className="bg-brand-50 border-2 border-brand-200 rounded-2xl p-5 mb-4">
              <h3 className="font-black text-navy-700 text-base mb-2">{introCard?.title}</h3>
              <p className="text-sm text-navy-500 leading-relaxed">{introCard?.body}</p>
              {introCard?.tip && <div className="bg-white rounded-xl p-3 mt-3 flex gap-2 items-start"><span className="text-lg">💡</span><p className="text-xs text-navy-500">{introCard.tip}</p></div>}
            </div>
            <div className="bg-white border-2 border-cream-200 rounded-2xl p-5">
              <p className="text-xs text-navy-400 mb-3">{coach.MOCK ? 'Modo demo activo (sin descarga real).' : (coach.engineReady() ? 'Gallito ya está listo en este equipo ✓' : 'Gallito se descarga una sola vez y se reutiliza en todos los pasos, sin internet. (Puedes elegir el tamaño en Inicio → “Prepara la app para usar sin internet”.)')}</p>
              <button onClick={start} className="w-full py-3 bg-gradient-to-r from-brand-400 to-brand-300 text-white rounded-xl font-bold hover:opacity-90 transition shadow-lg">Comenzar la entrevista con Gallito</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- LOADING ----------
  if (stage === 'loading') {
    const pct = Math.round((progress.progress || 0) * 100);
    return (
      <div className="flex-1 flex flex-col">
        {!hideHeader && <Header header={header} mascotSrc={mascotSrc} />}
        <div className="flex-1 flex items-center justify-center px-6 bg-cream-50">
          <div className="text-center max-w-sm">
            {mascotSrc && <img src={mascotSrc} alt="Gallito" className="h-20 mx-auto mb-4 mascot-shadow" />}
            <p className="font-black text-navy-700 mb-1">Preparando a Gallito…</p>
            <p className="text-xs text-navy-400 mb-4">{coach.MOCK ? 'Modo demo' : 'La primera vez puede tardar; luego abre al instante y funciona sin internet.'}</p>
            <div className="w-full h-3 bg-cream-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-brand-400 to-brand-300 transition-all" style={{ width: pct + '%' }} /></div>
            <p className="text-xs text-navy-500 mt-2">{pct}% · {progress.text}</p>
          </div>
        </div>
      </div>
    );
  }

  // ---------- NO WEBGPU / ERROR ----------
  if (stage === 'nowebgpu' || stage === 'error') {
    return (
      <div className="flex-1 flex flex-col">
        {!hideHeader && <Header header={header} mascotSrc={mascotSrc} />}
        <div className="flex-1 flex items-center justify-center px-6 bg-cream-50">
          <div className="text-center max-w-md bg-white border-2 border-cream-200 rounded-2xl p-6">
            <span className="text-3xl">🦉</span>
            <p className="font-black text-navy-700 mt-2 mb-1">{stage === 'nowebgpu' ? 'Tu navegador no soporta el asistente local' : 'No pude iniciar el asistente'}</p>
            <p className="text-sm text-navy-500">{stage === 'nowebgpu' ? 'El Gallito con IA necesita WebGPU. Usa Chrome o Edge actualizados en una computadora, o un equipo más reciente.' : errMsg}</p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <button onClick={start} className="px-5 py-2.5 bg-brand-400 text-white rounded-xl font-bold hover:bg-brand-500 transition">Reintentar</button>
              {onComplete && <button onClick={onComplete} className="px-5 py-2.5 bg-navy-100 text-navy-600 rounded-xl font-bold hover:bg-navy-200 transition">Continuar sin el asistente →</button>}
            </div>
            <p className="text-[11px] text-navy-400 mt-3">Puedes seguir con "Datos verificados" y los demás pasos sin la IA.</p>
          </div>
        </div>
      </div>
    );
  }

  // ---------- CHAT ----------
  return (
    <div className="flex-1 flex flex-col">
      <Header header={header} mascotSrc={mascotSrc} />
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 bg-cream-50">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
              {m.role === 'assistant' && mascotSrc && <img src={mascotSrc} alt="" className="h-8 w-auto mr-3 mt-1 shrink-0" />}
              <div className={`max-w-[85%] sm:max-w-[70%] px-4 sm:px-5 py-3 text-sm ${m.role === 'assistant' ? 'chat-ai bg-white border border-cream-200 text-navy-700' : 'chat-user bg-brand-400 text-white'} shadow-sm`}>
                {m.role === 'assistant' ? (m.content ? <><Rich text={m.content} /><SpeakBtn text={m.content} id={i} /></> : <Spinner />) : <p className="whitespace-pre-line">{m.content}</p>}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>
      <div className="px-4 sm:px-8 py-3 sm:py-4 border-t border-cream-200 bg-white safe-bottom">
        <div className="max-w-2xl mx-auto">
          {done ? (
            <button onClick={onComplete} className="w-full py-3 bg-gradient-to-r from-brand-400 to-brand-300 text-white rounded-xl font-bold hover:opacity-90 transition shadow-lg">{completeLabel}</button>
          ) : (
            <>
              {starters && messages.filter((m) => m.role === 'user').length === 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {starters.map((s, i) => (
                    <button key={i} onClick={() => send(s)} disabled={typing}
                      className="text-xs bg-cream-100 hover:bg-brand-100 text-navy-600 rounded-full px-3 py-1.5 border border-cream-200 transition disabled:opacity-50">{s}</button>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} disabled={typing}
                  placeholder={typing ? 'Gallito está escribiendo…' : 'Escribe tu respuesta…'}
                  className="flex-1 bg-cream-50 rounded-xl px-4 sm:px-5 py-3 text-base sm:text-sm text-navy-700 placeholder-navy-300 border-2 border-cream-200 focus:border-brand-300 transition disabled:opacity-60" />
                <button onClick={send} disabled={typing || !input.trim()} className="w-12 h-12 bg-brand-400 rounded-xl flex items-center justify-center text-white hover:bg-brand-500 transition shrink-0 shadow-md disabled:opacity-40">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                </button>
              </div>
              {finishButton && <button onClick={onComplete} className="mt-2 text-xs text-navy-400 hover:text-brand-500 font-bold transition">Terminar y completar paso →</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ header, mascotSrc }) {
  return (
    <header className="px-4 sm:px-8 py-4 border-b border-cream-200 bg-white flex items-center gap-4">
      {mascotSrc && <img src={mascotSrc} alt="Gallito" className="h-10 w-auto" />}
      <div><h2 className="font-black text-navy-700">{header?.title}</h2><p className="text-xs text-navy-400">{header?.subtitle}</p></div>
    </header>
  );
}
