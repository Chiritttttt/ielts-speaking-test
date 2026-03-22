import { create } from 'zustand';

export type ViewType = 'home' | 'test' | 'result' | 'improvement' | 'history' | 'questionBank' | 'settings';

export interface AppSettings {
  defaultVoice: string;
  voiceSpeed: number;
  showQuestionAfterSpeech: boolean;
  autoPlayQuestion: boolean;
}

export interface UserInfo {
  userId: string;
  username?: string;
  name?: string;
  level?: string;
  isLoggedIn: boolean;
  createdAt: string;
}

export interface Question {
  id: string;
  questionText: string;
  category?: string;
  followUpQuestions?: string[];
}

export interface ResponseData {
  partNumber: number;
  questionText: string;
  transcription: string;
  duration: number;
  scores: {
    fluencyCoherence: number;
    lexicalResource: number;
    grammaticalRange: number;
    pronunciation: number;
    overall: number;
  };
  feedback?: Record<string, string>;
  improvements?: Array<{
    area: string;
    issue: string;
    suggestion: string;
    examples?: string[];
  }>;
  modelAnswer?: string;
}

export interface PendingTranscription {
  questionId: string;
  questionText: string;
  transcription: string;
  duration: number;
  partNumber: number;
  audioBase64?: string;
}

export interface SessionData {
  id: string;
  testType: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  bandScore?: number;
  responses?: any[];
  createdAt?: string;
}

export interface ImprovementPlan {
  summary?: string;
  keyStrengths?: string[];
  topPriorities?: Array<{
    area: string;
    issue: string;
    tip: string;
  }>;
  quickPractice?: string[];
}

const defaultSettings: AppSettings = {
  defaultVoice: 'us-female',
  voiceSpeed: 1.0,
  showQuestionAfterSpeech: true,  // true = 语音播放后显示（默认隐藏）
  autoPlayQuestion: true,
};

const defaultUser: UserInfo = {
  userId: '',
  username: '',
  createdAt: new Date().toISOString(),
  isLoggedIn: false
};

const loadSettingsFromStorage = (): AppSettings => {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const saved = localStorage.getItem('ielts-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultSettings, ...parsed };
    }
  } catch (error) {
    console.warn('[IELTS Store] Failed to load settings:', error);
  }
  return defaultSettings;
};

const saveSettingsToStorage = (settings: AppSettings) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('ielts-settings', JSON.stringify(settings));
  } catch (error) {
    console.warn('[IELTS Store] Failed to save settings:', error);
  }
};

export const loadSettingsFromServer = async (): Promise<AppSettings | null> => {
  try {
    const response = await fetch('/api/user/settings');
    const data = await response.json();
    if (data.success && data.settings) {
      return {
        defaultVoice: data.settings.defaultVoice || defaultSettings.defaultVoice,
        voiceSpeed: data.settings.voiceSpeed ?? defaultSettings.voiceSpeed,
        showQuestionAfterSpeech: data.settings.showQuestionAfterSpeech ?? defaultSettings.showQuestionAfterSpeech,
        autoPlayQuestion: data.settings.autoPlayQuestion ?? defaultSettings.autoPlayQuestion,
      };
    }
    return null;
  } catch (error) {
    console.warn('[IELTS Store] Failed to load settings from server:', error);
    return null;
  }
};

