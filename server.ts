import 'dotenv/config';
import { execFile } from 'node:child_process';
import express from 'express';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  compareCommitStatus,
  GITHUB_UPDATE_BRANCH,
  GITHUB_UPDATE_REPO,
  isValidGitSha,
} from './src/utils/updater.ts';
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

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPDATE_STATE_PATH = path.resolve(__dirname, '.cofrefoto-update-state.json');

const PORT = Number(process.env.PORT || 3000);
const LOCAL_PORT = 3030;
const isProduction = process.env.NODE_ENV === 'production';

async function fetchLatestGitHubCommit(): Promise<{
  sha: string;
  message: string;
  authorDate: string;
}> {
  const url = `https://api.github.com/repos/${GITHUB_UPDATE_REPO}/commits/${GITHUB_UPDATE_BRANCH}`;
  const resp = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'CofreFoto-Updater',
    },
  });
  if (!resp.ok) {
    throw new Error(`GitHub retornou HTTP ${resp.status} ao verificar ${GITHUB_UPDATE_REPO}.`);
  }
  const data = (await resp.json()) as {
    sha?: string;
    commit?: { message?: string; author?: { date?: string } };
  };
  if (!data.sha || !isValidGitSha(data.sha)) {
    throw new Error('Resposta inválida do GitHub: SHA ausente ou inválido.');
  }
  return {
    sha: data.sha.toLowerCase(),
    message: data.commit?.message ?? 'Atualização disponível',
    authorDate: data.commit?.author?.date ?? new Date().toISOString(),
  };
}

async function readInstalledSha(): Promise<string | null> {
  try {
    const raw = await fs.readFile(UPDATE_STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as { installedSha?: string };
    return parsed.installedSha && isValidGitSha(parsed.installedSha)
      ? parsed.installedSha.toLowerCase()
      : null;
  } catch {
    return null;
  }
}

async function writeInstalledSha(sha: string): Promise<void> {
  if (!isValidGitSha(sha)) {
    throw new Error('SHA inválido para gravação.');
  }
  await fs.writeFile(
    UPDATE_STATE_PATH,
    JSON.stringify({ installedSha: sha.toLowerCase(), updatedAt: new Date().toISOString() }, null, 2),
    'utf8'
  );
}

async function copyDirectorySafe(srcDir: string, destRoot: string): Promise<void> {
  const SKIP_TOP_LEVEL = new Set([
    '.env',
    '.git',
    'node_modules',
    'dist',
    '.cofrefoto-update-state.json',
    '.playwright-cli',
  ]);

  async function walk(currentSrc: string, relBase: string) {
    const entries = await fs.readdir(currentSrc, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = relBase ? path.join(relBase, entry.name) : entry.name;
      const topSegment = relPath.split(path.sep)[0];
      if (SKIP_TOP_LEVEL.has(topSegment)) {
        continue;
      }

      const srcEntry = path.resolve(currentSrc, entry.name);
      const destEntry = path.resolve(destRoot, relPath);
      if (!destEntry.startsWith(destRoot + path.sep)) {
        throw new Error(`Caminho fora do diretório do aplicativo bloqueado: ${relPath}`);
      }

      if (entry.isDirectory()) {
        await fs.mkdir(destEntry, { recursive: true });
        await walk(srcEntry, relPath);
      } else if (entry.isFile()) {
        await fs.mkdir(path.dirname(destEntry), { recursive: true });
        await fs.copyFile(srcEntry, destEntry);
      }
    }
  }

  await walk(srcDir, '');
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
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

const smartSearchResultTool: FunctionDeclaration = {
  name: 'submitSmartSearchResult',
  description:
    'Retorna os IDs das mídias que correspondem à busca semântica, a categoria sugerida e uma breve explicação em português.',
  behavior: Behavior.NON_BLOCKING,
  parameters: {
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
    required: ['matchedIds', 'suggestedCluster', 'explanation'],
  },
};

const mediaAnalysisResultTool: FunctionDeclaration = {
  name: 'submitMediaAnalysis',
  description:
    'Registra a classificação completa de uma foto ou vídeo enviado para catalogação automática no cofre.',
  behavior: Behavior.NON_BLOCKING,
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      cluster: {
        type: Type.STRING,
        description: 'Exatamente um de: festas, ar_livre, viagens, familia, nsfw_18',
      },
      tags: { type: Type.ARRAY, items: { type: Type.STRING } },
      isNsfw18Plus: { type: Type.BOOLEAN },
      nsfwScore: { type: Type.NUMBER },
      locationGuess: { type: Type.STRING },
    },
    required: ['title', 'cluster', 'tags', 'isNsfw18Plus', 'nsfwScore'],
  },
};

