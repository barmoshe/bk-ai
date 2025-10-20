/**
 * Border Effects Library - Professional Grade
 * Advanced border styles for book page illustrations
 * 
 * Design Philosophy:
 * - Effects should enhance, not overpower the illustration
 * - Natural integration with the artwork
 * - Age-appropriate sophistication for children's books
 * - Print-quality rendering
 */

import sharp from 'sharp';

export type BorderEffectType =
  | 'none'
  | 'professionalFrame'
  | 'paintedEdge'
  | 'modernCard'
  | 'vintageFrame'
  | 'storybookCorners'
  | 'softVignette'
  | 'photoMatte'
  | 'tornPaper'
  | 'polaroid'
  | 'sketchDrawn'
  | 'comicBook'
  | 'neonGlow'
  | 'filmStrip';

export interface BorderEffectConfig {
  type: BorderEffectType;
  width?: number;
  color?: string;
  shadowOpacity?: number;
  shadowBlur?: number;
  cornerRadius?: number;
  intensity?: number;
}

export interface BorderEffectResult {
  illustrationBuffer: Buffer;
  shadowLayer?: { buffer: Buffer; offsetX?: number; offsetY?: number };
}

/**
 * No border effect - returns image as-is
 */
async function applyNone(illustrationBuffer: Buffer): Promise<BorderEffectResult> {
  return { illustrationBuffer };
}

/**
 * Professional Frame - Clean, timeless border with subtle depth
 * Perfect for: Classic storybooks, professional presentations
 */
async function applyProfessionalFrame(
  illustrationBuffer: Buffer,
  config: BorderEffectConfig
): Promise<BorderEffectResult> {
  const borderWidth = config.width || 6;
  const borderColor = config.color || '#1a1a1a';
  const shadowOpacity = config.shadowOpacity || 0.12;
  const shadowBlur = config.shadowBlur || 10;

  const meta = await sharp(illustrationBuffer).metadata();
  const width = meta.width!;
  const height = meta.height!;

  // Create elegant shadow with soft falloff
  const shadowSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="elegantShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="${shadowBlur}"/>
        <feOffset dx="0" dy="3" result="offsetblur"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="${shadowOpacity}"/>
        </feComponentTransfer>
      </filter>
    </defs>
    <rect x="${borderWidth}" y="${borderWidth}" 
          width="${width - borderWidth * 2}" 
          height="${height - borderWidth * 2}" 
          fill="black" filter="url(#elegantShadow)"/>
  </svg>`;

  const shadowLayer = await sharp(Buffer.from(shadowSvg))
    .resize(width, height)
    .png()
    .toBuffer();

  // Create refined frame with inner highlight for depth
  const frameSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Subtle gradient for frame depth -->
      <linearGradient id="frameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${borderColor};stop-opacity:1" />
        <stop offset="100%" style="stop-color:#2a2a2a;stop-opacity:1" />
      </linearGradient>
    </defs>
    
    <!-- Main frame -->
    <rect x="${borderWidth / 2}" y="${borderWidth / 2}" 
          width="${width - borderWidth}" 
          height="${height - borderWidth}" 
          fill="none" 
          stroke="url(#frameGrad)" 
          stroke-width="${borderWidth}"/>
    
    <!-- Inner highlight for dimension -->
    <rect x="${borderWidth}" y="${borderWidth}" 
          width="${width - borderWidth * 2}" 
          height="${height - borderWidth * 2}" 
          fill="none" 
          stroke="rgba(255,255,255,0.15)" 
          stroke-width="1"/>
  </svg>`;

  const frameOverlay = await sharp(Buffer.from(frameSvg)).png().toBuffer();

  const result = await sharp(illustrationBuffer)
    .composite([{ input: frameOverlay, blend: 'over' }])
    .png()
    .toBuffer();

  return {
    illustrationBuffer: result,
    shadowLayer: { buffer: shadowLayer },
  };
}

/**
 * Painted Edge - Organic watercolor edges with authentic brush texture
 * Perfect for: Watercolor illustrations, artistic books, whimsical stories
 */
