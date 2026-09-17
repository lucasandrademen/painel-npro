
// Cadastro completo de produtos (Base de Produtos do FLEXX — Varejo + NPRO +
// Bebidas, ~6.500 SKUs), usado só como apoio para preencher Grupo/Família/
// Material quando um SKU não traz essa informação nas planilhas de Estoque ou
// Vendas enviadas (ex.: SKU em estoque que nunca teve venda no período). As
// quantidades de estoque desse arquivo NÃO são usadas — só o cadastro (SKU,
// Material, Grupo, Família), a pedido do usuário. É referência estática da
// página, nunca sobrescrita por um envio e nunca persistida no localStorage
// junto com DATA (evitaria inflar o armazenamento a cada atualização).
// Snapshot dos dados: na versão web (Vercel) ele deixa de vir embutido no HTML
// e passa a ser carregado de data/snapshot.json no boot (ver bootstrap no final
// deste arquivo). Continua 100% estático e público apenas para quem tem a URL —
// nenhum dado é enviado a lugar nenhum.
let DATA = null;

const PRODUTO_MASTER = new Map();
// Lista dos Grupos (DESGPOITE) do cadastro completo, na ordem de primeira
// aparição no arquivo original — usada pelo Mapa da Venda (visão por Grupo)
// para mostrar sempre o universo inteiro de grupos do cadastro, mesmo os que
// o cliente pesquisado nunca comprou (a pedido do usuário, igual à planilha).
const PRODUTO_MASTER_GRUPOS = [];
const _produtoMasterGruposSeen = new Set();
function initProdutoMaster(){
  PRODUTO_MASTER.clear(); PRODUTO_MASTER_GRUPOS.length = 0; _produtoMasterGruposSeen.clear();
  ((DATA.produtoMaster && DATA.produtoMaster.rows) || []).forEach(r => {
    PRODUTO_MASTER.set(String(r[0]), {material:r[1], grupo:r[2], familia:r[3]});
    if(r[2] && !_produtoMasterGruposSeen.has(r[2])){ _produtoMasterGruposSeen.add(r[2]); PRODUTO_MASTER_GRUPOS.push(r[2]); }
  });
  delete DATA.produtoMaster;
}

/* ============================== FORMATTERS ============================== */
const fmtInt = n => (n==null||isNaN(n)) ? "—" : Math.round(n).toLocaleString('pt-BR');
const fmtDec1 = n => (n==null||isNaN(n)) ? "—" : Number(n).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
const fmtDec2 = n => (n==null||isNaN(n)) ? "—" : Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtBRL = n => (n==null||isNaN(n)) ? "—" : "R$ " + Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtBRL0 = n => (n==null||isNaN(n)) ? "—" : "R$ " + Math.round(n).toLocaleString('pt-BR');
const fmtPct = n => (n==null||isNaN(n)) ? "—" : (n*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}) + "%";
const esc = s => (s==null) ? "" : String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-zA-Z0-9]+/g,'');

const STATUS_COLOR = {
  "Ruptura":"var(--critical)", "Crítico":"var(--critical)", "Atenção":"var(--warning)",
  "Saudável":"var(--good)", "Estoque Alto":"var(--stockhigh)", "Excesso":"var(--excess)", "Sem Giro":"var(--nogyro)"
};
const STATUS_ORDER = ["Ruptura","Crítico","Atenção","Saudável","Estoque Alto","Excesso","Sem Giro"];
const PRIORIDADE_COLOR = {"Alta":"var(--critical)","Média":"var(--warning)","Baixa":"var(--nogyro)","4 - Normal":"var(--good)","3 - Média":"var(--warning)","2 - Alta":"var(--critical)","1 - Crítica":"var(--critical)"};

function pill(value, extraClass){
  if(value==null || value==="") return "—";
  const cls = "pill-" + slug(value);
  return `<span class="pill ${cls} ${extraClass||''}">${esc(value)}</span>`;
}

/* ============================== TOOLTIP ============================== */
const tooltipEl = document.getElementById('tooltip');
function showTooltip(html, evt){
  tooltipEl.innerHTML = html;
  tooltipEl.classList.add('show');
  positionTooltip(evt);
}
function positionTooltip(evt){
  const pad = 14;
  let x = evt.clientX + pad, y = evt.clientY + pad;
  const rect = tooltipEl.getBoundingClientRect();
  if(x + rect.width > window.innerWidth - 8) x = evt.clientX - rect.width - pad;
  if(y + rect.height > window.innerHeight - 8) y = evt.clientY - rect.height - pad;
  tooltipEl.style.left = x + "px";
  tooltipEl.style.top = y + "px";
}
function hideTooltip(){ tooltipEl.classList.remove('show'); }

/* ============================== TABS ============================== */
const TABS = [
  {id:"dashboard", label:"Dashboard"},
  {id:"sku", label:"Estoque × SKU"},
  {id:"dde", label:"DDE"},
  {id:"risco", label:"Risco de Ruptura"},
  {id:"parado", label:"Estoque Parado"},
  {id:"giro", label:"Venda × Estoque"},
  {id:"cross", label:"Cross-sell"},
  {id:"cobertura", label:"Cobertura"},
  {id:"painel", label:"Painel Executivo"},
  {id:"mapa", label:"Mapa da Venda"},
];
function initTabs(){
  const nav = document.getElementById('tabnav');
  nav.innerHTML = TABS.map((t,i) => `<button class="tabbtn${i===0?' active':''}" data-tabid="${t.id}">${esc(t.label)}</button>`).join('');
  nav.querySelectorAll('.tabbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      nav.querySelectorAll('.tabbtn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tabpanel').forEach(p=>p.classList.remove('active'));
      document.querySelector(`.tabpanel[data-tab="${btn.dataset.tabid}"]`).classList.add('active');
      window.scrollTo({top:0, behavior:'instant' in window ? 'instant' : 'auto'});
    });
  });
}

/* ============================== PILL STYLES ============================== */
function pillHtml(text, bg, ink){
  if(text==null || text==="") return "—";
  return `<span class="pill" style="background:${bg}; color:${ink};">${esc(text)}</span>`;
}
const STATUS_STYLE = {
  "Ruptura": ["var(--critical-bg)","var(--critical-ink)"],
  "Crítico": ["var(--critical-bg)","var(--critical-ink)"],
  "Atenção": ["var(--warning-bg)","var(--warning-ink)"],
  "Saudável": ["var(--good-bg)","var(--good-ink)"],
  "Estoque Alto": ["var(--stockhigh-bg)","var(--stockhigh)"],
  "Excesso": ["var(--excess-bg)","var(--excess)"],
  "Sem Giro": ["var(--nogyro-bg)","var(--nogyro)"],
};
const PRIORIDADE_STYLE = {
  "Alta": ["var(--critical-bg)","var(--critical-ink)"],
  "Média": ["var(--warning-bg)","var(--warning-ink)"],
  "Baixa": ["var(--nogyro-bg)","var(--nogyro)"],
  "4 - Normal": ["var(--good-bg)","var(--good-ink)"],
  "3 - Média": ["var(--warning-bg)","var(--warning-ink)"],
  "2 - Alta": ["var(--critical-bg)","var(--critical-ink)"],
  "1 - Crítica": ["var(--critical-bg)","var(--critical-ink)"],
};
const SIMNAO_STYLE = { "Sim": ["var(--good-bg)","var(--good-ink)"], "Não": ["var(--nogyro-bg)","var(--nogyro)"] };
const OPORT_STYLE = {
  "NPRO": ["var(--good-bg)","var(--good-ink)"], "Bebidas": ["var(--accent-soft)","var(--accent)"],
  "Ambos": ["var(--good-bg)","var(--good-ink)"], "Nenhuma": ["var(--nogyro-bg)","var(--nogyro)"],
};
function statusPill(v){ const s=STATUS_STYLE[v]; return s? pillHtml(v,s[0],s[1]) : esc(v??"—"); }
function prioridadePill(v){ const s=PRIORIDADE_STYLE[v]; return s? pillHtml(v,s[0],s[1]) : esc(v??"—"); }
function simnaoPill(v){ const s=SIMNAO_STYLE[v]; return s? pillHtml(v,s[0],s[1]) : esc(v??"—"); }
function oportPill(v){
  if(v==null||v==="") return "—";
  for(const k in OPORT_STYLE){ if(String(v).indexOf(k)===0) return pillHtml(v, OPORT_STYLE[k][0], OPORT_STYLE[k][1]); }
  return pillHtml(v,"var(--nogyro-bg)","var(--nogyro)");
}

/* ============================== SKU MASTER LOOKUP ============================== */
// All of these are DERIVED from DATA. They are declared with `let` (not `const`)
// and rebuilt by rebuildDerived() — both once at page load and again whenever the
// person uploads a new workbook via the "Atualizar planilha" control (see the
// UPLOAD section near the end of this script).
let skuH, iSkuCode, iSkuMat, iSkuCat, iSkuGrp, iSkuFam, skuMeta;
let crossH, iCliVendedor, iCliRazao, iCliSold, iCliPrio;
let PROD_OPTS, CLI_OPTS;
let clienteMetaMap; // SOLD (string) -> {razaoSocial, vcode} — usado pelo Mapa da Venda

function uniqueSorted(rows, idx){
  const set = new Set();
  rows.forEach(r => { if(r[idx]!=null && r[idx]!=="") set.add(r[idx]); });
  return Array.from(set).sort((a,b)=> String(a).localeCompare(String(b),'pt-BR'));
}
const round2 = n => Math.round((n||0)*100)/100;
const round4 = n => Math.round((n||0)*10000)/10000;

/* ============================================================================
   MOTOR DE RECÁLCULO POR PERÍODO
   ----------------------------------------------------------------------------
   Tudo abaixo recalcula, inteiramente no navegador, os mesmos indicadores que
   o Excel calcula com fórmulas (SUMIFS/COUNTIFS/RANK sobre _Base_Vendas), só
   que para o intervalo de datas escolhido pela pessoa em vez do intervalo fixo
   gravado em _Parametros. Nenhum número é inventado: tudo vem das mesmas
   linhas de transação (DATA.baseVendas) exportadas do Excel/planilha enviada,
   e a lógica (faixas de DDE, classificação ABC, "1ª ocorrência SKU+Cliente",
   etc.) espelha exatamente as fórmulas de build_engine.py.
   ========================================================================= */
let skuMaster, clientMaster, baseVendasParsed;
const PERIOD = {};
const RISK_ATE = {critico:7, atencao:15, saudavel:30, alto:60};
const ABC_ATE = {a:0.8, b:0.95};
const PRIO_LABEL = {1:'1 - Crítica', 2:'2 - Alta', 3:'3 - Média', 4:'4 - Normal'};

function parseDateOnly(s){ return s ? Date.parse(s+'T00:00:00Z') : null; }
function fmtDateOnly(ms){ return new Date(ms).toISOString().slice(0,10); }

function buildStaticRegistries(){
  skuMaster = new Map();
  DATA.sku.rows.forEach(r => {
    skuMaster.set(String(r[iSkuCode]), {
      material:r[iSkuMat], categoria:r[iSkuCat], grupo:r[iSkuGrp], familia:r[iSkuFam],
      estoqueCx:r[skuH.indexOf('Estoque (Cx)')]||0,
    });
  });
  clientMaster = new Map();
  (DATA.cross.rows||[]).forEach(r => {
    const sold = r[iCliSold];
    if(sold==null || clientMaster.has(String(sold))) return;
    clientMaster.set(String(sold), {razaoSocial:r[iCliRazao], vendedor: r[iCliVendedor]!=null?String(r[iCliVendedor]):null});
  });
  baseVendasParsed = (DATA.baseVendas||[]).map(r => ({
    sold: r[0]!=null?String(r[0]):null, vendedor: r[1]!=null?String(r[1]):null, pedido: r[2], dateStr: r[3],
    dateMs: r[3] ? parseDateOnly(r[3]) : null, sku: r[4]!=null?String(r[4]):null,
    grupo: r[5], familia: r[6], origem: r[7], realizada: r[8]===1,
    fat: r[9]||0, unid: r[10]||0, cx: r[11]||0,
  }));
}

function initPeriodBounds(){
  let minMs=null, maxMs=null;
  baseVendasParsed.forEach(r => { if(r.dateMs!=null){ if(minMs===null||r.dateMs<minMs) minMs=r.dateMs; if(maxMs===null||r.dateMs>maxMs) maxMs=r.dateMs; } });
  const pad = DATA.periodoPadrao || {};
  const defStart = pad.inicio ? parseDateOnly(pad.inicio) : minMs;
  const defEnd = pad.fim ? parseDateOnly(pad.fim) : maxMs;
  PERIOD.minMs = minMs!=null ? Math.min(minMs, defStart??minMs) : defStart;
  PERIOD.maxMs = maxMs!=null ? Math.max(maxMs, defEnd??maxMs) : defEnd;
  PERIOD.startMs = defStart!=null ? defStart : PERIOD.minMs;
  PERIOD.endMs = defEnd!=null ? defEnd : PERIOD.maxMs;
  const elS = document.getElementById('period-start'), elE = document.getElementById('period-end');
  if(elS && elE && PERIOD.minMs!=null){
    elS.min = fmtDateOnly(PERIOD.minMs); elS.max = fmtDateOnly(PERIOD.maxMs);
    elE.min = fmtDateOnly(PERIOD.minMs); elE.max = fmtDateOnly(PERIOD.maxMs);
    elS.value = fmtDateOnly(PERIOD.startMs); elE.value = fmtDateOnly(PERIOD.endMs);
  }
  const note = document.getElementById('period-note');
  if(note) note.textContent = `dados disponíveis de ${fmtDateOnly(PERIOD.minMs)} a ${fmtDateOnly(PERIOD.maxMs)}`;
}

function computeAggregates(startMs, endMs){
  const diasPeriodo = Math.max(1, Math.round((endMs-startMs)/86400000) + 1);
  const bySku = new Map();       // sku -> {fat,unid,cx,clientSet,orderSet}
  const bySkuVendor = new Map(); // sku -> Map(vendorCode -> {fat,unid,cx})
  const byClient = new Map();    // sold -> {fatNpro,fatBeb,skuSet}
  const byGrupoClients = new Map();
  const byFamiliaClients = new Map();
  for(const row of baseVendasParsed){
    if(!row.realizada) continue;
    if(row.dateMs==null || row.dateMs<startMs || row.dateMs>endMs) continue;
    if(row.sku){
      let s = bySku.get(row.sku);
      if(!s){ s = {fat:0,unid:0,cx:0,clientSet:new Set(),orderSet:new Set()}; bySku.set(row.sku,s); }
      s.fat += row.fat; s.unid += row.unid; s.cx += row.cx;
      if(row.sold!=null) s.clientSet.add(row.sold);
      if(row.pedido!=null) s.orderSet.add(row.pedido);
      if(row.vendedor){
        let bv = bySkuVendor.get(row.sku); if(!bv){ bv = new Map(); bySkuVendor.set(row.sku, bv); }
        let vv = bv.get(row.vendedor); if(!vv){ vv = {fat:0,unid:0,cx:0}; bv.set(row.vendedor, vv); }
        vv.fat += row.fat; vv.unid += row.unid; vv.cx += row.cx;
      }
    }
    if(row.sold!=null){
      let c = byClient.get(row.sold);
      if(!c){ c = {fatNpro:0,fatBeb:0,skuSet:new Set()}; byClient.set(row.sold, c); }
      if(row.sku) c.skuSet.add(row.sku);
      if(row.origem==='NPRO') c.fatNpro += row.fat;
      else if(row.origem==='BEBIDAS') c.fatBeb += row.fat;
      if(row.grupo){ if(!byGrupoClients.has(row.grupo)) byGrupoClients.set(row.grupo, new Set()); byGrupoClients.get(row.grupo).add(row.sold); }
      if(row.familia){ if(!byFamiliaClients.has(row.familia)) byFamiliaClients.set(row.familia, new Set()); byFamiliaClients.get(row.familia).add(row.sold); }
    }
  }
  return {diasPeriodo, bySku, bySkuVendor, byClient, byGrupoClients, byFamiliaClients};
}

function buildSkuDerivedList(agg){
  // NOTA IMPORTANTE (motor em Caixas): o relatório de Estoque (SAP) só fornece
  // uma quantidade confiável em CAIXAS (RemPndDisp) para 100% do catálogo — não
  // existe fator de conversão Caixas→Unidades disponível para SKUs em estoque
  // que não tiveram nenhuma venda no arquivo de Vendas enviado. Por decisão do
  // usuário, todo o motor (Ruptura/DDE/Giro/participação) passou a trabalhar em
  // CAIXAS: onde antes se usava "unid"/"estoqueUnid", agora se usa "cx"/"estoqueCx".
  // "Unidades Vendidas" continua disponível como informação (vem direto da
  // planilha de Vendas, sem depender de nenhuma conversão), só não é mais usada
  // para calcular DDE/Giro/Ruptura.
  const diasPeriodo = agg.diasPeriodo;
  const list = [];
  for(const [skuCode, meta] of skuMaster.entries()){
    const s = agg.bySku.get(skuCode);
    const unid = s?s.unid:0, cx = s?s.cx:0, fat = s?s.fat:0;
    const clientesImpactados = s?s.clientSet.size:0;
    const estoqueCx = meta.estoqueCx;
    const mediaDiaria = cx / diasPeriodo;
    let dde=null, status;
    if(estoqueCx<=0 && cx>0){ status='Ruptura'; dde=0; }
    else if(mediaDiaria===0){ status='Sem Giro'; dde=null; }
    else {
      dde = estoqueCx/mediaDiaria;
      status = dde<=RISK_ATE.critico?'Crítico' : dde<=RISK_ATE.atencao?'Atenção' : dde<=RISK_ATE.saudavel?'Saudável' : dde<=RISK_ATE.alto?'Estoque Alto' : 'Excesso';
    }
    let giro;
    if(estoqueCx>0) giro = cx/estoqueCx;
    else giro = cx>0 ? null : 0;
    list.push({sku:skuCode, material:meta.material, categoria:meta.categoria, grupo:meta.grupo, familia:meta.familia,
      estoqueCx, unid, cx, fat, mediaDiaria, dde, status, giro, clientesImpactados});
  }
  list.forEach(o => { o.categoriaRisco = (o.status==='Ruptura'||o.status==='Crítico'||o.status==='Atenção') ? o.status : 'Saudável'; });
  const sortedByFat = list.slice().sort((a,b)=>b.fat-a.fat);
  const totalFat = sortedByFat.reduce((s,o)=>s+o.fat,0);
  let cum=0;
  sortedByFat.forEach((o,i) => { o.rank=i+1; cum+=o.fat; o.pctAcum = totalFat?cum/totalFat:0; o.abc = o.pctAcum<=ABC_ATE.a?'A':(o.pctAcum<=ABC_ATE.b?'B':'C'); o.participacaoVendas = totalFat?o.fat/totalFat:0; });
  const estByCat = {};
  list.forEach(o => { estByCat[o.categoria] = (estByCat[o.categoria]||0) + o.estoqueCx; });
  list.forEach(o => { o.participacaoEstoque = estByCat[o.categoria] ? o.estoqueCx/estByCat[o.categoria] : 0; });
  return list;
}

function buildClientDerivedList(agg){
  const list = [];
  for(const [sold, meta] of clientMaster.entries()){
    const c = agg.byClient.get(sold);
    const fatNpro = c?c.fatNpro:0, fatBeb = c?c.fatBeb:0;
    const qtdeSkus = c?c.skuSet.size:0;
    const compraNpro = fatNpro>0?'Sim':'Não', compraBeb = fatBeb>0?'Sim':'Não';
    let oport;
    if(compraNpro==='Sim' && compraBeb==='Não') oport='Bebidas';
    else if(compraNpro==='Não' && compraBeb==='Sim') oport='NPRO';
    else if(compraNpro==='Sim' && compraBeb==='Sim') oport='Nenhuma (já compra ambos)';
    else oport='Sem compras no período';
    list.push({sold, razaoSocial:meta.razaoSocial, vendedor:meta.vendedor, compraNpro, compraBeb, qtdeSkus, fatNpro, fatBeb, oport, fatTotal:fatNpro+fatBeb, prioridade:'-'});
  }
  const withOport = list.filter(o=>o.oport==='Bebidas'||o.oport==='NPRO');
  withOport.sort((a,b)=>b.fatTotal-a.fatTotal);
  withOport.forEach((o,i) => { o.rank=i+1; o.prioridade = o.rank<=10?'Alta':(o.rank<=30?'Média':'Baixa'); });
  return list;
}

