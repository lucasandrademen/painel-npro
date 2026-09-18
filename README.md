# Painel NPRO + Bebidas — Estoque × Vendas

Painel web da Mblogística (Nestlé Professional), na Vercel: página estática + uma função
(`/api/snapshot`) que guarda os dados **no próprio aplicativo**. Todo o cálculo (DDE,
ruptura, giro, ABC, cobertura, cross-sell, Mapa da Venda) roda no navegador, a partir das
linhas de transação — não existe banco de dados nem back-end de negócio.

Produção: https://painel-npro.vercel.app  
Código: https://github.com/lucasandrademen/painel-npro — todo push na `main` publica sozinho.

## Estrutura

```
index.html                 página (markup + <head>; dispara o download dos dados)
assets/app.css             estilos (tokens da identidade MB)
assets/app.js              motor de cálculo, filtros, gráficos, impressão A4, importação
assets/xlsx.min.js         SheetJS — carregado sob demanda, só quando alguém envia planilha
assets/logo-nestle-professional.png · assets/favicon.svg
data/snapshot.json         snapshot ORIGINAL (o ponto de partida, e o "restaurar original")
api/snapshot.js            guarda e serve a versão publicada (Vercel Blob)
vercel.json                cabeçalhos de cache e segurança
```

## Como os dados são atualizados

Pela própria tela, nos botões **Enviar Estoque** / **Enviar Vendas**:

1. a planilha é lida no navegador de quem enviou (nada de servidor de processamento);
2. aparece o resumo da importação para conferir antes de aplicar;
3. ao confirmar, o painel pede a **senha de publicação** e grava a nova versão no app —
   a partir daí **todo mundo** que abrir o link vê esses números, em qualquer máquina.

Se a publicação não der certo (senha errada, sem rede, ou a pessoa escolher "Só neste
navegador"), a atualização continua valendo na tela e fica guardada no `localStorage`
daquele navegador, com aviso de que os outros ainda veem a versão anterior. Assim que
alguém publica algo mais novo, essa cópia local é descartada sozinha.

Nenhuma publicação apaga a anterior: cada uma arquiva a versão que estava no ar em
`historico/`. O botão **Desfazer publicação** volta para a última; **Restaurar original**
devolve o `data/snapshot.json` que veio com o site.

### A função

| rota | o que faz |
| --- | --- |
| `GET /api/snapshot` | a versão publicada; se ninguém publicou, redireciona para `data/snapshot.json` |
| `GET /api/snapshot?historico=1` | versão atual + lista das anteriores |
| `POST /api/snapshot` | publica (`{snapshot, arquivo, tipo}`, gzip+base64, header `x-painel-senha`) |
| `POST /api/snapshot` | restaura (`{restaurar: "historico/…json"}`) |

Variáveis de ambiente (Vercel → Settings → Environment Variables):

- `BLOB_READ_WRITE_TOKEN` — criada junto com o Blob store `painel-npro` (privado).
- `PAINEL_SENHA_PUBLICACAO` — a senha que o painel pede na hora de publicar.
  Para trocar: `vercel env rm PAINEL_SENHA_PUBLICACAO production` e
  `vercel env add PAINEL_SENHA_PUBLICACAO production`, depois `vercel deploy --prod`.

## Rodar local

```bash
vercel dev --listen 4173
```

`vercel dev` usa as variáveis de Development, ou seja, escreve no **mesmo** Blob store de
produção — publicar durante um teste troca os dados de todo mundo. Para mexer só na
interface, `python3 -m http.server 4173` serve a página com o snapshot original (a função
não existe e o painel cai no arquivo estático sozinho).

## Mexer no projeto (para quem entrou agora)

```bash
git clone <url-deste-repositorio> && cd painel-npro
npm install            # só por causa do @vercel/blob, usado pela função
vercel link            # escolha o time mb-logistica e o projeto painel-npro
vercel dev --listen 4173
```

Para mudar a **aparência ou os cálculos**, mexa em `assets/app.css` / `assets/app.js`;
a página é `index.html`. Depois de alterar `app.js` ou `app.css`, suba o `?v=` deles no
`index.html` — é o que faz o navegador de quem já usou o painel pegar a versão nova em vez
da que está em cache.

Publicar o código:

```bash
git push           # se o projeto estiver conectado ao Git na Vercel, já publica sozinho
vercel deploy --prod   # publicação manual, sem depender do Git
```

Quem pode publicar: membros do time **mb-logistica** na Vercel (Settings → Members) e,
para o push, quem tiver acesso a este repositório.

## Nota de acesso

O conteúdo é dado interno da operação (faturamento, clientes, vendedores) e hoje o link é
**público** — `X-Robots-Tag: noindex` impede indexação, não acesso. Para fechar:
Vercel → Settings → Deployment Protection (senha ou Vercel Authentication).