async function applyPaintedEdge(
  illustrationBuffer: Buffer,
  config: BorderEffectConfig
): Promise<BorderEffectResult> {
  const edgeWidth = config.width || 18;
  const intensity = config.intensity || 0.55;

  const meta = await sharp(illustrationBuffer).metadata();
  const width = meta.width!;
  const height = meta.height!;

  // Create organic, paper-like edge mask with subtle variation
  const maskSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Primary rough edge texture -->
      <filter id="organicEdge" x="-30%" y="-30%" width="160%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="5" seed="123"/>
        <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="${18 * intensity}" 
                          xChannelSelector="R" yChannelSelector="G"/>
        <feGaussianBlur stdDeviation="0.8"/>
      </filter>
      
      <!-- Secondary texture for authenticity -->
      <filter id="paperTexture" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="456"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.08"/>
        </feComponentTransfer>
      </filter>
    </defs>
    
    <!-- Base mask with organic edges -->
    <rect x="${edgeWidth}" y="${edgeWidth}" 
          width="${width - edgeWidth * 2}" 
          height="${height - edgeWidth * 2}" 
          fill="white" filter="url(#organicEdge)"/>
  </svg>`;

  const mask = await sharp(Buffer.from(maskSvg))
    .resize(width, height)
    .toColorspace('b-w')
    .png()
    .toBuffer();

  // Apply organic edge mask
  const masked = await sharp(illustrationBuffer)
    .composite([{
      input: mask,
      blend: 'dest-in',
    }])
    .png()
    .toBuffer();

  // Add subtle paper texture to edges for depth
  const edgeDepthSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <mask id="edgeOnly">
        <rect x="0" y="0" width="${width}" height="${height}" fill="white"/>
        <rect x="${edgeWidth + 8}" y="${edgeWidth + 8}" 
              width="${width - (edgeWidth + 8) * 2}" 
              height="${height - (edgeWidth + 8) * 2}" 
              fill="black"/>
      </mask>
      <filter id="subtleTexture">
        <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
    </defs>
    <rect x="0" y="0" width="${width}" height="${height}" 
          fill="#4a4a4a" filter="url(#subtleTexture)" 
          mask="url(#edgeOnly)" opacity="0.18"/>
  </svg>`;

  const edgeDepth = await sharp(Buffer.from(edgeDepthSvg)).png().toBuffer();

  const result = await sharp(masked)
    .composite([{ input: edgeDepth, blend: 'multiply' }])
    .png()
    .toBuffer();

  return { illustrationBuffer: result };
}

/**
 * Modern Card - Contemporary design with elegant rounded corners and floating effect
 * Perfect for: Modern children's books, digital-first content, clean aesthetics
 */
async function applyModernCard(
  illustrationBuffer: Buffer,
  config: BorderEffectConfig
): Promise<BorderEffectResult> {
  const cornerRadius = config.cornerRadius || 24;
  const shadowOpacity = config.shadowOpacity || 0.18;
  const shadowBlur = config.shadowBlur || 24;

  const meta = await sharp(illustrationBuffer).metadata();
  const width = meta.width!;
  const height = meta.height!;

  // Create smooth rounded corner mask
  const maskSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${width}" height="${height}" 
          rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
  </svg>`;

  const mask = await sharp(Buffer.from(maskSvg)).png().toBuffer();

  // Apply rounded corners
  const rounded = await sharp(illustrationBuffer)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Create sophisticated multi-layer shadow (ambient + directional)
  const shadowSvg = `<svg width="${width + 60}" height="${height + 60}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Ambient shadow (soft, all around) -->
      <filter id="ambientShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="${shadowBlur}"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="${shadowOpacity * 0.6}"/>
        </feComponentTransfer>
      </filter>
      
      <!-- Directional shadow (stronger below) -->
      <filter id="directionalShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="${shadowBlur * 0.6}"/>
        <feOffset dx="0" dy="6" result="offsetblur"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="${shadowOpacity}"/>
        </feComponentTransfer>
      </filter>
    </defs>
    
    <!-- Ambient shadow layer -->
    <rect x="30" y="30" width="${width}" height="${height}" 
          rx="${cornerRadius}" ry="${cornerRadius}" 
          fill="black" filter="url(#ambientShadow)"/>
    
    <!-- Directional shadow layer -->
    <rect x="30" y="30" width="${width}" height="${height}" 
          rx="${cornerRadius}" ry="${cornerRadius}" 
          fill="black" filter="url(#directionalShadow)"/>
  </svg>`;

  const shadowLayer = await sharp(Buffer.from(shadowSvg)).png().toBuffer();

  // Add subtle inner glow for depth
  const innerGlowSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="innerGlow">
        <feGaussianBlur stdDeviation="3"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.5"/>
        </feComponentTransfer>
      </filter>
    </defs>
    <rect x="2" y="2" width="${width - 4}" height="${height - 4}" 
          rx="${cornerRadius - 2}" ry="${cornerRadius - 2}" 
          fill="none" stroke="white" stroke-width="2" 
          filter="url(#innerGlow)" opacity="0.4"/>
  </svg>`;

  const innerGlow = await sharp(Buffer.from(innerGlowSvg)).png().toBuffer();

  const result = await sharp(rounded)
    .composite([{ input: innerGlow, blend: 'over' }])
    .png()
    .toBuffer();

  return {
    illustrationBuffer: result,
    shadowLayer: { buffer: shadowLayer, offsetX: -30, offsetY: -30 },
  };
}

/**
 * Vintage Frame - Museum-quality ornate frame with aged patina
 * Perfect for: Classic fairy tales, timeless stories, elegant presentations
 */
