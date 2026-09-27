/**
 * CARDÁPIO / PRODUTOS
 * ---------------------------------------------------------------
 * Para ADICIONAR um produto: copie um bloco { ... }, cole no final da lista
 * e altere os valores. Para REMOVER: apague o bloco inteiro.
 *
 * Campos:
 *   id          -> identificador único, sem espaços nem acentos (ex.: "bolo-cenoura")
 *   nome        -> nome exibido no cardápio
 *   descricao   -> texto curto exibido no card
 *   detalhes    -> texto maior exibido ao abrir o produto (opcional)
 *   preco       -> número com ponto nos centavos (ex.: 45.9 = R$ 45,90)
 *   categoria   -> id de uma categoria de js/config.js
 *   foto        -> caminho da imagem (recomendado: .webp ou .jpg, 800x600, até ~150 KB)
 *   disponivel  -> true = pode ser pedido | false = aparece como "Indisponível no momento"
 *   destaque    -> texto opcional de selo (ex.: "Mais pedido"), ou deixe ""
 */
window.BB_PRODUTOS = [
  {
    id: "bolo-cenoura",
    nome: "Bolo de Cenoura",
    descricao: "Massa fofinha e úmida, feita com cenouras frescas.",
    detalhes: "O clássico da casa. Massa leve e aerada, feita com cenouras frescas batidas na hora. Ideal para o café da tarde. Aproximadamente 1 kg, serve de 10 a 12 fatias.",
    preco: 35.0,
    categoria: "tradicionais",
    foto: "img/produtos/bolo-cenoura.svg",
    disponivel: true,
    destaque: "",
  },
  {
    id: "bolo-milho",
    nome: "Bolo de Milho",
    descricao: "Cremoso, feito com milho verde de verdade.",
    detalhes: "Receita de família, cremoso por dentro e douradinho por fora, feito com milho verde fresco. Aproximadamente 1 kg, serve de 10 a 12 fatias.",
    preco: 35.0,
    categoria: "tradicionais",
    foto: "img/produtos/bolo-milho.svg",
    disponivel: true,
    destaque: "",
  },
  {
    id: "bolo-fuba",
    nome: "Bolo de Fubá com Goiabada",
    descricao: "Fubá cremoso com pedacinhos de goiabada.",
    detalhes: "Bolo de fubá cremoso com cubinhos de goiabada que derretem no forno. Aproximadamente 1 kg, serve de 10 a 12 fatias.",
    preco: 38.0,
    categoria: "tradicionais",
    foto: "img/produtos/bolo-fuba.svg",
    disponivel: true,
    destaque: "",
  },
  {
    id: "bolo-laranja",
    nome: "Bolo de Laranja",
    descricao: "Massa cítrica e perfumada, com calda de laranja.",
    detalhes: "Feito com suco e raspas de laranja natural, finalizado com uma calda leve e brilhante. Aproximadamente 1 kg, serve de 10 a 12 fatias.",
    preco: 36.0,
    categoria: "tradicionais",
    foto: "img/produtos/bolo-laranja.svg",
    disponivel: true,
    destaque: "",
  },
  {
    id: "cenoura-chocolate",
    nome: "Cenoura com Chocolate",
    descricao: "Nosso bolo de cenoura com generosa cobertura de chocolate.",
    detalhes: "O bolo de cenoura mais pedido da casa, coberto com uma camada generosa de chocolate cremoso que endurece levemente por cima. Aproximadamente 1,2 kg.",
    preco: 42.0,
    categoria: "com-cobertura",
    foto: "img/produtos/cenoura-chocolate.svg",
    disponivel: true,
    destaque: "Mais pedido",
  },
  {
    id: "formigueiro",
    nome: "Formigueiro com Cobertura",
    descricao: "Massa com granulado e cobertura de brigadeiro.",
    detalhes: "Massa fofinha salpicada de chocolate granulado, finalizada com cobertura de brigadeiro. Aproximadamente 1,2 kg.",
    preco: 42.0,
    categoria: "com-cobertura",
    foto: "img/produtos/formigueiro.svg",
    disponivel: true,
    destaque: "",
  },
  {
    id: "vulcao-chocolate",
    nome: "Vulcão de Chocolate",
    descricao: "Bolo de chocolate transbordando brigadeiro cremoso.",
    detalhes: "Bolo de chocolate com o centro recheado de brigadeiro cremoso, que transborda pelas laterais. Acompanha saquinho extra de calda. Aproximadamente 1,5 kg.",
    preco: 55.0,
    categoria: "vulcao",
    foto: "img/produtos/vulcao-chocolate.svg",
    disponivel: true,
    destaque: "Novidade",
  },
  {
    id: "vulcao-ninho",
    nome: "Vulcão de Ninho",
    descricao: "Massa branca com creme de leite Ninho transbordando.",
    detalhes: "Massa branca fofinha com creme de leite Ninho transbordando pelas laterais. Acompanha saquinho extra de creme. Aproximadamente 1,5 kg.",
    preco: 58.0,
    categoria: "vulcao",
    foto: "img/produtos/vulcao-ninho.svg",
    disponivel: true,
    destaque: "",
  },
  {
    id: "recheado-prestigio",
    nome: "Recheado Prestígio",
    descricao: "Chocolate com recheio cremoso de coco.",
    detalhes: "Massa de chocolate com recheio cremoso de coco e cobertura de ganache. Aproximadamente 1,5 kg, serve de 12 a 15 fatias.",
    preco: 65.0,
    categoria: "recheados",
    foto: "img/produtos/recheado-prestigio.svg",
    disponivel: true,
    destaque: "",
  },
  {
    id: "recheado-morango",
    nome: "Recheado de Morango",
    descricao: "Massa branca, creme de baunilha e morangos frescos.",
    detalhes: "Massa branca intercalada com creme de baunilha e morangos frescos selecionados. Aproximadamente 1,5 kg, serve de 12 a 15 fatias.",
    preco: 70.0,
    categoria: "recheados",
    foto: "img/produtos/recheado-morango.svg",
    disponivel: true,
    destaque: "",
  },
  {
    id: "red-velvet",
    nome: "Red Velvet",
    descricao: "Massa aveludada com creme de cream cheese.",
    detalhes: "Massa vermelha aveludada com recheio e cobertura de creme de cream cheese. Aproximadamente 1,8 kg, serve de 15 a 18 fatias.",
    preco: 89.0,
    categoria: "especiais",
    foto: "img/produtos/red-velvet.svg",
    disponivel: true,
    destaque: "",
  },
  {
    id: "nozes-doce-de-leite",
    nome: "Nozes com Doce de Leite",
    descricao: "Massa de nozes com recheio de doce de leite.",
    detalhes: "Massa amanteigada com nozes, recheio de doce de leite artesanal e nozes caramelizadas por cima. Aproximadamente 1,8 kg.",
    preco: 95.0,
    categoria: "especiais",
    foto: "img/produtos/nozes-doce-de-leite.svg",
    disponivel: false,
    destaque: "",
  },
];