const batchCatalogItemTool: FunctionDeclaration = {
  name: 'submitBatchCatalogItem',
  description:
    'Registra categoria, tags e classificação de segurança 18+ para uma mídia do lote de catalogação.',
  behavior: Behavior.NON_BLOCKING,
  parameters: {
    type: Type.OBJECT,
    properties: {
      cluster: {
        type: Type.STRING,
        description: 'Um de: festas, ar_livre, viagens, familia, nsfw_18',
      },
      tags: { type: Type.ARRAY, items: { type: Type.STRING } },
      isNsfw18Plus: { type: Type.BOOLEAN },
      nsfwScore: { type: Type.NUMBER },
    },
    required: ['cluster', 'tags', 'isNsfw18Plus', 'nsfwScore'],
  },
};

async function executeLiveToolAttempt<T extends Record<string, unknown>>(params: {
  ai: GoogleGenAI;
  model: 'gemini-3.8-live-extended-thinking' | 'gemini-3.8-live';
  useExtendedThinking: boolean;
  systemInstruction: string;
  toolDeclaration: FunctionDeclaration;
  promptText: string;
  imageInput?: { data: string; mimeType: string };
  timeoutMs?: number;
}): Promise<{ args: T; modelUsed: string }> {
  const {
    ai,
    model,
    useExtendedThinking,
    systemInstruction,
    toolDeclaration,
    promptText,
    imageInput,
    timeoutMs = 12000,
  } = params;

  return new Promise<{ args: T; modelUsed: string }>((resolve, reject) => {
    let settled = false;
    let session: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
    let transcriptBuffer = '';

    const finish = (err: Error | null, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (session) {
        try {
          session.close();
        } catch {
          // Ignore close errors
        }
      }
      if (err) {
        reject(err);
      } else if (value !== undefined) {
        resolve({ args: value, modelUsed: model });
      } else {
        reject(new Error(`Sessão ${model} encerrada sem resposta estruturada.`));
      }
    };

    const timer = setTimeout(() => {
      finish(new Error(`Tempo limite excedido (${timeoutMs}ms) no modelo ${model}.`));
    }, timeoutMs);

    ai.live
      .connect({
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          ...(useExtendedThinking
            ? {
                thinkingConfig: {
                  thinkingLevel: ThinkingLevel.HIGH,
                },
              }
            : {}),
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: [toolDeclaration] }],
          systemInstruction,
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const content = message.serverContent;
            if (content?.outputTranscription?.text) {
              transcriptBuffer += content.outputTranscription.text;
            }

            for (const call of message.toolCall?.functionCalls ?? []) {
              if (call.name === toolDeclaration.name) {
                try {
                  session?.sendToolResponse({
                    functionResponses: [
                      {
                        id: call.id,
                        name: call.name,
                        response: { ok: true },
                        scheduling: FunctionResponseScheduling.SILENT,
                      },
                    ],
                  });
                } catch {
                  // Ignore tool response send failure before close
                }
                finish(null, (call.args ?? {}) as T);
                return;
              }
            }

            if (content?.interactionStatus === InteractionStatus.IDLE && !settled) {
              const jsonMatch = transcriptBuffer.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try {
                  const parsed = JSON.parse(jsonMatch[0]) as T;
                  finish(null, parsed);
                  return;
                } catch {
                  // Fall through to error
                }
              }
              finish(
                new Error(
                  `Modelo ${model} concluiu a interação sem chamar ${toolDeclaration.name}.`
                )
              );
            }
          },
          onerror: (err: { message?: string; error?: { message?: string } }) => {
            const msg =
              err?.message?.trim() ||
              err?.error?.message?.trim() ||
              `Erro na sessão ${model}.`;
            finish(new Error(msg));
          },
          onclose: (event?: { code?: number; reason?: string }) => {
            if (!settled) {
              const detail = event?.reason
                ? ` (${event.code ?? ''} ${event.reason})`
                : event?.code
                  ? ` (código ${event.code})`
                  : '';
              finish(new Error(`Conexão ${model} fechada antes da conclusão${detail}.`));
            }
          },
        },
      })
      .then((connectedSession) => {
        if (settled) {
          try {
            connectedSession.close();
          } catch {
            // Ignore close errors
          }
          return;
        }
        session = connectedSession;
        const parts: Array<
          | { inlineData: { data: string; mimeType: string } }
          | { text: string }
        > = [];
        if (imageInput && imageInput.mimeType.startsWith('image/')) {
          parts.push({
            inlineData: {
              data: imageInput.data,
              mimeType: imageInput.mimeType,
            },
          });
        }
        parts.push({ text: promptText });
        connectedSession.sendClientContent({
          turns: [{ role: 'user', parts }],
          turnComplete: true,
        });
      })
      .catch((connectErr) => {
        const msg =
          connectErr instanceof Error && connectErr.message.trim()
            ? connectErr.message
            : `Falha ao conectar ao modelo ${model}.`;
        finish(new Error(msg));
      });
  });
}

