# Belmiro Bolos — Cardápio Digital

Site estático (HTML + CSS + JavaScript puro, sem dependências) que funciona como cardápio digital
e envia o pedido já preenchido para o WhatsApp da loja.

## Estrutura

```
index.html          Estrutura da página (não precisa editar no dia a dia)
css/style.css       Visual; cores da marca nas variáveis no topo do arquivo
data/produtos.json  ► Bolos (nome, preço, foto, disponível...)       ┐
data/categorias.json► Categorias, na ordem dos botões do site         ├ editados pelo painel /admin
data/loja.json      ► WhatsApp, rodapé, horários, dados para o Google ┘
admin/              Painel do cardápio (HTML + CSS + JS puro)
js/app.js           Lógica (busca, carrinho, formulário, WhatsApp)
img/utils/logo.png  Logo oficial (logo-horizontal.png = versão recortada usada no site)
img/logo.svg        Ícone da aba do navegador (provisório)
img/produtos/       Fotos dos produtos (provisórias)
_headers            Cabeçalhos de segurança (Netlify / Cloudflare Pages)
```

## Tarefas comuns

### Painel /admin (bolos, categorias e dados da loja)
Acesse **`<site>/admin/`** (funciona no celular). Tudo é editado lá:

- **Bolos:** criar, editar, duplicar, excluir, ligar/desligar "disponível" com um toque e
  **arrastar pela alça ⠿** para mudar a ordem (a ordem do painel é a ordem do cardápio).
  Bolo indisponível continua no cardápio com o selo "Indisponível no momento".
- **Tamanhos:** no editor do bolo, "+ Adicionar tamanho" (ex.: Pequena R$ 39 / Grande R$ 59). Com
  tamanhos, o card mostra "a partir de", o cliente escolhe o tamanho ao adicionar e o tamanho vai no
  carrinho e na mensagem do WhatsApp. Sem tamanhos, vale o preço único.
- **Selos:** "Sem glúten" / "Sem lactose" usam o campo "Selo de destaque". Itens sem glúten levam o
  aviso de contaminação cruzada nos detalhes.
- **Fotos:** no editor do bolo, "Escolher/Trocar foto" (galeria ou câmera). O painel recorta em 4:3
  (arraste a foto para ajustar o enquadramento), reduz para 800 × 600 e converte para .webp.
  Fotos que deixam de ser usadas são apagadas do repositório ao publicar.
- **Categorias:** criar, renomear, arrastar para ordenar e excluir (só se não tiver bolos).
- **Loja:** WhatsApp, mensagem de contato, telefone, rodapé, horários, redes sociais e dados do Google.

As mudanças ficam no painel até clicar em **Publicar**, que grava tudo (JSONs + fotos) em **um único
commit** no `main`; o GitHub Pages republica o site em ~1 minuto. "Descartar" volta para a versão
publicada. Se outro aparelho publicou no meio-tempo, o painel avisa em vez de sobrescrever.

**Login:** cole um token do GitHub (uma vez por aparelho; "Sair" apaga o token do aparelho).
Para criar: https://github.com/settings/personal-access-tokens/new → *Repository access*: só
`belmiro-bolos` → *Permissions*: **Contents: Read and write**. Perdeu o celular? Revogue o token no GitHub.

O repositório e o branch usados pelo painel ficam no topo de `admin/admin.js` (`REPO`, `BRANCH`).
Sem o painel, dá para editar os arquivos de `data/` direto (preço com ponto: `45.9` = R$ 45,90;
o `id` do bolo deve ser único e o `categoria` deve existir em `categorias.json`).

### Fotos
Bolo sem foto aparece com a imagem neutra "Foto em breve" (`img/sem-foto.svg`). Para pôr a foto,
use o painel. Fotos em HEIF/HEIC (iPhone) só abrem no painel pelo próprio iPhone; no PC, converta
antes para JPG/WEBP.

O logo oficial está em `img/utils/logo.png`; o site usa a versão recortada `img/utils/logo-horizontal.png`.

### Cores
No topo de `css/style.css`, bloco `:root`.

### SEO (Google e compartilhamento)
- Título e descrição da página ficam no `<head>` do `index.html`.
- Os dados da loja para o Google (endereço, horário, cardápio com preços) são gerados
  automaticamente a partir de `data/loja.json` e `data/produtos.json`. Preencha a seção
  "Google (SEO local)" na aba **Loja** do painel.
- Domínio configurado: `https://belmirobolos.com.br/` (tags `canonical`/`og:` no `index.html`,
  `robots.txt` e `sitemap.xml`). A imagem de compartilhamento é `img/compartilhar.jpg` (1200 × 630 px).
- Cadastre a loja no **Google Meu Negócio** (Perfil da Empresa) com o link do site — é o que mais
  traz clientes da região.

## Testar localmente
Rode um servidor local, por exemplo `npx serve .`, e abra o endereço indicado. Abrir o `index.html`
direto (file://) não funciona, porque o navegador bloqueia a leitura de `data/produtos.json`.

## Publicar
Qualquer hospedagem estática serve: Netlify, Cloudflare Pages, GitHub Pages, Vercel ou hospedagem
comum (enviar todos os arquivos por FTP). Use HTTPS. O arquivo `_headers` é aplicado automaticamente
no Netlify e no Cloudflare Pages (a regra de `/admin/*` usa a sintaxe do Cloudflare; no GitHub Pages valem as CSPs dos
`<meta>`). O painel precisa que o site seja publicado a partir do repositório no GitHub (GitHub Pages,
Cloudflare Pages ou Netlify ligados ao repo); no FTP as alterações do painel não chegam ao site.

**Ao alterar CSS ou JS**, troque o número em `?v=` nas tags `<link>`/`<script>` do `index.html`
(e do `admin/index.html`, se mexer no painel). Sem isso, quem já visitou o site pode ficar até
10 minutos com o código antigo em cache, misturado com os dados novos.

## Segurança (resumo)
- Sem back-end e sem banco de dados: não há dados de clientes armazenados no servidor.
- O painel `/admin` é só uma página estática: quem não tem um token com escrita no repositório não
  consegue alterar nada (o GitHub recusa). O painel não carrega scripts de terceiros e só se conecta
  à API do GitHub (CSP), o que protege o token salvo no aparelho.
- Content-Security-Policy bloqueia scripts externos/injetados.
- Todo texto é inserido com `textContent` (sem `innerHTML`), evitando XSS.
- O carrinho salvo no navegador é revalidado contra o catálogo e os preços sempre vêm de `data/produtos.json`.
- Os dados do formulário só saem do aparelho quando o cliente envia a mensagem no WhatsApp.
- O pedido **não** é confirmado pelo site: a confirmação é feita pelo atendente no WhatsApp.