async function applyVintageFrame(
  illustrationBuffer: Buffer,
  config: BorderEffectConfig
): Promise<BorderEffectResult> {
  const frameWidth = config.width || 24;
  const frameColor = config.color || '#8b7355';

  const meta = await sharp(illustrationBuffer).metadata();
  const imgWidth = meta.width!;
  const imgHeight = meta.height!;
  const totalWidth = imgWidth + frameWidth * 2;
  const totalHeight = imgHeight + frameWidth * 2;

  // Create museum-quality frame with depth and patina
  const frameSvg = `<svg width="${totalWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Aged wood grain texture -->
      <filter id="woodGrain">
        <feTurbulence type="fractalNoise" baseFrequency="0.6,0.02" numOctaves="5" seed="789"/>
        <feColorMatrix type="saturate" values="0.3"/>
        <feComponentTransfer>
          <feFuncR type="linear" slope="0.8" intercept="0.1"/>
          <feFuncG type="linear" slope="0.6" intercept="0.05"/>
          <feFuncB type="linear" slope="0.4" intercept="0.02"/>
          <feFuncA type="linear" slope="0.25"/>
        </feComponentTransfer>
      </filter>
      
      <!-- Vintage patina -->
      <filter id="patina">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="321"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.12"/>
        </feComponentTransfer>
      </filter>
      
      <!-- Frame shadow for depth -->
      <filter id="frameShadow">
        <feDropShadow dx="1" dy="2" stdDeviation="5" flood-color="#000000" flood-opacity="0.3"/>
      </filter>
      
      <!-- Inner bevel gradient -->
      <linearGradient id="bevelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#a0855f;stop-opacity:1" />
        <stop offset="50%" style="stop-color:${frameColor};stop-opacity:1" />
        <stop offset="100%" style="stop-color:#6d5842;stop-opacity:1" />
      </linearGradient>
    </defs>
    
    <!-- Outer frame with shadow -->
    <rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" 
          fill="url(#bevelGrad)" filter="url(#frameShadow)" rx="2" ry="2"/>
    
    <!-- Wood grain texture -->
    <rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" 
          fill="${frameColor}" filter="url(#woodGrain)" rx="2" ry="2"/>
    
    <!-- Inner cutout for image -->
    <rect x="${frameWidth}" y="${frameWidth}" 
          width="${imgWidth}" height="${imgHeight}" fill="white"/>
    
    <!-- Aged patina overlay -->
    <rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" 
          fill="#3a2f24" filter="url(#patina)" rx="2" ry="2"/>
    
    <!-- Inner bevel (highlight) -->
    <rect x="${frameWidth - 1}" y="${frameWidth - 1}" 
          width="${imgWidth + 2}" height="${imgHeight + 2}" 
          fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
    
    <!-- Inner bevel (shadow) -->
    <rect x="${frameWidth + 2}" y="${frameWidth + 2}" 
          width="${imgWidth - 4}" height="${imgHeight - 4}" 
          fill="none" stroke="rgba(0,0,0,0.2)" stroke-width="1"/>
    
    <!-- Decorative corner accents -->
    <circle cx="${frameWidth / 2}" cy="${frameWidth / 2}" r="3" fill="#a0855f" opacity="0.6"/>
    <circle cx="${totalWidth - frameWidth / 2}" cy="${frameWidth / 2}" r="3" fill="#a0855f" opacity="0.6"/>
    <circle cx="${frameWidth / 2}" cy="${totalHeight - frameWidth / 2}" r="3" fill="#a0855f" opacity="0.6"/>
    <circle cx="${totalWidth - frameWidth / 2}" cy="${totalHeight - frameWidth / 2}" r="3" fill="#a0855f" opacity="0.6"/>
  </svg>`;

  const frame = await sharp(Buffer.from(frameSvg)).png().toBuffer();

  // Composite image into frame
  const result = await sharp(frame)
    .composite([{
      input: illustrationBuffer,
      left: frameWidth,
      top: frameWidth,
    }])
    .png()
    .toBuffer();

  return { illustrationBuffer: result };
}

/**
 * Storybook Corners - Whimsical decorative corners with magical sparkle
 * Perfect for: Fantasy stories, magical adventures, playful narratives
 */
