'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Play, Square, ChevronRight, ChevronLeft, RotateCcw,
  BarChart3, TrendingUp, BookOpen, Award, Clock, Target, Lightbulb,
  Volume2, CheckCircle2, AlertCircle, Loader2, History, User, Star,
  ArrowRight, RefreshCw, Download, Share2, Database, Plus, Sparkles,
  Eye, Trash2, X, LogOut
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
import { useIELTSStore, type ResponseData, type ImprovementPlan, type PendingTranscription, loadSettingsFromServer } from '@/store/ielts-store';
import { LoginDialog, RegisterDialog } from '@/components/auth';
import { toast } from 'sonner';

// Topic lists
const TOPICS = {
  part1: ['Hometown', 'Work & Study', 'Technology', 'Leisure', 'Food', 'Travel', 'Family', 'Friends', 'Music', 'Movies', 'Sports', 'Reading'],
  part2: ['Person', 'Place', 'Experience', 'Skill', 'Object', 'Event', 'Book', 'Movie', 'Travel', 'Achievement', 'Challenge', 'Gift'],
  part3: ['Education', 'Society', 'Environment', 'Technology', 'Culture', 'Health', 'Work', 'Relationships', 'Media', 'Globalization']
};

const defaultQuestions = {
  part1: [
    { id: 'p1-1', questionText: "Let's talk about your hometown. Where are you from?", category: "Hometown" },
    { id: 'p1-2', questionText: "What do you like most about living there?", category: "Hometown" },
    { id: 'p1-3', questionText: "Has your hometown changed much in recent years?", category: "Hometown" },
    { id: 'p1-4', questionText: "Do you work or are you a student?", category: "Work & Study" },
  ],
  part2: [
    { 
      id: 'p2-1', 
      questionText: "Describe a skill you would like to learn.\n\nYou should say:\n- what skill it is\n- why you want to learn it\n- how you would learn it\n- and explain how this skill would be useful to you.",
      category: "Skills"
    }
  ],
  part3: [
    { id: 'p3-1', questionText: "What skills are most important for young people to learn today?", category: "Skills" },
    { id: 'p3-2', questionText: "How has technology changed the way people learn new skills?", category: "Skills" },
    { id: 'p3-3', questionText: "Do you think practical skills or academic knowledge is more valuable?", category: "Skills" },
    { id: 'p3-4', questionText: "What role should schools play in developing students' skills?", category: "Skills" },
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
    user, initUser, setUser, logout
  } = useIELTSStore();

  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [authUser, setAuthUser] = useState<{ id: string; username: string; name?: string } | null>(null);

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

  // Fetch questions
  const fetchQuestions = useCallback(async (part: number, topic?: string | null, autoGenerate: boolean = true) => {
    setIsLoading(true);
    try {
      const selectedTopic = topic || TOPICS[`part${part}` as keyof typeof TOPICS]?.[Math.floor(Math.random() * (TOPICS[`part${part}` as keyof typeof TOPICS]?.length || 0))];
      
      let url = `/api/questions?part=${part}&count=${part === 2 ? 1 : 4}`;
      if (selectedTopic) url += `&category=${encodeURIComponent(selectedTopic)}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.questions.length > 0) {
        setQuestions(data.questions);
        setSelectedTopic(selectedTopic);
      } else if (autoGenerate) {
        toast.info(`题库中暂无 ${selectedTopic} 话题的题目，正在自动生成...`);
        
        const generateResponse = await fetch('/api/questions/update', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ part, topic: selectedTopic, count: part === 2 ? 1 : 4 })
        });
        
        const generateData = await generateResponse.json();
        
        if (generateData.success && generateData.saved > 0) {
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
          toast.error('题目生成失败，使用默认题目');
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
  }, [setIsLoading, setQuestions, setSelectedTopic]);

  // Create session
  const createSession = async () => {
    try {
      const currentUserId = user.userId || `guest_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      const response = await fetch('/api/test-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: testMode, userId: currentUserId })
      });
      const data = await response.json();
      if (data.success) {
        setSessionId(data.session.id);
        return data.session.id;
      }
    } catch (error) {
      toast.error('创建会话失败');
    }
    return null;
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
    
    await createSession();
    const part = mode === 'full' ? 1 : parseInt(mode.replace('part', ''));
    
    let topic = null;
    if (useCustomTopic && customTopic.trim()) {
      topic = customTopic.trim();
    } else {
      topic = mode === 'full' 
        ? selectedPartTopics.part1 
        : selectedPartTopics[`part${part}` as keyof typeof selectedPartTopics];
    }
    
    await fetchQuestions(part, topic, true);
    
    setView('test');
    setPendingTestMode(null);
  };

  // Start test directly with random topic
  const startTestDirectly = async (mode: 'part1' | 'part2' | 'part3' | 'full') => {
    setShowTopicDialog(false);
    setTestMode(mode);
    clearResponses();
    setCurrentPart(mode === 'full' ? 1 : parseInt(mode.replace('part', '')));
    
    await createSession();
    const part = mode === 'full' ? 1 : parseInt(mode.replace('part', ''));
    
    await fetchQuestions(part, null, true);
    
    setView('test');
    setPendingTestMode(null);
  };

  // Recording control
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('您的浏览器不支持录音功能');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setLiveTranscription('');
      transcriptRef.current = '';

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      let duration = 0;
      timerRef.current = setInterval(() => {
        duration += 1;
        setRecordingDuration(duration);
      }, 1000);

      startLiveTranscription();
      toast.success('开始录音');
    } catch (error: unknown) {
      const err = error as Error;
      if (err.name === 'NotAllowedError') {
        toast.error('麦克风权限被拒绝');
      } else {
        toast.error(`无法访问麦克风: ${err.message}`);
      }
    }
  };

  // Web Speech API live transcription
  const startLiveTranscription = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('[Speech Recognition] Not supported');
      return;
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
    } catch (error) {
      console.warn('[Speech Recognition] Failed:', error);
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
      
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) clearInterval(timerRef.current);

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          const base64Data = base64.split(',')[1];
          await transcribeAudio(base64Data, webSpeechResult);
        };
      };
    }
  };

  const transcribeAudio = async (base64: string, webSpeechBackup?: string) => {
    setIsLoading(true);
    toast.info('正在识别语音...');
    
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64 })
      });
      const data = await response.json();
      
      if (data.success && data.transcription && data.transcription.trim().length > 0) {
        processTranscription(data.transcription, base64);
      } else if (webSpeechBackup && webSpeechBackup.trim().length > 5) {
        toast.info('使用浏览器语音识别结果');
        processTranscription(webSpeechBackup, base64);
      } else {
        toast.error('语音识别失败: ' + (data.error || '未检测到语音'));
        setIsLoading(false);
      }
    } catch (error) {
      if (webSpeechBackup && webSpeechBackup.trim().length > 5) {
        toast.info('使用浏览器语音识别结果');
        processTranscription(webSpeechBackup, base64);
      } else {
        toast.error('语音识别服务出错');
        setIsLoading(false);
      }
    }
  };

  const processTranscription = (transcription: string, audioBase64?: string) => {
    const currentQuestion = questions[currentQuestionIndex];
    if (currentQuestion && transcription.trim().length > 0) {
      const pendingItem: PendingTranscription = {
        questionId: currentQuestion.id,
        questionText: currentQuestion.questionText,
        transcription: transcription.trim(),
        duration: recordingDuration,
        partNumber: currentPart,
        audioBase64: audioBase64
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
            toast.info('正在评估您的回答...');
            evaluatePart();
          } else {
            toast.error('没有待评估的回答');
          }
        }, 100);
      }
    }
  };

  const evaluatePart = async () => {
    setIsLoading(true);
    
    try {
      const transcriptionsToEvaluate = useIELTSStore.getState().pendingTranscriptions;
      
      if (transcriptionsToEvaluate.length === 0) {
        toast.error('没有待评估的回答');
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/evaluate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          partNumber: currentPart,
          transcriptions: transcriptionsToEvaluate
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        for (const evalResult of data.responses) {
          const responseData: ResponseData = {
            partNumber: evalResult.partNumber || currentPart,
            questionText: evalResult.questionText,
            transcription: evalResult.transcription,
            duration: evalResult.duration,
            scores: evalResult.scores,
            feedback: evalResult.feedback,
            improvements: evalResult.improvements,
            modelAnswer: evalResult.modelAnswer
          };
          addResponse(responseData);
        }
        
        clearPendingTranscriptions();
        
        setCurrentEvaluation({
          partNumber: currentPart,
          averageScores: data.averageScores,
          partBandScore: data.partBandScore,
          responses: data.responses
        });
        
        toast.success(`Part ${currentPart} 评估完成！`);
        setView('result');
      } else {
        toast.error('评估失败: ' + data.error);
      }
    } catch (error) {
      toast.error('评估服务出错');
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
      await evaluateAllParts();
    }
  };

  const evaluateAllParts = async () => {
    setIsLoading(true);
    
    try {
      const allTranscriptions = useIELTSStore.getState().pendingTranscriptions;
      
      if (allTranscriptions.length === 0) {
        toast.error('没有待评估的回答');
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/evaluate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          partNumber: 0,
          transcriptions: allTranscriptions
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        for (const evalResult of data.responses) {
          const responseData: ResponseData = {
            partNumber: evalResult.partNumber || currentPart,
            questionText: evalResult.questionText,
            transcription: evalResult.transcription,
            duration: evalResult.duration,
            scores: evalResult.scores,
            feedback: evalResult.feedback,
            improvements: evalResult.improvements,
            modelAnswer: evalResult.modelAnswer
          };
          addResponse(responseData);
        }
        
        clearPendingTranscriptions();
        
        setCurrentEvaluation({
          partNumber: 0,
          averageScores: data.averageScores,
          partBandScore: data.partBandScore,
          responses: data.responses
        });
        
        toast.success('完整测试评估完成！');
        setView('result');
      } else {
        toast.error('评估失败: ' + data.error);
      }
    } catch (error) {
      toast.error('评估服务出错');
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

  // Render different views
  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <HomeView onStartTest={openTopicDialog} onViewHistory={() => { fetchHistory(); setView('history'); }} />;
      case 'test':
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
              toast.info('已跳过当前题目');
            } else {
              const pending = useIELTSStore.getState().pendingTranscriptions;
              if (pending.length > 0) {
                toast.info('正在评估您的回答...');
                evaluatePart();
              } else {
                toast.warning('请先录音再进行评估');
              }
            }
          }}
          testMode={testMode}
          pendingCount={pendingTranscriptions.length}
          sessionId={sessionId}
          settings={settings}
          updateSetting={updateSetting}
        />;
      case 'result':
        return <ResultView 
          evaluation={currentEvaluation}
          onNext={goToNextPart}
          onRetry={() => setView('test')}
        />;
      case 'history':
        return <HistoryView 
          sessions={historySessions}
          onBack={() => setView('home')}
          onRefresh={fetchHistory}
        />;
      case 'questionBank':
        return <QuestionBankView isLoading={isLoading} setIsLoading={setIsLoading} />;
      case 'settings':
        return <SettingsView settings={settings} updateSetting={updateSetting} user={user} />;
      default:
        return <HomeView onStartTest={openTopicDialog} onViewHistory={() => { fetchHistory(); setView('history'); }} />;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#E31837] text-white">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { reset(); setView('home'); }}>
            <span className="font-semibold text-base tracking-wide">雅思口语</span>
          </div>
          
          <div className="flex items-center gap-2">
            <nav className="flex items-center">
              {[
                { label: '首页', view: 'home' as const, action: () => { reset(); setView('home'); } },
                { label: '历史', view: 'history' as const, action: () => { fetchHistory(); setView('history'); } },
                { label: '题库', view: 'questionBank' as const, action: () => setView('questionBank') },
                { label: '设置', view: 'settings' as const, action: () => setView('settings') },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="px-4 py-4 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </nav>
            
            {authUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-white/20">
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
              选择您想要练习的话题，或者输入自定义话题
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
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
            isLoggedIn: true,
            createdAt: new Date().toISOString()
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
            createdAt: new Date().toISOString()
          });
          loadServerSettings();
        }}
        onSwitchToLogin={() => {
          setShowRegisterDialog(false);
          setShowLoginDialog(true);
        }}
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-[#eaeaea] rounded shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin text-[#E31837]" />
            <span className="text-sm text-[#666666]">处理中...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Home View
function HomeView({ onStartTest, onViewHistory }: { 
  onStartTest: (mode: 'part1' | 'part2' | 'part3' | 'full') => void;
  onViewHistory?: () => void;
}) {
  return (
    <div className="space-y-0">
      <div className="bg-[#f8f8f8] -mx-4 px-4 py-16 text-center border-b border-[#eaeaea]">
        <h1 className="text-3xl font-semibold text-[#222222] mb-3">雅思口语练习</h1>
        <p className="text-[#666666] text-base">专业评估 · 个性化反馈</p>
      </div>

      <div className="px-1 pt-10 pb-8">
        <h2 className="text-xs font-semibold text-[#666666] mb-4 uppercase tracking-wider">选择测试模式</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { mode: 'part1' as const, label: 'Part 1', desc: '简介与面试 · 4-5 分钟' },
            { mode: 'part2' as const, label: 'Part 2', desc: '个人陈述 · 3-4 分钟' },
            { mode: 'part3' as const, label: 'Part 3', desc: '双向讨论 · 4-5 分钟' },
            { mode: 'full' as const, label: '完整测试', desc: '完整测试 · 11-14 分钟', isFull: true },
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

      <footer className="bg-[#333333] -mx-4 px-4 py-8 text-center text-white/60 text-xs mt-8">
        <p>雅思口语练习平台</p>
      </footer>
    </div>
  );
}

// Test View
function TestView({ 
  questions, currentQuestionIndex, currentPart, isRecording, recordingDuration,
  isLoading, onStartRecording, onStopRecording, onPrevQuestion, onNextQuestion, testMode,
  settings, updateSetting
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
  const currentQuestion = questions[currentQuestionIndex];
  const [showQuestion, setShowQuestion] = useState(settings.showQuestionAfterSpeech);

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

      <Card>
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <CardTitle className="text-xl">问题 {currentQuestionIndex + 1}</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="bg-slate-50 rounded-xl p-6 mb-6 min-h-[140px] flex items-center justify-center">
            <p className="text-lg text-slate-800 whitespace-pre-line leading-relaxed">
              {currentQuestion.questionText}
            </p>
          </div>

          {/* Recording controls */}
          <div className="flex flex-col items-center gap-6">
            {isRecording && (
              <div className="flex items-center gap-2 text-red-600">
                <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
                <span className="text-sm font-medium">录音中 {formatTime(recordingDuration)}</span>
              </div>
            )}

            <div className="flex items-center gap-4">
              {isRecording ? (
                <Button onClick={onStopRecording} size="lg" variant="destructive" className="gap-2">
                  <Square className="w-5 h-5" />
                  停止录音
                </Button>
              ) : (
                <Button onClick={onStartRecording} size="lg" className="gap-2 bg-[#E31837] hover:bg-[#C4142D]">
                  <Mic className="w-5 h-5" />
                  开始录音
                </Button>
              )}
            </div>

            <p className="text-xs text-slate-500 text-center">
              点击"开始录音"后，请对着麦克风清晰回答问题
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <Button variant="ghost" onClick={onPrevQuestion} disabled={currentQuestionIndex === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> 上一题
          </Button>
          <Button variant="outline" onClick={onNextQuestion}>
            {currentQuestionIndex < questions.length - 1 ? '下一题' : '完成评估'}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Result View
function ResultView({ evaluation, onNext, onRetry }: {
  evaluation: any;
  onNext: () => void;
  onRetry: () => void;
}) {
  if (!evaluation) {
    return <Card><CardContent className="pt-6">加载中...</CardContent></Card>;
  }

  const avgScore = evaluation.averageScores?.overall || 
    ((evaluation.averageScores?.fluencyCoherence + evaluation.averageScores?.lexicalResource + 
      evaluation.averageScores?.grammaticalRange + evaluation.averageScores?.pronunciation) / 4);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card className="overflow-hidden">
        <div className="bg-[#E31837] p-8 text-white text-center">
          <Award className="w-10 h-10 mx-auto mb-3 opacity-90" />
          <h2 className="text-2xl font-semibold mb-1">测试完成</h2>
          <div className="text-5xl font-bold mt-4">{avgScore?.toFixed(1) || '6.0'}</div>
          <p className="text-white/60 mt-1">Band Score</p>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>各项评分</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { name: '流利度与连贯性', score: evaluation.averageScores?.fluencyCoherence },
            { name: '词汇丰富度', score: evaluation.averageScores?.lexicalResource },
            { name: '语法多样性', score: evaluation.averageScores?.grammaticalRange },
            { name: '发音准确度', score: evaluation.averageScores?.pronunciation },
          ].map((item) => (
            <div key={item.name}>
              <div className="flex justify-between mb-1">
                <span className="font-medium">{item.name}</span>
                <span className="text-[#E31837] font-semibold">{(item.score || 6.0).toFixed(1)}</span>
              </div>
              <Progress value={((item.score || 6.0) / 9) * 100} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

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
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">历史记录</h2>
        <div className="flex gap-2">
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
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card key={session.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{session.testType === 'full' ? '完整测试' : `Part ${session.testType.replace('part', '')} 练习`}</p>
                    <p className="text-sm text-slate-500">{new Date(session.startedAt).toLocaleString('zh-CN')}</p>
                  </div>
                  {session.bandScore && (
                    <div className={`text-2xl font-bold px-3 py-1 rounded ${getBandColor(session.bandScore)}`}>
                      {session.bandScore.toFixed(1)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Question Bank View
function QuestionBankView({ isLoading, setIsLoading }: { isLoading: boolean; setIsLoading: (v: boolean) => void }) {
  const [selectedPart, setSelectedPart] = useState('1');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [useCustomTopic, setUseCustomTopic] = useState(false);
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [stats, setStats] = useState({ part1: 0, part2: 0, part3: 0, total: 0 });
  const [serverKeyReady, setServerKeyReady] = useState<boolean | null>(null);

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

  const generateQuestions = async (randomTopic: boolean = false) => {
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
      
      if (data.success) {
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
            <select className="px-3 py-1 border rounded-md text-sm" value={selectedPart} onChange={(e) => setSelectedPart(e.target.value)}>
              <option value="1">Part 1 ({stats.part1}题)</option>
              <option value="2">Part 2 ({stats.part2}题)</option>
              <option value="3">Part 3 ({stats.part3}题)</option>
            </select>
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
              <p className="font-medium">语音播放后显示题目文本</p>
              <p className="text-sm text-slate-500">播放完成后自动显示题目文本</p>
            </div>
            <Switch checked={settings.showQuestionAfterSpeech} onCheckedChange={(checked) => updateSetting('showQuestionAfterSpeech', checked)} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">自动播放题目</p>
              <p className="text-sm text-slate-500">进入新题目时自动朗读</p>
            </div>
            <Switch checked={settings.autoPlayQuestion} onCheckedChange={(checked) => updateSetting('autoPlayQuestion', checked)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
