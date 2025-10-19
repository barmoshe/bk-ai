import { CharacterSpec, StyleProfile, CharacterBibleEntry } from '../types';

const DEFAULT_PALETTE = ['#F2E2B0', '#D68A6D', '#4B8DA8', '#C36B5C', '#FFD90F'];

function inferMaturity(age?: number): CharacterSpec['maturity'] {
  if (!Number.isFinite(age as number)) return 'unspecified';
  const n = age as number;
  if (n < 13) return 'kid';
  if (n < 20) return 'teen';
  return 'adult';
}

function inferStyle(looks?: string, fallback?: string): string {
  const text = (looks || '').toLowerCase();
  if (text.includes('watercolor') || (fallback || '').toLowerCase().includes('watercolor')) return 'storybook watercolor';
  if (text.includes('cartoon')) return 'friendly cartoon';
  if (text.includes('sketch')) return 'clean sketch';
  return fallback || 'storybook watercolor';
}

export function canonicalizeSpec(input: any, profile?: StyleProfile): CharacterSpec {
  const name = String(input?.name || 'Hero').trim() || 'Hero';
  const ageFromYears = Number.isFinite(input?.ageYears) ? Number(input.ageYears) : undefined;
  const age = Number.isFinite(input?.age) ? Number(input.age) : ageFromYears;
  const maturity: CharacterSpec['maturity'] = input?.maturity || inferMaturity(age);

  let traits: string[] = Array.isArray(input?.traits) ? input.traits.filter((t: any) => !!String(t).trim()).map((t: any) => String(t).trim()) : [];
  if (!traits.length && typeof input?.description === 'string') {
    traits = input.description
      .split(/[;,]/)
      .map((s: string) => s.trim())
      .filter((s: string) => Boolean(s));
  }
  if (!traits.length && typeof input?.looks === 'string') {
    traits = input.looks
      .split(/[;,]/)
      .map((s: string) => s.trim())
      .filter((s: string) => Boolean(s));
  }
  if (!traits.length) traits = ['friendly', 'cheerful'];

  const style = typeof input?.style === 'string' && input.style.trim() ? input.style : inferStyle(input?.looks, profile ? (profile as any)?.styleTag : undefined);

  let palette: string[] = [];
  if (Array.isArray(input?.palette) && input.palette.length) palette = input.palette;
  else if (profile?.dominantPalette?.length) palette = profile.dominantPalette;
  else palette = DEFAULT_PALETTE;

  const spec: CharacterSpec = {
    name,
    age,
    maturity,
    traits,
    style,
    palette,
    characterKind: (typeof input?.characterKind === 'string' && input.characterKind.trim()) ? String(input.characterKind).trim().toLowerCase() : undefined,
    characterKindDetails: (typeof input?.characterKindDetails === 'string' && input.characterKindDetails.trim()) ? String(input.characterKindDetails).trim() : undefined,
  };
  return spec;
}

export function deriveLowResSpec(spec: CharacterSpec, raw?: { looks?: string; description?: string }): { name: string; ageYears: number; looks: string; description: string; characterKind?: string; characterKindDetails?: string } {
  const ageYears = Number.isFinite(spec.age as number) ? (spec.age as number) : 6;
  const looks = (raw?.looks && raw.looks.trim())
    || `${spec.name} with ${spec.traits.slice(0, 2).join(', ')} in ${spec.style}`.trim();
  const description = (raw?.description && raw.description.trim())
    || (spec.traits.length ? spec.traits.join(', ') : 'kind, friendly');
  return {
    name: spec.name,
    ageYears,
    looks,
    description,
    characterKind: (spec as any)?.characterKind,
    characterKindDetails: (spec as any)?.characterKindDetails,
  };
}

/**
 * Derive a CharacterBibleEntry using light heuristics from spec/profile/raw.
 */
export function deriveCharacterBibleEntry(
  spec: CharacterSpec,
  profile?: StyleProfile,
  raw?: { looks?: string; description?: string }
): CharacterBibleEntry {
  // Build a richer source string by including traits from spec/profile
  const parts: string[] = [
    String(spec.name || ''),
    String(raw?.looks || ''),
    String(raw?.description || ''),
    // Include optional user-provided character kind details to inform physical descriptors
    String((spec as any)?.characterKindDetails || ''),
  ];
  try {
    if (Array.isArray((spec as any)?.traits) && (spec as any).traits.length) {
      parts.push((spec as any).traits.join(' '));
    }
  } catch {}
  try {
    if (Array.isArray(profile?.traits) && profile!.traits.length) {
      parts.push(profile!.traits.join(' '));
    }
  } catch {}
  const source = parts.join(' ').toLowerCase();
  const knownSpecies = ['dog','cat','fox','rabbit','bear','elephant','giraffe','lion','tiger','bird','human','boy','girl','kid','child','baby','dinosaur','dragon'];
  const humanish = new Set(['boy','girl','kid','child','baby']);
  
  // Prefer explicit user-selected character kind when provided
  let species = String((spec as any)?.characterKind || '').trim().toLowerCase();
  if (species) {
    if (humanish.has(species)) species = 'human';
  } else {
    // Hardened token-based heuristic: avoid substring matches like "bearded" => "bear"
    const tokensSet = new Set(source.split(/[^a-z]+/).filter(Boolean));
    species = 'human';
    for (const s of knownSpecies) {
      if (tokensSet.has(s)) {
        species = humanish.has(s) ? 'human' : s;
        break;
      }
    }
  }
  if (/\bthe dog\b/.test(source)) species = 'dog';

  const tokens = (raw?.looks || '')
    .toLowerCase()
    .split(/[^a-z0-9#]+/)
    .filter(Boolean);

  const physicalKeywords = new Set<string>();
  const pushIf = (kw: string) => { if (kw) physicalKeywords.add(kw); };
  for (const t of tokens) {
    if (/(small|tiny|little|big|large|short|tall|long)/.test(t)) pushIf(t);
    if (/(brown|black|white|gray|grey|golden|spotted|striped|tan|cream|red|ginger)/.test(t)) pushIf(t);
  }
  if (/(floppy|pointy|round).*ear/.test((raw?.looks || '').toLowerCase())) physicalKeywords.add('floppy ears');
  if (/(long|short).*tail/.test((raw?.looks || '').toLowerCase())) physicalKeywords.add('short tail');

  if (/little\s+dog/.test(spec.name.toLowerCase())) {
    physicalKeywords.add('small');
    species = 'dog';
  }

  const physicalDescriptors = Array.from(physicalKeywords).slice(0, 6);
  const silhouetteMarkers: string[] = [];
  if ((raw?.looks || '').toLowerCase().includes('floppy')) silhouetteMarkers.push('floppy ears');
  if ((raw?.looks || '').toLowerCase().includes('round ears')) silhouetteMarkers.push('round ears');
  if ((raw?.looks || '').toLowerCase().includes('short tail')) silhouetteMarkers.push('short tail');

  const palette = (profile?.dominantPalette?.length ? profile.dominantPalette : spec.palette || []).slice(0, 6);
  const signatureProps: string[] = [];
  for (const a of profile?.attire || []) {
    if (/collar|scarf|hat|bow|bandana/i.test(a)) signatureProps.push(a);
  }
  if (/collar|scarf|hat|bow|bandana/i.test(raw?.description || '')) signatureProps.push('prop');

  const bible: CharacterBibleEntry = {
    species,
    physicalDescriptors,
    silhouetteMarkers,
    palette,
    signatureProps,
    name: spec.name,
  };
  return bible;
}

