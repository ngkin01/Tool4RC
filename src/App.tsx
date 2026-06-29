/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { NavSidebar } from './components/NavSidebar';
import { Landing } from './pages/Landing';
import { CandidateTools } from './pages/CandidateTools';
import { InterviewPlanner } from './pages/InterviewPlanner';
import { InterviewMail } from './pages/InterviewMail';
import { JobPostGenerator } from './pages/JobPostGenerator';
import { JDHub } from './pages/JDHub';
import { FreeCAI } from './pages/FreeCAI';
import { useToast, Toast } from './components/ui';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { ts, show, rm } = useToast();

  useEffect(() => {
    const isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <Router>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-gradient)' }}>
        <NavSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Header onMenu={() => setSidebarOpen(true)} />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/candidate" element={<CandidateTools toast={show} />} />
              <Route path="/planner" element={<InterviewPlanner toast={show} />} />
              <Route path="/mail" element={<InterviewMail toast={show} />} />
              <Route path="/jobpost" element={<JobPostGenerator toast={show} />} />
              <Route path="/jdhub" element={<JDHub toast={show} />} />
              <Route path="/freec-ai" element={<FreeCAI toast={show} />} />
            </Routes>
          </div>
        </div>
      </div>
      {ts.map((t: any) => (
        <Toast key={t.id} msg={t.msg} type={t.type} onClose={() => rm(t.id)} />
      ))}
    </Router>
  );
}
