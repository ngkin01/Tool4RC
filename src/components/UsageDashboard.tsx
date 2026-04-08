import React, { useState, useEffect } from 'react';
import { Modal } from './ui';
import { UsageTracker, UsageRecord } from '../lib/usage';

export function UsageDashboard({ onClose }: { onClose: () => void }) {
  const [todayUsage, setTodayUsage] = useState({ requests: 0, inputTokens: 0, outputTokens: 0 });
  const [history, setHistory] = useState<UsageRecord[]>([]);

  const loadData = () => {
    setTodayUsage(UsageTracker.getTodayUsage());
    setHistory(UsageTracker.getHistory().reverse().slice(0, 50)); // Show last 50
  };

  useEffect(() => {
    loadData();
    window.addEventListener('ai_usage_updated', loadData);
    return () => window.removeEventListener('ai_usage_updated', loadData);
  }, []);

  const formatNumber = (num: number) => new Intl.NumberFormat().format(num);

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear all usage history?")) {
      UsageTracker.clearHistory();
    }
  };

  return (
    <Modal title="API Usage Tracker" subtitle="Monitor your local token consumption" onClose={onClose} width={700}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-main)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>TODAY'S REQUESTS</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-main)' }}>{formatNumber(todayUsage.requests)}</div>
        </div>
        <div style={{ background: 'var(--bg-main)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>INPUT TOKENS</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-main)' }}>{formatNumber(todayUsage.inputTokens)}</div>
        </div>
        <div style={{ background: 'var(--bg-main)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>OUTPUT TOKENS</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-main)' }}>{formatNumber(todayUsage.outputTokens)}</div>
        </div>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Recent Activity</h3>
        <button onClick={clearHistory} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          Clear History
        </button>
      </div>

      <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: 'var(--bg-main)', position: 'sticky', top: 0 }}>
            <tr>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 600 }}>Time</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 600 }}>Provider</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 600 }}>Model</th>
              <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 600 }}>Input</th>
              <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 600 }}>Output</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No usage recorded yet.</td>
              </tr>
            ) : (
              history.map((record, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--text-main)' }}>{new Date(record.timestamp).toLocaleTimeString()}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-main)', textTransform: 'capitalize' }}>{record.provider}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{record.model}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-main)', textAlign: 'right' }}>{formatNumber(record.inputTokens)}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-main)', textAlign: 'right' }}>{formatNumber(record.outputTokens)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        <span>This data is stored locally in your browser. It helps you monitor your API usage to avoid hitting rate limits or unexpected billing charges.</span>
      </div>
    </Modal>
  );
}