async function runLiveToolWithFallback<T extends Record<string, unknown>>(params: {
  ai: GoogleGenAI;
  systemInstruction: string;
  toolDeclaration: FunctionDeclaration;
  promptText: string;
  imageInput?: { data: string; mimeType: string };
}): Promise<{ args: T; modelUsed: string }> {
  try {
    return await executeLiveToolAttempt<T>({
      ...params,
      model: 'gemini-3.8-live-extended-thinking',
      useExtendedThinking: true,
      timeoutMs: 10000,
    });
  } catch (primaryErr) {
    console.warn(
      'gemini-3.8-live-extended-thinking unavailable, falling back to gemini-3.8-live:',
      primaryErr instanceof Error ? primaryErr.message : primaryErr
    );
    return await executeLiveToolAttempt<T>({
      ...params,
      model: 'gemini-3.8-live',
      useExtendedThinking: false,
      timeoutMs: 15000,
    });
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

      const { args, modelUsed } = await runLiveToolWithFallback<{
        matchedIds?: string[];
        suggestedCluster?: string;
        explanation?: string;
      }>({
        ai,
        systemInstruction:
          'Você é o motor de busca semântica do CofreFoto. Analise a consulta do usuário em português e chame imediatamente a função submitSmartSearchResult com os IDs correspondentes, a categoria sugerida e uma breve explicação.',
        toolDeclaration: smartSearchResultTool,
        promptText: `Analise a consulta e selecione apenas os IDs do catálogo que correspondem à intenção (incluindo datas, locais, pessoas/rostos, tipo de mídia, festas, ar livre, viagens, família ou conteúdo 18+ NSFW). Chame submitSmartSearchResult obrigatoriamente.

Consulta: "${query}"

Catálogo:
${JSON.stringify(catalog.slice(0, 60))}`,
      });

      res.json({
        matchedIds: Array.isArray(args.matchedIds) ? args.matchedIds : [],
        suggestedCluster:
          typeof args.suggestedCluster === 'string' ? args.suggestedCluster : 'all',
        explanation: typeof args.explanation === 'string' ? args.explanation : '',
        modelUsed,
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

      const { args, modelUsed } = await runLiveToolWithFallback<{
        title?: string;
        cluster?: string;
        tags?: string[];
        isNsfw18Plus?: boolean;
        nsfwScore?: number;
        locationGuess?: string;
      }>({
        ai,
        systemInstruction:
          'Você é o classificador visual do CofreFoto. Analise a mídia enviada e invoque imediatamente submitMediaAnalysis com título em português, cluster, tags, detecção 18+ NSFW e local estimado.',
        toolDeclaration: mediaAnalysisResultTool,
        imageInput: { data: base64Data, mimeType },
        promptText: `Classifique esta foto ou vídeo (${fileName ?? 'arquivo'}, tipo ${mimeType}) para organização automática no cofre e chame submitMediaAnalysis com:
- title: título curto e descritivo em português
- cluster: exatamente um de ["festas", "ar_livre", "viagens", "familia", "nsfw_18"]
- tags: até 5 palavras-chave em português
- isNsfw18Plus: booleano true apenas se houver nudez explícita ou conteúdo adulto 18+
- nsfwScore: número entre 0 e 1
- locationGuess: cidade ou tipo de ambiente estimado`,
      });

      res.json({
        ...args,
        modelUsed,
      });
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
      const modelsUsed = new Set<string>();
      const assetsRoot = path.resolve(__dirname, 'src/assets/images');
      const eligibleItems = items.slice(0, 6).filter((item) =>
        item.thumbnailUrl.startsWith('/src/assets/images/')
      );

      for (let i = 0; i < eligibleItems.length; i += 3) {
        const chunk = eligibleItems.slice(i, i + 3);
        const chunkResults = await Promise.all(
          chunk.map(async (item) => {
            const safeRelative = item.thumbnailUrl.replace(/^\//, '');
            const resolved = path.resolve(__dirname, safeRelative);
            if (!resolved.startsWith(assetsRoot + path.sep)) {
              return null;
            }
            const bytes = await fs.readFile(resolved);
            const { args, modelUsed } = await runLiveToolWithFallback<{
              cluster?: string;
              tags?: string[];
              isNsfw18Plus?: boolean;
              nsfwScore?: number;
            }>({
              ai,
              systemInstruction:
                'Você é o catalogador visual do CofreFoto. Analise a imagem e invoque imediatamente submitBatchCatalogItem com cluster, tags e avaliação 18+ NSFW.',
              toolDeclaration: batchCatalogItemTool,
              imageInput: {
                data: bytes.toString('base64'),
                mimeType: 'image/jpeg',
              },
              promptText: `Analise esta imagem ("${item.title}") e chame submitBatchCatalogItem com: cluster (um de "festas", "ar_livre", "viagens", "familia", "nsfw_18"), tags (array com 4 tags em português), isNsfw18Plus (boolean) e nsfwScore (0 a 1).`,
            });
            modelsUsed.add(modelUsed);
            return {
              id: item.id,
              cluster: typeof args.cluster === 'string' ? args.cluster : 'ar_livre',
              tags: Array.isArray(args.tags) ? args.tags : [],
              isNsfw18Plus: Boolean(args.isNsfw18Plus),
              nsfwScore: typeof args.nsfwScore === 'number' ? args.nsfwScore : 0,
            };
          })
        );

        for (const entry of chunkResults) {
          if (entry) results.push(entry);
        }
      }

      res.json({
        results,
        modelUsed: Array.from(modelsUsed)[0] ?? 'gemini-3.8-live-extended-thinking',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro na catalogação automática.';
      res.status(500).json({ error: message });
    }
  });

  let viteInstance: { restart: () => Promise<void> } | null = null;
  const wssList: WebSocketServer[] = [];

  app.get('/api/system/update-status', async (_req, res) => {
    try {
      const remote = await fetchLatestGitHubCommit();
      let installedSha = await readInstalledSha();
      if (!installedSha) {
        await writeInstalledSha(remote.sha);
        installedSha = remote.sha;
      }

      const status = compareCommitStatus({
        installedSha,
        latestSha: remote.sha,
        latestMessage: remote.message,
        latestAuthorDate: remote.authorDate,
      });
      res.json(status);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao consultar atualizações no GitHub.';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/system/apply-update', async (req, res) => {
    const requestedWith = req.header('X-Requested-With');
    if (requestedWith !== 'CofreFoto-Updater') {
      res.status(403).json({ error: 'Cabeçalho de confirmação de origem ausente.' });
      return;
    }

    const { restartOnly } = (req.body ?? {}) as { restartOnly?: boolean };
    let tempDir: string | null = null;

    try {
      let installedSha = (await readInstalledSha()) ?? '';
      let dependenciesInstalled = false;
      let rebuilt = false;

      if (!restartOnly) {
        const remote = await fetchLatestGitHubCommit();
        const pkgBefore = await fs
          .readFile(path.resolve(__dirname, 'package.json'), 'utf8')
          .catch(() => '');

        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cofrefoto-update-'));
        const tarballPath = path.join(tempDir, 'repo.tar.gz');
        const extractDir = path.join(tempDir, 'extracted');
        await fs.mkdir(extractDir, { recursive: true });

        const tarballUrl = `https://api.github.com/repos/${GITHUB_UPDATE_REPO}/tarball/${remote.sha}`;
        const tarResp = await fetch(tarballUrl, {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'CofreFoto-Updater',
          },
        });
        if (!tarResp.ok) {
          throw new Error(`Falha ao baixar pacote do GitHub (HTTP ${tarResp.status}).`);
        }

        const tarBytes = new Uint8Array(await tarResp.arrayBuffer());
        await fs.writeFile(tarballPath, tarBytes);

        await execFileAsync(
          'tar',
          ['-xzf', tarballPath, '-C', extractDir, '--strip-components=1'],
          { shell: false }
        );

        await copyDirectorySafe(extractDir, __dirname);
        await writeInstalledSha(remote.sha);
        installedSha = remote.sha;

        const pkgAfter = await fs
          .readFile(path.resolve(__dirname, 'package.json'), 'utf8')
          .catch(() => '');

        if (pkgBefore !== pkgAfter) {
          await execFileAsync('npm', ['install', '--no-audit', '--no-fund'], {
            cwd: __dirname,
            shell: false,
          });
          dependenciesInstalled = true;
        }

        if (isProduction) {
          await execFileAsync('npm', ['run', 'build'], {
            cwd: __dirname,
            shell: false,
          });
          rebuilt = true;
        }
      }

      const restartedServices: string[] = [];
      if (wssList.length > 0) {
        for (const wsServer of wssList) {
          for (const client of wsServer.clients) {
            try {
              client.close(1012, 'Reinício dos serviços após atualização');
            } catch {
              // Ignore close error
            }
          }
        }
        restartedServices.push('Assistente Gemini Live WebSocket');
      }

      if (!restartOnly && viteInstance) {
        restartedServices.push('Servidor Vite Dev Middleware');
      } else if (!viteInstance) {
        restartedServices.push('Servidor Estático Express');
      }
      restartedServices.push('API Express e Sincronizador E2EE');

      res.json({
        ok: true,
        installedSha,
        dependenciesInstalled,
        rebuilt,
        restartedServices,
        completedAt: new Date().toISOString(),
      });

      if (!restartOnly && viteInstance) {
        const viteToRestart = viteInstance;
        setTimeout(() => {
          void viteToRestart.restart().catch((restartErr) => {
            console.warn('Falha ao reiniciar Vite após atualização:', restartErr);
          });
        }, 350);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao instalar atualização e reiniciar serviços.';
      res.status(500).json({ error: message });
    } finally {
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      }
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
    viteInstance = vite;
    app.use(vite.middlewares);
  }

  const attachLiveVaultWebSocket = (wss: WebSocketServer) => {
    wssList.push(wss);
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
  };

  const server = http.createServer(app);
  attachLiveVaultWebSocket(new WebSocketServer({ server, path: '/api/live-vault' }));

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`CofreFoto server running on http://0.0.0.0:${PORT}`);
  });

  if (PORT !== LOCAL_PORT) {
    const localServer = http.createServer(app);
    attachLiveVaultWebSocket(new WebSocketServer({ server: localServer, path: '/api/live-vault' }));
    localServer.on('error', (err) => {
      console.warn(`Não foi possível abrir porta adicional ${LOCAL_PORT}:`, err.message);
    });
    localServer.listen(LOCAL_PORT, '0.0.0.0', () => {
      console.log(`CofreFoto local listener running on http://localhost:${LOCAL_PORT}`);
    });
  }
}

startServer();
