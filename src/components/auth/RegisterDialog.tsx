'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, User, Lock, Ticket } from 'lucide-react';
import { toast } from 'sonner';

interface RegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (user: { id: string; username: string; name?: string; role?: string; status?: string; createdAt?: string }) => void;
  onSwitchToLogin: () => void;
}

export function RegisterDialog({ open, onOpenChange, onSuccess, onSwitchToLogin }: RegisterDialogProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      toast.error('请输入用户名和密码');
      return;
    }

    if (username.trim().length < 3) {
      toast.error('用户名至少需要3个字符');
      return;
    }

    if (password.length < 6) {
      toast.error('密码至少需要6个字符');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }

    if (!inviteCode.trim()) {
      toast.error('请输入邀请码');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: username.trim(), 
          password,
          name: name.trim() || undefined,
          inviteCode: inviteCode.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        if (data.isAdmin) {
          toast.success('管理员账号创建成功！');
        } else {
          toast.success('注册成功！');
        }
        onSuccess(data.user);
        onOpenChange(false);
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setName('');
        setInviteCode('');
      } else {
        toast.error(data.error || '注册失败');
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
            <UserPlus className="w-5 h-5 text-[#E31837]" />
            注册新账号
          </DialogTitle>
          <DialogDescription>
            需要邀请码才能注册
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="register-invite-code">邀请码 *</Label>
            <div className="relative mt-1">
              <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="register-invite-code"
                type="text"
                placeholder="请输入邀请码"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="pl-10 uppercase"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="register-username">用户名 *</Label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="register-username"
                type="text"
                placeholder="至少3个字符"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="register-name">昵称（可选）</Label>
            <Input
              id="register-name"
              type="text"
              placeholder="显示名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="register-password">密码 *</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="register-password"
                type="password"
                placeholder="至少6个字符"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="register-confirm-password">确认密码 *</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="register-confirm-password"
                type="password"
                placeholder="再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
                onSwitchToLogin();
              }}
              disabled={isLoading}
            >
              已有账号？去登录
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-[#E31837] hover:bg-[#C4142D]">
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              注册
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
