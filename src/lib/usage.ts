export interface UsageRecord {
  timestamp: number;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export class UsageTracker {
  private static STORAGE_KEY = 'ai_usage_history';

  static getHistory(): UsageRecord[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static logUsage(provider: string, model: string, inputTokens: number, outputTokens: number) {
    const history = this.getHistory();
    history.push({
      timestamp: Date.now(),
      provider,
      model,
      inputTokens,
      outputTokens
    });
    
    // Keep only last 30 days or last 1000 records to prevent localStorage overflow
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const filtered = history.filter(r => r.timestamp > thirtyDaysAgo).slice(-1000);
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    
    // Dispatch event for real-time UI updates
    window.dispatchEvent(new Event('ai_usage_updated'));
  }

  static getRequestsLastMinute(): number {
    const history = this.getHistory();
    const oneMinuteAgo = Date.now() - 60 * 1000;
    return history.filter(r => r.timestamp > oneMinuteAgo).length;
  }

  static getTodayUsage() {
    const history = this.getHistory();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const todayRecords = history.filter(r => r.timestamp > startOfDay.getTime());
    
    let totalInput = 0;
    let totalOutput = 0;
    
    todayRecords.forEach(r => {
      totalInput += r.inputTokens;
      totalOutput += r.outputTokens;
    });
    
    return {
      requests: todayRecords.length,
      inputTokens: totalInput,
      outputTokens: totalOutput
    };
  }
  
  static clearHistory() {
    localStorage.removeItem(this.STORAGE_KEY);
    window.dispatchEvent(new Event('ai_usage_updated'));
  }
}