async function applyStorybookCorners(
  illustrationBuffer: Buffer,
  config: BorderEffectConfig
): Promise<BorderEffectResult> {
  const cornerSize = config.width || 55;
  const accentColor = config.color || '#e85d9a';

  const meta = await sharp(illustrationBuffer).metadata();
  const width = meta.width!;
  const height = meta.height!;

  // Create elegant, playful corner decorations
  const cornersSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Soft glow for magical effect -->
      <filter id="magicGlow">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      
      <!-- Gradient for depth -->
      <radialGradient id="cornerGrad">
        <stop offset="0%" style="stop-color:${accentColor};stop-opacity:1" />
        <stop offset="100%" style="stop-color:#c24d84;stop-opacity:1" />
      </radialGradient>
    </defs>
    
    <!-- Delicate border line -->
    <rect x="2" y="2" width="${width - 4}" height="${height - 4}" 
          fill="none" stroke="${accentColor}" stroke-width="1.5" opacity="0.25" rx="4" ry="4"/>
    
    <!-- Top-left corner flourish -->
    <path d="M 0 ${cornerSize * 0.9} 
             Q 0 ${cornerSize * 0.4} 0 0
             Q ${cornerSize * 0.4} 0 ${cornerSize * 0.9} 0
             L ${cornerSize * 0.9} 8
             Q ${cornerSize * 0.3} 8 8 8
             Q 8 ${cornerSize * 0.3} 8 ${cornerSize * 0.9}
             Z"
          fill="url(#cornerGrad)" filter="url(#magicGlow)" opacity="0.85"/>
    
    <!-- Decorative arc -->
    <path d="M 12 ${cornerSize * 0.7} Q 12 12 ${cornerSize * 0.7} 12"
          fill="none" stroke="white" stroke-width="2" opacity="0.4"/>
    
    <!-- Top-right corner flourish -->
    <path d="M ${width - cornerSize * 0.9} 0
             Q ${width - cornerSize * 0.4} 0 ${width} 0
             Q ${width} ${cornerSize * 0.4} ${width} ${cornerSize * 0.9}
             L ${width - 8} ${cornerSize * 0.9}
             Q ${width - 8} ${cornerSize * 0.3} ${width - 8} 8
             Q ${width - cornerSize * 0.3} 8 ${width - cornerSize * 0.9} 8
             Z"
          fill="url(#cornerGrad)" filter="url(#magicGlow)" opacity="0.85"/>
    
    <path d="M ${width - 12} ${cornerSize * 0.7} Q ${width - 12} 12 ${width - cornerSize * 0.7} 12"
          fill="none" stroke="white" stroke-width="2" opacity="0.4"/>
    
    <!-- Bottom-left corner flourish -->
    <path d="M 0 ${height - cornerSize * 0.9}
             Q 0 ${height - cornerSize * 0.4} 0 ${height}
             Q ${cornerSize * 0.4} ${height} ${cornerSize * 0.9} ${height}
             L ${cornerSize * 0.9} ${height - 8}
             Q ${cornerSize * 0.3} ${height - 8} 8 ${height - 8}
             Q 8 ${height - cornerSize * 0.3} 8 ${height - cornerSize * 0.9}
             Z"
          fill="url(#cornerGrad)" filter="url(#magicGlow)" opacity="0.85"/>
    
    <path d="M 12 ${height - cornerSize * 0.7} Q 12 ${height - 12} ${cornerSize * 0.7} ${height - 12}"
          fill="none" stroke="white" stroke-width="2" opacity="0.4"/>
    
    <!-- Bottom-right corner flourish -->
    <path d="M ${width - cornerSize * 0.9} ${height}
             Q ${width - cornerSize * 0.4} ${height} ${width} ${height}
             Q ${width} ${height - cornerSize * 0.4} ${width} ${height - cornerSize * 0.9}
             L ${width - 8} ${height - cornerSize * 0.9}
             Q ${width - 8} ${height - cornerSize * 0.3} ${width - 8} ${height - 8}
             Q ${width - cornerSize * 0.3} ${height - 8} ${width - cornerSize * 0.9} ${height - 8}
             Z"
          fill="url(#cornerGrad)" filter="url(#magicGlow)" opacity="0.85"/>
    
    <path d="M ${width - 12} ${height - cornerSize * 0.7} Q ${width - 12} ${height - 12} ${width - cornerSize * 0.7} ${height - 12}"
          fill="none" stroke="white" stroke-width="2" opacity="0.4"/>
    
    <!-- Magical sparkles at corner centers -->
    <g filter="url(#magicGlow)">
      <circle cx="${cornerSize * 0.45}" cy="${cornerSize * 0.45}" r="4" fill="white" opacity="0.9"/>
      <circle cx="${width - cornerSize * 0.45}" cy="${cornerSize * 0.45}" r="4" fill="white" opacity="0.9"/>
      <circle cx="${cornerSize * 0.45}" cy="${height - cornerSize * 0.45}" r="4" fill="white" opacity="0.9"/>
      <circle cx="${width - cornerSize * 0.45}" cy="${height - cornerSize * 0.45}" r="4" fill="white" opacity="0.9"/>
    </g>
    
    <!-- Tiny accent sparkles -->
    <circle cx="${cornerSize * 0.25}" cy="${cornerSize * 0.6}" r="2" fill="white" opacity="0.7"/>
    <circle cx="${cornerSize * 0.6}" cy="${cornerSize * 0.25}" r="2" fill="white" opacity="0.7"/>
    <circle cx="${width - cornerSize * 0.25}" cy="${cornerSize * 0.6}" r="2" fill="white" opacity="0.7"/>
    <circle cx="${width - cornerSize * 0.6}" cy="${cornerSize * 0.25}" r="2" fill="white" opacity="0.7"/>
    <circle cx="${cornerSize * 0.25}" cy="${height - cornerSize * 0.6}" r="2" fill="white" opacity="0.7"/>
    <circle cx="${cornerSize * 0.6}" cy="${height - cornerSize * 0.25}" r="2" fill="white" opacity="0.7"/>
    <circle cx="${width - cornerSize * 0.25}" cy="${height - cornerSize * 0.6}" r="2" fill="white" opacity="0.7"/>
    <circle cx="${width - cornerSize * 0.6}" cy="${height - cornerSize * 0.25}" r="2" fill="white" opacity="0.7"/>
  </svg>`;

  const corners = await sharp(Buffer.from(cornersSvg)).png().toBuffer();

  const result = await sharp(illustrationBuffer)
    .composite([{ input: corners, blend: 'over' }])
    .png()
    .toBuffer();

  return { illustrationBuffer: result };
}

/**
 * Soft Vignette - Subtle edge darkening for focus and depth (NEW)
 * Perfect for: Emotional moments, dramatic scenes, creating focal emphasis
 */
async function applySoftVignette(
  illustrationBuffer: Buffer,
  config: BorderEffectConfig
): Promise<BorderEffectResult> {
  const intensity = config.intensity || 0.35;

  const meta = await sharp(illustrationBuffer).metadata();
  const width = meta.width!;
  const height = meta.height!;

  // Create natural vignette effect
  const vignetteSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="vignette">
        <stop offset="40%" style="stop-color:white;stop-opacity:0" />
        <stop offset="75%" style="stop-color:black;stop-opacity:${intensity * 0.3}" />
        <stop offset="100%" style="stop-color:black;stop-opacity:${intensity}" />
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="${width}" height="${height}" fill="url(#vignette)"/>
  </svg>`;

  const vignette = await sharp(Buffer.from(vignetteSvg)).png().toBuffer();

  const result = await sharp(illustrationBuffer)
    .composite([{ input: vignette, blend: 'multiply' }])
    .png()
    .toBuffer();

  return { illustrationBuffer: result };
}

