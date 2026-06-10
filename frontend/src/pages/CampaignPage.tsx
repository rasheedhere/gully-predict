import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Lock, Hash, Type, ToggleLeft, ChevronDown, ListChecks, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCampaign, useSubmitCampaignResponse, useCampaignResponses, type CampaignQuestion, type ScoringRules } from '../api/hooks/useCampaigns';
import { useAuthStore } from '../store/auth';
import { useUiStore } from '../store/ui';
import { CampaignCountdown } from '../components/CampaignCountdown';
import { getUserDisplayName } from '../utils/userUtils';

// ── Scoring hint ──────────────────────────────────────────────────────────────

function ScoringHint({ rules, type }: { rules: ScoringRules; type: CampaignQuestion['question_type'] }) {
  const parts: string[] = [];
  const formatPts = (pts: number) => pts > 0 ? `+${pts}` : `${pts}`;

  if (type === 'multiple_choice' && rules.multiple_choice_tiers) {
    const tiers = Object.entries(rules.multiple_choice_tiers)
      .filter(([_, pts]) => pts !== 0)
      .sort((a, b) => parseInt(b[0]) - parseInt(a[0]));

    if (tiers.length > 0) {
      parts.push(tiers.map(([count, pts]) => `${formatPts(pts)} (${count} correct)`).join(' · '));
    }
  } else {
    if (rules.exact_match_points !== 0) parts.push(`${formatPts(rules.exact_match_points)} exact`);
    if (type === 'free_number' && rules.within_range_points !== 0)
      parts.push(`${formatPts(rules.within_range_points)} within ±5`);
  }

  if (rules.wrong_answer_points !== 0) {
    parts.push(`${formatPts(rules.wrong_answer_points)} ${type === 'multiple_choice' ? 'base' : 'wrong'}`);
  }

  if (parts.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-display uppercase tracking-widest mt-2 bg-white/5 py-1 px-2.5 rounded-lg border border-white/5 w-fit">
      <Info className="w-3.5 h-3.5 text-ipl-gold" />
      {parts.join(' | ')}
    </div>
  );
}

// ── Question inputs ───────────────────────────────────────────────────────────

