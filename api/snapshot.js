// ============================================================================
// /api/snapshot — os dados do painel, guardados no próprio aplicativo.
// ----------------------------------------------------------------------------
// Antes, uma planilha enviada pela tela ficava só no navegador de quem enviou:
// outra pessoa abria o link e via o snapshot antigo. Aqui o envio passa a ser
// PUBLICADO — gravado no Vercel Blob do projeto — e vale para todo mundo, em
// qualquer máquina.
//
//   GET  /api/snapshot              -> os dados atuais (publicados ou, se nunca
//                                     ninguém publicou, o snapshot original de
//                                     /data/snapshot.json)
//   GET  /api/snapshot?historico=1  -> a lista de versões já publicadas
//   POST /api/snapshot              -> publica uma nova versão
//   POST /api/snapshot {restaurar}  -> volta para uma versão anterior
//
// Nada é apagado: cada publicação guarda a versão anterior em historico/, então
// dá para voltar atrás. Não há senha nem outra checagem de quem pode publicar —
// qualquer pessoa com o link do painel pode enviar uma nova versão (a pedido do
// usuário do projeto).
// ============================================================================
import { get, put, list, head } from '@vercel/blob';
import { gunzipSync } from 'node:zlib';

const ATUAL = 'snapshot.json';
const META = 'meta.json';
const HISTORICO = 'historico/';
const ACESSO = { access: 'private' };

function json(res, status, body, extraHeaders) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  Object.entries(extraHeaders || {}).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(body));
}

// O runtime da Vercel pode já ter lido o corpo por conta própria (req.body) —
// nesse caso o stream chega vazio. Aceita os dois caminhos.
async function lerCorpo(req, limiteBytes) {
  const pronto = req.body;
  if (pronto != null && pronto !== '') {
    if (Buffer.isBuffer(pronto)) return pronto;
    if (pronto instanceof Uint8Array) return Buffer.from(pronto);
    if (typeof pronto === 'string') return Buffer.from(pronto, 'utf8');
    return Buffer.from(JSON.stringify(pronto), 'utf8'); // veio já desserializado
  }
  const partes = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limiteBytes) throw new Error('corpo grande demais');
    partes.push(chunk);
  }
  return Buffer.concat(partes);
}

// O navegador manda o JSON compactado com gzip (CompressionStream) e em base64 —
// 800 KB de dados viram ~185 KB, bem abaixo do limite de corpo da função mesmo se
// a base de vendas crescer muito. base64 (e não binário puro) porque o corpo pode
// passar por camadas que tratam o payload como texto e corromperiam os bytes.
function corpoParaObjeto(buf, encoding) {
  let texto;
  if (encoding === 'gzip+base64') texto = gunzipSync(Buffer.from(buf.toString('utf8').trim(), 'base64')).toString('utf8');
  else if (encoding === 'gzip') texto = gunzipSync(buf).toString('utf8');
  else texto = buf.toString('utf8');
  return JSON.parse(texto);
}

function validarSnapshot(s) {
  if (!s || typeof s !== 'object') return 'o conteúdo enviado não é um objeto JSON';
  if (!s.sku || !Array.isArray(s.sku.rows)) return 'faltam os SKUs (sku.rows)';
  if (!s.cross || !Array.isArray(s.cross.rows)) return 'falta a base de clientes (cross.rows)';
  if (!Array.isArray(s.baseVendas)) return 'falta a base de vendas (baseVendas)';
  if (!Array.isArray(s.vendedores)) return 'falta a lista de vendedores';
  return null;
}

async function lerBlobTexto(pathname) {
  try {
    const r = await get(pathname, { ...ACESSO, useCache: false });
    if (!r || !r.stream) return null;
    const partes = [];
    for await (const chunk of r.stream) partes.push(chunk);
    return Buffer.concat(partes).toString('utf8');
  } catch (err) {
    if (err && (err.name === 'BlobNotFoundError' || /not found/i.test(err.message || ''))) return null;
    throw err;
  }
}

async function lerMeta() {
  const txt = await lerBlobTexto(META);
  if (!txt) return null;
  try { return JSON.parse(txt); } catch { return null; }
}