export const saveSettingsToServer = async (settings: AppSettings): Promise<boolean> => {
  try {
    const response = await fetch('/api/user/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.warn('[IELTS Store] Failed to save settings to server:', error);
    return false;
  }
};

interface IELTSState {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  testMode: 'part1' | 'part2' | 'part3' | 'full';
  setTestMode: (mode: 'part1' | 'part2' | 'part3' | 'full') => void;
  selectedTopic: string | null;
  setSelectedTopic: (topic: string | null) => void;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  questions: Question[];
  setQuestions: (questions: Question[]) => void;
  currentQuestionIndex: number;
  currentPart: number;
  nextQuestion: () => void;
  prevQuestion: () => void;
  setCurrentPart: (part: number) => void;
  responses: ResponseData[];
  addResponse: (response: ResponseData) => void;
  clearResponses: () => void;
  pendingTranscriptions: PendingTranscription[];
  addPendingTranscription: (transcription: PendingTranscription) => void;
  clearPendingTranscriptions: () => void;
  isRecording: boolean;
  recordingDuration: number;
  setIsRecording: (recording: boolean) => void;
  setRecordingDuration: (duration: number) => void;
  currentEvaluation: any;
  setCurrentEvaluation: (evaluation: any) => void;
  improvementPlan: ImprovementPlan | null;
  setImprovementPlan: (plan: ImprovementPlan | null) => void;
  historySessions: SessionData[];
  setHistorySessions: (sessions: SessionData[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  loadServerSettings: () => Promise<void>;
  user: UserInfo;
  initUser: () => void;
  setUser: (user: Partial<UserInfo>) => void;
  logout: () => void;
  reset: () => void;
}

const generateUserId = (): string => {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

export const useIELTSStore = create<IELTSState>((set, get) => ({
  currentView: 'home',
  testMode: 'full',
  selectedTopic: null,
  sessionId: null,
  questions: [],
  currentQuestionIndex: 0,
  currentPart: 1,
  responses: [],
  pendingTranscriptions: [],
  isRecording: false,
  recordingDuration: 0,
  currentEvaluation: null,
  improvementPlan: null,
  historySessions: [],
  isLoading: false,
  settings: typeof window !== 'undefined' ? loadSettingsFromStorage() : defaultSettings,
  user: defaultUser,

  setView: (view) => set({ currentView: view }),
  setTestMode: (mode) => set({ testMode: mode }),
  setSelectedTopic: (topic) => set({ selectedTopic: topic }),
  setSessionId: (id) => set({ sessionId: id }),
  setQuestions: (questions) => set({ questions }),
  nextQuestion: () => set((state) => ({ currentQuestionIndex: state.currentQuestionIndex + 1 })),
  prevQuestion: () => set((state) => ({ currentQuestionIndex: Math.max(0, state.currentQuestionIndex - 1) })),
  setCurrentPart: (part) => set({ currentPart: part, currentQuestionIndex: 0 }),
  addResponse: (response) => set((state) => ({ responses: [...state.responses, response] })),
  clearResponses: () => set({ responses: [] }),
  addPendingTranscription: (transcription) => set((state) => ({ pendingTranscriptions: [...state.pendingTranscriptions, transcription] })),
  clearPendingTranscriptions: () => set({ pendingTranscriptions: [] }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  setRecordingDuration: (duration) => set({ recordingDuration: duration }),
  setCurrentEvaluation: (evaluation) => set({ currentEvaluation: evaluation }),
  setImprovementPlan: (plan) => set({ improvementPlan: plan }),
  setHistorySessions: (sessions) => set({ historySessions: sessions }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setSettings: (settings) => {
    saveSettingsToStorage(settings);
    const state = get();
    if (state.user.isLoggedIn) {
      saveSettingsToServer(settings);
    }
    set({ settings });
  },
  updateSetting: (key, value) => {
    const state = get();
    const newSettings = { ...state.settings, [key]: value };
    saveSettingsToStorage(newSettings);
    if (state.user.isLoggedIn) {
      saveSettingsToServer(newSettings);
    }
    set({ settings: newSettings });
  },
  loadServerSettings: async () => {
    const serverSettings = await loadSettingsFromServer();
    if (serverSettings) {
      saveSettingsToStorage(serverSettings);
      set({ settings: serverSettings });
    }
  },
  initUser: () => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('ielts-user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.userId) {
          set({ user: { ...defaultUser, ...parsed } });
          return;
        }
      }
    } catch (error) {
      console.warn('[IELTS Store] Failed to load user:', error);
    }
    const newUser: UserInfo = {
      userId: generateUserId(),
      createdAt: new Date().toISOString(),
      isLoggedIn: false
    };
    try {
      localStorage.setItem('ielts-user', JSON.stringify(newUser));
    } catch (error) {
      console.warn('[IELTS Store] Failed to save user:', error);
    }
    set({ user: newUser });
  },
  setUser: (userData) => {
    const state = get();
    const newUser = { ...state.user, ...userData };
    try {
      localStorage.setItem('ielts-user', JSON.stringify(newUser));
    } catch (error) {
      console.warn('[IELTS Store] Failed to save user:', error);
    }
    set({ user: newUser });
  },
  logout: () => {
    const newUser: UserInfo = {
      userId: generateUserId(),
      createdAt: new Date().toISOString(),
      isLoggedIn: false
    };
    try {
      localStorage.setItem('ielts-user', JSON.stringify(newUser));
    } catch (error) {
      console.warn('[IELTS Store] Failed to save user:', error);
    }
    set({ user: newUser });
  },
  reset: () => {
    const state = get();
    set({
      currentView: 'home',
      testMode: 'full',
      selectedTopic: null,
      sessionId: null,
      questions: [],
      currentQuestionIndex: 0,
      currentPart: 1,
      responses: [],
      pendingTranscriptions: [],
      isRecording: false,
      recordingDuration: 0,
      currentEvaluation: null,
      improvementPlan: null,
      historySessions: [],
      isLoading: false,
      settings: state.settings,
      user: state.user,
    });
  },
}));
