import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // 对于 HTML 页面，禁用缓存，确保用户总是获取最新版本
  if (request.headers.get('accept')?.includes('text/html')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }
  
  return response;
}

export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，除了：
     * - api 路由
     * - _next/static 文件
     * - _next/image 文件
     * - favicon.ico
     * - 图片文件
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