function skuRowsFromList(list){ return list.map(o=>[o.sku,o.material,o.categoria,o.grupo,o.familia,o.estoqueCx,o.unid,round2(o.cx),round2(o.fat),o.mediaDiaria,o.dde,o.giro,o.status]); }
function buildDdeRows(list){ return list.map(o=>[o.sku,o.material,o.estoqueCx,o.mediaDiaria,o.dde,o.status,o.grupo,o.familia]); }
function buildRiscoRows(list){
  return list.map(o => {
    const rankNum = o.categoriaRisco==='Ruptura'?1:o.categoriaRisco==='Crítico'?2:o.categoriaRisco==='Atenção'?3:4;
    return [o.sku,o.material,o.estoqueCx,o.mediaDiaria,o.dde,o.categoriaRisco,o.clientesImpactados,round2(o.fat),PRIO_LABEL[rankNum]];
  });
}
function buildRiscoKpis(list){
  const risky = list.filter(o=>o.categoriaRisco==='Ruptura'||o.categoriaRisco==='Crítico');
  const riskySkuSet = new Set(risky.map(o=>o.sku));
  const clientSet = new Set(), orderSet = new Set();
  for(const row of baseVendasParsed){
    if(!row.realizada) continue;
    if(row.dateMs==null || row.dateMs<PERIOD.startMs || row.dateMs>PERIOD.endMs) continue;
    if(row.sku && riskySkuSet.has(row.sku)){
      if(row.sold!=null) clientSet.add(row.sold);
      if(row.pedido!=null) orderSet.add(row.pedido);
    }
  }
  return {
    ruptura: list.filter(o=>o.categoriaRisco==='Ruptura').length,
    criticos: list.filter(o=>o.categoriaRisco==='Crítico').length,
    caixas_risco: risky.reduce((s,o)=>s+o.estoqueCx,0),
    faturamento_impactado: risky.reduce((s,o)=>s+o.fat,0),
    clientes_impactados: clientSet.size,
    pedidos_impactados: orderSet.size,
  };
}
function acaoSugerida(o){
  if(!o.grupo) return 'Revisar cadastro';
  if(o.abc==='A') return 'Promoção / campanha de giro';
  if(o.abc==='B') return 'Combo com outro item';
  return 'Reduzir compra futura / ajuste de estoque';
}
function buildParadoRows(list){
  // "Estoque Parado" = SKU COM estoque atual e nenhuma venda no período (é o que
  // diz o título da aba). Um SKU sem giro e com estoque zerado não é estoque
  // parado — não há caixa nenhuma presa — e só inflaria a contagem de SKUs e as
  // linhas da tabela com registros de 0 cx. O status "Sem Giro" em si continua
  // inalterado nas demais abas (DDE, tabela de SKUs).
  return list.filter(o=>o.status==='Sem Giro' && o.estoqueCx>0).map(o=>[o.sku,o.material,o.grupo,o.familia,o.estoqueCx,'Sem histórico no período',o.participacaoEstoque,acaoSugerida(o)]);
}
function buildGiroRows(list){ return list.map(o=>[o.rank,o.sku,o.material,o.grupo,o.familia,round2(o.cx),o.estoqueCx,o.giro,round2(o.fat),o.participacaoVendas,o.abc]); }
function buildCrossRows(clientList){ return clientList.map(o=>[o.sold,o.razaoSocial,o.vendedor,o.compraNpro,o.compraBeb,o.qtdeSkus,round2(o.fatNpro),round2(o.fatBeb),o.oport,o.prioridade]); }
function buildCoberturaGrupoFamilia(agg, totalAtivos){
  function build(map){
    const out = [];
    for(const [key,set] of map.entries()) out.push([key, set.size, totalAtivos?set.size/totalAtivos:0]);
    return out;
  }
  return {grupo: build(agg.byGrupoClients), familia: build(agg.byFamiliaClients)};
}
function buildPainelKpis(skuList, clientList){
  return {
    estoque_total: skuList.reduce((s,o)=>s+o.estoqueCx,0),
    faturamento_total: skuList.reduce((s,o)=>s+o.fat,0),
    unidades_vendidas: skuList.reduce((s,o)=>s+o.unid,0),
    clientes_ativos: clientList.filter(o=>o.oport!=='Sem compras no período').length,
    skus_ruptura_critico: skuList.filter(o=>o.categoriaRisco==='Ruptura'||o.categoriaRisco==='Crítico').length,
    skus_excesso: skuList.filter(o=>o.status==='Excesso').length,
  };
}
function buildPainelCategoria(skuList){
  // Inclui "Varejo" só quando existem SKUs vendidos cujo Grupo não corresponde a
  // NPRO/BEBIDAS nas abas CATEGORIA NPRO/CATEGORIA BEBIDAS (ver parser de upload)
  // — sem isso, o total de Faturamento/Estoque/Unidades do Painel poderia divergir
  // silenciosamente da soma NPRO+BEBIDAS mostrada aqui.
  const cats = ['NPRO','BEBIDAS'];
  if(skuList.some(o=>o.categoria==='Varejo')) cats.push('Varejo');
  const rows = cats.map(cat => {
    const rs = skuList.filter(o=>o.categoria===cat);
    return [cat, rs.reduce((s,o)=>s+o.estoqueCx,0), rs.reduce((s,o)=>s+o.fat,0), rs.reduce((s,o)=>s+o.unid,0), 0];
  });
  const totalFat = rows.reduce((s,r)=>s+r[2],0);
  rows.forEach(r => { r[4] = totalFat ? r[2]/totalFat : 0; });
  return rows;
}
function buildPainelAlertas(skuList){
  const risky = skuList.filter(o=>o.categoriaRisco==='Ruptura'||o.categoriaRisco==='Crítico').slice().sort((a,b)=>(a.dde??0)-(b.dde??0));
  return risky.slice(0,5).map(o=>[o.sku,o.material,o.status,o.estoqueCx,o.dde,round2(o.fat)]);
}
function buildPainelOportunidades(clientList){
  const withOport = clientList.filter(o=>o.oport==='NPRO'||o.oport==='Bebidas').slice().sort((a,b)=>b.fatTotal-a.fatTotal);
  return withOport.slice(0,5).map(o=>[o.razaoSocial,o.vendedor,o.oport,o.prioridade,round2(o.fatTotal)]);
}
function buildDashboardAlertas(skuList, clientList){
  const ruptura = skuList.filter(o=>o.categoriaRisco==='Ruptura').length;
  const criticos = skuList.filter(o=>o.categoriaRisco==='Crítico').length;
  const semGiro = skuList.filter(o=>o.status==='Sem Giro').length;
  const oport = clientList.filter(o=>o.oport==='NPRO'||o.oport==='Bebidas').length;
  return [
    ['ALERTA', `${ruptura} SKU(s) em RUPTURA e ${criticos} em nível CRÍTICO — ver aba Risco de Ruptura.`],
    ['ATENÇÃO', `${semGiro} SKU(s) sem giro (estoque parado) — ver aba Estoque Parado.`],
    ['OPORTUNIDADE', `${oport} cliente(s) com oportunidade de cross-sell — ver aba Cross-sell NPRO x Bebidas.`],
  ];
}
function buildVendasSkuPivot(agg){
  const out = {};
  for(const [sku, vmap] of agg.bySkuVendor.entries()){
    const o = {};
    for(const [vend, v] of vmap.entries()) o[vend] = [round2(v.fat), v.unid, round4(v.cx)];
    out[sku] = o;
  }
  return out;
}

function recomputePeriod(){
  const agg = computeAggregates(PERIOD.startMs, PERIOD.endMs);
  const skuList = buildSkuDerivedList(agg);
  const clientList = buildClientDerivedList(agg);
  PERIOD.skuList = skuList; PERIOD.clientList = clientList;
  PERIOD.sku = {headers: DATA.sku.headers, rows: skuRowsFromList(skuList)};
  PERIOD.dde = {headers: DATA.dde.headers, rows: buildDdeRows(skuList)};
  PERIOD.risco = {headers: DATA.risco.headers, rows: buildRiscoRows(skuList), kpis: buildRiscoKpis(skuList)};
  PERIOD.parado = {headers: DATA.parado.headers, rows: buildParadoRows(skuList)};
  PERIOD.giro = {headers: DATA.giro.headers, rows: buildGiroRows(skuList)};
  PERIOD.cross = {headers: DATA.cross.headers, rows: buildCrossRows(clientList)};
  const totalAtivos = clientList.filter(o=>o.oport!=='Sem compras no período').length;
  PERIOD.clientesAtivosGlobal = totalAtivos;
  const gf = buildCoberturaGrupoFamilia(agg, totalAtivos);
  PERIOD.cobertura = {
    vendedor_headers: DATA.cobertura.vendedor_headers,
    grupo_headers: DATA.cobertura.grupo_headers, grupo: gf.grupo,
    familia_headers: DATA.cobertura.familia_headers, familia: gf.familia,
  };
  PERIOD.painel = {
    kpis: buildPainelKpis(skuList, clientList),
    categoria_headers: DATA.painel.categoria_headers, categoria: buildPainelCategoria(skuList),
    alertas_headers: DATA.painel.alertas_headers, alertas: buildPainelAlertas(skuList),
    oportunidades_headers: DATA.painel.oportunidades_headers, oportunidades: buildPainelOportunidades(clientList),
  };
  PERIOD.dashboard = {alertas: buildDashboardAlertas(skuList, clientList)};
  PERIOD.vendasSkuPivot = buildVendasSkuPivot(agg);
}

function initPeriodFilterUI(){
  const elS = document.getElementById('period-start'), elE = document.getElementById('period-end'), elR = document.getElementById('period-reset');
  if(!elS || elS.dataset.wired) return;
  function apply(){
    const sMs = parseDateOnly(elS.value), eMs = parseDateOnly(elE.value);
    if(sMs==null || eMs==null || sMs>eMs) return; // aguarda os dois campos ficarem válidos
    PERIOD.startMs = sMs; PERIOD.endMs = eMs;
    recomputePeriod();
    Object.values(RENDERERS).forEach(fn => fn());
  }
  elS.addEventListener('change', apply);
  elE.addEventListener('change', apply);
  if(elR) elR.addEventListener('click', () => { initPeriodBounds(); recomputePeriod(); Object.values(RENDERERS).forEach(fn=>fn()); });
  elS.dataset.wired = '1';
}

function rebuildDerived(){
  skuH = DATA.sku.headers;
  iSkuCode = skuH.indexOf('SKU'); iSkuMat = skuH.indexOf('Material'); iSkuCat = skuH.indexOf('Categoria');
  iSkuGrp = skuH.indexOf('Grupo'); iSkuFam = skuH.indexOf('Família');
  skuMeta = {};
  DATA.sku.rows.forEach(r => { skuMeta[r[iSkuCode]] = {categoria:r[iSkuCat], grupo:r[iSkuGrp], familia:r[iSkuFam], material:r[iSkuMat]}; });

  PROD_OPTS = {
    categoria: uniqueSorted(DATA.sku.rows, iSkuCat),
    grupo: uniqueSorted(DATA.sku.rows, iSkuGrp),
    familia: uniqueSorted(DATA.sku.rows, iSkuFam),
    sku: DATA.sku.rows.map(r=>({value:String(r[iSkuCode]), label:`${r[iSkuCode]} — ${r[iSkuMat]}`})).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR')),
  };
  crossH = DATA.cross.headers;
  iCliVendedor = crossH.indexOf('Vendedor'); iCliRazao = crossH.indexOf('Razão Social');
  iCliSold = crossH.indexOf('SOLD'); iCliPrio = crossH.indexOf('Prioridade');
  CLI_OPTS = {
    vendedor: DATA.vendedores || [],
    razaosocial: uniqueSorted(DATA.cross.rows, iCliRazao),
    sold: uniqueSorted(DATA.cross.rows, iCliSold).map(String),
    prioridade: ["Alta","Média","Baixa"],
  };

  clienteMetaMap = new Map();
  (DATA.clientes||[]).forEach(c => clienteMetaMap.set(String(c[0]), {razaoSocial:c[1], vcode:c[2]}));

  buildStaticRegistries();
  initPeriodBounds();
  recomputePeriod();
  initPeriodFilterUI();
}
// Se a pessoa já enviou uma planilha atualizada antes (neste navegador), usa
// esse snapshot em vez do publicado no site — assim a atualização sobrevive
// a um F5. Fica só no navegador dela; nada é enviado a lugar nenhum.
// (chamada no bootstrap, no final deste arquivo, depois que data/snapshot.json
// já foi carregado e PRODUTO_MASTER já foi montado a partir dele.)
function loadStoredSnapshotIfAny(){
  try {
    const stored = localStorage.getItem(LS_KEY);
    if(stored){
      const parsed = JSON.parse(stored);
      if(parsed && parsed.sku && parsed.cross) DATA = parsed;
    }
  } catch(e){ /* ignora e segue com o snapshot publicado */ }
}

function vendaSkuVals(skuCode, vendedor){
  // returns [faturamento, unidades, caixas] for that SKU under the vendedor filter,
  // recomputed for the currently selected date period (see PERIOD engine above).
  if(!vendedor || vendedor==='(Todos)') return null; // caller should use the row's own value
  const m = PERIOD.vendasSkuPivot[String(skuCode)];
  return (m && m[vendedor]) || [0,0,0];
}

/* ============================== FILTER STATE & BARS ============================== */
const filterState = {
  dashboard:{categoria:'(Todos)',grupo:'(Todos)',familia:'(Todos)',sku:'(Todos)',vendedor:'(Todos)',razaosocial:'(Todos)',sold:'(Todos)'},
  sku:{categoria:'(Todos)',grupo:'(Todos)',familia:'(Todos)',sku:'(Todos)',vendedor:'(Todos)'},
  dde:{categoria:'(Todos)',grupo:'(Todos)',familia:'(Todos)',sku:'(Todos)'},
  risco:{categoria:'(Todos)',grupo:'(Todos)',familia:'(Todos)',sku:'(Todos)',vendedor:'(Todos)'},
  parado:{categoria:'(Todos)',grupo:'(Todos)',familia:'(Todos)',sku:'(Todos)'},
  giro:{categoria:'(Todos)',grupo:'(Todos)',familia:'(Todos)',sku:'(Todos)',vendedor:'(Todos)'},
  cross:{vendedor:'(Todos)',razaosocial:'(Todos)',sold:'(Todos)',prioridade:'(Todos)'},
  cobertura:{vendedor:'(Todos)',razaosocial:'(Todos)',sold:'(Todos)'},
  painel:{vendedor:'(Todos)'},
};
const RENDERERS = {}; // tabId -> render function, filled in later
const TAB_BARS = {}; // tabId -> [{kind, barKey}, ...], filled in as bars are built

/* ---- Dependent/dynamic filter engine -------------------------------------
   As opções de cada dropdown deixam de vir de listas estáticas (PROD_OPTS/
   CLI_OPTS) e passam a ser recalculadas a cada mudança a partir de
   skuMaster/clientMaster/baseVendasParsed, considerando os DEMAIS filtros
   ativos na mesma aba (hasFields = campos que existem em filterState[tabId]).
   Isso é o equivalente a um applyFilters(data, filters, excludeField). */
const PROD_FIELDS = ['categoria','grupo','familia','sku'];
const CLI_FIELDS  = ['vendedor','razaosocial','sold'];
/* Ordem de especificidade (0=mais geral .. 6=mais específico). Um campo só é
   restringido por outro campo de rank MENOR (mais geral) que o seu — nunca
   pelo próprio nível ou por um nível mais específico. Isso é o que permite
   trocar Categoria diretamente (NPRO->BEBIDAS) mesmo com Grupo/Família ainda
   marcados com um valor antigo incompatível: Categoria (rank 0) nunca é
   restringida por Grupo/Família/SKU (ranks 1-3), então a opção continua
   disponível — e validateAndResetIncompatible cuida de limpar os filhos
   depois. Sem essa regra, o próprio dropdown do campo "pai" ficaria vazio
   para o valor que o usuário está tentando escolher (deadlock). */
const FIELD_RANK = {categoria:0, grupo:1, familia:2, sku:3, vendedor:4, razaosocial:5, sold:6};

function skuMatchesState(meta, state, hasFields, fieldKey){
  const fr = FIELD_RANK[fieldKey];
  for(const k of PROD_FIELDS){
    if(k===fieldKey || !hasFields.includes(k) || FIELD_RANK[k]>=fr) continue;
    const v = state[k];
    if(v==null || v==='(Todos)') continue;
    if(k==='sku'){ if(String(meta.skuCode)!==v) return false; }
    else if(meta[k]!==v) return false;
  }
  return true;
}
function cliMatchesState(meta, state, hasFields, fieldKey){
  const fr = FIELD_RANK[fieldKey];
  for(const k of CLI_FIELDS){
    if(k===fieldKey || !hasFields.includes(k) || FIELD_RANK[k]>=fr) continue;
    const v = state[k];
    if(v==null || v==='(Todos)') continue;
    if(k==='vendedor'){ if(meta.vendedor!==v) return false; }
    else if(k==='razaosocial'){ if(meta.razaoSocial!==v) return false; }
    else if(k==='sold'){ if(String(meta.sold)!==v) return false; }
  }
  return true;
}

/* Retorna os valores válidos (sem '(Todos)') para `fieldKey`, dado o estado
   atual dos DEMAIS filtros da aba (hasFields). Fonte de verdade: skuMaster
   (mantém SKUs sem venda visíveis, essencial p/ Estoque Parado) e
   clientMaster (mantém clientes sem venda visíveis), cruzados via
   baseVendasParsed quando a aba combina filtros de produto e de cliente. */
function computeFieldOptions(fieldKey, state, hasFields){
  if(fieldKey==='prioridade') return ['Alta','Média','Baixa'];
  const isProdField = PROD_FIELDS.includes(fieldKey);
  const isCliField = CLI_FIELDS.includes(fieldKey);
  if(!isProdField && !isCliField) return [];
  if(!skuMaster || !clientMaster) return []; // dados ainda não carregados

  const hasCliFields = CLI_FIELDS.some(k => hasFields.includes(k));
  const hasProdFields = PROD_FIELDS.some(k => hasFields.includes(k));
  const activeCliConstraints = CLI_FIELDS.some(k => hasFields.includes(k) && k!==fieldKey && state[k] && state[k]!=='(Todos)');
  const activeProdConstraints = PROD_FIELDS.some(k => hasFields.includes(k) && k!==fieldKey && state[k] && state[k]!=='(Todos)');

  let allowedSkuSet = null, allowedSoldSet = null;
  // Exceção explícita (Etapa 9): SKU também respeita Vendedor/Razão Social/SOLD
  // ativos, mesmo sendo uma relação cruzada de domínio — mas isso fica restrito
  // ao campo SKU. Categoria/Grupo/Família (ranks 0-2) NUNCA levam essa
  // restrição em conta, senão reproduziriam o mesmo deadlock do topo da
  // hierarquia, só que pelo lado do cliente (ex.: Vendedor só vendeu NPRO ->
  // Categoria ficaria travada em NPRO e BEBIDAS nunca apareceria de novo).
  if(fieldKey==='sku' && hasCliFields && activeCliConstraints){
    allowedSkuSet = new Set();
    for(const row of (baseVendasParsed||[])){
      if(!row.sku || !row.sold) continue;
      const cm = clientMaster.get(row.sold);
      const m = {vendedor: row.vendedor, razaoSocial: cm?cm.razaoSocial:null, sold: row.sold};
      if(!cliMatchesState(m, state, hasFields, fieldKey)) continue;
      allowedSkuSet.add(row.sku);
    }
  }
  if(isCliField && hasProdFields && activeProdConstraints){
    allowedSoldSet = new Set();
    for(const row of (baseVendasParsed||[])){
      if(!row.sold) continue;
      const sm = row.sku ? skuMaster.get(row.sku) : null;
      const m = {skuCode: row.sku, categoria: sm?sm.categoria:row.origem, grupo: sm?sm.grupo:row.grupo, familia: sm?sm.familia:row.familia};
      if(!skuMatchesState(m, state, hasFields, fieldKey)) continue;
      allowedSoldSet.add(row.sold);
    }
  }

  const set = new Set();
  if(isProdField){
    for(const [skuCode, meta] of skuMaster.entries()){
      const m = {skuCode, categoria:meta.categoria, grupo:meta.grupo, familia:meta.familia};
      if(!skuMatchesState(m, state, hasFields, fieldKey)) continue;
      if(allowedSkuSet && !allowedSkuSet.has(skuCode)) continue;
      if(fieldKey==='categoria') set.add(meta.categoria);
      else if(fieldKey==='grupo') set.add(meta.grupo);
      else if(fieldKey==='familia') set.add(meta.familia);
      else if(fieldKey==='sku') set.add(skuCode);
    }
  } else {
    for(const [sold, meta] of clientMaster.entries()){
      const m = {sold, vendedor:meta.vendedor, razaoSocial:meta.razaoSocial};
      if(!cliMatchesState(m, state, hasFields, fieldKey)) continue;
      if(allowedSoldSet && !allowedSoldSet.has(sold)) continue;
      if(fieldKey==='vendedor') set.add(meta.vendedor);
      else if(fieldKey==='razaosocial') set.add(meta.razaoSocial);
      else if(fieldKey==='sold') set.add(sold);
    }
  }
  return Array.from(set).filter(v => v!=null && v!=='').sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
}

/* Após qualquer mudança de filtro, invalida (reseta p/ '(Todos)') apenas os
   campos da mesma aba cuja seleção atual deixou de existir no universo
   compatível com os demais filtros — nunca reseta tudo, e nunca invalida o
   campo que acabou de ser alterado pelo usuário. Iteração até ponto fixo p/
   cobrir cascatas (Categoria muda -> Grupo cai -> Família cai -> SKU cai). */
function validateAndResetIncompatible(tabId, state, hasFields, changedKey){
  let changed = true, iterations = 0;
  while(changed && iterations < 10){
    changed = false; iterations++;
    for(const key of hasFields){
      if(key===changedKey || key==='prioridade') continue;
      const cur = state[key];
      if(cur==null || cur==='(Todos)') continue;
      const validSet = new Set(computeFieldOptions(key, state, hasFields).map(String));
      if(!validSet.has(String(cur))){ state[key] = '(Todos)'; changed = true; }
    }
  }
}

function fieldsForKind(kind, tabId){
  const state = filterState[tabId] || {};
  const hasFields = Object.keys(state);
  function opt(key){
    const raw = computeFieldOptions(key, state, hasFields);
    if(key==='sku'){
      const entries = raw.map(code => ({value:String(code), label:`${code} — ${(skuMaster && skuMaster.get(String(code)))?skuMaster.get(String(code)).material:''}`}));
      entries.sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
      return [{value:'(Todos)',label:'(Todos)'}, ...entries];
    }
    return ['(Todos)', ...raw];
  }
  if(kind==='prod') return [
    {key:'categoria', label:'Categoria', opts:opt('categoria')},
    {key:'grupo', label:'Grupo', opts:opt('grupo')},
    {key:'familia', label:'Família', opts:opt('familia')},
    {key:'sku', label:'SKU', opts:opt('sku')},
  ];
  if(kind==='prodvend') return fieldsForKind('prod', tabId).concat([
    {key:'vendedor', label:'Vendedor', opts:opt('vendedor')},
  ]);
  if(kind==='vendcli') return [
    {key:'vendedor', label:'Vendedor', opts:opt('vendedor')},
    {key:'razaosocial', label:'Razão Social', opts:opt('razaosocial')},
    {key:'sold', label:'Sold', opts:opt('sold')},
  ];
  if(kind==='painelvend') return [
    {key:'vendedor', label:'Vendedor', opts:opt('vendedor')},
  ];
  if(kind==='cli') return [
    {key:'vendedor', label:'Vendedor', opts:opt('vendedor')},
    {key:'razaosocial', label:'Razão Social', opts:opt('razaosocial')},
    {key:'sold', label:'Sold', opts:opt('sold')},
    {key:'prioridade', label:'Prioridade', opts:opt('prioridade')},
  ];
  // 'cli2'
  return [
    {key:'vendedor', label:'Vendedor', opts:opt('vendedor')},
    {key:'razaosocial', label:'Razão Social', opts:opt('razaosocial')},
    {key:'sold', label:'Sold', opts:opt('sold')},
  ];
}

// Reaproveitada pelo Relatório A4 (Etapa 10/38) — mesma lógica que monta os
// chips de filtro exibidos na tela, para nunca haver divergência entre o que
// a tela mostra e o que o PDF declara como "filtros aplicados".
function getActiveFilterChips(tabId){
  const state = filterState[tabId];
  const bars = TAB_BARS[tabId] || [];
  const seen = new Set();
  const chips = [];
  bars.forEach(b => fieldsForKind(b.kind, tabId).forEach(f => {
    if(seen.has(f.key)) return; seen.add(f.key);
    const v = state[f.key];
    if(v==null || v==='(Todos)') return;
    const opts = f.opts.map(o => typeof o==='string' ? {value:o,label:o} : o);
    const match = opts.find(o=>o.value===v);
    chips.push({key:f.key, label:f.label, value: match?match.label:v});
  }));
  return chips;
}

