/**
 * CONFIGURAÇÕES GERAIS DA LOJA
 * ---------------------------------------------------------------
 * Altere aqui os dados da loja. Não é preciso mexer em outros arquivos.
 */
window.BB_CONFIG = Object.freeze({
  nomeLoja: "Belmiro Bolos",

  // Número do WhatsApp principal: apenas dígitos, com DDI (55) + DDD + número.
  // Exemplo: (13) 99117-3134  ->  "5513991173134"
  whatsapp: "5513991173134",

  // Mensagem inicial do botão flutuante e do link "WhatsApp" do rodapé.
  mensagemContato: "Olá, Belmiro Bolos! Gostaria de tirar uma dúvida.",

  // Categorias exibidas no topo, na ordem desejada.
  // O "id" precisa ser igual ao campo "categoria" dos produtos (js/produtos.js).
  // A categoria "todos" é especial e mostra todos os produtos.
  categorias: [
    { id: "todos", nome: "Todos" },
    { id: "tradicionais", nome: "Tradicionais" },
    { id: "com-cobertura", nome: "Com cobertura" },
    { id: "vulcao", nome: "Vulcão" },
    { id: "recheados", nome: "Recheados" },
    { id: "especiais", nome: "Especiais" },
  ],

  // Quantidade máxima de um mesmo produto por pedido.
  quantidadeMaxima: 20,

  // Textos do rodapé (deixe "" para ocultar).
  rodape: {
    slogan: "Bolos caseiros feitos com carinho, do forno direto para a sua mesa.",
    endereco: "R. Carvalho de Mendonça, 382 - Vila Belmiro", // cidade/UF/CEP vêm do bloco "seo" abaixo
    telefone: "(13) 2202-1187", // telefone fixo (deixe "" para ocultar)
    // Uma linha por item:
    horario: [
      "Seg. a sex.: 9h às 19h",
      "Sábado: 8h30 às 19h",
      "Domingo: fechado",
    ],
    instagram: "belmirobolosoficial", // sem @
    facebook: "belmirobolos",         // só o nome da página (facebook.com/NOME)
  },

  // Dados para o Google (SEO local). Deixe "" o que não souber.
  seo: {
    cidade: "Santos",
    estado: "SP",
    cep: "11070-101",
    // Horário no formato do Google: dias em inglês (Mo Tu We Th Fr Sa Su) + horas.
    // Ex.: "Seg. a sáb., das 8h às 19h"  ->  ["Mo-Sa 08:00-19:00"]
    horarios: ["Mo-Fr 09:00-19:00", "Sa 08:30-19:00"],
  },
});
