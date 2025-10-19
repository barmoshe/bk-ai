/**
 * Example: Using the Professional Print System
 * 
 * This file demonstrates various ways to use the new professional
 * print and layout system. Copy patterns from here to your code.
 */

import { 
  renderPageJPEGPrintEnhanced,
  renderPageProfessional 
} from '../temporal/src/activities/render.activities';
import { 
  getPrintProfile,
  PRINT_PROFILES 
} from '../temporal/src/config/print-profiles';
import { 
  createRenderPipeline 
} from '../temporal/src/lib/render-pipeline';
import {
  FONT_STACKS,
  TypographyConfig
} from '../temporal/src/lib/typography';
import {
  optimalFontSize,
  goldenRatio,
  calculateSafeZones
} from '../temporal/src/lib/layout-grid';
import {
  getBookPaths,
  savePageRender
} from '../temporal/src/lib/fileSystem';
import { PageJSON, PrintSpec, PageLayoutPlan } from '../temporal/src/types';

// ============================================================================
// EXAMPLE 1: Simple Drop-in Replacement
// ============================================================================

async function example1_SimpleUpgrade(
  bookId: string,
  page: PageJSON,
  illustrationPath: string,
  printSpec: PrintSpec,
  layout: PageLayoutPlan
) {
  console.log('Example 1: Simple drop-in replacement');
  
  // OLD WAY:
  // const path = await renderPageJPEGPrint(bookId, page, illustrationPath, printSpec, layout);
  
  // NEW WAY: Just add profile ID
  const path = await renderPageJPEGPrintEnhanced(
    bookId,
    page,
    illustrationPath,
    printSpec,
    layout,
    'printOffice' // Choose profile: screen, proof, printOffice, printCommercial
  );
  
  console.log('✅ Rendered with professional quality:', path);
  return path;
}

// ============================================================================
// EXAMPLE 2: Multiple Output Targets
// ============================================================================

async function example2_MultipleTargets(
  bookId: string,
  page: PageJSON,
  illustrationPath: string,
  printSpec: PrintSpec,
  layout: PageLayoutPlan
) {
  console.log('Example 2: Generate screen, proof, and print versions');
  
  // Generate all three versions in one call
  const outputs = await renderPageProfessional(
    bookId,
    page,
    illustrationPath,
    printSpec,
    layout,
    ['screen', 'proof', 'print']
  );
  
  console.log('✅ Screen version (144dpi):', outputs.screen);
  console.log('✅ Proof version (150dpi):', outputs.proof);
  console.log('✅ Print version (300dpi):', outputs.print);
  
  return outputs;
}

// ============================================================================
// EXAMPLE 3: Commercial CMYK Printing
// ============================================================================

async function example3_CommercialPrint(
  bookId: string,
  page: PageJSON,
  illustrationPath: string,
  printSpec: PrintSpec,
  layout: PageLayoutPlan
) {
  console.log('Example 3: Commercial print with CMYK');
  
  // For sending to professional print house
  const path = await renderPageJPEGPrintEnhanced(
    bookId,
    page,
    illustrationPath,
    printSpec,
    layout,
    'printCommercial' // CMYK color space, 98% quality, 300dpi
  );
  
  console.log('✅ Ready for commercial printing:', path);
  console.log('   - 300 DPI');
  console.log('   - CMYK color space');
  console.log('   - 98% JPEG quality');
  console.log('   - Professional sharpening applied');
  
  return path;
}

// ============================================================================
// EXAMPLE 4: Custom Pipeline with Full Control
// ============================================================================

