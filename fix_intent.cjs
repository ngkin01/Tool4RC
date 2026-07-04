const fs = require('fs');
let code = fs.readFileSync('src/pages/JobPostGenerator.tsx', 'utf8');

const oldIntentPrompt = `"You are an intent analyzer. Analyze the text and reply 'YES' if the user is asking to create a list of jobs, job roundup, tổng hợp job, danh sách việc làm, or similar. Otherwise, reply 'NO'."`;

const newIntentPrompt = `"You are an intent analyzer. Analyze if the user wants to create a roundup/list job USING PREVIOUS/OLD JOBS FROM HISTORY. Reply 'YES' ONLY IF they explicitly ask to combine old/past jobs, OR if they ask for a list job but provide NO actual job details in the input. If they already provided a list of jobs in the input, reply 'NO'. Reply ONLY YES or NO."`;

code = code.replace(oldIntentPrompt, newIntentPrompt);

fs.writeFileSync('src/pages/JobPostGenerator.tsx', code);
