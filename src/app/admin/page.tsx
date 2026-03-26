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
  Copy, RefreshCw, ChevronLeft, AlertCircle, Loader2,
  BarChart3, FileText, Play, Calendar, TrendingUp,
  LogIn, Globe, Monitor, LayoutDashboard, BookOpen,
  Megaphone, Settings, Eye, Edit
} from 'lucide-react';

// ==================== 类型定义 ====================
interface InviteCode {
  id: string;
  code: string;
  status: string;
  maxUses: number;
  usedCount: number;
  validDays: number | null;
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
  activatedAt?: string;
  expiresAt?: string;
  registeredIp?: string;
  testCount: number;
}

interface UserSession {
  id: string;
  testType: string;
  status: string;
  evaluationStatus: string;
  evaluationProgress: number;
  bandScore: number | null;
  totalScore: number | null;
  startedAt: string;
  completedAt: string | null;
  evaluatedAt: string | null;
  duration: number;
  responses: UserResponse[];
}

interface UserResponse {
  id: string;
  partNumber: number;
  questionText: string;
  transcription: string | null;
  overallScore: number | null;
  fluencyScore: number | null;
  vocabularyScore: number | null;
  grammarScore: number | null;
  pronunciationScore: number | null;
  feedback: string | null;
  duration: number | null;
}

interface UserStats {
  totalSessions: number;
  avgBandScore: number | null;
  maxBandScore: number | null;
  minBandScore: number | null;
  dailyStats: { date: string; count: number; avgScore: number | null }[];
}

interface LoginLog {
  id: string;
  userId: string | null;
  username: string;
  success: boolean;
  failReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface UsageStats {
  deepseek: { count: number; tokens: number };
  whisper: { count: number };
  tts: { count: number };
  byAction: Record<string, number>;
  byDate: Record<string, { deepseek: number; whisper: number; tts: number }>;
  totalCalls: number;
}

interface PlatformStats {
  userCount: number;
  activeUsers: number;
  sessionCount: number;
  todaySessions: number;
  questionCount: number;
}

interface Question {
  id: string;
  partNumber: number;
  category: string;
  questionText: string;
  difficulty: string;
  isActive: boolean;
  poolId?: string;
  pool?: { name: string };
  createdAt: string;
}

interface QuestionPool {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  part1Count: number;
  part2Count: number;
  part3Count: number;
  createdAt: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

type MainTab = 'dashboard' | 'users' | 'content' | 'stats';
type UsersTab = 'list' | 'detail' | 'invites';
type ContentTab = 'questions' | 'announcements';
type StatsTab = 'usage' | 'logs';

// ==================== 主组件 ====================
export default function AdminPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // 主 Tab
  const [mainTab, setMainTab] = useState<MainTab>('dashboard');
  
  // 子 Tab
  const [usersTab, setUsersTab] = useState<UsersTab>('list');
  const [contentTab, setContentTab] = useState<ContentTab>('questions');
  const [statsTab, setStatsTab] = useState<StatsTab>('usage');

  // ==================== 数据状态 ====================
  // 仪表盘
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // 用户管理
  const [users, setUsers] = useState<User[]>([]);
  const [userFilter, setUserFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);
  const [selectedSession, setSelectedSession] = useState<UserSession | null>(null);
  const [showSessionDialog, setShowSessionDialog] = useState(false);

  // 邀请码
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createCount, setCreateCount] = useState(1);
  const [createMaxUses, setCreateMaxUses] = useState(1);
  const [createValidDays, setCreateValidDays] = useState<number | ''>('');

  // 题库
  const [questionPools, setQuestionPools] = useState<QuestionPool[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionFilter, setQuestionFilter] = useState<{ part?: string; poolId?: string }>({});
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  // 题库管理相关
  const [showPoolDialog, setShowPoolDialog] = useState(false);
  const [editingPool, setEditingPool] = useState<QuestionPool | null>(null);
  const [poolForm, setPoolForm] = useState({ name: '', description: '', period: '' });
  const [viewingPoolId, setViewingPoolId] = useState<string | null>(null);
  const [contentSubTab, setContentSubTab] = useState<'pools' | 'questions'>('pools');

  // 公告
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', type: 'info', priority: 0 });

  // 登录日志
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [loginLogStats, setLoginLogStats] = useState<{ total: number; successCount: number; failedCount: number; todayLogins: number; todayFailed: number } | null>(null);
  const [loginLogFilter, setLoginLogFilter] = useState<string>('all');

  // 用量统计
  const [statsDays, setStatsDays] = useState<number>(7);

  // ==================== 初始化 ====================
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();

