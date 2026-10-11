/**
 * Text-to-speech usando a Web Speech API nativa do navegador — sem lib nova.
 * Funciona no WebView do Tauri (Windows: WebView2/Edge; macOS: WKWebView), que
 * suportam `window.speechSynthesis`. Se o ambiente não suportar, os botões de
 * áudio simplesmente não aparecem (checar isTtsSupported antes de renderizar).
 *
 * Observação: a qualidade/idioma da voz depende das vozes instaladas no SO do
 * usuário — se não houver voz pt-BR instalada, o navegador cai pra alguma
 * voz padrão (ainda funciona, só que com sotaque/idioma diferente).
 */

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Remove marcação markdown básica antes de falar (senão a voz lê "asterisco asterisco" etc). */
export function stripMarkdownForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[*_~#>]+/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function speak(text: string, opts?: { lang?: string; onEnd?: () => void }): void {
  if (!isTtsSupported()) return;
  window.speechSynthesis.cancel(); // interrompe qualquer fala anterior antes de começar outra
  const utterance = new SpeechSynthesisUtterance(stripMarkdownForSpeech(text));
  utterance.lang = opts?.lang ?? 'pt-BR';
  utterance.onend = () => opts?.onEnd?.();
  utterance.onerror = () => opts?.onEnd?.();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (!isTtsSupported()) return;
  window.speechSynthesis.cancel();
}
