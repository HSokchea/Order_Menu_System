import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export type PaperSize = 'A6' | 'A5';
export type DownloadFormat = 'png' | 'pdf';

interface DownloadOptions {
  format: DownloadFormat;
  paperSize?: PaperSize;
  tableNumber: string;
  restaurantName: string;
}

// Paper sizes in mm
const PAPER_SIZES = {
  A6: { width: 105, height: 148 },
  A5: { width: 148, height: 210 },
};

export async function downloadQRCard(
  element: HTMLElement,
  options: DownloadOptions
): Promise<{ success: boolean; message: string }> {
  const { format, paperSize = 'A6', tableNumber, restaurantName } = options;
  
  try {
    // High-resolution canvas for quality output
    const canvas = await html2canvas(element, {
      scale: 3, // 3x for high resolution
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

    const fileName = tableNumber 
      ? `${restaurantName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-table-${tableNumber}`
      : `${restaurantName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-menu-qr`;

    if (format === 'png') {
      return downloadAsPNG(canvas, fileName);
    } else {
      return downloadAsPDF(canvas, fileName, paperSize);
    }
  } catch (error) {
    console.error('Error generating QR card:', error);
    return {
      success: false,
      message: 'Failed to generate QR card. Please try again.',
    };
  }
}

function downloadAsPNG(
  canvas: HTMLCanvasElement,
  fileName: string
): { success: boolean; message: string } {
  try {
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.download = `${fileName}-qr-card.png`;
    link.href = dataUrl;
    link.click();

    return {
      success: true,
      message: 'QR Card downloaded as PNG',
    };
  } catch (error) {
    console.error('Error downloading PNG:', error);
    return {
      success: false,
      message: 'Failed to download PNG',
    };
  }
}

function downloadAsPDF(
  canvas: HTMLCanvasElement,
  fileName: string,
  paperSize: PaperSize
): { success: boolean; message: string } {
  try {
    const { width: pageWidth, height: pageHeight } = PAPER_SIZES[paperSize];
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pageWidth, pageHeight],
    });

    // Calculate image dimensions to fit the page with margins
    const margin = 10; // 10mm margin
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const aspectRatio = imgWidth / imgHeight;

    let finalWidth = maxWidth;
    let finalHeight = finalWidth / aspectRatio;

    if (finalHeight > maxHeight) {
      finalHeight = maxHeight;
      finalWidth = finalHeight * aspectRatio;
    }

    // Center the image
    const x = (pageWidth - finalWidth) / 2;
    const y = (pageHeight - finalHeight) / 2;

    const imgData = canvas.toDataURL('image/png', 1.0);
    pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
    pdf.save(`${fileName}-qr-card-${paperSize}.pdf`);

    return {
      success: true,
      message: `QR Card downloaded as ${paperSize} PDF`,
    };
  } catch (error) {
    console.error('Error downloading PDF:', error);
    return {
      success: false,
      message: 'Failed to download PDF',
    };
  }
}
