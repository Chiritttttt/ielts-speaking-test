import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * 获取所有题库列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeCount = searchParams.get('includeCount') === 'true';

    const pools = await db.questionPool.findMany({
      where: { isActive: true },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // 如果需要包含题目数量，重新计算
    let result = pools;
    if (includeCount) {
      const poolsWithCounts = await Promise.all(
        pools.map(async (pool) => {
          const counts = await db.questionBank.groupBy({
            by: ['partNumber'],
            where: { poolId: pool.id, isActive: true },
            _count: true
          });

          const part1Count = counts.find(c => c.partNumber === 1)?._count || 0;
          const part2Count = counts.find(c => c.partNumber === 2)?._count || 0;
          const part3Count = counts.find(c => c.partNumber === 3)?._count || 0;

          return {
            ...pool,
            part1Count,
            part2Count,
            part3Count,
            totalCount: part1Count + part2Count + part3Count
          };
        })
      );
      result = poolsWithCounts;
    }

    return NextResponse.json({
      success: true,
      pools: result
    });
  } catch (error) {
    console.error('[Pool] Get error:', error);
    return NextResponse.json({
      success: false,
      error: '获取题库失败'
    }, { status: 500 });
  }
}

/**
 * 创建新题库
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, period, isDefault, source } = body;

    if (!name) {
      return NextResponse.json({
        success: false,
        error: '题库名称不能为空'
      }, { status: 400 });
    }

    // 如果设为默认，取消其他默认题库
    if (isDefault) {
      await db.questionPool.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    const pool = await db.questionPool.create({
      data: {
        name,
        description,
        period,
        isDefault: isDefault || false,
        source: source || 'ai'
      }
    });

    return NextResponse.json({
      success: true,
      pool
    });
  } catch (error) {
    console.error('[Pool] Create error:', error);
    return NextResponse.json({
      success: false,
      error: '创建题库失败'
    }, { status: 500 });
  }
}

/**
 * 更新题库
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, period, isActive, isDefault } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '题库 ID 不能为空'
      }, { status: 400 });
    }

    // 如果设为默认，取消其他默认题库
    if (isDefault) {
      await db.questionPool.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false }
      });
    }

    const pool = await db.questionPool.update({
      where: { id },
      data: {
        name,
        description,
        period,
        isActive,
        isDefault
      }
    });

    return NextResponse.json({
      success: true,
      pool
    });
  } catch (error) {
    console.error('[Pool] Update error:', error);
    return NextResponse.json({
      success: false,
      error: '更新题库失败'
    }, { status: 500 });
  }
}

/**
 * 删除题库
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '题库 ID 不能为空'
      }, { status: 400 });
    }

    // 删除题库及其所有题目
    await db.questionBank.deleteMany({
      where: { poolId: id }
    });

    await db.questionPool.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('[Pool] Delete error:', error);
    return NextResponse.json({
      success: false,
      error: '删除题库失败'
    }, { status: 500 });
  }
}
