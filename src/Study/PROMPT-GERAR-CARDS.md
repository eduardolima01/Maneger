# Prompt: gerar flashcards a partir de um tutorial

Cole o texto abaixo numa IA (Claude, ChatGPT, etc.), substituindo o trecho
`<cole o tutorial aqui>` pelo tutorial real. O resultado que a IA gerar
pode ser colado direto no botão "Importar" do deck (ou salvo como `.txt` e
selecionado como arquivo lá).

---

Você vai transformar o tutorial abaixo em flashcards de estudo. Gere
**apenas** um arquivo de texto seguindo exatamente este formato, sem
nenhum texto fora dele (sem introdução, sem resumo, sem comentários):

```
%%CARD
%%FRENTE
<pergunta objetiva sobre um conceito do tutorial>
%%VERSO
<resposta direta e completa>

%%CARD
%%FRENTE
<próxima pergunta>
%%VERSO
<próxima resposta>
```

Regras:
- Cada card cobre **um** conceito só — não junte dois assuntos num card.
- FRENTE é sempre uma pergunta (nunca uma afirmação ou título).
- VERSO responde de forma completa mas curta (1 a 4 frases, ou uma lista
  curta se fizer mais sentido). Markdown é permitido (negrito, código,
  listas).
- Gere entre 10 e 25 cards, dependendo do tamanho e da densidade do
  tutorial — não force um número fixo.
- Não repita o mesmo conceito em cards diferentes.
- Não invente informação que não está no tutorial.
- Não escreva `id=` em nenhum card — isso é só usado ao reimportar cards
  já existentes pra edição.

Tutorial:
"""
<cole o tutorial aqui>
"""
