# Belmiro Bolos — Cardápio Digital

Site estático (HTML + CSS + JavaScript puro, sem dependências) que funciona como cardápio digital
e envia o pedido já preenchido para o WhatsApp da loja.

## Estrutura

```
index.html          Estrutura da página (não precisa editar no dia a dia)
css/style.css       Visual; cores da marca nas variáveis no topo do arquivo
js/config.js        ► Número do WhatsApp, categorias, rodapé
data/produtos.json  ► Lista de produtos (editada pelo painel /admin)
admin/              Painel de produtos (Sveltia CMS): index.html + config.yml
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

### Produtos: painel /admin
Acesse **`<site>/admin`** (funciona no celular), clique em **Cardápio → Bolos**, edite e clique em
**Salvar/Publicar**. Cada publicação vira um commit no GitHub e o site é republicado em ~1 minuto.

- **Novo bolo:** botão "Adicionar Bolo". O `id` deve ser único (minúsculas, sem acento, com hífen).
- **Indisponível:** desligue "Disponível". Ele continua no cardápio com o selo
  "Indisponível no momento" e não pode ser adicionado ao pedido.
- **Fotos:** anexe qualquer foto no campo "Foto". O painel converte para .webp, reduz para no máximo
  1200 px e salva em `img/produtos/`. No site a foto aparece cortada em 4:3.
- **Ordem:** arraste os itens da lista.

**Login (uma vez por navegador/celular):** em "Entrar Usando Token de Acesso", cole um token do GitHub
(*Settings → Developer settings → Fine-grained tokens*, repositório `belmiro-bolos`, permissão
**Contents: Read and write**). O token fica salvo só naquele navegador. Ao vencer, gere outro.
Perdeu o celular? Revogue o token no GitHub.

Sem o painel, dá para editar `data/produtos.json` direto (preço com ponto: `45.9` = R$ 45,90).
Ao criar ou remover **categorias** em `js/config.js`, atualize também a lista `options` do campo
"categoria" em `admin/config.yml`.

### Trocar as fotos pelas fotos oficiais
As imagens atuais são **ilustrações provisórias**. Quando o cliente enviar as fotos:

1. No painel `/admin`, abra o bolo e troque a imagem no campo "Foto" (a conversão é automática).
2. Apague os `.svg` provisórios que não forem mais usados (pela "Biblioteca de mídia" do painel ou no Git).

O logo oficial está em `img/utils/logo.png`; o site usa a versão recortada `img/utils/logo-horizontal.png`.

### Categorias
Em `js/config.js` → `categorias`. O `id` da categoria deve ser igual ao campo `categoria` dos produtos.

### Cores
No topo de `css/style.css`, bloco `:root`.

### SEO (Google e compartilhamento)
- Título e descrição da página ficam no `<head>` do `index.html`.
- Os dados da loja para o Google (endereço, horário, cardápio com preços) são gerados
  automaticamente a partir de `js/config.js` e `data/produtos.json`. Preencha `seo.cidade`,
  `seo.estado`, `seo.cep` e `seo.horarios` em `js/config.js`.
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
no Netlify e no Cloudflare Pages (a regra de `/admin/*` usa a sintaxe do Cloudflare). O painel `/admin`
precisa que o site seja publicado a partir do repositório no GitHub (GitHub Pages, Cloudflare Pages ou
Netlify ligados ao repo); no FTP as alterações do painel não chegam ao site.

## Segurança (resumo)
- Sem back-end e sem banco de dados: não há dados de clientes armazenados no servidor.
- O painel `/admin` é só uma página estática: quem não tem um token com escrita no repositório não
  consegue alterar nada.
- Content-Security-Policy bloqueia scripts externos/injetados.
- Todo texto é inserido com `textContent` (sem `innerHTML`), evitando XSS.
- O carrinho salvo no navegador é revalidado contra o catálogo e os preços sempre vêm de `data/produtos.json`.
- Os dados do formulário só saem do aparelho quando o cliente envia a mensagem no WhatsApp.
- O pedido **não** é confirmado pelo site: a confirmação é feita pelo atendente no WhatsApp.
