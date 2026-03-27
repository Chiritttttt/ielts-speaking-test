'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * 管理后台重定向页面
 * 现在管理后台已整合到首页的盾牌按钮中
 */
export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();

        if (data.success && data.user?.role === 'admin') {
          // 是管理员，重定向到首页管理后台
          router.push('/?view=admin');
        } else {
          // 不是管理员，重定向到首页
          toast.error('您没有管理员权限');
          router.push('/');
        }
      } catch (error) {
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndRedirect();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#E31837]" />
          <span className="text-slate-600">正在跳转到管理后台...</span>
        </div>
      </div>
    );
  }

  return null;
}
