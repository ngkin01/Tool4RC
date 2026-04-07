const fs = require('fs');
const path = require('path');

const hexValues = {
  '#F8FAFC': 'var(--bg-main)',
  '#fff': 'var(--bg-card)',
  '#ffffff': 'var(--bg-card)',
  '#F1F5F9': 'var(--bg-hover)',
  '#0F172A': 'var(--text-primary)',
  '#1E293B': 'var(--text-secondary)',
  '#334155': 'var(--text-secondary)',
  '#374151': 'var(--text-secondary)',
  '#475569': 'var(--text-muted)',
  '#64748B': 'var(--text-muted)',
  '#94A3B8': 'var(--text-placeholder)',
  '#E2E8F0': 'var(--border-color)',
  '#CBD5E1': 'var(--border-color)',
  '#6366F1': 'var(--primary)',
  '#4F46E5': 'var(--primary-hover)',
  '#10B981': 'var(--success)',
  '#059669': 'var(--success-hover)',
  '#EF4444': 'var(--danger)',
  '#D97706': 'var(--warning)',
  '#06B6D4': 'var(--info)',
  '#EEF2FF': 'var(--bg-indigo-50)',
  '#F0FDF4': 'var(--bg-green-50)',
  '#FFFBEB': 'var(--bg-amber-50)',
  '#FEF2F2': 'var(--bg-red-50)',
  '#F0F9FF': 'var(--bg-sky-50)',
  '#FAFAFA': 'var(--bg-neutral-50)',
  '#ECFDF5': 'var(--bg-emerald-50)',
  '#C7D2FE': 'var(--border-indigo-200)',
  '#BBF7D0': 'var(--border-green-200)',
  '#FDE68A': 'var(--border-amber-200)',
  '#FECACA': 'var(--border-red-200)',
  '#BAE6FD': 'var(--border-sky-200)',
  '#A7F3D0': 'var(--border-emerald-200)',
  '#3B82F6': 'var(--border-focus)',
  '#D1D5DB': 'var(--border-color)',
  '#6B7280': 'var(--text-muted)',
  '#9CA3AF': 'var(--text-placeholder)',
  '#F9FAFB': 'var(--bg-main)',
  '#F3F4F6': 'var(--bg-hover)',
  '#0891B2': 'var(--info)',
  '#DC2626': 'var(--danger)',
  '#7F1D1D': 'var(--danger)',
  '#92400E': 'var(--warning)',
  '#FEF3C7': 'var(--bg-amber-50)',
  '#FEE2E2': 'var(--bg-red-50)',
  '#14532D': 'var(--success)',
  '#065F46': 'var(--success)',
  '#0369A1': 'var(--info)',
  '#818CF8': 'var(--primary)',
  '#C4B5FD': 'var(--border-indigo-200)',
  '#F5F3FF': 'var(--bg-indigo-50)',
  '#FEF9C3': 'var(--bg-amber-50)',
  '#EFF6FF': 'var(--bg-sky-50)',
  '#BFDBFE': 'var(--border-sky-200)',
  '#DBEAFE': 'var(--bg-sky-50)',
  '#FFF7ED': 'var(--bg-amber-50)',
  '#FFF1F2': 'var(--bg-red-50)',
  '#FECDD3': 'var(--border-red-200)',
  '#FFE4E6': 'var(--bg-red-50)',
  '#DDD6FE': 'var(--border-indigo-200)',
  '#EDE9FE': 'var(--bg-indigo-50)',
  '#6EE7B7': 'var(--border-emerald-200)',
  '#D1FAE5': 'var(--bg-emerald-50)',
  '#FDF4FF': 'var(--bg-indigo-50)',
  '#E9D5FF': 'var(--border-indigo-200)',
  '#F3E8FF': 'var(--bg-indigo-50)',
  '#E0F2FE': 'var(--bg-sky-50)',
  '#F59E0B': 'var(--warning)',
  '#8B5CF6': 'var(--primary)',
  '#6D28D9': 'var(--primary-hover)',
  '#C2410C': 'var(--warning)',
  '#7C3AED': 'var(--primary)',
  '#F0FDFA': 'var(--bg-emerald-50)',
  '#DCFCE7': 'var(--bg-green-50)',
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  for (const [hex, cssVar] of Object.entries(hexValues)) {
    const regex = new RegExp(hex + '(?![a-zA-Z0-9])', 'gi');
    content = content.replace(regex, cssVar);
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walk('./src');
