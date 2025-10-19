export type StylePackId =
  | 'storybook_watercolor'
  | 'flat_vector'
  | 'soft_clay'
  | 'soft_watercolor'
  | 'bold_flat_shapes'
  | 'crayon_paper_cut';

export interface StylePack {
  id: StylePackId;
  promptTag: string; // short style phrase for prompts
  palette: string[]; // hex colors
  paletteTag: string; // short palette tag for prompts
  background: {
    kind: 'solid' | 'paper' | 'gradient';
    color?: string;
    gradient?: { from: string; to: string; angle?: number };
    paperTexture?: 'light' | 'medium' | 'heavy';
  };
}

const PACKS: Record<StylePackId, StylePack> = {
  storybook_watercolor: {
    id: 'storybook_watercolor',
    promptTag: 'storybook watercolor',
    palette: ['#F2EAD3', '#E1C16E', '#A8C686', '#87A8A4', '#6C7C8C'],
    paletteTag: 'muted warm watercolor palette',
    background: { kind: 'paper', paperTexture: 'light', color: '#faf7f2' },
  },
  flat_vector: {
    id: 'flat_vector',
    promptTag: 'flat vector illustration',
    palette: ['#FFB703', '#FB8500', '#219EBC', '#8ECAE6', '#023047'],
    paletteTag: 'bold saturated flat colors',
    background: { kind: 'solid', color: '#ffffff' },
  },
  soft_clay: {
    id: 'soft_clay',
    promptTag: 'soft clay render, subtle subsurface scattering',
    palette: ['#FFE5D9', '#FFD7BA', '#FEC89A', '#D8E2DC', '#A5BECC'],
    paletteTag: 'pastel clay palette',
    background: { kind: 'gradient', gradient: { from: '#fff6f0', to: '#fde2cf', angle: 90 } },
  },
  soft_watercolor: {
    id: 'soft_watercolor',
    promptTag: 'soft watercolor wash, gentle brush texture',
    palette: ['#FFF8E7', '#FDE2E4', '#CDE7F0', '#C5E1A5', '#A0AEC0'],
    paletteTag: 'soft airy watercolor palette',
    background: { kind: 'paper', paperTexture: 'light', color: '#faf7f2' },
  },
  bold_flat_shapes: {
    id: 'bold_flat_shapes',
    promptTag: 'bold flat shapes, crisp edges, simple geometric forms',
    palette: ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93'],
    paletteTag: 'bold playful primary palette',
    background: { kind: 'solid', color: '#ffffff' },
  },
  crayon_paper_cut: {
    id: 'crayon_paper_cut',
    promptTag: 'crayon texture and paper cut collage, tactile edges',
    palette: ['#FFD166', '#06D6A0', '#EF476F', '#26547C', '#FFE66D'],
    paletteTag: 'warm crayon collage palette',
    background: { kind: 'paper', paperTexture: 'medium', color: '#fffdf7' },
  },
};

export function getStylePack(id: StylePackId): StylePack {
  return PACKS[id];
}

export function listStylePacks(): StylePack[] {
  return Object.values(PACKS);
}


