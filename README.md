# Painel NPRO + Bebidas — Estoque × Vendas

Painel web da Mblogística (Nestlé Professional) — versão site estático, pronta para a Vercel.
Sem build, sem framework, sem servidor: o navegador baixa os arquivos e calcula tudo localmente.

## Estrutura

```
index.html                 página (markup + <head>; dispara o download do snapshot)
assets/app.css             estilos (tokens da identidade MB)
assets/app.js              motor de cálculo, filtros, gráficos, impressão A4 e importação
assets/xlsx.min.js         SheetJS — carregado sob demanda, só quando alguém envia planilha
assets/logo-nestle-professional.png
assets/favicon.svg
data/snapshot.json         os dados (estoque, vendas, clientes, cadastro de produtos)
vercel.json                cabeçalhos de cache e segurança
```

## Como atualizar os dados

Duas formas, as duas sem mexer em código:

1. **Pela tela** — botões "Enviar Estoque" / "Enviar Vendas" no topo. O arquivo é lido no
   próprio navegador (nada sobe para servidor nenhum) e fica guardado no `localStorage`
   daquele navegador. Vale só para quem enviou; "Restaurar original" volta ao publicado.
2. **Para todo mundo** — troque `data/snapshot.json` e publique de novo. É o snapshot que
   todos os acessos passam a ver.

## Publicar

```bash
vercel deploy --prod
```

## Notas de arquitetura

- `data/snapshot.json` é baixado por um `<script>` no `<head>`, antes do `app.js` (que é
  `defer`) — uma única requisição, sem bloquear o primeiro paint. Enquanto ele não chega,
  a tela de boot fica visível; se falhar, aparece o motivo e o botão de tentar de novo.
- Todo o cálculo (DDE, ruptura, giro, ABC, cobertura, cross-sell) roda no navegador a partir
  das linhas de transação — o painel não tem backend nem banco.
- O conteúdo é dado interno da operação. Mantenha a proteção de acesso do projeto ligada
  (Vercel Authentication ou senha) — o `vercel.json` já envia `X-Robots-Tag: noindex`, mas
  isso só impede indexação, não acesso.
