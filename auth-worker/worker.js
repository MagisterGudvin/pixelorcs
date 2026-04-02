/**
 * 4RKS — OAuth-прокси для Sveltia/Decap CMS
 *
 * Cloudflare Worker, который решает проблему CORS при авторизации
 * через GitHub OAuth на GitHub Pages.
 *
 * Деплой:
 *   1. Зайдите на https://dash.cloudflare.com → Workers & Pages → Create
 *   2. Нажмите «Create Worker», вставьте этот код
 *   3. Добавьте Environment Variables:
 *      - GITHUB_CLIENT_ID     = Client ID вашего GitHub OAuth App
 *      - GITHUB_CLIENT_SECRET = Client Secret вашего GitHub OAuth App
 *   4. Нажмите «Deploy»
 *   5. Скопируйте URL воркера (напр. https://pixelorcs-auth.username.workers.dev)
 *   6. Вставьте его в admin/config.yml → backend.base_url
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Step 1: перенаправление на GitHub OAuth
    if (url.pathname === '/auth') {
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: url.origin + '/callback',
        scope: 'repo,user',
        state: crypto.randomUUID(),
      });
      return Response.redirect(
        'https://github.com/login/oauth/authorize?' + params.toString(),
        302
      );
    }

    // Step 2: callback — обмен кода на токен
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        return new Response('Missing code parameter', { status: 400, headers: corsHeaders });
      }

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: code,
        }),
      });

      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        return new Response(
          renderMessage('error', tokenData.error_description || tokenData.error),
          { headers: { 'Content-Type': 'text/html', ...corsHeaders } }
        );
      }

      // Отправляем токен обратно в CMS через postMessage
      return new Response(
        renderMessage('success', JSON.stringify({
          token: tokenData.access_token,
          provider: 'github',
        })),
        { headers: { 'Content-Type': 'text/html', ...corsHeaders } }
      );
    }

    // API-маршрут для программного обмена кода (Sveltia CMS)
    if (url.pathname === '/api/auth' && request.method === 'POST') {
      try {
        const body = await request.json();
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code: body.code,
          }),
        });
        const tokenData = await tokenRes.json();
        return new Response(JSON.stringify(tokenData), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    return new Response('4RKS OAuth Proxy is running.', {
      headers: { 'Content-Type': 'text/plain', ...corsHeaders },
    });
  },
};

function renderMessage(status, content) {
  return `<!DOCTYPE html>
<html>
<body>
<script>
(function() {
  window.opener && window.opener.postMessage(
    'authorization:github:${status}:${content.replace(/'/g, "\\'")}',
    window.opener.location.origin
  );
  window.close();
})();
</script>
</body>
</html>`;
}
