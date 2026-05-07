import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getEvaluation, getPaper } from '@/lib/repo';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default async function ReviewPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const evaluation = await getEvaluation(user.uid, params.id);
  if (!evaluation) notFound();
  const paper = await getPaper(user.uid, evaluation.paperId);
  if (!paper) notFound();

  const tone = (score: number) =>
    score >= 4 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : score >= 3 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-700 border-red-200';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{paper.title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Mode: <strong>{evaluation.mode}</strong> · Target:{' '}
            <strong>
              {paper.targetTier}
              {paper.journalName ? ` — ${paper.journalName}` : ''}
            </strong>{' '}
            · Field: <strong>{paper.field}</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="btn-secondary">
            New review
          </Link>
          <a
            href={`/api/export?id=${evaluation.id}`}
            className="btn-primary"
          >
            Export DOCX
          </a>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">
              Overall score
            </div>
            <div className="text-4xl font-bold text-slate-900">
              {evaluation.overallScore.toFixed(2)}
              <span className="text-base font-normal text-slate-400"> / 5</span>
            </div>
          </div>
          {evaluation.acceptanceProbability && (
            <div className="text-right">
              <div className="text-xs text-slate-500 uppercase tracking-wide">
                Acceptance probability
              </div>
              <div className="text-3xl font-bold text-slate-900">
                {evaluation.acceptanceProbability.estimate}%
              </div>
              <div className="text-xs text-slate-500">
                95% CI: {evaluation.acceptanceProbability.ci95[0]}–
                {evaluation.acceptanceProbability.ci95[1]}%
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Top issues</h2>
        <ol className="list-decimal pl-5 space-y-1 text-sm">
          {evaluation.topIssues.map((i, idx) => (
            <li key={idx}>{i}</li>
          ))}
        </ol>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">Rubric (7 criteria)</h2>
        <div className="space-y-3">
          {evaluation.criteria.map((c) => (
            <div key={c.criterionId} className="border border-slate-200 rounded-md p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-900">
                    {c.criterionName}
                    <span className="text-xs text-slate-500 ml-2">
                      weight {c.weight}%
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{c.comment}</p>
                </div>
                <span
                  className={`badge border ${tone(c.score)} text-base px-3 py-1`}
                >
                  {c.score}/5
                </span>
              </div>
              {c.suggestions.length > 0 && (
                <ul className="list-disc pl-5 mt-2 text-sm text-slate-700 space-y-1">
                  {c.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      {evaluation.sectionRevisions && evaluation.sectionRevisions.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold">Section-level revisions</h2>
          <ul className="space-y-2 text-sm">
            {evaluation.sectionRevisions.map((r, idx) => (
              <li key={idx}>
                <span className="badge bg-slate-100 text-slate-700 mr-2">
                  {r.sectionKey}
                </span>
                <strong>{r.issue}</strong> — {r.suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.acceptanceProbability && (
        <div className="card space-y-2">
          <h2 className="text-lg font-semibold">Acceptance probability — rationale</h2>
          <p className="text-sm text-slate-700">
            {evaluation.acceptanceProbability.rationale}
          </p>
          <p className="text-xs italic text-slate-500">
            {evaluation.acceptanceProbability.disclaimer}
          </p>
        </div>
      )}

      {evaluation.coverLetter && (
        <div className="card space-y-2">
          <h2 className="text-lg font-semibold">Draft cover letter</h2>
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800">
            {evaluation.coverLetter}
          </pre>
        </div>
      )}

      {evaluation.relatedPapers && evaluation.relatedPapers.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold">Related papers ({evaluation.relatedPapers.length})</h2>
          <div className="space-y-3">
            {evaluation.relatedPapers.map((p, idx) => (
              <div key={idx} className="border border-slate-200 rounded-md p-3">
                <div className="font-medium">
                  {p.title} <span className="text-slate-400">({p.year})</span>
                </div>
                <div className="text-sm text-slate-600">
                  {p.authors} — {p.venue}
                  {p.doi && (
                    <>
                      {' '}— DOI:{' '}
                      <a
                        className="text-brand-600"
                        href={`https://doi.org/${p.doi}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {p.doi}
                      </a>
                    </>
                  )}
                </div>
                <p className="text-sm text-slate-700 mt-1">
                  <em>{p.reasonToCite}</em>
                </p>
                <pre className="text-xs bg-slate-50 border border-slate-200 rounded p-2 mt-2 overflow-x-auto">
                  {p.bibtex}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-slate-400">
        Model: {evaluation.model} · Latency: {(evaluation.latencyMs / 1000).toFixed(1)}s
      </div>
    </div>
  );
}
