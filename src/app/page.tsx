'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Play, Square, ChevronRight, ChevronLeft, RotateCcw,
  BarChart3, TrendingUp, BookOpen, Award, Clock, Target, Lightbulb,
  Volume2, CheckCircle2, AlertCircle, Loader2, History, User, Star,
  ArrowRight, RefreshCw, Download, Share2, Database, Plus, Sparkles,
  Eye, Trash2, X, LogOut, Upload, MessageCircle, Shield, Pencil, Languages,
  Key, Users, Check, Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useIELTSStore, type ResponseData, type ImprovementPlan, type PendingTranscription, type DiscussionItem, type Part3DiscussionState, loadSettingsFromServer } from '@/store/ielts-store';
import { LoginDialog, RegisterDialog } from '@/components/auth';
import { toast } from 'sonner';
import { indexedDBAudio } from '@/lib/indexeddb-audio';

// Topic lists
const TOPICS = {
  part1: ['Hometown', 'Work & Study', 'Technology', 'Leisure', 'Food', 'Travel', 'Family', 'Friends', 'Music', 'Movies', 'Sports', 'Reading'],
  part2: ['Person', 'Place', 'Experience', 'Skill', 'Object', 'Event', 'Book', 'Movie', 'Travel', 'Achievement', 'Challenge', 'Gift'],
  part3: ['Education', 'Society', 'Environment', 'Technology', 'Culture', 'Health', 'Work', 'Relationships', 'Media', 'Globalization']
};

const defaultQuestions = {
  // Part 1: 雅思官方标准 - 8-15个问题，围绕2-3个话题，每个话题3-5个问题
  part1: [
    // Topic 1: Hometown (4 questions)
    { id: 'p1-1', questionText: "Let's talk about your hometown. Where are you from?", category: "Hometown" },
    { id: 'p1-2', questionText: "What do you like most about living there?", category: "Hometown" },
    { id: 'p1-3', questionText: "Has your hometown changed much in recent years?", category: "Hometown" },
    { id: 'p1-4', questionText: "Would you like to live there in the future?", category: "Hometown" },
    // Topic 2: Work & Study (3 questions)
    { id: 'p1-5', questionText: "Do you work or are you a student?", category: "Work & Study" },
    { id: 'p1-6', questionText: "What do you enjoy most about your work or studies?", category: "Work & Study" },
    { id: 'p1-7', questionText: "What are your future career plans?", category: "Work & Study" },
    // Topic 3: Leisure (3 questions)
    { id: 'p1-8', questionText: "What do you usually do in your free time?", category: "Leisure" },
    { id: 'p1-9', questionText: "Do you prefer spending your free time alone or with others?", category: "Leisure" },
    { id: 'p1-10', questionText: "How has your free time changed since you were a child?", category: "Leisure" },
  ],
  // Part 2: 雅思官方标准 - 1个问题，准备1分钟，独白1-2分钟
  part2: [
    { 
      id: 'p2-1', 
      questionText: "Describe a skill you would like to learn.\n\nYou should say:\n- what skill it is\n- why you want to learn it\n- how you would learn it\n- and explain how this skill would be useful to you.",
      category: "Skills"
    }
  ],
  // Part 3: 雅思官方标准 - 5-10个问题，双向讨论
  part3: [
    { id: 'p3-1', questionText: "What skills are most important for young people to learn today?", category: "Skills" },
    { id: 'p3-2', questionText: "How has technology changed the way people learn new skills?", category: "Skills" },
    { id: 'p3-3', questionText: "Do you think practical skills or academic knowledge is more valuable?", category: "Skills" },
    { id: 'p3-4', questionText: "What role should schools play in developing students' skills?", category: "Skills" },
    { id: 'p3-5', questionText: "Are there any skills that are becoming less important in modern society?", category: "Skills" },
    { id: 'p3-6', questionText: "How can governments encourage people to learn new skills?", category: "Skills" },
    { id: 'p3-7', questionText: "Do you think the skills people need will change significantly in the future?", category: "Skills" },
    { id: 'p3-8', questionText: "What are the advantages and disadvantages of learning skills online?", category: "Skills" },
  ]
};