async function example4_CustomPipeline(
  bookId: string,
  pageIndex: number,
  text: string,
  illustrationBuffer: Buffer
) {
  console.log('Example 4: Full control with custom pipeline');
  
  // Define dimensions and margins
  const widthIn = 13.33;
  const heightIn = 7.5;
  const bleedIn = 0.125;
  const dpi = 300;
  
  const widthPx = Math.round((widthIn + 2 * bleedIn) * dpi);
  const heightPx = Math.round((heightIn + 2 * bleedIn) * dpi);
  const bleedPx = Math.round(bleedIn * dpi);
  const marginsPx = {
    top: Math.round(0.5 * dpi),
    right: Math.round(0.5 * dpi),
    bottom: Math.round(0.5 * dpi),
    left: Math.round(0.5 * dpi),
  };
  
  // Get or customize print profile
  const profile = getPrintProfile('printPremium');
  console.log('Using profile:', profile.name);
  
  // Create rendering pipeline
  const pipeline = createRenderPipeline(
    widthPx,
    heightPx,
    bleedPx,
    marginsPx,
    profile
  );
  
  // Calculate safe zones
  const safeZones = calculateSafeZones(widthPx, heightPx, bleedPx, marginsPx);
  console.log('Safe zone dimensions:', safeZones.safe);
  
  // Optimal font size for readability
  const fontSize = optimalFontSize(safeZones.safe.width);
  console.log('Optimal font size:', fontSize, 'px');
  
  // Custom typography configuration
  const typography: TypographyConfig = {
    fontFamily: FONT_STACKS.body,
    fontSize,
    fontWeight: 400,
    lineHeight: 1.3,
    textAlign: 'left',
    color: '#222222',
    openTypeFeatures: ['liga', 'kern'],
  };
  
  // Render the page
  const jpegBuffer = await pipeline.renderPage({
    text,
    illustrationBuffer,
    layoutStyle: 'imageTop',
    typographyConfig: typography,
    backgroundColor: '#ffffff',
  });
  
  // Save to file system
  const path = await savePageRender(bookId, pageIndex, 'print', jpegBuffer);
  
  console.log('✅ Custom render complete:', path);
  return { buffer: jpegBuffer, path };
}

// ============================================================================
// EXAMPLE 5: Using Layout Grid System
// ============================================================================

function example5_LayoutCalculations() {
  console.log('Example 5: Professional layout calculations');
  
  const contentWidth = 3600;  // pixels
  const contentHeight = 2025; // pixels
  
  // Use golden ratio for harmonious proportions
  const [smallerWidth, largerWidth] = goldenRatio(contentWidth);
  console.log('Golden ratio split:', { smallerWidth, largerWidth });
  console.log('Ratio check:', largerWidth / smallerWidth); // Should be ~1.618
  
  // Calculate optimal font size
  const fontSize = optimalFontSize(largerWidth);
  console.log('Optimal font size:', fontSize, 'px');
  console.log('This gives ~60 characters per line for readability');
  
  // Calculate safe zones
  const widthPx = 4000;
  const heightPx = 2250;
  const bleedPx = 38;  // 0.125" at 300dpi
  const marginsPx = { top: 150, right: 150, bottom: 150, left: 150 };
  
  const zones = calculateSafeZones(widthPx, heightPx, bleedPx, marginsPx);
  
  console.log('\nSafe Zones:');
  console.log('Full canvas (with bleed):', zones.full);
  console.log('Trim area (final size):', zones.trim);
  console.log('Safe area (inside margins):', zones.safe);
  console.log('Type-safe area (optimal for text):', zones.typeSafe);
}

// ============================================================================
// EXAMPLE 6: Exploring Print Profiles
// ============================================================================

function example6_ExploreProfiles() {
  console.log('Example 6: Available print profiles\n');
  
  // List all available profiles
  Object.entries(PRINT_PROFILES).forEach(([id, profile]) => {
    console.log(`\n📄 ${profile.name} (${id})`);
    console.log(`   DPI: ${profile.dpi}`);
    console.log(`   Color Space: ${profile.colorSpace}`);
    console.log(`   Quality: ${profile.quality}%`);
    console.log(`   Chroma: ${profile.chromaSubsampling}`);
    console.log(`   Sharpening: ${profile.sharpening}`);
    console.log(`   MozJPEG: ${profile.useMozjpeg ? 'Yes' : 'No'}`);
    if (profile.progressive) console.log(`   Progressive: Yes`);
    if (profile.iccProfilePath) console.log(`   ICC Profile: ${profile.iccProfilePath}`);
  });
  
  console.log('\n\n🎯 Recommended Profiles:');
  console.log('- Web display: "screen" or "webPreview"');
  console.log('- Home printing: "printOffice"');
  console.log('- Commercial printing: "printCommercial"');
  console.log('- Art books: "printPremium"');
}

