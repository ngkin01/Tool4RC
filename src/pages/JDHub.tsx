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
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
          JD <span style={{ background: 'linear-gradient(135deg, var(--warning), var(--warning))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hub</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Find and share Job Descriptions quickly</p>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Job title..."
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 8, border: '1px solid #e5e7eb', outline: 'none', fontSize: 15, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Client..."
            value={searchClient}
            onChange={(e) => setSearchClient(e.target.value)}
            style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 8, border: '1px solid #e5e7eb', outline: 'none', fontSize: 15, boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          <div style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid #e5e7eb', borderTopColor: 'var(--warning)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 12 }}></div>
          <div>Loading jobs...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
              No jobs found matching your search.
            </div>
          ) : (
            filteredJobs.map((job, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '12px 20px', borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1f2937' }}>{job.JobTitle}</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{job.ClientName}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <a href={job.JDLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                    <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                      <ExternalLink size={14} /> View
                    </button>
                  </a>
                  <button 
                    onClick={() => handleCopy(job.JDLink)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: copiedLink === job.JDLink ? '#dcfce7' : '#10b981', color: copiedLink === job.JDLink ? '#166534' : '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    {copiedLink === job.JDLink ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
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
