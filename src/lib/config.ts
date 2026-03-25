import path from 'path';

const DEFAULT_BASE = path.join(process.cwd(), 'data');
const PAFIS_BASE = process.env.PAFIS_BASE || DEFAULT_BASE;

export const DATA_PATHS = {
  deployments: path.join(PAFIS_BASE, 'kubernetes/deploy'),
  services:    path.join(PAFIS_BASE, 'kubernetes/svc'),
  ingress:     path.join(PAFIS_BASE, 'kubernetes/ing'),
  jobs:        path.join(PAFIS_BASE, 'kubernetes/job'),
  serviceMonitors: path.join(PAFIS_BASE, 'kubernetes/servicemonitors'),
  configMaps:  path.join(PAFIS_BASE, 'kubernetes/configmaps'),
  helmCharts:  path.join(PAFIS_BASE, 'helm-charts'),
  generators:  path.join(PAFIS_BASE, 'kubernetes/generators'),
  pvc:         path.join(PAFIS_BASE, 'kubernetes/pvc'),
};

export const PROMETHEUS_URL  = process.env.PROMETHEUS_URL  || 'http://localhost:9090';
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// AI Provider: "anthropic" (default) or "ollama"
// Ollama enables fully local/offline AI analysis with any compatible LLM
// (llama3, mistral, qwen, deepseek, etc.) — no API key or internet required.
// Install: https://ollama.com | then: ollama pull llama3
export const AI_PROVIDER = process.env.AI_PROVIDER || (ANTHROPIC_API_KEY ? 'anthropic' : 'ollama');

// Ollama settings (optional fallback)
export const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434';
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';
export const OLLAMA_USER  = process.env.OLLAMA_USER  || '';
export const OLLAMA_PASS  = process.env.OLLAMA_PASS  || '';