function renderFilterChips(tabId){
  const el = document.getElementById('chips-'+tabId);
  if(!el) return;
  const chips = getActiveFilterChips(tabId);
  if(!chips.length){ el.innerHTML=''; return; }
  el.innerHTML = chips.map(c => `<span class="chip">${esc(c.label)}: ${esc(c.value)}<button type="button" class="chip-x" data-chipkey="${esc(c.key)}" aria-label="Remover filtro de ${esc(c.label)}">×</button></span>`).join('');
  const state = filterState[tabId];
  const bars = TAB_BARS[tabId] || [];
  el.querySelectorAll('.chip-x').forEach(btn => {
    btn.addEventListener('click', () => {
      // Remover um chip só amplia o universo (volta p/ Todos) — nunca invalida outros campos.
      state[btn.dataset.chipkey] = '(Todos)';
      bars.forEach(b => buildFilterBar(tabId, b.kind, b.barKey, b.opts));
      renderFilterChips(tabId);
      if(RENDERERS[tabId]) RENDERERS[tabId]();
    });
  });
}

function buildFilterBar(tabId, kind, barKey, opts){
  opts = opts || {};
  barKey = barKey || kind;
  const el = document.querySelector(`.tabpanel[data-tab="${tabId}"] .filterbar[data-fbar="${barKey}"]`);
  if(!el) return;
  const already = (TAB_BARS[tabId] = TAB_BARS[tabId] || []).some(b => b.barKey===barKey);
  if(!already) TAB_BARS[tabId].push({kind, barKey, opts});
  const state = filterState[tabId];
  const fields = fieldsForKind(kind, tabId);
  el.innerHTML = fields.map(f => {
    const fopts = f.opts.map(o => typeof o==='string' ? {value:o,label:o} : o);
    const optsHtml = fopts.map(o => `<option value="${esc(o.value)}"${state[f.key]===o.value?' selected':''}>${esc(o.label)}</option>`).join('');
    return `<div><span class="flabel">${esc(f.label)}</span><select data-fkey="${f.key}">${optsHtml}</select></div>`;
  }).join('') + (opts.showReset===false ? '' : `<button class="filter-reset" type="button">Limpar filtros</button>`);
  el.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', () => {
      const key = sel.dataset.fkey;
      state[key] = sel.value;
      const hasFields = Object.keys(state);
      validateAndResetIncompatible(tabId, state, hasFields, key);
      (TAB_BARS[tabId]||[]).forEach(b => buildFilterBar(tabId, b.kind, b.barKey, b.opts));
      renderFilterChips(tabId);
      if(RENDERERS[tabId]) RENDERERS[tabId]();
    });
  });
  const resetBtn = el.querySelector('.filter-reset');
  if(resetBtn) resetBtn.addEventListener('click', () => {
    Object.keys(state).forEach(k => state[k]='(Todos)');
    (TAB_BARS[tabId]||[]).forEach(b => buildFilterBar(tabId, b.kind, b.barKey, b.opts));
    renderFilterChips(tabId);
    if(RENDERERS[tabId]) RENDERERS[tabId]();
  });
  renderFilterChips(tabId);
}

function matchesProd(state, {categoria, grupo, familia, skuCode}){
  if(state.categoria!=='(Todos)' && categoria!==state.categoria) return false;
  if(state.grupo!=='(Todos)' && grupo!==state.grupo) return false;
  if(state.familia!=='(Todos)' && familia!==state.familia) return false;
  if(state.sku!=='(Todos)' && String(skuCode)!==state.sku) return false;
  return true;
}
function rowMetaFromSku(skuCode){ return skuMeta[skuCode] || {categoria:null,grupo:null,familia:null}; }
function filterProdRows(rows, headers, state){
  const iSku = headers.indexOf('SKU');
  const iGrp = headers.indexOf('Grupo'), iFam = headers.indexOf('Família'), iCat = headers.indexOf('Categoria');
  return rows.filter(r => {
    const skuCode = r[iSku];
    const meta = rowMetaFromSku(skuCode);
    const categoria = iCat>=0 ? r[iCat] : meta.categoria;
    const grupo = iGrp>=0 ? r[iGrp] : meta.grupo;
    const familia = iFam>=0 ? r[iFam] : meta.familia;
    return matchesProd(state, {categoria, grupo, familia, skuCode});
  });
}
function filterCliRows(rows, headers, state, withPrioridade){
  const iVend = headers.indexOf('Vendedor'), iRazao = headers.indexOf('Razão Social'),
        iSold = headers.indexOf('SOLD'), iPrio = headers.indexOf('Prioridade');
  return rows.filter(r => {
    if(state.vendedor && state.vendedor!=='(Todos)' && r[iVend]!==state.vendedor) return false;
    if(state.razaosocial!=='(Todos)' && r[iRazao]!==state.razaosocial) return false;
    if(state.sold && state.sold!=='(Todos)' && String(r[iSold])!==state.sold) return false;
    if(withPrioridade && state.prioridade && state.prioridade!=='(Todos)' && r[iPrio]!==state.prioridade) return false;
    return true;
  });
}

/* ============================== KPI CARDS ============================== */
function renderKPIs(containerId, cards){
  const el = document.getElementById(containerId);
  el.innerHTML = cards.map(c => `
    <div class="kpi-card ${c.tone?'tone-'+c.tone:''}">
      <div class="kpi-label">${esc(c.label)}</div>
      <div class="kpi-value">${c.value}</div>
      ${c.note?`<div class="kpi-note">${esc(c.note)}</div>`:''}
    </div>`).join('');
  // Cache dos mesmos cards já calculados para reuso no Relatório A4 (Etapa 38 —
  // fonte única de verdade: o relatório nunca recalcula, só reaproveita este array.
  el._printCards = cards;
}

/* ============================== GENERIC TABLE ============================== */
function makeTable(containerId, opts){
  // opts: {headers:[{key,label,format,align,pill}], rows:[array-of-values matching original headers idx OR array of objects],
  //        getRow(row) -> object per header key, searchable:true, pageSize:15, defaultSort:{key,dir}}
  const container = document.getElementById(containerId);
  let sortKey = opts.defaultSort ? opts.defaultSort.key : null;
  let sortDir = opts.defaultSort ? opts.defaultSort.dir : 'desc';
  let search = '';
  let page = 0;
  const pageSize = opts.pageSize || 15;

  function getRows(ignoreSearch){
    let rows = opts.rows.map(opts.getRow);
    if(search && !ignoreSearch){
      const s = search.toLowerCase();
      rows = rows.filter(r => opts.headers.some(h => String(r[h.key]??'').toLowerCase().includes(s)));
    }
    if(sortKey){
      rows = rows.slice().sort((a,b) => {
        let av=a[sortKey], bv=b[sortKey];
        if(av==null) av = typeof bv==='number' ? -Infinity : '';
        if(bv==null) bv = typeof av==='number' ? -Infinity : '';
        let cmp;
        if(typeof av==='number' && typeof bv==='number') cmp = av-bv;
        else cmp = String(av).localeCompare(String(bv),'pt-BR');
        return sortDir==='asc' ? cmp : -cmp;
      });
    }
    return rows;
  }

  function render(){
    const allRows = getRows();
    // Snapshot COMPLETO (todos os registros filtrados, ignorando só a busca-texto
    // da tela e a paginação visual) para o Relatório A4 — Etapas 19/20/38: o PDF
    // nunca recebe apenas a página visível, e nunca recalcula por conta própria.
    container._printSnapshot = {headers: opts.headers, rows: getRows(true)};
    const totalPages = Math.max(1, Math.ceil(allRows.length/pageSize));
    if(page>=totalPages) page = totalPages-1;
    const pageRows = allRows.slice(page*pageSize, page*pageSize+pageSize);
    let html = '';
    if(opts.searchable!==false){
      html += `<div class="table-toolbar">
        <input class="search-box" type="text" placeholder="Buscar..." value="${esc(search)}">
        <span class="table-count">${allRows.length.toLocaleString('pt-BR')} registro${allRows.length===1?'':'s'}</span>
      </div>`;
    }
    html += `<div class="table-wrap"><table class="datatable"><thead><tr>`;
    opts.headers.forEach(h => {
      const arrow = sortKey===h.key ? (sortDir==='asc'?'▲':'▼') : '';
      html += `<th data-key="${h.key}" style="text-align:${h.align||'left'}">${esc(h.label)}<span class="arrow">${arrow}</span></th>`;
    });
    html += `</tr></thead><tbody>`;
    if(pageRows.length===0){
      html += `<tr><td colspan="${opts.headers.length}" style="text-align:center;color:var(--text-faint);padding:22px;">Nenhum registro para os filtros selecionados.</td></tr>`;
    }
    pageRows.forEach(r => {
      html += '<tr>';
      opts.headers.forEach(h => {
        const raw = r[h.key];
        const val = h.format ? h.format(raw, r) : esc(raw);
        html += `<td style="text-align:${h.align||'left'}">${val}</td>`;
      });
      html += '</tr>';
    });
    html += `</tbody></table></div>`;
    if(totalPages>1){
      html += `<div class="table-pager">
        <button data-pg="prev" ${page===0?'disabled':''}>&larr; Anterior</button>
        <span>Página ${page+1} de ${totalPages}</span>
        <button data-pg="next" ${page>=totalPages-1?'disabled':''}>Próxima &rarr;</button>
      </div>`;
    }
    // Antes de trocar o innerHTML, guarda se a busca estava em foco e onde o
    // cursor estava: sem isso o campo é destruído/recriado a cada tecla e a
    // pessoa só conseguia digitar uma letra por vez (o foco se perdia).
    const activeEl = document.activeElement;
    const searchHadFocus = !!(activeEl && activeEl.classList && activeEl.classList.contains('search-box') && container.contains(activeEl));
    const caretPos = searchHadFocus ? activeEl.selectionStart : null;
    container.innerHTML = html;
    const searchInput = container.querySelector('.search-box');
    if(searchInput) searchInput.addEventListener('input', e => { search = e.target.value; page=0; render(); });
    if(searchInput && searchHadFocus){
      searchInput.focus();
      const pos = caretPos==null ? searchInput.value.length : Math.min(caretPos, searchInput.value.length);
      try { searchInput.setSelectionRange(pos, pos); } catch(e){ /* input type sem seleção */ }
    }
    container.querySelectorAll('thead th').forEach(th => {
      th.addEventListener('click', () => {
        const k = th.dataset.key;
        if(sortKey===k) sortDir = sortDir==='asc'?'desc':'asc'; else { sortKey=k; sortDir='desc'; }
        render();
      });
    });
    const prevBtn = container.querySelector('[data-pg="prev"]'), nextBtn = container.querySelector('[data-pg="next"]');
    if(prevBtn) prevBtn.addEventListener('click', () => { page--; render(); });
    if(nextBtn) nextBtn.addEventListener('click', () => { page++; render(); });
  }
  render();
}

/* ============================== CHART: HORIZONTAL BAR LIST ============================== */
function hbarList(containerId, items, opts){
  // items: [{label, value, tooltip}], opts:{format, color}
  const format = opts && opts.format || fmtInt;
  const color = (opts && opts.color) || 'var(--accent)';
  const max = Math.max(1, ...items.map(i=>Math.abs(i.value||0)));
  const html = items.map(it => {
    const pct = Math.max(1.5, Math.abs(it.value||0)/max*100);
    return `<div class="hbar-row" data-tip="${esc(it.tooltip||it.label)}">
      <div class="hbar-label">${esc(it.label)}</div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%; background:${it.color||color};"></div></div>
      <div class="hbar-value num">${format(it.value)}</div>
    </div>`;
  }).join('');
  const el = document.getElementById(containerId);
  el.innerHTML = html || '<div style="color:var(--text-faint);font-size:12px;padding:10px 0;">Sem dados para os filtros selecionados.</div>';
  el.querySelectorAll('.hbar-row').forEach(row => {
    row.addEventListener('mousemove', e => showTooltip(`<b>${esc(row.dataset.tip)}</b>`, e));
    row.addEventListener('mouseleave', hideTooltip);
  });
}

