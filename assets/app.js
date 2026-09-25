
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
let PRODUTO_MASTER_ROWS = [];   // cadastro cru, para reanexar ao publicar (ver publicarSnapshot)
function initProdutoMaster(){
  PRODUTO_MASTER.clear(); PRODUTO_MASTER_GRUPOS.length = 0; _produtoMasterGruposSeen.clear();
  PRODUTO_MASTER_ROWS = (DATA.produtoMaster && DATA.produtoMaster.rows) || [];
  PRODUTO_MASTER_ROWS.forEach(r => {
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
// Abas com "grupo" ficam juntas num único botão do menu principal e aparecem
// todas na mesma página, uma embaixo da outra (cada uma continua sendo um
// painel próprio, com seus filtros e impressão A4).
const TAB_GRUPOS = { estvend: {label:"Estoque VS Vendas"} };
const TABS = [
  {id:"dashboard", label:"Dashboard", grupo:"estvend"},
  {id:"sku", label:"Estoque × SKU", grupo:"estvend"},
  {id:"dde", label:"DDE", grupo:"estvend"},
  {id:"risco", label:"Risco de Ruptura", grupo:"estvend"},
  {id:"parado", label:"Estoque Parado", grupo:"estvend"},
  {id:"giro", label:"Venda × Estoque", grupo:"estvend"},
  {id:"cross", label:"Cross-sell", grupo:"estvend"},
  {id:"cobertura", label:"Cobertura", grupo:"estvend"},
  {id:"painel", label:"Painel Executivo", grupo:"estvend"},
  {id:"mapa", label:"Mapa da Venda"},
  {id:"nrab", label:"Acompanhamento NRAB"},
  {id:"meta20", label:"Meta 20+"},
  {id:"semcompra", label:"Clientes sem Compra"},
  {id:"crescer", label:"Crescer +"},
  {id:"brasileirao", label:"Brasileirão"},
];
function initTabs(){
  const nav = document.getElementById('tabnav');
  // Menu principal: abas soltas + um botão por grupo (na posição da 1ª aba do grupo).
  const topo = [];
  TABS.forEach(t => {
    if(!t.grupo) topo.push({id:t.id, label:t.label});
    else if(!topo.some(x => x.id===t.grupo)) topo.push({id:t.grupo, label:TAB_GRUPOS[t.grupo].label, grupo:true});
  });
  nav.innerHTML = topo.map((t,i) => `<button class="tabbtn${i===0?' active':''}" data-tabid="${t.id}">${esc(t.label)}</button>`).join('');
  TABS.forEach(t => {
    const p = document.querySelector(`.tabpanel[data-tab="${t.id}"]`);
    if(p && t.grupo) p.classList.add('tabpanel-grupo');
  });

  function mostrar(idOuGrupo){
    const ids = TAB_GRUPOS[idOuGrupo] ? TABS.filter(t => t.grupo===idOuGrupo).map(t => t.id) : [idOuGrupo];
    document.querySelectorAll('.tabpanel').forEach(p => p.classList.toggle('active', ids.includes(p.dataset.tab)));
    window.scrollTo({top:0, behavior:'instant' in window ? 'instant' : 'auto'});
  }
  nav.querySelectorAll('.tabbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      nav.querySelectorAll('.tabbtn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      mostrar(btn.dataset.tabid);
    });
  });
  const primeiro = topo[0];
  if(primeiro) mostrar(primeiro.id);
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
function loadStoredSnapshotIfAny(publicadoEm){
  try {
    const stored = localStorage.getItem(LS_KEY);
    if(!stored) return;
    // Existe cópia local (envio que não foi publicado no app — sem rede ou erro
    // do servidor). Ela só continua valendo enquanto for mais nova que a versão
    // publicada; se alguém publicou depois, a do servidor manda e a local é
    // descartada, senão essa pessoa ficaria presa nos próprios números para sempre.
    let localISO = null;
    try { localISO = (JSON.parse(localStorage.getItem(LS_META_KEY) || 'null') || {}).whenISO || null; } catch(e){}
    if(publicadoEm && (!localISO || publicadoEm > localISO)){
      localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_META_KEY);
      return;
    }
    const parsed = JSON.parse(stored);
    if(parsed && parsed.sku && parsed.cross) DATA = parsed;
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
    // Bloco fixo no topo: linhas marcadas por opts.prioridade vêm sempre antes das
    // demais, qualquer que seja a coluna ordenada (filter preserva a ordem, então
    // a ordenação escolhida continua valendo dentro de cada bloco). Usado no Mapa
    // da Venda para os grupos NP nunca ficarem perdidos no meio da lista.
    if(opts.prioridade){
      const topo = [], resto = [];
      rows.forEach(r => (opts.prioridade(r) ? topo : resto).push(r));
      rows = topo.concat(resto);
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
      html += `<th data-key="${h.key}"${h.cls?` class="${h.cls}"`:''} style="text-align:${h.align||'left'}">${esc(h.label)}<span class="arrow">${arrow}</span></th>`;
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
        html += `<td${h.cls?` class="${h.cls}"`:''} style="text-align:${h.align||'left'}">${val}</td>`;
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
/* Cobertura e Penetração — sempre de UM mês e pelo par cliente (Sold) × vendedor:
   um cliente conta para o vendedor que vendeu para ele naquele mês (o mesmo cliente
   pode contar para dois vendedores, um em Food e outro em Bebidas).
   - Ativos = pares cliente×vendedor com alguma compra no mês (NPRO, Bebidas ou Varejo).
   - Penetração = pares que compraram a categoria ÷ ativos.
   - Cobertura = pares da CARTEIRA (aba BASE) que compraram a categoria ÷ carteira.
   Compra = faturamento somado > 0 no mês. */
function cobMesAtual(){
  const el = document.getElementById('cob-mes');
  if(el && !el.value) el.value = fmtDateOnly(scHojeMs()).slice(0,7);
  return el ? el.value : fmtDateOnly(scHojeMs()).slice(0,7);
}
function renderCobertura(){
  const state = filterState.cobertura;
  const mesKey = cobMesAtual();
  const passa = (vend, sold) => {
    if(state.vendedor && state.vendedor!=='(Todos)' && vend!==state.vendedor) return false;
    if(state.sold && state.sold!=='(Todos)' && sold!==state.sold) return false;
    if(state.razaosocial && state.razaosocial!=='(Todos)'){
      const cm = clienteMetaMap && clienteMetaMap.get(sold);
      if(!cm || cm.razaoSocial!==state.razaosocial) return false;
    }
    return true;
  };

  // Compras do mês por par vendedor|sold.
  const pares = new Map();
  for(const r of (baseVendasParsed||[])){
    if(!r.dateStr || r.dateStr.slice(0,7)!==mesKey || r.sold==null || r.vendedor==null) continue;
    if(!passa(r.vendedor, r.sold)) continue;
    const k = r.vendedor + '|' + r.sold;
    let p = pares.get(k);
    if(!p){ p = {vend:r.vendedor, sold:r.sold, npro:0, beb:0, total:0, grupos:new Map(), familias:new Map()}; pares.set(k, p); }
    p.total += r.fat;
    if(r.origem==='NPRO') p.npro += r.fat; else if(r.origem==='BEBIDAS') p.beb += r.fat;
    if(r.grupo) p.grupos.set(r.grupo, (p.grupos.get(r.grupo)||0) + r.fat);
    if(r.familia) p.familias.set(r.familia, (p.familias.get(r.familia)||0) + r.fat);
  }
  const ativos = Array.from(pares.values()).filter(p => p.total>0);
  const conta = (arr, f) => arr.filter(f).length;
  const nNpro = p => p.npro>0, nBeb = p => p.beb>0, nAmbas = p => p.npro>0 && p.beb>0;

  // Universo = carteira da aba BASE (pares Sold×Setor); sem ela, quem já comprou (DATA.clientes).
  const cart = scDados().carteira;
  const universo = (cart.length ? cart.map(c => ({vend:c.setor, sold:c.sold}))
    : (DATA.clientes||[]).map(c => ({vend: c[2]!=null ? String(c[2]) : null, sold: String(c[0])})))
    .filter(u => u.vend && passa(u.vend, u.sold));
  const doMes = u => pares.get(u.vend + '|' + u.sold);
  const cobCount = f => universo.filter(u => { const p = doMes(u); return p && f(p); }).length;
  const uniTotal = universo.length;
  const naCarteira = new Set(universo.map(u => u.vend + '|' + u.sold));
  const ativosForaCarteira = ativos.filter(p => !naCarteira.has(p.vend + '|' + p.sold)).length;
  const nomeMes = mesKey.slice(5,7) + '/' + mesKey.slice(0,4);

  renderKPIs('kpi-cobertura', [
    {label:'Clientes Ativos no Mês', value:fmtInt(ativos.length), note:`pares cliente×vendedor · ${nomeMes}`},
    {label:'Penetração NPRO', value:fmtPct(ativos.length ? conta(ativos, nNpro)/ativos.length : 0), note:'% dos ativos', tone:'good'},
    {label:'Penetração Bebidas', value:fmtPct(ativos.length ? conta(ativos, nBeb)/ativos.length : 0), note:'% dos ativos', tone:'warning'},
    {label:'Penetração Ambas', value:fmtPct(ativos.length ? conta(ativos, nAmbas)/ativos.length : 0), note:'% dos ativos'},
    {label:'Cobertura NPRO', value:fmtPct(uniTotal ? cobCount(nNpro)/uniTotal : 0), note:`% da carteira (${fmtInt(uniTotal)})`, tone:'good'},
    {label:'Cobertura Bebidas', value:fmtPct(uniTotal ? cobCount(nBeb)/uniTotal : 0), note:`% da carteira (${fmtInt(uniTotal)})`, tone:'warning'},
    {label:'Cobertura Ambas', value:fmtPct(uniTotal ? cobCount(nAmbas)/uniTotal : 0), note:`% da carteira (${fmtInt(uniTotal)})`},
  ]);

  // Penetração por vendedor (mapa de calor) — ativos do próprio vendedor no mês.
  const rowLabels = [], matrix = [];
  (DATA.vendedores||[]).forEach(v => {
    if(state.vendedor && state.vendedor!=='(Todos)' && v!==state.vendedor) return;
    const av = ativos.filter(p => p.vend===v);
    rowLabels.push(v);
    matrix.push(av.length ? [conta(av, nNpro)/av.length, conta(av, nBeb)/av.length, conta(av, nAmbas)/av.length] : [null,null,null]);
  });
  heatGrid('heat-cobertura', rowLabels, [{label:'Penetração NPRO'},{label:'Penetração Bebidas'},{label:'Penetração Ambas'}], matrix, {format:fmtPct});
  const oldFoot = document.querySelector('#heat-cobertura + .footnote');
  if(oldFoot) oldFoot.remove();
  document.querySelector('#heat-cobertura').insertAdjacentHTML('afterend',
    `<div class="footnote">Mês ${esc(nomeMes)}. Cada célula é o % dos clientes que compraram do vendedor no mês (pares cliente×vendedor) que levaram NPRO/Bebidas/Ambas.${ativosForaCarteira ? ` ${fmtInt(ativosForaCarteira)} par(es) ativo(s) não estão na carteira da aba BASE — entram na penetração, não na cobertura.` : ''}</div>`);

  // Cobertura da carteira por vendedor.
  const vendRows = (DATA.vendedores||[]).filter(v => !state.vendedor || state.vendedor==='(Todos)' || v===state.vendedor).map(v => {
    const uv = universo.filter(u => u.vend===v);
    const cov = f => uv.length ? uv.filter(u => { const p = doMes(u); return p && f(p); }).length/uv.length : 0;
    return {vendedor:v, universo:uv.length, ativos: ativos.filter(p => p.vend===v).length,
      cobertos: uv.filter(u => { const p = doMes(u); return p && p.total>0; }).length,
      covNpro: cov(nNpro), covBeb: cov(nBeb), covAmbas: cov(nAmbas)};
  });
  makeTable('table-cobertura-vendedor', {
    headers: [
      {key:'vendedor', label:'Vendedor', align:'left', format:v=>esc(v)},
      {key:'universo', label:'Carteira', align:'right', format:fmtInt},
      {key:'cobertos', label:'Carteira que comprou', align:'right', format:fmtInt},
      {key:'ativos', label:'Ativos no mês', align:'right', format:fmtInt},
      {key:'covNpro', label:'Cobertura NPRO', align:'right', format:fmtPct},
      {key:'covBeb', label:'Cobertura Bebidas', align:'right', format:fmtPct},
      {key:'covAmbas', label:'Cobertura Ambas', align:'right', format:fmtPct},
    ],
    rows: vendRows, getRow:r=>r, searchable:false, pageSize:10, defaultSort:{key:'universo', dir:'desc'},
  });

  // Penetração por Grupo / Família — pares que compraram ÷ ativos, no mês e nos filtros.
  function porChave(campo){
    const m = new Map();
    ativos.forEach(p => p[campo].forEach((fat, k) => { if(fat>0) m.set(k, (m.get(k)||0) + 1); }));
    return Array.from(m.entries()).map(([k, n]) => ({c0:k, c1:n, c2: ativos.length ? n/ativos.length : 0}));
  }
  const hdr = rot => [{key:'c0', label:rot, align:'left', format:v=>esc(v)}, {key:'c1', label:'Clientes (cliente×vendedor)', align:'right', format:fmtInt}, {key:'c2', label:'% dos ativos', align:'right', format:fmtPct}];
  makeTable('table-cobertura-grupo', {headers: hdr('Grupo'), rows: porChave('grupos'), getRow:r=>r, defaultSort:{key:'c2',dir:'desc'}, pageSize:10, searchable:false});
  makeTable('table-cobertura-familia', {headers: hdr('Família'), rows: porChave('familias'), getRow:r=>r, defaultSort:{key:'c2',dir:'desc'}, pageSize:10, searchable:false});
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
const VENDAS_SHEETS_OPTIONAL = ["CATEGORIA NPRO","CATEGORIA BEBIDAS","BASE"];

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
// Como "CONSULTA DE VENDAS", mas retorna TODAS as abas cujo nome bate exatamente
// ou começa com o nome esperado seguido de um sufixo (ex.: "CONSULTA DE VENDAS 2025",
// "CONSULTA DE VENDAS 2026") — permite que a planilha traga o histórico de vendas
// separado por ano em abas distintas, em vez de uma única aba "CONSULTA DE VENDAS".
function findSheetNames(wb, expected){
  const target = normalizeSheetName(expected);
  return (wb.SheetNames||[]).filter(n => {
    const norm = normalizeSheetName(n);
    return norm===target || norm.startsWith(target+' ');
  });
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
// Lê UMA aba de vendas (uma "CONSULTA DE VENDAS", "CONSULTA DE VENDAS 2025", etc.)
// e devolve suas linhas cruas — extraído de parseVendasFile para poder ser chamado
// uma vez por ano/aba encontrada e depois juntar tudo num único histórico.
async function parseVendasSheet(wb, buf, zipEntries, realName, expectedName, grupoOrigemMap){
  const grid = await getSheetGridRobust(wb, buf, zipEntries, realName);
  const headerRow = findHeaderRowByAnchor(grid, 'SKU', 8);
  if(!headerRow) throw new UploadValidationError(`A aba "${realName}" foi encontrada, mas não localizei a linha de cabeçalho (coluna "SKU").`);
  const map = headerIndexMap(grid, headerRow);
  const cSetor = requireCol(map,'SETOR',realName);
  const cSold = requireCol(map,'SOLD',realName);
  const cRazao = requireCol(map,'RAZÃO SOCIAL',realName);
  const cPedido = requireCol(map,'COD PEDIDO',realName);
  const cData = requireCol(map,'DATA DO PEDIDO',realName);
  const cSku = requireCol(map,'SKU',realName);
  const cFat = requireCol(map,'FATURAMENTO',realName);
  const cUnidVend = requireCol(map,'UNIDADES VENDIDAS',realName);
  const cCxVend = requireCol(map,'CXS VENDIDAS',realName);
  const cGrupo = requireCol(map,'GRUPO',realName);
  const cFamilia = requireCol(map,'FAMÍLIA',realName);
  const cMaterial = optCol(map,'MATERIAL');

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
  return {rows, dataDe, dataAte};
}

// Junta o histórico de todas as abas de vendas encontradas ("CONSULTA DE VENDAS",
// ou uma por ano: "CONSULTA DE VENDAS 2025", "CONSULTA DE VENDAS 2026", ...) num
// único conjunto de linhas — o restante do motor (parseVendasFile em diante)
// continua enxergando "as vendas" como se fosse uma tabela só.
async function parseVendasFile(wb, buf, zipEntries){
  const expectedName = VENDAS_SHEET_REQUIRED;
  const realNames = findSheetNames(wb, expectedName);
  if(realNames.length===0) throw new UploadValidationError(`Não foi possível atualizar os dados de Vendas porque nenhuma aba "${expectedName}" (ou "${expectedName} <ano>") foi encontrada.`);

  const grupoOrigemMap = new Map();
  const categoriaNpro = await parseGrupoOrigemSheet(wb, buf, zipEntries, 'CATEGORIA NPRO', 'NPRO', grupoOrigemMap);
  const categoriaBebidas = await parseGrupoOrigemSheet(wb, buf, zipEntries, 'CATEGORIA BEBIDAS', 'BEBIDAS', grupoOrigemMap);

  const rows = [];
  let dataDe = null, dataAte = null;
  for(const realName of realNames){
    const parte = await parseVendasSheet(wb, buf, zipEntries, realName, expectedName, grupoOrigemMap);
    rows.push(...parte.rows);
    const deMs = dayMs(parte.dataDe), ateMs = dayMs(parte.dataAte);
    if(deMs!=null && (dataDe==null || deMs < dayMs(dataDe))) dataDe = parte.dataDe;
    if(ateMs!=null && (dataAte==null || ateMs > dayMs(dataAte))) dataAte = parte.dataAte;
  }

  const skusSemGrupoOrigem = new Set();
  rows.forEach(r => { if(r.origem==='Varejo') skusSemGrupoOrigem.add(r.sku); });

  return {rows, dataDe, dataAte, categoriaNpro, categoriaBebidas, skusSemGrupoOrigem, sheetNames: realNames};
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
  const {rows: salesRowsRaw, dataDe, dataAte, categoriaNpro, categoriaBebidas, skusSemGrupoOrigem, sheetNames} = await parseVendasFile(wb, buf, zipEntries);

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

  // A aba BASE é lida primeiro: a carteira diz quem é a equipe (Setores da BASE)
  // e, pela coluna GRUPO COMERCIAL, quem atende cada cliente na força NPRO e na
  // força BEBIDAS.
  const baseGrid = await lerGridAbaBase(wb, buf, zipEntries);
  const carteiraNova = parseCarteiraBase(baseGrid);
  const carteiraRef = carteiraNova || DATA.carteira || null;
  const equipe = new Set((carteiraRef && carteiraRef.rows || []).map(r => String(r[1])));
  const forcaDe = new Map();
  (carteiraRef && carteiraRef.forcas || []).forEach(([sold, npro, beb]) => forcaDe.set(String(sold), {npro, beb}));

  // A planilha de Vendas pode trazer as vendas NPRO/Bebidas de TODOS os vendedores
  // da empresa (abas "CONSULTA DE VENDAS NPRO/BEBIDAS <ano>"). Venda de vendedor de
  // fora da equipe 500 para um cliente da equipe cai para o vendedor que atende o
  // cliente naquela força; para um cliente de fora da carteira, fica à parte
  // (DATA.vendasForaEquipe) — só entra no total da empresa do Brasileirão, nunca
  // como vendedor nem nas demais abas.
  const baseVendas = [], vendasForaEquipe = [];
  let reatribuidas = 0, reatribuidasFat = 0, foraFat = 0;
  const clientesMap = new Map(); // sold -> {razaoSocial, vcode}
  const vendedoresSet = new Set();
  const skusVendidosSet = new Set();
  const vendasSkuMeta = new Map(); // sku -> {material, grupo, familia, origem}

  salesRowsRaw.forEach(r => {
    const rowDayMs = dayMs(r.dataPedido);
    const realizada = (rowDayMs!=null && rowDayMs < cutoffMs) ? 1 : 0;
    const dataStr = toIsoDateOp(r.dataPedido);
    if(equipe.size && r.vcode!=null && !equipe.has(String(r.vcode))){
      const f = forcaDe.get(String(r.sold));
      const atendente = f ? (r.origem==='BEBIDAS' ? (f.beb || f.npro) : (f.npro || f.beb)) : null;
      if(!atendente){
        vendasForaEquipe.push([r.sold, r.vcode, r.pedido, dataStr, r.sku, r.grupo, r.familia, r.origem, realizada,
          Math.round(r.fat*100)/100, r.unid, Math.round(r.cx*10000)/10000]);
        foraFat += r.fat;
        return;
      }
      reatribuidas++; reatribuidasFat += r.fat;
      r = Object.assign({}, r, {vcode: atendente});
    }
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

  // Meta 20+ e Clientes sem Compra: cadastro de clientes/visitas e carteira da
  // aba BASE (o faturamento sai de baseVendas). Sem a aba, mantém o que já
  // estava carregado.
  const baseMeta20 = parseMeta20BaseSheet(baseGrid);
  const meta20 = baseMeta20 || (DATA.meta20 ? {
    clientes: DATA.meta20.clientes || [], visitas: DATA.meta20.visitas || [], vendedoresPorSetor: DATA.meta20.vendedoresPorSetor || [],
  } : {clientes: [], visitas: [], vendedoresPorSetor: []});

  const carteira = carteiraRef;

  const newData = Object.assign({}, DATA, {
    vendedores, periodoPadrao, baseVendas, clientes, meta20, carteira, vendasForaEquipe,
    sku: { headers: DATA.sku.headers, rows: skuRows },
    cross: { headers: DATA.cross.headers, rows: crossRows },
  });

  const diagnostics = {
    ok: true, kind: 'vendas',
    sheets: Object.assign({}, ...sheetNames.map(n => ({[n]: true})), { 'CATEGORIA NPRO': categoriaNpro.found, 'CATEGORIA BEBIDAS': categoriaBebidas.found, 'BASE': !!baseMeta20 }),
    counts: {
      vendasLinhas: baseVendas.length, skusVendidos: skusVendidosSet.size,
      skusSemGrupoOrigem: skusSemGrupoOrigem.size, skusSemGrupoOrigemList: Array.from(skusSemGrupoOrigem),
      clientes: clientes.length, vendedores: vendedores.length,
      carteira: baseMeta20 && carteira ? carteira.rows.length : null,
      reatribuidas, reatribuidasFat: Math.round(reatribuidasFat),
      foraEquipe: vendasForaEquipe.length, foraEquipeFat: Math.round(foraFat),
    },
    periodo: periodoPadrao,
  };
  return {newData, diagnostics};
}

function logImportDiagnostics(diag){
  const nomeKind = diag.kind==='estoque' ? 'Estoque' : 'Vendas';
  console.group('%cDiagnóstico de importação — ' + nomeKind, 'font-weight:bold;color:#1B3A6B;');
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
    console.log('Carteira (aba BASE, Sold+Setor):', diag.counts.carteira);
    console.log('Vendas de fora da equipe reatribuídas ao vendedor do cliente:', diag.counts.reatribuidas, 'R$', diag.counts.reatribuidasFat);
    console.log('Vendas de fora da equipe para clientes fora da carteira (só no total da empresa):', diag.counts.foraEquipe, 'R$', diag.counts.foraEquipeFat);
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
    const vendasSheetNames = Object.keys(diag.sheets).filter(n => !VENDAS_SHEETS_OPTIONAL.includes(n));
    subtitle = `${esc(filename)} — os dados abaixo serão calculados a partir d${vendasSheetNames.length>1?'as abas':'a aba'} "${esc(vendasSheetNames.join('", "'))}".`;
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
      ${vendasSheetNames.map(n=>sheetLine(n,true)).join('')}
      ${VENDAS_SHEETS_OPTIONAL.map(n=>sheetLine(n,false)).join('')}

      <div style="font-weight:700;font-size:12.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.03em;margin:16px 0 4px;">Resumo dos dados</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:13px;">
        <div>Linhas de venda: <b>${diag.counts.vendasLinhas}</b></div>
        <div>SKUs vendidos: <b>${diag.counts.skusVendidos}</b></div>
        <div>Clientes (SOLD únicos): <b>${diag.counts.clientes}</b></div>
        <div>Vendedores: <b>${diag.counts.vendedores}</b></div>
        <div>Carteira (aba BASE): <b>${diag.counts.carteira!=null ? diag.counts.carteira + ' clientes' : 'não encontrada'}</b></div>
        ${diag.counts.reatribuidas || diag.counts.foraEquipe ? `<div style="grid-column:1/-1;">Vendas de outros vendedores: <b>${fmtInt(diag.counts.reatribuidas)}</b> linhas (${fmtBRL0(diag.counts.reatribuidasFat)}) passaram para o vendedor da equipe que atende o cliente; <b>${fmtInt(diag.counts.foraEquipe)}</b> (${fmtBRL0(diag.counts.foraEquipeFat)}) são de clientes fora da carteira e só entram no total da empresa do Brasileirão.</div>` : ''}
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


/* ==================== PUBLICAÇÃO — os dados ficam no próprio app ====================
   O envio de planilha deixou de ser "só no meu navegador": ele é PUBLICADO em
   /api/snapshot (Vercel Blob do projeto) e passa a valer para todo mundo, em
   qualquer máquina. Cada publicação guarda a versão anterior, então dá para
   voltar atrás. O localStorage continua existindo, mas só como rede de proteção
   para quando a publicação não dá certo (sem rede, ambiente offline).
   ================================================================================ */
const API_SNAPSHOT = '/api/snapshot';

// O JSON vai compactado (gzip) e em base64 — ~800 KB viram ~185 KB, bem dentro do
// limite de corpo da função e com folga de sobra para a base de vendas crescer.
// base64 em vez de binário puro porque o corpo pode ser tratado como texto no
// caminho até a função, o que corromperia os bytes do gzip.
function bytesParaBase64(bytes){
  let bruto = '';
  const passo = 0x8000; // em blocos, para não estourar o limite de argumentos
  for(let i = 0; i < bytes.length; i += passo){
    bruto += String.fromCharCode.apply(null, bytes.subarray(i, i + passo));
  }
  return btoa(bruto);
}
async function corpoCompactado(objeto){
  const texto = JSON.stringify(objeto);
  if(typeof CompressionStream === 'undefined') return {corpo: texto, encoding: ''};
  try {
    const fluxo = new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip'));
    const buffer = await new Response(fluxo).arrayBuffer();
    return {corpo: bytesParaBase64(new Uint8Array(buffer)), encoding: 'gzip+base64'};
  } catch(e){ return {corpo: texto, encoding: ''}; }
}

async function chamarPublicacao(payload){
  const {corpo, encoding} = await corpoCompactado(payload);
  const res = await fetch(API_SNAPSHOT, {
    method: 'POST',
    headers: {'Content-Type': 'text/plain;charset=utf-8', 'x-painel-encoding': encoding},
    body: corpo,
  });
  let dados = {};
  try { dados = await res.json(); } catch(e){}
  if(!res.ok){
    const erro = new Error(dados.erro || `HTTP ${res.status}`);
    erro.status = res.status;
    throw erro;
  }
  return dados;
}

// Publica direto (sem senha — qualquer pessoa com o link pode publicar) e
// devolve o que aconteceu. Nunca lança: quem chama decide o que fazer com cada
// desfecho.
async function publicarNoApp(payload){
  try {
    const meta = await chamarPublicacao(payload);
    return {ok: true, meta};
  } catch(err){
    return {erro: err};
  }
}

// O cadastro completo de produtos é apagado de DATA logo no boot (ele é fixo e
// só serve de apoio), então precisa ser reanexado ao publicar — senão a versão
// publicada chegaria sem ele e o Mapa da Venda ficaria sem os Grupos.
function snapshotCompleto(novoData){
  if(novoData.produtoMaster || !PRODUTO_MASTER_ROWS.length) return novoData;
  return Object.assign({}, novoData, {produtoMaster: {rows: PRODUTO_MASTER_ROWS}});
}

function guardarSomenteNesteNavegador(novoData, nomeArquivo, quandoISO){
  const quando = new Date(quandoISO).toLocaleString('pt-BR');
  try {
    const anterior = localStorage.getItem(LS_KEY);
    const anteriorMeta = localStorage.getItem(LS_META_KEY);
    if(anterior){
      localStorage.setItem(LS_BACKUP_KEY, anterior);
      if(anteriorMeta) localStorage.setItem(LS_BACKUP_META_KEY, anteriorMeta);
    }
    localStorage.setItem(LS_KEY, JSON.stringify(novoData));
    localStorage.setItem(LS_META_KEY, JSON.stringify({filename: nomeArquivo, when: quando, whenISO: quandoISO}));
    return true;
  } catch(err){ return false; }
}

// Linha de status do topo + botão de desfazer, sempre a partir do que o servidor
// diz estar publicado (e não do que este navegador acha que enviou).
async function atualizarBarraPublicacao(){
  let info = null;
  try {
    const r = await fetch(`${API_SNAPSHOT}?historico=1`, {cache: 'no-store'});
    if(r.ok) info = await r.json();
  } catch(e){ /* sem API (ex.: rodando local) — segue com o texto padrão */ }

  const local = (() => { try { return JSON.parse(localStorage.getItem(LS_META_KEY) || 'null'); } catch(e){ return null; } })();
  const publicado = info && info.atual;
  if(local && local.filename){
    setUploadStatus(`Usando planilha só deste navegador: ${local.filename} (${local.when}) — não foi publicada para os outros.`, true);
  } else if(publicado && publicado.quando){
    const quando = new Date(publicado.quando).toLocaleString('pt-BR');
    const oQue = publicado.tipo === 'restauracao' ? 'Versão restaurada' : `Publicado: ${publicado.arquivo}`;
    setUploadStatus(`${oQue} (${quando}) — vale para todos.`, false);
  } else {
    setUploadStatus('Snapshot original, gerado a partir do Excel em 26/08/2026.', false);
  }
  montarBotaoDesfazer((info && info.versoes) || []);
}

function montarBotaoDesfazer(versoes){
  const status = document.getElementById('upload-status');
  if(!status || !status.parentElement) return;
  let botao = document.getElementById('upload-undo');
  if(!versoes.length){ if(botao) botao.remove(); return; }
  if(!botao){
    botao = document.createElement('button');
    botao.id = 'upload-undo';
    botao.type = 'button';
    botao.className = 'upload-clear';
    status.parentElement.appendChild(botao);
  }
  const anterior = versoes[0];
  botao.textContent = 'Desfazer publicação';
  botao.title = `Volta o painel, para todo mundo, à versão de ${new Date(anterior.quando).toLocaleString('pt-BR')}`;
  botao.onclick = async () => {
    if(!confirm(`Voltar o painel à versão anterior (${new Date(anterior.quando).toLocaleString('pt-BR')})? Isso vale para todas as pessoas.`)) return;
    setUploadStatus('Restaurando a versão anterior…', false);
    const r = await publicarNoApp({restaurar: anterior.arquivo});
    if(r.ok){ location.reload(); return; }
    setUploadStatus(`Não consegui restaurar: ${(r.erro && r.erro.message) || r.erro}`, true);
  };
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
          // Os dados já estão valendo nesta tela. Agora eles vão para o próprio
          // app (Vercel Blob), para que todo mundo veja o mesmo — e não só quem
          // enviou. Se a publicação não rolar (rede, ambiente offline), a
          // atualização continua valendo aqui e é guardada neste navegador, com
          // o aviso de que os outros ainda estão vendo a versão anterior.
          const quandoISO = new Date().toISOString();
          input.value = '';
          setUploadStatus(`Publicando ${labelUpper} para todo mundo…`, false);
          publicarNoApp(
            {snapshot: snapshotCompleto(parsed.newData), arquivo: file.name, tipo: labelUpper.toLowerCase()}
          ).then(async r => {
            if(r.ok){
              try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_META_KEY); } catch(e){}
              await atualizarBarraPublicacao();
              setUploadStatus(`${labelUpper} publicado(a) para todos: ${file.name} (${new Date(quandoISO).toLocaleString('pt-BR')}).`, false);
              return;
            }
            const guardou = guardarSomenteNesteNavegador(parsed.newData, file.name, quandoISO);
            const motivo = `não consegui publicar (${(r.erro && r.erro.message) || r.erro})`;
            setUploadStatus(guardou
              ? `${labelUpper} aplicado só neste navegador — ${motivo}.`
              : `${labelUpper} aplicado só nesta tela — ${motivo}, e o navegador também não conseguiu guardar: ao recarregar, volta a versão publicada.`, true);
          });
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
  atualizarBarraPublicacao();

  wireUploadInput('upload-input-estoque', applyEstoqueUpload, 'Estoque');
  wireUploadInput('upload-input-vendas', applyVendasUpload, 'Vendas');

  if(clearBtn) clearBtn.addEventListener('click', async () => {
    // Enquanto existir uma cópia só deste navegador, o botão limpa ela (é o caso
    // mais comum e não mexe no que os outros estão vendo). Sem cópia local, ele
    // faz o que o nome promete: devolve o snapshot original para todo mundo.
    let temLocal = false;
    try { temLocal = !!localStorage.getItem(LS_KEY); } catch(e){}
    if(temLocal){
      try {
        localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_META_KEY);
        localStorage.removeItem(LS_BACKUP_KEY); localStorage.removeItem(LS_BACKUP_META_KEY);
      } catch(e){}
      location.reload();
      return;
    }
    if(!confirm('Voltar o painel ao snapshot original (Excel de 26/08/2026)? Isso vale para todas as pessoas.')) return;
    setUploadStatus('Restaurando o snapshot original…', false);
    try {
      const res = await fetch(SNAPSHOT_ORIGINAL_URL, {cache:'no-cache'});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const original = await res.json();
      const r = await publicarNoApp({snapshot: original, arquivo: 'snapshot original', tipo: 'original'});
      if(r.ok){ location.reload(); return; }
      setUploadStatus(`Não consegui restaurar o original: ${(r.erro && r.erro.message) || r.erro}`, true);
    } catch(err){
      setUploadStatus('Não consegui ler o snapshot original: ' + err.message, true);
    }
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
    periodLabel: () => { const m = cobMesAtual(); return `mês ${m.slice(5,7)}/${m.slice(0,4)} (cliente × vendedor)`; },
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
  // Faltava esta entrada: o botão "Imprimir A4" é injetado em TODAS as abas de
  // TABS por initPrintButtons() sem checar se existe configuração — sem isto,
  // clicar em "Imprimir A4" no Acompanhamento NRAB não fazia nada (openPrintPreview
  // via PRINT_CONFIG['nrab'] indefinido, retorno silencioso). Mesmo padrão do
  // Mapa da Venda: relatório sempre de um cliente, com o SOLD/Razão Social no
  // cabeçalho e aviso se ninguém foi selecionado ainda.
  nrab: {
    title:'Acompanhamento de NRABs', orientation:'landscape', kpi:'kpi-nrab', blocks:[], hideFilters:true,
    tables:[{id:'table-nrab-skus', title:'SKUs em NRAB do cliente'}],
    headerExtra: () => {
      const sel = document.getElementById('nrab-select-sold');
      const sold = sel ? sel.value : '';
      const razao = (document.getElementById('nrab-razao-value')||{}).textContent || '—';
      if(!sold) return '';
      return `<div class="print-filters-row"><span class="print-filter-chip"><b>Cliente (SOLD):</b> ${esc(sold)}</span>`
        + `<span class="print-filter-chip"><b>Razão Social:</b> ${esc(razao)}</span></div>`;
    },
    guard: () => {
      const wrap = document.getElementById('nrab-acompanhamento-wrap');
      const visivel = wrap && wrap.style.display !== 'none';
      return visivel ? null : 'Selecione, na lista de clientes, um SOLD com NRAB cadastrada antes de imprimir — o relatório desta aba é sempre de um cliente.';
    },
  },
  brasileirao: {
    title:'Brasileirão NPRO', orientation:'landscape', kpi:'kpi-br', blocks:[], hideFilters:true,
    get tables(){ return [{id:'table-br-ranking', title:'Ranking'}, {id:'table-br-cob', title:'Cobertura'}, {id:'table-br-vbc', title:'VBC'},
      ...BR_SUBCATS.map((sub, i) => ({id:'table-br-sub-'+i, title: sub})), {id:'table-br-totais', title:'Total por Setor x objetivo'},
      {id:'table-br-cli', title:'Por cliente'}]; },
    periodLabel: () => document.getElementById('br-info').textContent,
    headerExtra: () => {
      const st = document.getElementById('br-setor').value, mes = document.getElementById('br-mes').value;
      return `<div class="print-filters-row"><span class="print-filter-chip"><b>Setor:</b> ${esc(brLabel(st))}</span>`
        + `<span class="print-filter-chip"><b>Mês:</b> ${esc(mes.slice(5,7) + '/' + mes.slice(0,4))}</span>`
        + `<span class="br-print-logos"><img src="assets/logo-brasileirao-escudo.png" alt=""><img src="assets/logo-brasileirao-titulo.png" alt="Brasileirão Professional 2026"></span></div>`;
    },
  },
  crescer: {
    title:'Crescer + — Resumo', orientation:'landscape', kpi:'kpi-crescer', blocks:[], hideFilters:true,
    tables:[{id:'table-crescer-cob', title:'Cobertura'}, {id:'table-crescer-vbc', title:'VBC'},
      {id:'table-crescer-cob-vend', title:'Cobertura por vendedor'}, {id:'table-crescer-vbc-vend', title:'VBC por vendedor'},
      {id:'table-crescer-cli', title:'Acompanhamento por cliente'}],
    periodLabel: () => document.getElementById('cr-info').textContent,
    headerExtra: () => {
      const setor = document.getElementById('cr-setor').value, mes = document.getElementById('cr-mes').value;
      return `<div class="print-filters-row"><span class="print-filter-chip"><b>Setor:</b> ${esc(crSetorLabel(setor))}</span>`
        + `<span class="print-filter-chip"><b>Mês:</b> ${esc(mes.slice(5,7) + '/' + mes.slice(0,4))}</span>`
        + `<span class="cr-print-crescer"><img src="assets/logo-crescer-brokers.png" alt="Nestlé Crescer Brokers"></span></div>`;
    },
  },
  semcompra: {
    title:'Clientes sem Compra', orientation:'landscape', kpi:'kpi-semcompra', blocks:[], hideFilters:true,
    tables:[{id:'table-semcompra', title:'Clientes sem compra'}, {id:'table-semcompra-vend', title:'Resumo por vendedor'}],
    periodLabel: () => {
      const f = scLerFiltros();
      return `carteira com visita de ${fmtDateBR(f.deMs)} a ${fmtDateBR(f.ateMs)}`;
    },
    headerExtra: () => {
      const f = scLerFiltros();
      const chips = [];
      if(f.supervisor) chips.push(['Supervisor', scSupervisorLabel(f.supervisor)]);
      if(f.vendedor) chips.push(['Vendedor', scVendedorLabel(f.vendedor)]);
      if(f.quinzena) chips.push(['Quinzena', f.quinzena==='13' ? 'Semanas 1 e 3' : 'Semanas 2 e 4']);
      if(f.dia) chips.push(['Dia de visita', SC_DIAS[f.dia]]);
      if(f.cliente) chips.push(['Cliente', f.cliente]);
      if(!chips.length) chips.push(['Filtros', 'Carteira completa']);
      return '<div class="print-filters-row">' + chips.map(([k,v]) => `<span class="print-filter-chip"><b>${esc(k)}:</b> ${esc(v)}</span>`).join('') + '</div>';
    },
    guard: () => {
      const wrap = document.getElementById('sc-wrap');
      return wrap && wrap.style.display !== 'none' ? null : 'Carregue a carteira (planilha de Vendas) e informe um período válido antes de imprimir.';
    },
  },
  meta20: {
    title:'Meta 20+', orientation:'landscape', kpi:'kpi-meta20', blocks:[], hideFilters:true,
    tables:[{id:'table-meta20', title:'Top 20 clientes'}],
    headerExtra: () => {
      const variante = (document.getElementById('meta20-select-variante')||{}).value || '';
      const setor = (document.getElementById('meta20-select-setor')||{}).value || '';
      if(!setor) return '';
      return `<div class="print-filters-row"><span class="print-filter-chip"><b>Visão:</b> ${esc(variante.toUpperCase())}</span>`
        + `<span class="print-filter-chip"><b>Setor/Empresa:</b> ${esc(setor)}</span></div>`;
    },
    guard: () => {
      const wrap = document.getElementById('meta20-wrap');
      const visivel = wrap && wrap.style.display !== 'none';
      return visivel ? null : 'Selecione uma Visão e um Setor/Empresa antes de imprimir — o relatório desta aba é sempre de um recorte específico.';
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
    cal: {yCur, yPrev, mCur},
  };
}

// Igual à convenção contábil da planilha original: valor monetário exatamente
// zero é exibido como "—" (mesmo tratamento visual de "sem valor"), em vez de
// "R$ 0,00" — só afeta a exibição, o valor de 0 continua correto no cálculo.
const fmtBRLMapa = n => (n==null||isNaN(n)||n===0) ? "—" : fmtBRL(n);
// Os grupos NPRO ("01-NP LACTEOS", "02-NP CHOCOLATES", ... "99-NP INATIVOS") são o
// foco do Mapa da Venda: ficam sempre no topo da Visão por Grupo, antes do restante
// do cadastro, independente da coluna que estiver ordenando a tabela.
const ehGrupoNP = nome => /^\s*(\d+\s*-\s*)?NP(RO)?\b/i.test(String(nome==null?'':nome));
// Os rótulos NÃO citam o nome do mês corrente (ex.: "Setembro-26") de propósito
// — a pedido do usuário: o painel é usado ano após ano e mês após mês, e um
// rótulo com o nome do mês fixo no cabeçalho ficava "preso" ao mês em que foi
// olhado, confundindo quem reabrisse a aba em outro mês/ano. "Ano Anterior"/
// "Ano Atual" e "Mês Atual" continuam corretos em qualquer mês, porque o valor
// por trás de cada coluna já é recalculado a partir de cal.mCur/yCur/yPrev.
function mapaVendaHeaders(cal){
  return [
    {key:'acumAnterior', label:'Acumulado Ano Anterior', format:fmtBRLMapa, align:'right'},
    {key:'acumAtual', label:'Acumulado Ano Atual', format:fmtBRLMapa, align:'right'},
    {key:'crescAno', label:'%Cresc./Qued. Ano ant.', format:fmtPct, align:'right'},
    {key:'media3m', label:'Venda Média Últ. 3 meses', format:fmtBRLMapa, align:'right'},
    {key:'mesAnoAnterior', label:'Mês Atual — Ano Anterior', format:fmtBRLMapa, align:'right'},
    {key:'growth', label:'%Cresc. (meta)', format:fmtPct, align:'right'},
    {key:'meta', label:'Meta', format:fmtBRLMapa, align:'right'},
    {key:'mesAtual', label:'Mês Atual — Ano Atual', format:fmtBRLMapa, align:'right'},
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
    prioridade: r => ehGrupoNP(r.label),
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

/* ============================================================================
   ACOMPANHAMENTO DE NRAB — módulo isolado, adicionado por cima do sistema
   existente sem mexer no motor de recálculo por período, no upload/publicação
   de Estoque/Vendas, nem em nenhuma outra aba.
   ----------------------------------------------------------------------------
   O cadastro de NRABs (SOLD + SKU + regra "compra X, leva Y" + data de início)
   fica num campo PRÓPRIO e separado — DATA.nrab.registros — nunca dentro de
   DATA.baseVendas: editar ou excluir uma NRAB não apaga nem altera nenhuma
   linha do histórico de vendas. Mas, a pedido do usuário, esse cadastro
   PRECISA aparecer para todo mundo que abrir o link — então cada
   adicionar/editar/excluir publica automaticamente uma nova versão do
   snapshot (mesmo mecanismo /api/snapshot do Enviar Estoque/Enviar Vendas),
   preservando vendas/estoque como estão. Se a publicação não rolar (rede
   fora, por exemplo), a mudança some na tela e a pessoa é avisada — em vez de
   fingir que salvou só para ela, o que criaria versões divergentes do
   cadastro entre navegadores.
   O acompanhamento em si continua 100% derivado: lê DATA.baseVendas (só
   leitura) toda vez que é desenhado, então reage sozinho a qualquer novo
   Enviar Vendas e a qualquer edição no cadastro de NRAB.
   ========================================================================= */
let NRAB_REGISTROS = [];
let nrabEditId = null;
let nrabSelectedSold = '';
let nrabPublicando = false;

// Fonte de verdade = DATA.nrab.registros (parte do snapshot publicado). Chamado
// no início de todo render da aba, então acompanha qualquer Enviar Vendas/
// Enviar Estoque e qualquer publicação feita a partir daqui.
function nrabSyncFromData(){
  NRAB_REGISTROS = (DATA.nrab && Array.isArray(DATA.nrab.registros)) ? DATA.nrab.registros : [];
}

function nrabProximoId(){ return 'nrab_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

// Publica QUALQUER campo extra de DATA (cadastros feitos aqui no app, como o de
// NRAB ou o de Metas do Meta 20+) pelo mesmo mecanismo /api/snapshot do Enviar
// Estoque/Enviar Vendas — para valer para todos. Se a publicação falhar, desfaz
// a mudança local (DATA volta ao estado anterior) em vez de deixar o cadastro
// divergente entre navegadores.
async function publicarCampoDATA(campoNome, valor, arquivo, tipo){
  const dataAnterior = DATA;
  DATA = Object.assign({}, DATA, {[campoNome]: valor});
  const r = await publicarNoApp({snapshot: snapshotCompleto(DATA), arquivo, tipo});
  if(r.ok){
    await atualizarBarraPublicacao();
    return {ok:true};
  }
  DATA = dataAnterior;
  return {ok:false, erro:r.erro};
}

// SOLD+SKU é a chave natural de uma NRAB — cadastrar de novo o mesmo par
// atualiza a regra vigente em vez de duplicar (a pedido do usuário: "alterar
// posteriormente as regras de cada SKU sem precisar excluir e cadastrar tudo
// novamente").
function nrabPublicarLista(novaLista){
  return publicarCampoDATA('nrab', {registros: novaLista}, 'cadastro de NRAB', 'nrab');
}
async function nrabUpsert(rec){
  const lista = NRAB_REGISTROS.slice();
  const idxMesmoParNoutroId = lista.findIndex(r =>
    String(r.sold)===String(rec.sold) && String(r.sku)===String(rec.sku) && r.id!==rec.id);
  if(idxMesmoParNoutroId>=0){
    lista[idxMesmoParNoutroId] = Object.assign({}, lista[idxMesmoParNoutroId], rec, {id: lista[idxMesmoParNoutroId].id});
  } else {
    const idxExistente = lista.findIndex(r => r.id===rec.id);
    if(idxExistente>=0) lista[idxExistente] = Object.assign({}, lista[idxExistente], rec);
    else lista.push(rec);
  }
  return nrabPublicarLista(lista);
}
async function nrabDelete(id){
  const lista = NRAB_REGISTROS.filter(r => r.id!==id);
  return nrabPublicarLista(lista);
}

function nrabMesOffset(mesYYYYMM, offset){
  const [y,m] = mesYYYYMM.split('-').map(Number);
  let ano = y, mes = m + offset;
  while(mes<1){ mes += 12; ano--; }
  while(mes>12){ mes -= 12; ano++; }
  return ano + '-' + String(mes).padStart(2,'0');
}

// Apuração de uma NRAB (um SOLD+SKU): meses -3/-2/-1/ação a partir da data de
// início cadastrada, e o realizado desde então ("período da ação"). NRABs
// realizadas = soma, por Nº DE PEDIDO, de floor(unidades do pedido ÷ "leva") —
// nunca somando pedidos diferentes entre si (regra explícita do usuário).
function computeSkuNrab(rec){
  const sold = String(rec.sold), sku = String(rec.sku);
  const mesAcao = String(rec.dataInicio).slice(0,7);
  const mesM1 = nrabMesOffset(mesAcao,-1), mesM2 = nrabMesOffset(mesAcao,-2), mesM3 = nrabMesOffset(mesAcao,-3);
  const linhas = (DATA.baseVendas||[]).filter(r => String(r[0])===sold && String(r[4])===sku);

  const somaUnidNoMes = mes => linhas
    .filter(r => String(r[3]||'').slice(0,7)===mes)
    .reduce((s,r) => s + (Number(r[10])||0), 0);
  const valM3 = somaUnidNoMes(mesM3), valM2 = somaUnidNoMes(mesM2), valM1 = somaUnidNoMes(mesM1), valAcao = somaUnidNoMes(mesAcao);
  const media3 = (valM3+valM2+valM1)/3;

  const linhasPeriodo = linhas.filter(r => String(r[3]||'') >= String(rec.dataInicio));
  const qtdPeriodo = linhasPeriodo.reduce((s,r) => s + (Number(r[10])||0), 0);
  const fatPeriodo = linhasPeriodo.reduce((s,r) => s + (Number(r[9])||0), 0);

  const unidPorPedido = new Map();
  linhasPeriodo.forEach(r => {
    const pedido = String(r[2]);
    unidPorPedido.set(pedido, (unidPorPedido.get(pedido)||0) + (Number(r[10])||0));
  });
  const leva = Number(rec.leva)||0;
  let nrabsRealizadas = 0;
  if(leva>0) unidPorPedido.forEach(qtd => { nrabsRealizadas += Math.floor(qtd/leva); });

  let evolucaoPct = null;
  if(media3>0) evolucaoPct = (valAcao-media3)/media3;
  else if(valAcao>0) evolucaoPct = Infinity; // sem base de comparação (média = 0)

  return {
    mesM3:{key:mesM3,val:valM3}, mesM2:{key:mesM2,val:valM2}, mesM1:{key:mesM1,val:valM1}, mesAcao:{key:mesAcao,val:valAcao},
    media3, qtdPeriodo, fatPeriodo, pedidos: unidPorPedido.size, nrabsRealizadas, evolucaoPct,
  };
}

function nrabMsg(texto, tipo){
  const el = document.getElementById('nrab-form-msg');
  if(!el) return;
  el.textContent = texto || '';
  el.className = 'nrab-msg' + (tipo==='erro' ? ' is-error' : tipo==='ok' ? ' is-ok' : '');
}

function nrabResetForm(){
  nrabEditId = null;
  const form = document.getElementById('nrab-form');
  if(form) form.reset();
  document.getElementById('nrab-form-title').textContent = 'Cadastrar NRAB';
  document.getElementById('nrab-input-status').value = 'Ativa';
  document.getElementById('nrab-btn-salvar').textContent = 'Salvar NRAB';
  document.getElementById('nrab-btn-cancelar').style.display = 'none';
}

function nrabPreencherForm(rec){
  nrabEditId = rec.id;
  document.getElementById('nrab-form-title').textContent = `Editar NRAB — SOLD ${rec.sold} / SKU ${rec.sku}`;
  document.getElementById('nrab-input-sold').value = rec.sold;
  document.getElementById('nrab-input-sku').value = rec.sku;
  document.getElementById('nrab-input-data').value = rec.dataInicio;
  document.getElementById('nrab-input-compra').value = rec.compra;
  document.getElementById('nrab-input-leva').value = rec.leva;
  document.getElementById('nrab-input-status').value = rec.status;
  document.getElementById('nrab-btn-salvar').textContent = 'Atualizar NRAB';
  document.getElementById('nrab-btn-cancelar').style.display = '';
  window.scrollTo({top:0, behavior:'smooth'});
}

function renderNrabCadastroTable(){
  const wrap = document.getElementById('table-nrab-cadastro');
  if(!wrap) return;
  makeTable('table-nrab-cadastro', {
    headers: [
      {key:'sold', label:'SOLD'},
      {key:'razao', label:'Razão Social'},
      {key:'sku', label:'SKU'},
      {key:'descricao', label:'Descrição'},
      {key:'regra', label:'Regra'},
      {key:'dataInicio', label:'Início', format:v => v ? esc(String(v).split('-').reverse().join('/')) : '—'},
      {key:'status', label:'Status'},
      {key:'acoes', label:'', format:v=>v},
    ],
    rows: NRAB_REGISTROS,
    getRow: r => {
      const meta = (typeof clienteMetaMap!=='undefined' && clienteMetaMap) ? clienteMetaMap.get(String(r.sold)) : null;
      const skuMeta = (typeof skuMaster!=='undefined' && skuMaster) ? skuMaster.get(String(r.sku)) : null;
      return {
        sold: r.sold, razao: (meta && meta.razaoSocial) || '—',
        sku: r.sku, descricao: (skuMeta && skuMeta.material) || '—',
        regra: `Compra ${r.compra} → Leva ${r.leva}`, dataInicio: r.dataInicio, status: r.status,
        acoes: `<div class="nrab-actions-cell">
          <button type="button" class="nrab-link-btn" data-nrab-edit="${esc(r.id)}">Editar</button>
          <button type="button" class="nrab-link-btn is-danger" data-nrab-del="${esc(r.id)}">Excluir</button>
        </div>`,
      };
    },
    searchable: true, pageSize: 10, defaultSort: {key:'sold', dir:'asc'},
  });
  // Delegação de evento no container (e não nos botões): a tabela recria o
  // <tbody> a cada busca/ordenação/paginação, então um listener preso ao botão
  // seria perdido — preso ao container ele sobrevive a qualquer re-render.
  if(!wrap._nrabWired){
    wrap.addEventListener('click', e => {
      const editBtn = e.target.closest('[data-nrab-edit]');
      if(editBtn){
        const rec = NRAB_REGISTROS.find(r => r.id===editBtn.dataset.nrabEdit);
        if(rec) nrabPreencherForm(rec);
        return;
      }
      const delBtn = e.target.closest('[data-nrab-del]');
      if(delBtn){
        const rec = NRAB_REGISTROS.find(r => r.id===delBtn.dataset.nrabDel);
        if(!rec || nrabPublicando) return;
        if(!confirm(`Excluir a NRAB do SOLD ${rec.sold} / SKU ${rec.sku}? Vale para todos que acessam o link. O histórico de vendas não é alterado.`)) return;
        nrabPublicando = true;
        nrabMsg('Publicando exclusão para todos…', '');
        nrabDelete(rec.id).then(r => {
          nrabPublicando = false;
          if(r.ok){
            if(nrabEditId===rec.id) nrabResetForm();
            nrabMsg(`NRAB do SOLD ${rec.sold} / SKU ${rec.sku} excluída para todos.`, 'ok');
          } else {
            nrabMsg(`Não consegui publicar a exclusão (${(r.erro && r.erro.message) || r.erro}) — nada foi alterado.`, 'erro');
          }
          renderNrab();
        });
      }
    });
    wrap._nrabWired = true;
  }
}

function renderNrabSelectSold(){
  const sel = document.getElementById('nrab-select-sold');
  if(!sel) return;
  const solds = Array.from(new Set(NRAB_REGISTROS.map(r => String(r.sold)))).sort((a,b) => a.localeCompare(b,'pt-BR',{numeric:true}));
  const desejado = solds.includes(sel.value) ? sel.value : (solds.includes(nrabSelectedSold) ? nrabSelectedSold : '');
  sel.innerHTML = '<option value="">Selecione um cliente…</option>' + solds.map(s => {
    const meta = (typeof clienteMetaMap!=='undefined' && clienteMetaMap) ? clienteMetaMap.get(s) : null;
    const label = meta && meta.razaoSocial ? `${s} — ${meta.razaoSocial}` : s;
    return `<option value="${esc(s)}">${esc(label)}</option>`;
  }).join('');
  sel.value = desejado;
}

function renderNrabAcompanhamento(){
  const sel = document.getElementById('nrab-select-sold');
  const wrap = document.getElementById('nrab-acompanhamento-wrap');
  const hint = document.getElementById('nrab-empty-hint');
  const razaoEl = document.getElementById('nrab-razao-value');
  if(!sel || !wrap || !hint || !razaoEl) return;
  const sold = sel.value;
  nrabSelectedSold = sold;

  const registros = sold ? NRAB_REGISTROS.filter(r => String(r.sold)===sold) : [];
  if(!sold || !registros.length){
    wrap.style.display = 'none'; hint.style.display = '';
    razaoEl.textContent = '—';
    return;
  }
  hint.style.display = 'none'; wrap.style.display = '';
  const meta = (typeof clienteMetaMap!=='undefined' && clienteMetaMap) ? clienteMetaMap.get(sold) : null;
  razaoEl.textContent = (meta && meta.razaoSocial) || '—';

  const linhas = registros.map(rec => {
    const calc = computeSkuNrab(rec);
    const skuMeta = (typeof skuMaster!=='undefined' && skuMaster) ? skuMaster.get(String(rec.sku)) : null;
    return Object.assign({rec, descricao: (skuMeta && skuMeta.material) || '—'}, calc);
  });

  const totalNrabs = linhas.reduce((s,l) => s+l.nrabsRealizadas, 0);
  const totalPedidos = linhas.reduce((s,l) => s+l.pedidos, 0);
  const evoValidas = linhas.filter(l => isFinite(l.evolucaoPct));
  const evoMedia = evoValidas.length ? evoValidas.reduce((s,l) => s+l.evolucaoPct, 0)/evoValidas.length : null;

  renderKPIs('kpi-nrab', [
    {label:'SKUs em NRAB', value: fmtInt(registros.length)},
    {label:'NRABs realizadas (total)', value: fmtInt(totalNrabs)},
    {label:'Pedidos com SKU(s) em NRAB', value: fmtInt(totalPedidos)},
    {label:'Evolução média vs. 3 meses antes', value: evoMedia==null ? '—' : (evoMedia>=0?'+':'')+fmtPct(evoMedia), tone: evoMedia==null ? undefined : (evoMedia>=0?'good':'critical')},
  ]);

  const fmtEvolucao = l => {
    if(l.evolucaoPct==null) return '—';
    if(!isFinite(l.evolucaoPct)) return 'Novo (sem venda nos 3 meses anteriores)';
    return (l.evolucaoPct>=0?'+':'') + fmtPct(l.evolucaoPct);
  };

  makeTable('table-nrab-skus', {
    headers: [
      {key:'sku', label:'SKU'},
      {key:'descricao', label:'Descrição'},
      {key:'regra', label:'Regra NRAB'},
      {key:'m3', label:'Mês -3', align:'right', format:fmtInt},
      {key:'m2', label:'Mês -2', align:'right', format:fmtInt},
      {key:'m1', label:'Mês -1', align:'right', format:fmtInt},
      {key:'macao', label:'Mês da ação', align:'right', format:fmtInt},
      {key:'qtdPeriodo', label:'Vendido no período da ação', align:'right', format:fmtInt},
      {key:'pedidos', label:'Nº de pedidos', align:'right', format:fmtInt},
      {key:'nrabsRealizadas', label:'NRABs realizadas', align:'right', format:fmtInt},
      {key:'evolucao', label:'Evolução vs. média anterior', align:'right'},
      {key:'status', label:'Status'},
    ],
    rows: linhas,
    getRow: l => ({
      sku: l.rec.sku, descricao: l.descricao, regra: `Compra ${l.rec.compra} → Leva ${l.rec.leva}`,
      m3: l.mesM3.val, m2: l.mesM2.val, m1: l.mesM1.val, macao: l.mesAcao.val,
      qtdPeriodo: l.qtdPeriodo, pedidos: l.pedidos, nrabsRealizadas: l.nrabsRealizadas,
      evolucao: fmtEvolucao(l), status: l.rec.status,
    }),
    searchable: false, pageSize: 20, defaultSort: {key:'sku', dir:'asc'},
  });
}

// Datalists (SOLD e SKU) do formulário de cadastro — mesmo padrão já usado no
// Mapa da Venda (input com autocomplete nativo, sem travar o campo a um <select>
// de milhares de opções). Refeitas a cada render para acompanhar Enviar Vendas.
function renderNrabDatalists(){
  const soldDatalist = document.getElementById('nrab-sold-list');
  if(soldDatalist) soldDatalist.innerHTML = (DATA.clientes||[]).map(c =>
    `<option value="${esc(String(c[0]))}">${esc(c[1]||'')}</option>`).join('');
  const skuDatalist = document.getElementById('nrab-sku-list');
  if(skuDatalist && DATA.sku && DATA.sku.headers){
    const h = DATA.sku.headers;
    const iCode = h.indexOf('SKU'), iMat = h.indexOf('Material');
    skuDatalist.innerHTML = (DATA.sku.rows||[]).map(r =>
      `<option value="${esc(String(r[iCode]))}">${esc(r[iMat]||'')}</option>`).join('');
  }
}

function renderNrab(){
  nrabSyncFromData();
  renderNrabDatalists();
  renderNrabCadastroTable();
  renderNrabSelectSold();
  renderNrabAcompanhamento();
}

function initNrab(){
  const form = document.getElementById('nrab-form');
  if(!form) return; // aba não presente neste HTML — módulo fica inerte
  form.addEventListener('submit', e => {
    e.preventDefault();
    if(nrabPublicando) return;
    const sold = document.getElementById('nrab-input-sold').value.trim();
    const sku = document.getElementById('nrab-input-sku').value.trim();
    const dataInicio = document.getElementById('nrab-input-data').value;
    const compra = Number(document.getElementById('nrab-input-compra').value);
    const leva = Number(document.getElementById('nrab-input-leva').value);
    const status = document.getElementById('nrab-input-status').value;
    if(!sold || !sku || !dataInicio || !compra || !leva){
      nrabMsg('Preencha SOLD, SKU, data de início, compra e leva.', 'erro');
      return;
    }
    if(leva<=compra){
      nrabMsg('A quantidade "Leva" deve ser maior que a quantidade "Compra".', 'erro');
      return;
    }
    const rec = {id: nrabEditId || nrabProximoId(), sold, sku, dataInicio, compra, leva, status};
    nrabPublicando = true;
    const btn = document.getElementById('nrab-btn-salvar');
    if(btn) btn.disabled = true;
    nrabMsg('Publicando NRAB para todos…', '');
    nrabUpsert(rec).then(r => {
      nrabPublicando = false;
      if(btn) btn.disabled = false;
      if(r.ok){
        nrabMsg(`NRAB do SOLD ${sold} / SKU ${sku} salva e publicada para todos.`, 'ok');
        nrabResetForm();
      } else {
        nrabMsg(`Não consegui publicar (${(r.erro && r.erro.message) || r.erro}) — nada foi alterado. Tente de novo.`, 'erro');
      }
      renderNrab();
    });
  });
  document.getElementById('nrab-btn-cancelar').addEventListener('click', () => { nrabResetForm(); nrabMsg('', ''); });
  document.getElementById('nrab-select-sold').addEventListener('change', renderNrabAcompanhamento);
  RENDERERS.nrab = renderNrab;
  nrabMigrarLocalStorageAntigo();
}

// Versões anteriores guardavam o cadastro só no localStorage deste navegador
// (LS_NRAB_LEGACY_KEY). Na primeira vez que a aba carrega depois desta
// atualização, se ainda não existe nada publicado (DATA.nrab vazio), essas
// NRABs "presas" neste navegador são publicadas automaticamente — assim elas
// passam a valer para todo mundo em vez de sumirem silenciosamente.
const LS_NRAB_LEGACY_KEY = 'npro_nrab_registros_v1';
async function nrabMigrarLocalStorageAntigo(){
  if(DATA.nrab && Array.isArray(DATA.nrab.registros) && DATA.nrab.registros.length) return;
  let legado = [];
  try { const raw = localStorage.getItem(LS_NRAB_LEGACY_KEY); legado = raw ? JSON.parse(raw) : []; }
  catch(e){ legado = []; }
  if(!Array.isArray(legado) || !legado.length) return;
  const r = await nrabPublicarLista(legado);
  if(r.ok){
    try { localStorage.removeItem(LS_NRAB_LEGACY_KEY); } catch(e){}
    renderNrab();
  }
}

/* ============================================================================
   META 20+ (BRN2 / BRN8 / EMPRESA) — módulo isolado, adicionado por cima do
   sistema existente.
   ----------------------------------------------------------------------------
   Replica o relatório Excel "META VS 20+BRN2.xlsx": ranking dos 20 clientes
   com maior faturamento por Setor (ou da Empresa toda, na visão Empresa) num
   trimestre, comparando a meta do Setor — repartida entre os clientes pela
   representatividade de cada um — contra o realizado no mês.
   Fonte de dados: a própria planilha de Vendas (botão "Enviar Vendas") — não
   existe mais um arquivo Meta 20+ separado. O faturamento sai de
   DATA.baseVendas, separado pela Origem de cada linha (mesma divisão do
   arquivo antigo):
     BRN2    = tudo que não é BEBIDAS (NPRO + Varejo), por Setor
     BRN8    = BEBIDAS, por Setor
     EMPRESA = tudo, chave única META20_CHAVE_EMPRESA
     VAREJO  = só Varejo, por Setor (coluna de comparação)
   Razão Social / Setor do cliente, Dia de Visita / Ciclo e o par
   Setor->Vendedor vêm da aba "BASE" da mesma planilha (DATA.meta20).
   A meta de cada Setor/Empresa é um cadastro à parte (DATA.meta20Objetivos),
   editável aqui no app, porque no Excel original ela já era um valor de
   entrada mantido fora do cálculo (aba "obj"), não algo derivado da planilha.
   ========================================================================= */

const META20_CHAVE_EMPRESA = '1'; // código da Empresa usado no cadastro de metas

/* ---------------------- Upload de Vendas: aba BASE (cadastro de clientes) ---------------------- */
// Sold -> Razão Social -> Setor, Sold -> Dia de Visita -> Ciclo e Setor ->
// Vendedor — o Excel usa VLOOKUP (primeira ocorrência vence); aqui replicamos
// isso só guardando a primeira linha vista por Sold/Setor.
// A aba traz blocos com cabeçalhos de mesmo nome ("Setor" aparece várias vezes:
// junto do cliente/Sold e, ao lado de "Vendedor", como tabela de apoio
// Setor->Vendedor). headerIndexMap só guarda a ÚLTIMA coluna de cada nome
// repetido, então em vez de confiar no nome "Setor" para achar a coluna do
// cliente, usamos a coluna logo depois de "Razão Social"; e para o par
// Setor->Vendedor usamos a coluna logo ANTES de "Vendedor" (nome que só
// aparece uma vez com essa grafia, esse é confiável).
async function lerGridAbaBase(wb, buf, zipEntries){
  const realName = findSheetName(wb, 'BASE');
  if(!realName) return null;
  try { return await getSheetGridRobust(wb, buf, zipEntries, realName); }
  catch(e){ return null; }
}
function parseMeta20BaseSheet(grid){
  const vazio = null;
  if(!grid) return vazio;
  const headerRow = findHeaderRowByAnchor(grid, 'Sold', 8);
  if(!headerRow) return vazio;
  const map = headerIndexMap(grid, headerRow);
  const cSold = optCol(map,'Sold'); if(!cSold) return vazio;
  const cRazao = optCol(map,'Razão Social');
  const cSetorCliente = cRazao ? cRazao+1 : null;
  const cVisita = optCol(map,'Dia de Visita'), cCiclo = optCol(map,'Ciclo');
  const cVendedor = optCol(map,'Vendedor');
  const cSetorVendedor = cVendedor ? cVendedor-1 : null;

  const clientes = [], visitas = [];
  const soldsVistos = new Set();
  const vendedorPorSetor = new Map();
  let blankStreak = 0;
  for(let r=headerRow+1; r<=grid.length && blankStreak<15; r++){
    const soldV = ocell(grid,r,cSold);
    if(cSetorVendedor && cVendedor){
      const setorV = ocell(grid,r,cSetorVendedor), vendedorV = ocell(grid,r,cVendedor);
      if(setorV!=null && !vendedorPorSetor.has(String(setorV))){
        vendedorPorSetor.set(String(setorV), vendedorV!=null ? String(vendedorV).trim() : null);
      }
    }
    if(soldV==null){ blankStreak++; continue; }
    blankStreak = 0;
    const sold = String(soldV);
    if(soldsVistos.has(sold)) continue;
    soldsVistos.add(sold);
    clientes.push([sold, cRazao?ocell(grid,r,cRazao):null, cSetorCliente?ocell(grid,r,cSetorCliente):null]);
    const visita = cVisita ? ocell(grid,r,cVisita) : null;
    const ciclo = cCiclo ? ocell(grid,r,cCiclo) : null;
    visitas.push([sold, typeof visita==='string' ? visita.trim() : visita, typeof ciclo==='string' ? ciclo.trim() : ciclo]);
  }
  return {clientes, visitas, vendedoresPorSetor: Array.from(vendedorPorSetor.entries())};
}

/* ---------------------- Faturamento derivado de DATA.baseVendas ---------------------- */
// Linhas no formato [chave, faturamento, sold, dataISO] — o mesmo que o motor
// de ranking já usava. Recalculado só quando DATA.baseVendas muda.
let _meta20FatCache = {fonte: null, dados: null};
function meta20Faturamento(){
  const base = DATA.baseVendas || [];
  if(_meta20FatCache.fonte===base) return _meta20FatCache.dados;
  const brn2 = [], brn8 = [], empresa = [], varejo = [];
  for(const r of base){
    const setor = r[1]!=null ? String(r[1]) : null;
    const sold = String(r[0]);
    const data = r[3] || null;
    const fat = Number(r[9]) || 0;
    const origem = r[7];
    empresa.push([META20_CHAVE_EMPRESA, fat, sold, data]);
    if(origem==='BEBIDAS') brn8.push([setor, fat, sold, data]);
    else brn2.push([setor, fat, sold, data]);
    if(origem==='Varejo') varejo.push([setor, fat, sold, data]);
  }
  const dados = {brn2, brn8, empresa, varejo};
  _meta20FatCache = {fonte: base, dados};
  return dados;
}

/* ---------------------- Cadastro de Metas (Setor/Empresa -> Objetivo) ---------------------- */
let META20_OBJETIVOS = [];
let meta20ObjEditId = null;
let meta20Publicando = false;

function meta20SyncFromData(){
  META20_OBJETIVOS = (DATA.meta20Objetivos && Array.isArray(DATA.meta20Objetivos.registros)) ? DATA.meta20Objetivos.registros : [];
}
function meta20ObjProximoId(){ return 'meta20obj_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

// Setor é a chave natural da meta — cadastrar de novo o mesmo Setor atualiza o
// valor em vez de duplicar (mesma convenção do cadastro de NRAB).
function meta20ObjUpsert(rec){
  const lista = META20_OBJETIVOS.slice();
  const idxMesmoSetorNoutroId = lista.findIndex(r => String(r.setor)===String(rec.setor) && r.id!==rec.id);
  if(idxMesmoSetorNoutroId>=0){
    lista[idxMesmoSetorNoutroId] = Object.assign({}, lista[idxMesmoSetorNoutroId], rec, {id: lista[idxMesmoSetorNoutroId].id});
  } else {
    const idxExistente = lista.findIndex(r => r.id===rec.id);
    if(idxExistente>=0) lista[idxExistente] = Object.assign({}, lista[idxExistente], rec);
    else lista.push(rec);
  }
  return publicarCampoDATA('meta20Objetivos', {registros: lista}, 'metas do Meta 20+', 'meta20-objetivos');
}
function meta20ObjDelete(id){
  const lista = META20_OBJETIVOS.filter(r => r.id!==id);
  return publicarCampoDATA('meta20Objetivos', {registros: lista}, 'metas do Meta 20+', 'meta20-objetivos');
}

function meta20ObjMsg(texto, tipo){
  const el = document.getElementById('meta20-obj-form-msg');
  if(!el) return;
  el.textContent = texto || '';
  el.className = 'nrab-msg' + (tipo==='erro' ? ' is-error' : tipo==='ok' ? ' is-ok' : '');
}
function meta20ObjResetForm(){
  meta20ObjEditId = null;
  const form = document.getElementById('meta20-obj-form');
  if(form) form.reset();
  document.getElementById('meta20-obj-form-title').textContent = 'Cadastrar Meta do Setor';
  document.getElementById('meta20-obj-btn-salvar').textContent = 'Salvar Meta';
  document.getElementById('meta20-obj-btn-cancelar').style.display = 'none';
}
function meta20ObjPreencherForm(rec){
  meta20ObjEditId = rec.id;
  document.getElementById('meta20-obj-form-title').textContent = `Editar Meta — Setor ${rec.setor}`;
  document.getElementById('meta20-obj-input-setor').value = rec.setor;
  document.getElementById('meta20-obj-input-valor').value = rec.objetivo;
  document.getElementById('meta20-obj-btn-salvar').textContent = 'Atualizar Meta';
  document.getElementById('meta20-obj-btn-cancelar').style.display = '';
  window.scrollTo({top:0, behavior:'smooth'});
}

function renderMeta20ObjTable(){
  const wrap = document.getElementById('table-meta20-obj');
  if(!wrap) return;
  makeTable('table-meta20-obj', {
    headers: [
      {key:'setor', label:'Setor'},
      {key:'objetivo', label:'Objetivo (R$/mês)', align:'right', format:fmtBRL0},
      {key:'acoes', label:'', format:v=>v},
    ],
    rows: META20_OBJETIVOS,
    getRow: r => ({
      setor: r.setor, objetivo: r.objetivo,
      acoes: `<div class="nrab-actions-cell">
        <button type="button" class="nrab-link-btn" data-meta20obj-edit="${esc(r.id)}">Editar</button>
        <button type="button" class="nrab-link-btn is-danger" data-meta20obj-del="${esc(r.id)}">Excluir</button>
      </div>`,
    }),
    searchable: true, pageSize: 10, defaultSort: {key:'setor', dir:'asc'},
  });
  if(!wrap._meta20Wired){
    wrap.addEventListener('click', e => {
      const editBtn = e.target.closest('[data-meta20obj-edit]');
      if(editBtn){
        const rec = META20_OBJETIVOS.find(r => r.id===editBtn.dataset.meta20objEdit);
        if(rec) meta20ObjPreencherForm(rec);
        return;
      }
      const delBtn = e.target.closest('[data-meta20obj-del]');
      if(delBtn){
        const rec = META20_OBJETIVOS.find(r => r.id===delBtn.dataset.meta20objDel);
        if(!rec || meta20Publicando) return;
        if(!confirm(`Excluir a meta do Setor ${rec.setor}? Vale para todos que acessam o link.`)) return;
        meta20Publicando = true;
        meta20ObjMsg('Publicando exclusão para todos…', '');
        meta20ObjDelete(rec.id).then(r => {
          meta20Publicando = false;
          if(r.ok){
            if(meta20ObjEditId===rec.id) meta20ObjResetForm();
            meta20ObjMsg(`Meta do Setor ${rec.setor} excluída para todos.`, 'ok');
          } else {
            meta20ObjMsg(`Não consegui publicar a exclusão (${(r.erro && r.erro.message) || r.erro}) — nada foi alterado.`, 'erro');
          }
          renderMeta20();
        });
      }
    });
    wrap._meta20Wired = true;
  }
}

/* ---------------------- Motor de cálculo (ranking Top 20) ---------------------- */
// "Hoje" define o mês atual/anterior e o trimestre (os 3 meses terminando no
// mês anterior) — sempre recalculado ao vivo, nunca gravado no upload, para o
// ranking continuar correto em qualquer mês/ano que a aba for aberta.
function meta20Periodo(){
  const hoje = new Date();
  const soma = (y,m,n) => { let mm=m+n; while(mm<1){mm+=12;y--;} while(mm>12){mm-=12;y++;} return {y,m:mm}; };
  const atual = {y:hoje.getFullYear(), m:hoje.getMonth()+1};
  const anterior = soma(atual.y, atual.m, -1);
  const tri1 = anterior, tri3 = soma(atual.y, atual.m, -3);
  const key = ym => ym.y + '-' + String(ym.m).padStart(2,'0');
  return {
    mesAtual: atual, mesAnterior: anterior,
    mesAtualKey: key(atual), mesAnteriorKey: key(anterior),
    triDeISO: key(tri3) + '-01', triAteLabel: key(tri1),
  };
}
function meta20SomaNoMes(rows, sold, mesKey){
  let soma = 0;
  for(const r of rows){ if(r[2]===sold && r[3] && r[3].slice(0,7)===mesKey) soma += r[1]; }
  return soma;
}
// Ranking dos 20 maiores clientes (por faturamento no trimestre) de uma chave
// (Setor, nas visões BRN2/BRN8, ou Empresa, na visão Empresa) — espelha a
// fórmula LET/FILTER/UNIQUE/SORTBY/INDEX do Excel, mas em duas passadas: soma
// por Sold dentro do trimestre, depois ordena e pega os 20 primeiros.
function meta20Ranking(rows, varejoRows, chaveSelecionada, periodo, objetivo){
  const {triDeISO, mesAtualKey, mesAnteriorKey} = periodo;
  const limiteSuperiorISO = mesAtualKey + '-01';
  const emTrimestre = rows.filter(r => r[0]===chaveSelecionada && r[3] && r[3]>=triDeISO && r[3]<limiteSuperiorISO);
  const somaPorSold = new Map();
  emTrimestre.forEach(r => somaPorSold.set(r[2], (somaPorSold.get(r[2])||0) + r[1]));
  const totalTrimestre = Array.from(somaPorSold.values()).reduce((s,v)=>s+v, 0);
  const mediaTriChave = totalTrimestre/3;
  const top20 = Array.from(somaPorSold.entries()).sort((a,b) => b[1]-a[1]).slice(0,20);

  const linhas = top20.map(([sold, somaTri], idx) => {
    const mediaTriCliente = somaTri/3;
    const rep = mediaTriChave>0 ? mediaTriCliente/mediaTriChave : 0;
    const metaCliente = objetivo*rep;
    const mesAnteriorReal = meta20SomaNoMes(rows, sold, mesAnteriorKey);
    const mesAtualReal = meta20SomaNoMes(rows, sold, mesAtualKey);
    const varejoMesAtual = varejoRows ? meta20SomaNoMes(varejoRows, sold, mesAtualKey) : 0;
    const saldo = metaCliente - mesAtualReal;
    return {posicao: idx+1, sold, mediaTriCliente, rep, mesAnteriorReal, metaCliente, varejoMesAtual, mesAtualReal, saldo};
  });
  return {linhas, mediaTriChave, objetivo};
}

/* ---------------------- Datalist do Setor (cadastro de meta) ---------------------- */
function renderMeta20SetorDatalist(){
  const dl = document.getElementById('meta20-setor-list');
  if(!dl) return;
  const chaves = new Set([META20_CHAVE_EMPRESA]);
  (DATA.baseVendas || []).forEach(r => { if(r[1]!=null) chaves.add(String(r[1])); });
  dl.innerHTML = Array.from(chaves).sort().map(c => `<option value="${esc(c)}"></option>`).join('');
}

/* ---------------------- Seletor de Visão/Setor + tabela ---------------------- */
// BRN8 só existe de fato para os Setores 505 e 510 — a pedido do usuário. As
// vendas de BEBIDAS às vezes trazem outros Setores misturados (ex.: 502), que
// não são BRN8 de verdade e não devem aparecer nem entrar nos totais dessa visão.
const META20_SETORES_PERMITIDOS = { brn8: ['505','510'] }; // BRN2 e Empresa: sem restrição
function meta20DadosDaVariante(variante){
  const m20 = meta20Faturamento();
  let rows, label;
  if(variante==='brn8'){ rows = m20.brn8||[]; label = 'BRN8'; }
  else if(variante==='empresa'){ rows = m20.empresa||[]; label = 'Empresa'; }
  else { rows = m20.brn2||[]; label = 'BRN2'; }
  const permitidos = META20_SETORES_PERMITIDOS[variante];
  if(permitidos) rows = rows.filter(r => permitidos.includes(String(r[0])));
  return {rows, label};
}
function renderMeta20SetorSelect(){
  const variante = (document.getElementById('meta20-select-variante')||{}).value || 'brn2';
  const sel = document.getElementById('meta20-select-setor');
  if(!sel) return;
  const {rows} = meta20DadosDaVariante(variante);
  const chaves = Array.from(new Set(rows.map(r => r[0]).filter(v => v!=null))).sort();
  const atual = chaves.includes(sel.value) ? sel.value : '';
  sel.innerHTML = '<option value="">Selecione…</option>' + chaves.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  sel.value = atual;
}

function meta20ClienteMeta(sold){
  const linhas = (DATA.meta20 && DATA.meta20.clientes) || [];
  for(const r of linhas){ if(String(r[0])===sold) return {razaoSocial:r[1], setor:r[2]}; }
  for(const r of (DATA.clientes || [])){ if(String(r[0])===sold) return {razaoSocial:r[1], setor:r[2]}; }
  return {razaoSocial:null, setor:null};
}
function meta20VisitaMeta(sold){
  const linhas = (DATA.meta20 && DATA.meta20.visitas) || [];
  for(const r of linhas){ if(String(r[0])===sold) return {visita:r[1], ciclo:r[2]}; }
  return {visita:null, ciclo:null};
}

function renderMeta20Tabela(){
  const hint = document.getElementById('meta20-empty-hint');
  const wrap = document.getElementById('meta20-wrap');
  if(!hint || !wrap) return;
  const variante = (document.getElementById('meta20-select-variante')||{}).value || 'brn2';
  const setorSel = (document.getElementById('meta20-select-setor')||{}).value || '';
  const {rows, label} = meta20DadosDaVariante(variante);
  const temDados = rows.length>0;

  if(!temDados || !setorSel){
    wrap.style.display = 'none'; hint.style.display = '';
    hint.textContent = !temDados
      ? 'Envie a planilha de Vendas para ver o ranking.'
      : 'Selecione um Setor (ou Empresa) para ver o ranking.';
    return;
  }
  hint.style.display = 'none'; wrap.style.display = '';

  const periodo = meta20Periodo();
  const objetivoRec = META20_OBJETIVOS.find(r => String(r.setor)===String(setorSel));
  const objetivo = objetivoRec ? Number(objetivoRec.objetivo)||0 : 0;
  const varejoRows = meta20Faturamento().varejo;
  const {linhas, mediaTriChave} = meta20Ranking(rows, varejoRows, setorSel, periodo, objetivo);

  document.getElementById('meta20-panel-sub').textContent =
    `Visão ${label} · Setor/Empresa ${setorSel} · trimestre até ${periodo.triAteLabel} · mês de referência ${periodo.mesAtualKey}` +
    (objetivoRec ? '' : ' · ⚠️ nenhuma meta cadastrada para este Setor — Meta/Saldo ficam zerados.');

  const totalMeta = linhas.reduce((s,l)=>s+l.metaCliente, 0);
  const totalRealizado = linhas.reduce((s,l)=>s+l.mesAtualReal, 0);
  const totalSaldo = linhas.reduce((s,l)=>s+l.saldo, 0);
  renderKPIs('kpi-meta20', [
    {label:'Média Trimestre (Setor/Empresa)', value: fmtBRL0(mediaTriChave)},
    {label:'Meta do Setor/Empresa', value: fmtBRL0(objetivo)},
    {label:'Meta dos Top 20 (soma)', value: fmtBRL0(totalMeta)},
    {label:'Realizado no mês (Top 20)', value: fmtBRL0(totalRealizado)},
    {label:'Saldo (Top 20)', value: fmtBRL0(totalSaldo), tone: totalSaldo<=0 ? 'good' : 'warning'},
  ]);

  makeTable('table-meta20', {
    headers: [
      {key:'posicao', label:'Posição', align:'right'},
      {key:'sold', label:'Sold'},
      {key:'razaoSocial', label:'Razão Social'},
      {key:'visita', label:'Visita'},
      {key:'ciclo', label:'Ciclo'},
      {key:'mediaTriCliente', label:'Média Trimestre', align:'right', format:fmtBRL0},
      {key:'rep', label:'Rep%', align:'right', format:fmtPct},
      {key:'mesAnteriorReal', label:'Mês Anterior', align:'right', format:fmtBRL0},
      {key:'metaCliente', label:'Meta', align:'right', format:fmtBRL0},
      {key:'varejoMesAtual', label:'Varejo (mês atual)', align:'right', format:fmtBRL0},
      {key:'mesAtualReal', label:'Realizado (mês atual)', align:'right', format:fmtBRL0},
      {key:'saldo', label:'Saldo', align:'right', format:fmtBRL0},
    ],
    rows: linhas,
    getRow: l => {
      const cli = meta20ClienteMeta(l.sold), vis = meta20VisitaMeta(l.sold);
      return Object.assign({}, l, {razaoSocial: cli.razaoSocial || '—', visita: vis.visita ?? '—', ciclo: vis.ciclo || '—'});
    },
    searchable: true, pageSize: 20, defaultSort: {key:'posicao', dir:'asc'},
  });
}

function renderMeta20(){
  meta20SyncFromData();
  renderMeta20SetorDatalist();
  renderMeta20ObjTable();
  renderMeta20SetorSelect();
  renderMeta20Tabela();
}

function initMeta20(){
  const form = document.getElementById('meta20-obj-form');
  if(!form) return; // aba não presente neste HTML — módulo fica inerte
  form.addEventListener('submit', e => {
    e.preventDefault();
    if(meta20Publicando) return;
    const setor = document.getElementById('meta20-obj-input-setor').value.trim();
    const objetivo = Number(document.getElementById('meta20-obj-input-valor').value);
    if(!setor || !(objetivo>0)){
      meta20ObjMsg('Preencha o Setor e um Objetivo maior que zero.', 'erro');
      return;
    }
    const rec = {id: meta20ObjEditId || meta20ObjProximoId(), setor, objetivo};
    meta20Publicando = true;
    const btn = document.getElementById('meta20-obj-btn-salvar');
    if(btn) btn.disabled = true;
    meta20ObjMsg('Publicando meta para todos…', '');
    meta20ObjUpsert(rec).then(r => {
      meta20Publicando = false;
      if(btn) btn.disabled = false;
      if(r.ok){
        meta20ObjMsg(`Meta do Setor ${setor} salva e publicada para todos.`, 'ok');
        meta20ObjResetForm();
      } else {
        meta20ObjMsg(`Não consegui publicar (${(r.erro && r.erro.message) || r.erro}) — nada foi alterado. Tente de novo.`, 'erro');
      }
      renderMeta20();
    });
  });
  document.getElementById('meta20-obj-btn-cancelar').addEventListener('click', () => { meta20ObjResetForm(); meta20ObjMsg('', ''); });
  document.getElementById('meta20-select-variante').addEventListener('change', () => { renderMeta20SetorSelect(); renderMeta20Tabela(); });
  document.getElementById('meta20-select-setor').addEventListener('change', renderMeta20Tabela);
  RENDERERS.meta20 = renderMeta20;
}

/* ============================================================================
   CLIENTES SEM COMPRA — módulo isolado
   ----------------------------------------------------------------------------
   Carteira válida do período → clientes que compraram no mês → quem da
   carteira ainda não comprou = Clientes sem Compra.
   A carteira vem da aba "BASE" da planilha de Vendas (DATA.carteira: Sold,
   Setor, Dia de Visita, Ciclo, Supervisor, cidade/canal do cadastro). Um
   cliente só entra na carteira do período se tiver pelo menos UMA visita
   programada dentro dele: dia da semana = "Dia de Visita" (1=segunda …
   5=sexta) e semana dentro do "Ciclo".
   O ciclo NÃO é a semana do mês: é um rodízio contínuo de 4 semanas
   (semanas 1-2-3-4-1-2…, de segunda a domingo) — "1 3" e "2 4" são as duas
   quinzenas alternadas, "1234" é toda semana. A âncora (semana de
   14/09/2026 = semana 1) foi tirada das próprias vendas: em 2026 ~80% dos
   pedidos feitos no dia de visita do cliente caem numa semana do ciclo dele
   por esta regra, contra ~20% pela regra oposta; "semana do mês" não bate.
   Compra = faturamento > 0 do mesmo Sold no mesmo Setor (o mesmo cliente
   pode estar na carteira de dois vendedores, um em Food e outro em Bebidas),
   do dia 1º do mês da data inicial até a data final.
   ========================================================================= */

const SC_DIAS = {1:'Segunda', 2:'Terça', 3:'Quarta', 4:'Quinta', 5:'Sexta'};
const SC_DIA_MS = 86400000;
const SC_STATUS_STYLE = {
  'SEM COMPRA NO MÊS': ['var(--warning-bg)','var(--warning-ink)'],
  'SEM COMPRA HÁ +90 DIAS': ['var(--critical-bg)','var(--critical-ink)'],
  'NUNCA COMPROU': ['var(--nogyro-bg)','var(--nogyro)'],
};
const SC_CARTEIRA_HEADERS = ['Sold','Setor','Razão Social','Dia de Visita','Ciclo','Supervisor','Cidade','Bairro','Canal','Telefone'];

/* ---------------------- Upload de Vendas: carteira da aba BASE ---------------------- */
// Bloco da direita (Sold/Razão Social/Setor/Dia de Visita/Ciclo/Supervisor) =
// carteira dos vendedores Professional, uma linha por Sold+Setor (a aba repete
// linhas — guardamos a primeira). Bloco da esquerda (COD.CLIENTE, cadastro de
// todos os clientes) completa cidade, bairro, canal e telefone pelo Sold.
// Mesma questão de cabeçalhos repetidos do Meta 20+: headerIndexMap guarda a
// última coluna de cada nome, então "Setor" do cliente é a coluna logo depois
// de "Razão Social".
function parseCarteiraBase(grid){
  if(!grid) return null;
  const headerRow = findHeaderRowByAnchor(grid, 'Sold', 8);
  if(!headerRow) return null;
  const map = headerIndexMap(grid, headerRow);
  const cSold = optCol(map,'Sold'); if(!cSold) return null;
  const cRazao = optCol(map,'Razão Social');
  const cSetor = cRazao ? cRazao+1 : null; if(!cSetor) return null;
  const cDia = optCol(map,'Dia de Visita'), cCiclo = optCol(map,'Ciclo'), cSup = optCol(map,'Supervisor');
  const cCod = optCol(map,'COD.CLIENTE'), cCidade = optCol(map,'CIDADE'), cBairro = optCol(map,'BAIRRO');
  const cCanal = optCol(map,'DESC.CATEGORIA'), cDdd = optCol(map,'DDD'), cFone = optCol(map,'TELEFONE');
  // Força de venda do cliente: no bloco da esquerda, cada linha é um par cliente x
  // vendedor com o "GRUPO COMERCIAL" (3 = força NPRO, 4 = força BEBIDAS). "VENDEDOR"
  // se repete mais à direita (tabela Setor->Vendedor), então aqui vale a 1ª coluna
  // com esse nome, não a que o headerIndexMap guardou.
  const cGrupo = optCol(map,'GRUPO COMERCIAL');
  const cVendL = (grid[headerRow-1]||[]).findIndex(h => normalizeHeader(h)==='VENDEDOR') + 1 || null;
  const forcas = new Map(); // Sold -> {npro, beb}

  const cadastro = new Map(); // COD.CLIENTE -> {cidade, bairro, canal, telefone}
  if(cCod){
    let blank = 0;
    for(let r=headerRow+1; r<=grid.length && blank<15; r++){
      const cod = ocell(grid,r,cCod);
      if(cod==null){ blank++; continue; }
      blank = 0;
      const k = String(cod);
      if(cGrupo && cVendL){
        const g = Number(ocell(grid,r,cGrupo)), v = ocell(grid,r,cVendL);
        if(v!=null && (g===3 || g===4)){
          const f = forcas.get(k) || {}; if(g===3 && !f.npro) f.npro = String(v); if(g===4 && !f.beb) f.beb = String(v); forcas.set(k, f);
        }
      }
      if(cadastro.has(k)) continue;
      const ddd = cDdd ? ocell(grid,r,cDdd) : null, fone = cFone ? ocell(grid,r,cFone) : null;
      cadastro.set(k, {
        cidade: cCidade ? ocell(grid,r,cCidade) : null,
        bairro: cBairro ? ocell(grid,r,cBairro) : null,
        canal: cCanal ? ocell(grid,r,cCanal) : null,
        telefone: fone!=null && String(fone)!=='0' ? (ddd!=null ? '(' + ddd + ') ' + fone : String(fone)) : null,
      });
    }
  }

  const rows = [];
  const vistos = new Set();
  let blank = 0;
  for(let r=headerRow+1; r<=grid.length && blank<15; r++){
    const soldV = ocell(grid,r,cSold);
    if(soldV==null){ blank++; continue; }
    blank = 0;
    const sold = String(soldV);
    const setorV = ocell(grid,r,cSetor);
    const setor = setorV!=null ? String(setorV) : null;
    if(!setor || setor==='506') continue; // vendedor removido por completo (regra do projeto)
    const chave = sold + '|' + setor;
    if(vistos.has(chave)) continue;
    vistos.add(chave);
    const cad = cadastro.get(sold) || {};
    const supV = cSup ? ocell(grid,r,cSup) : null;
    rows.push([sold, setor, cRazao ? ocell(grid,r,cRazao) : null,
      scNormalizarDia(cDia ? ocell(grid,r,cDia) : null), scNormalizarCiclo(cCiclo ? ocell(grid,r,cCiclo) : null),
      supV!=null ? String(supV) : null, cad.cidade||null, cad.bairro||null, cad.canal||null, cad.telefone||null]);
  }
  const setoresCarteira = new Set(rows.map(r => r[1]));
  const forcasRows = [];
  forcas.forEach((f, sold) => {
    const npro = setoresCarteira.has(f.npro) ? f.npro : null, beb = setoresCarteira.has(f.beb) ? f.beb : null;
    if(npro || beb) forcasRows.push([sold, npro, beb]);
  });
  return {headers: SC_CARTEIRA_HEADERS, rows, forcas: forcasRows};
}
// "Dia de Visita" vem como 1..5; alguns clientes têm lixo (7, datas) — sem dia fixo.
function scNormalizarDia(v){
  const n = typeof v==='number' ? v : Number(String(v==null?'':v).trim());
  return (Number.isInteger(n) && n>=1 && n<=5) ? n : null;
}
// "Ciclo" vem como "1234", "1 3", " 2 4" — guardamos só os dígitos das semanas.
function scNormalizarCiclo(v){
  const s = v==null ? '' : String(v).replace(/[^1-4]/g,'');
  return s || null;
}

/* ---------------------- Carteira + histórico de compras (derivados de DATA) ---------------------- */
// Sem DATA.carteira (snapshot publicado antes desta aba existir), monta uma
// carteira provisória com o que o Meta 20+ já guardou da aba BASE — sem
// cidade/canal/supervisor, até a próxima planilha de Vendas.
let _scCache = {fonteCarteira: undefined, fonteVendas: null, carteira: [], compras: new Map(), provisoria: false};
function scDados(){
  const fonteCarteira = DATA.carteira || DATA.meta20 || null;
  const fonteVendas = DATA.baseVendas || [];
  if(_scCache.fonteCarteira===fonteCarteira && _scCache.fonteVendas===fonteVendas) return _scCache;

  let rows = [], provisoria = false;
  if(DATA.carteira && Array.isArray(DATA.carteira.rows)){
    rows = DATA.carteira.rows;
  } else if(DATA.meta20 && Array.isArray(DATA.meta20.clientes) && DATA.meta20.clientes.length){
    provisoria = true;
    const visita = new Map();
    (DATA.meta20.visitas||[]).forEach(v => { const k = String(v[0]); if(!visita.has(k)) visita.set(k, v); });
    const vistos = new Set();
    DATA.meta20.clientes.forEach(c => {
      const sold = String(c[0]), setor = c[2]!=null ? String(c[2]) : null;
      if(!setor || setor==='506' || vistos.has(sold+'|'+setor)) return;
      vistos.add(sold+'|'+setor);
      const v = visita.get(sold) || [];
      rows.push([sold, setor, c[1], scNormalizarDia(v[1]), scNormalizarCiclo(v[2]), null, null, null, null, null]);
    });
  }
  const carteira = rows.map(r => ({
    sold: String(r[0]), setor: String(r[1]), razao: r[2], dia: r[3], ciclo: r[4] || '1234',
    supervisor: r[5], cidade: r[6], bairro: r[7], canal: r[8], telefone: r[9],
  }));

  const compras = new Map(); // Sold|Setor -> [[dataMs, faturamento], ...]
  for(const v of fonteVendas){
    if(v[0]==null || v[1]==null || !v[3]) continue;
    const k = String(v[0]) + '|' + String(v[1]);
    let lista = compras.get(k); if(!lista){ lista = []; compras.set(k, lista); }
    lista.push([parseDateOnly(v[3]), Number(v[9])||0]);
  }
  _scCache = {fonteCarteira, fonteVendas, carteira, compras, provisoria};
  return _scCache;
}

/* ---------------------- Calendário de visitas ---------------------- */
function scDiaSemana(ms){ return ((new Date(ms).getUTCDay()+6)%7)+1; } // 1=segunda … 7=domingo
function scSemanaCiclo(ms){ return ((Math.floor((ms/SC_DIA_MS + 3)/7) + 1) % 4) + 1; } // 1..4, vira na segunda
// O cliente tem visita no dia `ms`? (dia null = sem dia fixo na BASE: vale qualquer dia útil)
function scTemVisita(cli, ms){
  const ds = scDiaSemana(ms);
  if(ds>5) return false;
  if(cli.dia!=null && cli.dia!==ds) return false;
  return cli.ciclo.includes(String(scSemanaCiclo(ms)));
}
function scHojeMs(){ const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }
function scInicioMesMs(ms){ const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); }
function scInicioSemanaMs(ms){ return ms - (scDiaSemana(ms)-1)*SC_DIA_MS; }
function scCicloLabel(c){
  if(!c || c==='1234') return 'Toda semana';
  if(c==='13') return 'Semanas 1 e 3';
  if(c==='24') return 'Semanas 2 e 4';
  return 'Semanas ' + c.split('').join(', ');
}
function scProximaVisita(cli, aPartirMs){
  for(let i=0, ms=aPartirMs; i<35; i++, ms+=SC_DIA_MS){ if(scTemVisita(cli, ms)) return ms; }
  return null;
}

/* ---------------------- Filtros ---------------------- */
// Vendedor é mostrado só pelo código (Setor), em todas as abas — a pedido do usuário.
function scVendedorLabel(setor){ return String(setor); }
// Supervisor também só pelo código — a pedido do usuário.
function scSupervisorLabel(cod){ return cod==null ? '—' : String(cod); }
function scLerFiltros(){
  const val = id => (document.getElementById(id)||{}).value || '';
  return {
    supervisor: val('sc-supervisor'), vendedor: val('sc-vendedor'),
    deMs: parseDateOnly(val('sc-de')), ateMs: parseDateOnly(val('sc-ate')),
    quinzena: val('sc-quinzena'), dia: val('sc-dia') ? Number(val('sc-dia')) : null,
    cliente: val('sc-cliente').trim().toLowerCase(),
  };
}
function scPreencherSelect(id, opcoes){
  const sel = document.getElementById(id);
  if(!sel) return;
  const atual = sel.value;
  sel.innerHTML = '<option value="">(Todos)</option>' + opcoes.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
  sel.value = opcoes.some(o => o.value===atual) ? atual : '';
}
// Vendedor depende do Supervisor escolhido (filtros integrados).
function scAtualizarOpcoes(carteira){
  const sups = Array.from(new Set(carteira.map(c => c.supervisor).filter(v => v!=null))).sort();
  scPreencherSelect('sc-supervisor', sups.map(s => ({value:s, label:scSupervisorLabel(s)})));
  const sup = (document.getElementById('sc-supervisor')||{}).value || '';
  const setores = Array.from(new Set(carteira.filter(c => !sup || c.supervisor===sup).map(c => c.setor))).sort();
  scPreencherSelect('sc-vendedor', setores.map(s => ({value:s, label:scVendedorLabel(s)})));
}
function scPeriodoPadrao(){
  const hoje = scHojeMs();
  document.getElementById('sc-de').value = fmtDateOnly(scInicioMesMs(hoje));
  document.getElementById('sc-ate').value = fmtDateOnly(hoje);
}

/* ---------------------- Cálculo ---------------------- */
function scCalcular(f){
  const {carteira, compras} = scDados();
  const compraDeMs = scInicioMesMs(f.deMs);
  const hoje = scHojeMs();
  // Dias do período que valem para a carteira (respeitando Quinzena e Dia de visita).
  const diasValidos = [];
  for(let ms=f.deMs; ms<=f.ateMs && diasValidos.length<400; ms+=SC_DIA_MS){
    const ds = scDiaSemana(ms);
    if(ds>5) continue;
    if(f.dia && ds!==f.dia) continue;
    const sem = scSemanaCiclo(ms);
    if(f.quinzena==='13' && sem!==1 && sem!==3) continue;
    if(f.quinzena==='24' && sem!==2 && sem!==4) continue;
    diasValidos.push(ms);
  }

  const naCarteira = [], semCompra = [];
  let compraram = 0;
  for(const cli of carteira){
    if(f.supervisor && cli.supervisor!==f.supervisor) continue;
    if(f.vendedor && cli.setor!==f.vendedor) continue;
    if(f.cliente && !(cli.sold.includes(f.cliente) || String(cli.razao||'').toLowerCase().includes(f.cliente))) continue;
    if(f.dia && cli.dia!==f.dia) continue;
    if(!diasValidos.some(ms => scTemVisita(cli, ms))) continue;
    naCarteira.push(cli);

    const lista = compras.get(cli.sold + '|' + cli.setor) || [];
    let fatMes = 0, ultimaMs = null;
    for(const [ms, fat] of lista){
      if(ms==null || ms>f.ateMs) continue;
      if(ms>=compraDeMs) fatMes += fat;
      if(fat>0 && (ultimaMs==null || ms>ultimaMs)) ultimaMs = ms;
    }
    if(fatMes>0){ compraram++; continue; }
    const diasSem = ultimaMs!=null ? Math.round((f.ateMs-ultimaMs)/SC_DIA_MS) : null;
    semCompra.push({
      sold: cli.sold, setor: cli.setor,
      razao: cli.razao || ((clienteMetaMap && clienteMetaMap.get(cli.sold)) || {}).razaoSocial || '—',
      vendedor: scVendedorLabel(cli.setor),
      supervisor: scSupervisorLabel(cli.supervisor),
      canal: cli.canal || '—',
      regiao: [cli.cidade, cli.bairro].filter(Boolean).join(' · ') || '—',
      visita: cli.dia ? SC_DIAS[cli.dia] : '—', ciclo: scCicloLabel(cli.ciclo),
      proximaMs: scProximaVisita(cli, hoje),
      ultimaMs, diasSem,
      status: ultimaMs==null ? 'NUNCA COMPROU' : diasSem>90 ? 'SEM COMPRA HÁ +90 DIAS' : 'SEM COMPRA NO MÊS',
    });
  }
  return {naCarteira, semCompra, compraram, compraDeMs};
}

/* ---------------------- Render ---------------------- */
function renderSemCompra(){
  const hint = document.getElementById('sc-hint');
  const wrap = document.getElementById('sc-wrap');
  if(!hint || !wrap) return;
  const dados = scDados();
  scAtualizarOpcoes(dados.carteira);

  const semanaHoje = scSemanaCiclo(scHojeMs());
  const info = document.getElementById('sc-semana-info');
  if(info) info.textContent = `Semana atual: semana ${semanaHoje} do ciclo (quinzena das semanas ${(semanaHoje===1 || semanaHoje===3) ? '1 e 3' : '2 e 4'}).`;

  if(!dados.carteira.length){
    wrap.style.display = 'none'; hint.style.display = '';
    hint.textContent = 'Envie a planilha de Vendas (com a aba BASE) para carregar a carteira de clientes.';
    return;
  }
  const f = scLerFiltros();
  if(f.deMs==null || f.ateMs==null || f.deMs>f.ateMs){
    wrap.style.display = 'none'; hint.style.display = '';
    hint.textContent = 'Informe um período válido (data inicial menor ou igual à final).';
    return;
  }
  hint.style.display = dados.provisoria ? '' : 'none';
  hint.textContent = dados.provisoria
    ? 'Carteira provisória (sem cidade, canal e supervisor): envie a planilha de Vendas de novo para carregar a aba BASE completa.'
    : '';
  wrap.style.display = '';

  const r = scCalcular(f);
  const total = r.naCarteira.length;
  const cobertura = total ? r.compraram/total : null;
  renderKPIs('kpi-semcompra', [
    {label:'Clientes da Carteira', value: fmtInt(total), note: 'com visita programada no período'},
    {label:'Clientes que Compraram', value: fmtInt(r.compraram), tone:'good'},
    {label:'Clientes sem Compra', value: fmtInt(r.semCompra.length), tone: r.semCompra.length ? 'critical' : 'good'},
    {label:'% de Cobertura da Carteira', value: fmtPct(cobertura), tone: cobertura==null ? '' : cobertura>=0.8 ? 'good' : cobertura>=0.6 ? 'warning' : 'critical'},
  ]);

  document.getElementById('sc-sub').textContent =
    `Carteira: clientes com visita programada entre ${fmtDateBR(f.deMs)} e ${fmtDateBR(f.ateMs)}` +
    (f.quinzena ? ` (semanas ${f.quinzena==='13' ? '1 e 3' : '2 e 4'})` : '') + (f.dia ? ` · ${SC_DIAS[f.dia]}` : '') +
    ` · compras consideradas de ${fmtDateBR(r.compraDeMs)} a ${fmtDateBR(f.ateMs)}.`;

  makeTable('table-semcompra', {
    headers: [
      {key:'sold', label:'Sold'},
      {key:'razao', label:'Razão Social'},
      {key:'vendedor', label:'Vendedor'},
      {key:'supervisor', label:'Supervisor'},
      {key:'canal', label:'Canal'},
      {key:'regiao', label:'Cidade/Região'},
      {key:'visita', label:'Dia de Visita'},
      {key:'ciclo', label:'Ciclo'},
      {key:'proximaMs', label:'Próxima Visita', format: v => fmtDateBR(v)},
      {key:'ultimaMs', label:'Última Compra', format: v => fmtDateBR(v)},
      {key:'diasSem', label:'Dias sem Compra', align:'right', format: v => v==null ? '—' : fmtInt(v)},
      {key:'status', label:'Status', format: v => { const s = SC_STATUS_STYLE[v]; return s ? pillHtml(v, s[0], s[1]) : esc(v); }},
    ],
    rows: r.semCompra, getRow: x => x,
    searchable: true, pageSize: 25, defaultSort: {key:'proximaMs', dir:'asc'},
  });

  // Resumo por vendedor — mesma carteira e período, para o supervisor comparar.
  const porSetor = new Map();
  r.naCarteira.forEach(c => { const o = porSetor.get(c.setor) || {carteira:0, sem:0}; o.carteira++; porSetor.set(c.setor, o); });
  r.semCompra.forEach(c => { porSetor.get(c.setor).sem++; });
  makeTable('table-semcompra-vend', {
    headers: [
      {key:'vendedor', label:'Vendedor'},
      {key:'carteira', label:'Carteira', align:'right', format: fmtInt},
      {key:'compraram', label:'Compraram', align:'right', format: fmtInt},
      {key:'sem', label:'Sem Compra', align:'right', format: fmtInt},
      {key:'cobertura', label:'Cobertura', align:'right', format: fmtPct},
    ],
    rows: Array.from(porSetor.entries()).map(([setor, o]) => ({
      vendedor: scVendedorLabel(setor), carteira: o.carteira, compraram: o.carteira-o.sem, sem: o.sem,
      cobertura: o.carteira ? (o.carteira-o.sem)/o.carteira : null,
    })),
    getRow: x => x, searchable: false, pageSize: 20, defaultSort: {key:'vendedor', dir:'asc'},
  });
}

function initSemCompra(){
  if(!document.getElementById('sc-filtros')) return; // aba não presente neste HTML — módulo fica inerte
  scPeriodoPadrao();
  ['sc-supervisor','sc-vendedor','sc-de','sc-ate','sc-quinzena','sc-dia'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderSemCompra);
  });
  document.getElementById('sc-cliente').addEventListener('input', renderSemCompra);
  document.getElementById('sc-reset').addEventListener('click', () => {
    ['sc-supervisor','sc-vendedor','sc-quinzena','sc-dia','sc-cliente'].forEach(id => { document.getElementById(id).value = ''; });
    scPeriodoPadrao();
    renderSemCompra();
  });
  document.querySelectorAll('[data-sc-atalho]').forEach(btn => btn.addEventListener('click', () => {
    const hoje = scHojeMs(), tipo = btn.dataset.scAtalho;
    const de = tipo==='hoje' ? hoje : tipo==='semana' ? scInicioSemanaMs(hoje) : scInicioMesMs(hoje);
    document.getElementById('sc-de').value = fmtDateOnly(de);
    document.getElementById('sc-ate').value = fmtDateOnly(hoje);
    renderSemCompra();
  }));
  RENDERERS.semcompra = renderSemCompra;
}

/* ============================================================================
   CRESCER + (RESUMO) — módulo isolado
   ----------------------------------------------------------------------------
   Replica a aba RESUMO da planilha "ACOMPANHAMENTO CRESCER + NPRO+BEBIDAS":
   por Setor (ou o total da equipe, Setor 1), Cobertura e VBC das categorias
   do programa no mês, contra a meta, o ideal do dia e o objetivo por dia.
   - Cobertura efetiva = nº de clientes (Sold) que compraram a categoria no mês
     com aquele Setor. A planilha conta pela Razão Social, o que junta lojas
     da mesma rede num cliente só; aqui é pelo Sold, como no resto do app.
   - VBC efetivo = faturamento da categoria no mês, por Setor.
   - Meta de VBC do Setor = meta da empresa × participação do Setor no VBC da
     categoria no trimestre anterior (3 meses fechados) — mesma regra da aba
     VBC da planilha (ROUNDUP).
   - Dias úteis = segunda a sexta do mês menos os feriados nacionais e de
     Sergipe, sempre automático. Dias decorridos contam até hoje, inclusive
     (a planilha do matinal já conta o dia em curso).
   Metas (cobertura por Setor, VBC da empresa) são um cadastro mensal publicado
   para todos (DATA.crescer), como as metas do Meta 20+.
   ========================================================================= */

const CR_CATEGORIAS = ['01-NP LACTEOS','02-NP CHOCOLATES','03-NP CULINARIOS','07-NP SOLUCOES'];
// Acompanhamento por cliente (abas "Por Cliente Npro" + "Por Cliente bebidas"): todas as categorias NP.
const CR_CATEGORIAS_CLIENTE = ['01-NP LACTEOS','02-NP CHOCOLATES','03-NP CULINARIOS','04-NP SOBREMESAS','05-NP BISCOITOS','06-NP STANDARD','07-NP SOLUCOES'];
// Cor de cada categoria (classe CSS) — usada nas colunas e etiquetas da aba.
const CR_CAT_COR = {'01-NP LACTEOS':'cr-c-lac','02-NP CHOCOLATES':'cr-c-cho','03-NP CULINARIOS':'cr-c-cul',
  '04-NP SOBREMESAS':'cr-c-sob','05-NP BISCOITOS':'cr-c-bis','06-NP STANDARD':'cr-c-std','07-NP SOLUCOES':'cr-c-sol'};
function crCatTag(cat){ return CR_CAT_COR[cat] ? `<span class="cr-cat-tag ${CR_CAT_COR[cat]}">${esc(cat)}</span>` : esc(cat); }
const CR_CAT_CURTO = {'01-NP LACTEOS':'Lácteos','02-NP CHOCOLATES':'Chocolates','03-NP CULINARIOS':'Culinários',
  '04-NP SOBREMESAS':'Sobremesas','05-NP BISCOITOS':'Biscoitos','06-NP STANDARD':'Standard','07-NP SOLUCOES':'Soluções'};
const CR_SETOR_TOTAL = '1';
// Valores de setembro/2026 copiados da planilha — valem até alguém salvar o cadastro.
const CR_SEMENTE = {
  '2026-09': {
    cobertura: {
      '502': {'01-NP LACTEOS':93, '02-NP CHOCOLATES':48, '03-NP CULINARIOS':46, '07-NP SOLUCOES':0},
      '504': {'01-NP LACTEOS':96, '02-NP CHOCOLATES':50, '03-NP CULINARIOS':46, '07-NP SOLUCOES':0},
      '505': {'01-NP LACTEOS':49, '02-NP CHOCOLATES':32, '03-NP CULINARIOS':46, '07-NP SOLUCOES':11},
      '510': {'01-NP LACTEOS':22, '02-NP CHOCOLATES':18, '03-NP CULINARIOS':3, '07-NP SOLUCOES':59},
      '555': {'01-NP LACTEOS':1, '02-NP CHOCOLATES':2, '03-NP CULINARIOS':0, '07-NP SOLUCOES':0},
      '1':   {'01-NP LACTEOS':260, '02-NP CHOCOLATES':148, '03-NP CULINARIOS':141, '07-NP SOLUCOES':70},
    },
    vbc: {'01-NP LACTEOS':1495395.72, '02-NP CHOCOLATES':228648.41, '03-NP CULINARIOS':74658.29, '07-NP SOLUCOES':185348.47},
  },
};

/* ---------------------- Feriados (Brasil + Sergipe) ---------------------- */
function crPascoaMs(ano){ // algoritmo de Meeus/Jones/Butcher
  const a=ano%19, b=Math.floor(ano/100), c=ano%100, d=Math.floor(b/4), e=b%4, f=Math.floor((b+8)/25),
        g=Math.floor((b-f+1)/3), h=(19*a+b-d-g+15)%30, i=Math.floor(c/4), k=c%4,
        l=(32+2*e+2*i-h-k)%7, m=Math.floor((a+11*h+22*l)/451),
        mes=Math.floor((h+l-7*m+114)/31), dia=((h+l-7*m+114)%31)+1;
  return Date.UTC(ano, mes-1, dia);
}
// Feriados oficiais: nacionais (Lei 662/49, 6.802/80, 14.759/23) + Sergipe (8/7,
// Emancipação Política). Carnaval e Corpus Christi são ponto facultativo e não
// entram.
function crFeriadosOficiais(ano){
  const fixos = ['01-01','04-21','05-01','07-08','09-07','10-12','11-02','11-15','11-20','12-25'];
  const lista = fixos.map(md => ({iso: ano + '-' + md}));
  lista.push({iso: fmtDateOnly(crPascoaMs(ano) - 2*SC_DIA_MS)}); // Sexta-feira Santa
  return lista.map(f => f.iso);
}
function crFeriadosDoMes(mesKey){
  return new Set(crFeriadosOficiais(Number(mesKey.slice(0,4))).filter(iso => iso.slice(0,7)===mesKey));
}

/* ---------------------- Calendário do mês ---------------------- */
function crMesAtualKey(){ return fmtDateOnly(scHojeMs()).slice(0,7); }
function crCadastroDoMes(mesKey){
  const salvo = DATA.crescer && DATA.crescer.meses && DATA.crescer.meses[mesKey];
  if(salvo) return {cad: salvo, origem: 'salvo'};
  if(CR_SEMENTE[mesKey]) return {cad: CR_SEMENTE[mesKey], origem: 'semente'};
  return {cad: {cobertura:{}, vbc:{}}, origem: 'vazio'};
}
function crCalendario(mesKey){
  const [ano, mes] = mesKey.split('-').map(Number);
  const iniMs = Date.UTC(ano, mes-1, 1), fimMs = Date.UTC(ano, mes, 0);
  const hoje = scHojeMs();
  const feriados = crFeriadosDoMes(mesKey);
  const util = ms => scDiaSemana(ms)<=5 && !feriados.has(fmtDateOnly(ms));
  let uteis = 0, decorridos = 0;
  for(let ms=iniMs; ms<=fimMs; ms+=SC_DIA_MS){ if(util(ms)){ uteis++; if(ms<=hoje) decorridos++; } }
  // Dia anterior = último dia útil antes de hoje (dentro do mês).
  let diaAnteriorMs = null;
  for(let ms=Math.min(hoje, fimMs+SC_DIA_MS)-SC_DIA_MS; ms>=iniMs; ms-=SC_DIA_MS){ if(util(ms)){ diaAnteriorMs = ms; break; } }
  return {iniMs, fimMs, ateMs: Math.min(hoje, fimMs), uteis, decorridos, restantes: Math.max(0, uteis-decorridos),
    diaAnteriorMs, feriados: Array.from(feriados).sort(),
    ideal: uteis ? decorridos/uteis : 0};
}

/* ---------------------- Cálculo ---------------------- */
function crSetores(){
  return (DATA.vendedores||[]).map(String).filter(s => s!=='506').sort();
}
function crCalcular(mesKey){
  const {cad, origem} = crCadastroDoMes(mesKey);
  const cal = crCalendario(mesKey);
  const iniISO = fmtDateOnly(cal.iniMs), ateISO = fmtDateOnly(cal.ateMs);
  const diaAntISO = cal.diaAnteriorMs!=null ? fmtDateOnly(cal.diaAnteriorMs) : null;
  const [ano, mes] = mesKey.split('-').map(Number);
  const triIniISO = fmtDateOnly(Date.UTC(ano, mes-4, 1)), triFimISO = fmtDateOnly(Date.UTC(ano, mes-1, 0));
  const cats = new Set(CR_CATEGORIAS), catsCliente = new Set(CR_CATEGORIAS_CLIENTE);

  // Por Setor|Categoria: compradores no mês, 1ª compra de cada cliente no mês, VBC do mês e do trimestre.
  // Por Setor|Sold: VBC do mês em cada categoria (acompanhamento por cliente).
  const compradores = new Map(), compradoresDia = new Map(), vbcMes = new Map(), vbcTri = new Map(), porCliente = new Map();
  for(const r of (DATA.baseVendas||[])){
    const grp = r[5], iso = r[3];
    if(!catsCliente.has(grp) || !iso || r[1]==null) continue;
    const k = String(r[1]) + '|' + grp, fat = Number(r[9])||0;
    const noMes = iso>=iniISO && iso<=ateISO, sold = String(r[0]);
    if(noMes){
      const kc = String(r[1]) + '|' + sold;
      let o = porCliente.get(kc); if(!o){ o = {}; porCliente.set(kc, o); }
      o[grp] = (o[grp]||0) + fat;
    }
    if(!cats.has(grp)) continue;
    if(iso>=triIniISO && iso<=triFimISO) vbcTri.set(k, (vbcTri.get(k)||0) + fat);
    if(!noMes) continue;
    vbcMes.set(k, (vbcMes.get(k)||0) + fat);
    let s = compradores.get(k); if(!s){ s = new Set(); compradores.set(k, s); } s.add(sold);
    // Dia anterior: clientes (Sold) que compraram a categoria NAQUELA data com o
    // Setor — código do cliente × categoria × data, tenham ou não comprado antes no mês.
    if(iso===diaAntISO){ let a = compradoresDia.get(k); if(!a){ a = new Set(); compradoresDia.set(k, a); } a.add(sold); }
  }
  const novosNoDia = new Map(); // Setor|Categoria -> nº de clientes que compraram a categoria no dia anterior
  compradoresDia.forEach((set, k) => novosNoDia.set(k, set.size));

  const setores = crSetores();
  const valor = (mapa, setor, cat, f) => setor===CR_SETOR_TOTAL
    ? setores.reduce((s, st) => s + f(mapa.get(st+'|'+cat)), 0)
    : f(mapa.get(setor+'|'+cat));
  const num = v => Number(v)||0, tam = v => v ? v.size : 0;
  const metaCob = (setor, cat) => num(((cad.cobertura||{})[setor]||{})[cat]);
  const metaVbc = (setor, cat) => {
    const empresa = num((cad.vbc||{})[cat]);
    if(setor===CR_SETOR_TOTAL) return empresa;
    const triTotal = setores.reduce((s, st) => s + num(vbcTri.get(st+'|'+cat)), 0);
    return triTotal>0 ? Math.ceil(num(vbcTri.get(setor+'|'+cat))/triTotal*empresa) : 0;
  };

  function linhas(setor){
    const cobertura = CR_CATEGORIAS.map(cat => {
      let meta = metaCob(setor, cat);
      if(setor===CR_SETOR_TOTAL && !meta) meta = setores.reduce((s, st) => s + metaCob(st, cat), 0);
      const efetivo = valor(compradores, setor, cat, tam);
      const saldo = meta - efetivo, pct = meta>0 ? efetivo/meta : null;
      const diaAnt = valor(novosNoDia, setor, cat, num);
      return {cat, meta, efetivo, saldo, pct, ok: pct!=null && pct>=cal.ideal, diaAnt, evolucao: meta - diaAnt,
        objDia: Math.max(0, Math.ceil(saldo/Math.max(1, cal.restantes)))};
    });
    const vbc = CR_CATEGORIAS.map(cat => {
      const tri = valor(vbcTri, setor, cat, num), meta = metaVbc(setor, cat), efetivo = valor(vbcMes, setor, cat, num);
      const saldo = meta - efetivo, pct = meta>0 ? efetivo/meta : null;
      return {cat, tri, meta, efetivo, saldo, pct, ok: pct!=null && pct>=cal.ideal,
        tendencia: cal.decorridos ? efetivo/cal.decorridos*cal.uteis : null,
        objDia: Math.max(0, Math.ceil(saldo/Math.max(1, cal.restantes)))};
    });
    return {cobertura, vbc};
  }
  return {cad, origem, cal, setores, linhas, triIniISO, triFimISO, porCliente};
}

/* ---------------------- Render ---------------------- */
function crSetorLabel(setor){ return setor===CR_SETOR_TOTAL ? '1 (Total)' : scVendedorLabel(setor); }
function crOkPill(ok, pct){
  if(pct==null) return '—';
  return ok ? pillHtml('O', 'var(--good-bg)', 'var(--good-ink)') : pillHtml('X', 'var(--critical-bg)', 'var(--critical-ink)');
}
// Tabela fixa (sem ordenação/paginação) com linha de total, como na planilha;
// também deixa o snapshot para o Relatório A4.
function crTabela(containerId, headers, rows, total){
  const el = document.getElementById(containerId);
  const cell = (h, r) => h.format ? h.format(r[h.key], r) : esc(r[h.key]);
  let grupos = '';
  if(headers.some(h => h.grupo)){
    for(let i=0; i<headers.length; ){
      let j = i; while(j<headers.length && headers[j].grupo===headers[i].grupo) j++;
      grupos += `<th colspan="${j-i}" class="cr-grupo ${headers[i].cls||''}">${esc(headers[i].grupo||'')}</th>`;
      i = j;
    }
    grupos = '<tr>' + grupos + '</tr>';
  }
  let html = '<div class="table-wrap"><table class="datatable"><thead>' + grupos + '<tr>' +
    headers.map(h => `<th class="${h.cls||''}" style="text-align:${h.align||'left'}">${esc(h.label)}</th>`).join('') + '</tr></thead><tbody>';
  rows.forEach(r => { html += '<tr>' + headers.map(h => `<td class="${h.cls||''}" style="text-align:${h.align||'left'}">${cell(h, r)}</td>`).join('') + '</tr>'; });
  if(total) html += '<tr class="cr-total">' + headers.map(h => `<td class="${h.cls||''}" style="text-align:${h.align||'left'}">${total[h.key]==null ? '' : cell(h, total)}</td>`).join('') + '</tr>';
  el.innerHTML = html + '</tbody></table></div>';
  el._printSnapshot = {headers: headers.map(h => h.grupo ? Object.assign({}, h, {label: h.grupo + ' ' + h.label}) : h),
    rows: total ? rows.concat([total]) : rows};
}

/* ---------------------- Acompanhamento por vendedor e por cliente ---------------------- */
function crRenderPorVendedor(res){
  const setores = res.setores.concat([CR_SETOR_TOTAL]);
  const porSetor = setores.map(st => ({st, l: res.linhas(st)}));
  const pctFmt = v => v==null ? '—' : fmtPct(v);
  const saldoCls = (fmt) => (v => v==null ? '—' : (v<0 ? `<span class="cr-negativo">${fmt(v)}</span>` : fmt(v)));
  function montar(containerId, bloco, fmt){
    const headers = [{key:'vendedor', label:'Vendedor'}];
    CR_CATEGORIAS.forEach((c, i) => {
      const g = CR_CAT_CURTO[c], cls = CR_CAT_COR[c];
      headers.push({key:'m'+i, label:'Meta', align:'right', grupo:g, cls, format:fmt},
        {key:'e'+i, label:'Efet.', align:'right', grupo:g, cls, format:fmt},
        {key:'s'+i, label:'Saldo', align:'right', grupo:g, cls, format:saldoCls(fmt)},
        {key:'p'+i, label:'%', align:'right', grupo:g, cls, format:pctFmt});
    });
    const linha = ({st, l}) => {
      const o = {vendedor: crSetorLabel(st)};
      l[bloco].forEach((x, i) => { o['m'+i] = x.meta; o['e'+i] = x.efetivo; o['s'+i] = x.saldo; o['p'+i] = x.pct; });
      return o;
    };
    crTabela(containerId, headers, porSetor.filter(x => x.st!==CR_SETOR_TOTAL).map(linha), linha(porSetor.find(x => x.st===CR_SETOR_TOTAL)));
  }
  montar('table-crescer-cob-vend', 'cobertura', fmtInt);
  montar('table-crescer-vbc-vend', 'vbc', fmtBRL0);
}

function crRenderPorCliente(res, setorSel){
  const {carteira} = scDados();
  const val = id => (document.getElementById(id)||{}).value || '';
  const filtro = val('cr-cli-filtro'), canalSel = val('cr-cli-canal'), diaSel = val('cr-cli-dia');
  const infoCarteira = new Map(carteira.map(c => [c.setor + '|' + c.sold, c]));
  const chaves = new Set();
  carteira.forEach(c => chaves.add(c.setor + '|' + c.sold));
  res.porCliente.forEach((_, k) => chaves.add(k));
  const rows = [], todos = [];
  chaves.forEach(k => {
    const [setor, sold] = k.split('|');
    if(setor==='506' || (setorSel!==CR_SETOR_TOTAL && setor!==setorSel)) return;
    const cli = infoCarteira.get(k), compras = res.porCliente.get(k) || {};
    const o = {sold, setor, vendedor: setor,
      razao: (cli && cli.razao) || ((clienteMetaMap && clienteMetaMap.get(sold)) || {}).razaoSocial || '—',
      canal: (cli && cli.canal) || '—', visita: cli && cli.dia ? SC_DIAS[cli.dia] : '—', ciclo: cli ? scCicloLabel(cli.ciclo) : '—',
      carteira: cli ? 'Sim' : 'Não', cobertas: 0, cobertasPrograma: 0, vbcTotal: 0};
    CR_CATEGORIAS_CLIENTE.forEach((c, i) => {
      const comprou = compras[c]!==undefined;
      o['c'+i] = comprou ? 1 : 0; o['v'+i] = compras[c] || 0;
      if(comprou){ o.cobertas++; if(CR_CATEGORIAS.includes(c)) o.cobertasPrograma++; }
      o.vbcTotal += compras[c] || 0;
    });
    o.dia = cli && cli.dia ? String(cli.dia) : '0';
    todos.push(o);
  });
  // Opções de Canal: só os canais que existem no Setor escolhido (o valor atual é mantido se ainda existir).
  const selCanal = document.getElementById('cr-cli-canal');
  const canais = Array.from(new Set(todos.map(o => o.canal))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  selCanal.innerHTML = '<option value="">(Todos)</option>' + canais.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  selCanal.value = canais.includes(canalSel) ? canalSel : '';
  const canalAtivo = selCanal.value;
  todos.forEach(o => {
    if(filtro==='sem' && o.cobertas>0) return;
    if(filtro==='com' && o.cobertas===0) return;
    if(canalAtivo && o.canal!==canalAtivo) return;
    if(diaSel && o.dia!==diaSel) return;
    rows.push(o);
  });
  const headers = [
    {key:'sold', label:'Sold'}, {key:'razao', label:'Razão Social'}, {key:'vendedor', label:'Vendedor'},
    {key:'canal', label:'Canal'}, {key:'visita', label:'Dia Vst'}, {key:'ciclo', label:'Ciclo'},
    {key:'carteira', label:'Na carteira'},
  ];
  CR_CATEGORIAS_CLIENTE.forEach((c, i) => {
    // Cobertura (1/0) e VBC na mesma célula; ordena pelo VBC.
    headers.push({key:'v'+i, label: CR_CAT_CURTO[c], align:'center', cls: CR_CAT_COR[c], format: (v, r) =>
      '<div class="cr-cel">' + (r['c'+i] ? pillHtml('1', 'var(--good-bg)', 'var(--good-ink)') : '<span class="cr-zero">0</span>') +
      '<span class="cr-cel-vbc">' + (v ? fmtBRL0(v) : '—') + '</span></div>'});
  });
  headers.push({key:'cobertasPrograma', label:'Cat. Crescer +', align:'right', format: v => `${v} de ${CR_CATEGORIAS.length}`});
  headers.push({key:'vbcTotal', label:'VBC total', align:'right', format: fmtBRL0});
  makeTable('table-crescer-cli', {headers, rows, getRow: x => x, searchable: true, pageSize: 25, defaultSort: {key:'vbcTotal', dir:'desc'}});
  const sub = document.getElementById('cr-cli-sub');
  if(sub){
    const naCart = rows.filter(r => r.carteira==='Sim').length;
    sub.textContent = `Clientes da carteira (aba BASE) e quem comprou no mês com o Setor, mesmo fora da carteira — ${fmtInt(rows.length)} clientes, ${fmtInt(naCart)} na carteira. 1 = comprou a categoria no mês.`;
  }
}
function crSoma(rows, key){ return rows.reduce((s, r) => s + (Number(r[key])||0), 0); }

function renderCrescer(){
  const wrap = document.getElementById('cr-wrap');
  if(!wrap) return;
  const mesEl = document.getElementById('cr-mes'), setorEl = document.getElementById('cr-setor');
  if(!mesEl.value) mesEl.value = crMesAtualKey();
  const mesKey = mesEl.value;
  const res = crCalcular(mesKey);
  const opcoes = [CR_SETOR_TOTAL].concat(res.setores);
  const atual = setorEl.value || CR_SETOR_TOTAL;
  setorEl.innerHTML = opcoes.map(s => `<option value="${esc(s)}">${esc(crSetorLabel(s))}</option>`).join('');
  setorEl.value = opcoes.includes(atual) ? atual : CR_SETOR_TOTAL;
  const setor = setorEl.value;
  const {cobertura, vbc} = res.linhas(setor);
  document.getElementById('cr-banner-titulo').textContent = 'Acompanhamento Categorias Crescer + NPRO';
  document.getElementById('cr-banner-sub').textContent = crSetorLabel(setor);
  const cal = res.cal;

  const cobFeitas = cobertura.filter(l => l.pct!=null && l.pct>=1).length;
  const vbcFeitas = vbc.filter(l => l.pct!=null && l.pct>=1).length;
  const abaixoIdeal = cobertura.filter(l => !l.ok).length;
  renderKPIs('kpi-crescer', [
    {label:'TT PTS', value: fmtInt(cobFeitas + vbcFeitas), note: 'categorias com 100% (cobertura + VBC)'},
    {label:'Cobertura — feitas', value: `${cobFeitas} de ${CR_CATEGORIAS.length}`, tone: cobFeitas===CR_CATEGORIAS.length ? 'good' : ''},
    {label:'VBC — feitas', value: `${vbcFeitas} de ${CR_CATEGORIAS.length}`, tone: vbcFeitas===CR_CATEGORIAS.length ? 'good' : ''},
    {label:'Ideal do dia', value: fmtPct(cal.ideal), note: `${cal.decorridos} de ${cal.uteis} dias úteis · faltam ${cal.restantes}`},
    {label:'Cobertura abaixo do ideal', value: `${abaixoIdeal} de ${CR_CATEGORIAS.length}`, tone: abaixoIdeal ? 'warning' : 'good'},
  ]);

  const avisoCad = res.origem==='semente' ? ' · metas iniciais copiadas da planilha (salve o cadastro para publicar)'
    : res.origem==='vazio' ? ' · ⚠️ nenhuma meta cadastrada para este mês' : '';
  document.getElementById('cr-info').textContent =
    `Vendas de ${fmtDateBR(cal.iniMs)} a ${fmtDateBR(cal.ateMs)} · dia anterior: ${fmtDateBR(cal.diaAnteriorMs)}` +
    ` · feriados: ${cal.feriados.length ? cal.feriados.map(iso => iso.slice(8,10)+'/'+iso.slice(5,7)).join(', ') : 'nenhum'}` + avisoCad;

  const pctFmt = v => v==null ? '—' : fmtPct(v);
  crTabela('table-crescer-cob', [
    {key:'cat', label:'Subcategoria', format: v => v==='TOTAL' ? 'TOTAL' : crCatTag(v)},
    {key:'meta', label:'Meta', align:'right', format: fmtInt},
    {key:'efetivo', label:'Efetivo', align:'right', format: fmtInt},
    {key:'saldo', label:'Saldo', align:'right', format: fmtInt},
    {key:'pct', label:'%', align:'right', format: pctFmt},
    {key:'ok', label:'Ideal', align:'center', format: (v, r) => r.cat==='TOTAL' ? fmtInt(v) : crOkPill(v, r.pct)},
    {key:'diaAnt', label:'Efet. dia anterior', align:'right', format: fmtInt},
    {key:'evolucao', label:'Evolução', align:'right', format: fmtInt},
    {key:'objDia', label:'Obj. por dia', align:'right', format: fmtInt},
  ], cobertura, {
    cat:'TOTAL', meta: crSoma(cobertura,'meta'), efetivo: crSoma(cobertura,'efetivo'), saldo: crSoma(cobertura,'saldo'),
    pct: null, ok: cobertura.filter(l => l.ok).length, diaAnt: crSoma(cobertura,'diaAnt'),
    evolucao: crSoma(cobertura,'evolucao'), objDia: crSoma(cobertura,'objDia'),
  });

  const totVbc = {cat:'TOTAL', tri: crSoma(vbc,'tri'), meta: crSoma(vbc,'meta'), efetivo: crSoma(vbc,'efetivo'), saldo: crSoma(vbc,'saldo'),
    tendencia: crSoma(vbc,'tendencia'), objDia: crSoma(vbc,'objDia')};
  totVbc.pct = totVbc.meta>0 ? totVbc.efetivo/totVbc.meta : null;
  totVbc.ok = totVbc.pct!=null && totVbc.pct>=cal.ideal;
  crTabela('table-crescer-vbc', [
    {key:'cat', label:'Subcategoria', format: v => v==='TOTAL' ? 'TOTAL' : crCatTag(v)},
    {key:'tri', label:'Últ. trimestre', align:'right', format: fmtBRL0},
    {key:'meta', label:'Meta', align:'right', format: fmtBRL0},
    {key:'efetivo', label:'Efetivo', align:'right', format: fmtBRL0},
    {key:'saldo', label:'Saldo', align:'right', format: fmtBRL0},
    {key:'pct', label:'%', align:'right', format: pctFmt},
    {key:'tendencia', label:'Tendência', align:'right', format: fmtBRL0},
    {key:'ok', label:'Ideal', align:'center', format: (v, r) => crOkPill(v, r.pct)},
    {key:'objDia', label:'Obj. por dia', align:'right', format: fmtBRL0},
  ], vbc, totVbc);
  document.getElementById('cr-vbc-sub').textContent =
    `Meta do Setor = meta da empresa × participação do Setor no VBC de ${fmtDateBR(parseDateOnly(res.triIniISO))} a ${fmtDateBR(parseDateOnly(res.triFimISO))}. Tendência = efetivo ÷ dias decorridos × dias úteis.`;

  crRenderPorVendedor(res);
  crRenderPorCliente(res, setor);
  crPreencherCadastro(mesKey, res);
}

/* ---------------------- Cadastro de metas do mês ---------------------- */
let crPublicando = false;
function crPreencherCadastro(mesKey, res){
  const cal = res.cal, dias = document.getElementById('cr-cad-dias');
  if(dias) dias.textContent = `Dias úteis (automático): ${cal.uteis} · decorridos até hoje: ${cal.decorridos} · restantes: ${cal.restantes}` +
    ` · feriados nacionais e de Sergipe no mês: ${cal.feriados.length ? cal.feriados.map(iso => iso.slice(8,10)+'/'+iso.slice(5,7)).join(', ') : 'nenhum'}`;
  const el = document.getElementById('cr-cad-grid');
  if(!el || el.dataset.mes===mesKey) return; // não apaga o que a pessoa está digitando
  el.dataset.mes = mesKey;
  const cad = res.cad;
  const inp = (attrs, v) => `<input type="number" min="0" step="any" ${attrs} value="${v==null || v==='' ? '' : esc(v)}">`;
  let html = '<div class="table-wrap"><table class="datatable cr-cad-table"><thead><tr><th>Cobertura (clientes)</th>' +
    CR_CATEGORIAS.map(c => `<th style="text-align:right">${esc(c)}</th>`).join('') + '</tr></thead><tbody>';
  [CR_SETOR_TOTAL].concat(res.setores).forEach(st => {
    html += `<tr><td>${esc(crSetorLabel(st))}</td>` + CR_CATEGORIAS.map(c =>
      `<td style="text-align:right">${inp(`data-cr-cob="${esc(st)}" data-cr-cat="${esc(c)}"`, ((cad.cobertura||{})[st]||{})[c])}</td>`).join('') + '</tr>';
  });
  html += '<tr><td><b>VBC da empresa (R$)</b></td>' + CR_CATEGORIAS.map(c =>
    `<td style="text-align:right">${inp(`data-cr-vbc="${esc(c)}"`, (cad.vbc||{})[c])}</td>`).join('') + '</tr>';
  el.innerHTML = html + '</tbody></table></div>';
  document.getElementById('cr-cad-titulo').textContent = `Metas do mês — ${mesKey.slice(5,7)}/${mesKey.slice(0,4)}`;
}
function crMsg(texto, tipo){
  const el = document.getElementById('cr-cad-msg');
  el.textContent = texto || '';
  el.className = 'nrab-msg' + (tipo==='erro' ? ' is-error' : tipo==='ok' ? ' is-ok' : '');
}
function crLerCadastro(){
  const cobertura = {}, vbc = {};
  document.querySelectorAll('[data-cr-cob]').forEach(i => {
    const st = i.dataset.crCob; cobertura[st] = cobertura[st] || {};
    cobertura[st][i.dataset.crCat] = i.value==='' ? 0 : Number(i.value);
  });
  document.querySelectorAll('[data-cr-vbc]').forEach(i => { vbc[i.dataset.crVbc] = i.value==='' ? 0 : Number(i.value); });
  return {cobertura, vbc};
}

function initCrescer(){
  if(!document.getElementById('cr-wrap')) return; // aba não presente neste HTML — módulo fica inerte
  document.getElementById('cr-mes').value = crMesAtualKey();
  document.getElementById('cr-mes').addEventListener('change', renderCrescer);
  document.getElementById('cr-setor').addEventListener('change', renderCrescer);
  ['cr-cli-filtro','cr-cli-canal','cr-cli-dia'].forEach(id => document.getElementById(id).addEventListener('change', renderCrescer));
  document.getElementById('cr-cad-form').addEventListener('submit', e => {
    e.preventDefault();
    if(crPublicando) return;
    const mesKey = document.getElementById('cr-mes').value;
    const rec = crLerCadastro();
    const meses = Object.assign({}, (DATA.crescer && DATA.crescer.meses) || {}, {[mesKey]: rec});
    crPublicando = true;
    const btn = document.getElementById('cr-cad-salvar'); btn.disabled = true;
    crMsg('Publicando metas para todos…', '');
    publicarCampoDATA('crescer', {meses}, 'metas do Crescer +', 'crescer-metas').then(r => {
      crPublicando = false; btn.disabled = false;
      if(r.ok) crMsg(`Metas de ${mesKey.slice(5,7)}/${mesKey.slice(0,4)} salvas e publicadas para todos.`, 'ok');
      else crMsg(`Não consegui publicar (${(r.erro && r.erro.message) || r.erro}) — nada foi alterado. Tente de novo.`, 'erro');
      document.getElementById('cr-cad-grid').dataset.mes = '';
      renderCrescer();
    });
  });
  RENDERERS.crescer = renderCrescer;
}

/* ============================================================================
   BRASILEIRÃO NPRO — módulo isolado
   ----------------------------------------------------------------------------
   Réplica da planilha "BRASILEIRÃO NPRO": Ranking Mensal, RESUMO, COBERTURAS,
   VBC e Por Cliente, calculados a partir da planilha de Vendas (baseVendas) e
   da carteira (aba BASE). Tudo é por SUBCATEGORIA (a "Família" das vendas,
   ex.: "01B-TOP LACTEOS LATA E BAG").
   - Cobertura efetiva = nº de clientes (Sold) que compraram a subcategoria no
     mês com o Setor. Meta do Setor = ROUNDUP(meta da empresa ÷ base total ×
     base do Setor), onde a base é o nº de clientes que compraram NPRO com o
     Setor nos 3 meses anteriores ao mês (a aba Plan2 da planilha). Nas
     subcategorias de Bebidas (07x) a meta de cobertura é por Setor.
   - VBC efetivo = faturamento da subcategoria no mês com o Setor. Meta do
     Setor = meta da empresa × participação do Setor no VBC do trimestre
     anterior (aba "Cálculo Meta PC": sempre os 3 meses antes do mês
     analisado), somando as compras de cada cliente para o vendedor da FORÇA
     do produto — NPRO para o vendedor NPRO do cliente, Bebidas (07x) para o de
     BEBIDAS (coluna GRUPO COMERCIAL da BASE: 3 = NPRO, 4 = BEBIDAS). Assim um
     cliente atendido pelas duas forças não conta em dobro. Nas 07x a meta de
     VBC também é por Setor.
   - Venda feita por vendedor de fora da equipe 500 cai para o vendedor da
     equipe que atende o cliente naquela força.
   - Pontos por subcategoria: 5 se atingiu 100%, 2 se atingiu 60%, senão 0;
     pontuação final = pontos × 1,15. Ranking = pontos finais de VBC + Cobertura.
   Metas do mês são um cadastro publicado para todos (DATA.brasileirao).
   ========================================================================= */

const BR_SUBCATS = ['01B-TOP LACTEOS LATA E BAG','01D-CONDENSADOS INTEGRAL BAG','01F-CONDENSADOS SEMI-DESNATADO BAG',
  '02A-COBERTURA REGULAR NESTLE 500G - 1KG','02B-COBERTURA REGULAR NESTLE 2KG','02E-PASTAS','03A-MAGGI CALDOS',
  '03B-MAGGI TEMPEROS','06A-INGREDIENTE ACHOCOLATADO','07A-CAFE GRAO NESCAFE','07B-CAFE MOIDO NESCAFE',
  '07F-ACHOCOLATADO KIT KAT','07H-CAPPUCCINO NESCAFE'];
const BR_POR_SETOR = sub => sub.startsWith('07'); // Bebidas: meta digitada por Setor
const BR_COR_PREFIXO = {'01':'cr-c-lac','02':'cr-c-cho','03':'cr-c-cul','06':'cr-c-std','07':'cr-c-sol'};
const brCor = sub => BR_COR_PREFIXO[sub.slice(0,2)] || '';
const brCurto = sub => sub.slice(0,3);
const BR_MULT = 1.15;
const BR_TOTAL = '1';
// Metas de setembro/2026 copiadas da planilha — valem até alguém salvar o cadastro.
const BR_SEMENTE = {
  '2026-09': {
    cobEmpresa: {'01B-TOP LACTEOS LATA E BAG':183,'01D-CONDENSADOS INTEGRAL BAG':18,'01F-CONDENSADOS SEMI-DESNATADO BAG':6,
      '02A-COBERTURA REGULAR NESTLE 500G - 1KG':21,'02B-COBERTURA REGULAR NESTLE 2KG':21,'02E-PASTAS':36,'03A-MAGGI CALDOS':116,
      '03B-MAGGI TEMPEROS':49,'06A-INGREDIENTE ACHOCOLATADO':42},
    cobSetor: {
      '505': {'07A-CAFE GRAO NESCAFE':8,'07B-CAFE MOIDO NESCAFE':1,'07F-ACHOCOLATADO KIT KAT':1,'07H-CAPPUCCINO NESCAFE':8},
      '510': {'07A-CAFE GRAO NESCAFE':35,'07B-CAFE MOIDO NESCAFE':6,'07F-ACHOCOLATADO KIT KAT':6,'07H-CAPPUCCINO NESCAFE':37},
    },
    vbcEmpresa: {'01B-TOP LACTEOS LATA E BAG':799565,'01D-CONDENSADOS INTEGRAL BAG':336337,'01F-CONDENSADOS SEMI-DESNATADO BAG':11040,
      '02A-COBERTURA REGULAR NESTLE 500G - 1KG':21563,'02B-COBERTURA REGULAR NESTLE 2KG':44025,'02E-PASTAS':14807,'03A-MAGGI CALDOS':33779,
      '03B-MAGGI TEMPEROS':24996,'06A-INGREDIENTE ACHOCOLATADO':40000},
    vbcSetor: {
      '505': {'07A-CAFE GRAO NESCAFE':5779,'07B-CAFE MOIDO NESCAFE':1197,'07F-ACHOCOLATADO KIT KAT':732,'07H-CAPPUCCINO NESCAFE':9446},
      '510': {'07A-CAFE GRAO NESCAFE':37275,'07B-CAFE MOIDO NESCAFE':7721,'07F-ACHOCOLATADO KIT KAT':4720,'07H-CAPPUCCINO NESCAFE':60922},
    },
  },
};
function brCadastroDoMes(mesKey){
  const salvo = DATA.brasileirao && DATA.brasileirao.meses && DATA.brasileirao.meses[mesKey];
  if(salvo) return {cad: salvo, origem: 'salvo'};
  if(BR_SEMENTE[mesKey]) return {cad: BR_SEMENTE[mesKey], origem: 'semente'};
  return {cad: {cobEmpresa:{}, cobSetor:{}, vbcEmpresa:{}, vbcSetor:{}}, origem: 'vazio'};
}
// Sold -> {npro, beb}: da coluna GRUPO COMERCIAL da BASE (DATA.carteira.forcas). Sem
// ela (carteira antiga), deduz pela carteira: um Setor só = as duas forças; dois
// Setores = o 510 é a força BEBIDAS e o outro a NPRO.
let _brForcasCache = {fonte: undefined, mapa: null};
function brForcas(){
  const fonte = DATA.carteira || DATA.meta20 || null;
  if(_brForcasCache.fonte===fonte && _brForcasCache.mapa) return _brForcasCache.mapa;
  const mapa = new Map();
  if(DATA.carteira && Array.isArray(DATA.carteira.forcas) && DATA.carteira.forcas.length){
    DATA.carteira.forcas.forEach(([sold, npro, beb]) => mapa.set(String(sold), {npro: npro||null, beb: beb||null}));
  }
  const porSold = new Map();
  scDados().carteira.forEach(c => { if(!porSold.has(c.sold)) porSold.set(c.sold, []); porSold.get(c.sold).push(c.setor); });
  porSold.forEach((sts, sold) => {
    if(mapa.has(sold)) return;
    const unicos = Array.from(new Set(sts));
    if(unicos.length===1) mapa.set(sold, {npro: unicos[0], beb: unicos[0]});
    else mapa.set(sold, {npro: unicos.find(x => x!=='510') || unicos[0], beb: unicos.includes('510') ? '510' : unicos[0]});
  });
  _brForcasCache = {fonte, mapa};
  return mapa;
}
function brPontos(pct){ return pct==null ? 0 : pct>=1 ? 5 : pct>=0.6 ? 2 : 0; }

/* ---------------------- Cálculo ---------------------- */
function brCalcular(mesKey){
  const {cad, origem} = brCadastroDoMes(mesKey);
  const cal = crCalendario(mesKey);
  const iniISO = fmtDateOnly(cal.iniMs), ateISO = fmtDateOnly(cal.ateMs);
  const antISO = cal.diaAnteriorMs!=null ? fmtDateOnly(cal.diaAnteriorMs) : null;
  const [ano, mes] = mesKey.split('-').map(Number);
  const triIni = fmtDateOnly(Date.UTC(ano, mes-4, 1)), triFim = fmtDateOnly(Date.UTC(ano, mes-1, 0));
  const setores = crSetores();
  const subs = new Set(BR_SUBCATS);
  const forca = brForcas();
  const equipe = new Set(setores);
  // Quem "atende" o cliente naquele produto: NPRO -> vendedor da força NPRO,
  // Bebidas -> vendedor da força BEBIDAS (na falta de um, o outro).
  const atendente = (sold, origem) => { const f = forca.get(sold); if(!f) return null; return origem==='BEBIDAS' ? (f.beb || f.npro) : (f.npro || f.beb); };

  const compradores = new Map(), compradoresAnt = new Map(), vbcMes = new Map(), vbcTri = new Map();
  // compradoresAnt: clientes (Sold) que compraram a subcategoria NO dia anterior (cliente × subcategoria × data).
  const baseSetor = new Map(); // Setor -> Set(Sold) que comprou NPRO no trimestre
  const porCliente = new Map(); // Setor|Sold -> {sub: faturamento}
  for(const r of (DATA.baseVendas||[])){
    const iso = r[3]; if(!iso || r[1]==null) continue;
    const sold = String(r[0]), sub = r[6], fat = Number(r[9])||0;
    // Venda feita por vendedor de fora da equipe 500 cai para quem atende o cliente.
    const setor = equipe.has(String(r[1])) ? String(r[1]) : atendente(sold, r[7]);
    if(!setor) continue;
    const noTri = iso>=triIni && iso<=triFim;
    if(noTri && r[7]==='NPRO'){ let b = baseSetor.get(setor); if(!b){ b = new Set(); baseSetor.set(setor, b); } b.add(sold); }
    if(!subs.has(sub)) continue;
    // Trimestre da meta ("Cálculo Meta PC"): todas as compras do cliente, cada uma para o
    // vendedor da força do produto — um cliente com as duas forças não conta em dobro.
    if(noTri){ const st = atendente(sold, BR_POR_SETOR(sub) ? 'BEBIDAS' : 'NPRO'); if(st){ const k = st+'|'+sub; vbcTri.set(k, (vbcTri.get(k)||0) + fat); } }
    if(iso<iniISO || iso>ateISO) continue;
    const k = setor + '|' + sub;
    vbcMes.set(k, (vbcMes.get(k)||0) + fat);
    let c = compradores.get(k); if(!c){ c = new Set(); compradores.set(k, c); } c.add(sold);
    if(antISO && iso===antISO){ let a = compradoresAnt.get(k); if(!a){ a = new Set(); compradoresAnt.set(k, a); } a.add(sold); }
    const kc = setor + '|' + sold;
    let o = porCliente.get(kc); if(!o){ o = {}; porCliente.set(kc, o); }
    o[sub] = (o[sub]||0) + fat;
  }
  // Vendas de fora da equipe para clientes fora da carteira: só no total da empresa.
  const FORA = '__fora__';
  for(const r of (DATA.vendasForaEquipe||[])){
    const iso = r[3], sub = r[6];
    if(!iso || !subs.has(sub) || iso<iniISO || iso>ateISO) continue;
    const k = FORA + '|' + sub, sold = String(r[0]);
    vbcMes.set(k, (vbcMes.get(k)||0) + (Number(r[9])||0));
    let c = compradores.get(k); if(!c){ c = new Set(); compradores.set(k, c); } c.add(sold);
    if(antISO && iso===antISO){ let a = compradoresAnt.get(k); if(!a){ a = new Set(); compradoresAnt.set(k, a); } a.add(sold); }
  }
  const num = v => Number(v)||0;
  const base = st => (baseSetor.get(st) || new Set()).size;
  const baseTotal = setores.reduce((s, st) => s + base(st), 0);
  const triTotal = sub => setores.reduce((s, st) => s + num(vbcTri.get(st+'|'+sub)), 0);

  function metaCob(st, sub){
    if(BR_POR_SETOR(sub)) return num(((cad.cobSetor||{})[st]||{})[sub]);
    const emp = num((cad.cobEmpresa||{})[sub]);
    return baseTotal>0 ? Math.ceil(emp/baseTotal*base(st)) : 0;
  }
  function metaVbc(st, sub){
    if(BR_POR_SETOR(sub)) return num(((cad.vbcSetor||{})[st]||{})[sub]);
    const emp = num((cad.vbcEmpresa||{})[sub]), tt = triTotal(sub);
    return tt>0 ? num(vbcTri.get(st+'|'+sub))/tt*emp : 0;
  }
  // Linhas de um Setor (ou do total: soma dos Setores, com % e pontos sobre a soma).
  function linhas(st){
    const lista = st===BR_TOTAL ? setores : [st];
    const soma = f => lista.reduce((s, x) => s + f(x), 0);
    // No total da empresa, o efetivo inclui as vendas de outros vendedores da MB (FORA).
    const somaEf = f => soma(f) + (st===BR_TOTAL ? f(FORA) : 0);
    const cobertura = BR_SUBCATS.map(sub => {
      const meta = soma(x => metaCob(x, sub)), efetivo = somaEf(x => (compradores.get(x+'|'+sub)||new Set()).size);
      const ant = somaEf(x => (compradoresAnt.get(x+'|'+sub)||new Set()).size);
      const pct = meta>0 ? efetivo/meta : null, pts = brPontos(pct);
      return {sub, meta, efetivo, saldo: meta-efetivo, pct, ok: pct!=null && pct>=cal.ideal, ant, evolucao: efetivo-ant,
        pts, final: pts*BR_MULT, objDia: Math.max(0, Math.ceil((meta-efetivo)/Math.max(1, cal.restantes)))};
    });
    const vbc = BR_SUBCATS.map(sub => {
      const meta = soma(x => metaVbc(x, sub)), efetivo = somaEf(x => num(vbcMes.get(x+'|'+sub)));
      const pct = meta>0 ? efetivo/meta : null, pts = brPontos(pct);
      return {sub, meta, efetivo, saldo: meta-efetivo, pct, ok: pct!=null && pct>=cal.ideal,
        tendencia: cal.decorridos ? efetivo/cal.decorridos*cal.uteis : null,
        pts, final: pts*BR_MULT, objDia: Math.max(0, Math.ceil((meta-efetivo)/Math.max(1, cal.restantes)))};
    });
    const ptsCob = cobertura.reduce((s, l) => s + l.pts, 0), ptsVbc = vbc.reduce((s, l) => s + l.pts, 0);
    return {cobertura, vbc, ptsCob, ptsVbc, finalCob: ptsCob*BR_MULT, finalVbc: ptsVbc*BR_MULT,
      base: soma(base), total: (ptsCob+ptsVbc)*BR_MULT};
  }
  return {cad, origem, cal, setores, linhas, porCliente, triIni, triFim};
}

/* ---------------------- Render ---------------------- */
const brLabel = st => st===BR_TOTAL ? '1 (Total)' : String(st);
const brPtsFmt = v => v==null ? '—' : (Math.round(v*100)/100).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
function brSubTag(sub){ return `<span class="cr-cat-tag ${brCor(sub)}">${esc(sub)}</span>`; }

function brRenderRanking(res){
  const vend = res.setores.filter(st => st!=='555').map(st => Object.assign({st}, res.linhas(st)));
  vend.sort((a, b) => b.total - a.total || a.st.localeCompare(b.st));
  const tot = res.linhas(BR_TOTAL);
  const rows = vend.map((v, i) => ({pos: (i+1)+'º', setor: v.st, vbc: v.finalVbc, cob: v.finalCob, total: v.total, lider: i===0}));
  crTabela('table-br-ranking', [
    {key:'pos', label:'Colocação', format: (v, r) => r.lider ? `<span class="br-lider">🏆 ${esc(v)}</span>` : esc(v)},
    {key:'setor', label:'Setor'},
    {key:'vbc', label:'VBC', align:'right', format: brPtsFmt},
    {key:'cob', label:'Cobertura', align:'right', format: brPtsFmt},
    {key:'total', label:'Total', align:'right', format: v => `<b>${brPtsFmt(v)}</b>`},
  ], rows, {pos:'Supervisor 500 / Empresa 1', setor:'', vbc: tot.finalVbc, cob: tot.finalCob, total: tot.total});
}

function brRenderResumo(res, st){
  const l = res.linhas(st), cal = res.cal;
  const possib = BR_SUBCATS.length*5;
  renderKPIs('kpi-br', [
    {label:'TT PTS (final)', value: brPtsFmt(l.total), note: `pontos × ${String(BR_MULT).replace('.', ',')}`},
    {label:'Cobertura — pontos', value: `${l.ptsCob} de ${possib}`, note: `final ${brPtsFmt(l.finalCob)}`},
    {label:'VBC — pontos', value: `${l.ptsVbc} de ${possib}`, note: `final ${brPtsFmt(l.finalVbc)}`},
    {label:'Ideal do dia', value: fmtPct(cal.ideal), note: `${cal.decorridos} de ${cal.uteis} dias úteis · faltam ${cal.restantes}`},
    {label:'Base de clientes', value: fmtInt(l.base), note: 'compraram NPRO no trimestre anterior'},
  ]);
  const pctFmt = v => v==null ? '—' : fmtPct(v);
  const tag = v => v==='TOTAL' ? 'TOTAL' : brSubTag(v);
  const soma = (rows, k) => rows.reduce((s, r) => s + (Number(r[k])||0), 0);
  crTabela('table-br-cob', [
    {key:'sub', label:'Subcategoria', format: tag},
    {key:'meta', label:'Meta', align:'right', format: fmtInt},
    {key:'efetivo', label:'Efetivo', align:'right', format: fmtInt},
    {key:'saldo', label:'Saldo', align:'right', format: fmtInt},
    {key:'pct', label:'%', align:'right', format: pctFmt},
    {key:'ok', label:'Ideal', align:'center', format: (v, r) => r.sub==='TOTAL' ? fmtInt(v) : crOkPill(v, r.pct)},
    {key:'ant', label:'Efet. dia anterior', align:'right', format: fmtInt},
    {key:'evolucao', label:'Evolução', align:'right', format: fmtInt},
    {key:'pts', label:'Pontos', align:'right', format: fmtInt},
    {key:'final', label:'Pontuação final', align:'right', format: brPtsFmt},
    {key:'objDia', label:'Obj. por dia', align:'right', format: fmtInt},
  ], l.cobertura, {sub:'TOTAL', meta: soma(l.cobertura,'meta'), efetivo: soma(l.cobertura,'efetivo'), saldo: soma(l.cobertura,'saldo'),
    pct: null, ok: l.cobertura.filter(x => x.ok).length, ant: soma(l.cobertura,'ant'), evolucao: soma(l.cobertura,'evolucao'),
    pts: l.ptsCob, final: l.finalCob, objDia: soma(l.cobertura,'objDia')});
  const tv = {sub:'TOTAL', meta: soma(l.vbc,'meta'), efetivo: soma(l.vbc,'efetivo'), saldo: soma(l.vbc,'saldo'),
    tendencia: soma(l.vbc,'tendencia'), pts: l.ptsVbc, final: l.finalVbc, objDia: soma(l.vbc,'objDia')};
  tv.pct = tv.meta>0 ? tv.efetivo/tv.meta : null; tv.ok = tv.pct!=null && tv.pct>=cal.ideal;
  crTabela('table-br-vbc', [
    {key:'sub', label:'Subcategoria', format: tag},
    {key:'meta', label:'Meta', align:'right', format: fmtBRL0},
    {key:'efetivo', label:'Efetivo', align:'right', format: fmtBRL0},
    {key:'saldo', label:'Saldo', align:'right', format: fmtBRL0},
    {key:'pct', label:'%', align:'right', format: pctFmt},
    {key:'tendencia', label:'Tendência', align:'right', format: fmtBRL0},
    {key:'ok', label:'Ideal', align:'center', format: (v, r) => crOkPill(v, r.pct)},
    {key:'pts', label:'Pontos', align:'right', format: fmtInt},
    {key:'final', label:'Pontuação final', align:'right', format: brPtsFmt},
    {key:'objDia', label:'Obj. por dia', align:'right', format: fmtBRL0},
  ], l.vbc, tv);
}

// Uma tabela por subcategoria (Cobertura e VBC lado a lado, por Setor) e, no
// fim, a tabela de totais do Setor em relação ao objetivo.
function brRenderPorVendedor(res){
  const lista = res.setores.concat([BR_TOTAL]).map(st => ({st, l: res.linhas(st)}));
  const pctFmt = v => v==null ? '—' : fmtPct(v);
  const box = document.getElementById('br-subs');
  if(box.childElementCount !== BR_SUBCATS.length){
    box.innerHTML = BR_SUBCATS.map((sub, i) =>
      `<div class="br-sub-bloco"><h4 class="br-sub-titulo">${brSubTag(sub)}</h4><div id="table-br-sub-${i}"></div></div>`).join('');
  }
  BR_SUBCATS.forEach((sub, i) => {
    const cls = brCor(sub);
    const headers = [
      {key:'setor', label:'Setor'},
      {key:'cm', label:'Meta', align:'right', grupo:'Cobertura', cls, format: fmtInt},
      {key:'ce', label:'Efet.', align:'right', grupo:'Cobertura', cls, format: fmtInt},
      {key:'cp', label:'%', align:'right', grupo:'Cobertura', cls, format: pctFmt},
      {key:'ct', label:'Pts', align:'right', grupo:'Cobertura', cls, format: fmtInt},
      {key:'vm', label:'Meta', align:'right', grupo:'VBC', cls, format: fmtBRL0},
      {key:'ve', label:'Efet.', align:'right', grupo:'VBC', cls, format: fmtBRL0},
      {key:'vp', label:'%', align:'right', grupo:'VBC', cls, format: pctFmt},
      {key:'vt', label:'Pts', align:'right', grupo:'VBC', cls, format: fmtInt},
    ];
    const linha = ({st, l}) => {
      const c = l.cobertura[i], v = l.vbc[i];
      return {setor: brLabel(st), cm: c.meta, ce: c.efetivo, cp: c.pct, ct: c.pts, vm: v.meta, ve: v.efetivo, vp: v.pct, vt: v.pts};
    };
    crTabela('table-br-sub-'+i, headers, lista.filter(x => x.st!==BR_TOTAL).map(linha), linha(lista.find(x => x.st===BR_TOTAL)));
  });

  const soma = (arr, k) => arr.reduce((t, x) => t + (Number(x[k])||0), 0);
  const tot = ({st, l}) => {
    const cm = soma(l.cobertura,'meta'), ce = soma(l.cobertura,'efetivo'), vm = soma(l.vbc,'meta'), ve = soma(l.vbc,'efetivo');
    return {setor: brLabel(st), cm, ce, cp: cm>0 ? ce/cm : null, ct: l.ptsCob, cf: l.finalCob,
      vm, ve, vp: vm>0 ? ve/vm : null, vt: l.ptsVbc, vf: l.finalVbc, total: l.total};
  };
  crTabela('table-br-totais', [
    {key:'setor', label:'Setor'},
    {key:'cm', label:'Objetivo', align:'right', grupo:'Cobertura (clientes)', format: fmtInt},
    {key:'ce', label:'Efetivo', align:'right', grupo:'Cobertura (clientes)', format: fmtInt},
    {key:'cp', label:'%', align:'right', grupo:'Cobertura (clientes)', format: pctFmt},
    {key:'ct', label:'Pontos', align:'right', grupo:'Cobertura (clientes)', format: fmtInt},
    {key:'cf', label:'Final', align:'right', grupo:'Cobertura (clientes)', format: brPtsFmt},
    {key:'vm', label:'Objetivo', align:'right', grupo:'VBC', format: fmtBRL0},
    {key:'ve', label:'Efetivo', align:'right', grupo:'VBC', format: fmtBRL0},
    {key:'vp', label:'%', align:'right', grupo:'VBC', format: pctFmt},
    {key:'vt', label:'Pontos', align:'right', grupo:'VBC', format: fmtInt},
    {key:'vf', label:'Final', align:'right', grupo:'VBC', format: brPtsFmt},
    {key:'total', label:'Total final', align:'right', grupo:' ', format: v => `<b>${brPtsFmt(v)}</b>`},
  ], lista.filter(x => x.st!==BR_TOTAL).map(tot), tot(lista.find(x => x.st===BR_TOTAL)));
}

function brRenderPorCliente(res, setorSel){
  const {carteira} = scDados();
  const val = id => (document.getElementById(id)||{}).value || '';
  const filtro = val('br-cli-filtro'), canalSel = val('br-cli-canal'), diaSel = val('br-cli-dia');
  const info = new Map(carteira.map(c => [c.setor + '|' + c.sold, c]));
  const chaves = new Set();
  carteira.forEach(c => chaves.add(c.setor + '|' + c.sold));
  res.porCliente.forEach((_, k) => chaves.add(k));
  const todos = [];
  chaves.forEach(k => {
    const [setor, sold] = k.split('|');
    if(setor==='506' || (setorSel!==BR_TOTAL && setor!==setorSel)) return;
    const cli = info.get(k), compras = res.porCliente.get(k) || {};
    const o = {sold, setor, razao: (cli && cli.razao) || ((clienteMetaMap && clienteMetaMap.get(sold)) || {}).razaoSocial || '—',
      canal: (cli && cli.canal) || '—', visita: cli && cli.dia ? SC_DIAS[cli.dia] : '—', dia: cli && cli.dia ? String(cli.dia) : '0',
      ciclo: cli ? scCicloLabel(cli.ciclo) : '—', carteira: cli ? 'Sim' : 'Não', realizadas: 0, vbcTotal: 0};
    BR_SUBCATS.forEach((sub, i) => {
      const v = compras[sub] || 0, r = compras[sub]!==undefined;
      o['r'+i] = r ? 1 : 0; o['v'+i] = v; if(r) o.realizadas++; o.vbcTotal += v;
    });
    todos.push(o);
  });
  const selCanal = document.getElementById('br-cli-canal');
  const canais = Array.from(new Set(todos.map(o => o.canal))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  selCanal.innerHTML = '<option value="">(Todos)</option>' + canais.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  selCanal.value = canais.includes(canalSel) ? canalSel : '';
  const rows = todos.filter(o => !(filtro==='sem' && o.realizadas>0) && !(filtro==='com' && o.realizadas===0)
    && !(selCanal.value && o.canal!==selCanal.value) && !(diaSel && o.dia!==diaSel));
  const headers = [
    {key:'sold', label:'Sold'}, {key:'razao', label:'Razão Social'}, {key:'setor', label:'Setor'},
    {key:'canal', label:'Canal'}, {key:'visita', label:'Dia Vst'}, {key:'ciclo', label:'Ciclo'}, {key:'carteira', label:'Na carteira'},
  ];
  BR_SUBCATS.forEach((sub, i) => headers.push({key:'v'+i, label: brCurto(sub), align:'center', cls: brCor(sub), format: (v, r) =>
    '<div class="cr-cel">' + (r['r'+i] ? pillHtml('R', 'var(--good-bg)', 'var(--good-ink)') : '<span class="cr-zero">S</span>') +
    '<span class="cr-cel-vbc">' + (v ? fmtBRL0(v) : '—') + '</span></div>'}));
  headers.push({key:'realizadas', label:'Subcat. realizadas', align:'right', format: v => `${v} de ${BR_SUBCATS.length}`},
    {key:'vbcTotal', label:'VBC total', align:'right', format: fmtBRL0});
  makeTable('table-br-cli', {headers, rows, getRow: x => x, searchable: true, pageSize: 25, defaultSort: {key:'vbcTotal', dir:'desc'}});
  document.getElementById('br-cli-sub').textContent =
    `${fmtInt(rows.length)} clientes (carteira da aba BASE + quem comprou no mês com o Setor). R = comprou a subcategoria no mês; S = ainda não.`;
  const leg = document.getElementById('br-cli-legenda');
  if(leg && !leg.innerHTML) leg.innerHTML = BR_SUBCATS.map(brSubTag).join(' ');
}

function renderBrasileirao(){
  const wrap = document.getElementById('br-wrap');
  if(!wrap) return;
  const mesEl = document.getElementById('br-mes'), setorEl = document.getElementById('br-setor');
  if(!mesEl.value) mesEl.value = crMesAtualKey();
  const mesKey = mesEl.value;
  const res = brCalcular(mesKey);
  const opcoes = [BR_TOTAL].concat(res.setores);
  const atual = setorEl.value || BR_TOTAL;
  setorEl.innerHTML = opcoes.map(s => `<option value="${esc(s)}">${esc(brLabel(s))}</option>`).join('');
  setorEl.value = opcoes.includes(atual) ? atual : BR_TOTAL;
  const st = setorEl.value;
  document.getElementById('br-banner-sub').textContent = brLabel(st);
  const cal = res.cal;
  document.getElementById('br-info').textContent =
    `Vendas de ${fmtDateBR(cal.iniMs)} a ${fmtDateBR(cal.ateMs)} · dia anterior: ${fmtDateBR(cal.diaAnteriorMs)}` +
    ` · trimestre da meta: ${fmtDateBR(parseDateOnly(res.triIni))} a ${fmtDateBR(parseDateOnly(res.triFim))}` +
    (res.origem==='semente' ? ' · metas iniciais copiadas da planilha (salve o cadastro para publicar)'
      : res.origem==='vazio' ? ' · ⚠️ nenhuma meta cadastrada para este mês' : '');
  brRenderRanking(res);
  brRenderResumo(res, st);
  brRenderPorVendedor(res);
  brRenderPorCliente(res, st);
  brPreencherCadastro(mesKey, res);
}

/* ---------------------- Cadastro de metas do mês ---------------------- */
let brPublicando = false;
function brPreencherCadastro(mesKey, res){
  const el = document.getElementById('br-cad-grid');
  if(!el || el.dataset.mes===mesKey) return; // não apaga o que a pessoa está digitando
  el.dataset.mes = mesKey;
  const cad = res.cad;
  const inp = (attrs, v) => `<input type="number" min="0" step="any" ${attrs} value="${v==null || v==='' ? '' : esc(v)}">`;
  const npro = BR_SUBCATS.filter(s => !BR_POR_SETOR(s)), beb = BR_SUBCATS.filter(BR_POR_SETOR);
  let html = '<div class="table-wrap"><table class="datatable cr-cad-table"><thead><tr><th>Meta da empresa</th>' +
    npro.map(s => `<th class="${brCor(s)}" style="text-align:right" title="${esc(s)}">${esc(brCurto(s))}</th>`).join('') + '</tr></thead><tbody>';
  html += '<tr><td>Cobertura (clientes)</td>' + npro.map(s => `<td class="${brCor(s)}" style="text-align:right">${inp(`data-br-cobemp="${esc(s)}"`, (cad.cobEmpresa||{})[s])}</td>`).join('') + '</tr>';
  html += '<tr><td>VBC (R$)</td>' + npro.map(s => `<td class="${brCor(s)}" style="text-align:right">${inp(`data-br-vbcemp="${esc(s)}"`, (cad.vbcEmpresa||{})[s])}</td>`).join('') + '</tr>';
  html += '</tbody></table></div>';
  html += '<div class="table-wrap" style="margin-top:12px;"><table class="datatable cr-cad-table"><thead><tr><th rowspan="2">Setor</th>' +
    beb.map(s => `<th colspan="2" class="cr-grupo ${brCor(s)}" title="${esc(s)}">${esc(s)}</th>`).join('') + '</tr><tr>' +
    beb.map(s => `<th class="${brCor(s)}" style="text-align:right">Cobertura</th><th class="${brCor(s)}" style="text-align:right">VBC (R$)</th>`).join('') + '</tr></thead><tbody>';
  res.setores.forEach(st => {
    html += `<tr><td>${esc(st)}</td>` + beb.map(s =>
      `<td class="${brCor(s)}" style="text-align:right">${inp(`data-br-cobset="${esc(st)}" data-br-sub="${esc(s)}"`, ((cad.cobSetor||{})[st]||{})[s])}</td>` +
      `<td class="${brCor(s)}" style="text-align:right">${inp(`data-br-vbcset="${esc(st)}" data-br-sub="${esc(s)}"`, ((cad.vbcSetor||{})[st]||{})[s])}</td>`).join('') + '</tr>';
  });
  el.innerHTML = html + '</tbody></table></div>';
  document.getElementById('br-cad-titulo').textContent = `Metas do mês — ${mesKey.slice(5,7)}/${mesKey.slice(0,4)}`;
}
function brLerCadastro(){
  const rec = {cobEmpresa:{}, vbcEmpresa:{}, cobSetor:{}, vbcSetor:{}};
  const n = i => i.value==='' ? 0 : Number(i.value);
  document.querySelectorAll('[data-br-cobemp]').forEach(i => { rec.cobEmpresa[i.dataset.brCobemp] = n(i); });
  document.querySelectorAll('[data-br-vbcemp]').forEach(i => { rec.vbcEmpresa[i.dataset.brVbcemp] = n(i); });
  document.querySelectorAll('[data-br-cobset]').forEach(i => { const st = i.dataset.brCobset; (rec.cobSetor[st] = rec.cobSetor[st] || {})[i.dataset.brSub] = n(i); });
  document.querySelectorAll('[data-br-vbcset]').forEach(i => { const st = i.dataset.brVbcset; (rec.vbcSetor[st] = rec.vbcSetor[st] || {})[i.dataset.brSub] = n(i); });
  return rec;
}
function brMsg(texto, tipo){
  const el = document.getElementById('br-cad-msg');
  el.textContent = texto || '';
  el.className = 'nrab-msg' + (tipo==='erro' ? ' is-error' : tipo==='ok' ? ' is-ok' : '');
}

function initBrasileirao(){
  if(!document.getElementById('br-wrap')) return; // aba não presente neste HTML — módulo fica inerte
  document.getElementById('br-mes').value = crMesAtualKey();
  ['br-mes','br-setor','br-cli-filtro','br-cli-canal','br-cli-dia'].forEach(id => document.getElementById(id).addEventListener('change', renderBrasileirao));
  document.getElementById('br-cad-form').addEventListener('submit', e => {
    e.preventDefault();
    if(brPublicando) return;
    const mesKey = document.getElementById('br-mes').value;
    const meses = Object.assign({}, (DATA.brasileirao && DATA.brasileirao.meses) || {}, {[mesKey]: brLerCadastro()});
    brPublicando = true;
    const btn = document.getElementById('br-cad-salvar'); btn.disabled = true;
    brMsg('Publicando metas para todos…', '');
    publicarCampoDATA('brasileirao', {meses}, 'metas do Brasileirão', 'brasileirao-metas').then(r => {
      brPublicando = false; btn.disabled = false;
      if(r.ok) brMsg(`Metas de ${mesKey.slice(5,7)}/${mesKey.slice(0,4)} salvas e publicadas para todos.`, 'ok');
      else brMsg(`Não consegui publicar (${(r.erro && r.erro.message) || r.erro}) — nada foi alterado. Tente de novo.`, 'erro');
      document.getElementById('br-cad-grid').dataset.mes = '';
      renderBrasileirao();
    });
  });
  RENDERERS.brasileirao = renderBrasileirao;
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
  (function(){ const m = document.getElementById('cob-mes'); if(m){ cobMesAtual(); m.addEventListener('change', renderCobertura); } })();
  buildFilterBar('painel','painelvend','painelvend');
  initMapaVenda();
  initNrab();
  initMeta20();
  initSemCompra();
  initCrescer();
  initBrasileirao();
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
const SNAPSHOT_URL = '/api/snapshot';
const SNAPSHOT_ORIGINAL_URL = 'data/snapshot.json';

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

let PUBLICADO_EM = null; // quando a versão que está no ar foi publicada (ISO)

async function carregarSnapshotDireto(){
  try {
    const r = await fetch(SNAPSHOT_URL);
    if(!r.ok) throw new Error('api ' + r.status);
    return {dados: await r.json(), publicadoEm: decodeURIComponent(r.headers.get('X-Painel-Publicado-Em') || '')};
  } catch(e){
    const r = await fetch(SNAPSHOT_ORIGINAL_URL);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return {dados: await r.json(), publicadoEm: ''};
  }
}

async function boot(){
  const sub = document.getElementById('boot-sub');
  let snapshot;
  try {
    // O download já foi iniciado pelo <script> no <head> do index.html — aqui só
    // aguardamos. Se por algum motivo a promise não existir, busca na hora.
    const payload = await (window.__snapshotPromise || carregarSnapshotDireto());
    snapshot = payload.dados;
    PUBLICADO_EM = payload.publicadoEm || null;
  } catch(err){
    bootFail('Falha ao baixar os dados do painel (data/snapshot.json). Verifique a conexão e tente de novo.', err);
    return;
  }
  if(sub) sub.textContent = 'Calculando indicadores…';
  try {
    DATA = snapshot;
    initProdutoMaster();                 // cadastro de produtos: sempre do snapshot carregado
    loadStoredSnapshotIfAny(PUBLICADO_EM); // cópia local não publicada, se ainda valer
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
