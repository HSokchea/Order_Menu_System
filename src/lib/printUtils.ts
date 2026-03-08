/**
 * Print utilities: hidden iframe printing & QZ Tray ESC/POS thermal printing.
 */

// ─── Hidden iframe silent print ───────────────────────────────────

const RECEIPT_PRINT_STYLES = `
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    width: 80mm;
    padding: 4mm;
    background: white;
    color: black;
  }
  .text-center { text-align: center; }
  .receipt-logo {
    display: block; margin: 0 auto; border-radius: 9999px;
    object-fit: cover; background: #fff; height: 48px; width: 48px;
  }
  .text-muted-foreground { color: #666; }
  .font-bold { font-weight: bold; }
  .font-semibold { font-weight: 600; }
  .font-medium { font-weight: 500; }
  .flex { display: flex; }
  .justify-between { justify-content: space-between; }
  .items-center { align-items: center; }
  .items-baseline { align-items: baseline; }
  .gap-2 { gap: 8px; }
  .space-y-1 > * + * { margin-top: 4px; }
  .space-y-1\\.5 > * + * { margin-top: 6px; }
  .space-y-2 > * + * { margin-top: 8px; }
  .space-y-4 > * + * { margin-top: 16px; }
  .mb-2 { margin-bottom: 8px; }
  .mb-4 { margin-bottom: 16px; }
  .mt-1\\.5 { margin-top: 6px; }
  .mt-2 { margin-top: 8px; }
  .mt-0\\.5 { margin-top: 2px; }
  .mt-6 { margin-top: 24px; }
  .pl-2 { padding-left: 8px; }
  .pl-3 { padding-left: 12px; }
  .pl-4 { padding-left: 16px; }
  .pt-1 { padding-top: 4px; }
  .pt-2 { padding-top: 8px; }
  .px-6 { padding-left: 24px; padding-right: 24px; }
  .py-8 { padding-top: 32px; padding-bottom: 32px; }
  .my-3 { margin-top: 12px; margin-bottom: 12px; }
  .my-4 { margin-top: 16px; margin-bottom: 16px; }
  .text-lg { font-size: 14px; }
  .text-xl { font-size: 16px; }
  .text-sm { font-size: 12px; }
  .text-xs { font-size: 10px; }
  .italic { font-style: italic; }
  .tabular-nums { font-variant-numeric: tabular-nums; }
  hr, [class*="separator"], [data-separator] {
    border: none; border-top: 1px dashed #000; margin: 8px 0;
  }
  .border-t { border-top: 1px dashed #000; }
  .border-dashed { border-style: dashed; }
  .text-green-600 { color: #16a34a; }
  .text-orange-600 { color: #ea580c; }
  svg { display: inline-block; vertical-align: middle; }
`;

/**
 * Print receipt content via a hidden iframe (no new tab/popup).
 * Falls back to window.open if iframe approach fails.
 */