async function existeAtual() {
  try {
    await head(ATUAL, ACESSO);
    return true;
  } catch { return false; }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return await lidarGet(req, res);
    if (req.method === 'POST') return await lidarPost(req, res);
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { erro: 'método não suportado' });
  } catch (err) {
    console.error('[api/snapshot]', err);
    return json(res, 500, { erro: 'erro interno', detalhe: String((err && err.message) || err) });
  }
}

async function lidarGet(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (url.searchParams.get('historico') != null) {
    const [{ blobs }, meta] = await Promise.all([
      list({ ...ACESSO, prefix: HISTORICO, limit: 100 }),
      lerMeta(),
    ]);
    const versoes = blobs
      .map(b => ({ arquivo: b.pathname, tamanho: b.size, quando: b.uploadedAt }))
      .sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
    return json(res, 200, { atual: meta, versoes });
  }

  const conteudo = await lerBlobTexto(ATUAL);
  if (conteudo == null) {
    // Ninguém publicou nada ainda: o painel usa o snapshot original que veio
    // junto com o site. Redirect em vez de repassar o arquivo pela função.
    res.statusCode = 307;
    res.setHeader('Location', '/data/snapshot.json');
    res.setHeader('Cache-Control', 'no-store');
    return res.end();
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Meio termo: a CDN segura o arquivo por 30s (o painel abre rápido para todo
  // mundo) e quem acabou de publicar chama com ?fresh=... para furar o cache.
  res.setHeader('Cache-Control', url.searchParams.get('fresh') ? 'no-store' : 'public, max-age=0, s-maxage=30, stale-while-revalidate=120');
  const meta = await lerMeta();
  if (meta) res.setHeader('X-Painel-Publicado-Em', encodeURIComponent(meta.quando || ''));
  return res.end(conteudo);
}

async function lidarPost(req, res) {
  let corpo;
  try {
    const buf = await lerCorpo(req, 4 * 1024 * 1024);
    corpo = corpoParaObjeto(buf, String(req.headers['x-painel-encoding'] || ''));
  } catch (err) {
    return json(res, 413, { erro: 'Não consegui ler o conteúdo enviado: ' + ((err && err.message) || err) });
  }

  const agora = new Date().toISOString();

  // ---- restaurar uma versão anterior --------------------------------------
  if (corpo && corpo.restaurar) {
    const alvo = String(corpo.restaurar);
    if (!alvo.startsWith(HISTORICO)) return json(res, 400, { erro: 'versão inválida' });
    const texto = await lerBlobTexto(alvo);
    if (texto == null) return json(res, 404, { erro: 'essa versão não existe mais' });
    await arquivarAtual(agora);
    await put(ATUAL, texto, { ...ACESSO, contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
    const meta = { quando: agora, arquivo: alvo, tipo: 'restauracao', origem: alvo };
    await put(META, JSON.stringify(meta), { ...ACESSO, contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
    return json(res, 200, { ok: true, ...meta });
  }

  // ---- publicar uma versão nova -------------------------------------------
  const snapshot = corpo && corpo.snapshot;
  const problema = validarSnapshot(snapshot);
  if (problema) return json(res, 400, { erro: 'Conteúdo recusado: ' + problema });

  await arquivarAtual(agora);
  const texto = JSON.stringify(snapshot);
  await put(ATUAL, texto, { ...ACESSO, contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
  const meta = {
    quando: agora,
    arquivo: String((corpo && corpo.arquivo) || '').slice(0, 160) || 'planilha',
    tipo: String((corpo && corpo.tipo) || '').slice(0, 20) || 'planilha',
    tamanho: texto.length,
  };
  await put(META, JSON.stringify(meta), { ...ACESSO, contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
  return json(res, 200, { ok: true, ...meta });
}

// Guarda a versão que está no ar antes de sobrescrevê-la — nenhuma publicação
// apaga a anterior, sempre dá para voltar atrás.
async function arquivarAtual(agora) {
  if (!(await existeAtual())) return null;
  const texto = await lerBlobTexto(ATUAL);
  if (texto == null) return null;
  const nome = `${HISTORICO}${agora.replace(/[:.]/g, '-')}.json`;
  await put(nome, texto, { ...ACESSO, contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
  return nome;
}
