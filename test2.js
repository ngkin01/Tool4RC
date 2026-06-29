import fetch from 'node-fetch';

async function test() {
  const res = await fetch('https://text.pollinations.ai/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'Trả về JSON với format { "name": "string", "skills": [] }. Không giải thích.' },
        { role: 'user', content: 'Tìm thông tin về React Developer' }
      ],
      model: 'openai',
      response_format: { type: "json_object" }
    })
  });
  const text = await res.text();
  console.log(text);
}

test();
