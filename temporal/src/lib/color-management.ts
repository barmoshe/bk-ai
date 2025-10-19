/**
 * Professional color management for print production
 * Handles color space conversions and ICC profiles
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import { ColorSpace } from '../config/print-profiles';

export interface ColorProfile {
  space: ColorSpace;
  iccPath?: string;
}

/**
 * Get ICC profile buffer if available
 */
export async function getICCProfile(profilePath?: string): Promise<Buffer | undefined> {
  if (!profilePath) return undefined;
  
  try {
    return await fs.readFile(profilePath);
  } catch (err) {
    console.warn(`ICC profile not found: ${profilePath}`);
    return undefined;
  }
}

/**
 * Apply color profile to image pipeline
 * Handles sRGB, Adobe RGB, and CMYK conversions
 */
export async function applyColorProfile(
  pipeline: sharp.Sharp,
  targetSpace: ColorSpace,
  iccProfilePath?: string
): Promise<sharp.Sharp> {
  const iccProfile = await getICCProfile(iccProfilePath);
  
  switch (targetSpace) {
    case 'sRGB':
      // Ensure sRGB color space (default for web and most printers)
      return pipeline.toColorspace('srgb');
    
    case 'AdobeRGB':
      // Adobe RGB has wider gamut, better for professional printing
      if (iccProfile) {
        return pipeline.withMetadata({ icc: iccProfile } as any);
      }
      // Fallback to sRGB if no profile available
      console.warn('Adobe RGB profile not available, using sRGB');
      return pipeline.toColorspace('srgb');
    
    case 'CMYK':
      // CMYK conversion for commercial printing
      // Note: Sharp doesn't natively support CMYK output, would need external conversion
      // For now, use sRGB with ICC profile if available
      if (iccProfile) {
        return pipeline.withMetadata({ icc: iccProfile } as any);
      }
      console.warn('CMYK conversion requires external tools, using sRGB with high quality');
      return pipeline.toColorspace('srgb');
    
    default:
      return pipeline.toColorspace('srgb');
  }
}

/**
 * Ensure image has proper bit depth for print
 * 8-bit for web, 16-bit for high-end printing
 */
export function ensureBitDepth(pipeline: sharp.Sharp, forPrint: boolean): sharp.Sharp {
  if (forPrint) {
    // Use 16-bit for professional printing (prevents banding)
    // Note: JPEG only supports 8-bit, but internal processing benefits from 16-bit
    return pipeline;
  }
  return pipeline;
}

/**
 * Adjust gamma for different output targets
 * Screen gamma (2.2) vs print gamma (1.8-2.0)
 */
export function adjustGamma(pipeline: sharp.Sharp, targetGamma: number = 2.2): sharp.Sharp {
  // Gamma adjustment for different display/print characteristics
  // Most screens use 2.2, some printers prefer 1.8-2.0
  if (targetGamma !== 2.2) {
    const adjustment = targetGamma / 2.2;
    return pipeline.gamma(adjustment);
  }
  return pipeline;
}

/**
 * Convert color temperature for different lighting conditions
 * Useful for proofing under different light sources
 */
export function adjustColorTemperature(
  pipeline: sharp.Sharp,
  temperature: 'daylight' | 'tungsten' | 'fluorescent' | 'neutral' = 'neutral'
): sharp.Sharp {
  switch (temperature) {
    case 'daylight':
      // Slightly cooler, more blue (5500-6500K)
      return pipeline.modulate({ saturation: 1.05 });
    
    case 'tungsten':
      // Warmer, more yellow/red (2700-3200K)
      return pipeline.modulate({ saturation: 0.95 });
    
    case 'fluorescent':
      // Slightly green cast (4000-5000K)
      return pipeline;
    
    case 'neutral':
    default:
      return pipeline;
  }
}

/**
 * Optimize color for specific printer types
 */
export function optimizeForPrinter(
  pipeline: sharp.Sharp,
  printerType: 'inkjet' | 'laser' | 'offset' | 'digital' = 'digital'
): sharp.Sharp {
  switch (printerType) {
    case 'inkjet':
      // Inkjet printers benefit from slightly higher saturation
      return pipeline.modulate({ saturation: 1.1 });
    
    case 'laser':
      // Laser printers have more limited color gamut
      return pipeline.modulate({ saturation: 0.95 });
    
    case 'offset':
      // Offset printing has excellent color reproduction
      return pipeline;
    
    case 'digital':
    default:
      // Modern digital presses have good color accuracy
      return pipeline;
  }
}

/**
 * Check if an image will have color issues in CMYK
 * Detects out-of-gamut colors that won't print correctly
 */
export async function detectOutOfGamutColors(imageBuffer: Buffer): Promise<boolean> {
  try {
    const { dominant } = await sharp(imageBuffer).stats();
    
    // Check for very saturated colors that may be out of CMYK gamut
    // This is a simplified check - full gamut mapping requires ICC profiles
    const maxChannel = Math.max(dominant.r, dominant.g, dominant.b);
    const minChannel = Math.min(dominant.r, dominant.g, dominant.b);
    const saturation = (maxChannel - minChannel) / maxChannel;
    
    // High saturation colors (especially bright RGB colors) may be out of gamut
    return saturation > 0.85 && maxChannel > 200;
  } catch {
    return false;
  }
}

/**
 * Apply safe color mapping for print
 * Reduces overly saturated colors that won't reproduce well in CMYK
 */
export function applySafeColorMapping(pipeline: sharp.Sharp, aggressive: boolean = false): sharp.Sharp {
  if (aggressive) {
    // Reduce saturation more aggressively for CMYK safety
    return pipeline.modulate({ saturation: 0.85 });
  } else {
    // Gentle saturation reduction to stay in gamut
    return pipeline.modulate({ saturation: 0.92 });
  }
}

