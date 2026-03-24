// IndexedDB 音频存储服务 - 将音频保存到浏览器本地

const DB_NAME = 'ielts-audio-db';
const DB_VERSION = 1;
const STORE_NAME = 'audio-records';

export interface AudioRecord {
  id: string; // 格式: sessionId-responseId 或 sessionId-responseId-model
  sessionId: string;
  responseId: string;
  type: 'recording' | 'modelAnswer'; // 录音或参考回答
  audioBlob: Blob; // 音频 Blob 数据
  duration?: number; // 录音时长（秒）
  createdAt: number; // 时间戳
}

class IndexedDBAudioService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[IndexedDB] 打开数据库失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[IndexedDB] 数据库连接成功');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          console.log('[IndexedDB] 创建对象存储成功');
        }
      };
    });

    return this.initPromise;
  }

  // 保存录音
  async saveRecording(
    sessionId: string,
    responseId: string,
    audioBase64: string,
    duration?: number
  ): Promise<string> {
    const db = await this.init();
    
    // 将 base64 转换为 Blob
    const base64Data = audioBase64.replace(/^data:audio\/\w+;base64,/, '');
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const audioBlob = new Blob([byteArray], { type: 'audio/webm' });

    const record: AudioRecord = {
      id: `${sessionId}-${responseId}`,
      sessionId,
      responseId,
      type: 'recording',
      audioBlob,
      duration,
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onsuccess = () => {
        console.log('[IndexedDB] 录音保存成功:', record.id);
        resolve(record.id);
      };

      request.onerror = () => {
        console.error('[IndexedDB] 录音保存失败:', request.error);
        reject(request.error);
      };
    });
  }

  // 保存参考回答音频（TTS 生成的）
  async saveModelAnswerAudio(
    sessionId: string,
    responseId: string,
    audioBlob: Blob
  ): Promise<string> {
    const db = await this.init();

    const record: AudioRecord = {
      id: `${sessionId}-${responseId}-model`,
      sessionId,
      responseId,
      type: 'modelAnswer',
      audioBlob,
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onsuccess = () => {
        console.log('[IndexedDB] 参考回答音频保存成功:', record.id);
        resolve(record.id);
      };

      request.onerror = () => {
        console.error('[IndexedDB] 参考回答音频保存失败:', request.error);
        reject(request.error);
      };
    });
  }

  // 获取录音
  async getRecording(sessionId: string, responseId: string): Promise<Blob | null> {
    const db = await this.init();
    const id = `${sessionId}-${responseId}`;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const record = request.result as AudioRecord | undefined;
        if (record) {
          resolve(record.audioBlob);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('[IndexedDB] 获取录音失败:', request.error);
        reject(request.error);
      };
    });
  }

  // 获取参考回答音频
  async getModelAnswerAudio(sessionId: string, responseId: string): Promise<Blob | null> {
    const db = await this.init();
    const id = `${sessionId}-${responseId}-model`;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const record = request.result as AudioRecord | undefined;
        if (record) {
          resolve(record.audioBlob);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('[IndexedDB] 获取参考回答音频失败:', request.error);
        reject(request.error);
      };
    });
  }

  // 获取会话的所有音频记录
  async getSessionAudios(sessionId: string): Promise<AudioRecord[]> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('sessionId');
      const request = index.getAll(sessionId);

      request.onsuccess = () => {
        resolve(request.result as AudioRecord[]);
      };

      request.onerror = () => {
        console.error('[IndexedDB] 获取会话音频失败:', request.error);
        reject(request.error);
      };
    });
  }

  // 删除会话的所有音频
  async deleteSessionAudios(sessionId: string): Promise<void> {
    const db = await this.init();
    const records = await this.getSessionAudios(sessionId);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      for (const record of records) {
        store.delete(record.id);
      }

      transaction.oncomplete = () => {
        console.log('[IndexedDB] 删除会话音频成功:', sessionId);
        resolve();
      };

      transaction.onerror = () => {
        console.error('[IndexedDB] 删除会话音频失败:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  // 获取存储大小估算（字节）
  async getStorageSize(): Promise<number> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result as AudioRecord[];
        let totalSize = 0;
        for (const record of records) {
          totalSize += record.audioBlob.size;
        }
        resolve(totalSize);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // 获取所有会话 ID
  async getAllSessionIds(): Promise<string[]> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result as AudioRecord[];
        const sessionIds = [...new Set(records.map(r => r.sessionId))];
        resolve(sessionIds);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // 创建音频 URL（用于播放）
  createAudioUrl(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  // 释放音频 URL
  revokeAudioUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}

// 单例导出
export const indexedDBAudio = new IndexedDBAudioService();
