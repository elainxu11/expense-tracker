import { getVendorRules, upsertVendorRule, deleteVendorRule } from '@/lib/googleSheets';

export async function GET() {
  const rules = await getVendorRules();
  return Response.json({ rules });
}

export async function POST(request: Request) {
  try {
    const { pattern, normalized, matchType } = await request.json();
    if (!pattern?.trim() || !normalized?.trim()) {
      return Response.json({ error: 'Missing pattern or normalized name' }, { status: 400 });
    }
    await upsertVendorRule(pattern.trim(), normalized.trim(), matchType ?? 'prefix');
    return Response.json({ success: true });
  } catch (error) {
    console.error('Vendor rule upsert error:', error);
    return Response.json({ error: 'Failed to save rule' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { pattern } = await request.json();
    if (!pattern) return Response.json({ error: 'Missing pattern' }, { status: 400 });
    await deleteVendorRule(pattern);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Vendor rule delete error:', error);
    return Response.json({ error: 'Failed to delete rule' }, { status: 500 });
  }
}
