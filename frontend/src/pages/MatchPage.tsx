import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { useMatch, useSubmitPrediction, useMyPredictions, useAllMatchPredictions } from '../api/hooks/useMatches';
import { Trophy, Target, CheckCircle2, Edit2, Check, X, Sparkles, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';
import { getTeamColor, getTeamShortName } from '../utils/teamColors';
import { getUserDisplayName } from '../utils/userUtils';
import { getTeamLogo } from '../utils/teamLogos';

export default function MatchPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [hasAutoPredicted, setHasAutoPredicted] = useState(false);
  const [showAutoPredictConfirm, setShowAutoPredictConfirm] = useState(false);
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

  const { data, isLoading, error } = useMatch(id || '');
  const { mutate: submitPrediction, isPending } = useSubmitPrediction(id || '');
  const { data: myPredictions } = useMyPredictions(id || '');


  // Predictions are currently always open (start-lock disabled)
  const tossTime = data?.match?.tossTime ? new Date(data.match.tossTime) : null;
  const isLocked = tossTime ? (new Date() > new Date(tossTime.getTime() - 30 * 60000)) : false;

  const { data: leagueSections } = useAllMatchPredictions(id || '');

  const match = data?.match;
  const questions = data?.questions || [];

  // Pre-fill existing predictions and admin results
  useEffect(() => {
    if (myPredictions && Object.keys(myPredictions).length > 0 && questions.length > 0) {
      // Build the form values: use_powerup stays top-level, everything else goes into extra_answers
      const formValues: Record<string, any> = {
        use_powerup: myPredictions.use_powerup || 'No',
        extra_answers: {}
      };

      Object.entries(myPredictions).forEach(([key, val]) => {
        if (key === 'use_powerup' || key === 'is_auto_predicted') return;

        // Answers are now keyed by question_id (UUID or league prefix)
        // No more system_key mapping needed here.
        formValues.extra_answers[key] = val;
      });

      reset(formValues);
      setHasAutoPredicted(!!myPredictions.is_auto_predicted);
    }
  }, [myPredictions, questions, reset]);


  const winnerQId = useMemo(() => {
    if (!match) return null;
    const teamSet = new Set([match.team1, match.team2]);
    return questions.find((q: any) =>
      q.options && q.options.length === 2 && q.options.every((opt: string) => teamSet.has(opt))
    )?.key || null;
  }, [questions, match]);

  const getSortedPredictions = (predictions: any[]) => {
    if (!predictions || !match) return [];
    return [...predictions].sort((a, b) => {
      if (match.status === 'completed') {
        const pointsA = a.points_awarded ?? -999;
        const pointsB = b.points_awarded ?? -999;
        if (pointsA !== pointsB) return pointsB - pointsA;
      }

      const getScore = (p: any) => {
        const w = winnerQId ? p.answers?.[winnerQId] : null;
        if (w === match.team1) return 1;
        if (w === match.team2) return 2;
        return 3;
      };
      const scoreDiff = getScore(a) - getScore(b);
      if (scoreDiff !== 0) return scoreDiff;

      return (a.user?.name || '').localeCompare(b.user?.name || '');
    });
  };

  const powerupsUsed = data?.powerups_used || 0;
  const totalPowerups = data?.total_powerups ?? 10;
  const powerupsLeft = totalPowerups - powerupsUsed;
  const hasPredicted = myPredictions && Object.keys(myPredictions).length > 0;

  const matchNumber = match?.id?.split('-')?.pop() || '0';


  const groupedQuestions = useMemo(() => {
    const groups: Record<string, any[]> = {};
    questions.forEach((q: any) => {
      const source = q.source_name || 'IPL Global';
      if (!groups[source]) groups[source] = [];
      groups[source].push(q);
    });
    return groups;
  }, [questions]);

  const questionMap = useMemo(() => {
    const map: Record<string, any> = {};
    questions.forEach((q: any) => {
      map[q.key] = q;
    });
    return map;
  }, [questions]);

  if (isLoading) return <div className="text-white text-center font-display tracking-widest mt-20 animate-pulse">LOADING MATCH...</div>;
  if (error || !data || !match) return <div className="text-ipl-live text-center font-display tracking-widest mt-20">FAILED TO LOAD MATCH</div>;

  const renderQuestion = (q: any) => {
    // All prediction answers go through extra_answers keyed by q.key (question_id or league key)
    // Only use_powerup stays as a top-level field
    const registerName = `extra_answers.${q.key}`;
    const error = (errors.extra_answers as any)?.[q.key];

    if (q.key === 'use_powerup') return null;

    const options = q.options || [];
    const isChoice = ['toggle', 'multiple_choice', 'dropdown'].includes(q.answer_type) || (options.length > 0);
    const isBinary = isChoice && options.length === 2;

    if (isBinary) {
      const isMatchWinner = q.key === winnerQId;
      return (
        <div key={q.key} className={`space-y-4 ${isMatchWinner ? 'col-span-full' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-gray-300 font-display tracking-wide uppercase text-sm">
              {q.question_text}
              {error && <span className="ml-2 text-red-500 text-[10px] animate-pulse">(! Required)</span>}
            </label>
            {q.source_name && q.source_name !== 'IPL Global' && (
              <span className="text-[8px] bg-ipl-gold/10 text-ipl-gold px-1.5 py-0.5 rounded border border-ipl-gold/20 font-bold uppercase tracking-tighter">
                {q.source_name} League
              </span>
            )}
            {q.allow_powerup === false && (
              <span className="text-[8px] bg-white/5 text-gray-500 px-1.5 py-0.5 rounded border border-white/10 font-bold uppercase tracking-tighter ml-1.5">
                No Booster
              </span>
            )}
          </div>
          <div className={`grid grid-cols-2 gap-4 ${isLocked ? 'pointer-events-none opacity-80' : ''}`}>
            {options.map((opt: string) => (
              <label key={opt} className="cursor-pointer">
                <input type="radio" value={opt} {...register(registerName, { required: true })} className="peer sr-only" disabled={isLocked} />
                <div
                  className={`team-select-button p-4 border-2 text-center font-display transition-all peer-checked:text-white ${isMatchWinner ? 'text-xl' : 'text-sm'}`}
                  style={{
                    '--team-color': getTeamColor(opt),
                    borderColor: error ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.2)',
                    color: error ? 'rgba(239, 68, 68, 0.5)' : 'rgba(156, 163, 175, 1)'
                  } as any}
                >
                  {opt}
                </div>
              </label>
            ))}
          </div>
          <style>{`
            .team-select-button { transition: all 0.3s ease; }
            input:checked + .team-select-button {
              background-color: var(--team-color) !important;
              border-color: var(--team-color) !important;
              box-shadow: 0 0 20px var(--team-color) !important;
            }
          `}</style>
        </div>
      );
    }

    const isFullWidth = ['free_text', 'player_name', 'text'].includes(q.answer_type);

    return (
      <div key={q.key} className={`space-y-2 ${isFullWidth ? 'col-span-full' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-gray-300 font-display tracking-wide uppercase text-sm">
            {q.question_text}
            {error && <span className="ml-2 text-red-500 text-[10px] animate-pulse">(! Required)</span>}
          </label>
          {q.source_name && q.source_name !== 'IPL Global' && (
            <span className="text-[8px] bg-ipl-gold/10 text-ipl-gold px-1.5 py-0.5 rounded border border-ipl-gold/20 font-bold uppercase tracking-tighter">
              {q.source_name} League
            </span>
          )}
          {q.allow_powerup === false && (
            <span className="text-[8px] bg-white/5 text-gray-500 px-1.5 py-0.5 rounded border border-white/10 font-bold uppercase tracking-tighter ml-1.5">
              No Booster
            </span>
          )}
        </div>

        {q.answer_type === 'dropdown' || (options.length > 2) ? (
          <select
            {...register(registerName, { required: true })}
            disabled={isLocked}
            className={`w-full bg-white/5 border border-white/10 rounded-xl p-3 md:p-4 text-white font-display text-sm md:text-base focus:outline-none focus:border-ipl-gold focus:bg-white/10 transition-all appearance-none disabled:opacity-50 shadow-inner ${error ? 'border-red-500/50' : 'border-white/20'}`}
          >
            <option value="" className="bg-ipl-navy">Select Option</option>
            {q.options?.map((opt: string) => (
              <option key={opt} value={opt} className="bg-ipl-navy">{opt}</option>
            ))}
          </select>
        ) : q.answer_type === 'multiple_choice' ? (
          <div className={`grid grid-cols-2 gap-3 ${isLocked ? 'pointer-events-none opacity-80' : ''}`}>
            {q.options?.map((opt: string) => (
              <label key={opt} className="cursor-pointer">
                <input type="radio" value={opt} {...register(registerName, { required: true })} className="peer sr-only" disabled={isLocked} />
                <div className={`p-3 md:p-4 border border-white/10 rounded-xl text-center font-display text-xs md:text-sm transition-all peer-checked:bg-ipl-gold peer-checked:text-black peer-checked:border-ipl-gold peer-checked:shadow-[0_0_15px_rgba(255,215,0,0.3)] hover:border-white/30 text-gray-400 bg-white/5 shadow-inner`}>
                  {opt}
                </div>
              </label>
            ))}
          </div>
        ) : (
          <input
            {...register(registerName, { required: true, valueAsNumber: q.answer_type === 'number' || q.answer_type === 'free_number' })}
            type={q.answer_type === 'number' || q.answer_type === 'free_number' ? 'number' : 'text'}
            disabled={isLocked}
            placeholder={q.answer_type === 'number' || q.answer_type === 'free_number' ? '0' : 'Type your answer'}
            className={`w-full bg-white/5 border border-white/10 rounded-xl p-3 md:p-4 text-white font-display text-sm md:text-base focus:outline-none focus:border-ipl-gold focus:bg-white/10 transition-all disabled:opacity-50 shadow-inner ${error ? 'border-red-500/50' : 'border-white/20'}`}
          />
        )}
      </div>
    );
  };


  const onSubmit = (formData: any) => {
    if (isLocked) return;
    submitPrediction(formData, {
      onSuccess: () => {
        toast.success('Prediction Locked!');
      },
      onError: (err: any) => {
        if (err.response?.data?.detail === 'powerup_limit_reached') {
          toast.error(`Boost Limit Reached! Max ${totalPowerups} allowed.`);
        } else {
          toast.error('Submission failed. Try again.');
        }
      }
    });
  };

  const handleAdminUpdate = async (predId: string, questionKey: string) => {
    try {
      await apiClient.put(`/admin/predictions/${predId}`,
        { [questionKey]: editValue }
      );
      setEditingId(null);
      toast.success('Prediction updated successfully');
      window.location.reload(); // Refresh to show new data
    } catch (err) {
      toast.error('Failed to update prediction');
    }
  };

  const handleAutoPredict = async () => {
    if (isLocked || hasPredicted || hasAutoPredicted) return;

    setHasAutoPredicted(true);

    try {
      const { data: predictedData } = await apiClient.post(`/matches/${id || match.id}/autopredict`);

      Object.entries(predictedData).forEach(([qId, val]) => {
        if (qId === 'use_powerup') {
          setValue('use_powerup', val, { shouldValidate: true, shouldDirty: true });
          return;
        }
        // Auto-predict response now uses question IDs directly
        setValue(`extra_answers.${qId}`, val, { shouldValidate: true, shouldDirty: true });
      });


      // Invalidate so hasPredicted flips to true from server
      queryClient.invalidateQueries({ queryKey: ['predictions', 'mine', id || match.id] });

      toast.success('AI has locked in your prediction!');
    } catch (err: any) {
      if (err.response?.data?.detail === 'Prediction already exists for this match') {
        toast.error('You already have a prediction for this match.');
      } else {
        toast.error('Failed to auto predict.');
      }
      setHasAutoPredicted(false);
    }
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full px-2 md:px-6 pb-20">
      <div className="glass-panel p-4 md:p-8 text-center border-b-[4px] border-ipl-gold relative overflow-hidden">
        <div className="flex justify-between items-center w-full mb-4 md:mb-0 relative md:absolute md:top-4 md:left-0 md:w-full md:px-4 z-10 px-1">
          <div className="rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-gray-300 font-display text-[9px] md:text-[10px] tracking-widest px-3 md:px-4 py-1.5 uppercase shadow-lg">
            Powerups: <span className="text-white font-bold">{powerupsLeft}/{totalPowerups}</span>
          </div>
          <div className={`rounded-full border backdrop-blur-md font-display text-[9px] md:text-[10px] tracking-widest px-3 md:px-4 py-1.5 font-bold uppercase shadow-lg transition-all ${isLocked 
            ? 'bg-ipl-live/10 border-ipl-live/30 text-ipl-live shadow-[0_0_15px_rgba(232,64,64,0.15)]' 
            : 'bg-ipl-gold/10 border-ipl-gold/30 text-ipl-gold shadow-[0_0_15px_rgba(255,215,0,0.15)]'}`}>
            {isLocked ? 'Predictions Closed' : 'Predictions Open'}
          </div>
        </div>
        <p className="text-gray-400 mt-2 md:mt-6 font-display uppercase tracking-[0.3em] font-bold text-xs md:text-sm ring-offset-2">
          Match {matchNumber}
        </p>
        <div className="flex items-start justify-center gap-4 md:gap-16 mt-6 md:mt-8">
          <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
            <div 
              className="w-20 h-20 md:w-32 md:h-32 rounded-2xl md:rounded-3xl flex items-center justify-center border-2 shadow-2xl overflow-hidden p-2 md:p-3 bg-black/40 relative group shrink-0"
              style={{ borderColor: `${getTeamColor(match.team1)}50`, boxShadow: `0 0 40px ${getTeamColor(match.team1)}20` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              {getTeamLogo(match.team1) ? (
                <img src={getTeamLogo(match.team1)!} alt={match.team1} className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
              ) : (
                <span className="text-2xl md:text-3xl font-display text-white">{getTeamShortName(match.team1)}</span>
              )}
            </div>
            <span className="text-lg md:text-2xl lg:text-3xl font-display font-bold leading-tight text-center break-words w-full" style={{ color: getTeamColor(match.team1) }}>
              <span className="md:hidden">{getTeamShortName(match.team1)}</span>
              <span className="hidden md:inline">{match.team1}</span>
            </span>
          </div>

          <div className="flex flex-col items-center shrink-0 mt-5 md:mt-10">
            <span className="text-gray-600 font-display text-lg md:text-3xl italic tracking-widest opacity-40">VS</span>
            <div className="w-[1px] md:w-[2px] h-8 md:h-16 bg-gradient-to-b from-transparent via-ipl-gold/20 to-transparent mt-2 md:mt-4" />
          </div>

          <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
            <div 
              className="w-20 h-20 md:w-32 md:h-32 rounded-2xl md:rounded-3xl flex items-center justify-center border-2 shadow-2xl overflow-hidden p-2 md:p-3 bg-black/40 relative group shrink-0"
              style={{ borderColor: `${getTeamColor(match.team2)}50`, boxShadow: `0 0 40px ${getTeamColor(match.team2)}20` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              {getTeamLogo(match.team2) ? (
                <img src={getTeamLogo(match.team2)!} alt={match.team2} className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
              ) : (
                <span className="text-2xl md:text-3xl font-display text-white">{getTeamShortName(match.team2)}</span>
              )}
            </div>
            <span className="text-lg md:text-2xl lg:text-3xl font-display font-bold leading-tight text-center break-words w-full" style={{ color: getTeamColor(match.team2) }}>
              <span className="md:hidden">{getTeamShortName(match.team2)}</span>
              <span className="hidden md:inline">{match.team2}</span>
            </span>
          </div>
        </div>

        <p className="text-gray-400 mt-12 font-display uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 opacity-60">
          <MapPin className="w-3.5 h-3.5 text-ipl-gold" />
          {match.venue}
        </p>
      </div>

      {match.status === 'completed' && (
        <div className="glass-panel p-8 border-t-4 border-t-ipl-gold shadow-[0_20px_50px_rgba(244,196,48,0.1)] animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-ipl-gold/10 rounded-lg">
              <Trophy className="w-6 h-6 text-ipl-gold" />
            </div>
            <h2 className="text-2xl font-display text-white italic tracking-tighter">OFFICIAL MATCH RESULTS</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
            <div
              className="bg-white/5 p-4 md:p-6 border relative overflow-hidden group transition-all col-span-2 md:col-span-1"
              style={{
                borderColor: match?.results?.[winnerQId] ? `${getTeamColor(match.results[winnerQId])}40` : 'rgba(255,255,255,0.1)',
                boxShadow: match?.results?.[winnerQId] ? `0 0 20px ${getTeamColor(match.results[winnerQId])}15` : 'none'
              }}
            >
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <CheckCircle2 className="w-24 h-24 text-ipl-gold" />
              </div>
              <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] mb-4">Official Winner</label>
              <div className="text-3xl font-display tracking-widest uppercase flex items-center gap-4">
                {match?.results?.[winnerQId] && getTeamLogo(match.results[winnerQId]) && (
                  <img src={getTeamLogo(match.results[winnerQId])!} alt="" className="w-10 h-10 object-contain" />
                )}
                <span style={{
                  color: match?.results?.[winnerQId] ? getTeamColor(match.results[winnerQId]) : 'white',
                  textShadow: match?.results?.[winnerQId] ? `0 0 20px ${getTeamColor(match.results[winnerQId])}60` : 'none'
                }}>
                  {match?.results?.[winnerQId] || 'TBD'}
                </span>
              </div>
            </div>

            {Object.keys(match?.results || {}).filter(k => k !== winnerQId).map(k => {
              const q = questions.find((q: any) => q.key === k);
              let label = q?.question_text || 'Result';
              if (label.length > 25) label = label.substring(0, 25) + '...';

              const val = match.results[k];
              const isTeamMatch = getTeamColor(val) !== '#666666';
              const valStyle = isTeamMatch ? { color: getTeamColor(val) } : { color: 'white' };

              return (
                <div key={k} className="bg-white/5 p-4 md:p-6 border border-white/10 relative overflow-hidden group flex flex-col justify-center items-center">
                  <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Target className="w-24 h-24 text-ipl-gold" />
                  </div>
                  <label className="block text-[8px] md:text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] mb-2 text-center">{label}</label>
                  <div className="text-xl md:text-2xl font-display tracking-wide uppercase text-center" style={valStyle}>
                    {val}
                  </div>
                </div>
              );
            })}
          </div>

          {(match.reported_by_name) && (
            <div className="mt-8 pt-4 border-t border-white/5 flex justify-between items-center text-[10px] font-display uppercase tracking-widest text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-ipl-gold rounded-full"></div>
                MATCH OFFICIAL RESULTS
              </div>
              <div className="flex items-center gap-2">
                Reported by <span className="text-ipl-gold font-bold">{match.reported_by_name}</span>
                {match.report_method && (
                  <span className="text-[8px] bg-white/5 px-1.5 py-0.5 rounded border border-white/10 lowercase opacity-60">
                    via {match.report_method}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}



      {!isLocked && (
        <div className="glass-panel p-4 md:p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8 border-b-2 border-white/5 pb-4">
            <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
              <h2 className="text-xl md:text-2xl font-display text-white">YOUR PREDICTIONS</h2>
              {hasPredicted && (
                <div className="flex items-center gap-2 px-2 md:px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full animate-pulse">
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e]"></div>
                  <span className="text-[9px] md:text-[10px] font-display text-green-500 uppercase tracking-tighter">Saved</span>
                </div>
              )}
            </div>
            {!currentUser?.is_guest && (
              <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto mt-2 md:mt-0">
                <button
                  type="button"
                  onClick={() => setShowAutoPredictConfirm(true)}
                  disabled={isLocked || hasPredicted || hasAutoPredicted}
                  className={`group flex items-center gap-1.5 text-[9px] sm:text-xs font-display uppercase tracking-widest px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold transition-all ${isLocked || hasPredicted || hasAutoPredicted
                    ? 'bg-gray-500 text-gray-300 opacity-40 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#004BA0] to-[#7B2FF7] text-white hover:shadow-[0_0_18px_rgba(123,47,247,0.6)] hover:scale-105'
                    }`}
                >
                  <Sparkles className="w-2.5 h-2.5 md:w-3 md:h-3 opacity-90 group-hover:animate-spin" />
                  AI Auto Predict
                </button>
                <div className="text-[9px] md:text-xs font-display text-ipl-gold uppercase tracking-widest bg-ipl-gold/10 px-3 py-1.5 md:py-1 rounded-full border border-ipl-gold/20 whitespace-nowrap">
                  {powerupsLeft} POWERUPS LEFT
                </div>
              </div>
            )}
          </div>

          {currentUser?.is_guest ? (
            <div className="py-12 px-6 text-center bg-white/[0.02] border border-white/5 rounded-xl">
              <div className="inline-flex items-center justify-center p-4 bg-ipl-gold/10 rounded-full mb-6">
                <Sparkles className="w-8 h-8 text-ipl-gold animate-pulse" />
              </div>
              <h3 className="text-2xl font-display text-white mb-3">GUEST ACCESS</h3>
              <p className="text-gray-400 font-display text-sm tracking-wide max-w-md mx-auto leading-relaxed">
                You are currently viewing the system as a <span className="text-ipl-gold font-bold">GUEST</span>.
                You can see match details, community trends, and the leaderboard, but you cannot submit predictions.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4">
                <p className="text-[10px] text-gray-500 font-display uppercase tracking-[0.2em]">Contact an admin to join the league</p>
                <div className="h-[1px] w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
              {Object.entries(groupedQuestions).map(([source, groupQuestions]) => (
                <div key={source} className="space-y-6 pt-8 first:pt-0 border-t border-white/5 first:border-t-0">
                  <div className="flex items-center gap-3 border-l-4 border-ipl-gold pl-4 mb-4">
                    <h3 className="text-lg font-display text-white tracking-widest uppercase italic">
                      {source === 'IPL Global' ? (
                        <>IPL Global <span className="text-ipl-gold not-italic">Questions</span></>
                      ) : (
                        <><span className="text-ipl-gold not-italic">League:</span> {source}</>
                      )}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {groupQuestions.map(q => renderQuestion(q))}
                  </div>
                </div>
              ))}

              <div className="space-y-4 pt-8 border-t border-white/10">
                <div className="flex justify-between items-end">
                  <label className={`block font-display tracking-wide uppercase text-sm ${errors.use_powerup ? 'text-red-500' : 'text-gray-300'}`}>
                    Use 2x Powerup for this match? {errors.use_powerup && <span className="ml-2 text-[10px] animate-pulse">(! Selection Required)</span>}
                  </label>
                  <span className="text-[10px] text-gray-500 font-display uppercase">Season Limit: {totalPowerups}</span>
                </div>
                <div className={`flex gap-4 ${isLocked ? 'pointer-events-none opacity-80' : ''}`}>
                  <label className={`flex-1 cursor-pointer ${(powerupsLeft <= 0 && myPredictions?.use_powerup !== 'Yes') ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                    <input type="radio" value="Yes" {...register('use_powerup', { required: true })} className="peer sr-only" disabled={isLocked || (powerupsLeft <= 0 && myPredictions?.use_powerup !== 'Yes')} />
                    <div className={`p-3 border-2 text-center font-display transition-all peer-checked:bg-ipl-gold peer-checked:text-black peer-checked:border-ipl-gold ${errors.use_powerup ? 'border-red-500/50 text-red-500/50' : 'border-white/20 text-gray-400'}`}>
                      YES (Use Powerup)
                    </div>
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <input type="radio" value="No" {...register('use_powerup', { required: true })} className="peer sr-only" disabled={isLocked} />
                    <div className={`p-3 border-2 text-center font-display transition-all peer-checked:bg-white/20 peer-checked:text-white peer-checked:border-white/40 ${errors.use_powerup ? 'border-red-500/50 text-red-500/50' : 'border-white/20 text-gray-400'}`}>
                      NO
                    </div>
                  </label>
                </div>
                {powerupsLeft <= 0 && myPredictions?.use_powerup !== 'Yes' && !isLocked && (
                  <p className="text-ipl-live text-[10px] font-display uppercase text-center mt-2 animate-pulse">Powerup Limit Reached!</p>
                )}
              </div>

              <div className="pt-8">
                <button
                  type="submit"
                  disabled={isPending || isLocked}
                  className="w-full bg-white text-ipl-navy hover:bg-gray-200 font-display uppercase tracking-widest py-4 transition-all disabled:bg-white/10 disabled:text-white/40 disabled:border-white/10"
                >
                  {isLocked ? 'LOCK PERIOD CLOSED' : (isPending ? 'LOCKING...' : (hasPredicted ? 'Update Lock' : 'Submit Lock'))}
                </button>
                {isLocked && (
                  <p className="text-gray-500 text-[10px] font-display uppercase mt-3 text-center">Prediction window ended 30m before the match start.</p>
                )}
              </div>
            </form>
          )}
        </div>
      )}
      <div className="space-y-12">
        {!leagueSections || leagueSections.length === 0 ? (
          <div className="glass-panel p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center py-10 text-gray-500 font-display tracking-widest text-[10px] uppercase">
              NO PREDICTIONS FOUND FOR THIS MATCH
            </div>
          </div>
        ) : (
          leagueSections.map((section: any) => {
            const allPredictions = section.predictions;
            const sortedPredictions = getSortedPredictions(allPredictions);
            return (
              <div key={section.league.id} className="glass-panel p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center gap-3 mb-8 border-b-2 border-white/5 pb-4">
                  <h2 className="text-2xl font-display text-white italic tracking-tighter">
                    {section.league.name === 'IPL Global' ? (
                      <>MATCH {matchNumber} <span className="text-ipl-gold">REVEAL</span></>
                    ) : (
                      <>{section.league.name} <span className="text-ipl-gold">| COMMUNITY REVEAL</span></>
                    )}
                  </h2>
                  {isLocked ? (
                    <span className="bg-ipl-live/20 text-ipl-live text-[10px] px-2 py-1 rounded font-display animate-pulse uppercase tracking-tighter">Live Guesses</span>
                  ) : (
                    <span className="bg-ipl-gold/20 text-ipl-gold text-[10px] px-2 py-1 rounded font-display uppercase tracking-tighter">Guesses Hidden</span>
                  )}
                </div>

                {!allPredictions || allPredictions.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 font-display tracking-widest text-[10px] uppercase">
                    NO PREDICTIONS FOUND FOR THIS LEAGUE
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 md:gap-6">
                    {/* Stats Header */}
                    <div className="flex justify-center items-center gap-6 md:gap-8 bg-white/5 rounded-lg md:rounded-xl p-3 md:p-4 border border-white/10">
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] md:text-[10px] text-gray-400 font-display uppercase tracking-widest leading-none mb-1">{getTeamShortName(match.team1)}</span>
                        <span className="text-xl md:text-3xl font-display leading-none drop-shadow-md" style={{ color: getTeamColor(match.team1) }}>
                          {allPredictions.filter((p: any) => winnerQId && p.answers[winnerQId] === match.team1).length}
                        </span>
                      </div>
                      <div className="h-6 md:h-10 w-[1px] md:w-[2px] bg-white/20 rounded-full" />
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] md:text-[10px] text-gray-400 font-display uppercase tracking-widest leading-none mb-1">{getTeamShortName(match.team2)}</span>
                        <span className="text-xl md:text-3xl font-display leading-none drop-shadow-md" style={{ color: getTeamColor(match.team2) }}>
                          {allPredictions.filter((p: any) => winnerQId && p.answers[winnerQId] === match.team2).length}
                        </span>
                      </div>
                    </div>

                    {/* Helper Function */}
                    {(() => {
                      const renderPredictionCard = (pred: any, idx: number, isDesktop = false) => {
                        const isMyRow = pred.user?.id === currentUser?.id;
                        const winnerAns = winnerQId ? pred.answers[winnerQId] : '🔒';
                        const teamWinnerShort = winnerAns === '🔒' ? '🔒' : getTeamShortName(winnerAns);
                        const isExpanded = expandedCardIds.has(pred.prediction_id);

                        const toggleExpand = () => {
                          setExpandedCardIds(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(pred.prediction_id)) newSet.delete(pred.prediction_id);
                            else newSet.add(pred.prediction_id);
                            return newSet;
                          });
                        };

                        return (
                          <div key={idx} className={`flex flex-col rounded-lg border transition-all ${isMyRow ? 'bg-ipl-gold/10 border-ipl-gold/50 shadow-[0_0_15px_rgba(244,196,48,0.15)]' : 'bg-white/5 border-white/10'}`}>
                            {/* Card Header (Always Visible) */}
                            <div 
                              className={`flex items-center justify-between cursor-pointer ${isDesktop ? 'md:p-3.5 md:gap-4' : 'p-2 gap-2'}`}
                              onClick={toggleExpand}
                            >
                              <div className="flex items-center gap-2 md:gap-3">
                                <div className="relative shrink-0">
                                  <img src={pred.user.avatar_url || 'https://via.placeholder.com/32'} className={`${isDesktop ? 'md:w-9 md:h-9' : 'w-7 h-7'} rounded-full border object-cover ${isMyRow ? 'border-ipl-gold' : 'border-white/10'}`} alt={pred.user.name} />
                                  {isMyRow && (
                                    <div className={`absolute -top-1 -right-1 bg-ipl-gold rounded-full border border-ipl-navy flex items-center justify-center ${isDesktop ? 'md:w-3.5 md:h-3.5' : 'w-2.5 h-2.5'}`}>
                                      <Check className={`${isDesktop ? 'md:w-2 md:h-2' : 'w-1.5 h-1.5'} text-black`} />
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1 md:gap-2">
                                    <span className={`${isDesktop ? 'md:text-[13px] md:font-black' : 'text-xs font-bold'} tracking-tight leading-none ${isMyRow ? 'text-ipl-gold' : 'text-white'}`}>
                                      {getUserDisplayName(pred.user)}
                                    </span>
                                    {match.status === 'completed' && pred.points_awarded !== undefined && pred.points_awarded !== null && (
                                      <div className="group-score relative">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold font-mono cursor-help transition-all group-hover-score:bg-white/20 ${pred.points_awarded > 0 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : pred.points_awarded < 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-gray-400 border border-white/20'}`}>
                                          {pred.points_awarded > 0 ? '+' : ''}{pred.points_awarded} PTS
                                        </span>

                                        {/* Breakdown Tooltip */}
                                        {pred.points_breakdown?.rules && (
                                          <div className="absolute bottom-full left-0 mb-2 w-52 bg-[#0f172a] border border-white/10 rounded-lg shadow-2xl p-3 opacity-0 group-hover-score:opacity-100 pointer-events-none transition-all z-50">
                                            <div className="space-y-1.5">
                                              {/* Boostable Core Rules */}
                                              {pred.points_breakdown.rules.filter((r: any) => !['More Sixes', 'More Fours'].includes(r.category)).map((rule: any, ri: number) => (
                                                <div key={ri} className="flex justify-between items-center text-[8px] uppercase tracking-wider">
                                                  <div className="flex items-center gap-1 min-w-0">
                                                    {rule.was_boosted && <span className="text-ipl-gold shrink-0">⚡</span>}
                                                    <span className="text-gray-500 truncate">{rule.category}</span>
                                                  </div>
                                                  <span className={rule.points > 0 ? 'text-green-400' : rule.points < 0 ? 'text-gray-400' : 'text-gray-400'}>
                                                    {rule.points > 0 ? '+' : ''}{rule.points}
                                                  </span>
                                                </div>
                                              ))}

                                              {/* Multiplier Indicator */}
                                              {pred.points_breakdown.powerup?.used && (
                                                <div className="py-1 my-1 border-y border-white/5 flex justify-between items-center text-[8px] uppercase tracking-widest font-bold text-ipl-gold">
                                                  <span className="flex items-center gap-1">⚡ 2X Booster Applied</span>
                                                  <span className="bg-ipl-gold text-black px-1 rounded-sm">x2</span>
                                                </div>
                                              )}
                                            </div>
                                            <div className="absolute -bottom-1 left-4 w-2 h-2 bg-[#0f172a] border-r border-b border-white/10 rotate-45" />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {pred.is_auto_predicted && (
                                      <Sparkles className={`${isDesktop ? 'md:w-3 md:h-3' : 'w-2 h-2'} text-[#7B2FF7]`} />
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-1.5 md:gap-2">
                                  {pred.answers.use_powerup === 'Yes' && (
                                    <div className={`flex items-center bg-ipl-live/10 border border-ipl-live/20 rounded leading-none ${isDesktop ? 'md:px-1.5 md:py-1' : 'px-1 py-0.5'}`}>
                                      <span className={`${isDesktop ? 'md:text-[9px]' : 'text-[8px]'} font-bold text-ipl-live tracking-tighter uppercase`}>⚡</span>
                                    </div>
                                  )}
                                  <span
                                    className={`font-bold rounded leading-none uppercase tracking-widest border ${isDesktop ? 'md:text-[10px] md:px-2 md:py-1' : 'text-[9px] px-1.5 py-0.5'} ${winnerAns === '🔒' ? 'bg-white/5 border-white/10 text-gray-500' : ''}`}
                                    style={winnerAns !== '🔒' ? {
                                      backgroundColor: `${getTeamColor(winnerAns)}15`,
                                      borderColor: `${getTeamColor(winnerAns)}40`,
                                      color: getTeamColor(winnerAns)
                                    } : {}}
                                  >
                                    {isDesktop && winnerAns !== '🔒' ? getTeamShortName(winnerAns) : teamWinnerShort}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3 h-3 md:w-4 md:h-4 text-gray-500" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3 md:w-4 md:h-4 text-gray-500" />
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Accordion Content (Answers) */}
                            {isExpanded && (
                              <div className={`border-t border-white/5 ${isDesktop ? 'p-3.5 pt-2' : 'p-2 pt-1'}`}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {(!winnerQId || pred.answers[winnerQId] === '🔒') ? (
                                    <span className="text-[10px] text-gray-500 font-display tracking-widest uppercase opacity-60 italic p-2">🔒 Predictions are hidden until match locks</span>
                                  ) : (
                                    Object.keys(pred.answers || {}).filter(k => ![winnerQId, 'use_powerup'].includes(k)).map(k => {
                                      const q = questionMap?.[k];
                                      let label = q?.question_text || '';
                                      if (q?.source_name && q.source_name !== 'IPL Global') {
                                        label = `${q.source_name}: ${label}`;
                                      }

                                      // Color code if it matches a team name
                                      const isTeamMatch = getTeamColor(pred.answers[k]) !== '#666666';
                                      const valStyle = isTeamMatch ? { color: getTeamColor(pred.answers[k]) } : {};
                                      const displayVal = isTeamMatch ? getTeamShortName(pred.answers[k]) : pred.answers[k];

                                      return (
                                        <div key={k} className="flex flex-col justify-center bg-black/20 p-2.5 rounded-md border border-white/5 relative group">
                                          {label && (
                                            <span className="text-[9px] text-gray-500 font-display uppercase tracking-widest mb-1 leading-tight flex justify-between items-center">
                                              <span>{label}</span>
                                              {currentUser?.is_admin && pred.prediction_id && editingId !== `${pred.prediction_id}:${k}` && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingId(`${pred.prediction_id}:${k}`);
                                                    setEditValue(pred.answers[k] || '');
                                                  }}
                                                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-ipl-gold transition-all"
                                                >
                                                  <Edit2 className="w-3 h-3" />
                                                </button>
                                              )}
                                            </span>
                                          )}
                                          
                                          {editingId === `${pred.prediction_id}:${k}` ? (
                                            <div className="flex items-center gap-1 mt-1">
                                              <input
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="bg-black/60 border border-white/20 text-white p-1 text-xs w-full focus:border-ipl-gold focus:outline-none font-mono rounded"
                                                autoFocus
                                              />
                                              <button onClick={(e) => { e.stopPropagation(); handleAdminUpdate(pred.prediction_id, k); }} className="text-green-500 hover:bg-white/10 rounded p-1 shrink-0">
                                                <Check className="w-3 h-3" />
                                              </button>
                                              <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="text-red-500 hover:bg-white/10 rounded p-1 shrink-0">
                                                <X className="w-3 h-3" />
                                              </button>
                                            </div>
                                          ) : (
                                            <span className="text-sm md:text-base text-white font-display font-bold tracking-wide" style={valStyle}>
                                              {displayVal || '-'}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      };

                      return (
                        <>
                          {/* MOBILE ONLY: Compact Cards */}
                          <div className="grid grid-cols-1 md:hidden gap-1.5">
                            {sortedPredictions.map((pred: any, idx: number) => renderPredictionCard(pred, idx, false))}
                          </div>

                          {/* DESKTOP ONLY: Side-by-Side Teams */}
                          <div className="hidden md:grid md:grid-cols-2 gap-6 mt-2">
                            <div className="space-y-4">
                              <div className="flex items-center gap-3 mb-2 px-1">
                                <div className="w-2 h-6 rounded-full" style={{ backgroundColor: getTeamColor(match.team1) }} />
                                <span className="text-xs font-display uppercase tracking-widest text-white font-black">
                                  {match.team1} SUPPORTERS
                                </span>
                              </div>
                              <div className="space-y-2">
                                {sortedPredictions.filter(p => winnerQId && p.answers[winnerQId] === match.team1).map((pred: any, idx: number) => renderPredictionCard(pred, idx, true))}
                                {sortedPredictions.filter(p => winnerQId && p.answers[winnerQId] === match.team1).length === 0 && (
                                  <div className="p-8 border border-dashed border-white/10 rounded-lg text-center text-[10px] text-gray-600 uppercase">No supporters yet</div>
                                )}
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div className="flex items-center gap-3 mb-2 px-1">
                                <div className="w-2 h-6 rounded-full" style={{ backgroundColor: getTeamColor(match.team2) }} />
                                <span className="text-xs font-display uppercase tracking-widest text-white font-black">
                                  {match.team2} SUPPORTERS
                                </span>
                              </div>
                              <div className="space-y-2">
                                {sortedPredictions.filter(p => winnerQId && p.answers[winnerQId] === match.team2).map((pred: any, idx: number) => renderPredictionCard(pred, idx, true))}
                                {sortedPredictions.filter(p => winnerQId && p.answers[winnerQId] === match.team2).length === 0 && (
                                  <div className="p-8 border border-dashed border-white/10 rounded-lg text-center text-[10px] text-gray-600 uppercase">No supporters yet</div>
                                )}
                              </div>
                            </div>
                            {sortedPredictions.some(p => winnerQId && p.answers[winnerQId] !== match.team1 && p.answers[winnerQId] !== match.team2) && (
                              <div className="col-span-2 mt-8 space-y-4">
                                <div className="flex items-center gap-2 mb-2 px-1 justify-center border-t border-white/5 pt-8">
                                  <span className="text-[11px] font-display uppercase tracking-widest text-gray-600 font-bold">
                                    OTHER PREDICTIONS
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  {sortedPredictions.filter(p => winnerQId && p.answers[winnerQId] !== match.team1 && p.answers[winnerQId] !== match.team2).map((pred: any, idx: number) => renderPredictionCard(pred, idx, true))}
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* AI Auto Predict Confirmation Modal */}
      {showAutoPredictConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowAutoPredictConfirm(false)}
          />
          {/* Dialog */}
          <div className="relative glass-panel border border-[#7B2FF7]/40 shadow-[0_0_40px_rgba(123,47,247,0.3)] p-8 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
            {/* Top accent */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#004BA0] to-[#7B2FF7]" />

            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div className="p-3 rounded-full bg-[#7B2FF7]/15 border border-[#7B2FF7]/30">
                <Sparkles className="w-6 h-6 text-[#7B2FF7]" />
              </div>
            </div>

            {/* Text */}
            <h3 className="text-white font-display text-lg tracking-tight text-center mb-2">
              Use AI Auto Predict?
            </h3>
            <p className="text-gray-400 text-xs font-display text-center leading-relaxed">
              Are you sure you want to continue?<br />
              <span className="text-[#F4C430] font-semibold">AI will populate the values for you. You can still modify them manually.</span>
            </p>

            {/* Buttons */}
            <div className="flex gap-3 mt-7">
              <button
                onClick={() => setShowAutoPredictConfirm(false)}
                className="flex-1 py-2.5 border border-white/20 text-gray-300 font-display text-xs uppercase tracking-widest hover:bg-white/5 transition-all"
              >
                No
              </button>
              <button
                onClick={() => {
                  setShowAutoPredictConfirm(false);
                  handleAutoPredict();
                }}
                className="flex-1 py-2.5 bg-gradient-to-r from-[#004BA0] to-[#7B2FF7] text-white font-display text-xs uppercase tracking-widest hover:shadow-[0_0_15px_rgba(123,47,247,0.5)] transition-all flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3 h-3" />
                Yes, Proceed
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
