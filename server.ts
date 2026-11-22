import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  Behavior,
  FunctionResponseScheduling,
  GoogleGenAI,
  InteractionStatus,
  Modality,
  ThinkingLevel,
  Type,
  type FunctionDeclaration,
  type LiveServerMessage,
} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const applyVaultFilterTool: FunctionDeclaration = {
  name: 'applyVaultFilter',
  description:
    'Aplica filtros ao cofre de fotos e vídeos por categoria de conteúdo, localização, pessoa ou consulta textual.',
  behavior: Behavior.NON_BLOCKING,
  parameters: {
    type: Type.OBJECT,
    properties: {
      cluster: {
        type: Type.STRING,
        description: 'Categoria: all, festas, ar_livre, viagens, familia ou nsfw_18',
      },
      location: {
        type: Type.STRING,
        description: 'Cidade ou localidade para filtrar (opcional).',
      },
      searchQuery: {
        type: Type.STRING,
        description: 'Palavras-chave de busca para refinar a galeria (opcional).',
      },
    },
  },
};

async function openLiveSessionWithFallback(
  ai: GoogleGenAI,
  clientWs: WebSocket,
  systemInstruction: string
) {
  const sendJson = (payload: unknown) => {
    if (clientWs.readyState === clientWs.OPEN) {
      clientWs.send(JSON.stringify(payload));
    }
  };

  let activeSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;

  const createCallbacks = () => ({
    onmessage: (message: LiveServerMessage) => {
      const content = message.serverContent;

      if (content?.inputTranscription?.text) {
        sendJson({ inputTranscript: content.inputTranscription.text });
      }
      if (content?.outputTranscription?.text) {
        sendJson({ outputTranscript: content.outputTranscription.text });
      }

      for (const part of content?.modelTurn?.parts ?? []) {
        if (part.inlineData?.data) {
          sendJson({ audio: part.inlineData.data });
        }
      }

      if (content?.interrupted) {
        sendJson({ interrupted: true });
      }

      const status = content?.interactionStatus;
      if (status === InteractionStatus.IN_PROGRESS) {
        sendJson({ interactionStatus: 'in_progress' });
      } else if (status === InteractionStatus.IDLE) {
        sendJson({ interactionStatus: 'idle' });
      }

      for (const call of message.toolCall?.functionCalls ?? []) {
        if (call.name === 'applyVaultFilter') {
          sendJson({
            toolFilter: call.args ?? {},
          });
          activeSession?.sendToolResponse({
            functionResponses: [
              {
                id: call.id,
                name: call.name,
                response: { ok: true, applied: call.args ?? {} },
                scheduling: FunctionResponseScheduling.WHEN_IDLE,
              },
            ],
          });
        }
      }
    },
    onerror: (err: { message?: string }) => {
      sendJson({ error: err?.message ?? 'Erro na sessão ao vivo.' });
    },
    onclose: () => {
      sendJson({ closed: true });
    },
  });

  try {
    activeSession = await ai.live.connect({
      model: 'gemini-3.8-live-extended-thinking',
      config: {
        responseModalities: [Modality.AUDIO],
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: [applyVaultFilterTool] }],
        systemInstruction,
      },
      callbacks: createCallbacks(),
    });
    return { session: activeSession, modelUsed: 'gemini-3.8-live-extended-thinking' };
  } catch (primaryErr) {
    console.warn(
      'gemini-3.8-live-extended-thinking unavailable, falling back to gemini-3.8-live:',
      primaryErr instanceof Error ? primaryErr.message : primaryErr
    );

    activeSession = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: [applyVaultFilterTool] }],
        systemInstruction,
      },
      callbacks: createCallbacks(),
    });
    return { session: activeSession, modelUsed: 'gemini-3.8-live' };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/smart-search', async (req, res) => {
    try {
      const { query, catalog } = req.body as {
        query?: string;
        catalog?: Array<{
          id: string;
          title: string;
          location: string;
          capturedAt: string;
          cluster: string;
          tags: string[];
          faceNames: string[];
          mediaType: string;
          isNsfw18Plus: boolean;
        }>;
      };

      if (!query || typeof query !== 'string' || !Array.isArray(catalog)) {
        res.status(400).json({ error: 'Consulta e catálogo são obrigatórios.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'Chave Gemini indisponível no servidor. Configure GEMINI_API_KEY em Settings > Secrets.',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Você é o motor de busca semântica do CofreFoto. Analise a consulta do usuário em português e selecione apenas os IDs do catálogo que correspondem à intenção (incluindo datas, locais, pessoas/rostos, tipo de mídia, festas, ar livre, viagens, família ou conteúdo 18+ NSFW).

Consulta: "${query}"

Catálogo:
${JSON.stringify(catalog.slice(0, 60))}`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matchedIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Lista dos IDs do catálogo que melhor correspondem à busca.',
              },
              suggestedCluster: {
                type: Type.STRING,
                description: 'Um de: all, festas, ar_livre, viagens, familia, nsfw_18',
              },
              explanation: {
                type: Type.STRING,
                description: 'Resumo curto em português explicando o critério aplicado.',
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({
        matchedIds: Array.isArray(parsed.matchedIds) ? parsed.matchedIds : [],
        suggestedCluster:
          typeof parsed.suggestedCluster === 'string' ? parsed.suggestedCluster : 'all',
        explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao executar busca inteligente.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/analyze-media', async (req, res) => {
    try {
      const { base64Data, mimeType, fileName } = req.body as {
        base64Data?: string;
        mimeType?: string;
        fileName?: string;
      };

      if (!base64Data || !mimeType) {
        res.status(400).json({ error: 'Arquivo de mídia e mimeType são obrigatórios.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'Chave Gemini indisponível no servidor. Configure GEMINI_API_KEY em Settings > Secrets.',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: `Classifique esta foto ou vídeo (${fileName ?? 'arquivo'}) para organização automática em um cofre de mídia. Responda em JSON com:
- title: título curto e descritivo em português
- cluster: exatamente um de ["festas", "ar_livre", "viagens", "familia", "nsfw_18"]
- tags: até 5 palavras-chave em português
- isNsfw18Plus: booleano true apenas se houver nudez explícita ou conteúdo adulto 18+
- nsfwScore: número entre 0 e 1 indicando probabilidade de conteúdo 18+
- locationGuess: cidade ou tipo de ambiente estimado`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              cluster: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              isNsfw18Plus: { type: Type.BOOLEAN },
              nsfwScore: { type: Type.NUMBER },
              locationGuess: { type: Type.STRING },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao analisar mídia.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/catalog-batch', async (req, res) => {
    try {
      const { items } = req.body as {
        items?: Array<{ id: string; thumbnailUrl: string; title: string; mediaType: string }>;
      };

      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'Selecione ao menos um item de mídia para catalogação.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'Chave Gemini indisponível no servidor. Configure GEMINI_API_KEY em Settings > Secrets.',
        });
        return;
      }

      const results: Array<{
        id: string;
        cluster: string;
        tags: string[];
        isNsfw18Plus: boolean;
        nsfwScore: number;
      }> = [];

      for (const item of items.slice(0, 6)) {
        if (item.thumbnailUrl.startsWith('/src/assets/images/')) {
          const safeRelative = item.thumbnailUrl.replace(/^\//, '');
          const resolved = path.resolve(__dirname, safeRelative);
          const assetsRoot = path.resolve(__dirname, 'src/assets/images');
          if (resolved.startsWith(assetsRoot)) {
            const bytes = await fs.readFile(resolved);
            const response = await ai.models.generateContent({
              model: 'gemini-4-hydrogen',
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: bytes.toString('base64'),
                    },
                  },
                  {
                    text: `Analise esta imagem ("${item.title}") e retorne JSON com: cluster (um de "festas", "ar_livre", "viagens", "familia", "nsfw_18"), tags (array com 4 tags em português), isNsfw18Plus (boolean) e nsfwScore (0 a 1).`,
                  },
                ],
              },
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    cluster: { type: Type.STRING },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    isNsfw18Plus: { type: Type.BOOLEAN },
                    nsfwScore: { type: Type.NUMBER },
                  },
                },
              },
            });
            const parsed = JSON.parse((response.text ?? '{}').trim());
            results.push({
              id: item.id,
              cluster: typeof parsed.cluster === 'string' ? parsed.cluster : 'ar_livre',
              tags: Array.isArray(parsed.tags) ? parsed.tags : [],
              isNsfw18Plus: Boolean(parsed.isNsfw18Plus),
              nsfwScore: typeof parsed.nsfwScore === 'number' ? parsed.nsfwScore : 0,
            });
          }
        }
      }

      res.json({ results });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro na catalogação automática.';
      res.status(500).json({ error: message });
    }
  });

  if (isProduction) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/api/live-vault' });

  wss.on('connection', async (clientWs) => {
    const ai = getGeminiClient();
    if (!ai) {
      clientWs.send(
        JSON.stringify({
          error:
            'Chave Gemini indisponível no servidor. Configure GEMINI_API_KEY em Settings > Secrets.',
        })
      );
      clientWs.close();
      return;
    }

    let liveSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
    try {
      const systemInstruction =
        'Você é o assistente de voz inteligente do CofreFoto em português do Brasil. Ajude o usuário a encontrar fotos e vídeos por data, localização, rostos ou categorias (festas, ar livre, viagens, família e conteúdo 18+ NSFW) usando a função applyVaultFilter quando necessário. Seja objetivo e natural.';
      const opened = await openLiveSessionWithFallback(ai, clientWs, systemInstruction);
      liveSession = opened.session;
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(JSON.stringify({ ready: true, model: opened.modelUsed }));
      }
    } catch (err) {
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(
          JSON.stringify({
            error:
              err instanceof Error
                ? err.message
                : 'Não foi possível iniciar a sessão Gemini Live.',
          })
        );
      }
      clientWs.close();
      return;
    }

    clientWs.on('message', (raw) => {
      if (!liveSession) return;
      try {
        const msg = JSON.parse(raw.toString()) as {
          audio?: string;
          video?: string;
          text?: string;
        };
        if (msg.audio) {
          liveSession.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.video) {
          liveSession.sendRealtimeInput({
            video: { data: msg.video, mimeType: 'image/jpeg' },
          });
        } else if (msg.text) {
          liveSession.sendRealtimeInput({
            text: msg.text,
          });
        }
      } catch {
        // Ignore malformed frame
      }
    });

    clientWs.on('close', () => {
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // Ignore close error
        }
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`CofreFoto server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
