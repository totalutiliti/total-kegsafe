// ---------------------------------------------------------------------------
// Catálogo Germânia — dados oficiais da planilha germania_produtos.xlsx
// Fonte: cervejariagermania.com.br | Lig Chopp Germânia | 0800 110 0420
// Usado na página /catalogo (vitrine de estilos e equipamentos).
// ---------------------------------------------------------------------------

export interface BeerStyle {
  name: string;
  category: 'Tradicional' | 'Especial';
  ibu: string;
  abv: string;
  temp: string;
  color: string; // cor aproximada do chopp (swatch)
  formats: string[];
  onlyGrowler?: boolean; // não disponível em barril
  note: string;
}

export const BEER_STYLES: BeerStyle[] = [
  {
    name: 'Germânia Pilsen',
    category: 'Tradicional',
    ibu: '10',
    abv: '4,5%',
    temp: '2 a 4 °C',
    color: '#E9B84A',
    formats: ['Barril 10–50L', 'Garrafa 355/500ml', 'Growler 1L', 'Lata 473ml'],
    note: 'Estilo mais vendido. Altamente refrescante, de baixo amargor.',
  },
  {
    name: 'Germânia Escuro',
    category: 'Tradicional',
    ibu: '9',
    abv: '4,0%',
    temp: '—',
    color: '#5C3218',
    formats: ['Barril 10–50L', 'Garrafa 355ml'],
    note: 'Leve e refrescante, com coloração escura.',
  },
  {
    name: 'Germânia Black',
    category: 'Tradicional',
    ibu: '9',
    abv: '4,0%',
    temp: '—',
    color: '#2B1A12',
    formats: ['Barril 10–50L', 'Garrafa 500ml'],
    note: 'Variante escura premium.',
  },
  {
    name: 'Germânia Puro Malte',
    category: 'Tradicional',
    ibu: '—',
    abv: '—',
    temp: '—',
    color: '#E0A93C',
    formats: ['Barril 10–50L', 'Garrafa 355ml'],
    note: 'Premium Lager com técnicas alemãs: só água, malte, lúpulo e levedura.',
  },
  {
    name: 'Germânia Vinhedo',
    category: 'Tradicional',
    ibu: '6',
    abv: '6,8%',
    temp: '4 a 6 °C',
    color: '#7B2D3A',
    formats: ['Barril 10–50L', 'Garrafa 355/500ml', 'Growler 1L'],
    note: 'Blend de chopp com vinho — único no mercado. Requinte e leveza.',
  },
  {
    name: 'Germânia Amber Lager',
    category: 'Especial',
    ibu: '18',
    abv: '4,8%',
    temp: '2 a 4 °C',
    color: '#C67A28',
    formats: ['Barril 10–50L', 'Garrafa 500ml'],
    note: 'Lager âmbar maltada, notas de caramelo/tostado e alta drinkability.',
  },
  {
    name: 'Germânia IPA',
    category: 'Especial',
    ibu: '50',
    abv: '7,0%',
    temp: '7 a 10 °C',
    color: '#D98A2B',
    formats: ['Barril 10–50L', 'Garrafa 500ml', 'Growler 1L'],
    note: 'Premiada internacionalmente. Aroma cítrico e corpo médio.',
  },
  {
    name: 'Germânia Munich Helles',
    category: 'Especial',
    ibu: '11',
    abv: '4,5%',
    temp: '2 a 4 °C',
    color: '#E8C25A',
    formats: ['Barril 10–50L', 'Garrafa 500ml'],
    note: 'Lager dourada alemã, de lúpulo sutil. Refrescante para o dia a dia.',
  },
  {
    name: 'Germânia Weissbier',
    category: 'Especial',
    ibu: '12',
    abv: '5,0%',
    temp: '4 a 6 °C',
    color: '#E4C77A',
    formats: ['Barril 10–50L', 'Garrafa 500ml'],
    note: 'Cerveja de trigo alemã, não filtrada, com aromas de banana e cravo.',
  },
  {
    name: 'Germânia Carioquinha',
    category: 'Especial',
    ibu: '10',
    abv: '4,5%',
    temp: '—',
    color: '#B5732E',
    formats: ['Growler 1L'],
    onlyGrowler: true,
    note: 'Blend de Pilsen + Escuro. Exclusivo em growler.',
  },
  {
    name: 'Slow Beer',
    category: 'Especial',
    ibu: '10',
    abv: '4,5%',
    temp: '2 a 4 °C',
    color: '#D9B24A',
    formats: ['Barril 10–50L'],
    note: 'Não filtrada. Potencializa o sabor do malte, com coloração turva.',
  },
];

export interface DraftMachine {
  name: string;
  type: string;
  taps: string;
  flow: string;
  voltage: string;
  price: string;
  bestFor: string;
  note: string;
}

export const DRAFT_MACHINES: DraftMachine[] = [
  {
    name: 'Chopeira Mini (Nano)',
    type: 'Elétrica',
    taps: '1 torneira',
    flow: '30 L/h',
    voltage: '110V ou 220V',
    price: 'R$ 6.999',
    bestFor: 'Festas menores, até ~15 pessoas',
    note: '1 torneira italiana. Inclui cilindro CO₂, mangueiras, válvulas e retrolavagem; créditos de chopp por 2 anos.',
  },
  {
    name: 'Chopeira Master',
    type: 'Elétrica',
    taps: '2 torneiras',
    flow: '45 L/h',
    voltage: '110V ou 220V',
    price: 'R$ 8.919',
    bestFor: 'Eventos maiores, 2 estilos simultâneos',
    note: '2 torneiras italianas, design slim inox e termostato digital. Inclui cilindro CO₂, mangueiras, válvulas e retrolavagem; créditos de chopp por 2 anos.',
  },
  {
    name: 'Chopeira Locação (1 a 4 torneiras)',
    type: 'Elétrica',
    taps: '1 a 4 torneiras',
    flow: '30–45 L/h',
    voltage: '110V ou 220V',
    price: 'A consultar',
    bestFor: 'De confraternizações a grandes eventos',
    note: 'Disponível via Lig Chopp; cortesia acima de 30L. Escolha do número de estilos conforme as torneiras.',
  },
  {
    name: 'Chopeira Ecológica a Gelo (1 ou 2 torneiras)',
    type: 'A gelo (sem eletricidade)',
    taps: '1 a 2 torneiras',
    flow: '—',
    voltage: 'Não requer energia',
    price: 'A consultar',
    bestFor: 'Locais sem energia elétrica',
    note: 'Refrigeração a gelo, portátil. Disponível via Lig Chopp.',
  },
  {
    name: 'Torre Congelada (4 torneiras)',
    type: 'Elétrica c/ serpentina',
    taps: '4 torneiras',
    flow: '—',
    voltage: '220V',
    price: 'A consultar',
    bestFor: 'Eventos de grande porte',
    note: 'Máquina com serpentina para gelamento; 4 torneiras com sabores à escolha do cliente.',
  },
];

export const BARREL_SIZES = ['10L', '15L', '20L', '30L', '50L'];
