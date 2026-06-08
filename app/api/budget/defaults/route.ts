import { getDefaultBudget, saveDefaultBudget } from '@/lib/googleSheets';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') ?? String(new Date().getFullYear());
  const budget = await getDefaultBudget(year);
  return Response.json(budget);
}

export async function PUT(request: Request) {
  const { year, budget } = await request.json() as { year: string; budget: Record<string, number> };
  await saveDefaultBudget(budget, year);
  return Response.json({ ok: true });
}
