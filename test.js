import fetch from 'node-fetch';

async function test() {
  const res = await fetch('https://text.pollinations.ai/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{role: 'user', content: 'Hello'}],
      model: 'openai'
    })
  });
  const text = await res.text();
  console.log(text);
}

test();