/* ============================== CHART: VERTICAL BAR + AVG LINE ============================== */
function vbarChart(containerId, items, opts){
  // items: [{label, value, secondary}], opts:{format, secondaryFormat, avg, color, secondaryLabel}
  const el = document.getElementById(containerId);
  if(!items.length){ el.innerHTML = '<div style="color:var(--text-faint);font-size:12px;padding:10px 0;">Sem dados para os filtros selecionados.</div>'; return; }
  const format = (opts&&opts.format) || fmtInt;
  const color = (opts&&opts.color) || 'var(--accent)';
  const W = 640, H = 230, padL = 8, padR = 8, padT = 14, padB = 34;
  const n = items.length;
  const bw = (W-padL-padR)/n;
  const maxV = Math.max(1, ...items.map(i=>i.value||0));
  const barW = bw*0.56;
  let bars = '', labels = '';
  items.forEach((it,i) => {
    const x = padL + i*bw + (bw-barW)/2;
    const h = (H-padT-padB) * (it.value/maxV);
    const y = H-padB-h;
    bars += `<rect class="vbar" data-i="${i}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1,h).toFixed(1)}" rx="3" fill="${color}"></rect>`;
    labels += `<text x="${(x+barW/2).toFixed(1)}" y="${H-padB+15}" text-anchor="middle" font-size="9" fill="var(--text-muted)" transform="rotate(0)">${i+1}</text>`;
  });
  // NOTE: the secondary metric (e.g. average units sold) is intentionally NOT plotted on this
  // chart's axis -- it is a different unit/scale than the bars, and overlaying it as a reference
  // line would be a dual-axis chart (the classic chart anti-pattern). It is shown as a separate
  // stat line instead, and remains available per-bar in the hover tooltip.
  let avgNote = '';
  if(opts && opts.avg!=null){
    avgNote = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 10px;background:var(--surface-2);border-radius:6px;font-size:12px;">
      <span style="width:8px;height:8px;border-radius:50%;background:var(--warning);flex-shrink:0;"></span>
      <span style="color:var(--text-muted);">${esc(opts.secondaryLabel||'média')}:</span>
      <span style="font-weight:700;color:var(--text);font-variant-numeric:tabular-nums;">${(opts.secondaryFormat||fmtInt)(opts.avg)}</span>
    </div>`;
  }
  el.innerHTML = `${avgNote}<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:230px;" preserveAspectRatio="none">${bars}${labels}</svg>
    <div class="legend">${items.map((it,i)=>`<span class="legend-item"><span class="legend-dot" style="background:${color}"></span>${i+1}. ${esc(it.label.length>34?it.label.slice(0,34)+'…':it.label)}</span>`).join('')}</div>`;
  el.querySelectorAll('.vbar').forEach(bar => {
    const it = items[+bar.dataset.i];
    bar.addEventListener('mousemove', e => showTooltip(`<b>${esc(it.label)}</b>${format(it.value)}${it.secondary!=null?` · ${(opts.secondaryFormat||fmtInt)(it.secondary)} ${opts.secondaryUnitLabel||''}`:''}`, e));
    bar.addEventListener('mouseleave', hideTooltip);
  });
}

/* ============================== CHART: DONUT ============================== */
function donutChart(containerId, items, opts){
  // items: [{label, value, color}]
  const el = document.getElementById(containerId);
  const total = items.reduce((s,i)=>s+(i.value||0),0);
  if(!total){ el.innerHTML = '<div style="color:var(--text-faint);font-size:12px;padding:10px 0;">Sem dados.</div>'; return; }
  const format = (opts&&opts.format) || fmtBRL0;
  const cx=90, cy=90, r=64, rInner=40;
  let angle = -Math.PI/2;
  let paths = '';
  const segs = [];
  items.forEach((it,i) => {
    const frac = (it.value||0)/total;
    const a0 = angle, a1 = angle + frac*2*Math.PI;
    angle = a1;
    const x0=cx+r*Math.cos(a0), y0=cy+r*Math.sin(a0), x1=cx+r*Math.cos(a1), y1=cy+r*Math.sin(a1);
    const xi0=cx+rInner*Math.cos(a1), yi0=cy+rInner*Math.sin(a1), xi1=cx+rInner*Math.cos(a0), yi1=cy+rInner*Math.sin(a0);
    const large = (a1-a0) > Math.PI ? 1 : 0;
    const d = `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} L${xi0.toFixed(2)},${yi0.toFixed(2)} A${rInner},${rInner} 0 ${large} 0 ${xi1.toFixed(2)},${yi1.toFixed(2)} Z`;
    paths += `<path data-i="${i}" d="${d}" fill="${it.color}" stroke="var(--surface)" stroke-width="2"></path>`;
    segs.push({label:it.label, value:it.value, pct:frac});
  });
  el.innerHTML = `<div style="display:flex; align-items:center; gap:20px; flex-wrap:wrap;">
    <svg viewBox="0 0 180 180" style="width:180px;height:180px;flex-shrink:0;">${paths}
      <text x="90" y="86" text-anchor="middle" font-size="10" fill="var(--text-muted)" font-family="var(--font-body)">Total</text>
      <text x="90" y="102" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--text)" font-family="var(--font-display)">${format(total)}</text>
    </svg>
    <div class="legend" style="flex-direction:column; gap:8px;">
      ${items.map((it,i)=>`<span class="legend-item" data-i="${i}"><span class="legend-dot" style="background:${it.color}"></span><b style="color:var(--text);margin-right:5px;">${esc(it.label)}</b>${format(it.value)} (${(segs[i].pct*100).toFixed(1)}%)</span>`).join('')}
    </div></div>`;
  el.querySelectorAll('path[data-i]').forEach(p => {
    const i = +p.dataset.i;
    p.addEventListener('mousemove', e => showTooltip(`<b>${esc(items[i].label)}</b>${format(items[i].value)} (${(segs[i].pct*100).toFixed(1)}%)`, e));
    p.addEventListener('mouseleave', hideTooltip);
  });
}

/* ============================== CHART: HEATMAP GRID ============================== */
function heatGrid(containerId, rowLabels, colDefs, matrix, opts){
  // matrix[row][col] = 0..1 fraction; colDefs:[{label,key}]
  const el = document.getElementById(containerId);
  const format = (opts&&opts.format) || fmtPct;
  function colorFor(v){
    if(v==null || isNaN(v)) return 'var(--surface-3)';
    // sequential: light accent-soft -> accent
    const t = Math.max(0,Math.min(1,v));
    const light = [220,230,245], dark = [27,58,107]; // accent-soft-ish to accent
    const c = light.map((l,i)=>Math.round(l + (dark[i]-l)*t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function inkFor(v){ return v>0.55 ? '#fff' : 'var(--text)'; }
  let html = `<div class="heatgrid-wrap"><div class="heatgrid" style="grid-template-columns: 110px repeat(${colDefs.length}, 1fr);">`;
  html += `<div></div>` + colDefs.map(c=>`<div class="heat-collabel">${esc(c.label)}</div>`).join('');
  rowLabels.forEach((rl,ri) => {
    html += `<div class="heat-rowlabel">${esc(rl)}</div>`;
    colDefs.forEach((c,ci) => {
      const v = matrix[ri][ci];
      html += `<div class="heatcell" data-r="${ri}" data-c="${ci}" style="background:${colorFor(v)}; color:${inkFor(v)};">${v==null?'—':format(v)}</div>`;
    });
  });
  html += `</div></div>`;
  el.innerHTML = html;
  el.querySelectorAll('.heatcell').forEach(cell => {
    const ri=+cell.dataset.r, ci=+cell.dataset.c;
    cell.addEventListener('mousemove', e => showTooltip(`<b>${esc(rowLabels[ri])}</b>${esc(colDefs[ci].label)}: ${format(matrix[ri][ci])}`, e));
    cell.addEventListener('mouseleave', hideTooltip);
  });
}

/* ============================== TAB: DASHBOARD ============================== */
function renderDashboard(){
  const state = filterState.dashboard;
  const rowsAll = filterProdRows(PERIOD.sku.rows, skuH, state);
  const iEst=skuH.indexOf('Estoque (Cx)'), iFat=skuH.indexOf('Faturamento'), iUV=skuH.indexOf('Unid. Vendidas'), iStatus=skuH.indexOf('Status'), iCat=iSkuCat, iCod=iSkuCode;
  const vend = state.vendedor;
  // Faturamento/Unid. Vendidas: base (Estoque/Status) rows stay full; sales
  // columns are substituted per-SKU from the vendedor pivot when filtered.
  const fatOf = r => vend && vend!=='(Todos)' ? vendaSkuVals(r[iCod], vend)[0] : (r[iFat]||0);
  const uvOf  = r => vend && vend!=='(Todos)' ? vendaSkuVals(r[iCod], vend)[1] : (r[iUV]||0);
  const estoqueTotal = rowsAll.reduce((s,r)=>s+(r[iEst]||0),0);
  const faturamento = rowsAll.reduce((s,r)=>s+fatOf(r),0);
  const unidVendidas = rowsAll.reduce((s,r)=>s+uvOf(r),0);
  const skusRuptCrit = rowsAll.filter(r=>r[iStatus]==='Ruptura'||r[iStatus]==='Crítico').length;

  const cliState = state; // vendedor/razaosocial/sold live in the same per-tab state object
  const cliRows = filterCliRows(PERIOD.cross.rows, crossH, cliState, false);
  const iOportCli = crossH.indexOf('Oportunidade');
  const clientesAtivos = cliRows.filter(r=>r[iOportCli]!=='Sem compras no período').length;
  const oportunidadesCross = cliRows.filter(r=>r[iOportCli]==='NPRO'||r[iOportCli]==='Bebidas').length;

  renderKPIs('kpi-dashboard', [
    {label:'Estoque Total (Cx)', value:fmtDec1(estoqueTotal)},
    {label:'Faturamento no Período', value:fmtBRL0(faturamento)},
    {label:'Unidades Vendidas', value:fmtInt(unidVendidas)},
    {label:'Clientes Ativos no Período', value:fmtInt(clientesAtivos)},
    {label:'SKUs em Ruptura/Crítico', value:fmtInt(skusRuptCrit), tone: skusRuptCrit>0?'critical':'good'},
    {label:'Oportunidades de Cross-sell', value:fmtInt(oportunidadesCross), tone:'warning'},
  ]);

  // comparativo: filtered by grupo/familia/sku only (categoria filter doesn't apply to a per-origin table)
  const stateNoCat = {...state, categoria:'(Todos)'};
  const rowsCmp = filterProdRows(PERIOD.sku.rows, skuH, stateNoCat);
  const origem = {NPRO:{est:0,fat:0,uv:0}, BEBIDAS:{est:0,fat:0,uv:0}, Varejo:{est:0,fat:0,uv:0}};
  rowsCmp.forEach(r => { const o=r[iCat]; if(origem[o]){ origem[o].est+=r[iEst]||0; origem[o].fat+=fatOf(r); origem[o].uv+=uvOf(r); } });
  // "Varejo" = SKUs vendidos cujo Grupo não corresponde a NPRO/BEBIDAS nas abas
  // CATEGORIA NPRO/CATEGORIA BEBIDAS (ver parser de upload) — só aparece na tabela
  // quando existe algum, para que o total desta tabela sempre bata com os KPIs de
  // Faturamento/Estoque/Unidades acima.
  const temVarejo = origem.Varejo.est>0 || origem.Varejo.fat>0 || origem.Varejo.uv>0;
  const iCompraNPRO = crossH.indexOf('Compra NPRO'), iCompraBeb = crossH.indexOf('Compra Bebidas');
  const cliCount = {
    NPRO: cliRows.filter(r=>r[iCompraNPRO]==='Sim').length,
    BEBIDAS: cliRows.filter(r=>r[iCompraBeb]==='Sim').length,
    Varejo: null,
  };
  makeTable('table-dashboard-comparativo', {
    headers:[
      {key:'origem', label:'Origem'}, {key:'est', label:'Estoque (Cx)', align:'right', format:fmtDec1},
      {key:'fat', label:'Faturamento', align:'right', format:fmtBRL0}, {key:'uv', label:'Unid. Vendidas', align:'right', format:fmtInt},
      {key:'cli', label:'Clientes', align:'right', format:v=>v==null?'—':fmtInt(v)},
    ],
    rows: temVarejo ? ['NPRO','BEBIDAS','Varejo'] : ['NPRO','BEBIDAS'], searchable:false, pageSize:10,
    getRow:o => ({origem:o, est:origem[o].est, fat:origem[o].fat, uv:origem[o].uv, cli:cliCount[o]}),
  });

  // Alertas automáticos: recalculados aqui, a partir dos MESMOS rowsAll/cliRows
  // já filtrados acima para os cartões de KPI desta aba — nunca a partir da
  // base geral (PERIOD.dashboard.alertas), para que o texto sempre bata com os
  // números mostrados nos cartões logo acima.
  // Mesmo critério da aba Estoque Parado (status Sem Giro E com estoque em mãos),
  // para que o alerta não prometa um número de SKUs diferente do que a aba lista.
  const semGiroDash = rowsAll.filter(r=>r[iStatus]==='Sem Giro' && (r[iEst]||0)>0).length;
  const rupturaDash = rowsAll.filter(r=>r[iStatus]==='Ruptura').length;
  const criticosDash = rowsAll.filter(r=>r[iStatus]==='Crítico').length;
  const alertasDash = [
    ['ALERTA', `${rupturaDash} SKU(s) em RUPTURA e ${criticosDash} em nível CRÍTICO — ver aba Risco de Ruptura.`],
    ['ATENÇÃO', `${semGiroDash} SKU(s) sem giro (estoque parado) — ver aba Estoque Parado.`],
    ['OPORTUNIDADE', `${oportunidadesCross} cliente(s) com oportunidade de cross-sell — ver aba Cross-sell NPRO x Bebidas.`],
  ];
  document.getElementById('alerts-dashboard').innerHTML = alertasDash.map(([tag,msg]) => {
    const tone = tag==='ALERTA' ? ['var(--critical-bg)','var(--critical-ink)'] : tag==='ATENÇÃO' ? ['var(--warning-bg)','var(--warning-ink)'] : ['var(--accent-soft)','var(--accent)'];
    return `<div style="display:flex; gap:10px; padding:9px 0; border-bottom:1px solid var(--border);">
      <span class="pill" style="background:${tone[0]};color:${tone[1]};flex-shrink:0;">${esc(tag)}</span>
      <span style="font-size:12px;color:var(--text);">${esc(msg)}</span></div>`;
  }).join('');

  const top10 = rowsAll.slice().sort((a,b)=>fatOf(b)-fatOf(a)).slice(0,10);
  const avgUV = rowsAll.length ? unidVendidas/rowsAll.length : null;
  const iMat = skuH.indexOf('Material');
  vbarChart('chart-dashboard-top10', top10.map(r=>({label:r[iMat], value:fatOf(r), secondary:uvOf(r)})),
    {format:fmtBRL0, secondaryFormat:fmtInt, avg:avgUV, secondaryLabel:'Média de unidades vendidas entre os SKUs filtrados', secondaryUnitLabel:'unid. vendidas', color:'var(--accent)'});

  const donutSlices = [
    {label:'NPRO', value:origem.NPRO.fat, color:'var(--good)'},
    {label:'Bebidas', value:origem.BEBIDAS.fat, color:'var(--accent)'},
  ];
  if(temVarejo) donutSlices.push({label:'Varejo', value:origem.Varejo.fat, color:'var(--nogyro)'});
  donutChart('chart-dashboard-donut', donutSlices, {format:fmtBRL0});
}

/* ============================== TAB: SKU ============================== */
function renderSku(){
  const state = filterState.sku;
  const rowsBase = filterProdRows(PERIOD.sku.rows, skuH, state);
  const iEst=skuH.indexOf('Estoque (Cx)'), iFat=skuH.indexOf('Faturamento'), iUV=skuH.indexOf('Unid. Vendidas'),
        iCxV=skuH.indexOf('Cx Vendidas'), iDDE=skuH.indexOf('DDE'), iStatus=skuH.indexOf('Status'),
        iMat=skuH.indexOf('Material'), iCod=skuH.indexOf('SKU');
  const vend = state.vendedor;
  // Vendedor só afeta Unid. Vendidas/Cx Vendidas/Faturamento — Estoque/DDE/Giro/Status
  // permanecem os da base completa (o estoque em depósito não tem vendedor associado).
  const rows = (!vend || vend==='(Todos)') ? rowsBase : rowsBase.map(r=>{
    const v = vendaSkuVals(r[iCod], vend);
    const nr = r.slice();
    nr[iFat]=v[0]; nr[iUV]=v[1]; nr[iCxV]=v[2];
    return nr;
  });
  function argmax(rs, idx){ return rs.reduce((best,r)=> (best===null||r[idx]>best[idx]) ? r : best, null); }
  function argmin(rs, idx){ return rs.reduce((best,r)=> (best===null||r[idx]<best[idx]) ? r : best, null); }
  const maiorVenda = argmax(rows, iUV), maiorFat = argmax(rows, iFat), maiorEst = argmax(rows, iEst);
  const comGiro = rows.filter(r=>r[iStatus]!=='Sem Giro');
  const menorDDE = argmin(comGiro, iDDE), maiorDDE = argmax(rows, iDDE);
  renderKPIs('kpi-sku', [
    {label:'SKU c/ maior venda (unid.)', value: maiorVenda ? esc(maiorVenda[iMat]) : '—', note: maiorVenda?fmtInt(maiorVenda[iUV])+' unid.':''},
    {label:'SKU c/ maior faturamento', value: maiorFat ? esc(maiorFat[iMat]) : '—', note: maiorFat?fmtBRL0(maiorFat[iFat]):''},
    {label:'SKU c/ maior estoque (cx)', value: maiorEst ? esc(maiorEst[iMat]) : '—', note: maiorEst?fmtDec1(maiorEst[iEst])+' cx':''},
    {label:'Menor DDE (entre c/ giro)', value: menorDDE ? esc(menorDDE[iMat]) : '—', note: menorDDE?fmtDec1(menorDDE[iDDE])+' dias':''},
    {label:'Maior DDE', value: maiorDDE ? esc(maiorDDE[iMat]) : '—', note: maiorDDE?fmtDec1(maiorDDE[iDDE])+' dias':''},
  ]);
  const headers = skuH.map((h,i)=>({key:'c'+i, label:h,
    align: (i===iEst||i===iUV||i===skuH.indexOf('Cx Vendidas')||i===iFat||i===skuH.indexOf('Média Diária de Venda')||i===iDDE||i===skuH.indexOf('Giro')) ? 'right':'left',
    format: i===iFat ? fmtBRL : (i===iUV) ? fmtInt : (i===iEst||i===skuH.indexOf('Cx Vendidas')||i===skuH.indexOf('Média Diária de Venda')) ? fmtDec1 : (i===iDDE||i===skuH.indexOf('Giro')) ? fmtDec2 : (i===iStatus) ? (v=>statusPill(v)) : (v=>esc(v)),
  }));
  makeTable('table-sku', { headers, rows, getRow:r=>{ const o={}; r.forEach((v,i)=>o['c'+i]=v); return o; }, defaultSort:{key:'c'+iFat, dir:'desc'}, pageSize:20 });
}

/* ============================== TAB: DDE ============================== */
function renderDde(){
  const state = filterState.dde;
  const ddeH = PERIOD.dde.headers;
  const rows = filterProdRows(PERIOD.dde.rows, ddeH, state);
  const iEst=ddeH.indexOf('Estoque (Cx)'), iMedia=ddeH.indexOf('Média Diária'), iDDE=ddeH.indexOf('DDE'),
        iFaixa=ddeH.indexOf('Faixa'), iMat=ddeH.indexOf('Material');
  const comGiro = rows.filter(r=>r[iFaixa]!=='Sem Giro');
  const ddeVals = comGiro.map(r=>r[iDDE]).filter(v=>v!=null).sort((a,b)=>a-b);
  const media = ddeVals.length ? ddeVals.reduce((s,v)=>s+v,0)/ddeVals.length : null;
  const mediana = ddeVals.length ? (ddeVals.length%2 ? ddeVals[(ddeVals.length-1)/2] : (ddeVals[ddeVals.length/2-1]+ddeVals[ddeVals.length/2])/2) : null;
  const menor = ddeVals.length ? ddeVals[0] : null, maior = ddeVals.length ? ddeVals[ddeVals.length-1] : null;
  const semGiro = rows.filter(r=>r[iFaixa]==='Sem Giro').length;
  renderKPIs('kpi-dde', [
    {label:'DDE Médio (SKUs c/ giro)', value:fmtDec1(media)+' dias'},
    {label:'DDE Mediana (SKUs c/ giro)', value:fmtDec1(mediana)+' dias'},
    {label:'Menor DDE', value:fmtDec1(menor)+' dias'},
    {label:'Maior DDE', value:fmtDec1(maior)+' dias'},
    {label:'SKUs Sem Giro no período', value:fmtInt(semGiro), tone: semGiro>0?'warning':'good'},
  ]);
  const dist = STATUS_ORDER.map(faixa => ({label:faixa, value:rows.filter(r=>r[iFaixa]===faixa).length, color:(STATUS_STYLE[faixa]||[])[1] || 'var(--accent)'}));
  hbarList('chart-dde-dist', dist, {format:fmtInt});
  document.getElementById('dde-legend-explain').innerHTML = STATUS_ORDER.filter(s=>s!=='Estoque Alto'&&s!=='Excesso').concat(['Estoque Alto','Excesso']).map(s=>{
    const desc = {'Ruptura':'sem estoque, com histórico de venda','Crítico':'estoque muito baixo frente ao consumo','Atenção':'estoque abaixo do ideal','Saudável':'estoque em nível adequado','Estoque Alto':'estoque acima do ideal','Excesso':'estoque bem acima do consumo','Sem Giro':'nenhuma venda no período'}[s];
    return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:11.5px;">${statusPill(s)}<span style="color:var(--text-muted);">${esc(desc)}</span></div>`;
  }).join('');
  const headers = ddeH.map((h,i)=>({key:'c'+i, label:h,
    align:(i===iEst||i===iMedia||i===iDDE)?'right':'left',
    format: i===iEst?fmtDec1 : i===iMedia?fmtDec1 : i===iDDE?fmtDec1 : i===iFaixa?statusPill : (v=>esc(v)),
  }));
  makeTable('table-dde', { headers, rows, getRow:r=>{const o={}; r.forEach((v,i)=>o['c'+i]=v); return o;}, defaultSort:{key:'c'+iDDE, dir:'desc'}, pageSize:20 });
}

/* ============================== TAB: RISCO ============================== */
function renderRisco(){
  const state = filterState.risco;
  const rH = PERIOD.risco.headers;
  const rowsBase = filterProdRows(PERIOD.risco.rows, rH, state);
  const iEst=rH.indexOf('Estoque Atual'), iCat=rH.indexOf('Categoria de Risco'), iFat=rH.indexOf('Faturamento'), iPrio=rH.indexOf('Prioridade'), iMedia=rH.indexOf('Média Diária'), iDDE=rH.indexOf('DDE'), iSku=rH.indexOf('SKU');
  const vend = state.vendedor;
  // Vendedor só afeta a coluna Faturamento — Estoque/DDE/Categoria de Risco
  // (quais SKUs aparecem como Ruptura/Crítico) usam a base completa de vendas.
  const rows = (!vend || vend==='(Todos)') ? rowsBase : rowsBase.map(r=>{
    const nr = r.slice();
    nr[iFat] = vendaSkuVals(r[iSku], vend)[0];
    return nr;
  });
  const ruptura = rows.filter(r=>r[iCat]==='Ruptura');
  const criticos = rows.filter(r=>r[iCat]==='Crítico');
  const emRisco = ruptura.concat(criticos);
  const unidadesRisco = emRisco.reduce((s,r)=>s+(r[iEst]||0),0);
  const fatImpactado = emRisco.reduce((s,r)=>s+(r[iFat]||0),0);
  // Clientes/Pedidos Impactados: recalculados aqui a partir do MESMO recorte de
  // Categoria/Grupo/Família/SKU já aplicado acima (rowsBase/rows) — em vez do
  // PERIOD.risco.kpis estático (base completa). Vendedor continua sem afetar
  // este número, pois a regra já documentada é que Vendedor só ajusta a coluna
  // Faturamento; "impactado" aqui é por cliente/pedido, não por vendedor.
  const skuListProdFiltered = PERIOD.skuList.filter(o => matchesProd(state, {categoria:o.categoria, grupo:o.grupo, familia:o.familia, skuCode:o.sku}));
  const riscoKpisLive = buildRiscoKpis(skuListProdFiltered);
  renderKPIs('kpi-risco', [
    {label:'SKUs em Ruptura', value:fmtInt(ruptura.length), tone: ruptura.length>0?'critical':'good'},
    {label:'SKUs Críticos', value:fmtInt(criticos.length), tone: criticos.length>0?'warning':'good'},
    {label:'Caixas em Risco (Rupt.+Crít.)', value:fmtDec1(unidadesRisco)},
    {label:'Faturamento Pot. Impactado', value:fmtBRL0(fatImpactado), tone:'critical'},
    {label:'Clientes Impactados', value:fmtInt(riscoKpisLive.clientes_impactados), note:'não reage ao filtro de Vendedor'},
    {label:'Pedidos Impactados', value:fmtInt(riscoKpisLive.pedidos_impactados), note:'não reage ao filtro de Vendedor'},
  ]);
  document.getElementById('risco-methodology').innerHTML = "Metodologia: Ruptura = estoque zerado com venda no período (ou DDE=0). Crítico/Atenção seguem as faixas de DDE parametrizadas. Saudável agrupa também Estoque Alto, Excesso e Sem Giro (sem risco de falta). \"Clientes Impactados\" e \"Pedidos Impactados\" já reagem a Categoria/Grupo/Família/SKU, mas não reagem ao filtro de Vendedor (assim como a coluna Faturamento da tabela é o único dado desta aba afetado por Vendedor).";
  const headers = rH.map((h,i)=>({key:'c'+i, label:h,
    align:(i===iEst||i===iMedia||i===iDDE||i===iFat)?'right':'left',
    format: i===iFat?fmtBRL : i===iEst?fmtDec1 : i===iMedia?fmtDec1 : i===iDDE?fmtDec1 : i===iCat?statusPill : i===iPrio?prioridadePill : (v=>esc(v)),
  }));
  makeTable('table-risco', { headers, rows, getRow:r=>{const o={}; r.forEach((v,i)=>o['c'+i]=v); return o;}, defaultSort:{key:'c'+iFat, dir:'desc'}, pageSize:20 });
}

/* ============================== TAB: PARADO ============================== */
function renderParado(){
  const state = filterState.parado;
  const pH = PERIOD.parado.headers;
  const rows = filterProdRows(PERIOD.parado.rows, pH, state);
  const iEst=pH.indexOf('Estoque Atual (Cx)'), iGrp=pH.indexOf('Grupo'), iMat=pH.indexOf('Material'), iUltima=pH.indexOf('Última Venda no Período'), iPart=pH.indexOf('Participação no Estoque (Origem)'), iAcao=pH.indexOf('Ação Sugerida');
  const caixasParadas = rows.reduce((s,r)=>s+(r[iEst]||0),0);
  const iEstGeral = skuH.indexOf('Estoque (Cx)');
  const estoqueTotalGeral = PERIOD.sku.rows.reduce((s,r)=>s+(r[iEstGeral]||0),0);
  const pctParado = estoqueTotalGeral ? caixasParadas/estoqueTotalGeral : 0;
  const porGrupo = {};
  rows.forEach(r => { const g=r[iGrp]; porGrupo[g] = (porGrupo[g]||0) + (r[iEst]||0); });
  let grupoTop = null, grupoTopVal = -1;
  Object.entries(porGrupo).forEach(([g,v]) => { if(v>grupoTopVal){grupoTopVal=v; grupoTop=g;} });
  renderKPIs('kpi-parado', [
    {label:'SKUs sem Giro', value:fmtInt(rows.length), tone: rows.length>0?'warning':'good'},
    {label:'Caixas Paradas', value:fmtDec1(caixasParadas)},
    {label:'% do Estoque Total (geral) Parado', value:fmtPct(pctParado), note:'numerador considera o filtro; denominador é a base completa'},
    {label:'Grupo c/ mais Estoque Parado', value: grupoTop ? esc(grupoTop) : '—'},
  ]);
  const tblHeaders = pH.map((h,i)=>({key:'c'+i, label:h, align:(i===iEst||i===iPart)?'right':'left', format: i===iEst?fmtDec1 : i===iPart?fmtPct : (v=>esc(v))}));
  makeTable('table-parado', { headers:tblHeaders, rows, getRow:r=>{const o={}; r.forEach((v,i)=>o['c'+i]=v); return o;}, defaultSort:{key:'c'+iEst, dir:'desc'}, pageSize:20 });
}

/* ============================== TAB: GIRO ============================== */
function renderGiro(){
  const state = filterState.giro;
  const gH = PERIOD.giro.headers;
  const rowsBase = filterProdRows(PERIOD.giro.rows, gH, state);
  const iGiro=gH.indexOf('Giro'), iFat=gH.indexOf('Faturamento'), iMat=gH.indexOf('Material'), iABC=gH.indexOf('ABC'), iUV=gH.indexOf('Cx Vendidas'), iEstq=gH.indexOf('Estoque'), iPart=gH.indexOf('Participação nas Vendas'), iRank=gH.indexOf('Ranking (Fat.)'), iSku=gH.indexOf('SKU');
  const vend = state.vendedor;
  // Vendedor afeta Cx Vendidas/Faturamento/Participação — e o Índice
  // (Cx Vendidas ÷ Estoque) é recalculado com o Cx Vendidas já filtrado,
  // para nunca mostrar um Índice que não corresponda ao Cx Vendidas exibido
  // na mesma linha. Estoque continua sendo o total da empresa (não existe
  // "estoque por vendedor").
  const rows = (!vend || vend==='(Todos)') ? rowsBase : rowsBase.map(r=>{
    const v = vendaSkuVals(r[iSku], vend);
    const nr = r.slice();
    nr[iUV]=v[2]; nr[iFat]=v[0];
    const estq = r[iEstq];
    nr[iGiro] = estq>0 ? nr[iUV]/estq : (nr[iUV]>0 ? null : 0);
    return nr;
  });
  if(vend && vend!=='(Todos)'){
    const totalFatFiltrado = rows.reduce((s,r)=>s+(r[iFat]||0),0);
    rows.forEach(r => { r[iPart] = totalFatFiltrado ? (r[iFat]||0)/totalFatFiltrado : 0; });
  }
  const top10 = rows.slice().sort((a,b)=>(b[iGiro]||0)-(a[iGiro]||0)).slice(0,10);
  const comVenda = rows.filter(r=>(r[iGiro]||0)>0);
  const bottom10 = comVenda.slice().sort((a,b)=>(a[iGiro]||0)-(b[iGiro]||0)).slice(0,10);
  hbarList('chart-giro-top10', top10.map(r=>({label:r[iMat], value:r[iGiro], tooltip:`${r[iMat]} — Giro ${fmtDec2(r[iGiro])} · ${fmtBRL0(r[iFat])}`})), {format:fmtDec2, color:'var(--good)'});
  hbarList('chart-giro-bottom10', bottom10.map(r=>({label:r[iMat], value:r[iGiro], tooltip:`${r[iMat]} — Giro ${fmtDec2(r[iGiro])} · ${fmtBRL0(r[iFat])}`})), {format:fmtDec2, color:'var(--warning)'});
  const ABC_STYLE = {A:['var(--good-bg)','var(--good-ink)'], B:['var(--warning-bg)','var(--warning-ink)'], C:['var(--nogyro-bg)','var(--nogyro)']};
  function abcPill(v){ const s=ABC_STYLE[v]; return s?pillHtml(v,s[0],s[1]):esc(v??'—'); }
  const headers = gH.map((h,i)=>({key:'c'+i, label:h,
    align:(i===iGiro||i===iFat||i===iUV||i===iEstq||i===iPart||i===iRank)?'right':'left',
    format: i===iFat?fmtBRL : i===iGiro?fmtDec2 : i===iUV||i===iEstq?fmtDec1 : i===iPart?fmtPct : i===iABC?abcPill : (v=>esc(v)),
  }));
  makeTable('table-giro', { headers, rows, getRow:r=>{const o={}; r.forEach((v,i)=>o['c'+i]=v); return o;}, defaultSort:{key:'c'+iFat, dir:'desc'}, pageSize:20 });
}