/**
 * Photo Matte - Clean white matte border like professional photo prints (NEW)
 * Perfect for: Clean presentations, gallery-style layouts, modern aesthetics
 */
async function applyPhotoMatte(
  illustrationBuffer: Buffer,
  config: BorderEffectConfig
): Promise<BorderEffectResult> {
  const matteWidth = config.width || 30;

  const meta = await sharp(illustrationBuffer).metadata();
  const imgWidth = meta.width!;
  const imgHeight = meta.height!;
  const totalWidth = imgWidth + matteWidth * 2;
  const totalHeight = imgHeight + matteWidth * 2;

  // Create museum-quality white matte
  const matteSvg = `<svg width="${totalWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Subtle paper texture -->
      <filter id="matteTexture">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="999"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.03"/>
        </feComponentTransfer>
      </filter>
      
      <!-- Soft shadow -->
      <filter id="matteShadow">
        <feDropShadow dx="0" dy="2" stdDeviation="8" flood-color="#000000" flood-opacity="0.08"/>
      </filter>
    </defs>
    
    <!-- White matte with shadow -->
    <rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" 
          fill="#fafafa" filter="url(#matteShadow)"/>
    
    <!-- Paper texture -->
    <rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" 
          fill="#f5f5f5" filter="url(#matteTexture)"/>
    
    <!-- Inner cutout -->
    <rect x="${matteWidth}" y="${matteWidth}" 
          width="${imgWidth}" height="${imgHeight}" fill="white"/>
    
    <!-- Subtle inner shadow for depth -->
    <rect x="${matteWidth + 1}" y="${matteWidth + 1}" 
          width="${imgWidth - 2}" height="${imgHeight - 2}" 
          fill="none" stroke="rgba(0,0,0,0.04)" stroke-width="1"/>
  </svg>`;

  const matte = await sharp(Buffer.from(matteSvg)).png().toBuffer();

  const result = await sharp(matte)
    .composite([{
      input: illustrationBuffer,
      left: matteWidth,
      top: matteWidth,
    }])
    .png()
    .toBuffer();

  return { illustrationBuffer: result };
}

/**
 * Torn Paper - Authentic hand-torn paper edges
 * Perfect for: Scrapbook style, DIY aesthetic, casual storytelling
 */
async function applyTornPaper(
  illustrationBuffer: Buffer,
  config: BorderEffectConfig
): Promise<BorderEffectResult> {
  const tearDepth = config.intensity || 0.7;

  const meta = await sharp(illustrationBuffer).metadata();
  const width = meta.width!;
  const height = meta.height!;

  // Create realistic torn paper edge
  const tornMaskSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Aggressive tear pattern -->
      <filter id="tornEdge" x="-30%" y="-30%" width="160%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="6" seed="777"/>
        <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="${35 * tearDepth}" 
                          xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      
      <!-- Paper fiber texture -->
      <filter id="paperFibers">
        <feTurbulence type="fractalNoise" baseFrequency="3" numOctaves="2"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.15"/>
        </feComponentTransfer>
      </filter>
    </defs>
    
    <!-- Torn mask -->
    <rect x="25" y="25" width="${width - 50}" height="${height - 50}" 
          fill="white" filter="url(#tornEdge)"/>
  </svg>`;

  const mask = await sharp(Buffer.from(tornMaskSvg))
    .resize(width, height)
    .toColorspace('b-w')
    .png()
    .toBuffer();

  // Apply torn mask
  const torn = await sharp(illustrationBuffer)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Add paper fiber texture to edges
  const fibersSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <mask id="edgeMask">
        <rect x="0" y="0" width="${width}" height="${height}" fill="white"/>
        <rect x="35" y="35" width="${width - 70}" height="${height - 70}" fill="black"/>
      </mask>
      <filter id="fiberTexture">
        <feTurbulence type="fractalNoise" baseFrequency="2.5" numOctaves="3"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
    </defs>
    <rect x="0" y="0" width="${width}" height="${height}" 
          fill="#e8e8e8" filter="url(#fiberTexture)" 
          mask="url(#edgeMask)" opacity="0.3"/>
  </svg>`;

  const fibers = await sharp(Buffer.from(fibersSvg)).png().toBuffer();

  const result = await sharp(torn)
    .composite([{ input: fibers, blend: 'multiply' }])
    .png()
    .toBuffer();

  return { illustrationBuffer: result };
}

/**
 * Polaroid - Instant camera photo style with signature bottom margin
 * Perfect for: Nostalgic stories, memory themes, retro aesthetics
 */
