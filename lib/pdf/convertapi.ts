import JSZip from 'jszip';

interface ConvertApiFile {
  FileName?: string;
  FileExt?: string;
  FileData?: string;
  Url?: string;
}

interface ConvertApiResponse {
  Files?: ConvertApiFile[];
}

interface ConvertPdfOptions {
  wysiwyg?: boolean;
  ocrMode?: 'auto' | 'force' | 'never';
  ocrLanguage?: string;
}

const DEFAULT_BASE_URL = 'https://eu-v2.convertapi.com';

function getConvertApiConfig() {
  const token = process.env.CONVERT_API_TOKEN;
  if (!token) {
    throw new Error('Missing CONVERT_API_TOKEN environment variable');
  }

  return {
    token,
    baseUrl: process.env.CONVERT_API_BASE_URL || DEFAULT_BASE_URL,
  };
}

function isZipFile(file: ConvertApiFile, buffer: Buffer) {
  if (file.FileExt?.toLowerCase() === 'zip') return true;
  if (file.FileName?.toLowerCase().endsWith('.zip')) return true;
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

async function extractHtmlFromZip(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const htmlEntry = Object.values(zip.files).find((entry) =>
    entry.name.toLowerCase().endsWith('.html')
  );
  if (!htmlEntry) {
    throw new Error('No HTML file found in ConvertAPI zip output');
  }
  return htmlEntry.async('string');
}

export async function convertPdfToHtml(
  buffer: Buffer,
  filename: string,
  options: ConvertPdfOptions = {}
) {
  const { token, baseUrl } = getConvertApiConfig();

  const form = new FormData();
  form.append(
    'File',
    new Blob([buffer], { type: 'application/pdf' }),
    filename
  );
  form.append('StoreFile', 'false');
  form.append('Wysiwyg', options.wysiwyg === false ? 'false' : 'true');
  form.append('OcrMode', options.ocrMode ?? 'auto');
  if (options.ocrLanguage) {
    form.append('OcrLanguage', options.ocrLanguage);
  }

  const response = await fetch(`${baseUrl}/convert/pdf/to/html`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `ConvertAPI failed (${response.status}): ${body.slice(0, 500)}`
    );
  }

  const data = (await response.json()) as ConvertApiResponse;
  const file = data.Files?.[0];

  if (!file) {
    throw new Error('ConvertAPI returned no files');
  }

  if (file.FileData) {
    const buffer = Buffer.from(file.FileData, 'base64');
    if (isZipFile(file, buffer)) {
      return extractHtmlFromZip(buffer);
    }
    return buffer.toString('utf-8');
  }

  if (file.Url) {
    const htmlResponse = await fetch(file.Url);
    if (!htmlResponse.ok) {
      throw new Error('Failed to download ConvertAPI HTML output');
    }
    const contentType = htmlResponse.headers.get('content-type') || '';
    if (contentType.includes('zip')) {
      const zipBuffer = Buffer.from(await htmlResponse.arrayBuffer());
      return extractHtmlFromZip(zipBuffer);
    }
    return htmlResponse.text();
  }

  throw new Error('ConvertAPI response missing file data');
}