/* ============================== TAB: CROSS-SELL ============================== */
function renderCross(){
  const state = filterState.cross;
  const cH = PERIOD.cross.headers;
  const rows = filterCliRows(PERIOD.cross.rows, cH, state, true);
  const iNPRO=cH.indexOf('Compra NPRO'), iBeb=cH.indexOf('Compra Bebidas'), iOport=cH.indexOf('Oportunidade'),
        iFatN=cH.indexOf('Faturamento NPRO'), iFatB=cH.indexOf('Faturamento Bebidas'), iPrio=cH.indexOf('Prioridade'), iRazao=iCliRazao;
  const ativos = rows.filter(r=>r[iOport]!=='Sem compras no período');
  const soNpro = ativos.filter(r=>r[iNPRO]==='Sim'&&r[iBeb]==='Não');
  const soBebidas = ativos.filter(r=>r[iNPRO]==='Não'&&r[iBeb]==='Sim');
  const ambos = ativos.filter(r=>r[iNPRO]==='Sim'&&r[iBeb]==='Sim');
  const oport = ativos.filter(r=>r[iOport]==='NPRO'||r[iOport]==='Bebidas');
  const fatOport = oport.reduce((s,r)=>s+(r[iFatN]||0)+(r[iFatB]||0),0);
  renderKPIs('kpi-cross', [
    {label:'Clientes Ativos no Período', value:fmtInt(ativos.length)},
    {label:'Só compram NPRO (oport. Bebidas)', value:fmtInt(soNpro.length), tone:'warning'},
    {label:'Só compram Bebidas (oport. NPRO)', value:fmtInt(soBebidas.length), tone:'warning'},
    {label:'Compram Ambos (cross-sell OK)', value:fmtInt(ambos.length), tone:'good'},
    {label:'Oportunidades de Cross-sell', value:fmtInt(oport.length), tone:'warning'},
    {label:'Faturamento dos Clientes c/ Oportunidade', value:fmtBRL0(fatOport)},
  ]);
  const headers = cH.map((h,i)=>({key:'c'+i, label:h,
    align:(i===cH.indexOf('Qtde SKUs Distintos')||i===iFatN||i===iFatB)?'right':'left',
    format: i===iFatN||i===iFatB?fmtBRL : i===iNPRO||i===iBeb?simnaoPill : i===iOport?oportPill : i===iPrio?prioridadePill : (v=>esc(v)),
  }));
  makeTable('table-cross', { headers, rows, getRow:r=>{const o={}; r.forEach((v,i)=>o['c'+i]=v); return o;}, defaultSort:{key:'c'+iFatN, dir:'desc'}, pageSize:20 });
}

/* ============================== TAB: COBERTURA ============================== */
function renderCobertura(){
  const state = filterState.cobertura;
  const cH = PERIOD.cross.headers;
  const rows = filterCliRows(PERIOD.cross.rows, cH, state, false);
  const iNPRO=cH.indexOf('Compra NPRO'), iBeb=cH.indexOf('Compra Bebidas'), iOport=cH.indexOf('Oportunidade'), iVendCli=cH.indexOf('Vendedor');
  const ativos = rows.filter(r=>r[iOport]!=='Sem compras no período');
  // Penetração: % dos clientes que JÁ COMPRARAM algo no período (denominador = ativos).
  const penNpro = ativos.length ? ativos.filter(r=>r[iNPRO]==='Sim').length/ativos.length : 0;
  const penBeb = ativos.length ? ativos.filter(r=>r[iBeb]==='Sim').length/ativos.length : 0;
  const penAmbas = ativos.length ? ativos.filter(r=>r[iNPRO]==='Sim'&&r[iBeb]==='Sim').length/ativos.length : 0;
  // Cobertura: % sobre o UNIVERSO TOTAL da carteira (cadastro completo em
  // _Base_Clientes — DATA.clientes — comprando ou não no período), respeitando
  // os mesmos filtros de Vendedor/Razão Social/Sold usados acima.
  const universo = (DATA.clientes||[]).filter(c => {
    const sold = c[0], razao = c[1], vcod = c[2]!=null?String(c[2]):null;
    if(state.vendedor && state.vendedor!=='(Todos)' && vcod!==state.vendedor) return false;
    if(state.razaosocial && state.razaosocial!=='(Todos)' && razao!==state.razaosocial) return false;
    if(state.sold && state.sold!=='(Todos)' && String(sold)!==state.sold) return false;
    return true;
  });
  const universoTotal = universo.length;
  const covNpro = universoTotal ? ativos.filter(r=>r[iNPRO]==='Sim').length/universoTotal : 0;
  const covBeb = universoTotal ? ativos.filter(r=>r[iBeb]==='Sim').length/universoTotal : 0;
  const covAmbas = universoTotal ? ativos.filter(r=>r[iNPRO]==='Sim'&&r[iBeb]==='Sim').length/universoTotal : 0;
  renderKPIs('kpi-cobertura', [
    {label:'Clientes Ativos no Período', value:fmtInt(ativos.length), note:`de ${fmtInt(universoTotal)} na carteira`},
    {label:'Penetração NPRO', value:fmtPct(penNpro), note:'% dos clientes ativos', tone:'good'},
    {label:'Penetração Bebidas', value:fmtPct(penBeb), note:'% dos clientes ativos', tone:'warning'},
    {label:'Penetração Ambas', value:fmtPct(penAmbas), note:'% dos clientes ativos'},
    {label:'Cobertura NPRO', value:fmtPct(covNpro), note:`% da carteira (${fmtInt(universoTotal)})`, tone:'good'},
    {label:'Cobertura Bebidas', value:fmtPct(covBeb), note:`% da carteira (${fmtInt(universoTotal)})`, tone:'warning'},
    {label:'Cobertura Ambas', value:fmtPct(covAmbas), note:`% da carteira (${fmtInt(universoTotal)})`},
  ]);
  // Mapa de calor recalculado a partir das MESMAS linhas já filtradas acima
  // (reage a Vendedor/Razão Social/Sold e ao período selecionado).
  const byVend = new Map();
  rows.forEach(r => {
    const v = r[iVendCli];
    if(v==null || r[iOport]==='Sem compras no período') return;
    if(!byVend.has(v)) byVend.set(v, {ativos:0, npro:0, beb:0, ambas:0});
    const b = byVend.get(v);
    b.ativos++;
    if(r[iNPRO]==='Sim') b.npro++;
    if(r[iBeb]==='Sim') b.beb++;
    if(r[iNPRO]==='Sim' && r[iBeb]==='Sim') b.ambas++;
  });
  const rowLabels = [], matrix = [];
  (DATA.vendedores||[]).forEach(v => {
    if(state.vendedor && state.vendedor!=='(Todos)' && v!==state.vendedor) return;
    const b = byVend.get(v);
    rowLabels.push(v);
    matrix.push(b && b.ativos ? [b.npro/b.ativos, b.beb/b.ativos, b.ambas/b.ativos] : [null,null,null]);
  });
  const colDefs = [{label:'Penetração NPRO'},{label:'Penetração Bebidas'},{label:'Penetração Ambas'}];
  heatGrid('heat-cobertura', rowLabels, colDefs, matrix, {format:fmtPct});
  const oldFoot = document.querySelector('#heat-cobertura + .footnote');
  if(oldFoot) oldFoot.remove();
  document.querySelector('#heat-cobertura').insertAdjacentHTML('afterend',
    `<div class="footnote">Este mapa já reage aos filtros de Vendedor/Razão Social/Sold acima e ao período selecionado no topo da página (cada célula é o % dos clientes ATIVOS daquele vendedor, dentro do recorte atual, que compram NPRO/Bebidas/Ambas). As tabelas de Grupo e Família abaixo consideram o período selecionado mas não os filtros de Vendedor/Razão Social/Sold.</div>`);
  const coberturaVendorRows = (DATA.vendedores||[]).filter(v => !state.vendedor || state.vendedor==='(Todos)' || v===state.vendedor).map(v => {
    const uni = (DATA.clientes||[]).filter(c => c[2]!=null && String(c[2])===v).length;
    const b = byVend.get(v) || {ativos:0, npro:0, beb:0, ambas:0};
    return {vendedor:v, universo:uni, ativos:b.ativos,
      covNpro: uni?b.npro/uni:0, covBeb: uni?b.beb/uni:0, covAmbas: uni?b.ambas/uni:0};
  });
  makeTable('table-cobertura-vendedor', {
    headers: [
      {key:'vendedor', label:'Vendedor', align:'left', format:v=>esc(v)},
      {key:'universo', label:'Carteira (total)', align:'right', format:fmtInt},
      {key:'ativos', label:'Ativos no Período', align:'right', format:fmtInt},
      {key:'covNpro', label:'Cobertura NPRO', align:'right', format:fmtPct},
      {key:'covBeb', label:'Cobertura Bebidas', align:'right', format:fmtPct},
      {key:'covAmbas', label:'Cobertura Ambas', align:'right', format:fmtPct},
    ],
    rows: coberturaVendorRows, getRow:r=>r, searchable:false, pageSize:10, defaultSort:{key:'universo', dir:'desc'},
  });
  makeTable('table-cobertura-grupo', {
    headers: PERIOD.cobertura.grupo_headers.map((h,i)=>({key:'c'+i, label:h, align:i>0?'right':'left', format: i===1?fmtInt : i===2?fmtPct : (v=>esc(v))})),
    rows: PERIOD.cobertura.grupo, getRow:r=>({c0:r[0],c1:r[1],c2:r[2]}), defaultSort:{key:'c2',dir:'desc'}, pageSize:10, searchable:false,
  });
  makeTable('table-cobertura-familia', {
    headers: PERIOD.cobertura.familia_headers.map((h,i)=>({key:'c'+i, label:h, align:i>0?'right':'left', format: i===1?fmtInt : i===2?fmtPct : (v=>esc(v))})),
    rows: PERIOD.cobertura.familia, getRow:r=>({c0:r[0],c1:r[1],c2:r[2]}), defaultSort:{key:'c2',dir:'desc'}, pageSize:10, searchable:false,
  });
}

/* ============================== TAB: PAINEL EXECUTIVO ============================== */
function renderPainel(){
  const k = PERIOD.painel.kpis;
  const state = filterState.painel;
  const vend = state.vendedor;
  const filtrado = vend && vend!=='(Todos)';
  // Faturamento/Unid.Vendidas/Clientes Ativos/Vendas por Categoria reagem ao
  // Vendedor (via o pivot de vendas e a lista de clientes); Estoque/Ruptura/
  // Excesso usam sempre a base completa (mesma regra do Excel).
  let faturamentoTotal = k.faturamento_total, unidadesVendidas = k.unidades_vendidas, clientesAtivos = k.clientes_ativos;
  const categoria = PERIOD.painel.categoria.map(r=>r.slice());
  if(filtrado){
    faturamentoTotal = 0; unidadesVendidas = 0;
    PERIOD.sku.rows.forEach(r => {
      const v = vendaSkuVals(r[iSkuCode], vend);
      faturamentoTotal += v[0]; unidadesVendidas += v[1];
      const cat = r[iSkuCat];
      const row = categoria.find(cr=>cr[0]===cat);
      if(row){ row.__fat = (row.__fat||0) + v[0]; row.__uv = (row.__uv||0) + v[1]; }
    });
    categoria.forEach(row => { row[2] = row.__fat||0; row[3] = row.__uv||0; });
    const totalFat = categoria.reduce((s,r)=>s+r[2],0);
    categoria.forEach(row => { row[4] = totalFat ? row[2]/totalFat : 0; });
    const cliRows = filterCliRows(PERIOD.cross.rows, crossH, {vendedor:vend, razaosocial:'(Todos)', sold:'(Todos)'}, false);
    const iOportCli = crossH.indexOf('Oportunidade');
    clientesAtivos = cliRows.filter(r=>r[iOportCli]!=='Sem compras no período').length;
  }
  renderKPIs('kpi-painel', [
    {label:'Faturamento Total no Período', value:fmtBRL0(faturamentoTotal)},
    {label:'Estoque Total (Cx)', value:fmtDec1(k.estoque_total), note:'base completa'},
    {label:'Unidades Vendidas no Período', value:fmtInt(unidadesVendidas)},
    {label:'Clientes Ativos no Período', value:fmtInt(clientesAtivos)},
    {label:'SKUs em Ruptura/Crítico', value:fmtInt(k.skus_ruptura_critico), tone: k.skus_ruptura_critico>0?'critical':'good', note:'base completa'},
    {label:'SKUs em Excesso', value:fmtInt(k.skus_excesso), tone:'warning', note:'base completa'},
  ]);
  makeTable('table-painel-categoria', {
    headers: PERIOD.painel.categoria_headers.map((h,i)=>({key:'c'+i, label:h, align:i>0?'right':'left', format: i===1?fmtDec1 : i===3?fmtInt : i===2?fmtBRL0 : i===4?fmtPct : (v=>esc(v))})),
    rows: categoria, getRow:r=>{const o={}; r.forEach((v,i)=>o['c'+i]=v); return o;}, searchable:false, pageSize:5,
  });
  const painelDonutColors = ['var(--good)','var(--accent)','var(--nogyro)'];
  donutChart('chart-painel-donut', categoria.map((r,i)=>({label:r[0], value:r[2], color:painelDonutColors[i]||'var(--nogyro)'})), {format:fmtBRL0});
  // Top 5 de Alertas: o CONJUNTO de SKUs em Ruptura/Crítico é sempre da base
  // completa da empresa (risco de estoque não é "do vendedor"), mas quando um
  // Vendedor está selecionado o Faturamento exibido é recalculado apenas com
  // as vendas daquele vendedor (mesmo padrão de renderSku/renderRisco), para
  // que a coluna nunca mostre um valor que não bate com o filtro ativo.
  const alertas = filtrado
    ? PERIOD.painel.alertas.map(r => { const nr = r.slice(); nr[5] = round2(vendaSkuVals(r[0], vend)[0]); return nr; })
    : PERIOD.painel.alertas;
  document.getElementById('painel-alertas-note').textContent = filtrado
    ? `Lista de SKUs considera a base completa da empresa (estoque/risco não têm "dono" por vendedor); o Faturamento exibido é apenas do vendedor ${vend}.`
    : '';
  makeTable('table-painel-alertas', {
    headers: PERIOD.painel.alertas_headers.map((h,i)=>({key:'c'+i, label:h, align:(i===3||i===4||i===5)?'right':'left', format: i===2?statusPill : i===3?fmtDec1 : i===4?fmtDec1 : i===5?fmtBRL : (v=>esc(v))})),
    rows: alertas, getRow:r=>{const o={}; r.forEach((v,i)=>o['c'+i]=v); return o;}, searchable:false, pageSize:5,
  });
  // Top 5 de Oportunidades: reage ao Vendedor — recalculado a partir da lista de
  // clientes já restrita àquele vendedor, em vez de sempre usar a base completa.
  const oportunidades = filtrado
    ? buildPainelOportunidades(PERIOD.clientList.filter(o=>o.vendedor===vend))
    : PERIOD.painel.oportunidades;
  document.getElementById('painel-oportunidades-note').textContent = filtrado
    ? `Mostrando apenas oportunidades do vendedor ${vend} (até 5, ordenadas por faturamento total).`
    : '';
  makeTable('table-painel-oportunidades', {
    headers: PERIOD.painel.oportunidades_headers.map((h,i)=>({key:'c'+i, label:h, align:i===4?'right':'left', format: i===2?oportPill : i===3?prioridadePill : i===4?fmtBRL : (v=>esc(v))})),
    rows: oportunidades, getRow:r=>{const o={}; r.forEach((v,i)=>o['c'+i]=v); return o;}, searchable:false, pageSize:5,
  });
}

/* ============================== INIT ============================== */
RENDERERS.dashboard = renderDashboard;
RENDERERS.sku = renderSku;
RENDERERS.dde = renderDde;
RENDERERS.risco = renderRisco;
RENDERERS.parado = renderParado;
RENDERERS.giro = renderGiro;
RENDERERS.cross = renderCross;
RENDERERS.cobertura = renderCobertura;
RENDERERS.painel = renderPainel;

/* ============================== UPLOAD DE PLANILHA ============================== */
// Lê o ARQUIVO OPERACIONAL real da distribuição — abas "NPRO", "BEBIDAS" e
// "CONSULTA DE VENDAS" (obrigatórias) e, quando presentes, "CATEGORIA NPRO" /
// "CATEGORIA BEBIDAS" (auxiliares, usadas só para conferência) — inteiramente
// no navegador (XLSX.js embutido nesta página; nada é enviado a nenhum servidor).
//
// IMPORTANTE — arquitetura: o Excel fornece SOMENTE dados brutos de estoque e
// vendas. As abas "de saída" do app (Dashboard, Estoque x Venda por SKU, Dias
// de Estoque (DDE), Risco de Ruptura, Estoque Parado, Ranking de Giro,
// Cross-sell, Cobertura por Categoria, Painel Executivo) são SEMPRE recalculadas
// aqui no navegador pelo motor já existente (rebuildDerived/recomputePeriod,
// implementado mais acima) — o parser abaixo nunca procura por essas abas no
// arquivo enviado, e o Excel nunca precisa ser editado, renomeado ou ter
// abas extras criadas antes do envio.
//
// Este parser popula apenas as ENTRADAS brutas que o motor consome:
// DATA.sku (universo de SKUs NPRO+Bebidas), DATA.baseVendas (linhas de
// transação), DATA.clientes, DATA.vendedores, DATA.periodoPadrao e
// DATA.cross.rows — e preserva, sem alterar, os cabeçalhos estáticos das
// demais abas (DATA.dde/.risco/.parado/.giro/.cobertura/.painel/.dashboard),
// que o motor sempre recalcula a partir do zero a cada atualização.

function normalizeSheetName(s){ return String(s==null?'':s).trim().toUpperCase().replace(/\s+/g,' '); }
function normalizeHeader(s){ return String(s==null?'':s).trim().toUpperCase().replace(/\s+/g,' '); }

// Duas fontes INDEPENDENTES (Estoque e Vendas), cada uma com seu próprio botão
// de envio — decisão do usuário ("Independentes (recomendado)"): enviar uma
// planilha atualiza só o dado dela, preservando o que já estava carregado da
// outra. Não existe mais um único "arquivo operacional" combinado.
//
// ESTOQUE: export bruto do SAP ("Relat.estoque mat."), tipicamente um .xls que
// na verdade é texto UTF-16LE delimitado por tabulação (não um binário real).
// Não traz Categoria/Grupo/Família — só SKU, descrição e a quantidade em
// CAIXAS (coluna "RemPndDisp"), que é a única unidade confiável para 100% do
// catálogo (ver nota em buildSkuDerivedList). A classificação de cada SKU é
// herdada do histórico de Vendas já carregado.
//
// VENDAS: aba obrigatória "CONSULTA DE VENDAS" (linhas de transação, com
// Grupo/Família próprios). As abas "CATEGORIA NPRO"/"CATEGORIA BEBIDAS" —
// opcionais quanto à presença no arquivo, mas essenciais para a classificação
// correta — mapeiam cada Grupo para a Origem (NPRO/Bebidas); sem elas, todo
// SKU cai em "Varejo" (Grupo fora do catálogo NPRO/Bebidas). Confirmado por
// inspeção direta do arquivo real
// ("VENDAS DO FLEXX NPROBEBIDAS ONLINE.xlsx"): a aba "BASE" (cadastro de
// clientes) não é usada — o cadastro de clientes/vendedores continua sendo
// derivado da própria "CONSULTA DE VENDAS".
const VENDAS_SHEET_REQUIRED = 'CONSULTA DE VENDAS';
const VENDAS_SHEETS_OPTIONAL = ["CATEGORIA NPRO","CATEGORIA BEBIDAS"];

class UploadValidationError extends Error {}

// A biblioteca de leitura de planilhas (SheetJS, ~430 KB) só é necessária quando
// alguém envia um arquivo. Baixá-la no carregamento da página atrasava a abertura
// do painel para todo mundo, inclusive para quem só vai consultar — aqui ela é
// carregada sob demanda, na primeira importação, e reaproveitada depois.
let _xlsxLoader = null;
function ensureXLSX(){
  if(typeof XLSX !== 'undefined' && XLSX && XLSX.version) return Promise.resolve();
  if(_xlsxLoader) return _xlsxLoader;
  _xlsxLoader = new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = 'assets/xlsx.min.js';
    tag.async = true;
    tag.onload = () => (typeof XLSX !== 'undefined' && XLSX && XLSX.version)
      ? resolve()
      : reject(new Error('leitor de planilhas carregado de forma incompleta'));
    tag.onerror = () => { _xlsxLoader = null; reject(new Error('não consegui carregar o leitor de planilhas (verifique a conexão e tente de novo)')); };
    document.head.appendChild(tag);
  });
  return _xlsxLoader;
}

function findSheetName(wb, expected){
  const target = normalizeSheetName(expected);
  return (wb.SheetNames||[]).find(n => normalizeSheetName(n)===target) || null;
}
function sheetGridOp(wb, realName){
  return XLSX.utils.sheet_to_json(wb.Sheets[realName], {header:1, raw:true, defval:null});
}
function ocell(grid, r, c){ const row = grid[r-1]; if(!row) return null; const v = row[c-1]; return (v===undefined||v==='') ? null : v; }

// Localiza a linha de cabeçalho de uma tabela procurando, nas primeiras `maxScan`
// linhas, uma célula cujo texto normalizado bata com `anchorToken` — em vez de
// presumir um número de linha fixo (a posição real varia entre abas/arquivos).
function findHeaderRowByAnchor(grid, anchorToken, maxScan){
  const target = normalizeHeader(anchorToken);
  for(let r=1;r<=maxScan;r++){
    const row = grid[r-1];
    if(!row) continue;
    for(let c=0;c<row.length;c++){ if(normalizeHeader(row[c])===target) return r; }
  }
  return null;
}
function headerIndexMap(grid, headerRow){
  const row = grid[headerRow-1] || [];
  const map = {};
  row.forEach((h,i) => { const k = normalizeHeader(h); if(k) map[k] = i+1; });
  return map;
}
function requireCol(map, label, sheetLabel){
  const idx = map[normalizeHeader(label)];
  if(!idx) throw new UploadValidationError(`A aba "${sheetLabel}" foi encontrada, mas a coluna necessária "${label}" está ausente.`);
  return idx;
}
function optCol(map, label){ return map[normalizeHeader(label)] || null; }

function asDateOp(v){
  if(v==null) return null;
  if(v instanceof Date) return v;
  if(typeof v==='number') return new Date(Date.UTC(1899,11,30) + v*86400000);
  if(typeof v==='string'){ const t = Date.parse(v); if(!isNaN(t)) return new Date(t); }
  return null;
}
function toIsoDateOp(v){ const d = asDateOp(v); return d ? d.toISOString().slice(0,10) : null; }
function dayMs(v){ const d = asDateOp(v); return d ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) : null; }

/* ------------------------------------------------------------------------------
   ZIP mínimo: extrai sob demanda o XML bruto de UMA aba do .xlsx.
   ------------------------------------------------------------------------------
   Necessário porque, no arquivo real do cliente, as abas "NPRO"/"BEBIDAS"
   carregam uma "dimension" inflada (formatação residual aplicada a ~743.000
   linhas, embora os dados reais ocupem só as primeiras dezenas), gerando um
   XML de ~178 MB por aba — grande o bastante para o decodificador da
   biblioteca XLSX.js embutida não conseguir processar (wb.Sheets[aba] fica
   ausente, mesmo a aba aparecendo em wb.SheetNames). Em vez de exigir que o
   usuário "limpe" a planilha antes de enviar, lemos e descompactamos SOMENTE
   a entrada do ZIP referente a essa aba, e paramos a leitura assim que já
   temos dados suficientes (bem além do necessário para qualquer tabela real).
   ---------------------------------------------------------------------------- */
