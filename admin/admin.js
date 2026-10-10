/**
 * BELMIRO BOLOS — painel do cardápio.
 *
 * Página estática: lê e grava data/*.json e img/produtos/ direto no repositório
 * do GitHub, usando o token de quem está logado. Não existe back-end próprio.
 * "Publicar" junta todas as alterações (JSON + fotos) em um único commit no
 * branch publicado; o GitHub Pages republica o site em ~1 minuto.
 *
 * Segurança: sem token com escrita no repositório, nada é gravado (o GitHub
 * recusa). Todo texto é inserido com textContent/value (nunca innerHTML).
 */
(function () {
  "use strict";

  const REPO = "renanberton/belmiro-bolos";
  const BRANCH = "main";
  const API = "https://api.github.com";
  const ARQUIVOS = {
    produtos: "data/produtos.json",
    categorias: "data/categorias.json",
    loja: "data/loja.json",
  };
  const PASTA_FOTOS = "img/produtos/";
  const FOTO = { largura: 800, altura: 600, qualidade: 0.82 };
  const CHAVE_TOKEN = "belmiro-bolos:painel:token";

  // ---------- Utilidades ----------
  const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
  const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];
  const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const moeda = (valor) => formatoMoeda.format(valor);
  const precoTexto = (valor) => (Number.isFinite(valor) ? valor.toFixed(2).replace(".", ",") : "");
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const clonar = (valor) => JSON.parse(JSON.stringify(valor));
  const paraJson = (valor) => JSON.stringify(valor, null, 2) + "\n";

  // "35,90" / "35.90" / "1.035,90" -> 35.9
  function lerPreco(texto) {
    let t = String(texto).trim().replace(/[R$\s]/g, "");
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    const valor = Number(t);
    return t !== "" && Number.isFinite(valor) && valor >= 0 ? Math.round(valor * 100) / 100 : NaN;
  }

  function gerarId(texto, existentes) {
    const base = String(texto)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      .slice(0, 40) || "item";
    let id = base;
    for (let n = 2; existentes.has(id); n++) id = `${base}-${n}`;
    return id;
  }

  const utf8DeBase64 = (b64) =>
    new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

  const base64DeBlob = (blob) => new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(",")[1]);
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });

  const armazenamentoToken = {
    ler() {
      try { return localStorage.getItem(CHAVE_TOKEN) || sessionStorage.getItem(CHAVE_TOKEN) || ""; }
      catch { return ""; }
    },
    gravar(token, lembrar) {
      try { (lembrar ? localStorage : sessionStorage).setItem(CHAVE_TOKEN, token); } catch { /* bloqueado */ }
    },
    apagar() {
      try { localStorage.removeItem(CHAVE_TOKEN); sessionStorage.removeItem(CHAVE_TOKEN); } catch { /* bloqueado */ }
    },
  };

  // ---------- Estado ----------
  const estado = {
    token: "",
    base: null,               // { commit, shas: { produtos, categorias, loja } } do que foi carregado
    produtos: [],
    categorias: [],
    loja: {},
    original: { produtos: "", categorias: "", loja: "" }, // JSON publicado, para saber o que mudou
    fotosOriginais: new Set(), // fotos usadas na versão publicada
    fotosNovas: new Map(),     // caminho -> Blob (ainda não publicadas)
    previas: new Map(),        // caminho -> URL blob: para exibir fotos novas
    aba: "bolos",
    busca: "",
    filtroCategoria: "",
    ocupado: false,
  };

  // ---------- GitHub ----------
  async function gh(caminho, { metodo = "GET", corpo } = {}) {
    let resposta;
    try {
      resposta = await fetch(`${API}${caminho}`, {
        method: metodo,
        cache: "no-store",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${estado.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(corpo ? { "Content-Type": "application/json" } : {}),
        },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
    } catch {
      throw Object.assign(new Error("Sem conexão com o GitHub. Verifique a internet."), { status: 0 });
    }
    if (!resposta.ok) {
      let mensagem = "";
      try { mensagem = (await resposta.json()).message || ""; } catch { /* sem corpo */ }
      throw Object.assign(new Error(mensagem || `Erro ${resposta.status}`), { status: resposta.status });
    }
    return resposta.status === 204 ? null : resposta.json();
  }

  const repo = (caminho) => `/repos/${REPO}${caminho}`;

  async function lerArquivo(caminho, commit, padrao) {
    try {
      const dados = await gh(repo(`/contents/${caminho}?ref=${commit}`));
      return { sha: dados.sha, valor: JSON.parse(utf8DeBase64(dados.content)) };
    } catch (erro) {
      if (erro.status === 404) return { sha: null, valor: padrao };
      throw erro;
    }
  }

  async function commitAtual() {
    const ref = await gh(repo(`/git/ref/heads/${BRANCH}`));
    return ref.object.sha;
  }

  async function carregar() {
    const commit = await commitAtual();
    const [produtos, categorias, loja] = await Promise.all([
      lerArquivo(ARQUIVOS.produtos, commit, []),
      lerArquivo(ARQUIVOS.categorias, commit, []),
      lerArquivo(ARQUIVOS.loja, commit, {}),
    ]);
    estado.base = { commit, shas: { produtos: produtos.sha, categorias: categorias.sha, loja: loja.sha } };
    estado.produtos = Array.isArray(produtos.valor) ? produtos.valor : [];
    estado.categorias = Array.isArray(categorias.valor) ? categorias.valor : [];
    estado.loja = loja.valor && typeof loja.valor === "object" ? loja.valor : {};
    marcarComoPublicado();
  }

  function marcarComoPublicado() {
    estado.original = {
      produtos: paraJson(estado.produtos),
      categorias: paraJson(estado.categorias),
      loja: paraJson(estado.loja),
    };
    estado.fotosOriginais = fotosEmUso();
    estado.fotosNovas.clear(); // as prévias continuam valendo até o site republicar
  }

  function fotosEmUso() {
    return new Set(estado.produtos.map((p) => p.foto).filter((f) => typeof f === "string" && f.startsWith(PASTA_FOTOS)));
  }

  function arquivosAlterados() {
    return Object.keys(ARQUIVOS).filter((chave) => paraJson(estado[chave]) !== estado.original[chave]);
  }

  const temAlteracoes = () => arquivosAlterados().length > 0;

  async function publicar() {
    if (estado.ocupado || !temAlteracoes()) return;
    definirOcupado(true, "Publicando…");
    try {
      const pai = await commitAtual();

      // Alguém publicou nesse meio-tempo (outro aparelho)? Só segue se não mexeu nos mesmos dados.
      if (pai !== estado.base.commit) {
        const atuais = await Promise.all(Object.entries(ARQUIVOS).map(async ([chave, caminho]) =>
          [chave, (await lerArquivo(caminho, pai, null)).sha]));
        const conflito = atuais.some(([chave, sha]) => sha !== estado.base.shas[chave]);
        if (conflito) {
          throw new Error("O cardápio foi alterado em outro aparelho depois que você abriu o painel. " +
            "Clique em \"Descartar\" para carregar a versão mais nova e refaça as mudanças.");
        }
      }

      const commitPai = await gh(repo(`/git/commits/${pai}`));
      const emUso = fotosEmUso();
      const arvore = [];

      for (const [caminho, blob] of estado.fotosNovas) {
        if (!emUso.has(caminho)) continue; // foto trocada de novo antes de publicar
        const novoBlob = await gh(repo("/git/blobs"), {
          metodo: "POST",
          corpo: { content: await base64DeBlob(blob), encoding: "base64" },
        });
        arvore.push({ path: caminho, mode: "100644", type: "blob", sha: novoBlob.sha });
      }

      // Fotos que deixaram de ser usadas são apagadas (só as que existem no repositório)
      const removidas = [...estado.fotosOriginais].filter((f) => !emUso.has(f));
      if (removidas.length) {
        const pasta = await gh(repo(`/contents/${PASTA_FOTOS.replace(/\/$/, "")}?ref=${pai}`)).catch(() => []);
        const existentes = new Set((Array.isArray(pasta) ? pasta : []).map((a) => a.path));
        for (const caminho of removidas) {
          if (existentes.has(caminho)) arvore.push({ path: caminho, mode: "100644", type: "blob", sha: null });
        }
      }

      const alterados = arquivosAlterados();
      for (const chave of alterados) {
        arvore.push({ path: ARQUIVOS[chave], mode: "100644", type: "blob", content: paraJson(estado[chave]) });
      }

      const novaArvore = await gh(repo("/git/trees"), {
        metodo: "POST",
        corpo: { base_tree: commitPai.tree.sha, tree: arvore },
      });
      const novoCommit = await gh(repo("/git/commits"), {
        metodo: "POST",
        corpo: { message: mensagemCommit(alterados, arvore), tree: novaArvore.sha, parents: [pai] },
      });
      await gh(repo(`/git/refs/heads/${BRANCH}`), { metodo: "PATCH", corpo: { sha: novoCommit.sha } });

      await carregar();
      renderizarTudo();
      mostrarToast("Publicado! O site atualiza em cerca de 1 minuto.");
    } catch (erro) {
      tratarErro(erro, "Não foi possível publicar");
    } finally {
      definirOcupado(false);
    }
  }

  function mensagemCommit(alterados, arvore) {
    const nomes = { produtos: "bolos", categorias: "categorias", loja: "dados da loja" };
    const partes = alterados.map((c) => nomes[c]);
    const fotos = arvore.filter((a) => a.path.startsWith(PASTA_FOTOS));
    if (fotos.length) partes.push(plural(fotos.length, "foto", "fotos"));
    return `Painel: atualiza ${partes.join(", ")}`;
  }

  // ---------- Elementos ----------
  const el = {
    telaLogin: $("#telaLogin"),
    telaApp: $("#telaApp"),
    formLogin: $("#formLogin"),
    campoToken: $("#campoToken"),
    campoLembrar: $("#campoLembrar"),
    erroLogin: $("#erroLogin"),
    btnEntrar: $("#btnEntrar"),
    status: $("#status"),
    btnPublicar: $("#btnPublicar"),
    btnDescartar: $("#btnDescartar"),
    btnSair: $("#btnSair"),
    campoBusca: $("#campoBusca"),
    filtroCategoria: $("#filtroCategoria"),
    listaBolos: $("#listaBolos"),
    semBolos: $("#semBolos"),
    avisoOrdem: $("#avisoOrdem"),
    dicaOrdem: $("#dicaOrdem"),
    listaCategorias: $("#listaCategorias"),
    semCategorias: $("#semCategorias"),
    formCategoria: $("#formCategoria"),
    campoNovaCategoria: $("#campoNovaCategoria"),
    formLoja: $("#formLoja"),
    dialogo: $("#dialogoBolo"),
    formBolo: $("#formBolo"),
    toast: $("#toast"),
  };

  // ---------- Status / toast ----------
  function atualizarStatus() {
    if (estado.ocupado) return;
    const pendente = temAlteracoes();
    el.status.className = `status${pendente ? " status--pendente" : ""}`;
    el.status.textContent = pendente ? "Alterações não publicadas" : "Tudo publicado";
    el.btnPublicar.disabled = !pendente;
    el.btnDescartar.hidden = !pendente;
  }

  function definirOcupado(ocupado, texto) {
    estado.ocupado = ocupado;
    el.btnPublicar.disabled = ocupado;
    el.btnDescartar.disabled = ocupado;
    if (ocupado) {
      el.status.className = "status status--ocupado";
      el.status.textContent = texto;
    } else {
      atualizarStatus();
    }
  }

  let timerToast;
  function mostrarToast(texto, erro = false) {
    el.toast.textContent = texto;
    el.toast.classList.toggle("toast--erro", erro);
    el.toast.hidden = false;
    clearTimeout(timerToast);
    timerToast = setTimeout(() => { el.toast.hidden = true; }, erro ? 7000 : 3500);
  }

  function tratarErro(erro, contexto) {
    console.error(`[Painel] ${contexto}:`, erro);
    if (erro.status === 401) {
      sair("Token inválido ou expirado. Gere outro no GitHub e entre de novo.");
      return;
    }
    const mensagem = erro.status === 403 || erro.status === 404
      ? "O token não tem permissão de escrita neste repositório (Contents: Read and write)."
      : erro.message;
    mostrarToast(`${contexto}: ${mensagem}`, true);
  }

  // Qualquer mudança passa por aqui
  function alterou() {
    atualizarStatus();
  }

  // ---------- Imagens ----------
  function srcFoto(caminho) {
    if (!caminho) return "";
    if (estado.previas.has(caminho)) return estado.previas.get(caminho);
    if (/^https:\/\//i.test(caminho)) return caminho;
    return `../${caminho.replace(/^\//, "")}`;
  }

  // Foto recém-publicada ainda não está no site (deploy leva ~1 min): busca direto do repositório
  function exibirFoto(img, caminho) {
    img.onerror = null;
    const src = srcFoto(caminho);
    if (!src) { img.src = "../img/sem-foto.svg"; return; }
    if (!src.startsWith("blob:") && !/^https:/i.test(src)) {
      img.onerror = () => {
        img.onerror = null;
        img.src = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${caminho.replace(/^\//, "")}`;
      };
    }
    img.src = src;
  }

  async function processarFoto(arquivo, foco) {
    const url = URL.createObjectURL(arquivo);
    try {
      const img = new Image();
      img.src = url;
      await img.decode(); // respeita a rotação EXIF das fotos do celular
      const { naturalWidth: w, naturalHeight: h } = img;
      const proporcao = FOTO.largura / FOTO.altura;
      let sw = w, sh = h, sx = 0, sy = 0;
      if (w / h > proporcao) { sw = h * proporcao; sx = (w - sw) * foco.x / 100; }
      else { sh = w / proporcao; sy = (h - sh) * foco.y / 100; }

      const canvas = document.createElement("canvas");
      canvas.width = FOTO.largura;
      canvas.height = FOTO.altura;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, FOTO.largura, FOTO.altura);

      const gerar = (tipo) => new Promise((resolve) => canvas.toBlob(resolve, tipo, FOTO.qualidade));
      let blob = await gerar("image/webp");
      if (!blob || blob.type !== "image/webp") blob = await gerar("image/jpeg"); // Safari não gera webp
      if (!blob) throw new Error("Não foi possível processar a imagem.");
      return blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ---------- Ordenação (arrastar pela alça; setas do teclado também) ----------
  function tornarOrdenavel(lista, obterItens) {
    lista.addEventListener("pointerdown", (e) => {
      const alca = e.target.closest(".alca");
      if (!alca || alca.disabled || e.button > 0) return;
      e.preventDefault();
      const item = alca.closest("li");
      const inicio = [...lista.children].indexOf(item);
      alca.setPointerCapture(e.pointerId);
      item.classList.add("arrastando");

      const mover = (ev) => {
        if (ev.clientY < 80) window.scrollBy(0, -12);
        else if (ev.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
        let antes = null;
        for (const irmao of lista.children) {
          if (irmao === item) continue;
          const r = irmao.getBoundingClientRect();
          if (ev.clientY < r.top + r.height / 2) { antes = irmao; break; }
        }
        if (antes ? antes !== item.nextElementSibling : item !== lista.lastElementChild) {
          lista.insertBefore(item, antes);
        }
      };
      const soltar = () => {
        alca.removeEventListener("pointermove", mover);
        alca.removeEventListener("pointerup", soltar);
        alca.removeEventListener("pointercancel", soltar);
        item.classList.remove("arrastando");
        const fim = [...lista.children].indexOf(item);
        if (fim !== inicio) moverItem(obterItens(), inicio, fim);
      };
      alca.addEventListener("pointermove", mover);
      alca.addEventListener("pointerup", soltar);
      alca.addEventListener("pointercancel", soltar);
    });

    lista.addEventListener("keydown", (e) => {
      const alca = e.target.closest(".alca");
      if (!alca || alca.disabled || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault();
      const inicio = [...lista.children].indexOf(alca.closest("li"));
      const fim = inicio + (e.key === "ArrowUp" ? -1 : 1);
      if (fim < 0 || fim >= lista.children.length) return;
      moverItem(obterItens(), inicio, fim);
      $$(".alca", lista)[fim].focus();
    });
  }

  function moverItem(itens, de, para) {
    const [item] = itens.splice(de, 1);
    itens.splice(para, 0, item);
    renderizarTudo();
    alterou();
  }

  // ---------- Bolos ----------
  const nomeCategoria = (id) => (estado.categorias.find((c) => c.id === id) || {}).nome || "Sem categoria";

  function bolosVisiveis() {
    const termo = estado.busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    return estado.produtos.filter((p) =>
      (!estado.filtroCategoria || p.categoria === estado.filtroCategoria) &&
      (!termo || String(p.nome).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(termo)));
  }

  function renderizarBolos() {
    const filtrando = Boolean(estado.busca.trim() || estado.filtroCategoria);
    const visiveis = bolosVisiveis();
    const fragmento = document.createDocumentFragment();
    const modelo = $("#modeloBolo").content;

    for (const p of visiveis) {
      const li = modelo.firstElementChild.cloneNode(true);
      const indice = estado.produtos.indexOf(p);
      li.dataset.indice = indice;
      li.classList.toggle("item--indisponivel", !p.disponivel);
      $(".alca", li).disabled = filtrando;
      $(".alca", li).setAttribute("aria-label", `Mover ${p.nome} (use as setas)`);
      exibirFoto($(".item__foto", li), p.foto);
      $(".item__nome", li).textContent = p.nome;
      const meta = $(".item__meta", li);
      const preco = Array.isArray(p.tamanhos) && p.tamanhos.length
        ? `a partir de ${moeda(Math.min(...p.tamanhos.map((t) => t.preco)))}`
        : moeda(Number(p.preco) || 0);
      meta.textContent = `${nomeCategoria(p.categoria)} · ${preco}`;
      if (!p.disponivel) {
        const aviso = document.createElement("b");
        aviso.textContent = " · Indisponível";
        meta.appendChild(aviso);
      }
      const disponivel = $(".item__disponivel", li);
      disponivel.checked = Boolean(p.disponivel);
      disponivel.setAttribute("aria-label", `${p.nome} disponível`);
      fragmento.appendChild(li);
    }
    el.listaBolos.replaceChildren(fragmento);
    el.semBolos.hidden = visiveis.length > 0;
    el.avisoOrdem.hidden = !filtrando;
    el.dicaOrdem.hidden = filtrando || estado.produtos.length < 2;
  }

  function renderizarOpcoesCategoria() {
    const opcoes = (select, primeira) => {
      const atual = select.value;
      select.replaceChildren(...[primeira, ...estado.categorias.map((c) => [c.id, c.nome])]
        .filter(Boolean)
        .map(([valor, texto]) => new Option(texto, valor)));
      select.value = atual;
    };
    opcoes(el.filtroCategoria, ["", "Todas as categorias"]);
    if (![...el.filtroCategoria.options].some((o) => o.value === estado.filtroCategoria)) estado.filtroCategoria = "";
    el.filtroCategoria.value = estado.filtroCategoria;
    opcoes($("#boloCategoria"), null);
  }

  el.listaBolos.addEventListener("click", (e) => {
    if (e.target.closest(".item__info, .item__foto")) {
      abrirEditor(Number(e.target.closest("li").dataset.indice));
    }
  });
  el.listaBolos.addEventListener("change", (e) => {
    if (!e.target.matches(".item__disponivel")) return;
    const produto = estado.produtos[Number(e.target.closest("li").dataset.indice)];
    produto.disponivel = e.target.checked;
    renderizarBolos();
    alterou();
  });
  el.campoBusca.addEventListener("input", () => { estado.busca = el.campoBusca.value; renderizarBolos(); });
  el.filtroCategoria.addEventListener("change", () => { estado.filtroCategoria = el.filtroCategoria.value; renderizarBolos(); });
  $("#btnNovoBolo").addEventListener("click", () => abrirEditor(-1));
  tornarOrdenavel(el.listaBolos, () => estado.produtos);

  // ---------- Editor de bolo ----------
  const editor = {
    indice: -1,
    arquivo: null,    // foto nova escolhida (ainda não processada)
    previa: "",       // URL blob: da foto nova
    foco: { x: 50, y: 50 },
  };
  const campo = {
    nome: $("#boloNome"),
    preco: $("#boloPreco"),
    categoria: $("#boloCategoria"),
    disponivel: $("#boloDisponivel"),
    destaque: $("#boloDestaque"),
    descricao: $("#boloDescricao"),
    detalhes: $("#boloDetalhes"),
    foto: $("#campoFoto"),
  };
  const listaTamanhos = $("#listaTamanhos");

  // Com tamanhos, o preço único some: cada tamanho tem o seu
  function atualizarCampoPreco() {
    $("#campoPrecoUnico").hidden = listaTamanhos.children.length > 0;
  }

  function adicionarLinhaTamanho(tamanho) {
    const li = $("#modeloTamanho").content.firstElementChild.cloneNode(true);
    $(".tamanho__nome", li).value = tamanho ? tamanho.nome : "";
    $(".tamanho__preco", li).value = tamanho ? precoTexto(tamanho.preco) : "";
    listaTamanhos.appendChild(li);
    atualizarCampoPreco();
    return li;
  }

  $("#btnAddTamanho").addEventListener("click", () => {
    const nomes = ["Pequena", "Grande"];
    const li = adicionarLinhaTamanho(null);
    $(".tamanho__nome", li).placeholder = nomes[listaTamanhos.children.length - 1] || "Tamanho";
    $(".tamanho__nome", li).focus();
  });
  listaTamanhos.addEventListener("click", (e) => {
    const botao = e.target.closest(".tamanho__remover");
    if (!botao) return;
    botao.closest("li").remove();
    atualizarCampoPreco();
  });

  // Lê as linhas de tamanho; devolve { tamanhos } ou { erro }
  function lerTamanhos() {
    const tamanhos = [];
    for (const li of listaTamanhos.children) {
      const nome = $(".tamanho__nome", li).value.trim();
      const textoPreco = $(".tamanho__preco", li).value;
      if (!nome && !textoPreco.trim()) continue; // linha vazia é ignorada
      const preco = lerPreco(textoPreco);
      if (!nome || !Number.isFinite(preco)) return { erro: "preencha nome e preço de cada tamanho" };
      if (nome.includes("|")) return { erro: "o nome do tamanho não pode ter \"|\"" };
      if (tamanhos.some((t) => t.nome.toLowerCase() === nome.toLowerCase())) return { erro: `o tamanho "${nome}" está repetido` };
      tamanhos.push({ nome, preco });
    }
    return { tamanhos };
  }

  const moldura = $("#molduraFoto");
  const previaFoto = $("#previaFoto");

  function abrirEditor(indice) {
    if (!estado.categorias.length) {
      mostrarToast("Crie uma categoria antes de cadastrar bolos.", true);
      trocarAba("categorias");
      return;
    }
    const p = indice >= 0 ? estado.produtos[indice] : null;
    editor.indice = indice;
    limparFotoNova();

    $("#tituloDialogo").textContent = p ? "Editar bolo" : "Novo bolo";
    campo.nome.value = p ? p.nome : "";
    campo.preco.value = p ? precoTexto(Number(p.preco)) : "";
    campo.categoria.value = p ? p.categoria : (estado.filtroCategoria || estado.categorias[0].id);
    if (!campo.categoria.value) campo.categoria.selectedIndex = 0;
    campo.disponivel.checked = p ? Boolean(p.disponivel) : true;
    campo.destaque.value = p ? p.destaque || "" : "";
    campo.descricao.value = p ? p.descricao || "" : "";
    campo.detalhes.value = p ? p.detalhes || "" : "";
    $("#boloId").textContent = p ? `ID: ${p.id}` : "";
    $("#btnExcluirBolo").hidden = !p;
    $("#btnDuplicarBolo").hidden = !p;
    $("#erroBolo").hidden = true;
    listaTamanhos.replaceChildren();
    for (const t of (p && Array.isArray(p.tamanhos) ? p.tamanhos : [])) adicionarLinhaTamanho(t);
    atualizarCampoPreco();
    mostrarFotoEditor(p ? p.foto : "");

    el.dialogo.showModal();
    if (!p) campo.nome.focus();
  }

  function mostrarFotoEditor(caminho) {
    const temFoto = Boolean(editor.previa || caminho);
    if (editor.previa) {
      previaFoto.onerror = null;
      previaFoto.src = editor.previa;
    } else {
      exibirFoto(previaFoto, caminho);
    }
    previaFoto.hidden = !temFoto;
    $("#semFoto").hidden = temFoto;
    previaFoto.style.objectPosition = `${editor.foco.x}% ${editor.foco.y}%`;
    moldura.classList.toggle("foto-editor__moldura--ajustavel", Boolean(editor.previa));
    $("#dicaEnquadrar").hidden = !editor.previa;
    $("#rotuloFoto").textContent = temFoto ? "Trocar foto" : "Escolher foto";
  }

  function limparFotoNova() {
    if (editor.previa) URL.revokeObjectURL(editor.previa);
    editor.arquivo = null;
    editor.previa = "";
    editor.foco = { x: 50, y: 50 };
    campo.foto.value = "";
  }

  campo.foto.addEventListener("change", () => {
    const arquivo = campo.foto.files[0];
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
      $("#erroBolo").textContent = "Escolha um arquivo de imagem.";
      $("#erroBolo").hidden = false;
      return;
    }
    limparFotoNova();
    editor.arquivo = arquivo;
    editor.previa = URL.createObjectURL(arquivo);
    mostrarFotoEditor("");
  });

  // Arrastar a foto nova dentro da moldura 4:3 muda o enquadramento
  moldura.addEventListener("pointerdown", (e) => {
    if (!editor.previa) return;
    e.preventDefault();
    moldura.setPointerCapture(e.pointerId);
    const inicio = { x: e.clientX, y: e.clientY, foco: { ...editor.foco } };
    const r = moldura.getBoundingClientRect();
    const limitar = (v) => Math.min(100, Math.max(0, v));
    const mover = (ev) => {
      editor.foco.x = limitar(inicio.foco.x - (ev.clientX - inicio.x) / r.width * 150);
      editor.foco.y = limitar(inicio.foco.y - (ev.clientY - inicio.y) / r.height * 150);
      previaFoto.style.objectPosition = `${editor.foco.x}% ${editor.foco.y}%`;
    };
    const soltar = () => {
      moldura.removeEventListener("pointermove", mover);
      moldura.removeEventListener("pointerup", soltar);
      moldura.removeEventListener("pointercancel", soltar);
    };
    moldura.addEventListener("pointermove", mover);
    moldura.addEventListener("pointerup", soltar);
    moldura.addEventListener("pointercancel", soltar);
  });

  el.formBolo.addEventListener("submit", async (e) => {
    e.preventDefault();
    const erro = $("#erroBolo");
    const nome = campo.nome.value.trim();
    const { tamanhos, erro: erroTamanhos } = lerTamanhos();
    const usaTamanhos = Boolean(tamanhos && tamanhos.length);
    // com tamanhos, "preco" guarda o menor deles (usado em "a partir de")
    const preco = usaTamanhos ? Math.min(...tamanhos.map((t) => t.preco)) : lerPreco(campo.preco.value);
    const problemas = [];
    if (!nome) problemas.push("informe o nome");
    if (erroTamanhos) problemas.push(erroTamanhos);
    else if (!Number.isFinite(preco)) problemas.push("informe um preço válido (ex.: 35,90)");
    if (!campo.categoria.value) problemas.push("escolha a categoria");
    if (problemas.length) {
      erro.textContent = `Para salvar, ${problemas.join(" e ")}.`;
      erro.hidden = false;
      return;
    }

    const existente = editor.indice >= 0 ? estado.produtos[editor.indice] : null;
    const id = existente ? existente.id : gerarId(nome, new Set(estado.produtos.map((p) => p.id)));
    let foto = existente ? existente.foto : "";

    if (editor.arquivo) {
      const botao = $("#btnSalvarBolo");
      botao.disabled = true;
      try {
        const blob = await processarFoto(editor.arquivo, editor.foco);
        const extensao = blob.type === "image/webp" ? "webp" : "jpg";
        foto = `${PASTA_FOTOS}${id}-${Date.now().toString(36)}.${extensao}`;
        estado.fotosNovas.set(foto, blob);
        estado.previas.set(foto, URL.createObjectURL(blob));
      } catch (falha) {
        erro.textContent = `Não foi possível usar essa foto: ${falha.message}`;
        erro.hidden = false;
        return;
      } finally {
        botao.disabled = false;
      }
    }

    const dados = {
      id,
      nome,
      descricao: campo.descricao.value.trim(),
      detalhes: campo.detalhes.value.trim(),
      preco,
      categoria: campo.categoria.value,
      foto,
      disponivel: campo.disponivel.checked,
      destaque: campo.destaque.value.trim(),
    };
    if (usaTamanhos) dados.tamanhos = tamanhos;
    if (existente) {
      Object.assign(existente, dados);
      if (!usaTamanhos) delete existente.tamanhos;
    } else {
      estado.produtos.push(dados);
    }

    limparFotoNova();
    el.dialogo.close();
    renderizarBolos();
    alterou();
    mostrarToast(existente ? "Bolo atualizado. Lembre de publicar." : "Bolo adicionado. Lembre de publicar.");
  });

  $("#btnExcluirBolo").addEventListener("click", () => {
    const p = estado.produtos[editor.indice];
    if (!p || !confirm(`Excluir "${p.nome}" do cardápio?`)) return;
    estado.produtos.splice(editor.indice, 1);
    el.dialogo.close();
    renderizarBolos();
    alterou();
    mostrarToast("Bolo excluído. Lembre de publicar.");
  });

  $("#btnDuplicarBolo").addEventListener("click", () => {
    const p = estado.produtos[editor.indice];
    if (!p) return;
    const copia = {
      ...clonar(p),
      nome: `${p.nome} (cópia)`,
      id: gerarId(`${p.id}-copia`, new Set(estado.produtos.map((x) => x.id))),
    };
    estado.produtos.splice(editor.indice + 1, 0, copia);
    el.dialogo.close();
    renderizarBolos();
    alterou();
    abrirEditor(editor.indice + 1);
  });

  el.dialogo.addEventListener("click", (e) => {
    if (e.target.closest("[data-fechar]") || e.target === el.dialogo) el.dialogo.close();
  });
  el.dialogo.addEventListener("close", limparFotoNova);

  // ---------- Categorias ----------
  function renderizarCategorias() {
    const modelo = $("#modeloCategoria").content;
    const fragmento = document.createDocumentFragment();
    estado.categorias.forEach((c, indice) => {
      const li = modelo.firstElementChild.cloneNode(true);
      const usados = estado.produtos.filter((p) => p.categoria === c.id).length;
      li.dataset.indice = indice;
      $(".alca", li).setAttribute("aria-label", `Mover ${c.nome} (use as setas)`);
      $(".item__campo", li).value = c.nome;
      $(".item__contagem", li).textContent = plural(usados, "bolo", "bolos");
      const excluir = $(".item__excluir", li);
      excluir.disabled = usados > 0;
      excluir.title = usados > 0 ? "Mova ou exclua os bolos desta categoria antes" : `Excluir ${c.nome}`;
      fragmento.appendChild(li);
    });
    el.listaCategorias.replaceChildren(fragmento);
    el.semCategorias.hidden = estado.categorias.length > 0;
    renderizarOpcoesCategoria();
  }

  el.formCategoria.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = el.campoNovaCategoria.value.trim();
    if (!nome) return;
    if (estado.categorias.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) {
      mostrarToast("Já existe uma categoria com esse nome.", true);
      return;
    }
    // "todos" é reservado: é o botão que mostra tudo no site
    const ids = new Set(["todos", ...estado.categorias.map((c) => c.id)]);
    estado.categorias.push({ id: gerarId(nome, ids), nome });
    el.campoNovaCategoria.value = "";
    renderizarCategorias();
    alterou();
  });

  el.listaCategorias.addEventListener("input", (e) => {
    if (!e.target.matches(".item__campo")) return;
    estado.categorias[Number(e.target.closest("li").dataset.indice)].nome = e.target.value;
    alterou();
  });
  el.listaCategorias.addEventListener("change", (e) => {
    if (!e.target.matches(".item__campo")) return;
    const categoria = estado.categorias[Number(e.target.closest("li").dataset.indice)];
    categoria.nome = e.target.value.trim() || categoria.id;
    renderizarTudo();
    alterou();
  });
  el.listaCategorias.addEventListener("click", (e) => {
    const botao = e.target.closest(".item__excluir");
    if (!botao || botao.disabled) return;
    const indice = Number(botao.closest("li").dataset.indice);
    if (!confirm(`Excluir a categoria "${estado.categorias[indice].nome}"?`)) return;
    estado.categorias.splice(indice, 1);
    renderizarCategorias();
    alterou();
  });
  tornarOrdenavel(el.listaCategorias, () => estado.categorias);

  // ---------- Loja ----------
  const lerCaminho = (obj, caminho) => caminho.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  function gravarCaminho(obj, caminho, valor) {
    const chaves = caminho.split(".");
    const ultima = chaves.pop();
    let alvo = obj;
    for (const k of chaves) {
      if (!alvo[k] || typeof alvo[k] !== "object") alvo[k] = {};
      alvo = alvo[k];
    }
    alvo[ultima] = valor;
  }

  function renderizarLoja() {
    for (const entrada of $$("[data-campo]", el.formLoja)) {
      const valor = lerCaminho(estado.loja, entrada.dataset.campo);
      entrada.value = entrada.dataset.tipo === "linhas"
        ? (Array.isArray(valor) ? valor.join("\n") : valor || "")
        : valor ?? "";
    }
  }

  el.formLoja.addEventListener("input", (e) => {
    const entrada = e.target.closest("[data-campo]");
    if (!entrada) return;
    let valor = entrada.value;
    if (entrada.dataset.tipo === "linhas") valor = valor.split("\n").map((l) => l.trim()).filter(Boolean);
    else if (entrada.dataset.tipo === "digitos") valor = valor.replace(/\D/g, "");
    else if (entrada.dataset.tipo === "numero") valor = Math.max(1, Math.round(Number(valor) || 1));
    else valor = valor.trim();
    gravarCaminho(estado.loja, entrada.dataset.campo, valor);
    alterou();
  });
  el.formLoja.addEventListener("submit", (e) => e.preventDefault());

  // ---------- Abas ----------
  function trocarAba(aba) {
    estado.aba = aba;
    for (const botao of $$(".aba")) botao.setAttribute("aria-selected", String(botao.dataset.aba === aba));
    $("#abaBolos").hidden = aba !== "bolos";
    $("#abaCategorias").hidden = aba !== "categorias";
    $("#abaLoja").hidden = aba !== "loja";
  }
  for (const botao of $$(".aba")) botao.addEventListener("click", () => trocarAba(botao.dataset.aba));

  function renderizarTudo() {
    renderizarCategorias();
    renderizarBolos();
    renderizarLoja();
    atualizarStatus();
  }

  // ---------- Login / sessão ----------
  async function entrar(token, lembrar) {
    estado.token = token;
    el.btnEntrar.disabled = true;
    el.erroLogin.hidden = true;
    try {
      const info = await gh(repo(""));
      if (info.permissions && !info.permissions.push) {
        throw Object.assign(new Error("Sua conta não tem permissão de escrita neste repositório."), { status: -1 });
      }
      await carregar();
      if (lembrar !== undefined) armazenamentoToken.gravar(token, lembrar);
      el.telaLogin.hidden = true;
      el.telaApp.hidden = false;
      el.campoToken.value = "";
      renderizarTudo();
    } catch (erro) {
      estado.token = "";
      el.telaApp.hidden = true;
      el.telaLogin.hidden = false;
      el.erroLogin.textContent = erro.status === 401 || erro.status === 404
        ? "Token inválido, expirado ou sem acesso a este repositório."
        : erro.message;
      el.erroLogin.hidden = false;
      if (erro.status === 401) armazenamentoToken.apagar();
    } finally {
      el.btnEntrar.disabled = false;
    }
  }

  function sair(mensagem) {
    armazenamentoToken.apagar();
    estado.token = "";
    el.telaApp.hidden = true;
    el.telaLogin.hidden = false;
    el.erroLogin.textContent = mensagem || "";
    el.erroLogin.hidden = !mensagem;
  }

  el.formLogin.addEventListener("submit", (e) => {
    e.preventDefault();
    const token = el.campoToken.value.trim();
    if (!token) {
      el.erroLogin.textContent = "Cole o token do GitHub.";
      el.erroLogin.hidden = false;
      return;
    }
    entrar(token, el.campoLembrar.checked);
  });

  el.btnSair.addEventListener("click", () => {
    if (temAlteracoes() && !confirm("Há alterações não publicadas. Sair mesmo assim?")) return;
    sair();
  });

  el.btnPublicar.addEventListener("click", publicar);

  el.btnDescartar.addEventListener("click", async () => {
    if (!confirm("Descartar as alterações não publicadas e carregar a versão do site?")) return;
    definirOcupado(true, "Carregando…");
    try {
      await carregar();
      renderizarTudo();
    } catch (erro) {
      tratarErro(erro, "Não foi possível carregar");
    } finally {
      definirOcupado(false);
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (temAlteracoes()) e.preventDefault();
  });

  // ---------- Início ----------
  const tokenSalvo = armazenamentoToken.ler();
  if (tokenSalvo) entrar(tokenSalvo);
  else el.telaLogin.hidden = false;
})();
