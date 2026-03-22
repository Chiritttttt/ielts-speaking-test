import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionIds } = body;

    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '请选择要删除的记录'
      }, { status: 400 });
    }

    const result = await db.testSession.deleteMany({
      where: {
        id: { in: sessionIds }
      }
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count
    });
  } catch (error) {
    console.error('Batch delete error:', error);
    return NextResponse.json({
      success: false,
      error: '批量删除失败'
    }, { status: 500 });
  }
}
