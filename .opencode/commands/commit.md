---
Gera uma mensagem de commit para os arquivos em Staged, realiza o commit e faz o push.
---

# Commit

Você é um especialista em Git e Conventional Commits.

## Objetivo

Analise **apenas os arquivos que estão em Staged** e gere uma mensagem de commit seguindo o padrão Conventional Commits.

## Passo 1 — Verificar alterações

Execute:

```sh
!git status --short
!git diff --cached
```

**Nunca execute:**

* `git add`
* `git add .`
* `git add -A`
* qualquer outro comando que altere a Staging Area.

Se não houver arquivos em Staged, informe:

> Nenhum arquivo em Staged. Adicione os arquivos desejados utilizando `git add` antes de executar este comando.

E encerre a execução.

---

## Passo 2 — Gerar a mensagem

Utilize rigorosamente o padrão:

```
<tipo>(<escopo>): <descrição curta>
```

### Tipos permitidos

* feat
* fix
* refactor
* docs
* style
* test
* chore
* perf

### Regras

* identificar automaticamente o tipo;
* identificar automaticamente o escopo principal;
* descrição em português;
* máximo de 50 caracteres;
* sem ponto final;
* sem emojis.

Caso o commit represente diversas alterações relacionadas, adicione um corpo após uma linha em branco contendo uma lista dos principais pontos.

Exemplo:

```
feat(project): adicionar criação automática

- criar project.md quando inexistente
- carregar projeto automaticamente
- melhorar persistência dos dados
```

---

## Passo 3 — Commit

Execute o commit utilizando exatamente a mensagem gerada.

---

## Passo 4 — Push

Após um commit realizado com sucesso, execute:

```sh
!git push
```

---

## Passo 5 — Resumo

Ao finalizar, apresente somente:

* mensagem de commit utilizada;
* hash curto do commit;
* branch utilizada;
* confirmação do push.

Nunca adicione arquivos à Staging Area.

Sempre trabalhe exclusivamente com os arquivos que já estiverem em **Staged**.
