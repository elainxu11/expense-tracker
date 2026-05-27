import { getSettings, saveCategories, saveCards } from '@/lib/googleSheets';

export async function GET() {
  const settings = await getSettings();
  return Response.json(settings);
}

export async function PUT(request: Request) {
  const body = await request.json() as { categories?: string[]; cards?: string[] };
  if (body.categories) await saveCategories(body.categories);
  if (body.cards) await saveCards(body.cards);
  return Response.json({ ok: true });
}
