import re

with open('src/pages/JobPostGenerator.tsx', 'r') as f:
    code = f.read()

# Replace the Promise.all
pattern = r"const \[postResult, imagePromptResult\] = await Promise\.all\(\[\s*gemini\([\s\S]*?1200\s*\),\s*gemini\([\s\S]*?800\s*\)\s*\]\);\s*const newVersion = \{ text: postResult\.trim\(\), imagePrompt: imagePromptResult\.trim\(\), platform: plat\.name, platId, timestamp: Date\.now\(\) \};"

replacement = """      const result = await gemini(
          `${contentPrompt}`,
          `Platform: ${plat.name}\\n${plat.prompt}\\n\\nInput Information:\\n${jd}\\n${instruction.trim() ? `\\nAdditional instruction: ${instruction.trim()}` : ""}\\n\\nOutput ONLY the post content.`,
          1200
        );
      const newVersion = { text: result.trim(), platform: plat.name, platId, timestamp: Date.now() };"""

code = re.sub(pattern, replacement, code)

with open('src/pages/JobPostGenerator.tsx', 'w') as f:
    f.write(code)

