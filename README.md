# Belmiro Bolos — Cardápio Digital

Site estático (HTML + CSS + JavaScript puro, sem dependências) que funciona como cardápio digital
e envia o pedido já preenchido para o WhatsApp da loja.

## Estrutura

```
index.html          Estrutura da página (não precisa editar no dia a dia)
css/style.css       Visual; cores da marca nas variáveis no topo do arquivo
js/config.js        ► Número do WhatsApp, categorias, rodapé
js/produtos.js      ► Lista de produtos (nome, preço, foto, disponível...)
js/app.js           Lógica (busca, carrinho, formulário, WhatsApp)
img/utils/logo.png  Logo oficial (logo-horizontal.png = versão recortada usada no site)
img/logo.svg        Ícone da aba do navegador (provisório)
img/produtos/       Fotos dos produtos (provisórias)
_headers            Cabeçalhos de segurança (Netlify / Cloudflare Pages)
```

## Tarefas comuns

### Trocar o número do WhatsApp
Em `js/config.js`, altere `whatsapp` (somente dígitos, com 55 + DDD): `"5511999999999"`.
O mesmo número é usado no botão flutuante do WhatsApp e no rodapé; a mensagem inicial desses
botões fica em `mensagemContato`. O texto de apresentação do rodapé fica em `rodape.slogan`.

### Adicionar / editar / remover produto
Em `js/produtos.js`, copie um bloco `{ ... }` e altere os campos. O `id` deve ser único.
Preço usa ponto: `45.9` = R$ 45,90.

### Marcar produto como indisponível
Troque `disponivel: true` por `disponivel: false`. Ele continua no cardápio com o selo
"Indisponível no momento" e não pode ser adicionado ao pedido.

### Trocar as fotos pelas fotos oficiais
As imagens atuais são **ilustrações provisórias**. Quando o cliente enviar as fotos:

1. Redimensione para **800 × 600 px** (proporção 4:3) e salve em **.webp** ou **.jpg** (ideal: até ~150 KB).
   Ferramenta gratuita: https://squoosh.app
2. Coloque os arquivos em `img/produtos/` (nomes sem espaços/acentos, ex.: `bolo-cenoura.webp`).
3. Em `js/produtos.js`, atualize o campo `foto` do produto: `foto: "img/produtos/bolo-cenoura.webp"`.
4. Apague os `.svg` provisórios que não forem mais usados.

O logo oficial está em `img/utils/logo.png`; o site usa a versão recortada `img/utils/logo-horizontal.png`.

### Categorias
Em `js/config.js` → `categorias`. O `id` da categoria deve ser igual ao campo `categoria` dos produtos.

### Cores
No topo de `css/style.css`, bloco `:root`.

### SEO (Google e compartilhamento)
- Título e descrição da página ficam no `<head>` do `index.html`.
- Os dados da loja para o Google (endereço, horário, cardápio com preços) são gerados
  automaticamente a partir de `js/config.js` e `js/produtos.js`. Preencha `seo.cidade`,
  `seo.estado`, `seo.cep` e `seo.horarios` em `js/config.js`.
- Domínio configurado: `https://belmirobolos.com.br/` (tags `canonical`/`og:` no `index.html`,
  `robots.txt` e `sitemap.xml`). A imagem de compartilhamento é `img/compartilhar.jpg` (1200 × 630 px).
- Cadastre a loja no **Google Meu Negócio** (Perfil da Empresa) com o link do site — é o que mais
  traz clientes da região.

## Testar localmente
Basta abrir o `index.html` no navegador. (Opcional: `npx serve .` para simular um servidor.)

## Publicar
Qualquer hospedagem estática serve: Netlify, Cloudflare Pages, GitHub Pages, Vercel ou hospedagem
comum (enviar todos os arquivos por FTP). Use HTTPS. O arquivo `_headers` é aplicado automaticamente
no Netlify e no Cloudflare Pages.

## Segurança (resumo)
- Sem back-end, sem login e sem banco de dados: não há dados de clientes armazenados no servidor.
- Content-Security-Policy bloqueia scripts externos/injetados.
- Todo texto é inserido com `textContent` (sem `innerHTML`), evitando XSS.
- O carrinho salvo no navegador é revalidado contra o catálogo e os preços sempre vêm de `js/produtos.js`.
- Os dados do formulário só saem do aparelho quando o cliente envia a mensagem no WhatsApp.
- O pedido **não** é confirmado pelo site: a confirmação é feita pelo atendente no WhatsApp.
