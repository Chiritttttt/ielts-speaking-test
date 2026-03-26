'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Shield, Users, Key, Plus, Trash2, Check, X, Clock,
  Copy, RefreshCw, ChevronLeft, AlertCircle, Loader2
} from 'lucide-react';

interface InviteCode {
  id: string;
  code: string;
  status: string;
  maxUses: number;
  usedCount: number;
  validDays: number | null;
  firstUsedAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  createdAt: string;
  createdBy?: { id: string; username: string; name?: string };
}

interface User {
  id: string;
  username: string;
  name?: string;
  email?: string;
  role: string;
  status: string;
  createdAt: string;
  testCount: number;
}

type TabType = 'invites' | 'users';

export default function AdminPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('invites');

  // 邀请码相关状态
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createCount, setCreateCount] = useState(1);
  const [createMaxUses, setCreateMaxUses] = useState(1);
  const [createValidDays, setCreateValidDays] = useState<number | ''>('');

  // 用户相关状态
  const [users, setUsers] = useState<User[]>([]);
  const [userFilter, setUserFilter] = useState<string>('pending');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);

  // 检查管理员权限
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();

      if (data.success && data.user?.role === 'admin') {
        setIsAuthorized(true);
        loadData();
      } else {
        setIsAuthorized(false);
        toast.error('您没有管理员权限');
        setTimeout(() => router.push('/'), 2000);
      }
    } catch (error) {
      setIsAuthorized(false);
      toast.error('请先登录');
      setTimeout(() => router.push('/'), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  // 加载数据
  const loadData = async () => {
    await Promise.all([loadInviteCodes(), loadUsers()]);
  };

  // 加载邀请码
  const loadInviteCodes = async () => {
    try {
      const response = await fetch('/api/invite');
      const data = await response.json();
      if (data.success) {
        setInviteCodes(data.codes);
      }
    } catch (error) {
      console.error('Load invite codes error:', error);
    }
  };

  // 加载用户
  const loadUsers = async (status?: string) => {
    try {
      const url = status && status !== 'all'
        ? `/api/admin/users?status=${status}`
        : '/api/admin/users';
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Load users error:', error);
    }
  };

  // 创建邀请码
  const createInviteCodes = async () => {
    try {
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: createCount,
          maxUses: createMaxUses,
          validDays: createValidDays || undefined
        })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        setShowCreateDialog(false);
        setCreateCount(1);
        setCreateMaxUses(1);
        setCreateValidDays('');
        loadInviteCodes();
      } else {
        toast.error(data.error || '创建失败');
      }
    } catch (error) {
      toast.error('创建失败');
    }
  };

  // 删除邀请码
  const deleteInviteCode = async (id: string) => {
    if (!confirm('确定要删除这个邀请码吗？')) return;

    try {
      const response = await fetch('/api/invite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('删除成功');
        loadInviteCodes();
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch (error) {
      toast.error('删除失败');
    }
  };

  // 复制邀请码
  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('已复制到剪贴板');
  };

  // 审批用户
  const approveUser = async (userId: string) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: 'approved' })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('已批准用户');
        loadUsers(userFilter === 'all' ? undefined : userFilter);
        setShowUserDialog(false);
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  // 拒绝用户
  const rejectUser = async (userId: string) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: 'rejected' })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('已拒绝用户');
        loadUsers(userFilter === 'all' ? undefined : userFilter);
        setShowUserDialog(false);
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  // 禁用用户
  const suspendUser = async (userId: string) => {
    if (!confirm('确定要禁用该用户吗？')) return;

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: 'suspended' })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('已禁用用户');
        loadUsers(userFilter === 'all' ? undefined : userFilter);
        setShowUserDialog(false);
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  // 删除用户
  const deleteUser = async (userId: string) => {
    if (!confirm('确定要删除该用户吗？此操作不可恢复！')) return;

    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('用户已删除');
        loadUsers(userFilter === 'all' ? undefined : userFilter);
        setShowUserDialog(false);
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 获取状态徽章样式
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      suspended: 'bg-gray-100 text-gray-800 border-gray-200',
      active: 'bg-green-100 text-green-800 border-green-200',
      used: 'bg-gray-100 text-gray-800 border-gray-200',
      disabled: 'bg-red-100 text-red-800 border-red-200',
      expired: 'bg-red-100 text-red-800 border-red-200'
    };
    const labels: Record<string, string> = {
      pending: '待审批',
      approved: '已批准',
      rejected: '已拒绝',
      suspended: '已禁用',
      active: '可用',
      used: '已使用',
      disabled: '已禁用',
      expired: '已过期'
    };
    return (
      <Badge className={styles[status] || 'bg-gray-100 text-gray-800'}>
        {labels[status] || status}
      </Badge>
    );
  };

  // 加载中
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#E31837]" />
          <span className="text-slate-600">正在验证权限...</span>
        </div>
      </div>
    );
  }

  // 无权限
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-800 mb-2">无访问权限</h2>
            <p className="text-slate-600">您没有管理员权限，正在跳转到首页...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="text-slate-600"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              返回首页
            </Button>
            <div className="w-px h-6 bg-slate-200" />
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#E31837]" />
              <h1 className="text-lg font-semibold text-slate-800">管理后台</h1>
            </div>
          </div>

          {/* Tab 切换 */}
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === 'invites' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('invites')}
              className={activeTab === 'invites' ? 'bg-[#E31837] hover:bg-[#c41430]' : ''}
            >
              <Key className="w-4 h-4 mr-2" />
              邀请码管理
            </Button>
            <Button
              variant={activeTab === 'users' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('users')}
              className={activeTab === 'users' ? 'bg-[#E31837] hover:bg-[#c41430]' : ''}
            >
              <Users className="w-4 h-4 mr-2" />
              用户审批
            </Button>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 邀请码管理 Tab */}
        {activeTab === 'invites' && (
          <div className="space-y-6">
            {/* 操作栏 */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">邀请码管理</h2>
                <p className="text-sm text-slate-500 mt-1">创建和管理邀请码，控制用户注册</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadInviteCodes}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  刷新
                </Button>
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="bg-[#E31837] hover:bg-[#c41430]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  创建邀请码
                </Button>
              </div>
            </div>

            {/* 邀请码列表 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">邀请码列表</CardTitle>
                <CardDescription>
                  共 {inviteCodes.length} 个邀请码
                </CardDescription>
              </CardHeader>
              <CardContent>
                {inviteCodes.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Key className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>暂无邀请码</p>
                    <p className="text-sm mt-1">点击上方按钮创建邀请码</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {inviteCodes.map((code) => (
                        <div
                          key={code.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <code className="px-3 py-1.5 bg-slate-100 rounded-md font-mono text-sm font-semibold text-slate-800">
                                {code.code}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => copyInviteCode(code.code)}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                            {getStatusBadge(code.expired ? 'expired' : code.status)}
                          </div>

                          <div className="flex items-center gap-6 text-sm text-slate-600">
                            <div className="text-center">
                              <p className="text-xs text-slate-400">使用次数</p>
                              <p className="font-medium">{code.usedCount}/{code.maxUses}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-slate-400">有效天数</p>
                              <p className="font-medium">{code.validDays || '永久'}</p>
                            </div>
                            {code.firstUsedAt && (
                              <div className="text-center">
                                <p className="text-xs text-slate-400">首次使用</p>
                                <p className="font-medium">{formatDate(code.firstUsedAt)}</p>
                              </div>
                            )}
                            {code.expiresAt && (
                              <div className="text-center">
                                <p className="text-xs text-slate-400">过期时间</p>
                                <p className={`font-medium ${code.expired ? 'text-red-500' : ''}`}>{formatDate(code.expiresAt)}</p>
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => deleteInviteCode(code.id)}
                              disabled={code.status === 'used'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* 用户审批 Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* 操作栏 */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">用户管理</h2>
                <p className="text-sm text-slate-500 mt-1">审批新用户注册，管理用户权限</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={userFilter}
                  onChange={(e) => {
                    setUserFilter(e.target.value);
                    loadUsers(e.target.value === 'all' ? undefined : e.target.value);
                  }}
                  className="px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
                >
                  <option value="pending">待审批</option>
                  <option value="approved">已批准</option>
                  <option value="rejected">已拒绝</option>
                  <option value="suspended">已禁用</option>
                  <option value="all">全部用户</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadUsers(userFilter === 'all' ? undefined : userFilter)}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  刷新
                </Button>
              </div>
            </div>

            {/* 用户列表 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">用户列表</CardTitle>
                <CardDescription>
                  共 {users.length} 个用户
                </CardDescription>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>暂无用户</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {users.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserDialog(true);
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                              <span className="text-sm font-medium text-slate-600">
                                {(user.name || user.username)?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{user.name || user.username}</p>
                              <p className="text-sm text-slate-500">@{user.username}</p>
                            </div>
                            {getStatusBadge(user.status)}
                          </div>

                          <div className="flex items-center gap-6 text-sm text-slate-600">
                            <div className="text-center">
                              <p className="text-xs text-slate-400">测试次数</p>
                              <p className="font-medium">{user.testCount}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-slate-400">注册时间</p>
                              <p className="font-medium">{formatDate(user.createdAt)}</p>
                            </div>
                            {user.status === 'pending' && (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    approveUser(user.id);
                                  }}
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  批准
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-200 text-red-600 hover:bg-red-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    rejectUser(user.id);
                                  }}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  拒绝
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* 创建邀请码对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建邀请码</DialogTitle>
            <DialogDescription>
              批量创建邀请码，用于控制用户注册
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="count">创建数量</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={100}
                value={createCount}
                onChange={(e) => setCreateCount(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-slate-500">一次最多创建 100 个邀请码</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxUses">每个邀请码可使用次数</Label>
              <Input
                id="maxUses"
                type="number"
                min={1}
                max={100}
                value={createMaxUses}
                onChange={(e) => setCreateMaxUses(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-slate-500">默认每个邀请码只能使用一次</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires">有效天数</Label>
              <Input
                id="expires"
                type="number"
                min={1}
                placeholder="留空表示永久有效"
                value={createValidDays}
                onChange={(e) => setCreateValidDays(e.target.value ? parseInt(e.target.value) : '')}
              />
              <p className="text-xs text-slate-500">从首次使用开始计算有效期</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button
              onClick={createInviteCodes}
              className="bg-[#E31837] hover:bg-[#c41430]"
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 用户详情对话框 */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>用户详情</DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center">
                  <span className="text-2xl font-medium text-slate-600">
                    {(selectedUser.name || selectedUser.username)?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-800">
                    {selectedUser.name || selectedUser.username}
                  </p>
                  <p className="text-slate-500">@{selectedUser.username}</p>
                  {getStatusBadge(selectedUser.status)}
                </div>
              </div>

              <hr className="border-slate-200" />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">邮箱</p>
                  <p className="font-medium">{selectedUser.email || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">角色</p>
                  <p className="font-medium">{selectedUser.role === 'admin' ? '管理员' : '普通用户'}</p>
                </div>
                <div>
                  <p className="text-slate-500">注册时间</p>
                  <p className="font-medium">{formatDate(selectedUser.createdAt)}</p>
                </div>
                <div>
                  <p className="text-slate-500">测试次数</p>
                  <p className="font-medium">{selectedUser.testCount}</p>
                </div>
              </div>

              <hr className="border-slate-200" />

              <div className="flex items-center gap-2">
                {selectedUser.status === 'pending' && (
                  <>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => approveUser(selectedUser.id)}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      批准用户
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => rejectUser(selectedUser.id)}
                    >
                      <X className="w-4 h-4 mr-2" />
                      拒绝
                    </Button>
                  </>
                )}
                {selectedUser.status === 'approved' && (
                  <Button
                    variant="outline"
                    className="flex-1 border-orange-200 text-orange-600 hover:bg-orange-50"
                    onClick={() => suspendUser(selectedUser.id)}
                  >
                    禁用用户
                  </Button>
                )}
                {selectedUser.status === 'suspended' && (
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => approveUser(selectedUser.id)}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    解除禁用
                  </Button>
                )}
                {selectedUser.status === 'rejected' && (
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => approveUser(selectedUser.id)}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    批准用户
                  </Button>
                )}
                {selectedUser.role !== 'admin' && (
                  <Button
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => deleteUser(selectedUser.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    删除
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
