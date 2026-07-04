const fs = require('fs');
let code = fs.readFileSync('src/pages/JobPostGenerator.tsx', 'utf8');

// We need to revert the Promise.all logic and instead add a handleGenerateImagePrompt function
const regex = /const \[postResult, imagePromptResult\] = await Promise\.all\(\[[\s\S]*?gemini\([\s\S]*?1200\s*\),[\s\S]*?gemini\([\s\S]*?800\s*\)\s*\]\);\s*const newVersion = \{ text: postResult\.trim\(\), imagePrompt: imagePromptResult\.trim\(\), platform: plat\.name, platId, timestamp: Date\.now\(\) \};/m;

const replacement = `
      const result = await gemini(
          \`\${contentPrompt}\`,
          \`Platform: \${plat.name}\\n\${plat.prompt}\\n\\nInput Information:\\n\${jd}\\n\${instruction.trim() ? \`\\nAdditional instruction: \${instruction.trim()}\` : ""}\\n\\nOutput ONLY the post content.\`,
          1200
        );
      const newVersion = { text: result.trim(), platform: plat.name, platId, timestamp: Date.now() };`;

code = code.replace(regex, replacement);

fs.writeFileSync('src/pages/JobPostGenerator.tsx', code);
