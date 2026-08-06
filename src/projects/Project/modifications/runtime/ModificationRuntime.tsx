import { useEffect, useState } from 'react';
import * as React from 'react';
import { transform } from 'sucrase';
import { loadManifest, loadEntry } from '../api/modifications';
import { buildModApi } from './modApi';
import ModificationErrorBoundary from './ModificationErrorBoundary';
import { ModificationManifest } from '../types/modification.types';

interface ModificationRuntimeProps {
  projectId: string;
  projectName: string;
  modKey: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'disabled'; manifest: ModificationManifest }
  | { status: 'error'; message: string }
  | { status: 'ready'; manifest: ModificationManifest; Component: React.ComponentType<any> };

export default function ModificationRuntime({ projectId, projectName, modKey }: ModificationRuntimeProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ status: 'loading' });
      const manifest = await loadManifest(projectId, modKey);
      if (!manifest) {
        if (!cancelled) setState({ status: 'error', message: 'manifest.json não encontrado ou inválido.' });
        return;
      }
      if (!manifest.enabled) {
        if (!cancelled) setState({ status: 'disabled', manifest });
        return;
      }

      try {
        const source = await loadEntry(projectId, modKey);
        if (!source.trim()) {
          if (!cancelled) setState({ status: 'error', message: 'entry.tsx está vazio.' });
          return;
        }

        const { code } = transform(source, { transforms: ['typescript', 'jsx', 'imports'], production: true });

        // Escopo controlado: só React e exports são parâmetros nomeados — sem import/require livre.
        // Isolamento é PARCIAL (v1): `new Function` roda no escopo global do JS, então globais reais
        // do navegador (window, fetch, document) continuam alcançáveis por código malicioso deliberado.
        // window.__TAURI__ precisa estar desabilitado via tauri.conf.json (withGlobalTauri: false).
        const factory = new Function('React', 'exports', code.replace('export default', 'exports.default ='));
        const exportsObj: { default?: React.ComponentType<any> } = {};
        factory(React, exportsObj);

        if (typeof exportsObj.default !== 'function') {
          if (!cancelled) setState({ status: 'error', message: 'entry.tsx precisa de um "export default" que seja um componente.' });
          return;
        }

        if (!cancelled) setState({ status: 'ready', manifest, Component: exportsObj.default });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : 'Erro ao carregar modificação.' });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [projectId, modKey]);

  if (state.status === 'loading') return <p style={{ fontSize: 12, color: '#999' }}>Carregando...</p>;

  if (state.status === 'disabled') {
    return <p style={{ fontSize: 12, color: '#999' }}>"{state.manifest.name}" está desabilitada.</p>;
  }

  if (state.status === 'error') {
    return (
      <div style={{ padding: 12, border: '1px solid #f5c2c2', borderRadius: 6, backgroundColor: '#fff5f5' }}>
        <strong style={{ color: '#c62828', fontSize: 13 }}>⚠ Falha ao carregar "{modKey}"</strong>
        <p style={{ fontSize: 12, color: '#666', margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{state.message}</p>
      </div>
    );
  }

  const { Component, manifest } = state;
  const modApi = buildModApi(projectId, projectName, modKey);

  return (
    <ModificationErrorBoundary modName={manifest.name}>
      <Component modApi={modApi} React={React} />
    </ModificationErrorBoundary>
  );
}
