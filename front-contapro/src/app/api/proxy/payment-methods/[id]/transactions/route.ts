import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get('limit') || '20';
  const upstream = await fetch(`${BASE}/api/payment-methods/${id}/transactions?limit=${limit}`, { headers: { cookie: cookieHeader } });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
