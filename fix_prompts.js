const fs = require('fs');
const content = fs.readFileSync('src/pages/FreeCAI.tsx', 'utf8');

const companyPromptStart = content.indexOf('const DEFAULT_COMPANY_RESEARCH_PROMPT = `');
if (companyPromptStart === -1) {
  console.log("Could not find DEFAULT_COMPANY_RESEARCH_PROMPT");
  process.exit(1);
}

const recruitmentPromptStart = content.indexOf('const DEFAULT_RECRUITMENT_INTELLIGENCE_PROMPT = `');
if (recruitmentPromptStart === -1) {
  console.log("Could not find DEFAULT_RECRUITMENT_INTELLIGENCE_PROMPT");
  process.exit(1);
}

// Just checking how long they are
console.log('companyPromptStart:', companyPromptStart);
console.log('recruitmentPromptStart:', recruitmentPromptStart);

