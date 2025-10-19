import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { jsPDF } from 'jspdf';
import { Manifest, PageJSON } from '@/types/book';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id } = context.params;
    const ROOT = process.env.BOOKS_DATA_DIR ?? './data/book';
    const bookPath = path.join(ROOT, id);
    const manifestPath = path.join(bookPath, 'manifest.json');
    
    console.log('PDF API called for book:', id);
    console.log('Looking for manifest at:', manifestPath);
    
    // Read manifest
    const manifestContent = await readFile(manifestPath, 'utf8');
    const manifest: Manifest = JSON.parse(manifestContent);

    console.log('Manifest loaded:', manifest.title);

    // Create PDF document - 16:9 aspect ratio (11" x 6.1875")
    // Using landscape orientation for 16:9
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'in',
      format: [6.1875, 11] // 16:9 aspect ratio
    });

    let isFirstPage = true;

    // Add pages - just the images (they already have text composited in)
    for (const page of manifest.pages) {
      if (!isFirstPage) {
        doc.addPage();
      }
      isFirstPage = false;
      
      try {
        // Try to add image - fill the entire page
        try {
          const imagePath = path.join(bookPath, 'pages', String(page.pageIndex), 'page-print.jpg');
          const imageBuffer = await readFile(imagePath);
          const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
          
          // Add image to fill entire page (11" x 6.1875" for 16:9)
          doc.addImage(base64Image, 'JPEG', 0, 0, 11, 6.1875);
          
        } catch (imageError) {
          console.log(`Could not load image for page ${page.pageIndex}`);
          // Show page number if image fails
          doc.setFontSize(24);
          doc.text(`Page ${page.pageIndex}`, 5.5, 3.1, { align: 'center' });
        }
        
      } catch (pageError) {
        console.error(`Error loading page ${page.pageIndex}:`, pageError);
      }
    }

    // Generate PDF as ArrayBuffer
    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBuffer = Buffer.from(pdfArrayBuffer);
    
    console.log('PDF generated successfully, size:', pdfBuffer.length);

    // Return the PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${manifest.title.replace(/[^a-z0-9 ]/gi, '_')}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      }
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