// ============================================================================
// EXAMPLE 7: File System Organization
// ============================================================================

async function example7_FileOrganization(bookId: string) {
  console.log('Example 7: Understanding file organization');
  
  // Get all paths for a book
  const paths = getBookPaths(bookId);
  
  console.log('\nBook structure:');
  console.log('Root:', paths.root);
  console.log('Manifest:', paths.manifest);
  console.log('Print spec:', paths.printSpec);
  
  console.log('\nAsset directories:');
  console.log('Characters:', paths.assets.characters);
  console.log('Decorations:', paths.assets.decorations);
  console.log('Backgrounds:', paths.assets.backgrounds);
  
  console.log('\nPage 0 structure:');
  const page0 = paths.pages.page(0);
  console.log('Root:', page0.root);
  console.log('Layout:', page0.layout);
  console.log('Content:', page0.content);
  console.log('Illustration:', page0.illustration);
  
  console.log('\nRendered versions:');
  console.log('Screen (144dpi):', page0.renders.screen);
  console.log('Proof (150dpi):', page0.renders.proof);
  console.log('Print (300dpi):', page0.renders.print);
}

// ============================================================================
// EXAMPLE 8: Typography Showcase
// ============================================================================

function example8_TypographyShowcase() {
  console.log('Example 8: Professional typography features\n');
  
  const textWidth = 2400; // pixels
  
  // Optimal font size calculation
  const fontSize = optimalFontSize(textWidth, 60); // Target 60 chars/line
  console.log('Optimal font size:', fontSize, 'px');
  console.log('This ensures 45-75 characters per line for readability\n');
  
  // Font stacks for different contexts
  console.log('Professional font stacks:');
  console.log('Body text:', FONT_STACKS.body);
  console.log('Headings:', FONT_STACKS.heading);
  console.log('Serif:', FONT_STACKS.serif);
  console.log('Monospace:', FONT_STACKS.mono);
  
  console.log('\n✨ Automatic features:');
  console.log('✅ Kerning and letter spacing');
  console.log('✅ Widow and orphan control');
  console.log('✅ Optical margin alignment (hanging punctuation)');
  console.log('✅ OpenType ligatures (fi, fl, etc.)');
  console.log('✅ Balanced line breaks');
}

// ============================================================================
// MAIN: Run Examples
// ============================================================================

async function runExamples() {
  console.log('='.repeat(70));
  console.log('PROFESSIONAL PRINT SYSTEM - EXAMPLES');
  console.log('='.repeat(70));
  
  // Example 5: Layout calculations (no async)
  example5_LayoutCalculations();
  console.log('\n' + '='.repeat(70) + '\n');
  
  // Example 6: Explore profiles (no async)
  example6_ExploreProfiles();
  console.log('\n' + '='.repeat(70) + '\n');
  
  // Example 8: Typography showcase (no async)
  example8_TypographyShowcase();
  console.log('\n' + '='.repeat(70) + '\n');
  
  // Example 7: File organization (async, but safe to call)
  await example7_FileOrganization('example-book-id');
  console.log('\n' + '='.repeat(70) + '\n');
  
  console.log('\n✅ Examples complete!');
  console.log('\nFor actual rendering, call examples 1-4 with real page data.');
  console.log('See QUICK_START_PROFESSIONAL_PRINT.md for more details.');
}

// Export functions for use in tests or other files
export {
  example1_SimpleUpgrade,
  example2_MultipleTargets,
  example3_CommercialPrint,
  example4_CustomPipeline,
  example5_LayoutCalculations,
  example6_ExploreProfiles,
  example7_FileOrganization,
  example8_TypographyShowcase,
  runExamples,
};

// Run if executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