function ToggleInput({ q, value, onChange, disabled }: { q: CampaignQuestion; value: any; onChange: (v: any) => void; disabled: boolean }) {
  const opts = q.options ?? ['Option A', 'Option B'];
  return (
    <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 w-full mt-3 select-none">
      {opts.map(opt => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt)}
          className={`flex-1 min-h-[44px] py-3 px-2 rounded-xl font-display text-xs uppercase tracking-wider transition-all duration-200 select-none truncate
            ${value === opt
              ? 'bg-ipl-gold text-black shadow-lg font-bold'
              : 'text-gray-500 active:text-gray-300 disabled:opacity-50'
            }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function MultipleChoiceInput({ q, value, onChange, disabled }: { q: CampaignQuestion; value: any; onChange: (v: any) => void; disabled: boolean }) {
  const selected: string[] = Array.isArray(value) ? value : [];
  const maxSel = q.scoring_rules?.max_selections;

  const toggle = (opt: string) => {
    const isSelected = selected.includes(opt);
    if (!isSelected && maxSel && selected.length >= maxSel) {
      toast.error(`You can only select exactly ${maxSel} options`);
      return;
    }
    const next = isSelected ? selected.filter(s => s !== opt) : [...selected, opt];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2 mt-3 select-none">
      {(q.options ?? []).map(opt => {
        const isSelected = selected.includes(opt);
        const isMaxedOut = !isSelected && maxSel && selected.length >= maxSel;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled || !!isMaxedOut}
            onClick={() => toggle(opt)}
            className={`text-left px-4 py-3.5 border rounded-[18px] font-display text-xs transition-all duration-150 active:scale-[0.98]
              ${isSelected
                ? 'border-ipl-gold bg-ipl-gold/10 text-ipl-gold shadow-[0_4px_12px_rgba(244,196,48,0.15)] font-bold'
                : 'border-white/10 text-gray-400 bg-white/5 active:bg-white/10'
              }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function DropdownInput({ q, value, onChange, disabled }: { q: CampaignQuestion; value: any; onChange: (v: any) => void; disabled: boolean }) {
  return (
    <div className="relative mt-3">
      <select
        disabled={disabled}
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className="w-full bg-white/5 border border-white/10 rounded-[18px] p-4 text-white font-display text-sm appearance-none focus:outline-none focus:border-ipl-gold focus:bg-white/10 transition-all disabled:opacity-50"
      >
        <option value="" className="bg-ipl-navy">Select an option…</option>
        {(q.options ?? []).map(opt => (
          <option key={opt} value={opt} className="bg-ipl-navy">{opt}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
    </div>
  );
}

function FreeTextInput({ value, onChange, disabled }: { value: any; onChange: (v: any) => void; disabled: boolean }) {
  const [err, setErr] = useState('');
  const handle = (v: string) => {
    if (v && !/^[a-zA-Z ]*$/.test(v)) {
      setErr('Only letters and spaces allowed');
      return;
    }
    setErr('');
    onChange(v);
  };
  return (
    <div className="mt-3">
      <input
        type="text"
        disabled={disabled}
        value={value ?? ''}
        onChange={e => handle(e.target.value)}
        placeholder="Type your answer…"
        className="w-full bg-white/5 border border-white/10 rounded-[18px] p-4 text-white font-display text-sm placeholder:text-gray-600 focus:outline-none focus:border-ipl-gold focus:bg-white/10 transition-all disabled:opacity-50"
      />
      {err && <p className="text-ipl-live text-xs mt-1 font-display">{err}</p>}
    </div>
  );
}

function FreeNumberInput({ value, onChange, disabled }: { value: any; onChange: (v: any) => void; disabled: boolean }) {
  return (
    <div className="mt-3">
      <input
        type="number"
        disabled={disabled}
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
        placeholder="Enter a number…"
        className="w-full bg-white/5 border border-white/10 rounded-[18px] p-4 text-white font-display text-sm placeholder:text-gray-600 focus:outline-none focus:border-ipl-gold focus:bg-white/10 transition-all disabled:opacity-50"
      />
    </div>
  );
}

const QUESTION_ICONS: Record<CampaignQuestion['question_type'], React.ReactNode> = {
  toggle: <ToggleLeft className="w-4 h-4" />,
  multiple_choice: <ListChecks className="w-4 h-4" />,
  dropdown: <ChevronDown className="w-4 h-4" />,
  free_text: <Type className="w-4 h-4" />,
  free_number: <Hash className="w-4 h-4" />,
};

// ── Result view (after scoring) ───────────────────────────────────────────────

function ResultBadge({ points, correct }: { points: number | null | undefined; correct: any }) {
  if (points == null) return null;
  const color = points > 0 ? 'text-green-400' : points < 0 ? 'text-ipl-live' : 'text-gray-500';
  const prefix = points > 0 ? '+' : '';
  return (
    <div className={`text-xs font-display font-bold ${color}`}>
      {prefix}{points} PTS
      {correct != null && (
        <span className="text-gray-500 font-normal text-[10px] ml-2">
          (Correct: {Array.isArray(correct) ? correct.join(', ') : String(correct)})
        </span>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: campaign, isLoading, error } = useCampaign(id!);
  const { mutate: submit, isPending: isSubmitting } = useSubmitCampaignResponse(id!);

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const { setHeaderTitle } = useUiStore();

  useEffect(() => {
    if (campaign) {
      setHeaderTitle(campaign.title);
    }
    return () => setHeaderTitle(null);
  }, [campaign, setHeaderTitle]);
  
  const isClosed = campaign?.status === 'closed' || (campaign?.ends_at ? new Date(campaign.ends_at) <= new Date() : false);
  const { data: responsesData, isLoading: isLoadingResponses } = useCampaignResponses(id!, isClosed);
  const [activeTab, setActiveTab] = useState<'response' | 'predictions'>('response');
  const [viewMode, setViewMode] = useState<'player' | 'question'>('player');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    if (campaign?.my_response) {
      const initial: Record<string, any> = {};
      Object.entries(campaign.my_response.answers).forEach(([qId, ans]) => {
        initial[qId] = ans.answer_value;
      });
      setAnswers(initial);
    }
  }, [campaign]);

  if (isLoading) {
    return (
      <div className="text-white text-center font-display tracking-widest animate-pulse mt-20">
        LOADING CAMPAIGN...
      </div>
    );
  }
  if (error || !campaign) {
    return (
      <div className="text-ipl-live text-center font-display tracking-widest mt-20">
        CAMPAIGN NOT FOUND
      </div>
    );
  }

  const isSubmitted = !!campaign.my_response;
  const isActive = campaign.status === 'active';
  const disabled = isClosed || !isActive || !!user?.is_guest;

  const getAnswer = (qId: string) => answers[qId];

  const setAnswer = (qId: string, val: any) => {
    if (disabled) return;
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = campaign.questions.map(q => ({
      question_id: q.id,
      answer_value: answers[q.id] ?? null,
    }));

    // Check if anything is entirely unanswered
    const missing = payload.filter(a => a.answer_value === null || a.answer_value === '' || (Array.isArray(a.answer_value) && a.answer_value.length === 0));
    if (missing.length > 0) {
      toast.error(`Please answer all ${missing.length} remaining question(s)`);
      return;
    }

    // Check multiple choice constraints
    for (const q of campaign.questions) {
      if (q.question_type === 'multiple_choice' && q.scoring_rules.max_selections) {
        const userAns = answers[q.id] || [];
        if (userAns.length !== q.scoring_rules.max_selections) {
          toast.error(`"${q.question_text}" requires exactly ${q.scoring_rules.max_selections} selections.`);
          return;
        }
      }
    }

    submit(payload, {
      onSuccess: () => toast.success('Response submitted!'),
      onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Submission failed'),
    });
  };

  return (
    <div className="max-w-xl mx-auto pb-20 space-y-6 select-none">
      {/* Header */}
      <header className="space-y-4">
        <button
          onClick={() => navigate('/campaigns')}
          className="hidden md:flex items-center gap-2 text-gray-500 hover:text-white font-display text-xs uppercase tracking-widest transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Campaigns
        </button>

        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <span className="hidden md:block text-[9px] font-display uppercase tracking-widest text-gray-500 mb-1">
              {campaign.type} campaign
            </span>
            <h1 className="hidden md:block text-xl md:text-2xl font-display text-white uppercase font-bold leading-tight">{campaign.title}</h1>
            {campaign.description && (
              <p className="text-gray-400 text-xs mt-1 leading-relaxed">{campaign.description}</p>
            )}
          </div>
          {isClosed ? (
            <span className="flex items-center gap-1 text-[9px] font-display uppercase tracking-widest text-gray-500 pt-1 shrink-0">
              <Lock className="w-3.5 h-3.5" />
              Closed
            </span>
          ) : isActive ? (
            <span className="flex items-center gap-1.5 text-[9px] font-display uppercase tracking-widest text-ipl-live pt-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-ipl-live animate-pulse" />
              Active
            </span>
          ) : null}
        </div>

        {isClosed && (
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 mt-6 select-none">
            <button
              type="button"
              onClick={() => setActiveTab('response')}
              className={`flex-1 py-2.5 rounded-xl font-display text-[10px] uppercase tracking-widest transition-all duration-200 ${
                activeTab === 'response' ? 'bg-ipl-gold text-ipl-navy shadow-neon shadow-ipl-gold/10 font-bold' : 'text-gray-500'
              }`}
            >
              Your Response
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('predictions')}
              className={`flex-1 py-2.5 rounded-xl font-display text-[10px] uppercase tracking-widest transition-all duration-200 ${
                activeTab === 'predictions' ? 'bg-ipl-gold text-ipl-navy shadow-neon shadow-ipl-gold/10 font-bold' : 'text-gray-500'
              }`}
            >
              Reveal / Predictions
            </button>
          </div>
        )}

        {isSubmitted && (
          <div className="glass-panel border-l-4 border-l-ipl-gold p-4 flex items-start gap-3 rounded-2xl">
            <CheckCircle className="w-5 h-5 text-ipl-gold shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-display text-xs uppercase tracking-widest font-bold">Response {isClosed ? 'submitted' : 'recorded'}</p>
              {isClosed && campaign.my_response?.total_points != null && (
                <p className="text-gray-400 text-[11px] mt-0.5">
                  Total score: <span className="text-ipl-gold font-bold">{campaign.my_response.total_points} pts</span>
                </p>
              )}
              {!isClosed && isActive && (
                <p className="text-gray-500 text-[11px] mt-0.5">You can update your answers until the campaign closes</p>
              )}
            </div>
          </div>
        )}

        {(campaign.starts_at || campaign.ends_at) && (
          <div className="flex items-center gap-2 text-gray-500 text-xs font-display uppercase tracking-widest flex-wrap">
            {campaign.ends_at && (
              <span className="flex items-center flex-wrap">
                <CampaignCountdown endsAt={campaign.ends_at} />
              </span>
            )}
          </div>
        )}

        {user?.is_guest && isActive && (
          <div className="glass-panel border-l-4 border-l-gray-600 p-4 rounded-2xl">
            <p className="text-gray-400 font-display text-xs uppercase tracking-widest">Guests cannot submit responses</p>
          </div>
        )}
      </header>

      {/* Questions or Predictions Tab */}
      {activeTab === 'response' ? (
        <form onSubmit={handleSubmit} className="space-y-6">
        {campaign.questions.map((q, idx) => {
          const myAnswer = getAnswer(q.id);
          const myPoints = isSubmitted && campaign.my_response
            ? campaign.my_response.answers[q.id]?.points_awarded
            : undefined;

          return (
            <div key={q.id} className="glass-panel p-5 border-t-2 border-t-white/10 rounded-3xl">
              <div className="flex items-center gap-2 text-gray-500 text-[9px] font-display uppercase tracking-widest mb-1.5">
                {QUESTION_ICONS[q.question_type]}
                <span>Question {idx + 1} · {q.question_type.replace('_', ' ')}</span>
              </div>

              <p className="text-white font-display text-sm font-bold uppercase tracking-tight">{q.question_text}</p>
              <ScoringHint rules={q.scoring_rules} type={q.question_type} />

              {q.question_type === 'toggle' && (
                <ToggleInput q={q} value={myAnswer} onChange={v => setAnswer(q.id, v)} disabled={disabled} />
              )}
              {q.question_type === 'multiple_choice' && (
                <MultipleChoiceInput q={q} value={myAnswer} onChange={v => setAnswer(q.id, v)} disabled={disabled} />
              )}
              {q.question_type === 'dropdown' && (
                <DropdownInput q={q} value={myAnswer} onChange={v => setAnswer(q.id, v)} disabled={disabled} />
              )}
              {q.question_type === 'free_text' && (
                <FreeTextInput value={myAnswer} onChange={v => setAnswer(q.id, v)} disabled={disabled} />
              )}
              {q.question_type === 'free_number' && (
                <FreeNumberInput value={myAnswer} onChange={v => setAnswer(q.id, v)} disabled={disabled} />
              )}

              {isClosed && isSubmitted && (
                <div className="mt-4 pt-3 border-t border-white/5">
                  <ResultBadge points={myPoints} correct={q.correct_answer} />
                </div>
              )}
            </div>
          );
        })}

        {isActive && !isClosed && !user?.is_guest && (
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-ipl-gold text-black rounded-2xl font-display text-xs uppercase tracking-[0.25em] font-bold hover:bg-ipl-gold/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(255,215,0,0.2)] active:scale-[0.98]"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </span>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                {isSubmitted ? 'Update Response' : 'Submit Response'}
              </>
            )}
          </button>
        )}
      </form>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-between items-center mb-4 px-1">
            <h2 className="text-xs font-display text-gray-500 uppercase tracking-widest">Community Guesses</h2>
            <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10 select-none shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('player')}
                className={`px-4 py-1.5 rounded-xl transition-all font-display text-[9px] uppercase tracking-widest ${
                  viewMode === 'player' ? 'bg-white/10 text-white font-bold shadow-sm' : 'text-gray-500'
                }`}
              >
                By Player
              </button>
              <button
                type="button"
                onClick={() => setViewMode('question')}
                className={`px-4 py-1.5 rounded-xl transition-all font-display text-[9px] uppercase tracking-widest ${
                  viewMode === 'question' ? 'bg-white/10 text-white font-bold shadow-sm' : 'text-gray-500'
                }`}
              >
                By Question
              </button>
            </div>
          </div>

          {isLoadingResponses ? (
            <div className="text-center py-12 text-gray-500 animate-pulse font-display text-sm tracking-widest uppercase">
              Loading predictions...
            </div>
          ) : !responsesData || responsesData.length === 0 ? (
            <div className="glass-panel p-8 text-center border-dashed border-2 border-white/5 opacity-50 rounded-2xl">
              <p className="text-gray-500 font-display text-xs uppercase tracking-[0.2em]">
                No predictions submitted yet
              </p>
            </div>
          ) : (
            responsesData.map((section: any) => {
              const allPredictions = section.predictions;
              if (!allPredictions || allPredictions.length === 0) return null;

              return (
                <div key={section.league.id} className="space-y-4">
                  <div className="flex items-center gap-3 border-l-4 border-ipl-gold pl-3">
                    <h3 className="text-sm font-display text-white tracking-widest uppercase italic">
                      {section.league.name === 'IPL Global' ? (
                        <>IPL Global <span className="text-ipl-gold not-italic">Reveal</span></>
                      ) : (
                        <><span className="text-ipl-gold not-italic">League:</span> {section.league.name}</>
                      )}
                    </h3>
                  </div>

                  {viewMode === 'question' ? (
                    <div className="space-y-4">
                      {campaign.questions.map((q: any, qIdx: number) => {
                        return (
                          <div key={q.id} className="glass-panel p-5 border-t-2 border-t-white/10 space-y-4 rounded-3xl">
                            <div>
                              <div className="flex items-center gap-2 text-gray-500 text-[9px] font-display uppercase tracking-widest mb-1.5">
                                {QUESTION_ICONS[q.question_type as keyof typeof QUESTION_ICONS] || <Type className="w-4 h-4" />}
                                <span>Question {qIdx + 1} · {q.question_type.replace('_', ' ')}</span>
                              </div>
                              <p className="text-white font-display text-sm font-bold uppercase tracking-tight">{q.question_text}</p>
                              
                              {q.correct_answer !== null && q.correct_answer !== undefined && (
                                <div className="mt-2 inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-xl text-[10px] text-green-400 font-display uppercase font-bold tracking-widest">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>Answer: {String(q.correct_answer)}</span>
                                </div>
                              )}
                            </div>

                            <div className="border-t border-white/5 pt-4 space-y-2">
                              <h4 className="text-[10px] text-gray-500 font-display uppercase tracking-wider mb-2">Predictions</h4>
                              <div className="grid gap-2 md:grid-cols-2">
                                {allPredictions.map((resp: any) => {
                                  const userAnsVal = resp.answers[q.id];
                                  const ptsAwarded = resp.points_breakdown?.rules?.find((r: any) => (r.key && r.key === q.key) || r.category === q.question_text)?.points ?? 0;

                                  return (
                                    <div key={resp.prediction_id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-7 h-7 rounded-full border border-white/10 overflow-hidden shrink-0">
                                          <img
                                            src={resp.user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${getUserDisplayName(resp.user)}`}
                                            alt={getUserDisplayName(resp.user)}
                                          />
                                        </div>
                                        <div className="min-w-0">
                                          <span className="text-[10px] font-display text-gray-300 block truncate leading-none">
                                            {getUserDisplayName(resp.user)}
                                          </span>
                                          <span className="text-white font-bold text-xs block truncate mt-1 uppercase font-display">
                                            {userAnsVal !== undefined && userAnsVal !== null
                                              ? (Array.isArray(userAnsVal) ? userAnsVal.join(', ') : String(userAnsVal))
                                              : <span className="text-gray-600 italic font-normal">Unanswered</span>}
                                          </span>
                                        </div>
                                      </div>
                                      
                                      {ptsAwarded !== undefined && ptsAwarded !== null && (
                                        <div className={`shrink-0 text-[10px] font-display font-bold px-2 py-0.5 rounded-lg ${
                                          ptsAwarded > 0 ? 'bg-green-500/20 text-green-400' : ptsAwarded < 0 ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'
                                        }`}>
                                          {ptsAwarded > 0 ? '+' : ''}{ptsAwarded}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {allPredictions.map((resp: any) => {
                        const isExpanded = expandedUser === resp.user.id;
                        return (
                          <div key={resp.prediction_id} className="glass-panel overflow-hidden border border-white/10 rounded-[22px] active:scale-[0.99] transition-transform duration-100">
                            <button
                              type="button"
                              onClick={() => setExpandedUser(isExpanded ? null : resp.user.id)}
                              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full border border-white/10 overflow-hidden shrink-0">
                                  <img
                                    src={resp.user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${getUserDisplayName(resp.user)}`}
                                    alt={getUserDisplayName(resp.user)}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="text-left">
                                  <div className="text-sm font-display font-bold text-white uppercase">{getUserDisplayName(resp.user)}</div>
                                  {resp.points_awarded !== null && resp.points_awarded !== undefined && (
                                    <div className="text-[10px] text-ipl-gold font-display tracking-widest uppercase mt-0.5">
                                      Total: {resp.points_awarded} pts
                                    </div>
                                  )}
                                </div>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            {isExpanded && (
                              <div className="p-4 border-t border-white/5 bg-black/20 space-y-4">
                                {campaign.questions.map((q: any) => {
                                  const userAnsVal = resp.answers[q.id];
                                  const ptsAwarded = resp.points_breakdown?.rules?.find((r: any) => (r.key && r.key === q.key) || r.category === q.question_text)?.points ?? 0;

                                  return (
                                    <div key={q.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
                                      <div className="flex-1 min-w-0">
                                        <div className="text-[9px] text-gray-500 font-display uppercase tracking-widest mb-1">
                                          {q.question_text}
                                        </div>
                                        <div className="text-xs text-white font-bold truncate uppercase font-display">
                                          {userAnsVal !== undefined && userAnsVal !== null
                                            ? (Array.isArray(userAnsVal) ? userAnsVal.join(', ') : String(userAnsVal))
                                            : <span className="text-gray-600 italic font-normal">Unanswered</span>}
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center gap-4 shrink-0 mt-2 sm:mt-0">
                                        {q.correct_answer !== null && q.correct_answer !== undefined && (
                                          <div className="text-[9px] text-gray-400 font-display hidden sm:block uppercase">
                                            Correct: {String(q.correct_answer)}
                                          </div>
                                        )}
                                        {ptsAwarded !== undefined && ptsAwarded !== null && (
                                          <div className={`text-[10px] font-display font-bold px-2 py-0.5 rounded-lg ${
                                            ptsAwarded > 0 ? 'bg-green-500/20 text-green-400' : ptsAwarded < 0 ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'
                                          }`}>
                                            {ptsAwarded > 0 ? '+' : ''}{ptsAwarded}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
