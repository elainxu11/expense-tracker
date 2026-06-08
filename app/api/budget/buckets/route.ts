import { getBucketMapping, saveBucketMapping, BucketKey } from '@/lib/googleSheets';

export async function GET() {
  const mapping = await getBucketMapping();
  return Response.json(mapping);
}

export async function PUT(request: Request) {
  const mapping = await request.json() as Record<BucketKey, string[]>;
  await saveBucketMapping(mapping);
  return Response.json({ ok: true });
}