      if (data.success && data.user?.role === 'admin') {
        setIsAuthorized(true);
        loadDashboardData();
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

  // ==================== 数据加载函数 ====================
  const loadDashboardData = async () => {
    setDashboardLoading(true);
    try {
      const [usageRes, platformRes] = await Promise.all([
        fetch('/api/admin/usage?days=7'),
        fetch('/api/admin/usage?days=7')
      ]);
      const usageData = await usageRes.json();
      if (usageData.success) {
        setUsageStats(usageData.usage);
        setPlatformStats(usageData.platform);
      }
    } catch (error) {
      console.error('Load dashboard error:', error);
    } finally {
      setDashboardLoading(false);
    }
  };

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

  const loadUserDetail = async (userId: string) => {
    setLoadingUserDetail(true);
    try {
      const response = await fetch(`/api/admin/user-sessions?userId=${userId}`);
      const data = await response.json();
      if (data.success) {
        setViewingUser(data.user);
        setUserSessions(data.sessions);
        setUserStats(data.stats);
        setUsersTab('detail');
      } else {
        toast.error(data.error || '加载失败');
      }
    } catch (error) {
      console.error('Load user detail error:', error);
      toast.error('加载用户详情失败');
    } finally {
      setLoadingUserDetail(false);
    }
  };

  const loadQuestionPools = async () => {
    try {
      const response = await fetch('/api/pool?includeCount=true');
      const data = await response.json();
      if (data.success) {
        setQuestionPools(data.pools || []);
      }
    } catch (error) {
      console.error('Load pools error:', error);
    }
  };

  const loadQuestions = async (poolId?: string) => {
    try {
      const params = new URLSearchParams();
      if (questionFilter.part) params.append('part', questionFilter.part);
      if (poolId || questionFilter.poolId) params.append('poolId', poolId || questionFilter.poolId || '');
      
      const response = await fetch(`/api/questions?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setQuestions(data.questions || []);
      }
    } catch (error) {
      console.error('Load questions error:', error);
    }
  };

  // 题库操作
  const createPool = async () => {
    try {
      const response = await fetch('/api/pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(poolForm)
      });
      const data = await response.json();
      if (data.success) {
        toast.success('题库创建成功');
        setShowPoolDialog(false);
        setPoolForm({ name: '', description: '', period: '' });
        loadQuestionPools();
      } else {
        toast.error(data.error || '创建失败');
      }
    } catch (error) {
      toast.error('创建失败');
    }
  };

  const updatePool = async () => {
    if (!editingPool) return;
    try {
      const response = await fetch('/api/pool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingPool.id, ...poolForm })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('题库更新成功');
        setShowPoolDialog(false);
        setEditingPool(null);
        setPoolForm({ name: '', description: '', period: '' });
        loadQuestionPools();
      } else {
        toast.error(data.error || '更新失败');
      }
    } catch (error) {
      toast.error('更新失败');
    }
  };

  const deletePool = async (id: string) => {
    if (!confirm('确定要删除这个题库吗？题库中的所有题目也会被删除！')) return;
    try {
      const response = await fetch(`/api/pool?id=${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        toast.success('题库已删除');
        loadQuestionPools();
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch (error) {
      toast.error('删除失败');
    }
  };

  const setDefaultPool = async (id: string) => {
    try {
      const response = await fetch('/api/pool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isDefault: true })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('已设为默认题库');
        loadQuestionPools();
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  const togglePoolStatus = async (pool: QuestionPool) => {
    try {
      const response = await fetch('/api/pool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pool.id, isActive: !pool.isActive })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(pool.isActive ? '题库已禁用' : '题库已启用');
        loadQuestionPools();
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  const loadAnnouncements = async () => {
    try {
      const response = await fetch('/api/announcement');
      const data = await response.json();
      if (data.success) {
        setAnnouncements(data.announcements || []);
      }
    } catch (error) {
      console.error('Load announcements error:', error);
    }
  };

  const loadLoginLogs = async (success?: string) => {
    try {
      const url = success && success !== 'all'
        ? `/api/admin/login-logs?success=${success}`
        : '/api/admin/login-logs';
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setLoginLogs(data.logs);
        setLoginLogStats(data.stats);
      }
    } catch (error) {
      console.error('Load login logs error:', error);
    }
  };

  const loadUsageStats = async (days: number = 7) => {
    try {
      const response = await fetch(`/api/admin/usage?days=${days}`);
      const data = await response.json();
      if (data.success) {
        setUsageStats(data.usage);
        setPlatformStats(data.platform);
      }
    } catch (error) {
      console.error('Load usage stats error:', error);
    }
  };

  // ==================== 操作函数 ====================
  // 用户操作
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

  // 邀请码操作
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

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('已复制到剪贴板');
  };

  // 公告操作
  const saveAnnouncement = async () => {
    try {
      const method = editingAnnouncement ? 'PATCH' : 'POST';
      const body = editingAnnouncement 
        ? { id: editingAnnouncement.id, ...announcementForm }
        : announcementForm;
      
      const response = await fetch('/api/announcement', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (data.success) {
        toast.success(editingAnnouncement ? '公告已更新' : '公告已创建');
        setShowAnnouncementDialog(false);
        setEditingAnnouncement(null);
        setAnnouncementForm({ title: '', content: '', type: 'info', priority: 0 });
        loadAnnouncements();
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('确定要删除这个公告吗？')) return;
    try {
      const response = await fetch('/api/announcement', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('删除成功');
        loadAnnouncements();
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch (error) {
      toast.error('删除失败');
    }
  };

  // ==================== 工具函数 ====================
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

  const formatDateShort = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  const getEvaluationStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-600',
      evaluating: 'bg-blue-100 text-blue-600',
      completed: 'bg-green-100 text-green-600',
      failed: 'bg-red-100 text-red-600'
    };
    const labels: Record<string, string> = {
      pending: '待评估',
      evaluating: '评估中',
      completed: '已完成',
      failed: '失败'
    };
    return (
      <Badge variant="outline" className={styles[status] || 'bg-gray-100 text-gray-600'}>
        {labels[status] || status}
      </Badge>
    );
  };

  // ==================== 加载中状态 ====================
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

  // ==================== 主渲染 ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/')} className="text-slate-600">
              <ChevronLeft className="w-4 h-4 mr-1" />
              返回首页
            </Button>
            <div className="w-px h-6 bg-slate-200" />
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#E31837]" />
              <h1 className="text-lg font-semibold text-slate-800">管理后台</h1>
            </div>
          </div>

          {/* 主 Tab 切换 */}
          <div className="flex items-center gap-1">
            {[
              { key: 'dashboard', icon: LayoutDashboard, label: '仪表盘' },
              { key: 'users', icon: Users, label: '用户与邀请码' },
              { key: 'content', icon: BookOpen, label: '内容管理' },
              { key: 'stats', icon: BarChart3, label: '数据统计' },
            ].map(tab => (
              <Button
                key={tab.key}
                variant={mainTab === tab.key ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setMainTab(tab.key as MainTab);
                  if (tab.key === 'dashboard') loadDashboardData();
                  if (tab.key === 'users') { loadUsers(); loadInviteCodes(); }
                  if (tab.key === 'content') { loadQuestionPools(); loadQuestions(); loadAnnouncements(); }
                  if (tab.key === 'stats') { loadUsageStats(statsDays); loadLoginLogs(); }
                }}
                className={mainTab === tab.key ? 'bg-[#E31837] hover:bg-[#c41430]' : ''}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ==================== 仪表盘 ==================== */}
        {mainTab === 'dashboard' && (
          <div className="space-y-6">
            {/* 欢迎区 */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">欢迎回来，管理员</h2>
                <p className="text-slate-500 mt-1">这是您的平台运营概览</p>
              </div>
              <Button variant="outline" onClick={loadDashboardData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                刷新数据
              </Button>
            </div>

            {/* 核心指标 */}
            <div className="grid grid-cols-5 gap-4">
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setMainTab('users'); loadUsers(); }}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">总用户</p>
                      <p className="text-3xl font-bold">{platformStats?.userCount || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                      <Check className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">活跃用户</p>
                      <p className="text-3xl font-bold">{platformStats?.activeUsers || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">总测试</p>
                      <p className="text-3xl font-bold">{platformStats?.sessionCount || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">今日测试</p>
                      <p className="text-3xl font-bold">{platformStats?.todaySessions || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">API调用</p>
                      <p className="text-3xl font-bold">{usageStats?.totalCalls || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 快捷入口 */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setMainTab('users'); setUsersTab('invites'); loadInviteCodes(); }}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#E31837]/10 flex items-center justify-center">
                      <Plus className="w-5 h-5 text-[#E31837]" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">创建邀请码</p>
                      <p className="text-xs text-slate-500">快速生成邀请码</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setMainTab('users'); loadUsers(); }}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">用户管理</p>
                      <p className="text-xs text-slate-500">查看和管理用户</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setMainTab('content'); setContentTab('questions'); loadQuestions(); }}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">题库管理</p>
                      <p className="text-xs text-slate-500">管理口语题库</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setMainTab('content'); setContentTab('announcements'); loadAnnouncements(); }}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Megaphone className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">发布公告</p>
                      <p className="text-xs text-slate-500">发布平台公告</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* API 调用趋势 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">近7天 API 调用趋势</CardTitle>
              </CardHeader>
              <CardContent>
                {usageStats?.byDate && Object.keys(usageStats.byDate).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(usageStats.byDate)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([date, counts]) => {
                        const total = counts.deepseek + counts.whisper + counts.tts;
                        const maxTotal = Math.max(...Object.values(usageStats.byDate).map(c => c.deepseek + c.whisper + c.tts));
                        const percentage = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                        return (
                          <div key={date} className="flex items-center gap-4">
                            <span className="text-sm text-slate-500 w-24">{date}</span>
                            <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden relative">
                              <div className="absolute inset-y-0 left-0 bg-[#E31837]/80 rounded-full" style={{ width: `${percentage}%` }} />
                              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-slate-700">
                                {total} 次
                              </span>
                            </div>
                            <div className="flex gap-2 text-xs">
                              <span className="text-rose-600">DS:{counts.deepseek}</span>
                              <span className="text-teal-600">WH:{counts.whisper}</span>
                              <span className="text-orange-600">TTS:{counts.tts}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-8">暂无数据</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ==================== 用户与邀请码 ==================== */}
        {mainTab === 'users' && (
          <div className="space-y-6">
            {/* 子 Tab 切换 */}
            <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
              {usersTab === 'detail' && (
                <Button variant="ghost" size="sm" onClick={() => setUsersTab('list')} className="text-slate-600">
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  返回列表
                </Button>
              )}
              {[
                { key: 'list', icon: Users, label: '用户列表' },
                { key: 'invites', icon: Key, label: '邀请码管理' },
              ].map(tab => (
                <Button
                  key={tab.key}
                  variant={usersTab === tab.key ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setUsersTab(tab.key as UsersTab)}
                  className={usersTab === tab.key ? 'bg-[#E31837] hover:bg-[#c41430]' : ''}
                >
                  <tab.icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </Button>
              ))}
            </div>

            {/* 用户列表 */}
            {usersTab === 'list' && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-800">用户列表</h2>
                    <p className="text-sm text-slate-500 mt-1">管理平台用户</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={userFilter}
                      onChange={(e) => { setUserFilter(e.target.value); loadUsers(e.target.value === 'all' ? undefined : e.target.value); }}
                      className="px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
                    >
                      <option value="all">全部用户</option>
                      <option value="pending">待审批</option>
                      <option value="approved">已批准</option>
                      <option value="rejected">已拒绝</option>
                      <option value="suspended">已禁用</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={() => loadUsers(userFilter === 'all' ? undefined : userFilter)}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      刷新
                    </Button>
                  </div>
                </div>

                <Card>
                  <CardContent className="pt-6">
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
                              onClick={() => { setSelectedUser(user); setShowUserDialog(true); }}
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
                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => approveUser(user.id)}>
                                      <Check className="w-4 h-4 mr-1" />批准
                                    </Button>
                                    <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => rejectUser(user.id)}>
                                      <X className="w-4 h-4 mr-1" />拒绝
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
              </>
            )}

            {/* 用户详情 */}
            {usersTab === 'detail' && viewingUser && (
              <>
                {loadingUserDetail ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[#E31837]" />
                    <span className="ml-2 text-slate-600">加载中...</span>
                  </div>
                ) : (
                  <>
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center">
                              <span className="text-2xl font-medium text-slate-600">
                                {(viewingUser.name || viewingUser.username)?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <CardTitle className="text-xl">{viewingUser.name || viewingUser.username}</CardTitle>
                              <CardDescription>@{viewingUser.username}</CardDescription>
                              {getStatusBadge(viewingUser.status)}
                            </div>
                          </div>
                          <Button variant="outline" onClick={() => loadUserDetail(viewingUser.id)}>
                            <RefreshCw className="w-4 h-4 mr-2" />刷新
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-6 text-sm">
                          <div><p className="text-slate-500">邮箱</p><p className="font-medium">{viewingUser.email || '-'}</p></div>
                          <div><p className="text-slate-500">角色</p><p className="font-medium">{viewingUser.role === 'admin' ? '管理员' : '普通用户'}</p></div>
                          <div><p className="text-slate-500">注册时间</p><p className="font-medium">{formatDate(viewingUser.createdAt)}</p></div>
                          <div><p className="text-slate-500">激活时间</p><p className="font-medium">{formatDate(viewingUser.activatedAt)}</p></div>
                          <div><p className="text-slate-500">过期时间</p><p className={`font-medium ${viewingUser.expiresAt && new Date(viewingUser.expiresAt) < new Date() ? 'text-red-500' : ''}`}>{formatDate(viewingUser.expiresAt)}</p></div>
                          <div><p className="text-slate-500">注册 IP</p><p className="font-medium font-mono text-xs">{viewingUser.registeredIp || '-'}</p></div>
                          <div><p className="text-slate-500">测试次数</p><p className="font-medium">{viewingUser.testCount}</p></div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-4 gap-4">
                      <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><FileText className="w-5 h-5 text-blue-600" /></div><div><p className="text-sm text-slate-500">总测试次数</p><p className="text-2xl font-bold">{userStats?.totalSessions || 0}</p></div></div></CardContent></Card>
                      <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-green-600" /></div><div><p className="text-sm text-slate-500">平均分数</p><p className="text-2xl font-bold">{userStats?.avgBandScore?.toFixed(1) || '-'}</p></div></div></CardContent></Card>
                      <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-amber-600" /></div><div><p className="text-sm text-slate-500">最高分数</p><p className="text-2xl font-bold">{userStats?.maxBandScore?.toFixed(1) || '-'}</p></div></div></CardContent></Card>
                      <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center"><Calendar className="w-5 h-5 text-purple-600" /></div><div><p className="text-sm text-slate-500">近期活跃</p><p className="text-2xl font-bold">{userStats?.dailyStats?.length || 0}<span className="text-sm font-normal text-slate-500"> 天</span></p></div></div></CardContent></Card>
                    </div>

                    <Card>
                      <CardHeader><CardTitle className="text-base">练习记录</CardTitle><CardDescription>共 {userSessions.length} 条记录</CardDescription></CardHeader>
                      <CardContent>
                        {userSessions.length === 0 ? (
                          <div className="text-center py-8 text-slate-500"><Play className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>暂无练习记录</p></div>
                        ) : (
                          <ScrollArea className="h-[400px]">
                            <div className="space-y-3">
                              {userSessions.map((session) => (
                                <div key={session.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => { setSelectedSession(session); setShowSessionDialog(true); }}>
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-[#E31837]/10 flex items-center justify-center"><Play className="w-5 h-5 text-[#E31837]" /></div>
                                    <div>
                                      <p className="font-medium text-slate-800">{session.testType === 'full' ? '完整测试' : `Part ${session.testType}`}</p>
                                      <p className="text-sm text-slate-500">{formatDateShort(session.startedAt)}</p>
                                    </div>
                                    {getEvaluationStatusBadge(session.evaluationStatus)}
                                  </div>
                                  <div className="flex items-center gap-6 text-sm text-slate-600">
                                    <div className="text-center"><p className="text-xs text-slate-400">分数</p><p className="font-medium text-lg">{session.bandScore ? session.bandScore.toFixed(1) : '-'}</p></div>
                                    <div className="text-center"><p className="text-xs text-slate-400">时长</p><p className="font-medium">{formatDuration(session.duration)}</p></div>
                                    <div className="text-center"><p className="text-xs text-slate-400">题目数</p><p className="font-medium">{session.responses.length}</p></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </>
            )}

            {/* 邀请码管理 */}
            {usersTab === 'invites' && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-800">邀请码管理</h2>
                    <p className="text-sm text-slate-500 mt-1">创建和管理邀请码</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadInviteCodes}><RefreshCw className="w-4 h-4 mr-2" />刷新</Button>
                    <Button onClick={() => setShowCreateDialog(true)} className="bg-[#E31837] hover:bg-[#c41430]"><Plus className="w-4 h-4 mr-2" />创建邀请码</Button>
                  </div>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-base">邀请码列表</CardTitle><CardDescription>共 {inviteCodes.length} 个邀请码</CardDescription></CardHeader>
                  <CardContent>
                    {inviteCodes.length === 0 ? (
                      <div className="text-center py-8 text-slate-500"><Key className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>暂无邀请码</p></div>
                    ) : (
                      <ScrollArea className="h-[500px]">
                        <div className="space-y-3">
                          {inviteCodes.map((code) => (
                            <div key={code.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <code className="px-3 py-1.5 bg-slate-100 rounded-md font-mono text-sm font-semibold">{code.code}</code>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyInviteCode(code.code)}><Copy className="w-4 h-4" /></Button>
                                </div>
                                {getStatusBadge(code.status)}
                              </div>
                              <div className="flex items-center gap-6 text-sm text-slate-600">
                                <div className="text-center"><p className="text-xs text-slate-400">使用次数</p><p className="font-medium">{code.usedCount}/{code.maxUses}</p></div>
                                <div className="text-center"><p className="text-xs text-slate-400">每人有效天数</p><p className="font-medium">{code.validDays || '永久'}</p></div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteInviteCode(code.id)} disabled={code.status === 'used'}><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ==================== 内容管理 ==================== */}
        {mainTab === 'content' && (
          <div className="space-y-6">
            {/* 子 Tab 切换 */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
              {[
                { key: 'questions', icon: BookOpen, label: '题库管理' },
                { key: 'announcements', icon: Megaphone, label: '公告管理' },
              ].map(tab => (
                <Button
                  key={tab.key}
                  variant={contentTab === tab.key ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setContentTab(tab.key as ContentTab)}
                  className={contentTab === tab.key ? 'bg-[#E31837] hover:bg-[#c41430]' : ''}
                >
                  <tab.icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </Button>
              ))}
            </div>

            {/* 题库管理 */}
            {contentTab === 'questions' && (
              <>
                {/* 子 Tab 切换 */}
                <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
                  {[
                    { key: 'pools', icon: BookOpen, label: '题库列表' },
                    { key: 'all-questions', icon: FileText, label: '所有题目' },
                  ].map(tab => (
                    <Button
                      key={tab.key}
                      variant={contentSubTab === tab.key ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setContentSubTab(tab.key as 'pools' | 'questions')}
                      className={contentSubTab === tab.key ? 'bg-[#E31837] hover:bg-[#c41430]' : ''}
                    >
                      <tab.icon className="w-4 h-4 mr-2" />
                      {tab.label}
                    </Button>
                  ))}
                </div>

                {/* 题库列表 */}
                {contentSubTab === 'pools' && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-semibold text-slate-800">题库列表</h2>
                        <p className="text-sm text-slate-500 mt-1">管理口语题库，可创建、编辑、删除题库</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={loadQuestionPools}>
                          <RefreshCw className="w-4 h-4 mr-2" />刷新
                        </Button>
                        <Button 
                          onClick={() => { 
                            setEditingPool(null); 
                            setPoolForm({ name: '', description: '', period: '' }); 
                            setShowPoolDialog(true); 
                          }} 
                          className="bg-[#E31837] hover:bg-[#c41430]"
                        >
                          <Plus className="w-4 h-4 mr-2" />新增题库
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      {questionPools.length === 0 ? (
                        <Card className="col-span-3">
                          <CardContent className="py-12 text-center text-slate-500">
                            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>暂无题库</p>
                            <p className="text-sm mt-1">点击上方"新增题库"按钮创建</p>
                          </CardContent>
                        </Card>
                      ) : (
                        questionPools.map((pool) => (
                          <Card key={pool.id} className={`relative ${pool.isDefault ? 'ring-2 ring-[#E31837]' : ''}`}>
                            {pool.isDefault && (
                              <div className="absolute top-0 right-0 bg-[#E31837] text-white text-xs px-2 py-1 rounded-bl">
                                默认
                              </div>
                            )}
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">{pool.name}</CardTitle>
                                <Badge className={pool.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                                  {pool.isActive ? '启用' : '禁用'}
                                </Badge>
                              </div>
                              {pool.period && <CardDescription>{pool.period}</CardDescription>}
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-slate-600 mb-3 line-clamp-2">{pool.description || '暂无描述'}</p>
                              
                              <div className="flex items-center gap-4 text-sm text-slate-500 mb-3">
                                <span>Part 1: {pool.part1Count}</span>
                                <span>Part 2: {pool.part2Count}</span>
                                <span>Part 3: {pool.part3Count}</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => { 
                                    setViewingPoolId(pool.id); 
                                    setContentSubTab('questions');
                                    setQuestionFilter({ ...questionFilter, poolId: pool.id });
                                    loadQuestions(pool.id);
                                  }}
                                >
                                  <Eye className="w-4 h-4 mr-1" />查看题目
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setEditingPool(pool);
                                    setPoolForm({ 
                                      name: pool.name, 
                                      description: pool.description || '', 
                                      period: pool.period || '' 
                                    });
                                    setShowPoolDialog(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4 mr-1" />编辑
                                </Button>
                                {!pool.isDefault && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setDefaultPool(pool.id)}
                                  >
                                    设为默认
                                  </Button>
                                )}
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className={pool.isActive ? 'text-orange-600' : 'text-green-600'}
                                  onClick={() => togglePoolStatus(pool)}
                                >
                                  {pool.isActive ? '禁用' : '启用'}
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => deletePool(pool.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </>
                )}

                {/* 所有题目 */}
                {contentSubTab === 'all-questions' && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-semibold text-slate-800">所有题目</h2>
                        <p className="text-sm text-slate-500 mt-1">查看题库中的所有题目</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={questionFilter.part || ''}
                          onChange={(e) => { 
                            setQuestionFilter({ ...questionFilter, part: e.target.value || undefined }); 
                            loadQuestions();
                          }}
                          className="px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
                        >
                          <option value="">全部 Part</option>
                          <option value="1">Part 1</option>
                          <option value="2">Part 2</option>
                          <option value="3">Part 3</option>
                        </select>
                        <select
                          value={questionFilter.poolId || ''}
                          onChange={(e) => { 
                            setQuestionFilter({ ...questionFilter, poolId: e.target.value || undefined }); 
                            loadQuestions();
                          }}
                          className="px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
                        >
                          <option value="">全部题库</option>
                          {questionPools.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <Button variant="outline" size="sm" onClick={() => loadQuestions()}>
                          <RefreshCw className="w-4 h-4 mr-2" />刷新
                        </Button>
                      </div>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">题目列表</CardTitle>
                        <CardDescription>共 {questions.length} 道题目</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {questions.length === 0 ? (
                          <div className="text-center py-8 text-slate-500">
                            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>暂无题目</p>
                          </div>
                        ) : (
                          <ScrollArea className="h-[500px]">
                            <div className="space-y-3">
                              {questions.map((q) => (
                                <div key={q.id} className="p-4 rounded-lg border border-slate-200 bg-white">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline">Part {q.partNumber}</Badge>
                                      <Badge variant="secondary">{q.category}</Badge>
                                      {q.pool && <Badge variant="outline" className="text-xs">{q.pool.name}</Badge>}
                                    </div>
                                    <Badge className={q.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                                      {q.isActive ? '启用' : '禁用'}
                                    </Badge>
                                  </div>
                                  <p className="text-slate-700">{q.questionText}</p>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </>
            )}

            {/* 公告管理 */}
            {contentTab === 'announcements' && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-800">公告管理</h2>
                    <p className="text-sm text-slate-500 mt-1">发布和管理平台公告</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadAnnouncements}><RefreshCw className="w-4 h-4 mr-2" />刷新</Button>
                    <Button onClick={() => { setEditingAnnouncement(null); setAnnouncementForm({ title: '', content: '', type: 'info', priority: 0 }); setShowAnnouncementDialog(true); }} className="bg-[#E31837] hover:bg-[#c41430]"><Plus className="w-4 h-4 mr-2" />发布公告</Button>
                  </div>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-base">公告列表</CardTitle><CardDescription>共 {announcements.length} 条公告</CardDescription></CardHeader>
                  <CardContent>
                    {announcements.length === 0 ? (
                      <div className="text-center py-8 text-slate-500"><Megaphone className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>暂无公告</p></div>
                    ) : (
                      <ScrollArea className="h-[500px]">
                        <div className="space-y-3">
                          {announcements.map((a) => (
                            <div key={a.id} className="p-4 rounded-lg border border-slate-200 bg-white">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge className={a.type === 'warning' ? 'bg-amber-100 text-amber-700' : a.type === 'maintenance' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}>
                                    {a.type === 'info' ? '通知' : a.type === 'warning' ? '警告' : a.type === 'maintenance' ? '维护' : '更新'}
                                  </Badge>
                                  <Badge className={a.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                                    {a.isActive ? '启用' : '禁用'}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => { setEditingAnnouncement(a); setAnnouncementForm({ title: a.title, content: a.content, type: a.type, priority: a.priority }); setShowAnnouncementDialog(true); }}><Edit className="w-4 h-4" /></Button>
                                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteAnnouncement(a.id)}><Trash2 className="w-4 h-4" /></Button>
                                </div>
                              </div>
                              <h4 className="font-medium text-slate-800">{a.title}</h4>
                              <p className="text-sm text-slate-600 mt-1 line-clamp-2">{a.content}</p>
                              <p className="text-xs text-slate-400 mt-2">{formatDate(a.createdAt)}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ==================== 数据统计 ==================== */}
        {mainTab === 'stats' && (
          <div className="space-y-6">
            {/* 子 Tab 切换 */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
              {[
                { key: 'usage', icon: BarChart3, label: '用量统计' },
                { key: 'logs', icon: LogIn, label: '登录日志' },
              ].map(tab => (
                <Button
                  key={tab.key}
                  variant={statsTab === tab.key ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setStatsTab(tab.key as StatsTab); if (tab.key === 'logs') loadLoginLogs(); }}
                  className={statsTab === tab.key ? 'bg-[#E31837] hover:bg-[#c41430]' : ''}
                >
                  <tab.icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </Button>
              ))}
            </div>

            {/* 用量统计 */}
            {statsTab === 'usage' && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-800">用量统计</h2>
                    <p className="text-sm text-slate-500 mt-1">API 调用和平台数据</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={statsDays} onChange={(e) => { const days = parseInt(e.target.value); setStatsDays(days); loadUsageStats(days); }} className="px-3 py-2 border border-slate-200 rounded-md text-sm bg-white">
                      <option value={7}>近 7 天</option>
                      <option value={14}>近 14 天</option>
                      <option value={30}>近 30 天</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={() => loadUsageStats(statsDays)}><RefreshCw className="w-4 h-4 mr-2" />刷新</Button>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-4">
                  <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div><div><p className="text-sm text-slate-500">总用户</p><p className="text-2xl font-bold">{platformStats?.userCount || 0}</p></div></div></CardContent></Card>
                  <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"><Check className="w-5 h-5 text-green-600" /></div><div><p className="text-sm text-slate-500">活跃用户</p><p className="text-2xl font-bold">{platformStats?.activeUsers || 0}</p></div></div></CardContent></Card>
                  <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center"><FileText className="w-5 h-5 text-purple-600" /></div><div><p className="text-sm text-slate-500">总测试</p><p className="text-2xl font-bold">{platformStats?.sessionCount || 0}</p></div></div></CardContent></Card>
                  <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center"><Calendar className="w-5 h-5 text-amber-600" /></div><div><p className="text-sm text-slate-500">今日测试</p><p className="text-2xl font-bold">{platformStats?.todaySessions || 0}</p></div></div></CardContent></Card>
                  <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center"><BookOpen className="w-5 h-5 text-cyan-600" /></div><div><p className="text-sm text-slate-500">题库数量</p><p className="text-2xl font-bold">{platformStats?.questionCount || 0}</p></div></div></CardContent></Card>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-indigo-600" /></div><div><p className="text-sm text-slate-500">总 API 调用</p><p className="text-2xl font-bold">{usageStats?.totalCalls || 0}</p></div></div></CardContent></Card>
                  <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center"><BarChart3 className="w-5 h-5 text-rose-600" /></div><div><p className="text-sm text-slate-500">DeepSeek</p><p className="text-2xl font-bold">{usageStats?.deepseek.count || 0}</p><p className="text-xs text-slate-400">{usageStats?.deepseek.tokens || 0} tokens</p></div></div></CardContent></Card>
                  <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center"><FileText className="w-5 h-5 text-teal-600" /></div><div><p className="text-sm text-slate-500">Whisper</p><p className="text-2xl font-bold">{usageStats?.whisper.count || 0}</p></div></div></CardContent></Card>
                  <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center"><Play className="w-5 h-5 text-orange-600" /></div><div><p className="text-sm text-slate-500">TTS</p><p className="text-2xl font-bold">{usageStats?.tts.count || 0}</p></div></div></CardContent></Card>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">按功能统计</CardTitle></CardHeader>
                    <CardContent>
                      {usageStats?.byAction && Object.keys(usageStats.byAction).length > 0 ? (
                        <div className="space-y-3">
                          {Object.entries(usageStats.byAction).sort((a, b) => b[1] - a[1]).map(([action, count]) => {
                            const labels: Record<string, string> = { evaluate: '口语评估', translate: '翻译', generate: '题目生成', transcribe: '语音转录', daily_expr: '每日表达', grammar_fix: '语法修正', synthesize: '语音合成' };
                            const maxCount = Math.max(...Object.values(usageStats.byAction));
                            return (
                              <div key={action} className="space-y-1">
                                <div className="flex justify-between text-sm"><span className="text-slate-600">{labels[action] || action}</span><span className="font-medium">{count}</span></div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[#E31837] rounded-full" style={{ width: `${(count / maxCount) * 100}%` }} /></div>
                              </div>
                            );
                          })}
                        </div>
                      ) : <p className="text-center text-slate-500 py-4">暂无数据</p>}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">每日调用趋势</CardTitle></CardHeader>
                    <CardContent>
                      {usageStats?.byDate && Object.keys(usageStats.byDate).length > 0 ? (
                        <ScrollArea className="h-[250px]">
                          <div className="space-y-2">
                            {Object.entries(usageStats.byDate).sort((a, b) => b[0].localeCompare(a[0])).map(([date, counts]) => (
                              <div key={date} className="flex items-center justify-between p-2 rounded bg-slate-50">
                                <span className="text-sm text-slate-600">{date}</span>
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-rose-600">DS: {counts.deepseek}</span>
                                  <span className="text-teal-600">WH: {counts.whisper}</span>
                                  <span className="text-orange-600">TTS: {counts.tts}</span>
                                  <span className="font-medium text-slate-800">共: {counts.deepseek + counts.whisper + counts.tts}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : <p className="text-center text-slate-500 py-4">暂无数据</p>}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {/* 登录日志 */}
            {statsTab === 'logs' && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-800">登录日志</h2>
                    <p className="text-sm text-slate-500 mt-1">用户登录记录</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={loginLogFilter} onChange={(e) => { setLoginLogFilter(e.target.value); loadLoginLogs(e.target.value); }} className="px-3 py-2 border border-slate-200 rounded-md text-sm bg-white">
                      <option value="all">全部</option>
                      <option value="true">成功</option>
                      <option value="false">失败</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={() => loadLoginLogs(loginLogFilter)}><RefreshCw className="w-4 h-4 mr-2" />刷新</Button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><LogIn className="w-5 h-5 text-blue-600" /></div><div><p className="text-sm text-slate-500">今日登录</p><p className="text-2xl font-bold">{loginLogStats?.todayLogins || 0}</p></div></div></CardContent></Card>
                  <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"><Check className="w-5 h-5 text-green-600" /></div><div><p className="text-sm text-slate-500">成功登录</p><p className="text-2xl font-bold">{loginLogStats?.successCount || 0}</p></div></div></CardContent></Card>
                  <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><X className="w-5 h-5 text-red-600" /></div><div><p className="text-sm text-slate-500">失败登录</p><p className="text-2xl font-bold">{loginLogStats?.failedCount || 0}</p></div></div></CardContent></Card>
                  <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center"><AlertCircle className="w-5 h-5 text-amber-600" /></div><div><p className="text-sm text-slate-500">今日失败</p><p className="text-2xl font-bold">{loginLogStats?.todayFailed || 0}</p></div></div></CardContent></Card>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-base">登录记录</CardTitle><CardDescription>共 {loginLogs.length} 条记录</CardDescription></CardHeader>
                  <CardContent>
                    {loginLogs.length === 0 ? (
                      <div className="text-center py-8 text-slate-500"><LogIn className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>暂无登录记录</p></div>
                    ) : (
                      <ScrollArea className="h-[500px]">
                        <div className="space-y-3">
                          {loginLogs.map((log) => (
                            <div key={log.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white">
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${log.success ? 'bg-green-100' : 'bg-red-100'}`}>
                                  {log.success ? <Check className="w-5 h-5 text-green-600" /> : <X className="w-5 h-5 text-red-600" />}
                                </div>
                                <div>
                                  <p className="font-medium text-slate-800">{log.username}</p>
                                  {!log.success && log.failReason && <p className="text-sm text-red-500">{log.failReason}</p>}
                                </div>
                                <Badge variant="outline" className={log.success ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>{log.success ? '成功' : '失败'}</Badge>
                              </div>
                              <div className="flex items-center gap-6 text-sm text-slate-600">
                                <div className="text-center"><p className="text-xs text-slate-400 flex items-center gap-1"><Globe className="w-3 h-3" />IP</p><p className="font-medium font-mono text-xs">{log.ipAddress || '-'}</p></div>
                                <div className="text-center max-w-[200px]"><p className="text-xs text-slate-400 flex items-center gap-1 justify-center"><Monitor className="w-3 h-3" />设备</p><p className="font-medium text-xs truncate" title={log.userAgent || '-'}>{log.userAgent ? log.userAgent.substring(0, 30) + '...' : '-'}</p></div>
                                <div className="text-center"><p className="text-xs text-slate-400 flex items-center gap-1 justify-center"><Clock className="w-3 h-3" />时间</p><p className="font-medium">{formatDateShort(log.createdAt)}</p></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>

      {/* ==================== 对话框 ==================== */}
      {/* 创建邀请码 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>创建邀请码</DialogTitle><DialogDescription>批量创建邀请码</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>创建数量</Label><Input type="number" min={1} max={100} value={createCount} onChange={(e) => setCreateCount(parseInt(e.target.value) || 1)} /></div>
            <div className="space-y-2"><Label>每个邀请码可使用次数</Label><Input type="number" min={1} max={100} value={createMaxUses} onChange={(e) => setCreateMaxUses(parseInt(e.target.value) || 1)} /></div>
            <div className="space-y-2"><Label>每人有效天数</Label><Input type="number" min={1} placeholder="留空表示永久" value={createValidDays} onChange={(e) => setCreateValidDays(e.target.value ? parseInt(e.target.value) : '')} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
            <Button onClick={createInviteCodes} className="bg-[#E31837] hover:bg-[#c41430]">创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 用户详情 */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>用户详情</DialogTitle></DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center"><span className="text-2xl font-medium text-slate-600">{(selectedUser.name || selectedUser.username)?.charAt(0).toUpperCase()}</span></div>
                <div>
                  <p className="text-lg font-semibold text-slate-800">{selectedUser.name || selectedUser.username}</p>
                  <p className="text-slate-500">@{selectedUser.username}</p>
                  {getStatusBadge(selectedUser.status)}
                </div>
              </div>
              <hr className="border-slate-200" />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-slate-500">邮箱</p><p className="font-medium">{selectedUser.email || '-'}</p></div>
                <div><p className="text-slate-500">角色</p><p className="font-medium">{selectedUser.role === 'admin' ? '管理员' : '普通用户'}</p></div>
                <div><p className="text-slate-500">注册时间</p><p className="font-medium">{formatDate(selectedUser.createdAt)}</p></div>
                <div><p className="text-slate-500">激活时间</p><p className="font-medium">{formatDate(selectedUser.activatedAt)}</p></div>
                <div><p className="text-slate-500">过期时间</p><p className={`font-medium ${selectedUser.expiresAt && new Date(selectedUser.expiresAt) < new Date() ? 'text-red-500' : ''}`}>{formatDate(selectedUser.expiresAt)}</p></div>
                <div><p className="text-slate-500">注册 IP</p><p className="font-medium font-mono text-xs">{selectedUser.registeredIp || '-'}</p></div>
                <div><p className="text-slate-500">测试次数</p><p className="font-medium">{selectedUser.testCount}</p></div>
              </div>
              <hr className="border-slate-200" />
              <div className="flex items-center gap-2">
                {selectedUser.status === 'pending' && (
                  <>
                    <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => approveUser(selectedUser.id)}><Check className="w-4 h-4 mr-2" />批准</Button>
                    <Button variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50" onClick={() => rejectUser(selectedUser.id)}><X className="w-4 h-4 mr-2" />拒绝</Button>
                  </>
                )}
                {selectedUser.status === 'approved' && (
                  <>
                    <Button variant="outline" className="flex-1 border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => { setShowUserDialog(false); loadUserDetail(selectedUser.id); }}><Eye className="w-4 h-4 mr-2" />查看练习详情</Button>
                    <Button variant="outline" className="border-orange-200 text-orange-600 hover:bg-orange-50" onClick={() => suspendUser(selectedUser.id)}>禁用</Button>
                  </>
                )}
                {selectedUser.status === 'suspended' && <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => approveUser(selectedUser.id)}><Check className="w-4 h-4 mr-2" />解除禁用</Button>}
                {selectedUser.role !== 'admin' && <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => deleteUser(selectedUser.id)}><Trash2 className="w-4 h-4 mr-2" />删除</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 练习详情 */}
      <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader><DialogTitle>练习详情</DialogTitle></DialogHeader>
          {selectedSession && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div><p className="text-slate-500">测试类型</p><p className="font-medium">{selectedSession.testType === 'full' ? '完整测试' : `Part ${selectedSession.testType}`}</p></div>
                  <div><p className="text-slate-500">分数</p><p className="font-medium text-lg">{selectedSession.bandScore ? selectedSession.bandScore.toFixed(1) : '-'}</p></div>
                  <div><p className="text-slate-500">开始时间</p><p className="font-medium">{formatDate(selectedSession.startedAt)}</p></div>
                  <div><p className="text-slate-500">状态</p>{getEvaluationStatusBadge(selectedSession.evaluationStatus)}</div>
                </div>
                <hr className="border-slate-200" />
                <div className="space-y-4">
                  <h4 className="font-medium text-slate-800">回答详情</h4>
                  {selectedSession.responses.map((response, index) => (
                    <div key={response.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2"><Badge variant="outline">Part {response.partNumber}</Badge><span className="text-sm text-slate-500">题目 {index + 1}</span></div>
                        {response.overallScore && <div className="text-sm"><span className="text-slate-500">得分:</span><span className="font-bold text-[#E31837] ml-1">{response.overallScore.toFixed(1)}</span></div>}
                      </div>
                      <div className="mb-3"><p className="text-xs text-slate-400 mb-1">问题</p><p className="text-sm text-slate-700">{response.questionText}</p></div>
                      {response.transcription && <div className="mb-3"><p className="text-xs text-slate-400 mb-1">回答</p><p className="text-sm text-slate-700 bg-white p-2 rounded border">{response.transcription}</p></div>}
                      {response.feedback && <div className="mb-3"><p className="text-xs text-slate-400 mb-1">反馈</p><p className="text-sm text-slate-600">{response.feedback}</p></div>}
                      {response.overallScore && (
                        <div className="grid grid-cols-4 gap-2 text-xs mt-3">
                          <div className="text-center p-2 bg-white rounded border"><p className="text-slate-400">流利度</p><p className="font-medium">{response.fluencyScore?.toFixed(1) || '-'}</p></div>
                          <div className="text-center p-2 bg-white rounded border"><p className="text-slate-400">词汇</p><p className="font-medium">{response.vocabularyScore?.toFixed(1) || '-'}</p></div>
                          <div className="text-center p-2 bg-white rounded border"><p className="text-slate-400">语法</p><p className="font-medium">{response.grammarScore?.toFixed(1) || '-'}</p></div>
                          <div className="text-center p-2 bg-white rounded border"><p className="text-slate-400">发音</p><p className="font-medium">{response.pronunciationScore?.toFixed(1) || '-'}</p></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* 公告编辑 */}
      <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingAnnouncement ? '编辑公告' : '发布公告'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>标题</Label><Input value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>内容</Label><textarea className="w-full min-h-[100px] p-3 border border-slate-200 rounded-md text-sm" value={announcementForm.content} onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>类型</Label>
                <select className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white" value={announcementForm.type} onChange={(e) => setAnnouncementForm({ ...announcementForm, type: e.target.value })}>
                  <option value="info">通知</option>
                  <option value="warning">警告</option>
                  <option value="maintenance">维护</option>
                  <option value="update">更新</option>
                </select>
              </div>
              <div className="space-y-2"><Label>优先级</Label><Input type="number" value={announcementForm.priority} onChange={(e) => setAnnouncementForm({ ...announcementForm, priority: parseInt(e.target.value) || 0 })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnnouncementDialog(false)}>取消</Button>
            <Button onClick={saveAnnouncement} className="bg-[#E31837] hover:bg-[#c41430]">{editingAnnouncement ? '保存' : '发布'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 题库编辑 */}
      <Dialog open={showPoolDialog} onOpenChange={setShowPoolDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPool ? '编辑题库' : '新增题库'}</DialogTitle>
            <DialogDescription>{editingPool ? '修改题库信息' : '创建新的口语题库'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>题库名称 *</Label>
              <Input 
                placeholder="如：2025年1-4月题库" 
                value={poolForm.name} 
                onChange={(e) => setPoolForm({ ...poolForm, name: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label>题库周期</Label>
              <Input 
                placeholder="如：2025-Q1" 
                value={poolForm.period} 
                onChange={(e) => setPoolForm({ ...poolForm, period: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <textarea 
                className="w-full min-h-[80px] p-3 border border-slate-200 rounded-md text-sm" 
                placeholder="题库描述（可选）" 
                value={poolForm.description} 
                onChange={(e) => setPoolForm({ ...poolForm, description: e.target.value })} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPoolDialog(false); setEditingPool(null); }}>取消</Button>
            <Button 
              onClick={editingPool ? updatePool : createPool} 
              className="bg-[#E31837] hover:bg-[#c41430]"
              disabled={!poolForm.name.trim()}
            >
              {editingPool ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
