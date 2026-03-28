import type { Metadata, Viewport } from "next";
import { Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "IELTS 口语练习",
  description: "专业雅思口语练习平台，AI 智能评估，个性化反馈",
  icons: {
    icon: "/favicon.png",
  },
};

// 版本检查脚本 - 在页面加载时立即执行
const versionCheckScript = `
(function() {
  // 检查 URL 是否已有版本参数
  const url = new URL(window.location.href);
  const hasVersionParam = url.searchParams.has('_v');
  
  if (!hasVersionParam) {
    // 获取当前构建版本（从 meta 标签或 localStorage）
    const storedVersion = localStorage.getItem('app_build_id');
    
    // 页面加载后检查版本
    window.addEventListener('load', function() {
      fetch('/api/version?' + Date.now())
        .then(r => r.json())
        .then(data => {
          const currentVersion = data.buildTime;
          
          // 如果 localStorage 有旧版本，且与当前不同，说明需要刷新
          if (storedVersion && storedVersion !== currentVersion) {
            console.log('[Version] Detected new version, refreshing...');
            localStorage.setItem('app_build_id', currentVersion);
            url.searchParams.set('_v', Date.now());
            window.location.href = url.toString();
            return;
          }
          
          // 保存当前版本
          localStorage.setItem('app_build_id', currentVersion);
        })
        .catch(err => console.warn('[Version] Check failed:', err));
    });
  }
  
  // 监听 Server Action 错误，自动刷新
  window.addEventListener('error', function(e) {
    if (e.message && e.message.includes('Server Action')) {
      console.log('[Error] Server Action error detected, refreshing...');
      const url = new URL(window.location.href);
      url.searchParams.set('_v', Date.now());
      window.location.href = url.toString();
    }
  });
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <script dangerouslySetInnerHTML={{ __html: versionCheckScript }} />
      </head>
      <body className={`${notoSansSC.variable} font-sans antialiased`}>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
