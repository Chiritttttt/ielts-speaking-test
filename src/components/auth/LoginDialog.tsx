'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (user: { id: string; username: string; name?: string; role?: string; level?: string; status?: string; createdAt?: string; activatedAt?: string; expiresAt?: string }) => void;
  onSwitchToRegister: () => void;
}

export function LoginDialog({ open, onOpenChange, onSuccess, onSwitchToRegister }: LoginDialogProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      toast.error('请输入用户名和密码');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('登录成功');
        onSuccess(data.user);
        onOpenChange(false);
        setUsername('');
        setPassword('');
      } else {
        toast.error(data.error || '登录失败');
      }
    } catch (error) {
      toast.error('网络错误，请重试');
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#E31837]" />
            登录
          </DialogTitle>
          <DialogDescription>
            登录您的账号以保存练习记录
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="login-username">用户名</Label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="login-username"
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="login-password">密码</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="login-password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
                onSwitchToRegister();
              }}
              disabled={isLoading}
            >
              没有账号？去注册
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-[#E31837] hover:bg-[#C4142D]">
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              登录
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
