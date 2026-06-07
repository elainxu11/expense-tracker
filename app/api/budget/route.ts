import { getBudget, saveBudget } from '@/lib/googleSheets';

export async function GET() {
  const budget = await getBudget();
  return Response.json(budget);
}

export async function PUT(request: Request) {
  const body = await request.json() as Record<string, number>;
  await saveBudget(body);
  return Response.json({ ok: true });
}