function zipFindEntries(buf){
  const dv = new DataView(buf);
  const len = buf.byteLength;
  let eocd = -1;
  const start = Math.max(0, len - 65557);
  for(let i=len-22; i>=start; i--){
    if(i<0) break;
    if(dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  }
  if(eocd<0) throw new UploadValidationError('Não foi possível ler o arquivo enviado (índice ZIP do .xlsx não encontrado).');
  const cdOffset = dv.getUint32(eocd+16, true);
  const cdSize = dv.getUint32(eocd+12, true);
  const entries = {};
  let p = cdOffset;
  const end = cdOffset + cdSize;
  const dec = new TextDecoder('utf-8');
  while(p < end && p+46 <= len){
    if(dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p+10, true);
    const compSize = dv.getUint32(p+20, true);
    const uncompSize = dv.getUint32(p+24, true);
    const nameLen = dv.getUint16(p+28, true);
    const extraLen = dv.getUint16(p+30, true);
    const commentLen = dv.getUint16(p+32, true);
    const localOffset = dv.getUint32(p+42, true);
    const nameBytes = new Uint8Array(buf, p+46, nameLen);
    const name = dec.decode(nameBytes);
    entries[name] = {method, compSize, uncompSize, localOffset};
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
async function zipReadEntryText(buf, entry, maxBytesDecompressed){
  const dv = new DataView(buf);
  const lp = entry.localOffset;
  if(dv.getUint32(lp, true) !== 0x04034b50) throw new UploadValidationError('Não foi possível ler o arquivo enviado (cabeçalho ZIP inválido).');
  const nameLen = dv.getUint16(lp+26, true);
  const extraLen = dv.getUint16(lp+28, true);
  const dataStart = lp + 30 + nameLen + extraLen;
  const compBytes = new Uint8Array(buf, dataStart, entry.compSize);
  const decoder = new TextDecoder('utf-8');
  if(entry.method === 0){
    const limited = maxBytesDecompressed ? compBytes.slice(0, maxBytesDecompressed) : compBytes;
    return decoder.decode(limited);
  }
  if(entry.method !== 8) throw new UploadValidationError('Não foi possível ler o arquivo enviado (compressão ZIP não suportada).');
  const stream = new Blob([compBytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  let text = '', total = 0;
  try {
    while(true){
      const {done, value} = await reader.read();
      if(done) break;
      text += decoder.decode(value, {stream:true});
      total += value.length;
      if(maxBytesDecompressed && total >= maxBytesDecompressed){
        try { await reader.cancel(); } catch(e){}
        break;
      }
    }
  } finally {
    text += decoder.decode();
  }
  return text;
}
function decodeXmlEntities(s){
  return String(s==null?'':s)
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'")
    .replace(/&#x([0-9a-fA-F]+);/g,(_,h)=>String.fromCodePoint(parseInt(h,16)))
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(parseInt(n,10)))
    .replace(/&amp;/g,'&');
}
async function locateSheetXmlPath(buf, zipEntries, sheetName){
  const wbXmlEntry = zipEntries['xl/workbook.xml'];
  if(!wbXmlEntry) return null;
  const wbXml = await zipReadEntryText(buf, wbXmlEntry);
  const sheetTagRe = /<sheet\b([^>]*)\/>/g;
  let m, rId = null;
  while((m = sheetTagRe.exec(wbXml))){
    const attrs = m[1];
    const nameMatch = attrs.match(/\bname="([^"]*)"/);
    if(!nameMatch) continue;
    if(decodeXmlEntities(nameMatch[1]) === sheetName){
      const ridMatch = attrs.match(/\br:id="([^"]*)"/);
      if(ridMatch) rId = ridMatch[1];
      break;
    }
  }
  if(!rId) return null;
  const relsEntry = zipEntries['xl/_rels/workbook.xml.rels'];
  if(!relsEntry) return null;
  const relsXml = await zipReadEntryText(buf, relsEntry);
  const relRe = /<Relationship\b([^>]*)\/>/g;
  let rm;
  while((rm = relRe.exec(relsXml))){
    const attrs = rm[1];
    const idMatch = attrs.match(/\bId="([^"]*)"/);
    if(!idMatch || idMatch[1]!==rId) continue;
    const targetMatch = attrs.match(/\bTarget="([^"]*)"/);
    if(targetMatch) return 'xl/' + targetMatch[1].replace(/^\/+/, '');
  }
  return null;
}
function colLetterToIndex(letters){
  let n = 0;
  for(let i=0;i<letters.length;i++) n = n*26 + (letters.charCodeAt(i)-64);
  return n;
}
function resolveCellValue(cell, wbStrings){
  if(!cell) return null;
  if(cell.t==='s'){
    const idx = parseInt(cell.v,10);
    const s = (wbStrings||[])[idx];
    return s ? s.t : null;
  }
  if(cell.t==='str' || cell.t==='inlineStr') return decodeXmlEntities(cell.v);
  if(cell.t==='b') return cell.v==='1';
  const n = parseFloat(cell.v);
  return isNaN(n) ? null : n;
}
function extractRowsMapFromSheetXmlPrefix(xmlText){
  const lastRowEnd = xmlText.lastIndexOf('</row>');
  const safeText = lastRowEnd>=0 ? xmlText.slice(0, lastRowEnd+6) : xmlText;
  const rows = {};
  const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  let rm;
  while((rm = rowRe.exec(safeText))){
    const rAttrMatch = rm[1].match(/\br="(\d+)"/);
    if(!rAttrMatch) continue;
    const rNum = parseInt(rAttrMatch[1],10);
    const rowXml = rm[2];
    const cells = {};
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while((cm = cellRe.exec(rowXml))){
      const attrs = cm[1], inner = cm[2];
      const rMatch = attrs.match(/\br="([A-Z]+)\d+"/);
      if(!rMatch) continue;
      if(inner==null) continue; // célula autofechada, sem valor
      const tMatch = attrs.match(/\st="([^"]*)"/);
      const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
      if(!vMatch) continue;
      cells[rMatch[1]] = {v: vMatch[1], t: tMatch ? tMatch[1] : null};
    }
    rows[rNum] = cells;
  }
  return rows;
}
function rowsMapToGrid(rowsMap, wbStrings){
  const rowNums = Object.keys(rowsMap).map(Number);
  const maxR = rowNums.length ? Math.max(...rowNums) : 0;
  const grid = new Array(maxR);
  for(let r=1;r<=maxR;r++){
    const cellsForRow = rowsMap[r];
    if(!cellsForRow){ continue; }
    const cols = Object.keys(cellsForRow);
    if(!cols.length) continue;
    const maxC = Math.max(...cols.map(colLetterToIndex));
    const rowArr = new Array(maxC);
    cols.forEach(colLetter => { rowArr[colLetterToIndex(colLetter)-1] = resolveCellValue(cellsForRow[colLetter], wbStrings); });
    grid[r-1] = rowArr;
  }
  return grid;
}
// Limite de bytes descompactados ao usar o caminho alternativo — folgado o
// bastante para milhares de linhas reais de qualquer aba do arquivo.
const ZIP_FALLBACK_MAX_BYTES = 10*1024*1024;
async function getSheetGridRobust(wb, buf, zipEntries, realSheetName){
  if(wb.Sheets && wb.Sheets[realSheetName]) return sheetGridOp(wb, realSheetName);
  if(typeof DecompressionStream === 'undefined'){
    throw new UploadValidationError(`Não foi possível ler o conteúdo da aba "${realSheetName}" (formatação da planilha maior do que o esperado).`);
  }
  const xmlPath = await locateSheetXmlPath(buf, zipEntries, realSheetName);
  const entry = xmlPath ? zipEntries[xmlPath] : null;
  if(!entry) throw new UploadValidationError(`Não foi possível ler o conteúdo da aba "${realSheetName}" dentro do arquivo enviado.`);
  const xmlText = await zipReadEntryText(buf, entry, ZIP_FALLBACK_MAX_BYTES);
  const rowsMap = extractRowsMapFromSheetXmlPrefix(xmlText);
  return rowsMapToGrid(rowsMap, wb.Strings || []);
}

// ---- Números em formato europeu (SAP): vírgula decimal, ponto de milhar ----
// Ex.: "41,833" -> 41.833   "100.241,86" -> 100241.86
function parseEuroNumber(v){
  if(v==null) return 0;
  if(typeof v==='number') return v;
  let s = String(v).trim();
  if(!s) return 0;
  s = s.replace(/\*+\s*$/,'').trim(); // remove marcador de totais, se vier colado
  if(!s) return 0;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s);
  s = s.replace(/[()]/g,'').replace(/^-/,'');
  s = s.replace(/\./g,'').replace(/,/g,'.');
  const n = parseFloat(s);
  if(isNaN(n)) return 0;
  return neg ? -n : n;
}

/* ============================== ARQUIVO DE ESTOQUE (SAP) ==============================
   Export bruto "Relat.estoque mat." — normalmente um .xls que na verdade é texto
   UTF-16LE delimitado por tabulação (com BOM), não um binário real. Também aceitamos
   um .xlsx/.xls de verdade, caso o formato de extração do SAP mude no futuro. */
function detectEstoqueFileKind(buf){
  const bytes = new Uint8Array(buf, 0, Math.min(8, buf.byteLength));
  if(bytes.length>=2 && bytes[0]===0xFF && bytes[1]===0xFE) return 'utf16le';
  if(bytes.length>=2 && bytes[0]===0xFE && bytes[1]===0xFF) return 'utf16be';
  if(bytes.length>=2 && bytes[0]===0x50 && bytes[1]===0x4B) return 'xlsx';
  if(bytes.length>=4 && bytes[0]===0xD0 && bytes[1]===0xCF) return 'xls-ole';
  return 'text';
}
async function parseEstoqueFile(buf){
  const kind = detectEstoqueFileKind(buf);
  let grid;
  if(kind==='xlsx' || kind==='xls-ole'){
    let wb;
    try { wb = XLSX.read(new Uint8Array(buf), {type:'array', cellDates:true}); }
    catch(e){ throw new UploadValidationError(`Não consegui ler o arquivo de Estoque: ${e.message}`); }
    const sheetName = wb.SheetNames && wb.SheetNames[0];
    if(!sheetName) throw new UploadValidationError('Não foi possível ler o arquivo de Estoque (nenhuma aba encontrada).');
    grid = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {header:1, raw:true, defval:null});
  } else {
    let text;
    if(kind==='utf16le') text = new TextDecoder('utf-16le').decode(buf);
    else if(kind==='utf16be') text = new TextDecoder('utf-16be').decode(buf);
    else text = new TextDecoder('utf-8').decode(new Uint8Array(buf));
    text = text.replace(/^﻿/, '');
    grid = text.split(/\r\n|\r|\n/).map(line => line.split('\t'));
  }

  const headerRow = findHeaderRowByAnchor(grid, 'Material', 12);
  if(!headerRow) throw new UploadValidationError('Não foi possível localizar a linha de cabeçalho (coluna "Material") no arquivo de Estoque enviado.');
  const map = headerIndexMap(grid, headerRow);
  const cMaterial = requireCol(map,'MATERIAL','Estoque');
  const cTexto = requireCol(map,'TEXTO BREVE MATERIAL','Estoque');
  const cRemPnd = requireCol(map,'REMPNDDISP','Estoque');
  const cCen = optCol(map,'CEN.');

  const rows = [];
  const plantas = new Set();
  let blankStreak = 0;
  for(let r=headerRow+1; r<=grid.length && blankStreak<10; r++){
    const skuV = ocell(grid,r,cMaterial);
    if(skuV==null || String(skuV).trim()===''){ blankStreak++; continue; }
    blankStreak = 0;
    if(cCen){ const cen = ocell(grid,r,cCen); if(cen!=null) plantas.add(String(cen)); }
    rows.push({
      sku: String(skuV).trim(), material: ocell(grid,r,cTexto),
      estoqueCx: parseEuroNumber(ocell(grid,r,cRemPnd)),
    });
  }
  if(rows.length===0) throw new UploadValidationError('O arquivo de Estoque foi lido, mas nenhuma linha de material foi encontrada.');
  return {rows, plantas};
}

/* ============================== ARQUIVO DE VENDAS ==============================
   Aba obrigatória "CONSULTA DE VENDAS" (linhas de transação). As abas "CATEGORIA
   NPRO"/"CATEGORIA BEBIDAS" são opcionais quanto à presença no arquivo, mas
   essenciais para classificar a Origem (NPRO/Bebidas) de cada Grupo — sem elas,
   todo SKU cai em "Varejo" nesta importação (Grupo fora do catálogo NPRO/Bebidas). */
async function parseGrupoOrigemSheet(wb, buf, zipEntries, expectedName, origem, map){
  const realName = findSheetName(wb, expectedName);
  if(!realName) return {found:false, pares:0};
  let grid;
  try { grid = await getSheetGridRobust(wb, buf, zipEntries, realName); }
  catch(e){ return {found:true, pares:0}; }
  const headerRow = findHeaderRowByAnchor(grid, expectedName, 6);
  if(!headerRow) return {found:true, pares:0};
  let n=0, blank=0;
  for(let r=headerRow+1; r<=grid.length && blank<5; r++){
    const v = ocell(grid,r,1);
    if(v!=null){ map.set(normalizeHeader(v), origem); n++; blank=0; } else blank++;
  }
  return {found:true, pares:n};
}
async function parseVendasFile(wb, buf, zipEntries){
  const expectedName = VENDAS_SHEET_REQUIRED;
  const realName = findSheetName(wb, expectedName);
  if(!realName) throw new UploadValidationError(`Não foi possível atualizar os dados de Vendas porque a aba "${expectedName}" não foi encontrada.`);
  const grid = await getSheetGridRobust(wb, buf, zipEntries, realName);
  const headerRow = findHeaderRowByAnchor(grid, 'SKU', 8);
  if(!headerRow) throw new UploadValidationError(`A aba "${expectedName}" foi encontrada, mas não localizei a linha de cabeçalho (coluna "SKU").`);
  const map = headerIndexMap(grid, headerRow);
  const cSetor = requireCol(map,'SETOR',expectedName);
  const cSold = requireCol(map,'SOLD',expectedName);
  const cRazao = requireCol(map,'RAZÃO SOCIAL',expectedName);
  const cPedido = requireCol(map,'COD PEDIDO',expectedName);
  const cData = requireCol(map,'DATA DO PEDIDO',expectedName);
  const cSku = requireCol(map,'SKU',expectedName);
  const cFat = requireCol(map,'FATURAMENTO',expectedName);
  const cUnidVend = requireCol(map,'UNIDADES VENDIDAS',expectedName);
  const cCxVend = requireCol(map,'CXS VENDIDAS',expectedName);
  const cGrupo = requireCol(map,'GRUPO',expectedName);
  const cFamilia = requireCol(map,'FAMÍLIA',expectedName);
  const cMaterial = optCol(map,'MATERIAL');

  const grupoOrigemMap = new Map();
  const categoriaNpro = await parseGrupoOrigemSheet(wb, buf, zipEntries, 'CATEGORIA NPRO', 'NPRO', grupoOrigemMap);
  const categoriaBebidas = await parseGrupoOrigemSheet(wb, buf, zipEntries, 'CATEGORIA BEBIDAS', 'BEBIDAS', grupoOrigemMap);

  // Bloco "De" / "Até" (período coberto pela extração) — localizado por rótulo,
  // já que pode estar sobreposto às primeiras linhas de dados da tabela.
  let dataDe = null, dataAte = null;
  for(let r=1;r<=8;r++){
    const lbl = normalizeHeader(ocell(grid,r,1));
    if(lbl==='DE') dataDe = ocell(grid,r,2);
    else if(lbl==='ATÉ') dataAte = ocell(grid,r,2);
  }

  const rows = [];
  const skusSemGrupoOrigem = new Set();
  let blankStreak = 0;
  for(let r=headerRow+1; r<=grid.length && blankStreak<15; r++){
    const soldV = ocell(grid,r,cSold);
    const skuV = ocell(grid,r,cSku);
    if(soldV==null || skuV==null){ blankStreak++; continue; }
    blankStreak = 0;
    const setor = ocell(grid,r,cSetor);
    const vcode = setor!=null ? String(setor) : null;
    if(vcode==='506') continue; // vendedor removido por completo (regra do projeto)
    const skuStr = String(skuV);
    const grupoV = ocell(grid,r,cGrupo);
    const origem = grupoOrigemMap.get(normalizeHeader(grupoV)) || 'Varejo';
    if(origem==='Varejo') skusSemGrupoOrigem.add(skuStr);
    rows.push({
      sold: soldV, vcode, razaoSocial: ocell(grid,r,cRazao), pedido: ocell(grid,r,cPedido),
      dataPedido: ocell(grid,r,cData), sku: skuStr,
      material: (cMaterial?ocell(grid,r,cMaterial):null) || (PRODUTO_MASTER.get(skuStr) ? PRODUTO_MASTER.get(skuStr).material : null),
      grupo: grupoV, familia: ocell(grid,r,cFamilia), origem,
      fat: Number(ocell(grid,r,cFat))||0, unid: Number(ocell(grid,r,cUnidVend))||0, cx: Number(ocell(grid,r,cCxVend))||0,
    });
  }
  return {rows, dataDe, dataAte, categoriaNpro, categoriaBebidas, skusSemGrupoOrigem};
}

/* ============================== ORQUESTRADORES (upload independente) ==============================
   Cada envio atualiza SÓ o seu dado (Estoque ou Vendas), derivando a "outra metade"
   que precisa (classificação Categoria/Grupo/Família <-> Estoque em Caixas) a partir
   do que já está atualmente carregado em DATA — nunca inventando valores. */
async function applyEstoqueUpload(buf){
  const {rows: estoqueRows, plantas} = await parseEstoqueFile(buf);

  const estoqueMap = new Map();
  const duplicados = [];
  estoqueRows.forEach(r => {
    if(estoqueMap.has(r.sku)) duplicados.push(r.sku);
    estoqueMap.set(r.sku, r);
  });

  const skuH = DATA.sku.headers;
  const iCode=skuH.indexOf('SKU'), iMat=skuH.indexOf('Material'), iCat=skuH.indexOf('Categoria'),
        iGrp=skuH.indexOf('Grupo'), iFam=skuH.indexOf('Família');

  // Classificação (Categoria/Grupo/Família) por SKU: o arquivo do SAP não traz essas
  // colunas, então usamos o histórico de Vendas já carregado (mais atual) e, na falta
  // dele, o que já estava no catálogo — nunca inventando uma classificação nova.
  const vendasMeta = new Map();
  (DATA.baseVendas||[]).forEach(r => {
    const sku = r[4]!=null?String(r[4]):null;
    if(sku && !vendasMeta.has(sku)) vendasMeta.set(sku, {grupo:r[5], familia:r[6], origem:r[7]});
  });
  const catalogMeta = new Map();
  (DATA.sku.rows||[]).forEach(r => {
    catalogMeta.set(String(r[iCode]), {material:r[iMat], categoria:r[iCat], grupo:r[iGrp], familia:r[iFam]});
  });

  // PRODUTO_MASTER (cadastro completo do FLEXX, ~6.500 SKUs) entra como uma terceira
  // camada de apoio — só para preencher Material/Grupo/Família quando nem o histórico
  // de Vendas nem o catálogo atual conhecem o SKU. Nunca é usado para decidir
  // Categoria/Origem (isso continua sendo só grupoOrigemMap-ou-'Varejo', regra já
  // definida pelo usuário), e nunca sobrescreve um valor já conhecido.
  const skusSemClassificacao = [];
  const catalog = new Map();
  estoqueMap.forEach((r, sku) => {
    const vMeta = vendasMeta.get(sku), cMeta = catalogMeta.get(sku), pMeta = PRODUTO_MASTER.get(sku);
    if(!vMeta && !cMeta && !pMeta) skusSemClassificacao.push(sku);
    catalog.set(sku, {
      material: r.material || (cMeta && cMeta.material) || (pMeta && pMeta.material) || null,
      categoria: vMeta ? vMeta.origem : (cMeta ? cMeta.categoria : 'Varejo'),
      grupo: (vMeta && vMeta.grupo) || (cMeta && cMeta.grupo) || (pMeta && pMeta.grupo) || null,
      familia: (vMeta && vMeta.familia) || (cMeta && cMeta.familia) || (pMeta && pMeta.familia) || null,
      estoqueCx: r.estoqueCx,
    });
  });
  // SKUs vendidos no histórico atual que não aparecem no novo arquivo de Estoque
  // continuam no catálogo (nenhum SKU vendido é descartado) — Estoque = 0.
  vendasMeta.forEach((vMeta, sku) => {
    if(catalog.has(sku)) return;
    const cMeta = catalogMeta.get(sku), pMeta = PRODUTO_MASTER.get(sku);
    catalog.set(sku, {
      material: (cMeta && cMeta.material) || (pMeta && pMeta.material) || null,
      categoria: vMeta.origem, grupo: vMeta.grupo, familia: vMeta.familia, estoqueCx: 0,
    });
  });

  const skuRows = Array.from(catalog.entries()).map(([sku, m]) =>
    [sku, m.material, m.categoria, m.grupo, m.familia, m.estoqueCx, 0,0,0,0,null,0,'-']);

  const newData = Object.assign({}, DATA, { sku: { headers: DATA.sku.headers, rows: skuRows } });

  const diagnostics = {
    ok: true, kind: 'estoque',
    counts: {
      estoqueSkus: estoqueRows.length, plantas: Array.from(plantas), duplicados,
      skusSemClassificacao: skusSemClassificacao.length, skusSemClassificacaoList: skusSemClassificacao,
    },
  };
  return {newData, diagnostics};
}

