// ============================================================================
// Acesso (SOMENTE LEITURA) ao banco Flexx da FlagCloud — o mesmo que a Microsoft Query
// da planilha "VENDAS DO FLEXX NPRO+BEBIDAS ONLINE" usa. As credenciais vêm das variáveis
// de ambiente do projeto no Vercel (FLEXX_SQL_*), nunca do código.
// ============================================================================
import sql from 'mssql';

export function configuracao() {
  const { FLEXX_SQL_HOST, FLEXX_SQL_USER, FLEXX_SQL_PASSWORD, FLEXX_SQL_DB } = process.env;
  if (!FLEXX_SQL_HOST || !FLEXX_SQL_USER || !FLEXX_SQL_PASSWORD || !FLEXX_SQL_DB) return null;
  return {
    server: FLEXX_SQL_HOST, user: FLEXX_SQL_USER, password: FLEXX_SQL_PASSWORD, database: FLEXX_SQL_DB, port: 1433,
    // O servidor (SQL Server 2019) aceita conexão sem criptografia, como a planilha; as datas do
    // banco são "relógio de parede" — useUTC mantém os mesmos dígitos de ida e volta.
    options: { encrypt: false, trustServerCertificate: true, useUTC: true, requestTimeout: 55000, connectTimeout: 15000 },
    pool: { max: 2, min: 0, idleTimeoutMillis: 5000 },
  };
}

export async function conectar() {
  const cfg = configuracao();
  if (!cfg) throw new Error('credenciais do banco não configuradas (FLEXX_SQL_*)');
  return new sql.ConnectionPool(cfg).connect();
}

// Força comercial (CODGPOCMZMRC): 2 = Varejo (só os setores da equipe 500), 3 = NPRO, 4 = Bebidas.
export const GRUPOS = { VAREJO: 2, NPRO: 3, BEBIDAS: 4 };
export const SETORES_VAREJO = '502,504,505,510,555';

// Mesma consulta das 3 abas "CONSULTA DE VENDAS <força> 2026" (CFOP 5102 = venda).
export function sqlVendas(colunas) {
  return `SELECT ${colunas}
FROM Flexx00120202.dbo.IBETCATITE IBETCATITE, Flexx00120202.dbo.IBETCET IBETCET, Flexx00120202.dbo.IBETFAMITE IBETFAMITE, Flexx00120202.dbo.IBETGPOITE IBETGPOITE, Flexx00120202.dbo.IBETITEPDD IBETITEPDD, Flexx00120202.dbo.IBETPDD IBETPDD
WHERE IBETITEPDD.CODPDD = IBETPDD.CODPDD AND IBETCATITE.CODCATITE = IBETITEPDD.CODCATITE AND IBETGPOITE.CODGPOITE = IBETCATITE.CODGPOITE AND IBETFAMITE.CODFAMITE = IBETCATITE.CODFAMITE AND IBETFAMITE.CODGPOITE = IBETCATITE.CODGPOITE AND IBETFAMITE.CODGPOITE = IBETGPOITE.CODGPOITE AND IBETCET.CODCET = IBETPDD.CODCET AND IBETCET.CODEMP = IBETCATITE.CODEMP AND IBETCET.CODEMP = IBETITEPDD.CODEMP AND IBETCET.CODEMP = IBETPDD.CODEMP AND ((IBETPDD.DATVSTPDD Between @de And @ate) AND (IBETPDD.INDSTUMVTPDD=$1) AND (IBETPDD.NUMDOCPDD>=0) AND (IBETCATITE.CODGPOCMZMRC=@grupo))`;
}
export const COLUNAS_RESUMO = `IBETPDD.CODMTCEPG AS SETOR, IBETCET.CODCET AS SOLD, IBETPDD.CODPDD AS PEDIDO, IBETPDD.DATVSTPDD AS DATA_PEDIDO, IBETITEPDD.CODCATITE AS SKU, Sum(IBETITEPDD.VALTOTITEPDD) AS FATURAMENTO, IBETITEPDD.QTDITEPDD AS UNIDADES, IBETPDD.NUMDOCPDD AS DOC`;
export const AGRUPAR_RESUMO = `GROUP BY IBETPDD.CODMTCEPG, IBETCET.CODCET, IBETPDD.CODPDD, IBETPDD.DATVSTPDD, IBETITEPDD.CODCATITE, IBETITEPDD.QTDITEPDD, IBETPDD.NUMDOCPDD, IBETCET.CODCFO HAVING (IBETCET.CODCFO=5102)`;

export { sql };
