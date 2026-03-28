import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * 获取所有题库列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeCount = searchParams.get('includeCount') === 'true';
    const type = searchParams.get('type'); // 筛选类型: general, exam-season
    const includeInactive = searchParams.get('includeInactive') === 'true'; // 是否包含禁用的题库

    const whereClause: any = {};
    if (!includeInactive) {
      whereClause.isActive = true;
    }
    if (type) {
      whereClause.type = type;
    }

    const pools = await db.questionPool.findMany({
      where: whereClause,
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // 如果需要包含题目数量，使用单次聚合查询优化
    let result = pools;
    if (includeCount) {
      // 使用单次查询获取所有题库的题目数量
      const allCounts = await db.questionBank.groupBy({
        by: ['poolId', 'partNumber'],
        where: { isActive: true },
        _count: true
      });

      // 将结果转换为 Map 以便快速查找
      const countMap = new Map<string, Record<number, number>>();
      for (const item of allCounts) {
        if (!item.poolId) continue;
        if (!countMap.has(item.poolId)) {
          countMap.set(item.poolId, { 1: 0, 2: 0, 3: 0 });
        }
        countMap.get(item.poolId)![item.partNumber] = item._count;
      }

      result = pools.map(pool => {
        const counts = countMap.get(pool.id) || { 1: 0, 2: 0, 3: 0 };
        return {
          ...pool,
          part1Count: counts[1],
          part2Count: counts[2],
          part3Count: counts[3],
          totalCount: counts[1] + counts[2] + counts[3]
        };
      });
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
    const { name, description, period, isDefault, source, type } = body;

    console.log('[Pool] Create request:', { name, description, period, isDefault, source, type });

    if (!name) {
      return NextResponse.json({
        success: false,
        error: '题库名称不能为空'
      }, { status: 400 });
    }

    // 如果设为默认，取消其他默认题库
    if (isDefault) {
      try {
        await db.questionPool.updateMany({
          where: { isDefault: true },
          data: { isDefault: false }
        });
      } catch (e) {
        console.log('[Pool] No existing default pool to update');
      }
    }

    const pool = await db.questionPool.create({
      data: {
        name,
        description: description || '',
        period: period || null,
        type: type || 'general', // 默认为一般题库
        isDefault: isDefault || false,
        source: source || 'ai'
      }
    });

    console.log('[Pool] Created successfully:', pool.id);

    return NextResponse.json({
      success: true,
      pool
    });
  } catch (error: any) {
    console.error('[Pool] Create error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '创建题库失败',
      details: error.code
    }, { status: 500 });
  }
}

/**
 * 更新题库
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, period, type, isActive, isDefault } = body;

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

    // 只更新提供的字段，忽略 undefined
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (period !== undefined) updateData.period = period;
    if (type !== undefined) updateData.type = type;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    const pool = await db.questionPool.update({
      where: { id },
      data: updateData
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
