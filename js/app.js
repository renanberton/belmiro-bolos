/**
 * BELMIRO BOLOS — lógica do cardápio, carrinho e envio pelo WhatsApp.
 * Normalmente NÃO é necessário editar este arquivo:
 *   - dados da loja  -> data/loja.json
 *   - categorias     -> data/categorias.json
 *   - produtos       -> data/produtos.json
 * Os três são editados pelo painel /admin.
 *
 * Segurança: todo texto é inserido com textContent (nunca innerHTML),
 * o carrinho salvo é revalidado contra o catálogo e os preços sempre
 * vêm de data/produtos.json — nunca do armazenamento do navegador.
 */
(async function () {
  "use strict";

  const [loja, categorias, catalogo] = await Promise.all([
    carregarJson("data/loja.json", {}),
    carregarJson("data/categorias.json", []),
    carregarJson("data/produtos.json", []),
  ]);
  // "todos" é uma categoria especial (mostra tudo) e não fica no JSON
  const CONFIG = {
    ...loja,
    categorias: [{ id: "todos", nome: "Todos" }, ...(Array.isArray(categorias) ? categorias : [])],
  };
  const CHAVE_CARRINHO = "belmiro-bolos:carrinho:v1";
  const QTD_MAX = CONFIG.quantidadeMaxima || 20;

  // ---------- Catálogo ----------
  const produtos = (Array.isArray(catalogo) ? catalogo : []).filter(validarProduto).map(Object.freeze);
  const produtosPorId = new Map(produtos.map((p) => [p.id, p]));
  const nomesCategorias = new Map(CONFIG.categorias.map((c) => [c.id, c.nome]));

  // no-cache: revalida a cada visita, para mudanças de preço/disponibilidade aparecerem na hora
  async function carregarJson(caminho, padrao) {
    try {
      const resposta = await fetch(caminho, { cache: "no-cache" });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      return await resposta.json();
    } catch (erro) {
      console.error(`[Belmiro Bolos] Não foi possível carregar ${caminho}:`, erro);
      return padrao;
    }
  }

  function precoValido(v) {
    return typeof v === "number" && isFinite(v) && v >= 0;
  }

  function validarProduto(p) {
    const ok = p && typeof p.id === "string" && typeof p.nome === "string" && precoValido(p.preco) &&
      (p.tamanhos === undefined || (Array.isArray(p.tamanhos) &&
        p.tamanhos.every((t) => t && typeof t.nome === "string" && t.nome && precoValido(t.preco))));
    if (!ok) console.warn("[Belmiro Bolos] Produto ignorado por dados inválidos:", p);
    return ok;
  }

  // Bolo vendido em tamanhos (ex.: Pequena / Grande): cada tamanho tem seu preço
  const temTamanhos = (p) => Array.isArray(p.tamanhos) && p.tamanhos.length > 0;
  const precoMinimo = (p) => (temTamanhos(p) ? Math.min(...p.tamanhos.map((t) => t.preco)) : p.preco);
  const textoPreco = (p) => (temTamanhos(p) ? `a partir de ${moeda(precoMinimo(p))}` : moeda(p.preco));

  // Item do carrinho: chave "id" ou "id|Tamanho"
  const chaveItem = (produto, tamanho) => (tamanho ? `${produto.id}|${tamanho.nome}` : produto.id);
  function itemDaChave(chave) {
    const [id, nomeTamanho] = String(chave).split("|");
    const produto = produtosPorId.get(id);
    if (!produto) return null;
    if (!temTamanhos(produto)) return nomeTamanho === undefined ? { produto, tamanho: null } : null;
    const tamanho = produto.tamanhos.find((t) => t.nome === nomeTamanho);
    return tamanho ? { produto, tamanho } : null;
  }
  const nomeItem = ({ produto, tamanho }) => (tamanho ? `${produto.nome} (${tamanho.nome})` : produto.nome);
  const precoItem = ({ produto, tamanho }) => (tamanho ? tamanho.preco : produto.preco);

  // ---------- Utilidades ----------
  const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
  const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const moeda = (valor) => formatoMoeda.format(valor);
  const normalizar = (texto) =>
    String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const limparTexto = (texto, max) =>
    String(texto || "").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim().slice(0, max);
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  // wa.me funciona no celular (app) e no computador (WhatsApp Web/Desktop)
  function linkWhatsapp(mensagem) {
    const numero = String(CONFIG.whatsapp).replace(/\D/g, "");
    return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
  }

  // Aceita apenas caminhos relativos ou https para imagens
  function urlImagemSegura(url) {
    // O painel grava "/img/produtos/x.webp"; sem a barra inicial o caminho também funciona em subpasta (GitHub Pages)
    const texto = String(url || "").replace(/^\/(?=[^/])/, "");
    return /^(https:\/\/|\.{0,2}\/?[\w\-./]+$)/i.test(texto) && !/^\s*(javascript|data):/i.test(texto)
      ? texto
      : "img/sem-foto.svg"; // bolo ainda sem foto (ou caminho inválido)
  }

  const armazenamento = {
    ler(chave) {
      try { return JSON.parse(localStorage.getItem(chave)); } catch { return null; }
    },
    gravar(chave, valor) {
      try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* modo privado / bloqueado */ }
    },
  };

  // ---------- Estado ----------
  const estado = {
    categoria: "todos",
    busca: "",
    carrinho: carregarCarrinho(), // Map<chave (id ou id|tamanho), quantidade>
    produtoAberto: null,
    tamanhoModal: null,
    qtdModal: 1,
    linkWhatsapp: "",
  };

  function carregarCarrinho() {
    const salvo = armazenamento.ler(CHAVE_CARRINHO);
    const carrinho = new Map();
    if (!Array.isArray(salvo)) return carrinho;
    for (const item of salvo) {
      if (!Array.isArray(item)) continue;
      const [chave, qtd] = item;
      const alvo = itemDaChave(chave);
      if (alvo && alvo.produto.disponivel && Number.isInteger(qtd) && qtd > 0) {
        carrinho.set(chave, Math.min(qtd, QTD_MAX));
      }
    }
    return carrinho;
  }

  function salvarCarrinho() {
    armazenamento.gravar(CHAVE_CARRINHO, [...estado.carrinho]);
  }

  function itensCarrinho() {
    return [...estado.carrinho].map(([chave, qtd]) => {
      const alvo = itemDaChave(chave);
      const preco = precoItem(alvo);
      return { chave, produto: alvo.produto, nome: nomeItem(alvo), preco, qtd, subtotal: preco * qtd };
    });
  }

  const totalItens = () => [...estado.carrinho.values()].reduce((a, b) => a + b, 0);
  const totalValor = () => itensCarrinho().reduce((a, i) => a + i.subtotal, 0);

  // ---------- Elementos ----------
  const el = {
    listaCategorias: $("#listaCategorias"),
    campoBusca: $("#campoBusca"),
    btnLimparBusca: $("#btnLimparBusca"),
    listaProdutos: $("#listaProdutos"),
    semResultados: $("#semResultados"),
    tituloSecao: $("#tituloSecao"),
    contagemProdutos: $("#contagemProdutos"),
    contador: $("#contadorItens"),
    btnAbrirPedido: $("#btnAbrirPedido"),
    barraPedido: $("#barraPedido"),
    barraQtd: $("#barraQtd"),
    barraTotal: $("#barraTotal"),
    modalProduto: $("#modalProduto"),
    modalPedido: $("#modalPedido"),
    listaCarrinho: $("#listaCarrinho"),
    carrinhoVazio: $("#carrinhoVazio"),
    carrinhoRodape: $("#carrinhoRodape"),
    carrinhoTotal: $("#carrinhoTotal"),
    dadosTotal: $("#dadosTotal"),
    form: $("#formDados"),
    toast: $("#toast"),
    modeloProduto: $("#modeloProduto"),
    modeloItem: $("#modeloItemCarrinho"),
  };

  // ---------- Categorias ----------
  function renderizarCategorias() {
    const fragmento = document.createDocumentFragment();
    for (const cat of CONFIG.categorias) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "categoria";
      botao.dataset.categoria = cat.id;
      botao.textContent = cat.nome;
      botao.setAttribute("aria-pressed", String(cat.id === estado.categoria));
      fragmento.appendChild(botao);
    }
    el.listaCategorias.replaceChildren(fragmento);
  }

  // No computador, a rodinha do mouse rola as categorias para o lado
  el.listaCategorias.addEventListener("wheel", (e) => {
    const lista = el.listaCategorias;
    if (e.shiftKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX) || lista.scrollWidth <= lista.clientWidth) return;
    e.preventDefault();
    lista.scrollLeft += e.deltaY;
  }, { passive: false });

  el.listaCategorias.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-categoria]");
    if (!botao) return;
    estado.categoria = botao.dataset.categoria;
    for (const b of el.listaCategorias.children) {
      b.setAttribute("aria-pressed", String(b === botao));
    }
    botao.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    renderizarProdutos();
  });

  // ---------- Busca ----------
  let temporizadorBusca;
  el.campoBusca.addEventListener("input", () => {
    el.btnLimparBusca.hidden = el.campoBusca.value === "";
    clearTimeout(temporizadorBusca);
    temporizadorBusca = setTimeout(() => {
      estado.busca = normalizar(el.campoBusca.value);
      renderizarProdutos();
    }, 120);
  });
  el.campoBusca.addEventListener("keydown", (e) => {
    if (e.key === "Enter") el.campoBusca.blur();
  });
  el.btnLimparBusca.addEventListener("click", () => {
    el.campoBusca.value = "";
    el.btnLimparBusca.hidden = true;
    estado.busca = "";
    renderizarProdutos();
    el.campoBusca.focus();
  });
  $("#btnVerTodos").addEventListener("click", () => {
    el.campoBusca.value = "";
    el.btnLimparBusca.hidden = true;
    estado.busca = "";
    estado.categoria = "todos";
    renderizarCategorias();
    renderizarProdutos();
  });

  // ---------- Produtos ----------
  function produtosFiltrados() {
    return produtos.filter((p) =>
      (estado.categoria === "todos" || p.categoria === estado.categoria) &&
      (!estado.busca || normalizar(p.nome).includes(estado.busca))
    );
  }

  function renderizarProdutos() {
    const lista = produtosFiltrados();
    const fragmento = document.createDocumentFragment();

    for (const p of lista) {
      const card = el.modeloProduto.content.firstElementChild.cloneNode(true);
      card.dataset.id = p.id;
      const foto = $(".produto__foto", card);
      foto.src = urlImagemSegura(p.foto);
      foto.alt = p.nome;
      $(".produto__nome", card).textContent = p.nome;
      $(".produto__descricao", card).textContent = p.descricao || "";
      $(".produto__preco", card).textContent = textoPreco(p);
      $(".produto__abrir", card).setAttribute("aria-label", `Ver detalhes de ${p.nome}`);

      if (p.destaque) {
        const selo = $(".produto__selo", card);
        selo.textContent = p.destaque;
        selo.dataset.tipo = normalizar(p.destaque); // "sem lactose" / "sem gluten" têm cor própria
        selo.hidden = false;
      }
      if (!p.disponivel) {
        card.classList.add("produto--indisponivel");
        $("[data-acao='adicionar']", card).hidden = true;
        $(".selo-indisponivel", card).hidden = false;
      } else {
        $("[data-acao='adicionar']", card).setAttribute("aria-label", `Adicionar ${p.nome} ao pedido`);
      }
      fragmento.appendChild(card);
    }

    el.listaProdutos.replaceChildren(fragmento);
    el.semResultados.hidden = lista.length > 0;
    el.tituloSecao.textContent = estado.busca
      ? "Resultado da pesquisa"
      : estado.categoria === "todos" ? "Nosso cardápio" : nomesCategorias.get(estado.categoria);
    el.contagemProdutos.textContent = lista.length ? plural(lista.length, "bolo", "bolos") : "";
  }

  el.listaProdutos.addEventListener("click", (e) => {
    const acao = e.target.closest("[data-acao]");
    const card = e.target.closest(".produto");
    if (!acao || !card) return;
    const produto = produtosPorId.get(card.dataset.id);
    // com tamanhos, o cliente escolhe o tamanho no detalhe do bolo
    if (acao.dataset.acao === "adicionar") {
      if (temTamanhos(produto)) abrirProduto(produto);
      else adicionarAoCarrinho(produto, null, 1);
    }
    if (acao.dataset.acao === "detalhes") abrirProduto(produto);
  });

  // ---------- Modal do produto ----------
  function abrirProduto(p) {
    estado.produtoAberto = p;
    estado.qtdModal = 1;
    estado.tamanhoModal = null;
    const foto = $("#produtoFoto");
    foto.src = urlImagemSegura(p.foto);
    foto.alt = p.nome;
    $("#produtoCategoria").textContent = nomesCategorias.get(p.categoria) || "";
    $("#produtoNome").textContent = p.nome;
    $("#produtoDetalhes").textContent = p.detalhes || p.descricao || "";
    $("#produtoPreco").textContent = textoPreco(p);
    renderizarTamanhos(p);
    $("#produtoIndisponivel").hidden = p.disponivel;
    $("#produtoAcoes").hidden = !p.disponivel;
    atualizarQtdModal();
    abrirModal(el.modalProduto);
  }

  function renderizarTamanhos(p) {
    const grupo = $("#produtoTamanhos");
    grupo.hidden = !temTamanhos(p);
    if (!temTamanhos(p)) return;
    const opcoes = p.tamanhos.map((t, i) => {
      const rotulo = document.createElement("label");
      rotulo.className = "opcao";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "tamanho";
      radio.value = String(i);
      const caixa = document.createElement("span");
      caixa.className = "opcao__caixa";
      const nome = document.createElement("strong");
      nome.textContent = t.nome;
      const preco = document.createElement("small");
      preco.textContent = moeda(t.preco);
      caixa.append(nome, preco);
      rotulo.append(radio, caixa);
      return rotulo;
    });
    $("#produtoOpcoesTamanho").replaceChildren(...opcoes);
  }

  $("#produtoOpcoesTamanho").addEventListener("change", (e) => {
    const p = estado.produtoAberto;
    estado.tamanhoModal = p && temTamanhos(p) ? p.tamanhos[Number(e.target.value)] || null : null;
    if (estado.tamanhoModal) $("#produtoPreco").textContent = moeda(estado.tamanhoModal.preco);
    atualizarQtdModal();
  });

  function atualizarQtdModal() {
    $("#produtoQtd").textContent = estado.qtdModal;
    $("#produtoMenos").disabled = estado.qtdModal <= 1;
    $("#produtoMais").disabled = estado.qtdModal >= QTD_MAX;
    const p = estado.produtoAberto;
    const faltaTamanho = Boolean(p && temTamanhos(p) && !estado.tamanhoModal);
    $("#produtoAdicionar").disabled = faltaTamanho;
    $("#produtoAdicionar").textContent = !p
      ? "Adicionar ao pedido"
      : faltaTamanho
        ? "Escolha o tamanho"
        : `Adicionar ao pedido · ${moeda(precoItem({ produto: p, tamanho: estado.tamanhoModal }) * estado.qtdModal)}`;
  }

  $("#produtoMenos").addEventListener("click", () => { estado.qtdModal = Math.max(1, estado.qtdModal - 1); atualizarQtdModal(); });
  $("#produtoMais").addEventListener("click", () => { estado.qtdModal = Math.min(QTD_MAX, estado.qtdModal + 1); atualizarQtdModal(); });
  $("#produtoAdicionar").addEventListener("click", () => {
    adicionarAoCarrinho(estado.produtoAberto, estado.tamanhoModal, estado.qtdModal);
    el.modalProduto.close();
  });

  // ---------- Carrinho ----------
  function adicionarAoCarrinho(produto, tamanho, qtd) {
    if (!produto || !produto.disponivel || (temTamanhos(produto) && !tamanho)) return;
    const chave = chaveItem(produto, tamanho);
    const atual = estado.carrinho.get(chave) || 0;
    const nova = Math.min(atual + qtd, QTD_MAX);
    estado.carrinho.set(chave, nova);
    salvarCarrinho();
    atualizarResumo(true);
    mostrarToast(nova === QTD_MAX && atual + qtd > QTD_MAX
      ? `Limite de ${QTD_MAX} unidades por bolo`
      : `${nomeItem({ produto, tamanho })} adicionado ao pedido`);
  }

  function alterarQuantidade(id, delta) {
    const nova = (estado.carrinho.get(id) || 0) + delta;
    if (nova <= 0) estado.carrinho.delete(id);
    else estado.carrinho.set(id, Math.min(nova, QTD_MAX));
    salvarCarrinho();
    atualizarResumo();
    renderizarCarrinho();
  }

  function atualizarResumo(animar = false) {
    const qtd = totalItens();
    const total = moeda(totalValor());
    el.contador.textContent = qtd > 99 ? "99+" : qtd;
    el.contador.hidden = qtd === 0;
    el.btnAbrirPedido.setAttribute("aria-label", `Ver meu pedido (${plural(qtd, "item", "itens")})`);
    el.barraPedido.hidden = qtd === 0;
    document.body.classList.toggle("tem-barra-pedido", qtd > 0);
    el.barraQtd.textContent = plural(qtd, "item", "itens");
    el.barraTotal.textContent = total;
    el.carrinhoTotal.textContent = total;
    el.dadosTotal.textContent = total;
    if (animar) {
      el.contador.classList.remove("pulsar");
      void el.contador.offsetWidth; // reinicia a animação
      el.contador.classList.add("pulsar");
    }
  }

  function renderizarCarrinho() {
    const itens = itensCarrinho();
    const fragmento = document.createDocumentFragment();
    for (const { chave, produto, nome, preco, qtd, subtotal } of itens) {
      const li = el.modeloItem.content.firstElementChild.cloneNode(true);
      li.dataset.id = chave;
      const foto = $(".item-carrinho__foto", li);
      foto.src = urlImagemSegura(produto.foto);
      $(".item-carrinho__nome", li).textContent = nome;
      $(".item-carrinho__unitario", li).textContent = `${moeda(preco)} cada`;
      $("[data-qtd]", li).textContent = qtd;
      $(".item-carrinho__subtotal", li).textContent = moeda(subtotal);
      $("[data-acao='diminuir']", li).setAttribute("aria-label", `Diminuir quantidade de ${nome}`);
      const mais = $("[data-acao='aumentar']", li);
      mais.setAttribute("aria-label", `Aumentar quantidade de ${nome}`);
      mais.disabled = qtd >= QTD_MAX;
      $("[data-acao='remover']", li).setAttribute("aria-label", `Remover ${nome} do pedido`);
      fragmento.appendChild(li);
    }
    el.listaCarrinho.replaceChildren(fragmento);
    el.carrinhoVazio.hidden = itens.length > 0;
    el.carrinhoRodape.hidden = itens.length === 0;
  }

  el.listaCarrinho.addEventListener("click", (e) => {
    const acao = e.target.closest("[data-acao]");
    const item = e.target.closest(".item-carrinho");
    if (!acao || !item) return;
    const id = item.dataset.id;
    if (acao.dataset.acao === "aumentar") alterarQuantidade(id, 1);
    if (acao.dataset.acao === "diminuir") alterarQuantidade(id, -1);
    if (acao.dataset.acao === "remover") {
      const nome = nomeItem(itemDaChave(id));
      estado.carrinho.delete(id);
      salvarCarrinho();
      atualizarResumo();
      renderizarCarrinho();
      mostrarToast(`${nome} removido do pedido`);
    }
  });

  // ---------- Modal do pedido (etapas) ----------
  let etapaAtual = "carrinho";

  function irParaEtapa(etapa) {
    etapaAtual = etapa;
    const ordem = ["carrinho", "dados", "enviado"];
    for (const secao of el.modalPedido.querySelectorAll("[data-etapa]")) {
      secao.hidden = secao.dataset.etapa !== etapa;
    }
    for (const ind of el.modalPedido.querySelectorAll("[data-etapa-indicador]")) {
      const i = ordem.indexOf(ind.dataset.etapaIndicador);
      ind.classList.toggle("ativa", i === ordem.indexOf(etapa));
      ind.classList.toggle("feita", i < ordem.indexOf(etapa));
    }
    $("#btnVoltarEtapa").hidden = etapa !== "dados";
    $("#pedidoTitulo").textContent =
      etapa === "carrinho" ? "Meu pedido" : etapa === "dados" ? "Seus dados" : "Pedido encaminhado";
    el.modalPedido.scrollTop = 0;
  }

  function abrirPedido() {
    renderizarCarrinho();
    irParaEtapa("carrinho");
    abrirModal(el.modalPedido);
  }

  el.btnAbrirPedido.addEventListener("click", abrirPedido);
  $("#btnBarraPedido").addEventListener("click", abrirPedido);
  $("#btnContinuar").addEventListener("click", () => {
    if (estado.carrinho.size === 0) return;
    irParaEtapa("dados");
    $("#clienteNome").focus({ preventScroll: true });
  });
  $("#btnVoltarEtapa").addEventListener("click", () => { renderizarCarrinho(); irParaEtapa("carrinho"); });
  $("#btnNovoPedido").addEventListener("click", () => {
    estado.carrinho.clear();
    salvarCarrinho();
    el.form.reset();
    $("#campoEndereco").hidden = true;
    atualizarResumo();
    el.modalPedido.close();
    mostrarToast("Pronto! Você pode montar um novo pedido.");
  });

  // ---------- Formulário ----------
  const campoTelefone = $("#clienteTelefone");
  campoTelefone.addEventListener("input", () => {
    const d = campoTelefone.value.replace(/\D/g, "").slice(0, 11);
    let v = d;
    if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 6) v = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    campoTelefone.value = v;
  });

  el.form.addEventListener("change", (e) => {
    if (e.target.name === "forma") {
      const entrega = e.target.value === "Entrega";
      $("#campoEndereco").hidden = !entrega;
      definirErro("erroForma", null, "");
      if (entrega) $("#clienteEndereco").focus();
    }
  });

  function definirErro(idErro, campo, mensagem) {
    $("#" + idErro).textContent = mensagem;
    if (campo) {
      campo.setAttribute("aria-invalid", mensagem ? "true" : "false");
      campo.setAttribute("aria-describedby", idErro);
    }
    return !mensagem;
  }

  function lerFormulario() {
    const dados = new FormData(el.form);
    return {
      nome: limparTexto(dados.get("nome"), 60),
      telefone: limparTexto(dados.get("telefone"), 15),
      forma: dados.get("forma") === "Entrega" ? "Entrega" : dados.get("forma") === "Retirada" ? "Retirada" : "",
      endereco: limparTexto(dados.get("endereco"), 200),
      observacoes: limparTexto(dados.get("observacoes"), 300),
    };
  }

  function validar(d) {
    const campos = {
      nome: $("#clienteNome"), telefone: campoTelefone, endereco: $("#clienteEndereco"),
    };
    const resultados = [
      definirErro("erroNome", campos.nome, d.nome.length >= 2 ? "" : "Informe seu nome."),
      definirErro("erroTelefone", campos.telefone,
        /^\d{10,11}$/.test(d.telefone.replace(/\D/g, "")) ? "" : "Informe um telefone válido com DDD."),
      definirErro("erroForma", null, d.forma ? "" : "Escolha entrega ou retirada."),
      definirErro("erroEndereco", campos.endereco,
        d.forma !== "Entrega" || d.endereco.length >= 5 ? "" : "Informe o endereço de entrega."),
    ];
    const primeiroInvalido = el.form.querySelector("[aria-invalid='true']") ||
      (!d.forma && el.form.querySelector("input[name='forma']"));
    if (primeiroInvalido) primeiroInvalido.focus();
    return resultados.every(Boolean);
  }

  function montarMensagem(d) {
    const linhas = [
      `Olá! Gostaria de fazer um pedido na ${CONFIG.nomeLoja}.`,
      "",
      "Produtos:",
      ...itensCarrinho().map(({ nome, qtd, subtotal }) => `${qtd}x ${nome} - ${moeda(subtotal)}`),
      "",
      `Total: ${moeda(totalValor())}`,
      "",
      `Nome: ${d.nome}`,
      `Telefone: ${d.telefone}`,
      `Forma: ${d.forma}`,
    ];
    if (d.forma === "Entrega") linhas.push(`Endereço: ${d.endereco}`);
    if (d.observacoes) linhas.push(`Observações: ${d.observacoes}`);
    linhas.push("", "Gostaria de confirmar a disponibilidade e finalizar meu pedido.");
    return linhas.join("\n").replace(/ /g, " ");
  }

  el.form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (estado.carrinho.size === 0) { irParaEtapa("carrinho"); return; }
    const dados = lerFormulario();
    if (!validar(dados)) return;

    const url = linkWhatsapp(montarMensagem(dados));
    estado.linkWhatsapp = url;
    $("#linkReabrirWhatsapp").href = url;

    const janela = window.open(url, "_blank", "noopener,noreferrer");
    irParaEtapa("enviado");
    if (!janela) window.location.href = url; // fallback se o navegador bloquear a nova aba
  });

  // ---------- Modais: comportamento comum ----------
  function abrirModal(dialogo) {
    if (!dialogo.open) dialogo.showModal();
    document.documentElement.classList.add("modal-aberto");
  }

  for (const dialogo of [el.modalProduto, el.modalPedido]) {
    dialogo.addEventListener("click", (e) => {
      // fecha ao clicar fora (no fundo escuro) ou em botões [data-fechar]
      if (e.target === dialogo || e.target.closest("[data-fechar]")) dialogo.close();
    });
    dialogo.addEventListener("close", () => {
      if (!el.modalProduto.open && !el.modalPedido.open) document.documentElement.classList.remove("modal-aberto");
    });
  }

  // ---------- Toast ----------
  let temporizadorToast;
  function mostrarToast(mensagem) {
    el.toast.textContent = mensagem;
    el.toast.hidden = false;
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => { el.toast.hidden = true; }, 2200);
  }

  // ---------- Rodapé ----------
  function renderizarRodape() {
    const r = CONFIG.rodape || {};
    const preencher = (item, texto) => {
      if (!texto) return false;
      $("span", item).textContent = texto;
      item.hidden = false;
      return true;
    };

    if (r.slogan) {
      $("#rodapeSlogan").textContent = r.slogan;
      $("#rodapeSlogan").hidden = false;
    }
    const seo = CONFIG.seo || {};
    const cidadeUf = [seo.cidade, seo.estado].filter(Boolean).join(" - ");
    const enderecoCompleto = [r.endereco, cidadeUf].filter(Boolean).join(", ");
    const temEndereco = preencher($("#rodapeEndereco"), r.endereco && enderecoCompleto);
    if (temEndereco) {
      const busca = [CONFIG.nomeLoja, enderecoCompleto, seo.cep].filter(Boolean).join(", ");
      $("#rodapeMapa").href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(busca)}`;
      $("#rodapeMapa").setAttribute("aria-label", `${enderecoCompleto} (abrir no Google Maps)`);
    }
    const digitosTelefone = String(r.telefone || "").replace(/\D/g, "");
    const temTelefone = preencher($("#rodapeTelefone"), digitosTelefone && r.telefone);
    if (temTelefone) $("#rodapeTelefoneLink").href = `tel:+55${digitosTelefone}`;
    const horario = Array.isArray(r.horario) ? r.horario.join("\n") : r.horario;
    const temHorario = preencher($("#rodapeHorario"), horario);
    $("#rodapeVisite").hidden = !(temEndereco || temTelefone || temHorario);

    if (r.instagram && /^[\w.]{1,30}$/.test(r.instagram)) {
      const insta = $("#rodapeInstagram");
      insta.href = `https://instagram.com/${r.instagram}`;
      insta.setAttribute("aria-label", `Instagram @${r.instagram}`);
      preencher(insta, "Instagram"); // mesmo padrão do WhatsApp e do Facebook; o @ fica no aria-label
    }
    if (r.facebook && /^[\w.\-]{1,50}$/.test(r.facebook)) {
      const face = $("#rodapeFacebook");
      face.href = `https://www.facebook.com/${r.facebook}`;
      face.hidden = false;
    }

    $("#rodapeCopy").textContent =
      `© ${new Date().getFullYear()} ${CONFIG.nomeLoja} · Pedidos confirmados pelo WhatsApp.`;
  }

  // ---------- Links de contato pelo WhatsApp ----------
  function renderizarContato() {
    const url = linkWhatsapp(CONFIG.mensagemContato || `Olá, ${CONFIG.nomeLoja}!`);
    $("#whatsFlutuante").href = url;
    $("#rodapeWhatsapp").href = url;
  }

  // ---------- SEO: dados estruturados (schema.org) para o Google ----------
  function renderizarDadosEstruturados() {
    const r = CONFIG.rodape || {};
    const seo = CONFIG.seo || {};
    const urlAbsoluta = (caminho) => new URL(caminho, location.href).href;
    const categoriasUsadas = CONFIG.categorias.filter((c) =>
      c.id !== "todos" && produtos.some((p) => p.categoria === c.id));

    const dados = {
      "@context": "https://schema.org",
      "@type": "Bakery",
      name: CONFIG.nomeLoja,
      description: r.slogan || undefined,
      url: urlAbsoluta("./"),
      menu: urlAbsoluta("./"),
      logo: urlAbsoluta("img/utils/logo.png"),
      image: urlAbsoluta("img/compartilhar.jpg"),
      telephone: r.telefone
        ? `+55 ${r.telefone.replace(/[()]/g, "")}`
        : `+${String(CONFIG.whatsapp).replace(/\D/g, "")}`,
      hasMap: r.endereco
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          [CONFIG.nomeLoja, r.endereco, seo.cidade, seo.estado].filter(Boolean).join(", "))}`
        : undefined,
      priceRange: "R$",
      servesCuisine: "Confeitaria",
      acceptsReservations: false,
      address: r.endereco ? {
        "@type": "PostalAddress",
        streetAddress: r.endereco,
        addressLocality: seo.cidade || undefined,
        addressRegion: seo.estado || undefined,
        postalCode: seo.cep || undefined,
        addressCountry: "BR",
      } : undefined,
      openingHours: seo.horarios && seo.horarios.length ? seo.horarios : undefined,
      sameAs: [
        r.instagram && `https://www.instagram.com/${r.instagram}`,
        r.facebook && `https://www.facebook.com/${r.facebook}`,
      ].filter(Boolean),
      hasMenu: {
        "@type": "Menu",
        name: "Cardápio",
        hasMenuSection: categoriasUsadas.map((c) => ({
          "@type": "MenuSection",
          name: c.nome,
          hasMenuItem: produtos.filter((p) => p.categoria === c.id).map((p) => ({
            "@type": "MenuItem",
            name: p.nome,
            description: p.descricao || undefined,
            image: urlAbsoluta(urlImagemSegura(p.foto)),
            offers: (temTamanhos(p) ? p.tamanhos : [{ preco: p.preco }]).map((t) => ({
              "@type": "Offer",
              name: t.nome,
              price: t.preco.toFixed(2),
              priceCurrency: "BRL",
              availability: p.disponivel ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            })),
          })),
        })),
      },
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(dados).replace(/</g, "\\u003c");
    document.head.appendChild(script);
  }

  // ---------- Topo: sombra mais forte ao rolar ----------
  const topo = $(".topo");
  const marcarRolagem = () => topo.classList.toggle("topo--rolado", window.scrollY > 8);
  window.addEventListener("scroll", marcarRolagem, { passive: true });
  marcarRolagem();

  // Sincroniza o carrinho entre abas abertas
  window.addEventListener("storage", (e) => {
    if (e.key !== CHAVE_CARRINHO) return;
    estado.carrinho = carregarCarrinho();
    atualizarResumo();
    if (el.modalPedido.open && etapaAtual === "carrinho") renderizarCarrinho();
  });

  // ---------- Início ----------
  renderizarCategorias();
  renderizarProdutos();
  renderizarRodape();
  renderizarContato();
  renderizarDadosEstruturados();
  atualizarResumo();
})();
