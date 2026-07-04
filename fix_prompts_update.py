import re

with open('src/pages/JobPostGenerator.tsx', 'r') as f:
    code = f.read()

new_platforms = """const DEFAULT_PLATFORMS = [
  {
    id:"linkedin", name:"LinkedIn Post",
    icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>,
    color:"#0A66C2", bg:"#EBF3FB",
    prompt:`Audience:
Professionals, experienced candidates, industry connections and referrals.
Writing Style:
- Professional and recruiter-oriented.
- Credible and informative.
- Easy to scan.
- Use short paragraphs and bullet points.
- Focus on opportunity and candidate fit.
- Encourage professional networking and referrals.
- Avoid excessive emojis.
Hashtags:
- Generate 8-15 relevant hashtags.
Length:
- Adapt naturally to the complexity of the role.
- Prioritize quality over length.`
  },
  {
    id:"fb_group", name:"FB Group",
    icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>,
    color:"#1877F2", bg:"#EBF0FD",
    prompt:`Audience:
Active job seekers and community members.
Writing Style:
- Friendly and direct.
- Get to the point quickly.
- Highlight only the most important requirements.
- Use moderate emojis.
- Focus on location, experience and key qualifications.
- Encourage inbox, referrals and sharing.
Hashtags:
- Use 5-10 hashtags only.
Length:
- Keep the content concise and highly scannable.`
  },
  {
    id:"fb_personal", name:"FB Profile",
    icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>,
    color:"#1877F2", bg:"#EBF0FD",
    prompt:`Audience:
Personal connections and extended network.
Writing Style:
- Personal and conversational.
- Write like a recruiter sharing opportunities with friends.
- First person perspective is allowed.
Examples:
- Mình đang hỗ trợ tuyển...
- Hiện tại bên mình đang tìm kiếm...
- Chia sẻ thêm một cơ hội dành cho...
- Can occasionally ask for referrals and sharing.
- Keep the content approachable and authentic.
- Avoid sounding like a company advertisement.
Hashtags:
- Use only when appropriate.
- Prefer 3-8 hashtags.
Length:
- Short and natural.`
  },
];"""

# Replace DEFAULT_PLATFORMS
import re
pattern = r"const DEFAULT_PLATFORMS = \[[\s\S]*?\];"
code = re.sub(pattern, new_platforms, code, count=1)

# Add Reset button to Edit Prompt Modal
edit_modal_pattern = r"(<button onClick=\{handleSaveEdit\}[\s\S]*?>[\s\S]*?</button>)"

reset_button = """\\1
            {DEFAULT_PLATFORMS.find(p => p.id === editingPlat.id) && (
              <button onClick={() => {
                const defaultPrompt = DEFAULT_PLATFORMS.find(p => p.id === editingPlat.id)?.prompt || "";
                setEditPromptText(defaultPrompt);
              }}
                style={{padding:"10px 24px",borderRadius:10,border:"1.5px solid var(--border-glass)",cursor:"pointer",fontWeight:600,fontSize:14,background:"var(--bg-glass)",color:"var(--primary)"}}>
                Reset to Default
              </button>
            )}"""

code = re.sub(edit_modal_pattern, reset_button, code, count=1)

with open('src/pages/JobPostGenerator.tsx', 'w') as f:
    f.write(code)
