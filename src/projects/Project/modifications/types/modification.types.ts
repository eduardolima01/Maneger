export interface ModificationManifest {
  key: string;
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export function defaultManifest(key: string, name: string): ModificationManifest {
  const now = new Date().toISOString();
  return { key, name, enabled: true, createdAt: now, updatedAt: now };
}

export const DEFAULT_MODIFICATION_TEMPLATE = `export default function Modification({ modApi, React }) {
  return React.createElement('div', { style: { padding: 12 } },
    React.createElement('p', null, 'Nova modificação para o projeto ' + modApi.projectName + '. Edite o código pra começar.')
  );
}
`;