async function applyPolaroid(
  illustrationBuffer: Buffer,
  config: BorderEffectConfig
): Promise<BorderEffectResult> {
  const meta = await sharp(illustrationBuffer).metadata();
  const imgWidth = meta.width!;
  const imgHeight = meta.height!;
  
  // Polaroid proportions: narrow sides, wider bottom
  const sideMargin = 16;
  const topMargin = 16;
  const bottomMargin = 50; // Signature Polaroid bottom space
  
  const totalWidth = imgWidth + sideMargin * 2;
  const totalHeight = imgHeight + topMargin + bottomMargin;

  // Create iconic Polaroid frame
  const polaroidSvg = `<svg width="${totalWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Vintage photo finish -->
      <filter id="vintageFinish">
        <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.05"/>
        </feComponentTransfer>
      </filter>
      
      <!-- Soft shadow for floating effect -->
      <filter id="polaroidShadow">
        <feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="#000000" flood-opacity="0.2"/>
      </filter>
    </defs>
    
    <!-- White Polaroid frame with shadow -->
    <rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" 
          fill="#fafafa" filter="url(#polaroidShadow)" rx="2" ry="2"/>
    
    <!-- Vintage texture -->
    <rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" 
          fill="#f8f8f8" filter="url(#vintageFinish)" rx="2" ry="2"/>
    
    <!-- Image cutout -->
    <rect x="${sideMargin}" y="${topMargin}" 
          width="${imgWidth}" height="${imgHeight}" fill="white"/>
    
    <!-- Subtle inner shadow on photo area -->
    <rect x="${sideMargin + 1}" y="${topMargin + 1}" 
          width="${imgWidth - 2}" height="${imgHeight - 2}" 
          fill="none" stroke="rgba(0,0,0,0.05)" stroke-width="1"/>
  </svg>`;

  const frame = await sharp(Buffer.from(polaroidSvg)).png().toBuffer();

  const result = await sharp(frame)
    .composite([{
      input: illustrationBuffer,
      left: sideMargin,
      top: topMargin,
    }])
    .png()
    .toBuffer();

  return { illustrationBuffer: result };
}

/**
 * Sketch Drawn - Hand-drawn pencil sketch border
 * Perfect for: Artistic books, creative process themes, sketch-style illustrations
 */
async function applySketchDrawn(
  illustrationBuffer: Buffer,
  config: BorderEffectConfig
): Promise<BorderEffectResult> {
  const meta = await sharp(illustrationBuffer).metadata();
  const width = meta.width!;
  const height = meta.height!;

  // Create hand-drawn sketch border
  const sketchSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Sketchy line filter -->
      <filter id="sketchyLine">
        <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" seed="555"/>
        <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="2" 
                          xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      
      <!-- Pencil texture -->
      <filter id="pencilTexture">
        <feTurbulence type="fractalNoise" baseFrequency="2" numOctaves="3"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.4"/>
        </feComponentTransfer>
      </filter>
    </defs>
    
    <!-- Multiple sketchy lines for hand-drawn effect -->
    <rect x="8" y="8" width="${width - 16}" height="${height - 16}" 
          fill="none" stroke="#2a2a2a" stroke-width="2" 
          filter="url(#sketchyLine)" opacity="0.7"/>
    
    <rect x="10" y="10" width="${width - 20}" height="${height - 20}" 
          fill="none" stroke="#3a3a3a" stroke-width="1.5" 
          filter="url(#sketchyLine)" opacity="0.5"/>
    
    <rect x="7" y="7" width="${width - 14}" height="${height - 14}" 
          fill="none" stroke="#4a4a4a" stroke-width="1" 
          filter="url(#sketchyLine)" opacity="0.4"/>
    
    <!-- Pencil shading in corners -->
    <circle cx="15" cy="15" r="8" fill="#2a2a2a" 
            filter="url(#pencilTexture)" opacity="0.15"/>
    <circle cx="${width - 15}" cy="15" r="8" fill="#2a2a2a" 
            filter="url(#pencilTexture)" opacity="0.15"/>
    <circle cx="15" cy="${height - 15}" r="8" fill="#2a2a2a" 
            filter="url(#pencilTexture)" opacity="0.15"/>
    <circle cx="${width - 15}" cy="${height - 15}" r="8" fill="#2a2a2a" 
            filter="url(#pencilTexture)" opacity="0.15"/>
  </svg>`;

  const sketch = await sharp(Buffer.from(sketchSvg)).png().toBuffer();

  const result = await sharp(illustrationBuffer)
    .composite([{ input: sketch, blend: 'multiply' }])
    .png()
    .toBuffer();

  return { illustrationBuffer: result };
}

/**
 * Comic Book - Bold comic book panel style with halftone effects
 * Perfect for: Action stories, superhero themes, dynamic narratives
 */
async function applyComicBook(
  illustrationBuffer: Buffer,
  config: BorderEffectConfig
): Promise<BorderEffectResult> {
  const borderWidth = config.width || 10;
  const accentColor = config.color || '#ff0000';

  const meta = await sharp(illustrationBuffer).metadata();
  const width = meta.width!;
  const height = meta.height!;

  // Create bold comic panel border
  const comicSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Halftone pattern -->
      <pattern id="halftone" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="2" fill="${accentColor}" opacity="0.3"/>
      </pattern>
      
      <!-- Speed lines effect -->
      <pattern id="speedLines" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
        <line x1="0" y1="10" x2="20" y2="10" stroke="white" stroke-width="1" opacity="0.2"/>
      </pattern>
    </defs>
    
    <!-- Bold black border (outer) -->
    <rect x="0" y="0" width="${width}" height="${height}" 
          fill="black"/>
    
    <!-- White inner border -->
    <rect x="${borderWidth - 2}" y="${borderWidth - 2}" 
          width="${width - (borderWidth - 2) * 2}" 
          height="${height - (borderWidth - 2) * 2}" 
          fill="white"/>
    
    <!-- Colored accent border -->
    <rect x="${borderWidth}" y="${borderWidth}" 
          width="${width - borderWidth * 2}" 
          height="${height - borderWidth * 2}" 
          fill="white"/>
    
    <!-- Halftone effect on border -->
    <rect x="2" y="2" width="${borderWidth - 4}" height="${height - 4}" 
          fill="url(#halftone)"/>
    <rect x="${width - borderWidth + 2}" y="2" 
          width="${borderWidth - 4}" height="${height - 4}" 
          fill="url(#halftone)"/>
    <rect x="2" y="2" width="${width - 4}" height="${borderWidth - 4}" 
          fill="url(#halftone)"/>
    <rect x="2" y="${height - borderWidth + 2}" 
          width="${width - 4}" height="${borderWidth - 4}" 
          fill="url(#halftone)"/>
    
    <!-- Corner action bursts -->
    <path d="M ${borderWidth} 0 L ${borderWidth - 5} ${borderWidth - 5} L ${borderWidth} ${borderWidth} Z" 
          fill="${accentColor}"/>
    <path d="M ${width - borderWidth} 0 L ${width - borderWidth + 5} ${borderWidth - 5} L ${width - borderWidth} ${borderWidth} Z" 
          fill="${accentColor}"/>
    <path d="M ${borderWidth} ${height} L ${borderWidth - 5} ${height - borderWidth + 5} L ${borderWidth} ${height - borderWidth} Z" 
          fill="${accentColor}"/>
    <path d="M ${width - borderWidth} ${height} L ${width - borderWidth + 5} ${height - borderWidth + 5} L ${width - borderWidth} ${height - borderWidth} Z" 
          fill="${accentColor}"/>
  </svg>`;

  const comic = await sharp(Buffer.from(comicSvg)).png().toBuffer();

  const result = await sharp(illustrationBuffer)
    .composite([{ input: comic, blend: 'over' }])
    .png()
    .toBuffer();

  return { illustrationBuffer: result };
}

