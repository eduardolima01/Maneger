import { useParams, useNavigate } from '@tanstack/react-router';
import Button from '@/components/layout/Button';
import { useTabMeta } from '@/components/layout/tabs/useTabMeta';
import { useStudySession } from './hooks/useStudySession';
import MarkdownView from './components/MarkdownView';
import { RATING_LABELS, RATING_COLORS } from './utils/studyRating';
import type { StudyRating } from './types/study.types';

export default function StudySessionPage() {
  const { deckId } = useParams({ from: '/study/$deckId/session' });
  const navigate = useNavigate();

  const {
    deck, loading, error, currentCard, index, total,
    revealed, reveal, rate, finished, counts, restart,
  } = useStudySession(deckId);

  useTabMeta({
    title: loading ? 'Carregando...' : deck ? `Estudando: ${deck.name}` : 'Estudo',
    icon: '🧠',
    status: loading ? 'loading' : deck ? 'ready' : 'not-found',
    breadcrumb: deck ? ['Estudos', deck.name, 'Estudo'] : undefined,
  });

  const backToDeck = () => navigate({ to: '/study/$deckId', params: { deckId } });

  if (loading) return <p style={{ padding: 24, color: '#999' }}>Carregando sessão de estudo...</p>;
  if (error) return <p style={{ padding: 24, color: '#d93025' }}>{error}</p>;
  if (!deck) return <p style={{ padding: 24 }}>Deck não encontrado.</p>;

  if (total === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: '#999', marginBottom: 12 }}>Este deck não tem cards pra estudar ainda.</p>
        <Button onClick={backToDeck}>Voltar ao deck</Button>
      </div>
    );
  }

  if (finished) {
    const totalReviewed = counts.again + counts.hard + counts.easy;
    return (
      <div style={{ padding: 24, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ marginBottom: 4 }}>🎉 Sessão concluída!</h2>
        <p style={{ color: '#666', marginBottom: 24 }}>
          {deck.name} — {totalReviewed} {totalReviewed === 1 ? 'card revisado' : 'cards revisados'}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 32 }}>
          <SummaryStat label={RATING_LABELS.again} value={counts.again} color={RATING_COLORS.again} />
          <SummaryStat label={RATING_LABELS.hard} value={counts.hard} color={RATING_COLORS.hard} />
          <SummaryStat label={RATING_LABELS.easy} value={counts.easy} color={RATING_COLORS.easy} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <Button variant="secondary" onClick={restart}>Estudar de novo</Button>
          <Button onClick={backToDeck}>Voltar ao deck</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#999', marginBottom: 4 }}>
          <span>{deck.name}</span>
          <span>{index + 1} / {total}</span>
        </div>
        <div style={{ height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{ height: '100%', width: `${(index / total) * 100}%`, background: '#1a73e8', transition: 'width 0.2s' }}
          />
        </div>
      </div>

      <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 24, minHeight: 200 }}>
        <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 8 }}>Pergunta</p>
        {currentCard && <MarkdownView value={currentCard.front} />}

        {revealed && currentCard && (
          <>
            <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #eee' }} />
            <p style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', marginBottom: 8 }}>Resposta</p>
            <MarkdownView value={currentCard.back} />
          </>
        )}
      </div>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 8 }}>
        {!revealed ? (
          <Button onClick={reveal}>Mostrar resposta</Button>
        ) : (
          (['again', 'hard', 'easy'] as StudyRating[]).map((rating) => (
            <button
              key={rating}
              onClick={() => rate(rating)}
              style={{
                padding: '10px 20px',
                borderRadius: 6,
                border: `1px solid ${RATING_COLORS[rating]}`,
                color: RATING_COLORS[rating],
                background: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {RATING_LABELS[rating]}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 600, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
    </div>
  );
}
