
export type LabelField = {
  label?: string;
  value: string;
  monospace?: boolean;
};

export type PrintableLabel = {
  width: number;
  title?: string;
  qrCanvas?: HTMLCanvasElement;
  fields?: LabelField[];
};

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const lines: string[] = [];

  text.split('\n').forEach((paragraph) => {
    let line = '';

    const pushChunked = (token: string) => {
      let chunk = '';

      Array.from(token).forEach((char) => {
        if (ctx.measureText(chunk + char).width > maxWidth && chunk) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk += char;
        }
      });

      line = chunk;
    };

    paragraph.split(' ').forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;

      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        return;
      }

      if (line) {
        lines.push(line);
        line = '';
      }

      // A single token (a signature, say) that is wider than the label.
      if (ctx.measureText(word).width > maxWidth) {
        pushChunked(word);
      } else {
        line = word;
      }
    });

    lines.push(line);
  });

  return lines;
};

// Force every pixel to pure black or white
const binarize = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const image = ctx.getImageData(0, 0, width, height);
  const { data } = image;

  for (let i = 0; i < data.length; i += 4) {
    // Rec. 601 luma, then a mid threshold.
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const value = luma < 128 ? 0 : 255;

    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
};

const toPng = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Could not encode the label as a PNG'));
      }
    }, 'image/png');
  });

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.ceil(height);

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get a 2D canvas context to render the label');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  return { canvas, ctx };
};

export const renderPrintableLabel = async ({ width, title, qrCanvas, fields = [] }: PrintableLabel): Promise<Blob> => {
  if (!qrCanvas && fields.length === 0) {
    throw new Error('A label needs either a QR code or text');
  }

  const padding = Math.round(width * 0.04);
  const contentWidth = width - padding * 2;

  const titleFont = `bold ${Math.round(width * 0.05)}px sans-serif`;
  const labelFont = `bold ${Math.round(width * 0.032)}px sans-serif`;
  const valueFont = `${Math.round(width * 0.03)}px monospace`;

  const titleLineHeight = Math.round(width * 0.068);
  const labelLineHeight = Math.round(width * 0.045);
  const valueLineHeight = Math.round(width * 0.042);
  const fieldGap = Math.round(width * 0.03);

  const titleHeight = title ? titleLineHeight + padding / 2 : 0;

  // A QR-only label is square, so it drops into a square slot without the
  // mounting sheet having to absorb a variable height.
  if (qrCanvas) {
    const { canvas, ctx } = createCanvas(width, width);

    let y = padding;

    if (title) {
      ctx.font = titleFont;
      ctx.textAlign = 'center';
      ctx.fillText(title, width / 2, y);
      ctx.textAlign = 'left';
      y += titleHeight;
    }

    const qrSize = width - y - padding;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(qrCanvas, (width - qrSize) / 2, y, qrSize, qrSize);

    binarize(ctx, canvas.width, canvas.height);

    return toPng(canvas);
  }

  // Text labels are only as tall as their content, keeping them landscape.
  const measure = createCanvas(1, 1).ctx;

  const laidOut = fields.map((field) => {
    measure.font = field.monospace ? valueFont : labelFont;
    return { ...field, lines: wrapText(measure, field.value, contentWidth) };
  });

  const fieldsHeight = laidOut.reduce(
    (total, field, index) =>
      total +
      (field.label ? labelLineHeight : 0) +
      field.lines.length * valueLineHeight +
      (index < laidOut.length - 1 ? fieldGap : 0),
    0,
  );

  const { canvas, ctx } = createCanvas(width, padding + titleHeight + fieldsHeight + padding);

  let y = padding;

  if (title) {
    ctx.font = titleFont;
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, y);
    ctx.textAlign = 'left';
    y += titleHeight;
  }

  laidOut.forEach((field, index) => {
    if (field.label) {
      ctx.font = labelFont;
      ctx.fillText(field.label, padding, y);
      y += labelLineHeight;
    }

    ctx.font = field.monospace ? valueFont : labelFont;
    field.lines.forEach((line) => {
      ctx.fillText(line, padding, y);
      y += valueLineHeight;
    });

    if (index < laidOut.length - 1) {
      y += fieldGap;
    }
  });

  binarize(ctx, canvas.width, canvas.height);

  return toPng(canvas);
};
