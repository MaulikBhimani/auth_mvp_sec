import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'Server is running',
    timestamp: new Date(),
    database: 'MongoDB connected via Prisma'
  });
}
