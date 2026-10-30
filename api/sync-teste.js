// /api/sync-teste — diagnóstico (somente leitura) da conexão do Vercel com o banco Flexx.
// Protegido pela chave SYNC_SECRET (cabeçalho x-sync-secret). Não grava nada em lugar nenhum:
// só devolve contagens e totais de vendas por força comercial, para comparar com a planilha.
import { conectar, sql, sqlVendas, COLUNAS_RESUMO, AGRUPAR_RESUMO, GRUPOS, SETORES_VAREJO } from './_flexx.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body, null, 1));
}

export default async function handler(req, res) {
  const chave = process.env.SYNC_SECRET;
  if (!chave || req.headers['x-sync-secret'] !== chave) return json(res, 401, { erro: 'não autorizado' });
  const inicio = Date.now();
  try {
    const url = new URL(req.url, 'http://localhost');
    const de = url.searchParams.get('de') || '2026-10-01', ate = url.searchParams.get('ate') || '2026-10-31';
    const pool = await conectar();
    const tConexao = Date.now() - inicio;
    const agora = (await pool.request().query('SELECT GETDATE() AS agora')).recordset[0].agora;
    const resultado = {};
    for (const [nome, grupo] of Object.entries(GRUPOS)) {
      const filtroSetor = nome === 'VAREJO' ? ` AND (IBETPDD.CODMTCEPG In (${SETORES_VAREJO}))` : '';
      const consulta = `SELECT COUNT(*) AS linhas, SUM(FATURAMENTO) AS fat, MAX(DATA_PEDIDO) AS ultima FROM (${sqlVendas(COLUNAS_RESUMO)}${filtroSetor} ${AGRUPAR_RESUMO}) t`;
      const t = Date.now();
      const r = await pool.request().input('de', sql.DateTime, new Date(de + 'T00:00:00Z')).input('ate', sql.DateTime, new Date(ate + 'T23:59:59.997Z')).input('grupo', sql.Int, grupo).query(consulta);
      const linha = r.recordset[0];
      resultado[nome] = { linhas: linha.linhas, faturamento: linha.fat == null ? 0 : Number(Number(linha.fat).toFixed(2)), ultimaData: linha.ultima ? linha.ultima.toISOString().slice(0, 10) : null, ms: Date.now() - t };
    }
    await pool.close();
    // IP de saída do Vercel (útil se a FlagCloud precisar liberar o acesso por IP).
    let ipSaida = null;
    try { ipSaida = (await (await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(4000) })).json()).ip; } catch {}
    return json(res, 200, { ok: true, periodo: { de, ate }, servidorAgora: agora.toISOString().slice(0, 19), msConexao: tConexao, msTotal: Date.now() - inicio, ipSaida, resultado });
  } catch (err) {
    const msg = String((err && err.message) || err).replace(process.env.FLEXX_SQL_PASSWORD || '§', '***');
    return json(res, 500, { ok: false, erro: msg.slice(0, 400), codigo: err && err.code, msTotal: Date.now() - inicio });
  }
}