function formatTime(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getBandColor(band: number): string {
  if (band >= 8) return 'text-green-600 bg-green-50 border-green-200';
  if (band >= 7) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (band >= 6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  if (band >= 5) return 'text-orange-600 bg-orange-50 border-orange-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

// 移动端检测函数
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
  // 微信内置浏览器检测
  const isWeChat = /micromessenger/i.test(ua);
  return isMobile || isWeChat;
}

// 检测是否支持 Web Speech API
function supportsSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// 全局音频上下文解锁状态
let audioContextUnlocked = false;

// 尝试解锁音频上下文（移动端需要用户交互）
async function unlockAudioContext(): Promise<boolean> {
  if (audioContextUnlocked) return true;
  
  try {
    // 创建一个短暂的静音音频来解锁
    const audio = new Audio();
    audio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYGp/7CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYGp/7CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    audio.volume = 0.01;
    await audio.play();
    audio.pause();
    audioContextUnlocked = true;
    console.log('[Audio] Audio context unlocked');
    return true;
  } catch (e) {
    console.warn('[Audio] Failed to unlock audio context:', e);
    return false;
  }
}

// Cue Card 解析和显示组件 - 显示完整题目内容
function CueCardDisplay({ questionText }: { questionText: string }) {
  // 解析 Cue Card 格式
  const parseCueCard = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    let topic = '';
    let bullets: string[] = [];
    let explanation = '';

    // 找到主标题 (通常是 "Describe..." 开头的行)
    const topicLine = lines.find(line => line.toLowerCase().startsWith('describe'));
    if (topicLine) {
      topic = topicLine.trim();
    }

    // 找到 "You should say:" 后面的 bullet points
    const bulletStartIndex = lines.findIndex(line => 
      line.toLowerCase().includes('you should say')
    );

    if (bulletStartIndex !== -1) {
      // 收集 bullet points 和 explanation
      for (let i = bulletStartIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('-') || line.startsWith('•')) {
          const bulletContent = line.replace(/^[-•]\s*/, '');
          // 检查是否是 "and explain" 开头的行
          if (bulletContent.toLowerCase().startsWith('and explain')) {
            explanation = bulletContent;
          } else {
            bullets.push(bulletContent);
          }
        } else if (line.length > 0 && !line.toLowerCase().includes('follow-up')) {
          // 处理没有 bullet 符号的行
          if (line.toLowerCase().startsWith('and explain')) {
            explanation = line;
          } else {
            bullets.push(line);
          }
        }
      }
    }

    // 如果没有找到标准格式，直接返回原文
    if (!topic && bullets.length === 0) {
      return { topic: text, bullets: [], explanation: '' };
    }

    return { topic, bullets, explanation };
  };

  const { topic, bullets, explanation } = parseCueCard(questionText);

  return (
    <div className="space-y-4">
      {/* 主标题 */}
      <h3 className="text-lg font-semibold text-slate-800 leading-relaxed">
        {topic}
      </h3>
      
      {/* Bullet points */}
      {bullets.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-600 uppercase tracking-wide">
            You should say:
          </p>
          <ul className="space-y-2 ml-1">
            {bullets.map((bullet, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-[#E31837] mt-0.5">•</span>
                <span className="text-slate-700 leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Explanation - 显示 "and explain..." 部分 */}
      {explanation && (
        <div className="pt-2 border-t border-slate-200">
          <p className="text-slate-700 leading-relaxed italic">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}

export default function IELTSSpeakingApp() {
  const {
    currentView, setView, testMode, setTestMode, sessionId, setSessionId,
    questions, currentQuestionIndex, currentPart, setQuestions, nextQuestion,
    prevQuestion, setCurrentPart, responses, addResponse, clearResponses,
    isRecording, setIsRecording, recordingDuration, setRecordingDuration,
    currentEvaluation, setCurrentEvaluation, improvementPlan, setImprovementPlan,
    historySessions, setHistorySessions, isLoading, setIsLoading, reset,
    pendingTranscriptions, addPendingTranscription, clearPendingTranscriptions,
    selectedTopic, setSelectedTopic, settings, updateSetting, loadServerSettings,
    user, initUser, setUser, logout,
    // Part 3 动态讨论相关
    part3Discussion, initPart3Discussion, addDiscussionItem,
    setCurrentDiscussionQuestion, setPart3DiscussionGenerating, endPart3Discussion
  } = useIELTSStore();

  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [authUser, setAuthUser] = useState<{ id: string; username: string; name?: string; role?: string } | null>(null);
  
  // 评估进度状态
  const [evaluatingProgress, setEvaluatingProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  
  // 后台评估状态
  const [isBackgroundEvaluating, setIsBackgroundEvaluating] = useState(false);
  const [backgroundEvalSessionId, setBackgroundEvalSessionId] = useState<string | null>(null);
  
  // 移动端音频解锁状态
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [showMobileUnlockDialog, setShowMobileUnlockDialog] = useState(false);
  
  // 检测移动端
  const isMobile = typeof window !== 'undefined' ? isMobileDevice() : false;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef<string>('');
  const [liveTranscription, setLiveTranscription] = useState<string>('');
  
  const [showTopicDialog, setShowTopicDialog] = useState(false);
  const [pendingTestMode, setPendingTestMode] = useState<'part1' | 'part2' | 'part3' | 'full' | null>(null);
  const [selectedPartTopics, setSelectedPartTopics] = useState<{ part1: string | null; part2: string | null; part3: string | null }>({ part1: null, part2: null, part3: null });
  const [customTopic, setCustomTopic] = useState('');
  const [useCustomTopic, setUseCustomTopic] = useState(false);

  // 题库相关状态
  const [questionPools, setQuestionPools] = useState<any[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);

  // 获取题库列表
  useEffect(() => {
    const fetchPools = async () => {
      try {
        const response = await fetch('/api/pool?includeCount=true');
        const data = await response.json();
        if (data.success) {
          setQuestionPools(data.pools);
          // 自动选择默认题库
          const defaultPool = data.pools.find((p: any) => p.isDefault);
          if (defaultPool) {
            setSelectedPoolId(defaultPool.id);
          } else if (data.pools.length > 0) {
            setSelectedPoolId(data.pools[0].id);
          }
        }
      } catch (error) {
        console.error('[Pools] Fetch error:', error);
      }
    };
    fetchPools();
  }, []);

  // Fetch questions
  const fetchQuestions = useCallback(async (part: number, topic?: string | null, autoGenerate: boolean = true, poolId?: string | null) => {
    setIsLoading(true);
    try {
      const selectedTopic = topic || TOPICS[`part${part}` as keyof typeof TOPICS]?.[Math.floor(Math.random() * (TOPICS[`part${part}` as keyof typeof TOPICS]?.length || 0))];

      // 雅思官方标准问题数量：Part 1: 10个（2-3话题），Part 2: 1个，Part 3: 8个
      const questionCounts: Record<number, number> = { 1: 10, 2: 1, 3: 8 };
      let url = `/api/questions?part=${part}&count=${questionCounts[part] || 4}`;
      if (selectedTopic) url += `&category=${encodeURIComponent(selectedTopic)}`;
      if (poolId) url += `&poolId=${poolId}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.questions.length > 0) {
        setQuestions(data.questions);
        setSelectedTopic(selectedTopic);
      } else if (autoGenerate) {
        // 检查用户是否已登录
        if (!user.isLoggedIn) {
          toast.info('登录后可自动生成题目，当前使用默认题目');
          const partKey = `part${part}` as keyof typeof defaultQuestions;
          setQuestions(defaultQuestions[partKey]);
          setIsLoading(false);
          return;
        }

        toast.info(`题库中暂无 ${selectedTopic} 话题的题目，正在自动生成...`);

        const generateResponse = await fetch('/api/questions/update', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ part, topic: selectedTopic, count: questionCounts[part] || 4 })
        });

        const generateData = await generateResponse.json();

        if (generateData.needLogin) {
          toast.error('请先登录后再生成题目');
          const partKey = `part${part}` as keyof typeof defaultQuestions;
          setQuestions(defaultQuestions[partKey]);
        } else if (generateData.success && generateData.saved > 0) {
          toast.success(`成功生成 ${generateData.generated} 道题目`);
          const retryResponse = await fetch(url);
          const retryData = await retryResponse.json();

          if (retryData.success && retryData.questions.length > 0) {
            setQuestions(retryData.questions);
            setSelectedTopic(selectedTopic);
          } else {
            const partKey = `part${part}` as keyof typeof defaultQuestions;
            setQuestions(defaultQuestions[partKey]);
          }
        } else {
          toast.error(generateData.error || '题目生成失败，使用默认题目');
          const partKey = `part${part}` as keyof typeof defaultQuestions;
          setQuestions(defaultQuestions[partKey]);
        }
      } else {
        const partKey = `part${part}` as keyof typeof defaultQuestions;
        setQuestions(defaultQuestions[partKey]);
      }
    } catch (error) {
      console.error('[Questions] Error:', error);
      const partKey = `part${part}` as keyof typeof defaultQuestions;
      setQuestions(defaultQuestions[partKey]);
    }
    setIsLoading(false);
  }, [setIsLoading, setQuestions, setSelectedTopic, user.isLoggedIn]);

  // Create session
  const createSession = async () => {
    try {
      const response = await fetch('/api/test-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: testMode })
      });
      const data = await response.json();
      
      if (data.success) {
        setSessionId(data.session.id);
        // 如果是访客，显示剩余次数提示
        if (data.isGuest && data.remainingGuestSessions === 0) {
          toast.info('这是您最后一次访客体验机会，注册后可无限使用');
        }
        return data.session.id;
      } else {
        // 处理错误情况
        if (data.needRegister) {
          toast.error('访客试用次数已用完，请注册账号后继续使用');
          setShowRegisterDialog(true);
        } else if (data.needApproval) {
          toast.error(data.error || '账号正在等待审批');
        } else {
          toast.error(data.error || '创建会话失败');
        }
      }
    } catch (error) {
      toast.error('创建会话失败');
    }
    return null;
  };

  // 清理未完成的会话
  const cleanupIncompleteSessions = async (currentSessionId?: string) => {
    try {
      // 优先使用当前 sessionId 清理
      if (currentSessionId) {
        console.log('[Cleanup] Cleaning current incomplete session:', currentSessionId);
        await fetch('/api/history', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: currentSessionId })
        });
        return;
      }
      
      // 否则按 userId 清理
      const currentUserId = user.userId;
      if (currentUserId) {
        console.log('[Cleanup] Cleaning incomplete sessions for user:', currentUserId);
        await fetch('/api/history', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUserId })
        });
      }
    } catch (error) {
      console.log('[Cleanup] Error:', error);
    }
  };

  // 返回首页（清理未完成的会话）
  const goHome = async () => {
    // 如果当前在测试页面且有 sessionId，清理未完成的会话
    if (currentView === 'test' && sessionId) {
      // 检查是否有已完成的回答（有 responses 说明已完成评估）
      const hasCompletedResponses = responses && responses.length > 0;
      if (!hasCompletedResponses) {
        await cleanupIncompleteSessions(sessionId);
      }
    }
    reset();
    setView('home');
  };

  // Open topic dialog
  const openTopicDialog = (mode: 'part1' | 'part2' | 'part3' | 'full') => {
    setPendingTestMode(mode);
    setSelectedPartTopics({ part1: null, part2: null, part3: null });
    setCustomTopic('');
    setUseCustomTopic(false);
    setShowTopicDialog(true);
  };

  // Confirm topic and start test
  const confirmTopicAndStartTest = async () => {
    if (!pendingTestMode) return;
    
    setShowTopicDialog(false);
    const mode = pendingTestMode;
    setTestMode(mode);
    clearResponses();
    setCurrentPart(mode === 'full' ? 1 : parseInt(mode.replace('part', '')));
    
    // 清理未完成的会话
    await cleanupIncompleteSessions();
    
    // 创建会话 - 如果失败则停止
    const sessionId = await createSession();
    if (!sessionId) {
      setPendingTestMode(null);
      return;
    }
    
    const part = mode === 'full' ? 1 : parseInt(mode.replace('part', ''));
    
    let topic = null;
    if (useCustomTopic && customTopic.trim()) {
      topic = customTopic.trim();
    } else {
      topic = mode === 'full' 
        ? selectedPartTopics.part1 
        : selectedPartTopics[`part${part}` as keyof typeof selectedPartTopics];
    }
    
    await fetchQuestions(part, topic, true, selectedPoolId);
    
    setView('test');
    setPendingTestMode(null);
  };

  // Start test directly with random topic
  const startTestDirectly = async (mode: 'part1' | 'part2' | 'part3' | 'full') => {
    setShowTopicDialog(false);
    setTestMode(mode);
    clearResponses();
    setCurrentPart(mode === 'full' ? 1 : parseInt(mode.replace('part', '')));
    
    // 清理未完成的会话
    await cleanupIncompleteSessions();
    
    // 创建会话 - 如果失败则停止
    const sessionId = await createSession();
    if (!sessionId) {
      setPendingTestMode(null);
      return;
    }
    
    const part = mode === 'full' ? 1 : parseInt(mode.replace('part', ''));
    
    await fetchQuestions(part, null, true, selectedPoolId);
    
    setView('test');
    setPendingTestMode(null);
  };

  // Recording control
  const startRecording = async () => {
    console.log('[Recording] startRecording called, isMobile:', isMobile);
    
    try {
      // 移动端先解锁音频上下文
      if (isMobile && !audioUnlocked) {
        console.log('[Recording] Unlocking audio context for mobile...');
        const unlocked = await unlockAudioContext();
        setAudioUnlocked(unlocked);
        console.log('[Recording] Audio context unlocked:', unlocked);
      }
      
      // 检查浏览器是否支持录音
      if (!navigator.mediaDevices) {
        console.error('[Recording] navigator.mediaDevices not available');
        toast.error('您的浏览器不支持录音功能，请使用 Chrome、Safari 等现代浏览器');
        return;
      }
      
      if (!navigator.mediaDevices.getUserMedia) {
        console.error('[Recording] getUserMedia not available');
        toast.error('您的浏览器不支持录音功能，请使用 Chrome、Safari 等现代浏览器');
        return;
      }

      console.log('[Recording] Requesting microphone permission...');
      toast.info('正在请求麦克风权限...');

      // 检测支持的音频格式
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/wav',
        ''  // 默认格式
      ];
      
      let selectedMimeType = '';
      
      // 安全检测支持的格式
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
        for (const mimeType of mimeTypes) {
          try {
            if (mimeType === '' || MediaRecorder.isTypeSupported(mimeType)) {
              selectedMimeType = mimeType;
              console.log('[Recording] Using mimeType:', mimeType || 'default');
              break;
            }
          } catch (e) {
            console.warn('[Recording] mimeType check failed:', mimeType, e);
          }
        }
      } else {
        console.log('[Recording] MediaRecorder.isTypeSupported not available, using default');
      }

      // 请求麦克风权限
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000
          } 
        });
        console.log('[Recording] Got audio stream, tracks:', stream.getAudioTracks().length);
      } catch (permError: any) {
        console.error('[Recording] getUserMedia error:', permError);
        if (permError.name === 'NotAllowedError' || permError.name === 'PermissionDeniedError') {
          toast.error('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风');
        } else if (permError.name === 'NotFoundError') {
          toast.error('未找到麦克风设备，请确保手机有麦克风');
        } else if (permError.name === 'NotReadableError') {
          toast.error('麦克风被其他应用占用，请关闭其他使用麦克风的应用');
        } else {
          toast.error(`无法访问麦克风: ${permError.message || permError.name}`);
        }
        return;
      }
      
      // 检查 MediaRecorder 是否可用
      if (typeof MediaRecorder === 'undefined') {
        console.error('[Recording] MediaRecorder not available');
        toast.error('您的浏览器不支持录音功能');
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      // 创建 MediaRecorder
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, 
          selectedMimeType ? { mimeType: selectedMimeType } : undefined
        );
        console.log('[Recording] MediaRecorder created, mimeType:', mediaRecorder.mimeType);
      } catch (recorderError: any) {
        console.error('[Recording] Failed to create MediaRecorder:', recorderError);
        // 尝试不指定 mimeType
        try {
          mediaRecorder = new MediaRecorder(stream);
          console.log('[Recording] MediaRecorder created with default settings');
        } catch (fallbackError: any) {
          console.error('[Recording] Fallback also failed:', fallbackError);
          toast.error('录音功能初始化失败，请尝试其他浏览器');
          stream.getTracks().forEach(track => track.stop());
          return;
        }
      }
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setLiveTranscription('');
      transcriptRef.current = '';

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          console.log('[Recording] Chunk received, size:', e.data.size, 'type:', e.data.type);
        }
      };

      mediaRecorder.onerror = (event: any) => {
        console.error('[Recording] MediaRecorder error:', event);
        toast.error('录音出错: ' + (event.message || '未知错误'));
        setIsRecording(false);
      };

      // 使用 timeslice 确保数据定期收集
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingDuration(0);

      let duration = 0;
      timerRef.current = setInterval(() => {
        duration += 1;
        setRecordingDuration(duration);
      }, 1000);

      // 尝试启动实时语音识别（移动端可能不支持）
      const speechSupported = startLiveTranscription();
      if (!speechSupported && isMobile) {
        console.log('[Recording] Web Speech API not supported on this device, will use Whisper');
      }
      
      console.log('[Recording] Recording started successfully');
      toast.success('开始录音');
    } catch (error: unknown) {
      console.error('[Recording] Unexpected error:', error);
      const err = error as Error;
      toast.error(`录音失败: ${err.message || '未知错误'}`);
      setIsRecording(false);
    }
  };

  // Web Speech API live transcription - 返回是否成功启动
  const startLiveTranscription = (): boolean => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('[Speech Recognition] Not supported on this browser');
      return false;
    }

    try {
      transcriptRef.current = '';
      setLiveTranscription('');
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            transcriptRef.current += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }
        
        const fullText = transcriptRef.current + interimTranscript;
        setLiveTranscription(fullText);
      };

      recognition.start();
      recognitionRef.current = recognition;
      return true;
    } catch (error) {
      console.warn('[Speech Recognition] Failed to start:', error);
      return false;
    }
  };

  const recognitionRef = useRef<any>(null);

  const stopLiveTranscription = (): string => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    return transcriptRef.current.trim();
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      const webSpeechResult = stopLiveTranscription();
      
      // 停止录音
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) clearInterval(timerRef.current);

      mediaRecorderRef.current.onstop = async () => {
        // 检查是否有音频数据
        const chunks = audioChunksRef.current;
        console.log('[Recording] Stopped, chunks count:', chunks.length);
        
        if (chunks.length === 0) {
          toast.error('录音失败：没有捕获到音频数据，请检查麦克风权限');
          setIsLoading(false);
          return;
        }
        
        // 计算总大小
        const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
        console.log('[Recording] Total audio size:', totalSize, 'bytes');
        
        if (totalSize < 1000) {
          toast.error('录音数据太小，可能没有声音，请重新录音');
          setIsLoading(false);
          return;
        }
        
        // 检测音频类型
        const audioType = chunks[0].type || 'audio/webm';
        console.log('[Recording] Audio type:', audioType);
        
        // 创建音频 Blob
        const audioBlob = new Blob(chunks, { type: audioType });
        console.log('[Recording] Blob size:', audioBlob.size, 'type:', audioBlob.type);
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          const base64Data = base64.split(',')[1];
          
          console.log('[Recording] Base64 length:', base64Data?.length);
          
          if (!base64Data || base64Data.length < 100) {
            toast.error('音频编码失败，请重新录音');
            setIsLoading(false);
            return;
          }
          
          await transcribeAudio(base64Data, webSpeechResult, audioType);
        };
        
        reader.onerror = (error) => {
          console.error('[Recording] FileReader error:', error);
          toast.error('音频处理失败，请重新录音');
          setIsLoading(false);
        };
      };
      
      mediaRecorderRef.current.onerror = (event: any) => {
        console.error('[Recording] Stop error:', event);
        toast.error('录音停止时出错');
        setIsLoading(false);
      };
    }
  };

  const transcribeAudio = async (base64: string, webSpeechBackup?: string, audioType?: string) => {
    setIsLoading(true);
    toast.info('正在识别语音...');
    
    // 检查录音时长 - 根据 IELTS 标准设置最低时长
    const minDurations: Record<number, number> = {
      1: 5,   // Part 1: 至少 5 秒
      2: 15,  // Part 2: 至少 15 秒
      3: 10   // Part 3: 至少 10 秒
    };
    const minDuration = minDurations[currentPart] || 3;
    
    if (recordingDuration && recordingDuration < minDuration) {
      const suggestions: Record<number, string> = {
        1: '建议回答 20-30 秒',
        2: '建议回答 1-2 分钟',
        3: '建议回答 30-40 秒'
      };
      toast.error(`录音时间太短（${recordingDuration}秒），Part ${currentPart} 至少需要 ${minDuration} 秒。${suggestions[currentPart] || ''}`);
      setIsLoading(false);
      return;
    }
    
    // 先保存录音到 IndexedDB
    let audioId: string | undefined;
    try {
      const currentUserId = sessionId || `temp_${Date.now()}`;
      const responseId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      audioId = await indexedDBAudio.saveRecording(currentUserId, responseId, base64, recordingDuration);
      console.log('[Audio] Saved to IndexedDB:', audioId);
    } catch (error) {
      console.error('[Audio] Failed to save to IndexedDB:', error);
    }
    
    // 检查是否有 Web Speech API 的备用结果
    const hasWebSpeechResult = webSpeechBackup && webSpeechBackup.trim().length > 1;
    
    try {
      console.log('[Transcribe] Sending audio to Whisper service, duration:', recordingDuration, 's, type:', audioType);
      
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          audioBase64: base64,
          audioType: audioType || 'audio/webm'
        })
      });
      const data = await response.json();
      
      console.log('[Transcribe] Whisper response:', { 
        success: data.success, 
        hasTranscription: !!data.transcription,
        error: data.error 
      });
      
      if (data.success && data.transcription && data.transcription.trim().length > 0) {
        processTranscription(data.transcription, base64, audioId);
      } else if (hasWebSpeechResult) {
        console.log('[Transcribe] Using Web Speech API backup result');
        toast.info('使用浏览器语音识别结果');
        processTranscription(webSpeechBackup!, base64, audioId);
      } else {
        const errorMsg = data.error || '未检测到语音';
        if (errorMsg.includes('No audio') || errorMsg.includes('empty') || errorMsg.includes('too short')) {
          toast.error('录音时间太短或没有声音，请重新录音');
        } else if (errorMsg.includes('Whisper service')) {
          toast.error('语音识别服务暂时不可用，请稍后重试');
        } else {
          toast.error('语音识别失败: ' + errorMsg);
        }
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error('[Transcribe] Error:', error);
      
      if (hasWebSpeechResult) {
        console.log('[Transcribe] Using Web Speech API backup result due to error');
        toast.info('使用浏览器语音识别结果');
        processTranscription(webSpeechBackup!, base64, audioId);
      } else {
        // 移动端更友好的错误提示
        const errorMessage = isMobile 
          ? '语音识别服务暂时不可用。请确保：\n1. 录音时清晰说话\n2. 网络连接正常\n3. 稍后重试'
          : '语音识别服务出错，请检查 Whisper 服务是否启动';
        toast.error(errorMessage);
        setIsLoading(false);
      }
    }
  };

  const processTranscription = (transcription: string, audioBase64?: string, audioId?: string) => {
    const currentQuestion = questions[currentQuestionIndex];
    if (currentQuestion && transcription.trim().length > 0) {
      const pendingItem: PendingTranscription = {
        questionId: currentQuestion.id,
        questionText: currentQuestion.questionText,
        transcription: transcription.trim(),
        duration: recordingDuration,
        partNumber: currentPart,
        audioBase64: audioBase64,
        audioId: audioId
      };
      addPendingTranscription(pendingItem);
      toast.success('语音识别完成');
    } else {
      toast.error('未能识别到语音内容');
    }
    
    setIsLoading(false);

    if (currentQuestionIndex < questions.length - 1) {
      nextQuestion();
    } else {
      if (testMode === 'full' && currentPart < 3) {
        setTimeout(() => goToNextPart(), 100);
      } else {
        setTimeout(() => {
          const pending = useIELTSStore.getState().pendingTranscriptions;
          if (pending.length > 0) {
            // 启动后台评估，不阻塞 UI
            startBackgroundEvaluation();
          } else {
            toast.error('没有待评估的回答');
          }
        }, 100);
      }
    }
  };

  const evaluatePart = async () => {
    const transcriptionsToEvaluate = useIELTSStore.getState().pendingTranscriptions;
    
    console.log('[EvaluatePart] Starting evaluation, transcriptions count:', transcriptionsToEvaluate.length);
    
    if (transcriptionsToEvaluate.length === 0) {
      toast.error('没有待评估的回答');
      return;
    }

    // 显示后台评估提示
    setIsBackgroundEvaluating(true);
    setBackgroundEvalSessionId(sessionId);
    setIsLoading(true);
    
    const total = transcriptionsToEvaluate.length;
    setEvaluatingProgress({ current: 0, total, message: '准备评估...' });

    try {
      // 逐个评估并显示进度
      const results = [];
      for (let i = 0; i < transcriptionsToEvaluate.length; i++) {
        const t = transcriptionsToEvaluate[i];
        
        // 调试日志
        console.log('[Evaluation] Sending transcription:', {
          index: i,
          questionText: t.questionText?.substring(0, 50),
          transcriptionLength: t.transcription?.length,
          hasAudio: !!t.audioBase64
        });
        
        setEvaluatingProgress({ 
          current: i + 1, 
          total, 
          message: `正在评估第 ${i + 1}/${total} 个回答...` 
        });

        const response = await fetch('/api/evaluate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            partNumber: currentPart,
            transcriptions: [t]
          })
        });
        
        const data = await response.json();
        console.log('[Evaluation] API response:', {
          success: data.success,
          hasResponses: !!data.responses,
          responsesLength: data.responses?.length,
          error: data.error
        });
        
        if (data.success && data.responses?.length > 0) {
          const responseData = data.responses[0];
          console.log('[Evaluation] Response data:', {
            scores: responseData.scores,
            hasFeedback: !!responseData.feedback,
            hasModelAnswer: !!responseData.modelAnswer,
            hasImprovements: !!responseData.improvements
          });
          
          results.push(responseData);
          addResponse({
            partNumber: responseData.partNumber || currentPart,
            questionText: responseData.questionText,
            transcription: responseData.transcription,
            audioBase64: responseData.audioBase64,
            duration: responseData.duration,
            scores: responseData.scores,
            feedback: responseData.feedback,
            improvements: responseData.improvements,
            modelAnswer: responseData.modelAnswer
          });
        } else {
          console.error('[Evaluation] API returned failure or empty responses:', data);
        }
      }

      clearPendingTranscriptions();
      
      if (results.length === 0) {
        toast.error('评估失败，没有生成有效的评估结果');
        setEvaluatingProgress(null);
        setIsBackgroundEvaluating(false);
        setIsLoading(false);
        return;
      }
      
      // 雅思标准分数转换函数（0.5递增）
      const roundToHalf = (n: number) => Math.round(n * 2) / 2;
      
      // 计算平均分（确保是雅思标准分）
      const avgScores = {
        fluencyCoherence: roundToHalf(results.reduce((sum: number, r: any) => sum + (r.scores?.fluencyCoherence || 6), 0) / results.length),
        lexicalResource: roundToHalf(results.reduce((sum: number, r: any) => sum + (r.scores?.lexicalResource || 6), 0) / results.length),
        grammaticalRange: roundToHalf(results.reduce((sum: number, r: any) => sum + (r.scores?.grammaticalRange || 6), 0) / results.length),
        pronunciation: roundToHalf(results.reduce((sum: number, r: any) => sum + (r.scores?.pronunciation || 6), 0) / results.length),
        overall: 0
      };
      avgScores.overall = roundToHalf((avgScores.fluencyCoherence + avgScores.lexicalResource + avgScores.grammaticalRange + avgScores.pronunciation) / 4);

      const evaluationData = {
        partNumber: currentPart,
        averageScores: avgScores,
        partBandScore: avgScores.overall,
        responses: results
      };
      
      console.log('[Evaluation] Setting currentEvaluation:', evaluationData);
      setCurrentEvaluation(evaluationData);

      setEvaluatingProgress({ current: total, total, message: '评估完成！' });
      toast.success(`Part ${currentPart} 评估完成！`);
      
      setTimeout(() => {
        setEvaluatingProgress(null);
        setView('result');
      }, 500);
    } catch (error) {
      console.error('Evaluation error:', error);
      toast.error('评估服务出错');
      setEvaluatingProgress(null);
    }
    setIsLoading(false);
  };

  const goToNextPart = async () => {
    if (testMode === 'full' && currentPart < 3) {
      const nextPart = currentPart + 1;
      setCurrentPart(nextPart);
      await fetchQuestions(nextPart, selectedTopic);
      setView('test');
      toast.info(`进入 Part ${nextPart}`);
    } else {
      // 完成测试，跳转到完成页面
      setView('completed');
    }
  };

  // 启动后台评估 - 立即返回，不阻塞 UI
  const startBackgroundEvaluation = async () => {
    const allTranscriptions = useIELTSStore.getState().pendingTranscriptions;

    if (allTranscriptions.length === 0) {
      toast.error('没有待评估的回答');
      return;
    }

    // 不设置 isLoading，不阻塞 UI
    toast.info('正在提交评估，请稍后在历史记录查看结果...');

    try {
      // 调用后台评估 API - 立即返回，评估在后台进行
      const response = await fetch('/api/evaluate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          transcriptions: allTranscriptions
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('评估已在后台进行，请稍后在历史记录查看结果');
        clearPendingTranscriptions();

        // 立即跳转到历史记录页面，不阻塞
        fetchHistory();
        setView('history');
      } else {
        toast.error(data.error || '启动评估失败');
      }
    } catch (error) {
      console.error('Start evaluation error:', error);
      toast.error('启动评估失败');
    }
  };

  const evaluateAllParts = async () => {
    const allTranscriptions = useIELTSStore.getState().pendingTranscriptions;

    if (allTranscriptions.length === 0) {
      toast.error('没有待评估的回答');
      return;
    }

    // 显示后台评估提示
    setIsBackgroundEvaluating(true);
    setBackgroundEvalSessionId(sessionId);
    setIsLoading(true);

    const total = allTranscriptions.length;
    setEvaluatingProgress({ current: 0, total, message: '准备评估...' });

    try {
      const results = [];
      for (let i = 0; i < allTranscriptions.length; i++) {
        const t = allTranscriptions[i];
        setEvaluatingProgress({
          current: i + 1,
          total,
          message: `正在评估第 ${i + 1}/${total} 个回答...`
        });

        const response = await fetch('/api/evaluate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            partNumber: 0,
            transcriptions: [t]
          })
        });

        const data = await response.json();

        if (data.success && data.responses?.length > 0) {
          results.push(data.responses[0]);

          const responseData: ResponseData = {
            partNumber: data.responses[0].partNumber || t.partNumber,
            questionText: data.responses[0].questionText,
            transcription: data.responses[0].transcription,
            audioBase64: data.responses[0].audioBase64,
            duration: data.responses[0].duration,
            scores: data.responses[0].scores,
            feedback: data.responses[0].feedback,
            improvements: data.responses[0].improvements,
            modelAnswer: data.responses[0].modelAnswer
          };
          addResponse(responseData);
        }
      }

      clearPendingTranscriptions();
      
      // 雅思标准分数转换函数（0.5递增）
      const roundToHalf = (n: number) => Math.round(n * 2) / 2;
      
      // 计算平均分（确保是雅思标准分）
      const avgScores = {
        fluencyCoherence: roundToHalf(results.reduce((sum: number, r: any) => sum + (r.scores?.fluencyCoherence || 6), 0) / results.length),
        lexicalResource: roundToHalf(results.reduce((sum: number, r: any) => sum + (r.scores?.lexicalResource || 6), 0) / results.length),
        grammaticalRange: roundToHalf(results.reduce((sum: number, r: any) => sum + (r.scores?.grammaticalRange || 6), 0) / results.length),
        pronunciation: roundToHalf(results.reduce((sum: number, r: any) => sum + (r.scores?.pronunciation || 6), 0) / results.length),
        overall: 0
      };
      avgScores.overall = roundToHalf((avgScores.fluencyCoherence + avgScores.lexicalResource + avgScores.grammaticalRange + avgScores.pronunciation) / 4);

      setCurrentEvaluation({
        partNumber: 0,
        averageScores: avgScores,
        partBandScore: avgScores.overall,
        responses: results
      });

      setEvaluatingProgress({ current: total, total, message: '评估完成！' });
      toast.success('模拟测试评估完成！');

      setTimeout(() => {
        setEvaluatingProgress(null);
        setIsBackgroundEvaluating(false);
        setView('result');
      }, 500);
    } catch (error) {
      console.error('Evaluation error:', error);
      toast.error('评估服务出错');
      setEvaluatingProgress(null);
    }
    setIsLoading(false);
  };

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/history?limit=20&userId=${encodeURIComponent(user.userId)}`);
      const data = await response.json();
      if (data.success) {
        setHistorySessions(data.sessions);
      }
    } catch {
      toast.error('获取历史记录失败');
    }
    setIsLoading(false);
  };

  // Initialize user
  useEffect(() => {
    initUser();
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (data.success && data.user) {
        setAuthUser(data.user);
        setUser({
          userId: data.user.id,
          username: data.user.username,
          name: data.user.name,
          level: data.user.level,
          isLoggedIn: true,
          createdAt: data.user.createdAt || new Date().toISOString()
        });
        loadServerSettings();
      }
    } catch (error) {
      console.log('[Auth] Not logged in');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setAuthUser(null);
      logout();
      toast.success('已退出登录');
    } catch (error) {
      toast.error('退出失败');
    }
  };

  useEffect(() => {
    if (user.userId) fetchHistory();
  }, [user.userId]);

  // 结束 Part 3 动态讨论
  const handleEndPart3Discussion = async () => {
    endPart3Discussion();
    // 启动后台评估
    const pending = useIELTSStore.getState().pendingTranscriptions;
    if (pending.length > 0) {
      startBackgroundEvaluation();
    } else {
      toast.warning('没有待评估的回答');
      setView('result');
    }
  };

  // Render different views
  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <HomeView 
          onStartTest={openTopicDialog} 
          onViewHistory={() => { fetchHistory(); setView('history'); }}
          onLearnExpression={() => setView('expression')}
        />;
      case 'test':
        // Part 3 使用动态讨论视图
        if (currentPart === 3 && part3Discussion.isActive) {
          return <Part3DiscussionView 
            discussion={part3Discussion}
            isRecording={isRecording}
            recordingDuration={recordingDuration}
            isLoading={isLoading}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            settings={settings}
            onEndDiscussion={handleEndPart3Discussion}
            sessionId={sessionId}
          />;
        }
        return <TestView 
          questions={questions}
          currentQuestionIndex={currentQuestionIndex}
          currentPart={currentPart}
          isRecording={isRecording}
          recordingDuration={recordingDuration}
          isLoading={isLoading}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onPrevQuestion={prevQuestion}
          onNextQuestion={() => {
            if (currentQuestionIndex < questions.length - 1) {
              nextQuestion();
            } else {
              const pending = useIELTSStore.getState().pendingTranscriptions;
              if (pending.length === questions.length) {
                // 使用后台评估，不阻塞 UI
                startBackgroundEvaluation();
              } else {
                toast.warning('请完成所有题目的录音后再评分');
              }
            }
          }}
          testMode={testMode}
          pendingCount={pendingTranscriptions.length}
          sessionId={sessionId}
          settings={settings}
          updateSetting={updateSetting}
        />;
      case 'completed':
        return <CompletedView
          testMode={testMode}
          pendingCount={pendingTranscriptions.length}
          onStartEvaluation={startBackgroundEvaluation}
          onViewHistory={() => { fetchHistory(); setView('history'); }}
        />;
      case 'result':
        return <ResultView 
          evaluation={currentEvaluation}
          onNext={goToNextPart}
          onRetry={() => setView('test')}
          sessionId={sessionId}
        />;
      case 'history':
        return <HistoryView 
          sessions={historySessions}
          onBack={() => setView('home')}
          onRefresh={fetchHistory}
        />;
      case 'questionBank':
        return <QuestionBankView isLoading={isLoading} setIsLoading={setIsLoading} user={user} showLoginDialog={() => setShowLoginDialog(true)} />;
      case 'settings':
        return <SettingsView settings={settings} updateSetting={updateSetting} user={user} />;
      case 'admin':
        return <AdminView onBack={() => setView('home')} />;
      case 'expression':
        return <ExpressionView onBack={() => setView('home')} />;
      default:
        return <HomeView 
          onStartTest={openTopicDialog} 
          onViewHistory={() => { fetchHistory(); setView('history'); }}
          onLearnExpression={() => setView('expression')}
        />;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#E31837] text-white">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={goHome}>
            <svg width="60" height="24" viewBox="0 0 60 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text x="2" y="17" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="bold" fill="white" letter-spacing="1.5">
                IELTS
              </text>
              <rect x="2" y="20" width="45" height="2" rx="1" fill="white"/>
            </svg>
          </div>
          
          <div className="flex items-center gap-2">
            <nav className="flex items-center">
              {[
                { label: '首页', view: 'home' as const, action: goHome },
                { label: '历史', view: 'history' as const, action: () => { fetchHistory(); setView('history'); } },
                { label: '题库', view: 'questionBank' as const, action: () => setView('questionBank') },
                { label: '设置', view: 'settings' as const, action: () => setView('settings') },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className={`px-4 py-4 text-sm transition-colors ${
                    currentView === item.view 
                      ? 'text-white bg-white/10' 
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            
            {authUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-white/20">
                {/* 管理员入口 */}
                {authUser.role === 'admin' && (
                  <button
                    onClick={() => setView('admin')}
                    className={`p-2 rounded transition-colors ${
                      currentView === 'admin'
                        ? 'text-white bg-white/20'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                    title="管理后台"
                  >
                    <Shield className="w-4 h-4" />
                  </button>
                )}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/10">
                  <User className="w-4 h-4" />
                  <span className="text-sm">{authUser.username}</span>
                </div>
                <button onClick={handleLogout} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors" title="退出登录">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginDialog(true)}
                className="ml-2 px-4 py-2 bg-white text-[#E31837] rounded text-sm font-medium hover:bg-white/90 transition-colors"
              >
                登录
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {renderView()}
      </main>

      {/* Topic Dialog */}
      <Dialog open={showTopicDialog} onOpenChange={setShowTopicDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              选择练习话题
            </DialogTitle>
            <DialogDescription>
              选择题库和话题开始练习
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* 题库选择 */}
            {questionPools.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-2 block">选择题库</Label>
                <div className="grid grid-cols-2 gap-2">
                  {questionPools.map((pool) => (
                    <button
                      key={pool.id}
                      onClick={() => setSelectedPoolId(pool.id)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        selectedPoolId === pool.id 
                          ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{pool.name}</span>
                        {pool.isDefault && (
                          <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-600 border-indigo-200">默认</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Part 1: {pool.part1Count || 0} | Part 2: {pool.part2Count || 0} | Part 3: {pool.part3Count || 0}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Topic mode selection */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="topicMode"
                  checked={!useCustomTopic}
                  onChange={() => setUseCustomTopic(false)}
                  className="w-4 h-4 text-[#E31837]"
                />
                <span className="text-sm">选择预设话题</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="topicMode"
                  checked={useCustomTopic}
                  onChange={() => setUseCustomTopic(true)}
                  className="w-4 h-4 text-[#E31837]"
                />
                <span className="text-sm">自定义话题</span>
              </label>
            </div>

            {!useCustomTopic ? (
              <>
                {/* Part 1 topics */}
                {(pendingTestMode === 'part1' || pendingTestMode === 'full') && (
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">Part 1 话题</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {TOPICS.part1.map((topic) => (
                        <button
                          key={topic}
                          onClick={() => setSelectedPartTopics(prev => ({ ...prev, part1: topic }))}
                          className={`p-2 rounded-lg border text-left transition-all text-sm ${
                            selectedPartTopics.part1 === topic ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Part 2 topics */}
                {(pendingTestMode === 'part2' || pendingTestMode === 'full') && (
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">Part 2 话题</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {TOPICS.part2.map((topic) => (
                        <button
                          key={topic}
                          onClick={() => setSelectedPartTopics(prev => ({ ...prev, part2: topic }))}
                          className={`p-2 rounded-lg border text-left transition-all text-sm ${
                            selectedPartTopics.part2 === topic ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Part 3 topics */}
                {(pendingTestMode === 'part3' || pendingTestMode === 'full') && (
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">Part 3 话题</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {TOPICS.part3.map((topic) => (
                        <button
                          key={topic}
                          onClick={() => setSelectedPartTopics(prev => ({ ...prev, part3: topic }))}
                          className={`p-2 rounded-lg border text-left transition-all text-sm ${
                            selectedPartTopics.part3 === topic ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-2 block">输入自定义话题</Label>
                <Input
                  placeholder="例如：Music, Sports, Travel..."
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">将根据您输入的话题生成相关题目</p>
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => pendingTestMode && startTestDirectly(pendingTestMode)}>
              随机话题开始
            </Button>
            <Button onClick={confirmTopicAndStartTest} className="bg-[#E31837] hover:bg-[#C4142D]">
              确认并开始
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Login Dialog */}
      <LoginDialog
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
        onSuccess={(user) => {
          setAuthUser(user);
          setUser({
            userId: user.id,
            username: user.username,
            name: user.name,
            level: user.level,
            isLoggedIn: true,
            createdAt: user.createdAt || new Date().toISOString()
          });
          loadServerSettings();
        }}
        onSwitchToRegister={() => {
          setShowLoginDialog(false);
          setShowRegisterDialog(true);
        }}
      />

      {/* Register Dialog */}
      <RegisterDialog
        open={showRegisterDialog}
        onOpenChange={setShowRegisterDialog}
        onSuccess={(user) => {
          setAuthUser(user);
          setUser({
            userId: user.id,
            username: user.username,
            name: user.name,
            isLoggedIn: true,
            createdAt: user.createdAt || new Date().toISOString()
          });
          loadServerSettings();
        }}
        onSwitchToLogin={() => {
          setShowRegisterDialog(false);
          setShowLoginDialog(true);
        }}
      />

      {/* Loading indicator */}
      {isLoading && !evaluatingProgress && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-[#eaeaea] rounded shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin text-[#E31837]" />
            <span className="text-sm text-[#666666]">处理中...</span>
          </div>
        </div>
      )}

      {/* Evaluation progress indicator - 后台评估提示 */}
      {evaluatingProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-md w-full mx-4">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-[#E31837] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#222222] mb-2">正在后台评估中</h3>
              <p className="text-sm text-[#666666] mb-2">{evaluatingProgress.message}</p>
              <p className="text-xs text-amber-600 mb-4">
                评估需要一定时间，请耐心等待。评估完成后将自动显示结果。
              </p>
              
              {/* Progress bar */}
              <div className="w-full bg-slate-200 rounded-full h-3 mb-2">
                <div 
                  className="bg-[#E31837] h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(evaluatingProgress.current / evaluatingProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">
                {evaluatingProgress.current} / {evaluatingProgress.total} 个回答已评估
              </p>
              
              {/* 预计时间 */}
              <p className="text-xs text-slate-400 mt-3">
                预计还需 {Math.ceil((evaluatingProgress.total - evaluatingProgress.current) * 0.5)} 秒
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Completed View - 测试完成页面
function CompletedView({
  testMode,
  pendingCount,
  onStartEvaluation,
  onViewHistory
}: {
  testMode: string;
  pendingCount: number;
  onStartEvaluation: () => void;
  onViewHistory: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto">
      <Card className="border-0 shadow-sm">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-xl">测试完成</CardTitle>
          <CardDescription>
            {testMode === 'full' ? '模拟测试已完成' : `Part ${testMode.replace('part', '')} 测试已完成`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">已录制回答</span>
              <span className="font-medium text-slate-900">{pendingCount} 个</span>
            </div>
            {pendingCount === 0 && (
              <p className="text-xs text-amber-600 mt-2">
                没有录制到有效回答，无法进行评分
              </p>
            )}
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">评分说明</p>
                <p className="text-blue-600">
                  点击"开始评分"后，系统将在后台进行评估。您可以继续浏览其他页面，
                  评估完成后可在"历史记录"中查看详细结果。
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            onClick={onStartEvaluation}
            disabled={pendingCount === 0}
            className="w-full bg-[#E31837] hover:bg-[#C4142D] h-11"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            开始评分
          </Button>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              onClick={onViewHistory}
              className="flex-1"
            >
              <History className="w-4 h-4 mr-2" />
              查看历史记录
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

// 公告类型定义
interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

// 公告组件
function AnnouncementBanner({ announcements }: { announcements: Announcement[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  if (announcements.length === 0 || !isVisible) return null;

  const current = announcements[currentIndex];

  // 根据类型设置样式
  const getStyle = (type: string) => {
    switch (type) {
      case 'maintenance':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'update':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'maintenance':
        return '🔧';
      case 'warning':
        return '⚠️';
      case 'update':
        return '📢';
      default:
        return '📣';
    }
  };

  return (
    <div className={`-mx-4 px-4 py-3 border-b ${getStyle(current.type)}`}>
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-lg shrink-0">{getIcon(current.type)}</span>
          <div className="min-w-0">
            {current.title && (
              <span className="font-medium mr-2">{current.title}:</span>
            )}
            <span className="text-sm">{current.content}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {announcements.length > 1 && (
            <div className="flex items-center gap-1 mr-2">
              {announcements.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentIndex ? 'bg-current' : 'bg-current/30'
                  }`}
                />
              ))}
            </div>
          )}
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-black/5 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// 地道表达学习页面
function ExpressionView({ onBack }: { onBack: () => void }) {
  const [expression, setExpression] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'part1' | 'part2' | 'part3'>('overview');

  useEffect(() => {
    const fetchExpression = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/daily-expression');
        const data = await response.json();
        if (data.success && data.expression) {
          setExpression(data.expression);
        }
      } catch (error) {
        console.error('[Expression] Fetch error:', error);
      }
      setLoading(false);
    };
    fetchExpression();
  }, []);

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      idiom: '习语',
      collocation: '固定搭配',
      phrasal_verb: '动词短语',
      slang: '俚语'
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      idiom: 'bg-purple-100 text-purple-700',
      collocation: 'bg-blue-100 text-blue-700',
      phrasal_verb: 'bg-green-100 text-green-700',
      slang: 'bg-orange-100 text-orange-700'
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#E31837]" />
        </div>
      </div>
    );
  }

  if (!expression) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-600 mb-6">
          <ChevronLeft className="w-5 h-5" />
          返回首页
        </button>
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-slate-500">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无今日地道表达</p>
            <p className="text-sm mt-1">请稍后再试</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* 返回按钮 */}
      <button onClick={onBack} className="flex items-center gap-2 text-slate-600 mb-6 hover:text-slate-900">
        <ChevronLeft className="w-5 h-5" />
        返回首页
      </button>

      {/* 主卡片 */}
      <Card className="overflow-hidden">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">📚</span>
            <Badge className="bg-white/20 text-white border-0">每日地道表达</Badge>
            <Badge className={`ml-auto ${getCategoryColor(expression.category)}`}>
              {getCategoryLabel(expression.category)}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold mb-2">{expression.expression}</h1>
          <p className="text-white/90 text-lg">{expression.meaning}</p>
          {expression.meaningEn && (
            <p className="text-white/70 text-sm mt-2">{expression.meaningEn}</p>
          )}
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b">
          {[
            { key: 'overview', label: '概述' },
            { key: 'part1', label: 'Part 1' },
            { key: 'part2', label: 'Part 2' },
            { key: 'part3', label: 'Part 3' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-[#E31837] border-b-2 border-[#E31837]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 内容 */}
        <CardContent className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 发音提示 */}
              {expression.pronunciation && (
                <div>
                  <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-indigo-500" />
                    发音提示
                  </h3>
                  <p className="text-slate-600 bg-indigo-50 p-3 rounded-lg">{expression.pronunciation}</p>
                </div>
              )}

              {/* 使用技巧 */}
              {expression.usageTips && (
                <div>
                  <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    使用技巧
                  </h3>
                  <p className="text-slate-600 bg-amber-50 p-3 rounded-lg">{expression.usageTips}</p>
                </div>
              )}

              {/* 常见错误 */}
              {expression.commonMistakes && (
                <div>
                  <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    常见错误
                  </h3>
                  <p className="text-slate-600 bg-red-50 p-3 rounded-lg">{expression.commonMistakes}</p>
                </div>
              )}

              {/* 同义替换 */}
              {expression.alternatives && (
                <div>
                  <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-green-500" />
                    同义替换
                  </h3>
                  <p className="text-slate-600 bg-green-50 p-3 rounded-lg">{expression.alternatives}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'part1' && (
            <div>
              <div className="mb-4">
                <Badge className="bg-blue-100 text-blue-700">Part 1 应用</Badge>
                <p className="text-xs text-slate-500 mt-1">简介与面试环节，简单日常话题</p>
              </div>
              {expression.part1Example ? (
                <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                  <div className="prose prose-sm max-w-none">
                    {expression.part1Example.split('\n').map((line: string, i: number) => (
                      <p key={i} className={line.startsWith('Q:') || line.startsWith('Question:') ? 'font-medium text-slate-700' : 'text-slate-600'}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">暂无 Part 1 示例</p>
              )}
            </div>
          )}

          {activeTab === 'part2' && (
            <div>
              <div className="mb-4">
                <Badge className="bg-green-100 text-green-700">Part 2 应用</Badge>
                <p className="text-xs text-slate-500 mt-1">个人陈述环节，2分钟独白话题</p>
              </div>
              {expression.part2Example ? (
                <div className="bg-green-50 p-4 rounded-lg space-y-3">
                  <div className="prose prose-sm max-w-none">
                    {expression.part2Example.split('\n').map((line: string, i: number) => (
                      <p key={i} className={line.startsWith('•') ? 'text-slate-600 pl-2' : 'text-slate-600'}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">暂无 Part 2 示例</p>
              )}
            </div>
          )}

          {activeTab === 'part3' && (
            <div>
              <div className="mb-4">
                <Badge className="bg-purple-100 text-purple-700">Part 3 应用</Badge>
                <p className="text-xs text-slate-500 mt-1">双向讨论环节，抽象话题深入分析</p>
              </div>
              {expression.part3Example ? (
                <div className="bg-purple-50 p-4 rounded-lg space-y-3">
                  <div className="prose prose-sm max-w-none">
                    {expression.part3Example.split('\n').map((line: string, i: number) => (
                      <p key={i} className={line.startsWith('Q:') || line.startsWith('Question:') ? 'font-medium text-slate-700' : 'text-slate-600'}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">暂无 Part 3 示例</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 底部提示 */}
      <div className="mt-6 text-center text-slate-500 text-sm">
        <p>💡 每天学习一个地道表达，提升你的雅思口语分数</p>
        <p className="text-xs mt-1">每24小时自动更新新内容</p>
      </div>
    </div>
  );
}

// Home View
function HomeView({ onStartTest, onViewHistory, onLearnExpression }: { 
  onStartTest: (mode: 'part1' | 'part2' | 'part3' | 'full') => void;
  onViewHistory?: () => void;
  onLearnExpression?: () => void;
}) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [todayExpression, setTodayExpression] = useState<any>(null);

  // 获取公告
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const response = await fetch('/api/announcement');
        const data = await response.json();
        if (data.success) {
          setAnnouncements(data.announcements);
        }
      } catch (error) {
        console.error('[Announcement] Fetch error:', error);
      }
    };
    fetchAnnouncements();
  }, []);

  // 预加载今日地道表达
  useEffect(() => {
    const fetchExpression = async () => {
      try {
        const response = await fetch('/api/daily-expression');
        const data = await response.json();
        if (data.success && data.expression) {
          setTodayExpression(data.expression);
        }
      } catch (error) {
        console.error('[Expression] Fetch error:', error);
      }
    };
    fetchExpression();
  }, []);

  return (
    <div className="space-y-0">
      {/* 公告横幅 */}
      <AnnouncementBanner announcements={announcements} />
      
      <div className="bg-[#f8f8f8] -mx-4 px-4 py-16 text-center border-b border-[#eaeaea]">
        {/* IELTS Logo */}
        <div className="flex justify-center mb-4">
          <svg width="90" height="36" viewBox="0 0 90 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text x="5" y="26" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="bold" fill="#E31837" letter-spacing="2">
              IELTS
            </text>
            <rect x="5" y="30" width="70" height="3" rx="1.5" fill="#E31837"/>
          </svg>
        </div>
        <h1 className="text-2xl font-medium text-[#666666] mb-2">口语练习</h1>
        <p className="text-[#999999] text-sm">专业评估 · 个性化反馈</p>
      </div>

      <div className="px-1 pt-10 pb-8">
        <h2 className="text-xs font-semibold text-[#666666] mb-4 uppercase tracking-wider">选择测试模式</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { mode: 'part1' as const, label: 'Part 1', desc: '简介与面试 · 8-15题 · 4-5分钟' },
            { mode: 'part2' as const, label: 'Part 2', desc: '个人陈述 · 1题 · 3-4分钟' },
            { mode: 'part3' as const, label: 'Part 3', desc: '双向讨论 · 5-10题 · 4-5分钟' },
            { mode: 'full' as const, label: '模拟测试', desc: '完整模拟 · 14-26题 · 11-14分钟', isFull: true },
          ].map((item) => (
            <button
              key={item.mode}
              className={`p-5 rounded-lg border transition-all text-left ${item.isFull ? 'bg-[#E31837] border-[#E31837] hover:bg-[#C4142D]' : 'bg-white border-[#eaeaea] hover:border-[#E31837] hover:shadow-sm'}`}
              onClick={() => onStartTest(item.mode)}
            >
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded flex items-center justify-center font-bold ${item.isFull ? 'bg-white/20 text-white' : 'bg-[#f5f5f5] text-[#E31837]'}`}>
                  {item.isFull ? '全部' : item.label.replace('Part ', '0')}
                </div>
                <div>
                  <h3 className={`font-semibold text-base ${item.isFull ? 'text-white' : 'text-[#222222]'}`}>{item.label}</h3>
                  <p className={`text-xs mt-0.5 ${item.isFull ? 'text-white/70' : 'text-[#666666]'}`}>{item.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 每日地道表达入口 */}
      {todayExpression && (
        <div className="px-1 pb-6">
          <button
            onClick={() => onLearnExpression?.()}
            className="w-full p-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-left shadow-lg hover:shadow-xl transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📚</span>
                  <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded-full">每日地道表达</span>
                </div>
                <h3 className="font-semibold text-lg mb-1">{todayExpression.expression}</h3>
                <p className="text-sm text-white/80">{todayExpression.meaning}</p>
              </div>
              <div className="text-white/60 ml-4">
                <ChevronRight className="w-6 h-6" />
              </div>
            </div>
          </button>
        </div>
      )}

      <div className="bg-[#f5f5f5] -mx-4 px-4 py-10 mt-4">
        <h3 className="text-xs font-semibold text-[#666666] mb-5 uppercase tracking-wider">评分标准</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { abbr: 'FC', name: '流利度与连贯性' },
            { abbr: 'LR', name: '词汇丰富度' },
            { abbr: 'GRA', name: '语法多样性' },
            { abbr: 'P', name: '发音准确度' },
          ].map((item) => (
            <div key={item.abbr} className="bg-white p-4 rounded border border-[#eaeaea] text-center">
              <div className="text-lg font-bold text-[#E31837]">{item.abbr}</div>
              <div className="text-xs text-[#666666] mt-1">{item.name}</div>
            </div>
          ))}
        </div>
      </div>

      <footer className="bg-[#333333] -mx-4 px-4 py-8 text-center">
        <div className="flex justify-center mb-3">
          <svg width="60" height="24" viewBox="0 0 60 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text x="2" y="17" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="bold" fill="white" letter-spacing="1.5" opacity="0.8">
              IELTS
            </text>
            <rect x="2" y="20" width="45" height="2" rx="1" fill="white" opacity="0.6"/>
          </svg>
        </div>
        <p className="text-white/40 text-xs">口语练习平台</p>
      </footer>
    </div>
  );
}

// Test View
function TestView({ 
  questions, currentQuestionIndex, currentPart, isRecording, recordingDuration,
  isLoading, onStartRecording, onStopRecording, onPrevQuestion, onNextQuestion, testMode,
  pendingCount, settings, updateSetting
}: {
  questions: Array<{ id: string; questionText: string; category?: string }>;
  currentQuestionIndex: number;
  currentPart: number;
  isRecording: boolean;
  recordingDuration: number | undefined | null;
  isLoading: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPrevQuestion: () => void;
  onNextQuestion: () => void;
  testMode: string;
  pendingCount: number;
  sessionId?: string | null;
  settings: { defaultVoice: string; voiceSpeed: number; showQuestionAfterSpeech: boolean; autoPlayQuestion: boolean };
  updateSetting: <K extends keyof { defaultVoice: string; voiceSpeed: number; showQuestionAfterSpeech: boolean; autoPlayQuestion: boolean }>(key: K, value: { defaultVoice: string; voiceSpeed: number; showQuestionAfterSpeech: boolean; autoPlayQuestion: boolean }[K]) => void;
}) {
  // 浏览器兼容性检测
  const [browserSupport, setBrowserSupport] = useState<{
    checked: boolean;
    isSecure: boolean;
    mediaDevices: boolean;
    getUserMedia: boolean;
    mediaRecorder: boolean;
    supported: boolean;
    message: string;
  }>({ checked: false, isSecure: false, mediaDevices: false, getUserMedia: false, mediaRecorder: false, supported: false, message: '' });
  
  // 检测浏览器兼容性
  useEffect(() => {
    const checkBrowserSupport = () => {
      // 检测是否是安全上下文 (HTTPS 或 localhost)
      const isSecure = typeof window !== 'undefined' && 
        (window.location.protocol === 'https:' || 
         window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1');
      
      // 在非安全上下文中，navigator.mediaDevices 可能不存在
      const mediaDevices = typeof navigator !== 'undefined' && !!navigator.mediaDevices;
      const getUserMedia = mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
      const mediaRecorder = typeof MediaRecorder !== 'undefined';
      
      let message = '';
      if (!isSecure) {
        message = '录音功能需要 HTTPS 安全连接。请使用 https:// 访问，或使用微信打开链接。';
      } else if (!mediaDevices) {
        message = '您的浏览器不支持录音功能。请使用 Chrome、Safari、Edge 等现代浏览器。';
      } else if (!getUserMedia) {
        message = '您的浏览器不支持麦克风访问。请使用现代浏览器。';
      } else if (!mediaRecorder) {
        message = '您的浏览器不支持录音功能。请更新浏览器版本。';
      }
      
      const supported = isSecure && mediaDevices && getUserMedia && mediaRecorder;
      
      setBrowserSupport({
        checked: true,
        isSecure,
        mediaDevices,
        getUserMedia,
        mediaRecorder,
        supported,
        message
      });
      
      console.log('[Browser Support]', { 
        protocol: typeof window !== 'undefined' ? window.location.protocol : 'unknown',
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        isSecure, 
        mediaDevices, 
        getUserMedia, 
        mediaRecorder, 
        supported 
      });
      
      // 如果不支持，显示警告
      if (!supported) {
        console.warn('[Browser Support] NOT SUPPORTED:', message);
      }
    };
    
    checkBrowserSupport();
  }, []);
  
  // 处理录音按钮点击
  const handleStartRecording = () => {
    console.log('[TestView] Start recording button clicked');
    
    if (!browserSupport.supported) {
      toast.error(browserSupport.message || '您的浏览器不支持录音功能');
      return;
    }
    
    onStartRecording();
  };
  const currentQuestion = questions[currentQuestionIndex];
  // 追踪当前题目是否已录音
  const [currentQuestionRecorded, setCurrentQuestionRecorded] = useState(false);
  // showQuestionAfterSpeech=true: 播放完毕后自动显示文本
  // showQuestionAfterSpeech=false: 始终需要手动点击显示
  // 无论设置如何，初始状态都是隐藏
  const [showQuestion, setShowQuestion] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [needsManualPlay, setNeedsManualPlay] = useState(false); // 移动端需要手动播放
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevQuestionIdRef = useRef<string | null>(null);
  
  // 移动端检测
  const isMobile = typeof window !== 'undefined' ? isMobileDevice() : false;

  // Part 2 准备时间倒计时
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepTimeLeft, setPrepTimeLeft] = useState(60); // 60秒准备时间
  const prepTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 开始准备倒计时
  const startPreparation = () => {
    setIsPreparing(true);
    setPrepTimeLeft(60);

    prepTimerRef.current = setInterval(() => {
      setPrepTimeLeft((prev) => {
        if (prev <= 1) {
          if (prepTimerRef.current) clearInterval(prepTimerRef.current);
          setIsPreparing(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 跳过准备时间
  const skipPreparation = () => {
    if (prepTimerRef.current) clearInterval(prepTimerRef.current);
    setIsPreparing(false);
    setPrepTimeLeft(0);
  };

  // 清理准备计时器
  useEffect(() => {
    return () => {
      if (prepTimerRef.current) clearInterval(prepTimerRef.current);
    };
  }, []);

  // 当题目变化时，Part 2 重置准备状态
  useEffect(() => {
    if (currentPart === 2 && currentQuestion?.id !== prevQuestionIdRef.current) {
      setIsPreparing(false);
      setPrepTimeLeft(60);
    }
  }, [currentQuestion?.id, currentPart]);

  // 播放题目音频
  const playQuestionAudio = useCallback(async () => {
    if (!currentQuestion?.questionText) {
      console.error('[Audio] No question text');
      return;
    }
    
    console.log('[Audio] Starting to play audio for:', currentQuestion.questionText.substring(0, 50));
    setAudioError(null);
    setIsLoadingAudio(true);
    
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentQuestion.questionText,
          voice: settings.defaultVoice,
          speed: settings.voiceSpeed
        })
      });

      console.log('[Audio] TTS response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Audio] TTS error:', errorData);
        throw new Error(errorData.error || `TTS 服务错误: ${response.status}`);
      }

      const audioBlob = await response.blob();
      console.log('[Audio] Received blob size:', audioBlob.size, 'type:', audioBlob.type);
      
      if (audioBlob.size < 100) {
        throw new Error('音频数据太小，可能生成失败');
      }
      
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.oncanplaythrough = () => {
        console.log('[Audio] Audio can play through');
        setIsLoadingAudio(false);
      };
      
      audio.onended = () => {
        console.log('[Audio] Audio ended');
        setIsPlayingAudio(false);
        if (settings.showQuestionAfterSpeech) {
          setShowQuestion(true);
        }
      };
      
      audio.onerror = (e) => {
        console.error('[Audio] Audio error:', e);
        setIsPlayingAudio(false);
        setIsLoadingAudio(false);
        setAudioError('音频播放失败，请点击"显示"按钮查看题目');
        if (settings.showQuestionAfterSpeech) {
          setShowQuestion(true);
        }
      };
      
      setIsLoadingAudio(false);
      setIsPlayingAudio(true);
      
      await audio.play();
      console.log('[Audio] Audio started playing');
      
    } catch (error: any) {
      console.error('[Audio] Play error:', error);
      setIsPlayingAudio(false);
      setIsLoadingAudio(false);
      setAudioError(error.message || '语音服务暂时不可用，请点击"显示"按钮查看题目');
      if (settings.showQuestionAfterSpeech) {
        setShowQuestion(true);
      }
    }
  }, [currentQuestion?.questionText, settings.defaultVoice, settings.voiceSpeed, settings.showQuestionAfterSpeech]);

  // 停止音频播放
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlayingAudio(false);
      setIsLoadingAudio(false);
    }
  }, []);

  // 题目变化时自动播放音频（移动端需要手动触发）
  useEffect(() => {
    if (currentQuestion && currentQuestion.id !== prevQuestionIdRef.current) {
      prevQuestionIdRef.current = currentQuestion.id;
      
      // 每次新题目都重置为隐藏状态
      setShowQuestion(false);
      setNeedsManualPlay(false);
      
      // 检查当前题目是否已被回答
      // 通过 pendingCount 判断：如果 pendingCount > currentQuestionIndex，说明当前题目已回答
      setCurrentQuestionRecorded(pendingCount > currentQuestionIndex);
      
      // 自动播放音频（移动端跳过自动播放，需要用户手动触发）
      if (settings.autoPlayQuestion) {
        if (isMobile) {
          // 移动端显示需要手动播放的提示
          setNeedsManualPlay(true);
          console.log('[Audio] Mobile device - manual play required');
        } else {
          // 桌面端正常自动播放
          const timer = setTimeout(() => {
            playQuestionAudio();
          }, 300);
          return () => clearTimeout(timer);
        }
      }
    }
    
    return () => {
      stopAudio();
    };
  }, [currentQuestion?.id, settings.autoPlayQuestion, playQuestionAudio, stopAudio, pendingCount, currentQuestionIndex, isMobile]);

  // 当 pendingCount 变化时，更新当前题目是否已回答
  useEffect(() => {
    setCurrentQuestionRecorded(pendingCount > currentQuestionIndex);
  }, [pendingCount, currentQuestionIndex]);

  // 组件卸载时清理音频
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, []);

  // 浏览器不兼容提示
  if (browserSupport.checked && !browserSupport.supported) {
    return (
      <Card className="border-2 border-red-200">
        <CardContent className="pt-8 pb-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-red-600 mb-2">无法使用录音功能</h3>
          <p className="text-sm text-slate-600 mb-4 px-4">{browserSupport.message}</p>
          <div className="text-xs text-slate-500 space-y-1 mb-4 p-3 bg-slate-50 rounded-lg">
            <p>安全连接 (HTTPS): {browserSupport.isSecure ? '✓' : '✗'}</p>
            <p>录音设备 API: {browserSupport.mediaDevices ? '✓' : '✗'}</p>
            <p>麦克风访问: {browserSupport.getUserMedia ? '✓' : '✗'}</p>
            <p>录音组件: {browserSupport.mediaRecorder ? '✓' : '✗'}</p>
          </div>
          {!browserSupport.isSecure && (
            <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg mb-4">
              <p className="font-medium">⚠️ 当前不是安全连接</p>
              <p className="mt-1">请使用微信扫描二维码打开，或确保地址栏显示 🔒 安全标志</p>
            </div>
          )}
          <p className="text-xs text-slate-400">
            建议使用：微信扫一扫 / Chrome 浏览器 / Safari 浏览器
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!currentQuestion) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
          <p className="text-sm text-slate-500 mt-3">加载中</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Badge variant="outline">Part {currentPart}</Badge>
        <Progress value={(currentQuestionIndex / questions.length) * 100} className="flex-1" />
        <span className="text-sm text-slate-500">{currentQuestionIndex + 1} / {questions.length}</span>
      </div>
      
      {/* 模拟测试模式显示总体进度 */}
      {testMode === 'full' && (
        <div className="bg-slate-100 rounded-lg px-4 py-2 text-center">
          <span className="text-sm text-slate-600">
            模拟测试进度：Part {currentPart} / 3
          </span>
        </div>
      )}

      {/* Part 2 Cue Card 样式 */}
      {currentPart === 2 ? (
        <Card className="border-2 border-red-100 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl text-[#E31837]">Cue Card</CardTitle>
                <Badge className="bg-red-100 text-[#E31837] hover:bg-red-100">Part 2</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={needsManualPlay ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setNeedsManualPlay(false);
                    if (isPlayingAudio) {
                      stopAudio();
                    } else {
                      playQuestionAudio();
                    }
                  }}
                  disabled={isLoadingAudio}
                  className={`gap-1 ${needsManualPlay ? 'bg-[#E31837] hover:bg-[#C4142D] animate-pulse' : ''}`}
                >
                  {isLoadingAudio ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isPlayingAudio ? (
                    <Square className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {/* 移动端播放提示 */}
            {needsManualPlay && isMobile && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                <p className="text-[#E31837] font-medium mb-1">👆 请点击上方播放按钮听题</p>
                <p className="text-xs text-slate-500">移动端需要手动点击播放音频</p>
              </div>
            )}
            
            {/* 准备阶段 - 显示开始准备按钮 */}
            {!isPreparing && prepTimeLeft === 60 && !isRecording && !currentQuestionRecorded ? (
              <div className="text-center py-8">
                <div className="bg-slate-50 rounded-xl p-6 mb-6">
                  <p className="text-[#E31837] font-medium mb-2">IELTS Speaking Part 2</p>
                  <p className="text-slate-600 text-sm">您将有 <strong>1 分钟</strong> 的准备时间，然后需要讲述 <strong>1-2 分钟</strong></p>
                </div>
                <Button 
                  onClick={startPreparation}
                  size="lg"
                  className="gap-2 bg-[#E31837] hover:bg-[#C4142D]"
                >
                  <Clock className="w-5 h-5" />
                  开始准备 (1分钟倒计时)
                </Button>
              </div>
            ) : isPreparing ? (
              /* 准备倒计时中 */
              <div className="text-center py-6">
                <div className="mb-6">
                  <div className="relative inline-flex items-center justify-center">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="#fee2e2"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="#E31837"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={352}
                        strokeDashoffset={352 * (1 - prepTimeLeft / 60)}
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-4xl font-bold text-[#E31837]">{prepTimeLeft}</span>
                    </div>
                  </div>
                  <p className="text-slate-600 mt-2">准备时间剩余 (秒)</p>
                </div>
                
                {/* Cue Card 内容 - 准备时可见 */}
                <div className="bg-slate-50 rounded-xl p-6 mb-6 text-left border border-slate-200">
                  <CueCardDisplay questionText={currentQuestion.questionText} />
                </div>

                <Button 
                  onClick={skipPreparation}
                  variant="outline"
                  className="gap-2"
                >
                  跳过准备，开始录音
                </Button>
              </div>
            ) : (
              /* 录音阶段 */
              <div className="space-y-6">
                {/* Cue Card 内容 */}
                <div className="bg-slate-50 rounded-xl p-6 text-left border border-slate-200">
                  <CueCardDisplay questionText={currentQuestion.questionText} />
                </div>

                {audioError && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {audioError}
                  </div>
                )}

                {/* Recording controls */}
                <div className="flex flex-col items-center gap-4">
                  {isRecording && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2 text-red-600">
                        <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
                        <span className="text-sm font-medium">录音中 {formatTime(recordingDuration)}</span>
                      </div>
                      {/* Part 2 时长提示 */}
                      {recordingDuration && recordingDuration < 60 && (
                        <span className="text-xs text-slate-500">建议录音 1-2 分钟</span>
                      )}
                      {recordingDuration && recordingDuration >= 60 && recordingDuration < 120 && (
                        <Badge variant="outline" className="text-green-600 border-green-300">✓ 建议时长已达标</Badge>
                      )}
                      {recordingDuration && recordingDuration >= 120 && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">时长充足，可停止录音</Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    {isRecording ? (
                      <Button onClick={onStopRecording} size="lg" variant="destructive" className="gap-2">
                        <Square className="w-5 h-5" />
                        停止录音
                      </Button>
                    ) : (
                      <Button 
                        onClick={handleStartRecording} 
                        size="lg" 
                        className="gap-2 bg-[#E31837] hover:bg-[#C4142D]"
                        disabled={isPlayingAudio}
                      >
                        <Mic className="w-5 h-5" />
                        开始录音 (1-2分钟)
                      </Button>
                    )}
                  </div>
                  
                  {isPlayingAudio && !isRecording && (
                    <p className="text-sm text-amber-600 flex items-center gap-2">
                      <Volume2 className="w-4 h-4" />
                      音频播放中，请等待播放完毕后再录音
                    </p>
                  )}

                  <p className="text-xs text-slate-500 text-center">
                    请根据 Cue Card 的提示，讲述 1-2 分钟
                  </p>

                  {/* 显示进度提示 */}
                  <div className="mt-4 text-center">
                    <p className="text-sm text-slate-600">
                      已回答 <span className="font-semibold text-[#E31837]">{pendingCount}</span> / {questions.length} 题
                    </p>
                    {!currentQuestionRecorded && (
                      <p className="text-xs text-amber-600 mt-1">请先录音回答当前题目</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between border-t border-slate-200 bg-slate-50/50">
            <Button variant="ghost" onClick={onPrevQuestion} disabled={currentQuestionIndex === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" /> 上一题
            </Button>
            <div className="text-sm text-slate-500">
              {currentQuestionRecorded ? (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">已录音</Badge>
              ) : (
                <span>请完成录音后继续</span>
              )}
            </div>
            <Button 
              variant="default"
              onClick={onNextQuestion}
              disabled={!currentQuestionRecorded}
              className={!currentQuestionRecorded ? 'opacity-50' : 'bg-[#E31837] hover:bg-[#C4142D]'}
            >
              {currentQuestionIndex < questions.length - 1 ? (
                <>
                  下一题
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  完成评分
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        /* Part 1 和 Part 3 的原有样式 */
        <Card>
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">问题 {currentQuestionIndex + 1}</CardTitle>
              <div className="flex items-center gap-2">
                {/* 播放/停止音频按钮 */}
                <Button
                  variant={needsManualPlay ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setNeedsManualPlay(false);
                    if (isPlayingAudio) {
                      stopAudio();
                    } else {
                      playQuestionAudio();
                    }
                  }}
                  disabled={isLoadingAudio}
                  className={`gap-1 ${needsManualPlay ? 'bg-[#E31837] hover:bg-[#C4142D] animate-pulse' : ''}`}
                >
                  {isLoadingAudio ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      加载中
                    </>
                  ) : isPlayingAudio ? (
                    <>
                      <Square className="w-4 h-4" />
                      停止
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" />
                      {needsManualPlay ? '点击播放题目' : '播放'}
                    </>
                  )}
                </Button>
                {/* 显示/隐藏题目按钮 */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuestion(!showQuestion)}
                  className="gap-1"
                >
                  <Eye className="w-4 h-4" />
                  {showQuestion ? '隐藏' : '显示'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {/* 移动端播放提示 */}
            {needsManualPlay && isMobile && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                <p className="text-[#E31837] font-medium mb-1">👆 请点击上方"播放"按钮听题</p>
                <p className="text-xs text-slate-500">移动端需要手动点击播放音频</p>
              </div>
            )}
            
            <div className="bg-slate-50 rounded-xl p-6 mb-6 min-h-[140px] flex items-center justify-center">
              {showQuestion ? (
                <p className="text-lg text-slate-800 whitespace-pre-line leading-relaxed">
                  {currentQuestion.questionText}
                </p>
              ) : (
                <div className="text-center text-slate-400">
                  <Volume2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">请先听题，然后作答</p>
                  <p className="text-xs mt-1">点击"显示"可查看题目文本</p>
                </div>
              )}
            </div>

            {audioError && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {audioError}
              </div>
            )}

            {/* Recording controls */}
            <div className="flex flex-col items-center gap-6">
              {isRecording && (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 text-red-600">
                    <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
                    <span className="text-sm font-medium">录音中 {formatTime(recordingDuration)}</span>
                  </div>
                  {/* Part 1/3 时长提示 */}
                  {currentPart === 1 && (
                    <>
                      {recordingDuration && recordingDuration < 20 && (
                        <span className="text-xs text-slate-500">建议回答 20-30 秒</span>
                      )}
                      {recordingDuration && recordingDuration >= 20 && recordingDuration < 40 && (
                        <Badge variant="outline" className="text-green-600 border-green-300">✓ 回答时长达标</Badge>
                      )}
                      {recordingDuration && recordingDuration >= 40 && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">回答充分，可停止录音</Badge>
                      )}
                    </>
                  )}
                  {currentPart === 3 && (
                    <>
                      {recordingDuration && recordingDuration < 30 && (
                        <span className="text-xs text-slate-500">建议回答 30-40 秒</span>
                      )}
                      {recordingDuration && recordingDuration >= 30 && recordingDuration < 50 && (
                        <Badge variant="outline" className="text-green-600 border-green-300">✓ 回答时长达标</Badge>
                      )}
                      {recordingDuration && recordingDuration >= 50 && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">回答充分，可停止录音</Badge>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4">
                {isRecording ? (
                  <Button onClick={onStopRecording} size="lg" variant="destructive" className="gap-2">
                    <Square className="w-5 h-5" />
                    停止录音
                  </Button>
                ) : (
                  <Button 
                    onClick={handleStartRecording} 
                    size="lg" 
                    className="gap-2 bg-[#E31837] hover:bg-[#C4142D]"
                    disabled={isPlayingAudio}
                  >
                    <Mic className="w-5 h-5" />
                    开始录音
                  </Button>
                )}
              </div>
              
              {isPlayingAudio && !isRecording && (
                <p className="text-sm text-amber-600 flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  音频播放中，请等待播放完毕后再录音
                </p>
              )}

              <p className="text-xs text-slate-500 text-center">
                点击"开始录音"后，请对着麦克风清晰回答问题
              </p>
              
              {/* 显示进度提示 */}
              <div className="mt-4 text-center">
                <p className="text-sm text-slate-600">
                  已回答 <span className="font-semibold text-[#E31837]">{pendingCount}</span> / {questions.length} 题
                </p>
                {!currentQuestionRecorded && (
                  <p className="text-xs text-amber-600 mt-1">请先录音回答当前题目</p>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={onPrevQuestion} disabled={currentQuestionIndex === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" /> 上一题
            </Button>
            <Button 
              variant="outline" 
              onClick={onNextQuestion}
              disabled={!currentQuestionRecorded}
              className={!currentQuestionRecorded ? 'opacity-50 cursor-not-allowed' : ''}
            >
              {currentQuestionIndex < questions.length - 1 ? (
                <>
                  下一题
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  完成评分
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

// Audio Player Component
function AudioPlayer({ audioBase64, audioId, duration, showDownload = false, onGenerateTTS, modelAnswer, modelAnswerAudioId }: { 
  audioBase64?: string; 
  audioId?: string;
  duration?: number; 
  showDownload?: boolean;
  onGenerateTTS?: () => void;
  modelAnswer?: string;
  modelAnswerAudioId?: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlayingModel, setIsPlayingModel] = useState(false);
  const [modelAudioBlob, setModelAudioBlob] = useState<Blob | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const modelAudioRef = useRef<HTMLAudioElement | null>(null);

  // 从 IndexedDB 加载录音
  useEffect(() => {
    const loadAudio = async () => {
      if (audioId) {
        try {
          const blob = await indexedDBAudio.getRecording(audioId.split('-')[0], audioId.split('-')[1] || audioId.split('-').slice(1).join('-'));
          if (blob) {
            setAudioBlob(blob);
            console.log('[AudioPlayer] Loaded from IndexedDB:', audioId);
          }
        } catch (err) {
          console.error('[AudioPlayer] Failed to load from IndexedDB:', err);
        }
      }
    };
    loadAudio();
  }, [audioId]);

  // 从 IndexedDB 加载参考回答音频
  useEffect(() => {
    const loadModelAudio = async () => {
      if (modelAnswerAudioId) {
        try {
          // modelAnswerAudioId 格式: sessionId-responseId-model
          // 需要正确解析
          const parts = modelAnswerAudioId.split('-');
          if (parts.length >= 2) {
            const sid = parts[0];
            const rid = parts.slice(1).join('-'); // 处理 responseId 可能包含 '-' 的情况
            const blob = await indexedDBAudio.getModelAnswerAudio(sid, rid);
            if (blob) {
              setModelAudioBlob(blob);
              console.log('[AudioPlayer] Loaded model answer audio from IndexedDB:', modelAnswerAudioId);
            } else {
              console.log('[AudioPlayer] No model answer audio found for:', modelAnswerAudioId);
            }
          }
        } catch (err) {
          console.error('[AudioPlayer] Failed to load model audio from IndexedDB:', err);
        }
      }
    };
    loadModelAudio();
  }, [modelAnswerAudioId]);

  const formatTimeDisplay = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playAudio = () => {
    // 优先使用 IndexedDB 的 Blob，其次使用 base64
    const audioSource = audioBlob || audioBase64;
    
    if (!audioSource) {
      setError('无录音数据');
      return;
    }
    
    setError(null);

    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
      return;
    }

    try {
      let audioSrc: string;
      if (audioBlob) {
        audioSrc = URL.createObjectURL(audioBlob);
      } else if (audioBase64) {
        audioSrc = audioBase64.startsWith('data:') 
          ? audioBase64 
          : `data:audio/webm;base64,${audioBase64}`;
      } else {
        setError('无音频源');
        return;
      }
      
      const audio = new Audio(audioSrc);
      audioRef.current = audio;
      
      audio.onloadedmetadata = () => {
        setAudioDuration(audio.duration);
      };
      
      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };
      
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        audioRef.current = null;
        if (audioBlob) URL.revokeObjectURL(audioSrc);
      };
      
      audio.onerror = (e) => {
        console.error('Audio error:', e);
        setIsPlaying(false);
        setError('音频播放失败');
        audioRef.current = null;
      };
      
      audio.play().catch((err) => {
        console.error('Play error:', err);
        setError('无法播放音频: ' + err.message);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    } catch (error) {
      console.error('Audio creation error:', error);
      setError('无法创建音频播放器');
    }
  };

  // 播放参考回答音频
  const playModelAnswerAudio = async () => {
    // 如果没有预加载的音频，生成新的
    if (!modelAudioBlob && onGenerateTTS) {
      onGenerateTTS();
      return;
    }
    
    if (!modelAudioBlob) {
      setError('无参考回答音频');
      return;
    }
    
    setError(null);
    
    if (modelAudioRef.current && isPlayingModel) {
      modelAudioRef.current.pause();
      modelAudioRef.current = null;
      setIsPlayingModel(false);
      return;
    }
    
    try {
      const audioSrc = URL.createObjectURL(modelAudioBlob);
      const audio = new Audio(audioSrc);
      modelAudioRef.current = audio;
      
      audio.onended = () => {
        setIsPlayingModel(false);
        modelAudioRef.current = null;
        URL.revokeObjectURL(audioSrc);
      };
      
      audio.onerror = () => {
        setIsPlayingModel(false);
        setError('参考回答音频播放失败');
        modelAudioRef.current = null;
      };
      
      await audio.play();
      setIsPlayingModel(true);
    } catch (err) {
      console.error('Model audio play error:', err);
      setError('无法播放参考回答音频');
    }
  };

  // 清理
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (modelAudioRef.current) {
        modelAudioRef.current.pause();
        modelAudioRef.current = null;
      }
    };
  }, []);

  // 下载录音
  const downloadAudio = () => {
    const audioSource = audioBlob || audioBase64;
    if (!audioSource) return;
    
    try {
      let audioSrc: string;
      if (audioBlob) {
        audioSrc = URL.createObjectURL(audioBlob);
      } else {
        audioSrc = audioBase64!.startsWith('data:') 
          ? audioBase64! 
          : `data:audio/webm;base64,${audioBase64!}`;
      }
      
      const link = document.createElement('a');
      link.href = audioSrc;
      link.download = `recording-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (audioBlob) URL.revokeObjectURL(audioSrc);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const hasAudio = audioBlob || audioBase64;
  if (!hasAudio && !modelAnswer) return null;

  // 使用传入的duration或音频实际时长
  const displayDuration = duration || audioDuration;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasAudio && (
        <Button
          variant="outline"
          size="sm"
          onClick={playAudio}
          className="gap-1"
        >
          {isPlaying ? (
            <>
              <Square className="w-4 h-4" />
              停止
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              播放录音
            </>
          )}
        </Button>
      )}
      
      {showDownload && hasAudio && (
        <Button
          variant="outline"
          size="sm"
          onClick={downloadAudio}
          className="gap-1"
        >
          <Download className="w-4 h-4" />
          下载
        </Button>
      )}
      
      {modelAnswer && (
        <Button
          variant="outline"
          size="sm"
          onClick={playModelAnswerAudio}
          className="gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
        >
          {isPlayingModel ? (
            <>
              <Square className="w-4 h-4" />
              停止参考
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              播放参考回答
            </>
          )}
        </Button>
      )}
      
      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
      {!error && isPlaying && (
        <span className="text-xs text-slate-500">
          {formatTimeDisplay(currentTime)} / {formatTimeDisplay(displayDuration)}
        </span>
      )}
      {!error && !isPlaying && displayDuration > 0 && (
        <span className="text-xs text-slate-500">
          {formatTimeDisplay(displayDuration)}
        </span>
      )}
    </div>
  );
}

// Result View
function ResultView({ evaluation, onNext, onRetry, sessionId }: {
  evaluation: any;
  onNext: () => void;
  onRetry: () => void;
  sessionId?: string | null;
}) {
  const [activeTab, setActiveTab] = useState<'scores' | 'responses' | 'improvements'>('scores');
  const [modelAudioUrls, setModelAudioUrls] = useState<Record<string, string>>({});
  const [generatingTTS, setGeneratingTTS] = useState<number | null>(null);
  const [playingModel, setPlayingModel] = useState<number | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<'us-female' | 'uk-female' | 'us-male' | 'uk-male'>('us-female');
  const [exampleAudioUrls, setExampleAudioUrls] = useState<Record<string, string>>({});
  const [playingExample, setPlayingExample] = useState<string | null>(null);
  const exampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const modelAudioRef = useRef<HTMLAudioElement | null>(null);

  // 语法修改和翻译状态
  const [grammarFixing, setGrammarFixing] = useState<number | null>(null);
  const [translating, setTranslating] = useState<{ index: number; type: 'transcription' | 'modelAnswer' } | null>(null);
  const [grammarResults, setGrammarResults] = useState<Record<number, { corrected: string; errors: any[] }>>({});
  const [translations, setTranslations] = useState<Record<string, string>>({});

  // 语法修改
  const fixGrammar = async (index: number, text: string) => {
    if (grammarResults[index]) {
      // 已有结果，清除
      setGrammarResults(prev => {
        const newResults = { ...prev };
        delete newResults[index];
        return newResults;
      });
      return;
    }

    setGrammarFixing(index);
    try {
      const response = await fetch('/api/grammar-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      if (data.success) {
        setGrammarResults(prev => ({ ...prev, [index]: data }));
      } else {
        toast.error(data.error || '语法修改失败');
      }
    } catch (error) {
      toast.error('语法修改服务出错');
    }
    setGrammarFixing(null);
  };

  // 翻译
  const translateText = async (index: number, text: string, type: 'transcription' | 'modelAnswer') => {
    const key = `${index}_${type}`;
    if (translations[key]) {
      // 已有翻译，清除
      setTranslations(prev => {
        const newTranslations = { ...prev };
        delete newTranslations[key];
        return newTranslations;
      });
      return;
    }

    setTranslating({ index, type });
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, type })
      });
      const data = await response.json();
      if (data.success) {
        setTranslations(prev => ({ ...prev, [key]: data.translation }));
      } else {
        toast.error(data.error || '翻译失败');
      }
    } catch (error) {
      toast.error('翻译服务出错');
    }
    setTranslating(null);
  };

  // 调试日志
  useEffect(() => {
    console.log('[ResultView] evaluation object:', evaluation);
    console.log('[ResultView] evaluation type:', typeof evaluation);
    if (evaluation) {
      console.log('[ResultView] averageScores:', evaluation.averageScores);
      console.log('[ResultView] responses:', evaluation.responses);
      console.log('[ResultView] responses type:', typeof evaluation.responses);
      console.log('[ResultView] responses length:', evaluation.responses?.length);
    }
  }, [evaluation]);

  // 如果 evaluation 不存在或没有有效数据
  if (!evaluation || !evaluation.averageScores) {
    console.log('[ResultView] No evaluation or averageScores, showing loading');
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-amber-500 mb-3" />
          <p className="text-slate-700 font-medium">暂无评估结果</p>
          <p className="text-sm text-slate-500 mt-2">请先完成测试并等待评估完成</p>
          <Button onClick={onRetry} className="mt-4" variant="outline">
            重新测试
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 生成并播放参考回答 TTS
  const playModelAnswerTTS = async (index: number, modelAnswer: string) => {
    // 如果正在播放同一个，停止
    if (playingModel === index && modelAudioRef.current) {
      modelAudioRef.current.pause();
      modelAudioRef.current = null;
      setPlayingModel(null);
      return;
    }
    
    // 停止之前的播放
    if (modelAudioRef.current) {
      modelAudioRef.current.pause();
      modelAudioRef.current = null;
    }
    
    // 检查是否已缓存
    const cacheKey = `${index}_${selectedVoice}`;
    if (modelAudioUrls[cacheKey]) {
      const audio = new Audio(modelAudioUrls[cacheKey]);
      modelAudioRef.current = audio;
      audio.onended = () => setPlayingModel(null);
      audio.play();
      setPlayingModel(index);
      return;
    }
    
    // 生成新的语音
    if (!modelAnswer) return;
    
    setGeneratingTTS(index);
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: modelAnswer,
          voice: selectedVoice,
          speed: 0.85
        })
      });

      if (!response.ok) throw new Error('TTS 服务不可用');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // 缓存
      setModelAudioUrls(prev => ({ ...prev, [cacheKey]: audioUrl }));
      
      const audio = new Audio(audioUrl);
      modelAudioRef.current = audio;
      audio.onended = () => setPlayingModel(null);
      audio.play();
      setPlayingModel(index);
    } catch (error) {
      console.error('TTS generation error:', error);
      toast.error('参考回答音频生成失败');
    }
    setGeneratingTTS(null);
  };

  // 播放改进建议示例语音
  const playExampleAudio = async (exampleText: string, key: string) => {
    // 如果正在播放同一个，停止
    if (playingExample === key && exampleAudioRef.current) {
      exampleAudioRef.current.pause();
      exampleAudioRef.current = null;
      setPlayingExample(null);
      return;
    }
    
    // 停止之前的播放
    if (exampleAudioRef.current) {
      exampleAudioRef.current.pause();
      exampleAudioRef.current = null;
    }
    
    // 检查是否已缓存（使用带口音的 key）
    const cacheKey = `${key}_${selectedVoice}`;
    if (exampleAudioUrls[cacheKey]) {
      const audio = new Audio(exampleAudioUrls[cacheKey]);
      exampleAudioRef.current = audio;
      audio.onended = () => setPlayingExample(null);
      audio.play();
      setPlayingExample(key);
      return;
    }
    
    // 生成新的语音
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: exampleText,
          voice: selectedVoice,
          speed: 0.85  // 降低语速，更自然
        })
      });

      if (!response.ok) throw new Error('TTS 服务不可用');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // 缓存（使用带口音的 key）
      setExampleAudioUrls(prev => ({ ...prev, [cacheKey]: audioUrl }));
      
      const audio = new Audio(audioUrl);
      exampleAudioRef.current = audio;
      audio.onended = () => setPlayingExample(null);
      audio.play();
      setPlayingExample(key);
    } catch (error) {
      console.error('Example TTS error:', error);
      toast.error('示例语音生成失败');
    }
  };
  
  const avgScore = evaluation.averageScores?.overall || 
    ((evaluation.averageScores?.fluencyCoherence + evaluation.averageScores?.lexicalResource + 
      evaluation.averageScores?.grammaticalRange + evaluation.averageScores?.pronunciation) / 4);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 总分卡片 */}
      <Card className="overflow-hidden">
        <div className="bg-[#E31837] p-8 text-white text-center">
          <Award className="w-10 h-10 mx-auto mb-3 opacity-90" />
          <h2 className="text-2xl font-semibold mb-1">测试完成</h2>
          <div className="text-5xl font-bold mt-4">{avgScore?.toFixed(1) || '6.0'}</div>
          <p className="text-white/60 mt-1">Band Score</p>
        </div>
      </Card>

      {/* 标签页切换 */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
        {[
          { key: 'scores', label: '评分详情' },
          { key: 'responses', label: '回答回顾' },
          { key: 'improvements', label: '改进建议' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-white shadow text-[#E31837]' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 口音选择 */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-600">语音口音：</span>
        <select
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value as typeof selectedVoice)}
          className="px-3 py-1.5 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#E31837]/20"
        >
          <option value="us-female">🇺🇸 美式女声</option>
          <option value="us-male">🇺🇸 美式男声</option>
          <option value="uk-female">🇬🇧 英式女声</option>
          <option value="uk-male">🇬🇧 英式男声</option>
        </select>
      </div>

      {/* 评分详情 */}
      {activeTab === 'scores' && (
        <Card>
          <CardHeader>
            <CardTitle>各项评分</CardTitle>
            <CardDescription>基于雅思口语四大评分标准</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'fluencyCoherence', name: '流利度与连贯性 (FC)', desc: '语速自然、表达连贯、逻辑清晰', score: evaluation.averageScores?.fluencyCoherence },
              { key: 'lexicalResource', name: '词汇丰富度 (LR)', desc: '词汇多样性、用词精准、习语运用', score: evaluation.averageScores?.lexicalResource },
              { key: 'grammaticalRange', name: '语法多样性 (GRA)', desc: '句式变化、语法准确、复杂结构', score: evaluation.averageScores?.grammaticalRange },
              { key: 'pronunciation', name: '发音准确度 (P)', desc: '语音清晰、语调自然、节奏得当', score: evaluation.averageScores?.pronunciation },
            ].map((item) => (
              <div key={item.key} className="p-3 bg-slate-50 rounded-lg">
                <div className="flex justify-between mb-1">
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <span className={`text-xl font-bold ${getBandColor(item.score || 6.0).split(' ')[0]}`}>
                    {(item.score || 6.0).toFixed(1)}
                  </span>
                </div>
                <Progress value={((item.score || 6.0) / 9) * 100} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 回顾回答 */}
      {activeTab === 'responses' && (
        <div className="space-y-4">
          {evaluation.responses?.map((response: any, index: number) => (
            <Card key={index}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">问题 {index + 1} (Part {response.partNumber})</CardTitle>
                  <Badge className={getBandColor(response.scores?.overall || 6.0)}>
                    {(response.scores?.overall || 6.0).toFixed(1)}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600 mt-1">{response.questionText}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 转录文本 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-slate-500">您的回答</Label>
                    <div className="flex items-center gap-1">
                      {/* 语法修改按钮 */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fixGrammar(index, response.transcription)}
                        disabled={grammarFixing === index}
                        className="h-7 text-xs gap-1"
                      >
                        {grammarFixing === index ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Pencil className="w-3 h-3" />
                        )}
                        {grammarResults[index] ? '隐藏修改' : '语法修改'}
                      </Button>
                      {/* 翻译按钮 */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => translateText(index, response.transcription, 'transcription')}
                        disabled={translating?.index === index && translating?.type === 'transcription'}
                        className="h-7 text-xs gap-1"
                      >
                        {translating?.index === index && translating?.type === 'transcription' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Languages className="w-3 h-3" />
                        )}
                        {translations[`${index}_transcription`] ? '隐藏翻译' : '翻译'}
                      </Button>
                      <AudioPlayer 
                        audioBase64={response.audioBase64} 
                        audioId={response.audioId}
                        duration={response.duration} 
                        showDownload={true}
                      />
                    </div>
                  </div>
                  <div className="mt-1 p-3 bg-slate-50 rounded-lg text-sm">
                    {response.transcription || '无转录内容'}
                  </div>
                  {/* 翻译结果 */}
                  {translations[`${index}_transcription`] && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                      <strong>中文翻译：</strong>{translations[`${index}_transcription`]}
                    </div>
                  )}
                  {/* 语法修改结果 */}
                  {grammarResults[index] && (
                    <div className="mt-2 space-y-2">
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                        <strong className="text-green-700">修改后：</strong>
                        <span className="text-green-800">{grammarResults[index].corrected}</span>
                      </div>
                      {grammarResults[index].errors.length > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <strong className="text-amber-700 text-sm">错误详解：</strong>
                          <ul className="mt-1 space-y-1">
                            {grammarResults[index].errors.map((err: any, ei: number) => (
                              <li key={ei} className="text-xs text-amber-800">
                                • <span className="line-through text-red-600">{err.original}</span>
                                → <span className="text-green-600 font-medium">{err.corrected}</span>
                                <span className="text-slate-500 ml-1">({err.explanation})</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* 各项评分 */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 bg-blue-50 rounded">
                    <div className="font-bold text-blue-600">{(response.scores?.fluencyCoherence || 6.0).toFixed(1)}</div>
                    <div className="text-slate-500">FC</div>
                  </div>
                  <div className="p-2 bg-green-50 rounded">
                    <div className="font-bold text-green-600">{(response.scores?.lexicalResource || 6.0).toFixed(1)}</div>
                    <div className="text-slate-500">LR</div>
                  </div>
                  <div className="p-2 bg-purple-50 rounded">
                    <div className="font-bold text-purple-600">{(response.scores?.grammaticalRange || 6.0).toFixed(1)}</div>
                    <div className="text-slate-500">GRA</div>
                  </div>
                  <div className="p-2 bg-orange-50 rounded">
                    <div className="font-bold text-orange-600">{(response.scores?.pronunciation || 6.0).toFixed(1)}</div>
                    <div className="text-slate-500">P</div>
                  </div>
                </div>

                {/* 反馈 */}
                {response.feedback && (
                  <div>
                    <Label className="text-xs text-slate-500">详细反馈</Label>
                    <div className="mt-1 space-y-2 text-sm">
                      {response.feedback.fluencyCoherence && (
                        <div className="p-2 bg-blue-50 rounded"><strong className="text-blue-700">流利度：</strong>{response.feedback.fluencyCoherence}</div>
                      )}
                      {response.feedback.lexicalResource && (
                        <div className="p-2 bg-green-50 rounded"><strong className="text-green-700">词汇：</strong>{response.feedback.lexicalResource}</div>
                      )}
                      {response.feedback.grammaticalRange && (
                        <div className="p-2 bg-purple-50 rounded"><strong className="text-purple-700">语法：</strong>{response.feedback.grammaticalRange}</div>
                      )}
                      {response.feedback.pronunciation && (
                        <div className="p-2 bg-orange-50 rounded"><strong className="text-orange-700">发音：</strong>{response.feedback.pronunciation}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* 参考回答 */}
                {response.modelAnswer && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs text-slate-500">高分参考回答</Label>
                      <div className="flex items-center gap-1">
                        {/* 翻译按钮 */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => translateText(index, response.modelAnswer, 'modelAnswer')}
                          disabled={translating?.index === index && translating?.type === 'modelAnswer'}
                          className="h-7 text-xs gap-1"
                        >
                          {translating?.index === index && translating?.type === 'modelAnswer' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Languages className="w-3 h-3" />
                          )}
                          {translations[`${index}_modelAnswer`] ? '隐藏翻译' : '翻译'}
                        </Button>
                        {/* TTS播放按钮 */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => playModelAnswerTTS(index, response.modelAnswer)}
                          disabled={generatingTTS === index}
                          className="h-7 text-xs gap-1"
                        >
                          {generatingTTS === index ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              生成中...
                            </>
                          ) : playingModel === index ? (
                            <>
                              <Square className="w-3 h-3" />
                              停止播放
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" />
                              播放参考
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
                      {response.modelAnswer}
                    </div>
                    {/* 参考回答翻译 */}
                    {translations[`${index}_modelAnswer`] && (
                      <div className="mt-2 p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-800">
                        <strong>中文翻译：</strong>{translations[`${index}_modelAnswer`]}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 改进建议 */}
      {activeTab === 'improvements' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              改进建议
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {evaluation.responses?.flatMap((response: any, rIndex: number) => 
              (response.improvements || []).map((improvement: any, iIndex: number) => {
                const exampleKey = `${rIndex}-${iIndex}`;
                return (
                <div key={exampleKey} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-amber-700 border-amber-300">
                      {improvement.area}
                    </Badge>
                    <span className="font-medium text-amber-800">{improvement.issue}</span>
                  </div>
                  <p className="text-sm text-amber-700 mb-2">{improvement.suggestion}</p>
                  {improvement.example && (
                    <div className="text-sm bg-white p-2 rounded border border-amber-100 flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <strong>示例：</strong>{improvement.example}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => playExampleAudio(improvement.example, exampleKey)}
                        className={`shrink-0 ${playingExample === exampleKey ? 'text-amber-600 bg-amber-100' : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'}`}
                        title={playingExample === exampleKey ? '停止播放' : '播放示例语音'}
                      >
                        {playingExample === exampleKey ? (
                          <Square className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )})
            )}
            
            {/* 优势总结 */}
            {evaluation.responses?.some((r: any) => r.strengths?.length > 0) && (
              <div className="mt-6">
                <h4 className="font-medium text-green-700 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  您的优势
                </h4>
                <div className="space-y-2">
                  {evaluation.responses?.flatMap((response: any, rIndex: number) => 
                    (response.strengths || []).map((strength: string, sIndex: number) => (
                      <div key={`${rIndex}-${sIndex}`} className="flex items-start gap-2 p-2 bg-green-50 rounded">
                        <Star className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        <span className="text-sm text-green-700">{strength}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {(!evaluation.responses || evaluation.responses.length === 0) && (
              <div className="text-center py-8 text-slate-500">
                <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>暂无改进建议</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4">
        <Button variant="outline" onClick={onRetry} className="flex-1 gap-2">
          <RotateCcw className="w-4 h-4" /> 重新录音
        </Button>
        <Button onClick={onNext} className="flex-1 gap-2 bg-[#E31837] hover:bg-[#C4142D]">
          继续 <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// History View
function HistoryView({ sessions, onBack, onRefresh }: {
  sessions: any[];
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [viewingSession, setViewingSession] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [modelAudioUrls, setModelAudioUrls] = useState<Record<string, string>>({});
  const [generatingTTS, setGeneratingTTS] = useState<number | null>(null);
  const [playingModel, setPlayingModel] = useState<number | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<'us-female' | 'uk-female' | 'us-male' | 'uk-male'>('us-female');
  const [exampleAudioUrls, setExampleAudioUrls] = useState<Record<string, string>>({});
  const [playingExample, setPlayingExample] = useState<string | null>(null);
  const exampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const modelAudioRef = useRef<HTMLAudioElement | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [evaluatingSessions, setEvaluatingSessions] = useState<Set<string>>(new Set());

  // 语法修改和翻译状态
  const [grammarFixing, setGrammarFixing] = useState<number | null>(null);
  const [translating, setTranslating] = useState<{ index: number; type: 'transcription' | 'modelAnswer' } | null>(null);
  const [grammarResults, setGrammarResults] = useState<Record<number, { corrected: string; errors: any[] }>>({});
  const [translations, setTranslations] = useState<Record<string, string>>({});

  // 语法修改
  const fixGrammar = async (index: number, text: string) => {
    if (grammarResults[index]) {
      setGrammarResults(prev => {
        const newResults = { ...prev };
        delete newResults[index];
        return newResults;
      });
      return;
    }

    setGrammarFixing(index);
    try {
      const response = await fetch('/api/grammar-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      if (data.success) {
        setGrammarResults(prev => ({ ...prev, [index]: data }));
      } else {
        toast.error(data.error || '语法修改失败');
      }
    } catch (error) {
      toast.error('语法修改服务出错');
    }
    setGrammarFixing(null);
  };

  // 翻译
  const translateText = async (index: number, text: string, type: 'transcription' | 'modelAnswer') => {
    const key = `${index}_${type}`;
    if (translations[key]) {
      setTranslations(prev => {
        const newTranslations = { ...prev };
        delete newTranslations[key];
        return newTranslations;
      });
      return;
    }

    setTranslating({ index, type });
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, type })
      });
      const data = await response.json();
      if (data.success) {
        setTranslations(prev => ({ ...prev, [key]: data.translation }));
      } else {
        toast.error(data.error || '翻译失败');
      }
    } catch (error) {
      toast.error('翻译服务出错');
    }
    setTranslating(null);
  };

  // 检查是否有正在评估的会话，启动轮询
  useEffect(() => {
    const evaluatingIds = sessions
      .filter(s => s.evaluationStatus === 'evaluating')
      .map(s => s.id);

    // 清理之前的轮询
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (evaluatingIds.length > 0) {
      setEvaluatingSessions(new Set(evaluatingIds));

      // 每3秒轮询一次评估状态
      pollingRef.current = setInterval(async () => {
        // 直接调用 onRefresh 获取最新数据
        onRefresh();
      }, 3000);
    } else {
      setEvaluatingSessions(new Set());
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [sessions, onRefresh]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSessions(newSelected);
  };

  const selectAll = () => {
    if (selectedSessions.size === sessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(sessions.map(s => s.id)));
    }
  };

  const deleteSelected = async () => {
    if (selectedSessions.size === 0) return;
    if (!confirm(`确定删除 ${selectedSessions.size} 条记录？`)) return;
    
    setDeleting(true);
    try {
      const response = await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedSessions) })
      });
      
      if (response.ok) {
        setSelectedSessions(new Set());
        onRefresh();
        toast.success('删除成功');
      }
    } catch (error) {
      toast.error('删除失败');
    }
    setDeleting(false);
  };

  const deleteSession = async (id: string) => {
    if (!confirm('确定删除此记录？')) return;
    
    try {
      const response = await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      });
      
      if (response.ok) {
        onRefresh();
        toast.success('删除成功');
      }
    } catch (error) {
      toast.error('删除失败');
    }
  };

  const exportData = () => {
    const data = sessions.map(session => ({
      testType: session.testType,
      date: session.startedAt,
      bandScore: session.bandScore,
      responses: session.responses || []
    }));
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ielts-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('导出成功');
  };

  const viewSessionDetails = async (sessionId: string) => {
    try {
      console.log('[History] Fetching session details:', sessionId);
      const response = await fetch(`/api/history/${sessionId}`);
      const data = await response.json();
      console.log('[History] Response:', data);
      if (data.success && data.session) {
        setViewingSession(data.session);
        setModelAudioUrls({}); // 重置音频缓存
        setPlayingModel(null); // 重置播放状态
      } else {
        toast.error(data.error || '获取详情失败');
      }
    } catch (error) {
      console.error('[History] Error:', error);
      toast.error('获取详情失败');
    }
  };

  // 播放参考回答 TTS
  const playModelAnswerTTSInHistory = async (index: number, modelAnswer: string, sessionId: string) => {
    // 如果正在播放同一个，停止
    if (playingModel === index && modelAudioRef.current) {
      modelAudioRef.current.pause();
      modelAudioRef.current = null;
      setPlayingModel(null);
      return;
    }
    
    // 停止之前的播放
    if (modelAudioRef.current) {
      modelAudioRef.current.pause();
      modelAudioRef.current = null;
    }
    
    // 检查是否已缓存
    const cacheKey = `${sessionId}_${index}_${selectedVoice}`;
    if (modelAudioUrls[cacheKey]) {
      const audio = new Audio(modelAudioUrls[cacheKey]);
      modelAudioRef.current = audio;
      audio.onended = () => setPlayingModel(null);
      audio.play();
      setPlayingModel(index);
      return;
    }
    
    // 生成新的语音
    if (!modelAnswer) return;
    
    setGeneratingTTS(index);
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: modelAnswer,
          voice: selectedVoice,
          speed: 0.85
        })
      });

      if (!response.ok) throw new Error('TTS 服务不可用');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // 缓存
      setModelAudioUrls(prev => ({ ...prev, [cacheKey]: audioUrl }));
      
      const audio = new Audio(audioUrl);
      modelAudioRef.current = audio;
      audio.onended = () => setPlayingModel(null);
      audio.play();
      setPlayingModel(index);
    } catch (error) {
      console.error('TTS generation error:', error);
      toast.error('参考回答音频生成失败');
    }
    setGeneratingTTS(null);
  };

  // 播放改进建议示例语音（历史记录中）
  const playExampleAudioInHistory = async (exampleText: string, key: string) => {
    // 如果正在播放同一个，停止
    if (playingExample === key && exampleAudioRef.current) {
      exampleAudioRef.current.pause();
      exampleAudioRef.current = null;
      setPlayingExample(null);
      return;
    }
    
    // 停止之前的播放
    if (exampleAudioRef.current) {
      exampleAudioRef.current.pause();
      exampleAudioRef.current = null;
    }
    
    // 检查是否已缓存（使用带口音的 key）
    const cacheKey = `${key}_${selectedVoice}`;
    if (exampleAudioUrls[cacheKey]) {
      const audio = new Audio(exampleAudioUrls[cacheKey]);
      exampleAudioRef.current = audio;
      audio.onended = () => setPlayingExample(null);
      audio.play();
      setPlayingExample(key);
      return;
    }
    
    // 生成新的语音
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: exampleText,
          voice: selectedVoice,
          speed: 0.85  // 降低语速，更自然
        })
      });

      if (!response.ok) throw new Error('TTS 服务不可用');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // 缓存（使用带口音的 key）
      setExampleAudioUrls(prev => ({ ...prev, [cacheKey]: audioUrl }));
      
      const audio = new Audio(audioUrl);
      exampleAudioRef.current = audio;
      audio.onended = () => setPlayingExample(null);
      audio.play();
      setPlayingExample(key);
    } catch (error) {
      console.error('Example TTS error:', error);
      toast.error('示例语音生成失败');
    }
  };

  // 查看详情页面
  if (viewingSession) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">练习详情</h2>
          <Button variant="ghost" onClick={() => setViewingSession(null)}>
            <ChevronLeft className="w-4 h-4 mr-2" /> 返回
          </Button>
        </div>

        {/* 口音选择 */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-600">语音口音：</span>
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value as typeof selectedVoice)}
            className="px-3 py-1.5 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#E31837]/20"
          >
            <option value="us-female">🇺🇸 美式女声</option>
            <option value="us-male">🇺🇸 美式男声</option>
            <option value="uk-female">🇬🇧 英式女声</option>
            <option value="uk-male">🇬🇧 英式男声</option>
          </select>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {viewingSession.testType === 'full' ? '模拟测试' : `Part ${viewingSession.testType.replace('part', '')} 练习`}
              </CardTitle>
              {viewingSession.bandScore && (
                <Badge className={getBandColor(viewingSession.bandScore)}>
                  {viewingSession.bandScore.toFixed(1)}
                </Badge>
              )}
            </div>
            <CardDescription>
              {new Date(viewingSession.startedAt).toLocaleString('zh-CN')}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* 回答列表 */}
        <div className="space-y-4">
          {viewingSession.responses?.map((response: any, index: number) => {
            // 解析 improvements
            const improvements = response.improvements || [];
            
            return (
            <Card key={index}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">问题 {index + 1} (Part {response.partNumber})</CardTitle>
                  <Badge className={getBandColor(response.overallScore || 6.0)}>
                    {(response.overallScore || 6.0).toFixed(1)}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600">{response.questionText}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-slate-500">您的回答</Label>
                    <div className="flex items-center gap-1">
                      {/* 语法修改按钮 */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fixGrammar(index, response.transcription)}
                        disabled={grammarFixing === index}
                        className="h-7 text-xs gap-1"
                      >
                        {grammarFixing === index ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Pencil className="w-3 h-3" />
                        )}
                        {grammarResults[index] ? '隐藏' : '语法修改'}
                      </Button>
                      {/* 翻译按钮 */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => translateText(index, response.transcription, 'transcription')}
                        disabled={translating?.index === index && translating?.type === 'transcription'}
                        className="h-7 text-xs gap-1"
                      >
                        {translating?.index === index && translating?.type === 'transcription' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Languages className="w-3 h-3" />
                        )}
                        {translations[`${index}_transcription`] ? '隐藏' : '翻译'}
                      </Button>
                      <AudioPlayer 
                        audioBase64={response.audioBase64} 
                        audioId={response.audioId}
                        duration={response.duration} 
                        showDownload={true}
                      />
                    </div>
                  </div>
                  <div className="mt-1 p-3 bg-slate-50 rounded-lg text-sm">
                    {response.transcription || '无记录'}
                  </div>
                  {/* 翻译结果 */}
                  {translations[`${index}_transcription`] && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                      <strong>中文翻译：</strong>{translations[`${index}_transcription`]}
                    </div>
                  )}
                  {/* 语法修改结果 */}
                  {grammarResults[index] && (
                    <div className="mt-2 space-y-2">
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                        <strong className="text-green-700">修改后：</strong>
                        <span className="text-green-800">{grammarResults[index].corrected}</span>
                      </div>
                      {grammarResults[index].errors.length > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <strong className="text-amber-700 text-sm">错误详解：</strong>
                          <ul className="mt-1 space-y-1">
                            {grammarResults[index].errors.map((err: any, ei: number) => (
                              <li key={ei} className="text-xs text-amber-800">
                                • <span className="line-through text-red-600">{err.original}</span>
                                → <span className="text-green-600 font-medium">{err.corrected}</span>
                                <span className="text-slate-500 ml-1">({err.explanation})</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 bg-blue-50 rounded">
                    <div className="font-bold text-blue-600">{(response.fluencyScore || 6.0).toFixed(1)}</div>
                    <div className="text-slate-500">FC</div>
                  </div>
                  <div className="p-2 bg-green-50 rounded">
                    <div className="font-bold text-green-600">{(response.vocabularyScore || 6.0).toFixed(1)}</div>
                    <div className="text-slate-500">LR</div>
                  </div>
                  <div className="p-2 bg-purple-50 rounded">
                    <div className="font-bold text-purple-600">{(response.grammarScore || 6.0).toFixed(1)}</div>
                    <div className="text-slate-500">GRA</div>
                  </div>
                  <div className="p-2 bg-orange-50 rounded">
                    <div className="font-bold text-orange-600">{(response.pronunciationScore || 6.0).toFixed(1)}</div>
                    <div className="text-slate-500">P</div>
                  </div>
                </div>

                {/* 改进建议 */}
                {improvements.length > 0 && (
                  <div className="mt-3">
                    <Label className="text-xs text-slate-500">改进建议</Label>
                    <div className="mt-1 space-y-2">
                      {improvements.map((imp: any, impIndex: number) => {
                        const exampleKey = `history-${index}-${impIndex}`;
                        return (
                        <div key={impIndex} className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">
                              {imp.area}
                            </Badge>
                            <span className="text-xs font-medium text-amber-800">{imp.issue}</span>
                          </div>
                          <p className="text-xs text-amber-700">{imp.suggestion}</p>
                          {imp.example && (
                            <div className="mt-1 text-xs bg-white p-2 rounded border border-amber-100 flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <strong>示例：</strong>{imp.example}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => playExampleAudioInHistory(imp.example, exampleKey)}
                                className={`shrink-0 h-6 w-6 p-0 ${playingExample === exampleKey ? 'text-amber-600 bg-amber-100' : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'}`}
                                title={playingExample === exampleKey ? '停止播放' : '播放示例语音'}
                              >
                                {playingExample === exampleKey ? (
                                  <Square className="w-3 h-3" />
                                ) : (
                                  <Volume2 className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      )})}
                    </div>
                  </div>
                )}

                {response.modelAnswer && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs text-slate-500">高分参考回答</Label>
                      <div className="flex items-center gap-1">
                        {/* 翻译按钮 */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => translateText(index, response.modelAnswer, 'modelAnswer')}
                          disabled={translating?.index === index && translating?.type === 'modelAnswer'}
                          className="h-7 text-xs gap-1"
                        >
                          {translating?.index === index && translating?.type === 'modelAnswer' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Languages className="w-3 h-3" />
                          )}
                          {translations[`${index}_modelAnswer`] ? '隐藏' : '翻译'}
                        </Button>
                        {/* TTS播放按钮 */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => playModelAnswerTTSInHistory(index, response.modelAnswer, viewingSession.id)}
                          disabled={generatingTTS === index}
                          className="h-7 text-xs gap-1"
                        >
                          {generatingTTS === index ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              生成中...
                            </>
                          ) : playingModel === index ? (
                            <>
                              <Square className="w-3 h-3" />
                              停止播放
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" />
                              播放参考
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
                      {response.modelAnswer}
                    </div>
                    {/* 参考回答翻译 */}
                    {translations[`${index}_modelAnswer`] && (
                      <div className="mt-2 p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-800">
                        <strong>中文翻译：</strong>{translations[`${index}_modelAnswer`]}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )})}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">历史记录</h2>
        <div className="flex gap-2">
          {sessions.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={exportData}>
                <Download className="w-4 h-4 mr-2" /> 导出
              </Button>
              {selectedSessions.size > 0 && (
                <Button variant="destructive" size="sm" onClick={deleteSelected} disabled={deleting}>
                  <Trash2 className="w-4 h-4 mr-2" /> 删除 ({selectedSessions.size})
                </Button>
              )}
            </>
          )}
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" /> 刷新
          </Button>
          <Button variant="ghost" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-2" /> 返回
          </Button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-slate-500">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>暂无历史记录</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 全选 */}
          <div className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedSessions.size === sessions.length && sessions.length > 0}
              onChange={selectAll}
              className="w-4 h-4"
            />
            <span className="text-slate-600">全选 ({sessions.length} 条记录)</span>
          </div>

          <div className="space-y-3">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className={`hover:shadow-md transition-shadow cursor-pointer ${selectedSessions.has(session.id) ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => viewSessionDetails(session.id)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedSessions.has(session.id)}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(session.id); }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{session.testType === 'full' ? '模拟测试' : `Part ${session.testType.replace('part', '')} 练习`}</p>
                        {/* 评估状态徽章 */}
                        {session.evaluationStatus === 'evaluating' && (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 animate-pulse">
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            评估中 {session.evaluationProgress || 0}%
                          </Badge>
                        )}
                        {session.evaluationStatus === 'pending' && (
                          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                            等待评估
                          </Badge>
                        )}
                        {session.evaluationStatus === 'failed' && (
                          <Badge className="bg-red-100 text-red-700 border-red-200">
                            评估失败
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{new Date(session.startedAt).toLocaleString('zh-CN')}</p>
                    </div>
                    {session.bandScore && (
                      <div className={`text-2xl font-bold px-3 py-1 rounded ${getBandColor(session.bandScore)}`}>
                        {session.bandScore.toFixed(1)}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Question Bank View
function QuestionBankView({ isLoading, setIsLoading, user, showLoginDialog }: {
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  user: { userId?: string; username?: string; isLoggedIn: boolean };
  showLoginDialog: () => void;
}) {
  const [selectedPart, setSelectedPart] = useState('1');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [useCustomTopic, setUseCustomTopic] = useState(false);
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [stats, setStats] = useState({ part1: 0, part2: 0, part3: 0, total: 0 });
  const [serverKeyReady, setServerKeyReady] = useState<boolean | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAllQuestions = useCallback(async () => {
    try {
      const [p1, p2, p3] = await Promise.all([
        fetch('/api/questions?part=1&count=100').then(r => r.json()),
        fetch('/api/questions?part=2&count=100').then(r => r.json()),
        fetch('/api/questions?part=3&count=100').then(r => r.json())
      ]);
      
      const questions = [
        ...(p1.success ? p1.questions : []).map((q: any) => ({ ...q, partNumber: 1 })),
        ...(p2.success ? p2.questions : []).map((q: any) => ({ ...q, partNumber: 2 })),
        ...(p3.success ? p3.questions : []).map((q: any) => ({ ...q, partNumber: 3 }))
      ];
      
      setAllQuestions(questions);
      setStats({
        part1: p1.success ? p1.questions.length : 0,
        part2: p2.success ? p2.questions.length : 0,
        part3: p3.success ? p3.questions.length : 0,
        total: questions.length
      });
    } catch (e) {
      console.error('Failed to load questions');
    }
  }, []);

  useEffect(() => {
    loadAllQuestions();
    fetch('/api/questions/update', { method: 'POST' }).then(r => r.json()).then(d => setServerKeyReady(d.hasServerKey));
  }, [loadAllQuestions]);

  // 导出题库
  const exportQuestions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/questions/import');
      const data = await response.json();
      
      if (data.questions) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ielts-questions-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`已导出 ${data.total} 道题目`);
      }
    } catch (error) {
      toast.error('导出失败');
    }
    setIsLoading(false);
  };

  // 导入题库
  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      setIsLoading(true);
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.questions || !Array.isArray(data.questions)) {
        toast.error('无效的题库格式，请确保包含 questions 数组');
        setIsLoading(false);
        return;
      }
      
      const response = await fetch('/api/questions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: data.questions,
          mode: importMode
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(result.message);
        loadAllQuestions();
        setShowImportDialog(false);
      } else {
        toast.error(result.error || '导入失败');
      }
    } catch (error) {
      toast.error('导入失败，请检查文件格式');
    }
    setIsLoading(false);
    
    // 清空文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 清空题库
  const clearQuestions = async () => {
    if (!confirm('确定要清空所有题库吗？此操作不可恢复！')) return;
    
    try {
      setIsLoading(true);
      const response = await fetch('/api/questions/import', { method: 'DELETE' });
      const result = await response.json();
      
      if (result.success) {
        toast.success(result.message);
        loadAllQuestions();
      } else {
        toast.error('清空失败');
      }
    } catch (error) {
      toast.error('清空失败');
    }
    setIsLoading(false);
  };

  const generateQuestions = async (randomTopic: boolean = false) => {
    // 检查用户是否已登录
    if (!user.isLoggedIn) {
      toast.error('请先登录后再生成题目');
      showLoginDialog();
      return;
    }

    if (!serverKeyReady) {
      toast.error('服务未配置，请联系管理员');
      return;
    }

    let topic = '';
    if (randomTopic) {
      const topics = TOPICS[`part${selectedPart}` as keyof typeof TOPICS] || [];
      topic = topics[Math.floor(Math.random() * topics.length)];
    } else if (useCustomTopic && customTopic.trim()) {
      topic = customTopic.trim();
    } else {
      topic = selectedTopic;
    }

    if (!topic) {
      toast.error('请选择或输入话题');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/questions/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          part: parseInt(selectedPart),
          topic: topic,
          count: selectedPart === '2' ? 1 : 5
        })
      });
      const data = await response.json();

      if (data.needLogin) {
        toast.error('请先登录后再生成题目');
        showLoginDialog();
      } else if (data.success) {
        toast.success(`成功生成 ${data.generated} 道题目`);
        loadAllQuestions();
        setCustomTopic('');
      } else {
        toast.error('生成失败: ' + data.error);
      }
    } catch {
      toast.error('生成失败');
    }
    setIsLoading(false);
  };

  const partQuestions = allQuestions.filter(q => q.partNumber === parseInt(selectedPart));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">题库管理</h2>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><p className="text-3xl font-bold text-indigo-600">{stats.total}</p><p className="text-sm text-slate-500">总题目数</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-3xl font-bold text-blue-600">{stats.part1}</p><p className="text-sm text-slate-500">Part 1</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-3xl font-bold text-emerald-600">{stats.part2}</p><p className="text-sm text-slate-500">Part 2</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-3xl font-bold text-amber-600">{stats.part3}</p><p className="text-sm text-slate-500">Part 3</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-[#E31837]" />生成题目</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>题目部分</Label>
              <select className="w-full mt-1 px-3 py-2 border rounded-md" value={selectedPart} onChange={(e) => { setSelectedPart(e.target.value); setSelectedTopic(''); }}>
                <option value="1">Part 1 - 日常对话</option>
                <option value="2">Part 2 - 个人陈述</option>
                <option value="3">Part 3 - 深度讨论</option>
              </select>
            </div>
            <div>
              <Label>生成数量</Label>
              <select className="w-full mt-1 px-3 py-2 border rounded-md" defaultValue="5">
                <option value="3">3 题</option>
                <option value="5">5 题</option>
                <option value="10">10 题</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="topicMode" checked={!useCustomTopic} onChange={() => setUseCustomTopic(false)} className="w-4 h-4" />
              <span className="text-sm">选择预设话题</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="topicMode" checked={useCustomTopic} onChange={() => setUseCustomTopic(true)} className="w-4 h-4" />
              <span className="text-sm">自定义话题</span>
            </label>
          </div>

          {!useCustomTopic ? (
            <div>
              <Label>话题</Label>
              <select className="w-full mt-1 px-3 py-2 border rounded-md" value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)}>
                <option value="">选择话题...</option>
                {TOPICS[`part${selectedPart}` as keyof typeof TOPICS]?.map((topic) => (
                  <option key={topic} value={topic}>{topic}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <Label>自定义话题</Label>
              <Input className="mt-1" placeholder="输入话题，如：Music, Sports, Travel..." value={customTopic} onChange={(e) => setCustomTopic(e.target.value)} />
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={() => generateQuestions(true)} disabled={!serverKeyReady || isLoading} variant="outline" className="flex-1 gap-2">
              <RefreshCw className="w-4 h-4" /> 随机话题
            </Button>
            <Button onClick={() => generateQuestions(false)} disabled={!serverKeyReady || isLoading} className="flex-1 gap-2 bg-[#E31837] hover:bg-[#C4142D]">
              <Plus className="w-4 h-4" /> 生成题目
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-emerald-500" />题库列表</CardTitle>
            <div className="flex items-center gap-2">
              <Button onClick={exportQuestions} disabled={isLoading || stats.total === 0} variant="outline" size="sm" className="gap-1">
                <Download className="w-4 h-4" /> 导出
              </Button>
              <Button onClick={() => setShowImportDialog(true)} disabled={isLoading} variant="outline" size="sm" className="gap-1">
                <Upload className="w-4 h-4" /> 导入
              </Button>
              <select className="px-3 py-1 border rounded-md text-sm" value={selectedPart} onChange={(e) => setSelectedPart(e.target.value)}>
                <option value="1">Part 1 ({stats.part1}题)</option>
                <option value="2">Part 2 ({stats.part2}题)</option>
                <option value="3">Part 3 ({stats.part3}题)</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {partQuestions.map((q) => (
              <div key={q.id} className="p-3 bg-slate-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="shrink-0">P{q.partNumber}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 line-clamp-2">{q.questionText}</p>
                    <p className="text-xs text-slate-500 mt-1">{q.category}</p>
                  </div>
                </div>
              </div>
            ))}
            {partQuestions.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>暂无题目</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 导入对话框 */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>导入题库</DialogTitle>
            <DialogDescription>
              从 JSON 文件导入题目，支持追加或替换现有题库
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="importMode" checked={importMode === 'append'} onChange={() => setImportMode('append')} className="w-4 h-4" />
                <span className="text-sm">追加到现有题库</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="importMode" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} className="w-4 h-4" />
                <span className="text-sm">替换现有题库</span>
              </label>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-2">导入格式示例：</p>
              <pre className="text-xs bg-slate-100 p-2 rounded overflow-x-auto">{`{
  "questions": [
    {
      "partNumber": 1,
      "category": "Hometown",
      "questionText": "Where are you from?",
      "difficulty": "easy"
    }
  ]
}`}</pre>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              取消
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} className="bg-[#E31837] hover:bg-[#C4142D]">
              选择文件导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Part 3 动态讨论视图 - 模拟真实考官的双向讨论
function Part3DiscussionView({
  discussion,
  isRecording,
  recordingDuration,
  isLoading,
  onStartRecording,
  onStopRecording,
  settings,
  onEndDiscussion,
  sessionId
}: {
  discussion: {
    isActive: boolean;
    conversationHistory: Array<{ question: string; answer: string; questionId: string; audioId?: string; duration?: number }>;
    currentQuestion: string;
    currentQuestionId: string;
    questionCount: number;
    isGeneratingQuestion: boolean;
    topic: string;
  };
  isRecording: boolean;
  recordingDuration: number | undefined | null;
  isLoading: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  settings: { defaultVoice: string; voiceSpeed: number; showQuestionAfterSpeech: boolean; autoPlayQuestion: boolean };
  onEndDiscussion: () => void;
  sessionId?: string | null;
}) {
  const [showQuestion, setShowQuestion] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== 'undefined' ? isMobileDevice() : false;

  // 自动滚动到最新消息
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [discussion.conversationHistory]);

  // 播放当前问题
  const playQuestionAudio = async () => {
    if (!discussion.currentQuestion) return;
    
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: discussion.currentQuestion,
          voice: settings.defaultVoice,
          speed: settings.voiceSpeed
        })
      });
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => setIsPlayingAudio(false);
      
      setIsPlayingAudio(true);
      await audio.play();
    } catch (error) {
      console.error('Audio play error:', error);
      toast.error('播放失败');
    }
  };

  // 停止音频
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    }
  };

  // 是否显示"结束讨论"按钮（至少3个问题后）
  const canEndDiscussion = discussion.questionCount >= 3;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-lg px-3 py-1">Part 3 · 双向讨论</Badge>
          <span className="text-sm text-slate-500">话题: {discussion.topic}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">已讨论 {discussion.questionCount} 个问题</span>
          {canEndDiscussion && (
            <Button
              onClick={onEndDiscussion}
              variant="outline"
              className="text-green-600 border-green-300 hover:bg-green-50"
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              结束讨论
            </Button>
          )}
        </div>
      </div>

      {/* 对话历史 */}
      <Card className="min-h-[400px]">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-indigo-600" />
            讨论记录
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div ref={scrollAreaRef} className="h-[350px] overflow-y-auto p-4 space-y-4">
            {discussion.conversationHistory.length === 0 && !discussion.currentQuestion && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p>正在生成第一个问题...</p>
              </div>
            )}
            
            {discussion.conversationHistory.map((item, index) => (
              <div key={item.questionId || index}>
                {/* 问题 */}
                <div className="flex justify-start mb-2">
                  <div className="max-w-[80%] rounded-xl p-4 bg-indigo-50 border border-indigo-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs bg-white">考官 · 问题 {index + 1}</Badge>
                    </div>
                    <p className="text-sm leading-relaxed">{item.question}</p>
                  </div>
                </div>
                {/* 回答 */}
                {item.answer && (
                  <div className="flex justify-end mb-2">
                    <div className="max-w-[80%] rounded-xl p-4 bg-slate-100 border border-slate-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs bg-white">你的回答</Badge>
                        {item.duration && <span className="text-xs text-slate-400">{item.duration}s</span>}
                      </div>
                      <p className="text-sm leading-relaxed">{item.answer}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {/* 当前问题（未回答） */}
            {discussion.currentQuestion && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-xl p-4 bg-indigo-50 border border-indigo-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs bg-white">考官 · 问题 {discussion.questionCount + 1}</Badge>
                  </div>
                  <p className="text-sm leading-relaxed">{discussion.currentQuestion}</p>
                </div>
              </div>
            )}
            
            {/* 生成中提示 */}
            {discussion.isGeneratingQuestion && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-xl p-4 bg-indigo-50 border border-indigo-100">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                    <span className="text-sm text-slate-500">正在思考下一个问题...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 当前问题和控制区 */}
      {discussion.currentQuestion && !discussion.isGeneratingQuestion && (
        <Card className="border-2 border-indigo-100">
          <CardContent className="pt-4 space-y-4">
            {/* 问题显示 */}
            <div className="bg-slate-50 rounded-lg p-4 min-h-[80px] flex items-center justify-center">
              {showQuestion ? (
                <p className="text-lg text-slate-800">{discussion.currentQuestion}</p>
              ) : (
                <div className="text-center text-slate-400">
                  <Volume2 className="w-6 h-6 mx-auto mb-1 opacity-50" />
                  <p className="text-sm">点击播放听题，或点击显示查看题目</p>
                </div>
              )}
            </div>

            {/* 音频控制按钮 */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant={isPlayingAudio ? "destructive" : "outline"}
                size="sm"
                onClick={isPlayingAudio ? stopAudio : playQuestionAudio}
              >
                {isPlayingAudio ? (
                  <><Square className="w-4 h-4 mr-1" />停止</>
                ) : (
                  <><Volume2 className="w-4 h-4 mr-1" />播放问题</>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQuestion(!showQuestion)}
              >
                <Eye className="w-4 h-4 mr-1" />
                {showQuestion ? '隐藏' : '显示'}
              </Button>
            </div>

            {/* 录音控制 */}
            <div className="flex flex-col items-center gap-4">
              {isRecording && (
                <div className="flex items-center gap-2 text-red-600">
                  <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
                  <span className="text-sm font-medium">录音中 {formatTime(recordingDuration)}</span>
                  {recordingDuration && recordingDuration < 30 && (
                    <span className="text-xs text-slate-500">建议回答 30-40 秒</span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4">
                {isRecording ? (
                  <Button onClick={onStopRecording} size="lg" variant="destructive" className="gap-2">
                    <Square className="w-5 h-5" />
                    停止录音
                  </Button>
                ) : (
                  <Button 
                    onClick={onStartRecording} 
                    size="lg" 
                    className="gap-2 bg-[#E31837] hover:bg-[#C4142D]"
                    disabled={isPlayingAudio || isLoading}
                  >
                    <Mic className="w-5 h-5" />
                    开始录音
                  </Button>
                )}
              </div>
              
              {isLoading && !isRecording && (
                <p className="text-sm text-slate-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  处理中...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 提示信息 */}
      <div className="text-center text-xs text-slate-400">
        <p>Part 3 是双向讨论，考官会根据你的回答追问。请详细回答每个问题。</p>
        <p className="mt-1">至少完成 3 个问题后可结束讨论。</p>
      </div>
    </div>
  );
}

// Settings View
function SettingsView({ settings, updateSetting, user }: {
  settings: { defaultVoice: string; voiceSpeed: number; showQuestionAfterSpeech: boolean; autoPlayQuestion: boolean };
  updateSetting: <K extends keyof { defaultVoice: string; voiceSpeed: number; showQuestionAfterSpeech: boolean; autoPlayQuestion: boolean }>(key: K, value: { defaultVoice: string; voiceSpeed: number; showQuestionAfterSpeech: boolean; autoPlayQuestion: boolean }[K]) => void;
  user: { userId: string; username?: string; name?: string; isLoggedIn?: boolean; createdAt: string };
}) {
  const voices = [
    { id: 'us-female', name: '美音女声 🇺🇸' },
    { id: 'us-male', name: '美音男声 🇺🇸' },
    { id: 'uk-female', name: '英音女声 🇬🇧' },
    { id: 'uk-male', name: '英音男声 🇬🇧' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">设置</h2>

      {/* User Info */}
      <Card className={user.isLoggedIn ? "border-green-200 bg-gradient-to-r from-green-50 to-emerald-50" : "border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-[#E31837]" />用户身份</CardTitle>
          <CardDescription>
            {user.isLoggedIn ? `已登录：${user.username || user.name || '用户'}` : '访客模式 - 数据仅保存在本地浏览器'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user.isLoggedIn ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-sm font-medium text-slate-500">用户名</Label><p className="text-base font-semibold">{user.username || '-'}</p></div>
                <div><Label className="text-sm font-medium text-slate-500">昵称</Label><p className="text-base font-semibold">{user.name || '-'}</p></div>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800"><strong>✓ 数据已同步：</strong>您的练习记录和设置保存在服务器，可跨设备访问。</p>
              </div>
            </>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800"><strong>⚠ 本地数据：</strong>访客数据仅保存在当前浏览器，更换浏览器或清除数据会丢失记录。建议登录账号同步数据。</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Voice Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Volume2 className="w-5 h-5 text-indigo-600" />语音设置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">默认语音</Label>
            <div className="grid grid-cols-2 gap-2">
              {voices.map((voice) => (
                <Button key={voice.id} size="sm" variant={settings.defaultVoice === voice.id ? 'default' : 'outline'} onClick={() => updateSetting('defaultVoice', voice.id)} className={settings.defaultVoice === voice.id ? 'bg-indigo-600' : ''}>
                  {voice.name}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">语速: {settings.voiceSpeed.toFixed(1)}x</Label>
            <Slider min={0.5} max={1.5} step={0.1} value={[settings.voiceSpeed]} onValueChange={(value) => updateSetting('voiceSpeed', value[0])} className="w-full" />
          </div>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Eye className="w-5 h-5 text-emerald-600" />显示偏好</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">播放后自动显示题目</p>
              <p className="text-sm text-slate-500">
                {settings.showQuestionAfterSpeech 
                  ? '开启：音频播放完毕后自动显示题目文本' 
                  : '关闭：题目始终隐藏，需手动点击查看'}
              </p>
            </div>
            <Switch checked={settings.showQuestionAfterSpeech} onCheckedChange={(checked) => updateSetting('showQuestionAfterSpeech', checked)} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">自动播放题目语音</p>
              <p className="text-sm text-slate-500">进入新题目时自动朗读题目内容</p>
            </div>
            <Switch checked={settings.autoPlayQuestion} onCheckedChange={(checked) => updateSetting('autoPlayQuestion', checked)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Admin View - 综合管理后台
type AdminTabType = 'announcements' | 'invites' | 'users' | 'questions';

function AdminView({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<AdminTabType>('announcements');

  // ===== 公告管理状态 =====
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announcementLoading, setAnnouncementLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'info',
    isActive: true,
    priority: 0
  });

  // ===== 邀请码管理状态 =====
  const [inviteCodes, setInviteCodes] = useState<any[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createCount, setCreateCount] = useState(1);
  const [createMaxUses, setCreateMaxUses] = useState(1);
  const [createExpiresInDays, setCreateExpiresInDays] = useState<number | ''>('');

  // ===== 用户管理状态 =====
  const [users, setUsers] = useState<any[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userFilter, setUserFilter] = useState<string>('pending');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);

  // ===== 题库管理状态 =====
  const [questionPools, setQuestionPools] = useState<any[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [showPoolCreateDialog, setShowPoolCreateDialog] = useState(false);
  const [newPoolName, setNewPoolName] = useState('');
  const [newPoolDescription, setNewPoolDescription] = useState('');
  const [selectedPoolForGenerate, setSelectedPoolForGenerate] = useState<any | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generatePart, setGeneratePart] = useState(1);
  const [generateTopic, setGenerateTopic] = useState('');
  const [generateCount, setGenerateCount] = useState(5);
  const [generating, setGenerating] = useState(false);

  // ===== 初始化加载 =====
  useEffect(() => {
    fetchAnnouncements();
    loadInviteCodes();
    loadUsers(userFilter);
    loadQuestionPools();
  }, []);

  // ===== 公告管理函数 =====
  const fetchAnnouncements = async () => {
    setAnnouncementLoading(true);
    try {
      const response = await fetch('/api/announcement?all=true');
      const data = await response.json();
      if (data.success) {
        setAnnouncements(data.announcements);
      }
    } catch (error) {
      toast.error('获取公告失败');
    }
    setAnnouncementLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) {
      toast.error('标题和内容不能为空');
      return;
    }

    try {
      const url = editingId ? '/api/announcement' : '/api/announcement';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { ...formData, id: editingId } : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (data.success) {
        toast.success(editingId ? '公告已更新' : '公告已创建');
        setFormData({ title: '', content: '', type: 'info', isActive: true, priority: 0 });
        setEditingId(null);
        fetchAnnouncements();
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('确定删除此公告？')) return;

    try {
      const response = await fetch(`/api/announcement?id=${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        toast.success('公告已删除');
        fetchAnnouncements();
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch (error) {
      toast.error('删除失败');
    }
  };

  const handleEdit = (announcement: any) => {
    setEditingId(announcement.id);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      isActive: announcement.isActive,
      priority: announcement.priority
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ title: '', content: '', type: 'info', isActive: true, priority: 0 });
  };

  const typeOptions = [
    { value: 'info', label: '普通通知', color: 'bg-slate-50 border-slate-200' },
    { value: 'update', label: '功能更新', color: 'bg-blue-50 border-blue-200' },
    { value: 'warning', label: '重要提醒', color: 'bg-amber-50 border-amber-200' },
    { value: 'maintenance', label: '维护通知', color: 'bg-red-50 border-red-200' }
  ];

  // ===== 邀请码管理函数 =====
  const loadInviteCodes = async () => {
    setInviteLoading(true);
    try {
      const response = await fetch('/api/invite');
      const data = await response.json();
      if (data.success) {
        setInviteCodes(data.codes);
      }
    } catch (error) {
      console.error('Load invite codes error:', error);
    }
    setInviteLoading(false);
  };

  const createInviteCodes = async () => {
    try {
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: createCount,
          maxUses: createMaxUses,
          expiresInDays: createExpiresInDays || undefined
        })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        setShowCreateDialog(false);
        setCreateCount(1);
        setCreateMaxUses(1);
        setCreateExpiresInDays('');
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

  // ===== 用户管理函数 =====
  const loadUsers = async (status?: string) => {
    setUserLoading(true);
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
    setUserLoading(false);
  };

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

  // ===== 题库管理函数 =====
  const loadQuestionPools = async () => {
    setPoolLoading(true);
    try {
      const response = await fetch('/api/pool?includeCount=true');
      const data = await response.json();
      if (data.success) {
        setQuestionPools(data.pools);
      }
    } catch (error) {
      console.error('Load question pools error:', error);
    }
    setPoolLoading(false);
  };

  const createQuestionPool = async () => {
    if (!newPoolName.trim()) {
      toast.error('请输入题库名称');
      return;
    }

    setPoolLoading(true);
    try {
      console.log('[Pool] Creating pool:', newPoolName.trim());
      const response = await fetch('/api/pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPoolName.trim(),
          description: newPoolDescription.trim(),
          isDefault: questionPools.length === 0 // 第一个题库自动设为默认
        })
      });

      const data = await response.json();
      console.log('[Pool] Create response:', data);

      if (data.success) {
        toast.success('题库创建成功');
        setNewPoolName('');
        setNewPoolDescription('');
        setShowPoolCreateDialog(false);
        loadQuestionPools();
      } else {
        toast.error(data.error || '创建失败');
        if (data.details) {
          console.error('[Pool] Error details:', data.details);
        }
      }
    } catch (error: any) {
      console.error('[Pool] Create error:', error);
      toast.error('创建失败: ' + (error.message || '网络错误'));
    }
    setPoolLoading(false);
  };

  const setDefaultPool = async (poolId: string) => {
    try {
      const response = await fetch('/api/pool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: poolId, isDefault: true })
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

  const deletePool = async (poolId: string) => {
    if (!confirm('确定删除此题库？题库中的所有题目也会被删除！')) return;

    try {
      const response = await fetch(`/api/pool?id=${poolId}`, { method: 'DELETE' });
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

  const generateQuestionsForPool = async () => {
    if (!selectedPoolForGenerate) return;
    if (!generateTopic.trim()) {
      toast.error('请输入话题');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/pool/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId: selectedPoolForGenerate.id,
          partNumber: generatePart,
          topic: generateTopic.trim(),
          count: generateCount
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`成功生成 ${data.generated} 道题目`);
        setGenerateTopic('');
        setShowGenerateDialog(false);
        loadQuestionPools();
      } else {
        toast.error(data.error || '生成失败');
      }
    } catch (error) {
      toast.error('生成失败');
    }
    setGenerating(false);
  };

  // ===== 格式化函数 =====
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

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      suspended: 'bg-gray-100 text-gray-800 border-gray-200',
      active: 'bg-green-100 text-green-800 border-green-200',
      used: 'bg-gray-100 text-gray-800 border-gray-200',
      disabled: 'bg-red-100 text-red-800 border-red-200'
    };
    const labels: Record<string, string> = {
      pending: '待审批',
      approved: '已批准',
      rejected: '已拒绝',
      suspended: '已禁用',
      active: '可用',
      used: '已使用',
      disabled: '已禁用'
    };
    return (
      <Badge className={styles[status] || 'bg-gray-100 text-gray-800'}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-[#E31837]" />
          <h2 className="text-2xl font-bold">管理后台</h2>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          返回
        </Button>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('announcements')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'announcements' ? 'bg-white shadow text-[#E31837]' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          公告管理
        </button>
        <button
          onClick={() => setActiveTab('invites')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'invites' ? 'bg-white shadow text-[#E31837]' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Key className="w-4 h-4" />
          邀请码
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'users' ? 'bg-white shadow text-[#E31837]' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          用户审批
        </button>
        <button
          onClick={() => setActiveTab('questions')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'questions' ? 'bg-white shadow text-[#E31837]' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          题库管理
        </button>
      </div>

      {/* ===== 公告管理 Tab ===== */}
      {activeTab === 'announcements' && (
        <>
          {/* 创建/编辑公告 */}
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? '编辑公告' : '发布新公告'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">标题</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="公告标题（可选）"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">内容 *</Label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="公告内容..."
                    className="mt-1 w-full min-h-[80px] p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium">类型</Label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="mt-1 w-full p-2 border border-slate-200 rounded-lg text-sm"
                    >
                      {typeOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">优先级</Label>
                    <Input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">启用</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="bg-[#E31837] hover:bg-[#C4142D]">
                    {editingId ? '更新公告' : '发布公告'}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outline" onClick={handleCancel}>
                      取消
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* 公告列表 */}
          <Card>
            <CardHeader>
              <CardTitle>已有公告 ({announcements.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {announcementLoading ? (
                <div className="text-center py-8 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  加载中...
                </div>
              ) : announcements.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  暂无公告
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map((a) => (
                    <div
                      key={a.id}
                      className={`p-4 rounded-lg border ${
                        typeOptions.find(t => t.value === a.type)?.color || 'bg-slate-50'
                      } ${!a.isActive ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {a.title && <span className="font-medium">{a.title}</span>}
                            <Badge variant="outline" className="text-xs">
                              {typeOptions.find(t => t.value === a.type)?.label}
                            </Badge>
                            {!a.isActive && (
                              <Badge variant="outline" className="text-xs bg-slate-100">已禁用</Badge>
                            )}
                            <span className="text-xs text-slate-400">优先级: {a.priority}</span>
                          </div>
                          <p className="text-sm">{a.content}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(a.createdAt).toLocaleString('zh-CN')}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(a)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteAnnouncement(a.id)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ===== 邀请码管理 Tab ===== */}
      {activeTab === 'invites' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">邀请码管理</h3>
              <p className="text-sm text-slate-500">创建和管理邀请码，控制用户注册</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadInviteCodes}>
                <RefreshCw className="w-4 h-4 mr-2" />
                刷新
              </Button>
              <Button onClick={() => setShowCreateDialog(true)} className="bg-[#E31837] hover:bg-[#C4142D]">
                <Plus className="w-4 h-4 mr-2" />
                创建邀请码
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">邀请码列表</CardTitle>
            </CardHeader>
            <CardContent>
              {inviteLoading ? (
                <div className="text-center py-8 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  加载中...
                </div>
              ) : inviteCodes.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Key className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>暂无邀请码</p>
                  <p className="text-sm mt-1">点击上方按钮创建邀请码</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
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
                          {getStatusBadge(code.status)}
                        </div>
                        <div className="flex items-center gap-6 text-sm text-slate-600">
                          <div className="text-center">
                            <p className="text-xs text-slate-400">使用次数</p>
                            <p className="font-medium">{code.usedCount}/{code.maxUses}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-400">创建时间</p>
                            <p className="font-medium">{formatDate(code.createdAt)}</p>
                          </div>
                          {code.expiresAt && (
                            <div className="text-center">
                              <p className="text-xs text-slate-400">过期时间</p>
                              <p className="font-medium">{formatDate(code.expiresAt)}</p>
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

          {/* 创建邀请码对话框 */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建邀请码</DialogTitle>
                <DialogDescription>批量创建邀请码，用于控制用户注册</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>创建数量</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={createCount}
                    onChange={(e) => setCreateCount(parseInt(e.target.value) || 1)}
                  />
                  <p className="text-xs text-slate-500">一次最多创建 100 个邀请码</p>
                </div>
                <div className="space-y-2">
                  <Label>每个邀请码可使用次数</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={createMaxUses}
                    onChange={(e) => setCreateMaxUses(parseInt(e.target.value) || 1)}
                  />
                  <p className="text-xs text-slate-500">默认每个邀请码只能使用一次</p>
                </div>
                <div className="space-y-2">
                  <Label>有效期（天）</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="留空表示永久有效"
                    value={createExpiresInDays}
                    onChange={(e) => setCreateExpiresInDays(e.target.value ? parseInt(e.target.value) : '')}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  取消
                </Button>
                <Button onClick={createInviteCodes} className="bg-[#E31837] hover:bg-[#C4142D]">
                  创建
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ===== 用户审批 Tab ===== */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">用户管理</h3>
              <p className="text-sm text-slate-500">审批新用户注册，管理用户权限</p>
            </div>
            <div className="flex gap-2">
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
              <Button variant="outline" size="sm" onClick={() => loadUsers(userFilter === 'all' ? undefined : userFilter)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                刷新
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">用户列表</CardTitle>
            </CardHeader>
            <CardContent>
              {userLoading ? (
                <div className="text-center py-8 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  加载中...
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>暂无用户</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
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
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => approveUser(user.id)}
                              >
                                <Check className="w-4 h-4 mr-1" />
                                批准
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => rejectUser(user.id)}
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
      )}

      {/* ===== 题库管理 Tab ===== */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">题库管理</h3>
              <p className="text-sm text-slate-500">创建和管理雅思口语题库，支持 AI 自动生成题目</p>
            </div>
            <Button onClick={() => setShowPoolCreateDialog(true)} className="bg-[#E31837] hover:bg-[#C4142D]">
              <Plus className="w-4 h-4 mr-2" />
              创建题库
            </Button>
          </div>

          {/* 题库列表 */}
          {poolLoading ? (
            <div className="text-center py-8 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              加载中...
            </div>
          ) : questionPools.length === 0 ? (
            <Card>
              <CardContent className="pt-8 pb-8 text-center text-slate-500">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无题库</p>
                <p className="text-sm mt-1">点击上方按钮创建第一个题库</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {questionPools.map((pool) => (
                <Card key={pool.id} className={`${pool.isDefault ? 'border-[#E31837] border-2' : ''}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {pool.name}
                          {pool.isDefault && (
                            <Badge className="bg-[#E31837]">默认题库</Badge>
                          )}
                        </CardTitle>
                        {pool.description && (
                          <CardDescription className="mt-1">{pool.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!pool.isDefault && (
                          <Button variant="outline" size="sm" onClick={() => setDefaultPool(pool.id)}>
                            设为默认
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedPoolForGenerate(pool);
                            setShowGenerateDialog(true);
                          }}
                        >
                          <Sparkles className="w-4 h-4 mr-1" />
                          生成题目
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => deletePool(pool.id)}
                          disabled={pool.isDefault && questionPools.length > 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">{pool.part1Count || 0}</p>
                        <p className="text-xs text-slate-500">Part 1</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">{pool.part2Count || 0}</p>
                        <p className="text-xs text-slate-500">Part 2</p>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-lg">
                        <p className="text-2xl font-bold text-purple-600">{pool.part3Count || 0}</p>
                        <p className="text-xs text-slate-500">Part 3</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-2xl font-bold text-slate-600">{(pool.part1Count || 0) + (pool.part2Count || 0) + (pool.part3Count || 0)}</p>
                        <p className="text-xs text-slate-500">总计</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 创建题库对话框 */}
          <Dialog open={showPoolCreateDialog} onOpenChange={setShowPoolCreateDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建新题库</DialogTitle>
                <DialogDescription>
                  创建一个新的雅思口语题库，例如 "2026年1-4月题库"
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>题库名称 *</Label>
                  <Input
                    value={newPoolName}
                    onChange={(e) => setNewPoolName(e.target.value)}
                    placeholder="例如：2026年1-4月雅思口语题库"
                  />
                </div>
                <div className="space-y-2">
                  <Label>描述（可选）</Label>
                  <textarea
                    value={newPoolDescription}
                    onChange={(e) => setNewPoolDescription(e.target.value)}
                    placeholder="题库描述..."
                    className="w-full min-h-[80px] p-3 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPoolCreateDialog(false)}>
                  取消
                </Button>
                <Button onClick={createQuestionPool} className="bg-[#E31837] hover:bg-[#C4142D]">
                  创建
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 生成题目对话框 */}
          <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>AI 生成题目</DialogTitle>
                <DialogDescription>
                  为题库 "{selectedPoolForGenerate?.name}" 生成雅思口语题目
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>题目部分</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((part) => (
                      <Button
                        key={part}
                        variant={generatePart === part ? 'default' : 'outline'}
                        onClick={() => setGeneratePart(part)}
                        className={generatePart === part ? 'bg-[#E31837] hover:bg-[#C4142D]' : ''}
                      >
                        Part {part}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>话题</Label>
                  <Input
                    value={generateTopic}
                    onChange={(e) => setGenerateTopic(e.target.value)}
                    placeholder="例如：Hometown, Work, Study, Travel..."
                  />
                  <p className="text-xs text-slate-500">输入雅思口语话题，AI 将根据话题生成相关题目</p>
                </div>
                <div className="space-y-2">
                  <Label>生成数量</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={generateCount}
                    onChange={(e) => setGenerateCount(parseInt(e.target.value) || 5)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
                  取消
                </Button>
                <Button
                  onClick={generateQuestionsForPool}
                  disabled={generating}
                  className="bg-[#E31837] hover:bg-[#C4142D]"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      开始生成
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
