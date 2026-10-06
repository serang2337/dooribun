// 브라우저가 보낸 Gemini 요청을 받아, 서버가 가진 키를 붙여 전달한다.
export async function onRequestPost({ request, env }) {
  if (!env.GEMINI_API_KEY) return json({ error: 'server_not_configured' }, 500);

  const raw = await request.text();
  if (raw.length > 6_000_000) return json({ error: 'too_large' }, 413);

  const model = env.GEMINI_MODEL || 'gemini-3.8-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw,
  });
  // 구글의 응답과 상태 번호(200, 503 등)를 그대로 돌려준다.
  return new Response(await r.text(), {
    status: r.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}