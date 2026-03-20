import { OLLAMA_URL, OLLAMA_MODEL, OLLAMA_USER, OLLAMA_PASS } from '../config';

export function streamOllama(prompt: string, maxTokens = 800): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (OLLAMA_USER && OLLAMA_PASS) {
          headers['Authorization'] =
            'Basic ' + Buffer.from(`${OLLAMA_USER}:${OLLAMA_PASS}`).toString('base64');
        }

        const res = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: OLLAMA_MODEL,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
            keep_alive: -1,
            think: false,
            options: {
              num_predict: maxTokens,
              temperature: 0.3,
            },
          }),
          signal: AbortSignal.timeout(300000),
        });

        if (!res.ok) {
          const errText = await res.text();
          controller.enqueue(encoder.encode(`**Error from Ollama:** ${res.status} ${errText}`));
          controller.close();
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          controller.enqueue(encoder.encode('**Error:** No response stream'));
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Ollama streams newline-delimited JSON
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              // Support both /api/chat and /api/generate formats
              const text = parsed.message?.content || parsed.response || '';
              if (text) {
                controller.enqueue(encoder.encode(text));
              }
              if (parsed.done) {
                controller.close();
                return;
              }
            } catch {
              // Skip malformed lines
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer);
            const text = parsed.message?.content || parsed.response || '';
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          } catch {
            // ignore
          }
        }

        controller.close();
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(encoder.encode(`\n\n**Error:** ${errMsg}`));
        controller.close();
      }
    },
  });
}
