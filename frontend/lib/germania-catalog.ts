// ---------------------------------------------------------------------------
// Catálogo Germânia — equipamentos e barris (fonte: germania_produtos.xlsx)
// Fonte: cervejariagermania.com.br | Lig Chopp Germânia | 0800 110 0420
//
// Os estilos de chopp NÃO entram aqui: são o produto líquido de venda da
// cervejaria, e o KegSafe rastreia o barril (ativo físico), não o conteúdo.
// ---------------------------------------------------------------------------

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
    note: 'Disponível via Lig Chopp; cortesia acima de 30L.',
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
    note: 'Máquina com serpentina para gelamento das 4 torneiras.',
  },
];

export const BARREL_SIZES = ['10L', '15L', '20L', '30L', '50L'];