export const printViaIframe = (
  receiptElement: HTMLElement,
  title: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const printContent = receiptElement.innerHTML;

      // Remove any existing print iframe
      const existingFrame = document.getElementById('receipt-print-frame');
      if (existingFrame) existingFrame.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'receipt-print-frame';
      iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:80mm;height:0;border:none;';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        iframe.remove();
        reject(new Error('Could not access iframe document'));
        return;
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <style>${RECEIPT_PRINT_STYLES}</style>
          </head>
          <body>${printContent}</body>
        </html>
      `);
      doc.close();

      // Wait for content to render, then print
      const win = iframe.contentWindow;
      if (!win) {
        iframe.remove();
        reject(new Error('Could not access iframe window'));
        return;
      }

      const cleanup = () => {
        setTimeout(() => {
          iframe.remove();
          resolve();
        }, 500);
      };

      // Use onafterprint if available, otherwise timeout fallback
      win.onafterprint = cleanup;

      setTimeout(() => {
        win.focus();
        win.print();

        // Fallback cleanup if onafterprint doesn't fire
        if (!('onafterprint' in win)) {
          cleanup();
        }
      }, 300);
    } catch (err) {
      reject(err);
    }
  });
};

// ─── QZ Tray ESC/POS thermal printing ────────────────────────────

let qzConnection: any = null;

/**
 * Connect to QZ Tray. Must be installed on the POS machine.
 * Download from: https://qz.io/download/
 */
export const connectQzTray = async (): Promise<boolean> => {
  try {
    const qz = await import('qz-tray');

    if (qzConnection && qz.default.websocket.isActive()) {
      return true;
    }

    // Skip certificate signing for local use (self-signed)
    qz.default.security.setCertificatePromise((resolve: any) => {
      resolve('');
    });
    qz.default.security.setSignaturePromise(() => (resolve: any) => {
      resolve('');
    });

    await qz.default.websocket.connect();
    qzConnection = qz.default;
    return true;
  } catch (err) {
    console.error('QZ Tray connection failed:', err);
    return false;
  }
};

/**
 * Get list of available printers via QZ Tray.
 */
export const getQzPrinters = async (): Promise<string[]> => {
  try {
    const qz = await import('qz-tray');
    if (!qz.default.websocket.isActive()) {
      const connected = await connectQzTray();
      if (!connected) return [];
    }
    return await qz.default.printers.find();
  } catch {
    return [];
  }
};

/**
 * Find the default/first available thermal printer.
 */
export const findThermalPrinter = async (): Promise<string | null> => {
  const printers = await getQzPrinters();
  // Common thermal printer name patterns
  const thermalKeywords = ['epson', 'star', 'thermal', 'receipt', 'pos', 'tm-', 'tsp', 'ct-s'];
  
  const thermal = printers.find(p =>
    thermalKeywords.some(k => p.toLowerCase().includes(k))
  );

  return thermal || printers[0] || null;
};

/**
 * Build ESC/POS commands from receipt session data.
 */
interface EscPosReceiptData {
  restaurantName: string;
  address?: string;
  phone?: string;
  vatTin?: string;
  invoiceNumber?: string;
  tableNumber: string;
  orderType?: string;
  startedAt: string;
  endedAt?: string | null;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    options?: Array<{ label: string; price: number }>;
  }>;
  subtotal: number;
  tax?: number;
  serviceCharge?: number;
  total: number;
  totalKhr?: number;
  isPaid: boolean;
  footerText?: string | null;
}

const ESC = '\x1B';
const GS = '\x1D';

const escPos = {
  init: `${ESC}@`,
  center: `${ESC}a\x01`,
  left: `${ESC}a\x00`,
  right: `${ESC}a\x02`,
  bold: (on: boolean) => `${ESC}E${on ? '\x01' : '\x00'}`,
  doubleHeight: (on: boolean) => `${ESC}!${on ? '\x10' : '\x00'}`,
  cut: `${GS}V\x00`,
  feed: (lines: number) => `${ESC}d${String.fromCharCode(lines)}`,
  line: (char: string, width: number) => char.repeat(width),
};

const padLine = (left: string, right: string, width = 42): string => {
  const gap = width - left.length - right.length;
  return left + ' '.repeat(Math.max(1, gap)) + right;
};

const formatMoney = (amount: number): string =>
  `$${amount.toFixed(2)}`;

export const buildEscPosReceipt = (data: EscPosReceiptData): string[] => {
  const W = 42; // 42 chars for 80mm paper
  const cmds: string[] = [escPos.init];

  // Header
  cmds.push(escPos.center);
  cmds.push(escPos.bold(true));
  cmds.push(escPos.doubleHeight(true));
  cmds.push(data.restaurantName);
  cmds.push(escPos.doubleHeight(false));
  cmds.push(escPos.bold(false));
  if (data.address) cmds.push(data.address);
  if (data.phone) cmds.push(`Tel: ${data.phone}`);
  if (data.vatTin) cmds.push(`VAT TIN: ${data.vatTin}`);
  cmds.push('');

  // Order info
  cmds.push(escPos.left);
  cmds.push(escPos.line('-', W));
  if (data.invoiceNumber) cmds.push(padLine('Invoice:', data.invoiceNumber, W));
  cmds.push(padLine('Table:', data.tableNumber, W));
  if (data.orderType) cmds.push(padLine('Type:', data.orderType, W));
  cmds.push(padLine('Date:', data.startedAt, W));
  cmds.push(escPos.line('-', W));

  // Items
  cmds.push(escPos.bold(true));
  cmds.push(padLine('ITEM', 'AMOUNT', W));
  cmds.push(escPos.bold(false));
  cmds.push(escPos.line('-', W));

  for (const item of data.items) {
    const itemTotal = item.price * item.quantity;
    const optTotal = (item.options || []).reduce((s, o) => s + o.price, 0) * item.quantity;
    cmds.push(padLine(`${item.quantity} x ${item.name}`, formatMoney(itemTotal + optTotal), W));
    if (item.options) {
      for (const opt of item.options) {
        cmds.push(`   - ${opt.label}${opt.price > 0 ? ` +${formatMoney(opt.price)}` : ''}`);
      }
    }
  }

  cmds.push(escPos.line('-', W));

  // Summary
  cmds.push(padLine('Subtotal:', formatMoney(data.subtotal), W));
  if (data.tax !== undefined && data.tax > 0) {
    cmds.push(padLine('Tax:', formatMoney(data.tax), W));
  }
  if (data.serviceCharge !== undefined && data.serviceCharge > 0) {
    cmds.push(padLine('Service Charge:', formatMoney(data.serviceCharge), W));
  }
  cmds.push(escPos.line('=', W));
  cmds.push(escPos.bold(true));
  cmds.push(padLine('TOTAL:', formatMoney(data.total), W));
  cmds.push(escPos.bold(false));
  if (data.totalKhr) {
    cmds.push(padLine('', `(${data.totalKhr.toLocaleString()} KHR)`, W));
  }
  cmds.push('');

  // Status
  cmds.push(escPos.center);
  cmds.push(escPos.bold(true));
  cmds.push(data.isPaid ? '*** PAID ***' : '*** UNPAID ***');
  cmds.push(escPos.bold(false));

  // Footer
  if (data.footerText) {
    cmds.push('');
    cmds.push(data.footerText);
  }
  cmds.push('');
  cmds.push('Thank you!');
  cmds.push(escPos.feed(4));
  cmds.push(escPos.cut);

  return cmds;
};

/**
 * Print ESC/POS receipt via QZ Tray to a thermal printer.
 */
export const printEscPos = async (
  data: EscPosReceiptData,
  printerName?: string
): Promise<void> => {
  const qz = await import('qz-tray');

  const connected = await connectQzTray();
  if (!connected) {
    throw new Error('QZ Tray is not running. Please install it from https://qz.io/download/');
  }

  const printer = printerName || await findThermalPrinter();
  if (!printer) {
    throw new Error('No printer found. Please connect a thermal printer.');
  }

  const config = qz.default.configs.create(printer);
  const commands = buildEscPosReceipt(data);

  await qz.default.print(config, [{
    type: 'raw',
    format: 'plain',
    data: commands.join('\n'),
  }]);
};
