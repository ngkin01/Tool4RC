import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Search, ExternalLink, Copy, Check } from 'lucide-react';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSeACrfDvTPFqKsUH-xk-Qi9gVbh8JgVtiMTWN-Iijat-7_McDuDZv0ymvestk6CwJPj_535GuAXvFh/pub?output=csv";

interface Job {
  JobTitle: string;
  ClientName: string;
  JDLink: string;
}

export function JDHub({ toast }: any) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTitle, setSearchTitle] = useState('');
  const [searchClient, setSearchClient] = useState('');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = () => {
    setLoading(true);
    Papa.parse(SHEET_URL + "&t=" + Date.now(), {
      download: true,
      header: true,
      complete: function(results) {
        const parsedJobs = (results.data as Job[])
          .filter(job => job.JobTitle)
          .reverse(); // Reverse to show newest first
        setJobs(parsedJobs);
        setLoading(false);
      },
      error: function(error) {
        console.error("Error fetching jobs:", error);
        toast("Failed to load jobs");
        setLoading(false);
      }
    });
  };

  const handleCopy = (link: string) => {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(link);
      setTimeout(() => setCopiedLink(null), 1500);
    });
  };

  const filteredJobs = jobs.filter(job =>
    (job.JobTitle || '').toLowerCase().includes(searchTitle.toLowerCase()) &&
    (job.ClientName || '').toLowerCase().includes(searchClient.toLowerCase())
  );

  return (
    <div style={{ padding: '32px', maxWidth: 1000, margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 600 }}>Find and share Job Descriptions quickly</p>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          <Search size={18} color="var(--text-placeholder)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Job title..."
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 12, border: '1.5px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'var(--text-primary)', outline: 'none', fontSize: 15, boxSizing: 'border-box', backdropFilter: 'blur(16px)', boxShadow: 'var(--shadow-glass)' }}
          />
        </div>
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          <Search size={18} color="var(--text-placeholder)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Client..."
            value={searchClient}
            onChange={(e) => setSearchClient(e.target.value)}
            style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 12, border: '1.5px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'var(--text-primary)', outline: 'none', fontSize: 15, boxSizing: 'border-box', backdropFilter: 'blur(16px)', boxShadow: 'var(--shadow-glass)' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid var(--border-color)', borderTopColor: 'var(--warning)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 12 }}></div>
          <div>Loading jobs...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', borderRadius: 12, border: '1.5px solid var(--border-glass)', boxShadow: 'var(--shadow-glass)' }}>
              No jobs found matching your search.
            </div>
          ) : (
            filteredJobs.map((job, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', padding: '14px 18px', borderRadius: 12, border: '1.5px solid var(--border-glass)', boxShadow: 'var(--shadow-glass)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{job.JobTitle}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{job.ClientName}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <a href={job.JDLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                    <button style={{ padding: '5px 8px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 5, fontSize: 11, cursor: 'pointer', transition: 'all 0.2s ease' }}>
                      View
                    </button>
                  </a>
                  <button 
                    onClick={() => handleCopy(job.JDLink)}
                    style={{ padding: '5px 8px', background: copiedLink === job.JDLink ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: 5, fontSize: 11, cursor: 'pointer', transition: 'all 0.2s ease', transform: copiedLink === job.JDLink ? 'scale(0.95)' : 'none' }}
                  >
                    {copiedLink === job.JDLink ? 'Copied ✓' : 'Copy'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
