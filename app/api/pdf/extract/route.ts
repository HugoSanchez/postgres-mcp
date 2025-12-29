import { NextResponse } from 'next/server';
import { Blob } from 'buffer';

// Node runtime required (not edge)
export const runtime = 'nodejs';

const TOKEN_URL =
  process.env.ADOBE_TOKEN_URL ?? 'https://ims-na1.adobelogin.com/ims/token/v3';
const CLIENT_ID = process.env.ADOBE_CLIENT_ID;
const CLIENT_SECRET = process.env.ADOBE_CLIENT_SECRET;
const SCOPES = process.env.ADOBE_SCOPES ?? 'openid,AdobeID,DCAPI';

/**
 * POST /api/pdf/extract
 * FormData: file (PDF)
 *
 * 1) Exchanges client credentials for an access token
 * 2) Calls Adobe PDF Services Extract API
 * 3) Returns the resulting ZIP (base64) so we can inspect structuredData.json
 *
 * This is for testing only; we don't store anything yet.
 */
export async function POST(request: Request) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'Missing ADOBE_CLIENT_ID or ADOBE_CLIENT_SECRET env vars' },
      { status: 500 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 },
      );
    }

    // Step 1: Get access token via client credentials
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: SCOPES,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return NextResponse.json(
        { error: 'Failed to obtain access token', detail: err },
        { status: 500 },
      );
    }

    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      return NextResponse.json(
        { error: 'No access_token in token response' },
        { status: 500 },
      );
    }

    const accessToken = tokenJson.access_token;

    // Step 2: Call Adobe Extract API
    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    const extractForm = new FormData();
    extractForm.append(
      'file',
      new Blob([pdfBuffer], { type: 'application/pdf' }),
      file.name,
    );
    // Configure extract options: text + tables
    extractForm.append(
      'params',
      JSON.stringify({
        elementsToExtract: ['text', 'tables'],
      }),
    );

    const extractRes = await fetch(
      'https://pdf-services.adobe.io/operation/extractpdf',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'x-api-key': CLIENT_ID,
          Accept: 'application/json',
        },
        body: extractForm,
      },
    );

    if (!extractRes.ok) {
      const err = await extractRes.text();
      return NextResponse.json(
        { error: 'Extract API failed', detail: err },
        { status: 500 },
      );
    }

    // Response is a ZIP (ArrayBuffer)
    const zipArrayBuffer = await extractRes.arrayBuffer();
    const zipBase64 = Buffer.from(zipArrayBuffer).toString('base64');

    return NextResponse.json(
      {
        message: 'OK',
        zipBase64,
        note: 'zipBase64 contains structuredData.json; decode and unzip to inspect.',
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Extract error', error);
    return NextResponse.json(
      {
        error: 'Unexpected error during extract',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