async function applyVendasUpload(buf){
  const wb = XLSX.read(new Uint8Array(buf), {type:'array', cellDates:true});
  const zipEntries = zipFindEntries(buf);
  const {rows: salesRowsRaw, dataDe, dataAte, categoriaNpro, categoriaBebidas, skusSemGrupoOrigem} = await parseVendasFile(wb, buf, zipEntries);

  // ---- Corte "Realizada" — mesma regra do motor original: MIN(HOJE+1, Até+1) ----
  const now = new Date();
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const ateMs = dayMs(dataAte);
  const cutoffMs = Math.min(todayMs + 86400000, (ateMs!=null ? ateMs + 86400000 : Infinity));
  const deMs = dayMs(dataDe);

  let periodoPadrao = {inicio:null, fim:null};
  if(deMs!=null && isFinite(cutoffMs)){
    const diasPeriodo = Math.max(1, Math.round((cutoffMs - deMs)/86400000));
    periodoPadrao.inicio = new Date(deMs).toISOString().slice(0,10);
    periodoPadrao.fim = new Date(deMs + (diasPeriodo-1)*86400000).toISOString().slice(0,10);
  }

  const baseVendas = [];
  const clientesMap = new Map(); // sold -> {razaoSocial, vcode}
  const vendedoresSet = new Set();
  const skusVendidosSet = new Set();
  const vendasSkuMeta = new Map(); // sku -> {material, grupo, familia, origem}

  salesRowsRaw.forEach(r => {
    const rowDayMs = dayMs(r.dataPedido);
    const realizada = (rowDayMs!=null && rowDayMs < cutoffMs) ? 1 : 0;
    const dataStr = toIsoDateOp(r.dataPedido);
    baseVendas.push([r.sold, r.vcode, r.pedido, dataStr, r.sku, r.grupo, r.familia, r.origem, realizada,
      Math.round(r.fat*100)/100, r.unid, Math.round(r.cx*10000)/10000]);
    if(r.vcode) vendedoresSet.add(r.vcode);
    skusVendidosSet.add(r.sku);
    if(!vendasSkuMeta.has(r.sku)) vendasSkuMeta.set(r.sku, {material:r.material, grupo:r.grupo, familia:r.familia, origem:r.origem});
    if(!clientesMap.has(r.sold)) clientesMap.set(r.sold, {razaoSocial: r.razaoSocial, vcode: r.vcode});
  });

  const clientes = Array.from(clientesMap.entries()).map(([sold, c]) => [sold, c.razaoSocial, c.vcode]);
  const vendedores = Array.from(vendedoresSet).filter(v=>v!=='506').sort();

  // ---- Reconstrói o catálogo de SKUs (Estoque em Caixas) a partir do catálogo ATUAL ----
  // (o Estoque não mudou nesta importação — só a classificação Categoria/Grupo/Família
  // de cada SKU é atualizada com o que vem, mais fresco, da nova planilha de Vendas.)
  const skuH = DATA.sku.headers;
  const iCode=skuH.indexOf('SKU'), iMat=skuH.indexOf('Material'), iCat=skuH.indexOf('Categoria'),
        iGrp=skuH.indexOf('Grupo'), iFam=skuH.indexOf('Família'), iEst=skuH.indexOf('Estoque (Cx)');
  const catalog = new Map();
  (DATA.sku.rows||[]).forEach(r => {
    catalog.set(String(r[iCode]), {material:r[iMat], categoria:r[iCat], grupo:r[iGrp], familia:r[iFam], estoqueCx:r[iEst]||0});
  });
  vendasSkuMeta.forEach((meta, sku) => {
    const existing = catalog.get(sku);
    if(existing){
      existing.grupo = meta.grupo; existing.familia = meta.familia; existing.categoria = meta.origem;
      if(!existing.material && meta.material) existing.material = meta.material;
    } else {
      // SKU vendido sem registro de estoque conhecido — entra como órfão (Estoque=0).
      catalog.set(sku, {material: meta.material || null, categoria: meta.origem, grupo: meta.grupo, familia: meta.familia, estoqueCx: 0});
    }
  });

  const skuRows = Array.from(catalog.entries()).map(([sku, m]) =>
    [sku, m.material, m.categoria, m.grupo, m.familia, m.estoqueCx, 0,0,0,0,null,0,'-']);

  const crossRows = clientes.map(c => [c[0], c[1], c[2], 'Não','Não',0,0,0,'Sem compras no período','-']);

  const newData = Object.assign({}, DATA, {
    vendedores, periodoPadrao, baseVendas, clientes,
    sku: { headers: DATA.sku.headers, rows: skuRows },
    cross: { headers: DATA.cross.headers, rows: crossRows },
  });

  const diagnostics = {
    ok: true, kind: 'vendas',
    sheets: { [VENDAS_SHEET_REQUIRED]: true, 'CATEGORIA NPRO': categoriaNpro.found, 'CATEGORIA BEBIDAS': categoriaBebidas.found },
    counts: {
      vendasLinhas: baseVendas.length, skusVendidos: skusVendidosSet.size,
      skusSemGrupoOrigem: skusSemGrupoOrigem.size, skusSemGrupoOrigemList: Array.from(skusSemGrupoOrigem),
      clientes: clientes.length, vendedores: vendedores.length,
    },
    periodo: periodoPadrao,
  };
  return {newData, diagnostics};
}

function logImportDiagnostics(diag){
  console.group('%cDiagnóstico de importação — ' + (diag.kind==='estoque' ? 'Estoque' : 'Vendas'), 'font-weight:bold;color:#1B3A6B;');
  console.log('Arquivo reconhecido:', diag.ok ? 'SIM' : 'NÃO');
  if(diag.kind==='estoque'){
    console.log('SKUs no arquivo de Estoque:', diag.counts.estoqueSkus);
    console.log('Plantas (Cen.) encontradas:', diag.counts.plantas);
    console.log('SKUs duplicados no arquivo:', diag.counts.duplicados);
    console.log('SKUs sem classificação (Categoria/Grupo/Família) conhecida:', diag.counts.skusSemClassificacao, diag.counts.skusSemClassificacaoList);
  } else {
    Object.keys(diag.sheets).forEach(name => console.log(`${diag.sheets[name] ? '✅' : '⚠️'} ${name}`));
    console.log('Linhas de venda (CONSULTA DE VENDAS):', diag.counts.vendasLinhas);
    console.log('SKUs encontrados nas vendas:', diag.counts.skusVendidos);
    console.log('SKUs sem Grupo->Origem mapeado (CATEGORIA NPRO/BEBIDAS, classificados como Varejo):', diag.counts.skusSemGrupoOrigem, diag.counts.skusSemGrupoOrigemList);
    console.log('Clientes (SOLD únicos):', diag.counts.clientes);
    console.log('Vendedores (códigos, excl. 506):', diag.counts.vendedores);
    console.log('Período padrão:', diag.periodo);
  }
  console.log(diag.ok ? '✅ PRONTO PARA ATUALIZAR' : '❌ NÃO PRONTO');
  console.groupEnd();
}

/* ---------------------------- Tela de validação/resumo ---------------------------- */
function buildSummaryModal(diag, filename, onConfirm, onCancel){
  const backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,32,0.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;';
  const card = document.createElement('div');
  card.style.cssText = 'background:var(--surface);color:var(--text);border-radius:var(--radius-lg);box-shadow:var(--shadow);max-width:560px;width:100%;max-height:88vh;overflow:auto;padding:24px 26px;font-family:var(--font-body);';

  function warnBlock(bg, ink, html){
    return `<div style="margin-top:10px;padding:10px 12px;background:${bg};color:${ink};border-radius:var(--radius-sm);font-size:12.5px;">${html}</div>`;
  }

  let title, subtitle, bodyHtml;
  if(diag.kind==='estoque'){
    title = 'Estoque reconhecido';
    subtitle = `${esc(filename)} — quantidades em Caixas (RemPndDisp) por SKU.`;
    const semClass = diag.counts.skusSemClassificacao;
    const semClassWarn = semClass>0 ? warnBlock('var(--warning-bg)','var(--warning-ink)',
      `⚠️ ${semClass} SKU(s) do estoque sem Categoria/Grupo/Família conhecidos (sem histórico de vendas para derivar) — ficarão como "Varejo" até aparecerem em uma venda.`) : '';
    const dupWarn = diag.counts.duplicados.length>0 ? warnBlock('var(--critical-bg)','var(--critical-ink)',
      `⚠️ SKU(s) duplicado(s) no arquivo de Estoque: ${esc(diag.counts.duplicados.join(', '))}.`) : '';
    bodyHtml = `
      <div style="font-weight:700;font-size:12.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.03em;margin:8px 0 4px;">Resumo dos dados</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:13px;">
        <div>SKUs no arquivo: <b>${diag.counts.estoqueSkus}</b></div>
        <div>Plantas (Cen.): <b>${esc(diag.counts.plantas.join(', ')||'—')}</b></div>
      </div>
      <div style="margin-top:10px;font-size:12.5px;color:var(--text-muted);">
        Esta atualização substitui somente o <b>Estoque (Cx)</b> de cada SKU — os dados de Vendas atualmente carregados não são alterados.
      </div>
      ${semClassWarn}${dupWarn}
    `;
  } else {
    title = 'Vendas reconhecidas';
    subtitle = `${esc(filename)} — os dados abaixo serão calculados a partir da aba "${VENDAS_SHEET_REQUIRED}".`;
    function sheetLine(name, required){
      const found = diag.sheets[name];
      const icon = found ? '✅' : (required ? '❌' : '⚠️');
      const tag = required ? 'obrigatória' : 'auxiliar';
      return `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
        <span>${icon} ${esc(name)} <span style="color:var(--text-faint);font-size:11px;">(${tag})</span></span>
        <span style="color:var(--text-muted);">${found?'encontrada':'não encontrada'}</span>
      </div>`;
    }
    const semGrupo = diag.counts.skusSemGrupoOrigem;
    const semGrupoWarn = semGrupo>0 ? warnBlock('var(--warning-bg)','var(--warning-ink)',
      `⚠️ ${semGrupo} SKU(s) vendido(s) com Grupo sem correspondência nas abas CATEGORIA NPRO/BEBIDAS — Origem classificada como "Varejo".`) : '';
    bodyHtml = `
      <div style="font-weight:700;font-size:12.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.03em;margin-bottom:4px;">Abas reconhecidas</div>
      ${sheetLine(VENDAS_SHEET_REQUIRED,true)}
      ${VENDAS_SHEETS_OPTIONAL.map(n=>sheetLine(n,false)).join('')}

      <div style="font-weight:700;font-size:12.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.03em;margin:16px 0 4px;">Resumo dos dados</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:13px;">
        <div>Linhas de venda: <b>${diag.counts.vendasLinhas}</b></div>
        <div>SKUs vendidos: <b>${diag.counts.skusVendidos}</b></div>
        <div>Clientes (SOLD únicos): <b>${diag.counts.clientes}</b></div>
        <div>Vendedores: <b>${diag.counts.vendedores}</b></div>
      </div>
      <div style="margin-top:10px;font-size:12.5px;color:var(--text-muted);">
        Período identificado: <b>${diag.periodo.inicio ? esc(diag.periodo.inicio.split('-').reverse().join('/')) : '—'} a ${diag.periodo.fim ? esc(diag.periodo.fim.split('-').reverse().join('/')) : '—'}</b>
      </div>
      <div style="margin-top:6px;font-size:12.5px;color:var(--text-muted);">
        Esta atualização substitui vendas, clientes, vendedores e período — o <b>Estoque (Cx)</b> atualmente carregado não é alterado.
      </div>
      ${semGrupoWarn}
    `;
  }

  card.innerHTML = `
    <div style="font-family:var(--font-display);font-weight:800;font-size:16px;margin-bottom:2px;">${esc(title)}</div>
    <div style="color:var(--text-muted);font-size:12.5px;margin-bottom:16px;">${subtitle}</div>
    ${bodyHtml}
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:22px;">
      <button id="upload-summary-cancel" style="font-family:var(--font-body);font-weight:600;font-size:13px;padding:9px 16px;border-radius:var(--radius-sm);border:1px solid var(--border-strong);background:var(--surface);color:var(--text);cursor:pointer;">Cancelar</button>
      <button id="upload-summary-confirm" style="font-family:var(--font-body);font-weight:700;font-size:13px;padding:9px 18px;border-radius:var(--radius-sm);border:none;background:var(--accent);color:#fff;cursor:pointer;">Confirmar atualização</button>
    </div>
  `;
  backdrop.appendChild(card);
  document.body.appendChild(backdrop);
  card.querySelector('#upload-summary-cancel').addEventListener('click', () => { document.body.removeChild(backdrop); onCancel(); });
  card.querySelector('#upload-summary-confirm').addEventListener('click', () => { document.body.removeChild(backdrop); onConfirm(); });
}

const LS_KEY = 'npro_painel_data_v1';
const LS_META_KEY = 'npro_painel_meta_v1';
const LS_BACKUP_KEY = 'npro_painel_data_backup_v1';
const LS_BACKUP_META_KEY = 'npro_painel_backup_meta_v1';

function refreshAllUI(){
  rebuildDerived();
  Object.keys(filterState).forEach(tabId => {
    Object.keys(filterState[tabId]).forEach(k => filterState[tabId][k] = '(Todos)');
  });
  Object.keys(TAB_BARS).forEach(tabId => {
    TAB_BARS[tabId].forEach(b => buildFilterBar(tabId, b.kind, b.barKey, b.opts));
  });
  Object.values(RENDERERS).forEach(fn => fn());
}

function setUploadStatus(msg, isError){
  const el = document.getElementById('upload-status');
  if(!el) return;
  el.textContent = msg;
  el.style.opacity = isError ? '1' : '0.85';
  el.style.color = isError ? '#FFD9D0' : '#fff';
  el.style.fontWeight = isError ? '700' : '400';
}

function refreshUndoLink(){
  const status = document.getElementById('upload-status');
  if(!status || !status.parentElement) return;
  let link = document.getElementById('upload-undo');
  // localStorage pode não estar disponível (navegação privada, ambiente restrito,
  // artefato publicado, etc.) — isso NUNCA pode derrubar uma atualização que já
  // foi aplicada em memória com sucesso, então essa leitura é sempre protegida.
  let hasBackup = false;
  try { hasBackup = !!localStorage.getItem(LS_BACKUP_KEY); } catch(e){ /* segue sem link de desfazer */ }
  if(hasBackup && !link){
    link = document.createElement('button');
    link.id = 'upload-undo';
    link.type = 'button';
    link.className = 'upload-clear';
    link.textContent = 'Desfazer última atualização';
    link.addEventListener('click', () => {
      try {
        const backup = localStorage.getItem(LS_BACKUP_KEY);
        const backupMeta = localStorage.getItem(LS_BACKUP_META_KEY);
        if(backup){ localStorage.setItem(LS_KEY, backup); } else { localStorage.removeItem(LS_KEY); }
        if(backupMeta){ localStorage.setItem(LS_META_KEY, backupMeta); } else { localStorage.removeItem(LS_META_KEY); }
        localStorage.removeItem(LS_BACKUP_KEY); localStorage.removeItem(LS_BACKUP_META_KEY);
      } catch(e){ /* ignore */ }
      location.reload();
    });
    status.parentElement.appendChild(link);
  } else if(!hasBackup && link){
    link.remove();
  }
}

// Fábrica genérica: liga um <input type="file"> independente (Estoque OU Vendas)
// ao seu parser correspondente. As duas entradas atualizam o mesmo DATA/localStorage
// (upload independente: cada uma mexe só na sua metade — ver applyEstoqueUpload/
// applyVendasUpload), preservando o mecanismo de desfazer já existente.
function wireUploadInput(inputId, parseFn, labelUpper){
  const input = document.getElementById(inputId);
  if(!input) return;
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if(!file) return;
    setUploadStatus(`Lendo arquivo de ${labelUpper}…`, false);
    const reader = new FileReader();
    reader.onload = async (e) => {
      let parsed;
      try {
        const buf = e.target.result;
        await ensureXLSX();
        parsed = await parseFn(buf);
      } catch(err){
        console.error(err);
        const msg = (err instanceof UploadValidationError) ? err.message
          : `Não consegui ler este arquivo: ${err.message}`;
        setUploadStatus(msg, true);
        input.value = '';
        return;
      }

      logImportDiagnostics(parsed.diagnostics);
      setUploadStatus(`${labelUpper} reconhecido(a). Os dados estão sendo processados.`, false);

      buildSummaryModal(parsed.diagnostics, file.name,
        () => { // Confirmar atualização
          const previousData = DATA;
          // ETAPA CRÍTICA: só isto pode falhar e reverter a atualização — aplicar
          // os novos dados em memória e redesenhar a tela. Tudo que vem depois
          // (persistir no navegador, atualizar o link de desfazer) é apoio e NUNCA
          // deve desfazer uma atualização que já funcionou.
          try {
            DATA = parsed.newData;
            refreshAllUI();
          } catch(err){
            console.error(err);
            DATA = previousData;
            try { refreshAllUI(); } catch(e2){ console.error(e2); }
            setUploadStatus(`Não foi possível aplicar os novos dados de ${labelUpper} (mantendo os dados anteriores): ${err.message}`, true);
            input.value = '';
            return;
          }
          const when = new Date().toLocaleString('pt-BR');
          let persisted = false;
          try {
            const prevStored = localStorage.getItem(LS_KEY);
            const prevMetaStored = localStorage.getItem(LS_META_KEY);
            if(prevStored){
              localStorage.setItem(LS_BACKUP_KEY, prevStored);
              if(prevMetaStored) localStorage.setItem(LS_BACKUP_META_KEY, prevMetaStored);
            }
            localStorage.setItem(LS_KEY, JSON.stringify(parsed.newData));
            localStorage.setItem(LS_META_KEY, JSON.stringify({filename:file.name, when}));
            persisted = true;
          } catch(err){ /* localStorage indisponível/cheio — segue só em memória, atualização já aplicada acima */ }
          // A atualização em memória já valeu; o que pode falhar aqui é só guardá-la
          // no navegador. Antes isso era silencioso e a pessoa só descobria ao dar F5
          // e ver os números antigos de volta — agora o aviso é explícito.
          setUploadStatus(persisted
            ? `${labelUpper} atualizado(a): ${file.name} (${when}).`
            : `${labelUpper} atualizado(a): ${file.name} (${when}). ATENÇÃO: não foi possível guardar no navegador — ao recarregar a página os dados voltam ao snapshot publicado.`, !persisted);
          try { refreshUndoLink(); } catch(err){ console.error(err); }
          input.value = '';
        },
        () => { // Cancelar
          setUploadStatus('Importação cancelada — mantendo os dados atuais.', false);
          input.value = '';
        }
      );
    };
    reader.onerror = () => { setUploadStatus('Erro ao ler o arquivo.', true); input.value = ''; };
    reader.readAsArrayBuffer(file);
  });
}

function initUpload(){
  const inputEstoque = document.getElementById('upload-input-estoque');
  const inputVendas = document.getElementById('upload-input-vendas');
  const clearBtn = document.getElementById('upload-clear');
  if(!inputEstoque && !inputVendas) return;
  let meta = null;
  try { meta = JSON.parse(localStorage.getItem(LS_META_KEY) || 'null'); } catch(e){}
  if(meta && meta.filename) setUploadStatus(`Usando snapshot enviado: ${meta.filename} (${meta.when}).`, false);
  refreshUndoLink();

  wireUploadInput('upload-input-estoque', applyEstoqueUpload, 'Estoque');
  wireUploadInput('upload-input-vendas', applyVendasUpload, 'Vendas');

  if(clearBtn) clearBtn.addEventListener('click', () => {
    try {
      localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_META_KEY);
      localStorage.removeItem(LS_BACKUP_KEY); localStorage.removeItem(LS_BACKUP_META_KEY);
    } catch(e){}
    location.reload();
  });
}

/* ============================== A4 PRINT SYSTEM ==============================
   Arquitetura (Etapa 38): Dados -> Filtros -> Cálculos -> Tela + Relatório.
   O relatório NUNCA recalcula nada: ele só reaproveita o que renderKPIs() e
   makeTable() já calcularam e guardaram (via ._printCards / ._printSnapshot)
   quando a aba foi renderizada pela última vez, e clona os próprios gráficos
   (SVG/HTML) já desenhados na tela — que já trazem valores diretos nas legendas,
   sem depender de hover (Etapa 18). */
const PRINT_CONFIG = {
  dashboard: {
    title:'Dashboard', orientation:'portrait', kpi:'kpi-dashboard',
    blocks:[
      {id:'chart-dashboard-top10', title:'Top 10 SKUs por Faturamento'},
      {id:'chart-dashboard-donut', title:'Participação NPRO × Bebidas'},
      {id:'alerts-dashboard', title:'Alertas automáticos'},
    ],
    tables:[{id:'table-dashboard-comparativo', title:'Comparativo NPRO × Bebidas'}],
  },
  sku: {
    title:'Estoque × Venda por SKU', orientation:'landscape', kpi:'kpi-sku',
    blocks:[], tables:[{id:'table-sku', title:'Todos os SKUs'}],
  },
  dde: {
    title:'Dias de Estoque — DDE', orientation:'landscape', kpi:'kpi-dde',
    blocks:[
      {id:'chart-dde-dist', title:'Distribuição de SKUs por Faixa de DDE'},
      {id:'dde-legend-explain', title:'Como ler as faixas'},
    ],
    tables:[{id:'table-dde', title:'Detalhe por SKU'}],
  },
  risco: {
    title:'Risco de Ruptura', orientation:'landscape', kpi:'kpi-risco',
    blocks:[{id:'risco-methodology', title:'Metodologia'}],
    tables:[{id:'table-risco', title:'SKUs por categoria de risco'}],
  },
  parado: {
    title:'Estoque Parado — Sem Giro', orientation:'landscape', kpi:'kpi-parado',
    blocks:[], tables:[{id:'table-parado', title:'SKUs sem giro'}],
  },
  giro: {
    title:'Índice Venda / Estoque', orientation:'landscape', kpi:null,
    blocks:[
      {id:'chart-giro-top10', title:'Top 10 — Maior giro'},
      {id:'chart-giro-bottom10', title:'Bottom 10 — Menor giro (com venda no período)'},
    ],
    tables:[{id:'table-giro', title:'Ranking completo'}],
  },
  cross: {
    title:'Cross-sell NPRO × Bebidas', orientation:'landscape', kpi:'kpi-cross',
    blocks:[], tables:[{id:'table-cross', title:'Clientes'}],
  },
  cobertura: {
    title:'Cobertura e Penetração por Categoria', orientation:'landscape', kpi:'kpi-cobertura',
    blocks:[{id:'heat-cobertura', title:'Penetração por Vendedor × Categoria'}],
    tables:[
      {id:'table-cobertura-vendedor', title:'Cobertura da Carteira por Vendedor'},
      {id:'table-cobertura-grupo', title:'Penetração por Grupo'},
      {id:'table-cobertura-familia', title:'Penetração por Família'},
    ],
  },
  painel: {
    title:'Painel Executivo', orientation:'portrait', kpi:'kpi-painel',
    blocks:[{id:'chart-painel-donut', title:'Faturamento por origem'}],
    tables:[
      {id:'table-painel-categoria', title:'Resumo por Categoria'},
      {id:'table-painel-alertas', title:'Principais Alertas — Top 5 SKUs em Ruptura/Crítico'},
      {id:'table-painel-oportunidades', title:'Principais Oportunidades — Top 5 Clientes'},
    ],
  },
  // O botão "Imprimir A4" era injetado em TODAS as abas, mas o Mapa da Venda não
  // tinha configuração: clicar nele não fazia absolutamente nada. Como é a aba
  // que mais se imprime (a folha que o vendedor leva para a visita), ela ganha
  // sua própria configuração — incluindo a identificação do cliente no cabeçalho
  // e o aviso de que esta aba usa o histórico completo, não o período do topo.
  mapa: {
    title:'Mapa da Venda NPRO', orientation:'landscape', kpi:null, blocks:[], hideFilters:true,
    tables:[
      {id:'table-mapa-total', title:'Visão Total'},
      {id:'table-mapa-grupo', title:'Visão por Grupo'},
    ],
    periodLabel: () => 'histórico completo de vendas carregado (esta aba não usa o período do topo da página)',
    headerExtra: () => {
      const sold = (document.getElementById('mapa-input-sold')||{}).value || '';
      const razao = (document.getElementById('mapa-razao-value')||{}).textContent || '—';
      const setor = (document.getElementById('mapa-setor-value')||{}).textContent || '—';
      if(!sold.trim()) return '';
      return `<div class="print-filters-row"><span class="print-filter-chip"><b>Cliente (SOLD):</b> ${esc(sold.trim())}</span>`
        + `<span class="print-filter-chip"><b>Razão Social:</b> ${esc(razao)}</span>`
        + `<span class="print-filter-chip"><b>Setor (Vendedor):</b> ${esc(setor)}</span></div>`;
    },
    guard: () => {
      const wrap = document.getElementById('mapa-total-wrap');
      const visivel = wrap && wrap.style.display !== 'none';
      return visivel ? null : 'Busque um cliente pelo código SOLD antes de imprimir — o relatório desta aba é sempre de um cliente.';
    },
  },
};

