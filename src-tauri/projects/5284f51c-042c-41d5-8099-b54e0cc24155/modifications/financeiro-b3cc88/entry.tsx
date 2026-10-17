export default function Modification({ modApi, React }) {
  return React.createElement('div', { style: { padding: 12 } },
    React.createElement('p', null, 'Nova modificação para o projeto ' + modApi.projectName + '. Edite o código pra começar.')
  );
}
