export function buildPageImagePrompt(args: {
  scene: string;
  characters?: string;
  setting?: string;
  styleTags?: string[];
}): string {
  const scene = args.scene?.trim() || '';
  const who = args.characters ? `Include: ${args.characters}.` : '';
  const where = args.setting ? `Setting: ${args.setting}.` : '';
  const style = args.styleTags && args.styleTags.length ? `Style: ${args.styleTags.join(', ')}.` : '';

  return [
    scene ? `Illustrate a single scene: ${scene}.` : 'Illustrate a single scene.' ,
    who,
    where,
    style,
    'No text or typography.',
    'No split screens or panels.',
  ]
    .filter(Boolean)
    .join(' ');
}