function fmtDateBR(ms){
  if(ms==null) return '—';
  const iso = fmtDateOnly(ms); // yyyy-mm-dd
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtDateTimeBR(d){
  const dd = String(d.getDate()).padStart(2,'0'), mm = String(d.getMonth()+1).padStart(2,'0'), yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2,'0'), mi = String(d.getMinutes()).padStart(2,'0');
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}
function slugifyFileDate(ms){ const iso=fmtDateOnly(ms); const [y,m,d]=iso.split('-'); return `${d}-${m}-${y}`; }

function renderPrintTableHtml(title, headers, rows){
  let html = `<div class="print-table-block"><h4>${esc(title)}</h4><div class="print-table-wrap"><table class="print-table"><thead><tr>`;
  headers.forEach(h => { html += `<th style="text-align:${h.align||'left'}">${esc(h.label)}</th>`; });
  html += `</tr></thead><tbody>`;
  if(!rows.length){
    html += `<tr><td colspan="${headers.length}" style="text-align:center;color:var(--text-faint);padding:14px;">Nenhum registro para os filtros selecionados.</td></tr>`;
  }
  rows.forEach(r => {
    html += '<tr>';
    headers.forEach(h => {
      const raw = r[h.key];
      const val = h.format ? h.format(raw, r) : esc(raw);
      html += `<td style="text-align:${h.align||'left'}">${val}</td>`;
    });
    html += '</tr>';
  });
  html += `</tbody></table></div></div>`;
  return html;
}

function buildPrintReportHtml(tabId){
  const cfg = PRINT_CONFIG[tabId];
  if(!cfg) return '';
  const chips = getActiveFilterChips(tabId);
  const filtrosHtml = chips.length
    ? chips.map(c=>`<span class="print-filter-chip"><b>${esc(c.label)}:</b> ${esc(c.value)}</span>`).join('')
    : `<span class="print-filter-chip print-filter-chip--all">Filtros: Base completa</span>`;
  const now = new Date();
  const badge = document.querySelector('.badge');
  const logoHtml = badge ? badge.outerHTML : '';

  let html = `<div class="print-header">${logoHtml}
    <div class="print-header-text">
      <div class="print-report-title">Relatório — ${esc(cfg.title)}</div>
      <div class="print-report-subtitle">Estoque × Vendas — NPRO + Bebidas</div>
    </div>
  </div>
  <div class="print-meta-row">
    <div>${cfg.periodLabel
      ? `<span class="print-meta-label">Base de dados:</span> ${esc(cfg.periodLabel())}`
      : `<span class="print-meta-label">Período analisado:</span> ${fmtDateBR(PERIOD.startMs)} até ${fmtDateBR(PERIOD.endMs)}`}</div>
    <div><span class="print-meta-label">Gerado em:</span> ${fmtDateTimeBR(now)}</div>
  </div>
  ${cfg.headerExtra ? cfg.headerExtra() : ''}
  ${cfg.hideFilters ? '' : `<div class="print-filters-row">${filtrosHtml}</div>`}`;

  const impedimento = cfg.guard ? cfg.guard() : null;
  if(impedimento){
    return html + `<div class="print-empty-note">${esc(impedimento)}</div>`;
  }

  if(cfg.kpi){
    const kpiEl = document.getElementById(cfg.kpi);
    const cards = (kpiEl && kpiEl._printCards) || [];
    if(cards.length){
      html += `<div class="print-kpi-grid">${cards.map(c=>`
        <div class="print-kpi-cell">
          <div class="print-kpi-label">${esc(c.label)}</div>
          <div class="print-kpi-value">${c.value}</div>
          ${c.note?`<div class="print-kpi-note">${esc(c.note)}</div>`:''}
        </div>`).join('')}</div>`;
    }
  }

  (cfg.blocks||[]).forEach(b => {
    const src = document.getElementById(b.id);
    if(!src || !src.innerHTML.trim()) return;
    html += `<div class="print-chart-block"><h4>${esc(b.title)}</h4>${src.outerHTML}</div>`;
  });

  (cfg.tables||[]).forEach(t => {
    const el = document.getElementById(t.id);
    const snap = el && el._printSnapshot;
    if(!snap) return;
    html += renderPrintTableHtml(t.title, snap.headers, snap.rows);
  });

  html += `<div class="print-footer">
    <div>Estoque × Vendas — NPRO + Bebidas · Relatório gerado automaticamente</div>
    <div>${fmtDateTimeBR(now)}</div>
  </div>`;
  return html;
}

let PRINT_CURRENT_TAB = null;
function applyPrintOrientation(orientation){
  const page = document.getElementById('a4-page');
  const tag = document.getElementById('print-orient-tag');
  const styleEl = document.getElementById('print-page-style');
  const isLandscape = orientation==='landscape';
  page.classList.toggle('landscape', isLandscape);
  if(tag) tag.textContent = isLandscape ? 'A4 Paisagem' : 'A4 Retrato';
  if(styleEl) styleEl.textContent = `@page{ size:A4 ${isLandscape?'landscape':'portrait'}; margin:12mm; }`;
}
function openPrintPreview(tabId){
  const cfg = PRINT_CONFIG[tabId];
  if(!cfg) return;
  PRINT_CURRENT_TAB = tabId;
  const overlay = document.getElementById('print-preview-overlay');
  const page = document.getElementById('a4-page');
  const orientSelect = document.getElementById('print-orientation-select');
  orientSelect.value = cfg.orientation;
  applyPrintOrientation(cfg.orientation);
  page.innerHTML = buildPrintReportHtml(tabId);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closePrintPreview(){
  document.getElementById('print-preview-overlay').classList.remove('open');
  document.body.style.overflow = '';
}
function printA4Report(){
  if(!PRINT_CURRENT_TAB) return;
  const cfg = PRINT_CONFIG[PRINT_CURRENT_TAB];
  const baseName = (cfg ? cfg.title : 'Relatorio').replace(/[\\/:*?"<>|]/g,'').trim().replace(/\s+/g,'_');
  const sameDay = fmtDateOnly(PERIOD.startMs)===fmtDateOnly(PERIOD.endMs);
  const dateSuffix = sameDay ? slugifyFileDate(PERIOD.endMs) : `${slugifyFileDate(PERIOD.startMs)}_a_${slugifyFileDate(PERIOD.endMs)}`;
  const originalTitle = document.title;
  document.title = `${baseName}_${dateSuffix}`;
  window.print();
  document.title = originalTitle;
}
function initPrintSystem(){
  const orientSelect = document.getElementById('print-orientation-select');
  orientSelect.addEventListener('change', () => applyPrintOrientation(orientSelect.value));
  document.getElementById('print-preview-close').addEventListener('click', closePrintPreview);
  document.getElementById('print-preview-go').addEventListener('click', printA4Report);
  document.getElementById('print-preview-overlay').addEventListener('click', e => {
    if(e.target.id==='print-preview-overlay') closePrintPreview();
  });
  document.addEventListener('keydown', e => {
    if(e.key==='Escape' && document.getElementById('print-preview-overlay').classList.contains('open')) closePrintPreview();
  });
}
const PRINT_ICON_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>';
// Componente único (Etapa 2/3): injeta o mesmo botão "Imprimir A4" ao lado do
// título de cada uma das 9 abas, em vez de marcação repetida por página.
function initPrintButtons(){
  TABS.forEach(t => {
    const panel = document.querySelector(`.tabpanel[data-tab="${t.id}"]`);
    if(!panel) return;
    const titleEl = panel.querySelector('.section-title');
    if(!titleEl || (titleEl.parentElement && titleEl.parentElement.classList.contains('section-title-row'))) return;
    const row = document.createElement('div');
    row.className = 'section-title-row';
    titleEl.parentNode.insertBefore(row, titleEl);
    row.appendChild(titleEl);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'print-a4-btn no-print';
    btn.dataset.tabid = t.id;
    btn.innerHTML = `${PRINT_ICON_SVG}<span>Imprimir A4</span>`;
    btn.addEventListener('click', () => openPrintPreview(t.id));
    row.appendChild(btn);
  });
}

/* ============================== MAPA DA VENDA (busca por cliente/SOLD) ==============================
   Consulta pontual por código SOLD, independente do "Período analisado" global — usa sempre o
   histórico completo em DATA.baseVendas (todas as datas presentes na planilha de Vendas enviada).
   Colunas e fórmulas replicam a planilha Excel "MAPA DA VENDA NPRO" fornecida pelo usuário:
     - Acumulado <ano> (JAN a <mês atual>): soma de Faturamento realizado de jan até o mês corrente.
     - %Cresc./Qued. Ano ant. (acumulado): (Acum. ano atual - Acum. ano anterior) / Acum. ano anterior.
     - Venda Média Últ. 3 meses: média do Faturamento dos 3 meses fechados anteriores ao mês atual.
     - <mês>-<ano ant.>: Faturamento do mesmo mês, no ano anterior.
     - %Cresc. (meta): percentual de crescimento alvo, configurável ao lado (não vem de nenhuma
       planilha — é um parâmetro de negócio que o usuário ajusta; default 20%, a pedido do usuário).
     - Meta: <mês>-<ano ant.> × (1 + %Cresc. meta).
     - <mês>-<ano atual>: Faturamento do mês corrente (parcial, até hoje).
     - %Meta: <mês>-<ano atual> / Meta.
     - %Cresc./Qued. Ano ant. (mês): (<mês>-<ano atual> - <mês>-<ano ant.>) / <mês>-<ano ant.>.
   "Visão por Grupo" sempre lista todos os grupos do cadastro completo de produtos (PRODUTO_MASTER_GRUPOS),
   mesmo os que o cliente nunca comprou (aparecem com "-"), por decisão explícita do usuário. */
const MESES_PT_MAPA = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MESES_ABREV_MAPA = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const LS_MAPA_GROWTH_KEY = 'npro_mapa_meta_growth_pct';

function loadMapaGrowthPref(){
  let saved = null;
  try { saved = localStorage.getItem(LS_MAPA_GROWTH_KEY); } catch(e){ /* segue com default, sem localStorage */ }
  const n = Number(saved);
  return (saved!=null && !isNaN(n)) ? n : 20;
}
function saveMapaGrowthPref(v){
  try { localStorage.setItem(LS_MAPA_GROWTH_KEY, String(v)); } catch(e){ /* best-effort — não bloqueia a busca */ }
}
function getMapaGrowthPct(){
  const el = document.getElementById('mapa-input-growth');
  const v = el ? Number(el.value) : NaN;
  return (isNaN(v) ? 20 : v) / 100;
}

function computeMapaVenda(soldRaw){
  const sold = String(soldRaw).trim();
  if(!sold) return null;
  const rows = (DATA.baseVendas||[]).filter(r => String(r[0])===sold);
  if(rows.length===0) return null;

  const now = new Date();
  const yCur = now.getFullYear(), mCur = now.getMonth()+1;
  const yPrev = yCur - 1;
  const growth = getMapaGrowthPct();

  function ymOf(r){
    const d = r[3]; // dataStr 'YYYY-MM-DD'
    if(!d) return null;
    return {y:Number(d.slice(0,4)), m:Number(d.slice(5,7))};
  }
  function sumFat(pred){
    let s = 0;
    rows.forEach(r => { if(r[8]===1 && pred(r)) s += (Number(r[9])||0); });
    return s;
  }
  const last3 = [];
  for(let i=1;i<=3;i++){ let mm=mCur-i, yy=yCur; while(mm<=0){ mm+=12; yy--; } last3.push({y:yy,m:mm}); }

  function metrics(grupo){
    const inG = r => grupo==null || r[5]===grupo;
    const acumAnterior = sumFat(r=>{ const d=ymOf(r); return d && inG(r) && d.y===yPrev && d.m>=1 && d.m<=mCur; });
    const acumAtual = sumFat(r=>{ const d=ymOf(r); return d && inG(r) && d.y===yCur && d.m>=1 && d.m<=mCur; });
    const crescAno = acumAnterior>0 ? (acumAtual-acumAnterior)/acumAnterior : null; // sem base no ano anterior: % indefinido, não inventa 0% nem infinito
    let soma3 = 0;
    last3.forEach(({y,m}) => { soma3 += sumFat(r=>{ const d=ymOf(r); return d && inG(r) && d.y===y && d.m===m; }); });
    const media3m = soma3/3;
    const mesAnoAnterior = sumFat(r=>{ const d=ymOf(r); return d && inG(r) && d.y===yPrev && d.m===mCur; });
    const meta = mesAnoAnterior * (1+growth);
    const mesAtual = sumFat(r=>{ const d=ymOf(r); return d && inG(r) && d.y===yCur && d.m===mCur; });
    const pctMeta = meta>0 ? mesAtual/meta : null; // sem meta (mês do ano anterior=0): % indefinido
    const crescMes = mesAnoAnterior>0 ? (mesAtual-mesAnoAnterior)/mesAnoAnterior : null; // idem, sem base no mês do ano anterior
    return {acumAnterior, acumAtual, crescAno, media3m, mesAnoAnterior, growth, meta, mesAtual, pctMeta, crescMes};
  }

  const cliMeta = clienteMetaMap.get(sold) || {};
  return {
    total: metrics(null),
    porGrupo: PRODUTO_MASTER_GRUPOS.map(g => Object.assign({grupo:g}, metrics(g))),
    razaoSocial: cliMeta.razaoSocial || null,
    vcode: cliMeta.vcode || null,
    cal: {yCur, yPrev, mCur, mesAtualNome: MESES_PT_MAPA[mCur-1], mesAbrev: MESES_ABREV_MAPA[mCur-1]},
  };
}

// Igual à convenção contábil da planilha original: valor monetário exatamente
// zero é exibido como "—" (mesmo tratamento visual de "sem valor"), em vez de
// "R$ 0,00" — só afeta a exibição, o valor de 0 continua correto no cálculo.
const fmtBRLMapa = n => (n==null||isNaN(n)||n===0) ? "—" : fmtBRL(n);
function mapaVendaHeaders(cal){
  const yCur2 = String(cal.yCur).slice(-2), yPrev2 = String(cal.yPrev).slice(-2);
  return [
    {key:'acumAnterior', label:`Acumulado ${cal.yPrev} (JAN a ${cal.mesAbrev})`, format:fmtBRLMapa, align:'right'},
    {key:'acumAtual', label:`Acumulado ${cal.yCur} (JAN a ${cal.mesAbrev})`, format:fmtBRLMapa, align:'right'},
    {key:'crescAno', label:'%Cresc./Qued. Ano ant.', format:fmtPct, align:'right'},
    {key:'media3m', label:'Venda Média Últ. 3 meses', format:fmtBRLMapa, align:'right'},
    {key:'mesAnoAnterior', label:`${cal.mesAtualNome}-${yPrev2}`, format:fmtBRLMapa, align:'right'},
    {key:'growth', label:'%Cresc. (meta)', format:fmtPct, align:'right'},
    {key:'meta', label:'Meta', format:fmtBRLMapa, align:'right'},
    {key:'mesAtual', label:`${cal.mesAtualNome}-${yCur2}`, format:fmtBRLMapa, align:'right'},
    {key:'pctMeta', label:'%Meta', format:fmtPct, align:'right'},
    {key:'crescMes', label:'%Cresc./Qued. Ano ant.', format:fmtPct, align:'right'},
  ];
}

function renderMapaVenda(){
  const input = document.getElementById('mapa-input-sold');
  const statusEl = document.getElementById('mapa-status');
  const emptyHint = document.getElementById('mapa-empty-hint');
  const razaoEl = document.getElementById('mapa-razao-value');
  const setorEl = document.getElementById('mapa-setor-value');
  const totalWrap = document.getElementById('mapa-total-wrap');
  const grupoWrap = document.getElementById('mapa-grupo-wrap');
  if(!input) return; // aba ainda não renderizada
  const datalist = document.getElementById('mapa-sold-list');
  if(datalist) datalist.innerHTML = (DATA.clientes||[]).map(c => `<option value="${esc(String(c[0]))}">${esc(c[1]||'')}</option>`).join('');
  const sold = input.value.trim();

  if(!sold){
    statusEl.style.display = 'none';
    emptyHint.style.display = '';
    razaoEl.textContent = '—'; setorEl.textContent = '—';
    totalWrap.style.display = 'none'; grupoWrap.style.display = 'none';
    return;
  }

  const result = computeMapaVenda(sold);
  if(!result){
    statusEl.style.display = '';
    statusEl.textContent = `Nenhuma venda encontrada para o código "${sold}" na planilha de Vendas carregada. Confira o código digitado, ou se este cliente já está na base de Vendas importada.`;
    emptyHint.style.display = 'none';
    razaoEl.textContent = '—'; setorEl.textContent = '—';
    totalWrap.style.display = 'none'; grupoWrap.style.display = 'none';
    return;
  }

  statusEl.style.display = 'none';
  emptyHint.style.display = 'none';
  razaoEl.textContent = result.razaoSocial || '—';
  setorEl.textContent = result.vcode || '—';
  totalWrap.style.display = ''; grupoWrap.style.display = '';

  const baseHeaders = mapaVendaHeaders(result.cal);
  makeTable('table-mapa-total', {
    headers: [{key:'label', label:'Geral'}].concat(baseHeaders),
    rows: [Object.assign({label:'Total'}, result.total)],
    getRow: r=>r, searchable:false, pageSize:5,
  });
  makeTable('table-mapa-grupo', {
    headers: [{key:'label', label:'Grupo'}].concat(baseHeaders),
    rows: result.porGrupo.map(r => Object.assign({label:r.grupo}, r)),
    getRow: r=>r, searchable:true, pageSize:15,
    defaultSort: {key:'acumAtual', dir:'desc'},
  });
}
function initMapaVenda(){
  const growthInput = document.getElementById('mapa-input-growth');
  growthInput.value = loadMapaGrowthPref();
  growthInput.addEventListener('change', () => {
    let v = Number(growthInput.value);
    if(isNaN(v)) v = 20;
    growthInput.value = v;
    saveMapaGrowthPref(v);
    renderMapaVenda();
  });
  const soldInput = document.getElementById('mapa-input-sold');
  soldInput.addEventListener('keydown', e => { if(e.key==='Enter') renderMapaVenda(); });
  document.getElementById('mapa-search-btn').addEventListener('click', renderMapaVenda);
  RENDERERS.mapa = renderMapaVenda;
}

function init(){
  initTabs();
  initUpload();
  buildFilterBar('dashboard','prod','prod',{showReset:false});
  buildFilterBar('dashboard','vendcli','vendcli');
  buildFilterBar('sku','prodvend','prodvend');
  buildFilterBar('dde','prod','prod');
  buildFilterBar('risco','prodvend','prodvend');
  buildFilterBar('parado','prod','prod');
  buildFilterBar('giro','prodvend','prodvend');
  buildFilterBar('cross','cli','cli');
  buildFilterBar('cobertura','cli2','cli2');
  buildFilterBar('painel','painelvend','painelvend');
  initMapaVenda();
  Object.values(RENDERERS).forEach(fn => fn());
  initPrintButtons();
  initPrintSystem();
}

/* ============================== BOOTSTRAP (versão web) ==============================
   No artefato original o snapshot vinha embutido no próprio HTML. Aqui ele é um
   arquivo estático separado (data/snapshot.json), o que deixa o HTML leve, permite
   cache do navegador/CDN e torna a troca de snapshot uma questão de publicar um
   arquivo — sem reescrever a página. Enquanto ele não chega, a tela de boot fica
   visível; se der erro, a pessoa vê a razão em vez de uma página em branco. */
const SNAPSHOT_URL = 'data/snapshot.json';

function bootFail(msg, err){
  if(err) console.error(err);
  const screen = document.getElementById('boot-screen');
  if(!screen) return;
  screen.classList.add('boot-error');
  screen.innerHTML = `<div class="boot-card">
    <div class="boot-title">Não foi possível carregar o painel</div>
    <div class="boot-sub">${esc(msg)}</div>
    <button type="button" class="boot-retry" onclick="location.reload()">Tentar de novo</button>
  </div>`;
}

async function boot(){
  const sub = document.getElementById('boot-sub');
  let snapshot;
  try {
    // O download já foi iniciado pelo <script> no <head> do index.html — aqui só
    // aguardamos. Se por algum motivo a promise não existir, busca na hora.
    snapshot = await (window.__snapshotPromise || fetch(SNAPSHOT_URL).then(r => {
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }));
  } catch(err){
    bootFail('Falha ao baixar os dados do painel (data/snapshot.json). Verifique a conexão e tente de novo.', err);
    return;
  }
  if(sub) sub.textContent = 'Calculando indicadores…';
  try {
    DATA = snapshot;
    initProdutoMaster();      // cadastro estático de produtos: sempre do snapshot publicado
    loadStoredSnapshotIfAny(); // planilha enviada antes neste navegador, se houver
    rebuildDerived();
    init();
  } catch(err){
    bootFail('Os dados foram baixados, mas houve um erro ao montar o painel: ' + (err && err.message ? err.message : err), err);
    return;
  }
  const screen = document.getElementById('boot-screen');
  if(screen) screen.remove();
  document.body.classList.add('app-ready');
}

boot();
