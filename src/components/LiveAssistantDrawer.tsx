import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, X } from 'lucide-react';
import type { ContentCluster } from '../types/vault';
import { Pcm24kPlayer, pcmFloat32ToBase64 } from '../utils/liveAudio';

interface LiveAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilter: (args: {
    cluster?: ContentCluster;
    location?: string;
    searchQuery?: string;
  }) => void;
}

interface TranscriptEntry {
  id: string;
  speaker: 'Você' | 'Assistente';
  text: string;
}

export function LiveAssistantDrawer({
  isOpen,
  onClose,
  onApplyFilter,
}: LiveAssistantDrawerProps) {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'ready' | 'error'>('disconnected');
  const [activeModel, setActiveModel] = useState<string>('gemini-3.8-live-extended-thinking');
  const [interactionState, setInteractionState] = useState<'idle' | 'in_progress'>('idle');
  const [isMicActive, setIsMicActive] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<Pcm24kPlayer | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const onApplyFilterRef = useRef(onApplyFilter);
  onApplyFilterRef.current = onApplyFilter;

  const stopMic = async () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (micCtxRef.current) {
      await micCtxRef.current.close();
      micCtxRef.current = null;
    }
    if (micStreamRef.current) {
      for (const track of micStreamRef.current.getTracks()) {
        track.stop();
      }
      micStreamRef.current = null;
    }
    setIsMicActive(false);
  };

  const closeConnection = async () => {
    await stopMic();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (playerRef.current) {
      await playerRef.current.close();
      playerRef.current = null;
    }
    setStatus('disconnected');
    setInteractionState('idle');
  };

  useEffect(() => {
    if (!isOpen) {
      void closeConnection();
    }
    return () => {
      void closeConnection();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const connectLive = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    setErrorMessage(null);
    const player = new Pcm24kPlayer();
    playerRef.current = player;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/live-vault`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as {
          ready?: boolean;
          model?: string;
          audio?: string;
          interrupted?: boolean;
          interactionStatus?: 'in_progress' | 'idle';
          inputTranscript?: string;
          outputTranscript?: string;
          toolFilter?: {
            cluster?: string;
            location?: string;
            searchQuery?: string;
          };
          error?: string;
        };

        if (msg.ready) {
          setStatus('ready');
          if (msg.model) setActiveModel(msg.model);
        }
        if (msg.error) {
          setStatus('error');
          setErrorMessage(msg.error);
        }
        if (msg.audio) {
          player.enqueue(msg.audio);
        }
        if (msg.interrupted) {
          player.reset();
        }
        if (msg.interactionStatus) {
          setInteractionState(msg.interactionStatus);
        }
        if (msg.inputTranscript) {
          setTranscripts((prev) => [
            ...prev,
            { id: crypto.randomUUID(), speaker: 'Você', text: msg.inputTranscript! },
          ]);
        }
        if (msg.outputTranscript) {
          setTranscripts((prev) => [
            ...prev,
            { id: crypto.randomUUID(), speaker: 'Assistente', text: msg.outputTranscript! },
          ]);
        }
        if (msg.toolFilter) {
          const validClusters: ContentCluster[] = [
            'all',
            'festas',
            'ar_livre',
            'viagens',
            'familia',
            'nsfw_18',
          ];
          const cluster = validClusters.includes(msg.toolFilter.cluster as ContentCluster)
            ? (msg.toolFilter.cluster as ContentCluster)
            : undefined;
          onApplyFilterRef.current({
            cluster,
            location: msg.toolFilter.location,
            searchQuery: msg.toolFilter.searchQuery,
          });
        }
      } catch {
        // Ignore malformed packet
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setErrorMessage('Falha de conexão WebSocket com o servidor Live.');
    };

    ws.onclose = () => {
      setStatus((prev) => (prev === 'error' ? 'error' : 'disconnected'));
    };
  };

  const toggleMicrophone = async () => {
    if (isMicActive) {
      await stopMic();
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connectLive();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      micCtxRef.current = inputCtx;
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(inputCtx.destination);

      processor.onaudioprocess = (e) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const base64 = pcmFloat32ToBase64(e.inputBuffer.getChannelData(0));
        ws.send(JSON.stringify({ audio: base64 }));
      };

      setIsMicActive(true);
    } catch {
      setErrorMessage('Permissão de microfone negada ou indisponível neste navegador.');
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = textInput.trim();
    if (!trimmed) return;

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setErrorMessage('Conecte a sessão ao vivo antes de enviar um comando.');
      return;
    }

    setTranscripts((prev) => [
      ...prev,
      { id: crypto.randomUUID(), speaker: 'Você', text: trimmed },
    ]);
    wsRef.current.send(JSON.stringify({ text: trimmed }));
    setTextInput('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-drawer-title"
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div>
          <h2
            id="live-drawer-title"
            className="font-display text-base font-bold text-slate-950 dark:text-slate-50"
          >
            Busca por Voz ao Vivo (Gemini Live)
          </h2>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            Modelo: {activeModel}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar assistente de voz"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            Fale ou digite comandos como{' '}
            <span className="font-medium">"Mostre as fotos de festas em São Paulo"</span> ou{' '}
            <span className="font-medium">"Filtrar trilhas ao ar livre"</span>. A sessão usa
            Gemini 3.8 Live Extended Thinking com fallback automático para Gemini 3.8 Live.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {status !== 'ready' ? (
              <button
                type="button"
                onClick={connectLive}
                disabled={status === 'connecting'}
                className="h-9 rounded-lg bg-blue-600 px-3.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {status === 'connecting' ? 'Conectando...' : 'Iniciar Sessão Live'}
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleMicrophone}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium transition-colors ${
                  isMicActive
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950'
                }`}
              >
                {isMicActive ? (
                  <>
                    <MicOff className="h-3.5 w-3.5" />
                    <span>Silenciar Microfone</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5" />
                    <span>Ativar Microfone (16 kHz)</span>
                  </>
                )}
              </button>
            )}

            <span className="text-xs text-slate-500 dark:text-slate-400">
              {status === 'ready'
                ? interactionState === 'in_progress'
                  ? 'Raciocínio em andamento...'
                  : 'Pronto para ouvir'
                : status === 'connecting'
                  ? 'Conectando...'
                  : 'Desconectado'}
            </span>
          </div>

          {errorMessage && (
            <p role="alert" className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          {transcripts.length === 0 ? (
            <p className="text-center text-xs text-slate-500 dark:text-slate-400 py-8">
              Inicie a sessão ao vivo e envie um comando por voz ou texto.
            </p>
          ) : (
            transcripts.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-lg border p-3 text-xs ${
                  entry.speaker === 'Você'
                    ? 'border-blue-200 bg-blue-50/70 text-slate-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-slate-100'
                    : 'border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                }`}
              >
                <div className="font-semibold">{entry.speaker}</div>
                <p className="mt-0.5 leading-relaxed">{entry.text}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <form
        onSubmit={handleSendText}
        className="flex items-center gap-2 border-t border-slate-200 p-4 dark:border-slate-800"
      >
        <label htmlFor="live-text-command" className="sr-only">
          Comando de texto para o assistente Live
        </label>
        <input
          id="live-text-command"
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Enviar comando de busca por texto..."
          className="h-9 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="submit"
          aria-label="Enviar comando"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