/**
 * Neon Glow - Vibrant glowing edges
 * Perfect for: Sci-fi stories, magical themes, energetic scenes
 */
async function applyNeonGlow(
  illustrationBuffer: Buffer,
  config: BorderEffectConfig
): Promise<BorderEffectResult> {
  const glowColor = config.color || '#00ffff';
  const intensity = config.intensity || 0.8;

  const meta = await sharp(illustrationBuffer).metadata();
  const width = meta.width!;
  const height = meta.height!;

  // Create neon glow effect
  const neonSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Multi-layer glow -->
      <filter id="neonGlow">
        <feGaussianBlur stdDeviation="8" result="blur1"/>
        <feGaussianBlur stdDeviation="4" result="blur2"/>
        <feGaussianBlur stdDeviation="2" result="blur3"/>
        <feMerge>
          <feMergeNode in="blur1"/>
          <feMergeNode in="blur2"/>
          <feMergeNode in="blur3"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      
      <!-- Animated energy (static snapshot) -->
      <filter id="energy">
        <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="888"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.3"/>
        </feComponentTransfer>
      </filter>
    </defs>
    
    <!-- Inner glow line -->
    <rect x="12" y="12" width="${width - 24}" height="${height - 24}" 
          fill="none" stroke="${glowColor}" stroke-width="3" 
          filter="url(#neonGlow)" opacity="${intensity}"/>
    
    <!-- Outer glow line -->
    <rect x="6" y="6" width="${width - 12}" height="${height - 12}" 
          fill="none" stroke="${glowColor}" stroke-width="2" 
          filter="url(#neonGlow)" opacity="${intensity * 0.7}"/>
    
    <!-- Energy sparkles -->
    <rect x="8" y="8" width="${width - 16}" height="${height - 16}" 
          fill="${glowColor}" filter="url(#energy)" opacity="0.2"/>
    
    <!-- Core bright line -->
    <rect x="12" y="12" width="${width - 24}" height="${height - 24}" 
          fill="none" stroke="white" stroke-width="1" opacity="${intensity * 0.5}"/>
  </svg>`;

  const neon = await sharp(Buffer.from(neonSvg)).png().toBuffer();

  const result = await sharp(illustrationBuffer)
    .composite([{ input: neon, blend: 'screen' }])
    .png()
    .toBuffer();

  return { illustrationBuffer: result };
}

/**
 * Film Strip - Classic movie film frame style
 * Perfect for: Cinema themes, animation stories, sequential narratives
 */
async function applyFilmStrip(
  illustrationBuffer: Buffer,
  config: BorderEffectConfig
): Promise<BorderEffectResult> {
  const meta = await sharp(illustrationBuffer).metadata();
  const imgWidth = meta.width!;
  const imgHeight = meta.height!;
  
  const sprocketWidth = 30;
  const totalWidth = imgWidth + sprocketWidth * 2;
  const totalHeight = imgHeight + 20; // Top and bottom margin

  // Create authentic film strip
  const filmSvg = `<svg width="${totalWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Film grain texture -->
      <filter id="filmGrain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.08"/>
        </feComponentTransfer>
      </filter>
    </defs>
    
    <!-- Black film base -->
    <rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="#1a1a1a"/>
    
    <!-- Film grain -->
    <rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" 
          fill="#0a0a0a" filter="url(#filmGrain)"/>
    
    <!-- Image area -->
    <rect x="${sprocketWidth}" y="10" 
          width="${imgWidth}" height="${imgHeight}" fill="white"/>
    
    <!-- Sprocket holes - Left side -->
    ${Array.from({ length: Math.floor(totalHeight / 40) }, (_, i) => {
      const y = 20 + i * 40;
      return `<rect x="8" y="${y}" width="14" height="20" fill="#000" rx="2" ry="2"/>`;
    }).join('\n    ')}
    
    <!-- Sprocket holes - Right side -->
    ${Array.from({ length: Math.floor(totalHeight / 40) }, (_, i) => {
      const y = 20 + i * 40;
      return `<rect x="${totalWidth - 22}" y="${y}" width="14" height="20" fill="#000" rx="2" ry="2"/>`;
    }).join('\n    ')}
    
    <!-- Frame numbers (top) -->
    <text x="${sprocketWidth + 10}" y="18" 
          font-family="monospace" font-size="10" fill="#888">FRAME 01</text>
    
    <!-- Time code (bottom) -->
    <text x="${sprocketWidth + imgWidth - 60}" y="${totalHeight - 6}" 
          font-family="monospace" font-size="8" fill="#666">00:00:01</text>
  </svg>`;

  const film = await sharp(Buffer.from(filmSvg)).png().toBuffer();

  const result = await sharp(film)
    .composite([{
      input: illustrationBuffer,
      left: sprocketWidth,
      top: 10,
    }])
    .png()
    .toBuffer();

  return { illustrationBuffer: result };
}

/**
 * Apply border effect to an illustration
 */
export async function applyBorderEffect(
  illustrationBuffer: Buffer,
  config: BorderEffectConfig
): Promise<BorderEffectResult> {
  switch (config.type) {
    case 'none':
      return applyNone(illustrationBuffer);
    case 'professionalFrame':
      return applyProfessionalFrame(illustrationBuffer, config);
    case 'paintedEdge':
      return applyPaintedEdge(illustrationBuffer, config);
    case 'modernCard':
      return applyModernCard(illustrationBuffer, config);
    case 'vintageFrame':
      return applyVintageFrame(illustrationBuffer, config);
    case 'storybookCorners':
      return applyStorybookCorners(illustrationBuffer, config);
    case 'softVignette':
      return applySoftVignette(illustrationBuffer, config);
    case 'photoMatte':
      return applyPhotoMatte(illustrationBuffer, config);
    case 'tornPaper':
      return applyTornPaper(illustrationBuffer, config);
    case 'polaroid':
      return applyPolaroid(illustrationBuffer, config);
    case 'sketchDrawn':
      return applySketchDrawn(illustrationBuffer, config);
    case 'comicBook':
      return applyComicBook(illustrationBuffer, config);
    case 'neonGlow':
      return applyNeonGlow(illustrationBuffer, config);
    case 'filmStrip':
      return applyFilmStrip(illustrationBuffer, config);
    default:
      return applyNone(illustrationBuffer);
  }
}

/**
 * Get default config for a border effect type
 */
export function getDefaultBorderConfig(type: BorderEffectType): BorderEffectConfig {
  const defaults: Record<BorderEffectType, BorderEffectConfig> = {
    none: { 
      type: 'none' 
    },
    professionalFrame: {
      type: 'professionalFrame',
      width: 6,
      color: '#1a1a1a',
      shadowOpacity: 0.12,
      shadowBlur: 10,
    },
    paintedEdge: {
      type: 'paintedEdge',
      width: 18,
      intensity: 0.55,
    },
    modernCard: {
      type: 'modernCard',
      cornerRadius: 24,
      shadowOpacity: 0.18,
      shadowBlur: 24,
    },
    vintageFrame: {
      type: 'vintageFrame',
      width: 24,
      color: '#8b7355',
    },
    storybookCorners: {
      type: 'storybookCorners',
      width: 55,
      color: '#e85d9a',
    },
    softVignette: {
      type: 'softVignette',
      intensity: 0.35,
    },
    photoMatte: {
      type: 'photoMatte',
      width: 30,
    },
    tornPaper: {
      type: 'tornPaper',
      intensity: 0.7,
    },
    polaroid: {
      type: 'polaroid',
    },
    sketchDrawn: {
      type: 'sketchDrawn',
    },
    comicBook: {
      type: 'comicBook',
      width: 10,
      color: '#ff0000',
    },
    neonGlow: {
      type: 'neonGlow',
      color: '#00ffff',
      intensity: 0.8,
    },
    filmStrip: {
      type: 'filmStrip',
    },
  };

  return defaults[type];
}
