import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { useMatch, useSubmitPrediction, useMyPredictions, useAllMatchPredictions } from '../api/hooks/useMatches';
import { Trophy, Target, CheckCircle2, Edit2, Check, X, Sparkles, MapPin, ChevronDown, Lock, User } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';
import { getTeamColor, getTeamShortName, getAccessibleTeamTextColor } from '../utils/teamColors';
import { getUserDisplayName } from '../utils/userUtils';
import { getTeamLogo } from '../utils/teamLogos';
import { useUiStore } from '../store/ui';

export default function MatchPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [hasAutoPredicted, setHasAutoPredicted] = useState(false);
  const [showAutoPredictConfirm, setShowAutoPredictConfirm] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState<{ predictorName: string; points: number; rules: any[]; powerupUsed?: boolean } | null>(null);
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

  const { data, isLoading, error } = useMatch(id || '');
  const match = data?.match;
  const { mutate: submitPrediction, isPending } = useSubmitPrediction(id || '');
  const { data: myPredictions } = useMyPredictions(id || '');
  const { setHeaderTitle } = useUiStore();

  useEffect(() => {
    if (match) {
      setHeaderTitle(`${getTeamShortName(match.team1)} VS ${getTeamShortName(match.team2)}`);
    }
    return () => setHeaderTitle(null);
  }, [match, setHeaderTitle]);


  // Predictions are currently always open (start-lock disabled)
  const tossTime = data?.match?.tossTime ? new Date(data.match.tossTime) : null;
  const isLocked = tossTime ? (new Date() > new Date(tossTime.getTime() - 30 * 60000)) : false;

  const { data: leagueSections } = useAllMatchPredictions(id || '');
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

      return (getUserDisplayName(a.user) || '').localeCompare(getUserDisplayName(b.user) || '');
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
    // Render 2-option choices and 3-option toggles using the side-by-side button layout
    const isBinary = isChoice && (options.length === 2 || (q.answer_type === 'toggle' && options.length === 3));

    if (isBinary) {
      const isMatchWinner = q.key === winnerQId;
      return (
        <div key={q.key} className={`space-y-3 ${isMatchWinner ? 'col-span-full' : ''}`}>
          <div className="flex items-center justify-between mb-1 px-1">
            <label className="block text-gray-300 font-display tracking-wide uppercase text-xs">
              {q.question_text}
              {error && <span className="ml-2 text-red-500 text-[10px] animate-pulse">(! Required)</span>}
            </label>
            {q.source_name && q.source_name !== 'IPL Global' && (
              <span className="text-[8px] bg-ipl-gold/10 text-ipl-gold px-1.5 py-0.5 rounded-full border border-ipl-gold/20 font-bold uppercase tracking-tighter">
                {q.source_name} League
              </span>
            )}
            {q.allow_powerup === false && (
              <span className="text-[8px] bg-white/5 text-gray-500 px-1.5 py-0.5 rounded-full border border-white/10 font-bold uppercase tracking-tighter ml-1.5">
                No Booster
              </span>
            )}
          </div>
          <div className={`grid ${options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-4 ${isLocked ? 'pointer-events-none opacity-80' : ''}`}>
            {options.map((opt: string) => (
              <label key={opt} className="cursor-pointer select-none">
                <input type="radio" value={opt} {...register(registerName, { required: true })} className="peer sr-only" disabled={isLocked} />
                <div
                  className={`team-select-button min-h-[44px] flex items-center justify-center p-4 border-2 text-center font-display transition-all rounded-[18px] active:scale-[0.97] duration-150 ${isMatchWinner ? 'text-lg md:text-xl' : 'text-xs md:text-sm'}`}
                  style={{
                    '--team-color': getTeamColor(opt),
                    '--team-text-color': getContrastColor(getTeamColor(opt)),
                    borderColor: error ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                    color: error ? 'rgba(239, 68, 68, 0.5)' : 'rgba(156, 163, 175, 1)'
                  } as any}
                >
                  {opt}
                </div>
              </label>
            ))}
          </div>
          <style>{`
            .team-select-button { transition: all 0.2s ease; }
            input:checked + .team-select-button {
              background-color: var(--team-color) !important;
              border-color: var(--team-color) !important;
              color: var(--team-text-color) !important;
              box-shadow: 0 8px 24px var(--team-color)40 !important;
            }
          `}</style>
        </div>
      );
    }

    const isFullWidth = ['free_text', 'player_name', 'text'].includes(q.answer_type);

    return (
      <div key={q.key} className={`space-y-2 ${isFullWidth ? 'col-span-full' : ''}`}>
        <div className="flex items-center justify-between mb-1 px-1">
          <label className="block text-gray-300 font-display tracking-wide uppercase text-xs">
            {q.question_text}
            {error && <span className="ml-2 text-red-500 text-[10px] animate-pulse">(! Required)</span>}
          </label>
          {q.source_name && q.source_name !== 'IPL Global' && (
            <span className="text-[8px] bg-ipl-gold/10 text-ipl-gold px-1.5 py-0.5 rounded-full border border-ipl-gold/20 font-bold uppercase tracking-tighter">
              {q.source_name} League
            </span>
          )}
          {q.allow_powerup === false && (
            <span className="text-[8px] bg-white/5 text-gray-500 px-1.5 py-0.5 rounded-full border border-white/10 font-bold uppercase tracking-tighter ml-1.5">
              No Booster
            </span>
          )}
        </div>

        {q.answer_type === 'dropdown' || (options.length > 2 && !(q.answer_type === 'toggle' && options.length === 3)) ? (
          <div className="relative">
            <select
              {...register(registerName, { required: true })}
              disabled={isLocked}
              className={`w-full bg-white/5 border border-white/10 rounded-[18px] p-4 text-white font-display text-base md:text-sm focus:outline-none focus:border-ipl-gold focus:bg-white/10 transition-all appearance-none disabled:opacity-50 shadow-inner ${error ? 'border-red-500/50' : 'border-white/10'}`}
            >
              <option value="" className="bg-ipl-navy">Select Option</option>
              {q.options?.map((opt: string) => (
                <option key={opt} value={opt} className="bg-ipl-navy">{opt}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        ) : q.answer_type === 'multiple_choice' ? (
          <div className={`grid grid-cols-2 gap-3 ${isLocked ? 'pointer-events-none opacity-80' : ''}`}>
            {q.options?.map((opt: string) => (
              <label key={opt} className="cursor-pointer select-none">
                <input type="radio" value={opt} {...register(registerName, { required: true })} className="peer sr-only" disabled={isLocked} />
                <div className={`p-4 border border-white/10 rounded-[18px] text-center font-display text-xs transition-all peer-checked:bg-ipl-gold peer-checked:text-black peer-checked:border-ipl-gold peer-checked:shadow-[0_4px_16px_rgba(255,215,0,0.25)] active:scale-[0.97] active:bg-white/10 text-gray-400 bg-white/5 shadow-inner`}>
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
            className={`w-full bg-white/5 border border-white/10 rounded-[18px] p-4 text-white font-display text-base md:text-sm focus:outline-none focus:border-ipl-gold focus:bg-white/10 transition-all disabled:opacity-50 shadow-inner ${error ? 'border-red-500/50' : 'border-white/10'}`}
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

  // --- Redesigned Community Reveal Custom Icons & Helpers ---
  const getQuestionIcon = (text: string) => {
    const t = text.toLowerCase();
    if (t.includes('powerplay') || t.includes('power play') || t.includes('pp')) {
      return <img src="/icons/pp_score_icon.png" alt="PP Score" className="w-8 h-8 object-contain transition-transform group-hover:scale-110 duration-300" />;
    }
    if (t.includes('player') || t.includes('potm') || t.includes('man of')) {
      return <Trophy className="w-8 h-8 text-ipl-gold transition-transform group-hover:scale-110 duration-300" />;
    }
    if (t.includes('six')) {
      return <img src="/icons/more_sixes_icon.png" alt="More Sixes" className="w-8 h-8 object-contain transition-transform group-hover:scale-110 duration-300" />;
    }
    if (t.includes('four')) {
      return <img src="/icons/more_fours_icon.png" alt="More Fours" className="w-8 h-8 object-contain transition-transform group-hover:scale-110 duration-300" />;
    }
    if (t.includes('dot')) {
      return <img src="/icons/dot_ball_icon.png" alt="Dot Balls" className="w-8 h-8 object-contain transition-transform group-hover:scale-110 duration-300" />;
    }
    return <Target className="w-8 h-8 text-ipl-gold transition-transform group-hover:scale-110 duration-300" />;
  };

  const getShortQuestionText = (text: string) => {
    if (!text) return '';
    let s = text;
    if (match) {
      if (match.team1) {
        s = s.replace(new RegExp(match.team1.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi'), getTeamShortName(match.team1));
      }
      if (match.team2) {
        s = s.replace(new RegExp(match.team2.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi'), getTeamShortName(match.team2));
      }
    }
    s = s.replace(/powerplay/gi, 'PP');
    s = s.replace(/power play/gi, 'PP');
    s = s.replace(/player of the match/gi, 'POTM');
    s = s.replace(/most dot balls/gi, 'MOST DOT BALLS');
    s = s.replace(/more sixes/gi, 'MORE SIXES');
    s = s.replace(/more fours/gi, 'MORE FOURS');
    s = s.replace(/\?/g, '');
    return s.toUpperCase();
  };

  const getContrastColor = (hexColor: string) => {
    if (!hexColor || hexColor.startsWith('var')) return 'white';
    const hex = hexColor.replace('#', '');
    if (hex.length !== 6) return 'white';
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
  };

  const getHeaderIcon = (text: string) => {
    if (!text) return <Target className="w-[18px] h-[18px] text-ipl-gold" />;
    const t = text.toLowerCase();
    if (t.includes('winner') || t.includes('win the match')) {
      return <Trophy className="w-[18px] h-[18px] text-ipl-gold" />;
    }
    if (t.includes('player of the match') || t.includes('potm')) {
      return <Trophy className="w-[18px] h-[18px] text-ipl-gold" />;
    }
    if (t.includes('powerplay') || t.includes('power play')) {
      return <img src="/icons/pp_score_icon.png" alt="PP" className="w-[18px] h-[18px] object-contain" />;
    }
    if (t.includes('sixes')) {
      return <img src="/icons/more_sixes_icon.png" alt="Sixes" className="w-[18px] h-[18px] object-contain" />;
    }
    if (t.includes('fours')) {
      return <img src="/icons/more_fours_icon.png" alt="Fours" className="w-[18px] h-[18px] object-contain" />;
    }
    if (t.includes('dot')) {
      return <img src="/icons/dot_ball_icon.png" alt="Dot" className="w-[18px] h-[18px] object-contain" />;
    }
    return <Target className="w-[18px] h-[18px] text-ipl-gold" />;
  };

  const getHeaderSubLabel = (text: string) => {
    if (!text) return '';
    const t = text.toLowerCase();

    if (match) {
      if (match.team1 && t.includes(match.team1.toLowerCase())) {
        return getTeamShortName(match.team1);
      }
      if (match.team2 && t.includes(match.team2.toLowerCase())) {
        return getTeamShortName(match.team2);
      }
    }

    if (t.includes('sixes')) return '6S';
    if (t.includes('fours')) return '4S';
    if (t.includes('dot')) return 'DOT';
    if (t.includes('potm') || t.includes('player of the match')) return 'POTM';
    return '';
  };

  const getMajorityGuess = (predictions: any[], qKey: string) => {
    if (!predictions || predictions.length === 0) {
      return { guess: '-', count: 0, total: 0, pct: 0, isTie: false, countDetails: '0/0' };
    }
    const counts: Record<string, number> = {};
    let validTotal = 0;
    predictions.forEach(p => {
      const ans = p.answers?.[qKey];
      if (ans !== undefined && ans !== null && ans !== '🔒' && ans !== '') {
        counts[ans] = (counts[ans] || 0) + 1;
        validTotal++;
      }
    });

    if (validTotal === 0) {
      return { guess: '-', count: 0, total: 0, pct: 0, isTie: false, countDetails: `0/${predictions.length}` };
    }

    let maxCount = 0;
    let winners: string[] = [];

    Object.entries(counts).forEach(([val, count]) => {
      if (count > maxCount) {
        maxCount = count;
        winners = [val];
      } else if (count === maxCount) {
        winners.push(val);
      }
    });

    if (winners.length > 1) {
      const sortedWinners = winners.map(w => getTeamShortName(w)).join(' & ');
      return {
        guess: sortedWinners,
        count: maxCount,
        total: predictions.length,
        pct: Math.round((maxCount / predictions.length) * 100),
        isTie: true,
        countDetails: `${maxCount}/${predictions.length} EACH`
      };
    }

    return {
      guess: getTeamShortName(winners[0]),
      count: maxCount,
      total: predictions.length,
      pct: Math.round((maxCount / predictions.length) * 100),
      isTie: false,
      countDetails: `${maxCount}/${predictions.length}`
    };
  };

  const getCellColorByQuestion = (val: any, qText: string) => {
    const valStr = String(val);
    const colorVal = getAccessibleTeamTextColor(valStr);
    if (colorVal && colorVal !== '#ffffff') {
      return { color: colorVal, fontWeight: 'black' as const };
    }

    // Check if the question text contains a team name (e.g. "SRH Power Play Score")
    const qWords = qText.split(/\s+/);
    for (const word of qWords) {
      const cleanWord = word.replace(/[^a-zA-Z]/g, '');
      const colorQ = getAccessibleTeamTextColor(cleanWord);
      if (colorQ && colorQ !== '#ffffff') {
        return { color: colorQ, fontWeight: 'bold' as const };
      }
    }
    return { color: '#ffffff' };
  };

  const getHeaderStyle = (text: string) => {
    const words = text.split(/\s+/);
    for (const word of words) {
      const cleanWord = word.replace(/[^a-zA-Z]/g, '');
      const color = getAccessibleTeamTextColor(cleanWord);
      if (color && color !== '#ffffff') {
        return { color };
      }
    }
    return { color: '#a0aec0' };
  };

  const generateCommunityInsight = (predictions: any[], questionsList: any[], team1: string, team2: string) => {
    if (!predictions || predictions.length === 0) return '';

    const total = predictions.length;
    const t1Short = getTeamShortName(team1);
    const t2Short = getTeamShortName(team2);

    // Find winner question majority
    const winnerQ = questionsList.find((q: any) => {
      const opts = q.options || [];
      return opts.length === 2 && opts.includes(team1) && opts.includes(team2);
    });

    let winnerWinner = '';
    let winnerCount = 0;
    if (winnerQ) {
      const maj = getMajorityGuess(predictions, winnerQ.key);
      winnerWinner = maj.guess;
      winnerCount = maj.count;
    }

    // Now look for other questions
    let sixesWinner = '';
    let sixesCount = 0;
    let foursWinner = '';
    let foursCount = 0;

    questionsList.forEach((q: any) => {
      const text = q.question_text.toLowerCase();
      const maj = getMajorityGuess(predictions, q.key);

      if (text.includes('sixes')) {
        sixesWinner = maj.guess;
        sixesCount = maj.count;
      } else if (text.includes('fours')) {
        foursWinner = maj.guess;
        foursCount = maj.count;
      }
    });

    // Calculate average PP predictions
    let t1PPSum = 0;
    let t1PPCount = 0;
    let t2PPSum = 0;
    let t2PPCount = 0;

    questionsList.forEach((q: any) => {
      const text = q.question_text.toLowerCase();
      if (text.includes('powerplay') || text.includes('power play') || text.includes('pp')) {
        predictions.forEach(p => {
          const ans = parseFloat(p.answers?.[q.key]);
          if (!isNaN(ans)) {
            if (text.includes(team1.toLowerCase()) || text.includes(t1Short.toLowerCase())) {
              t1PPSum += ans;
              t1PPCount++;
            } else if (text.includes(team2.toLowerCase()) || text.includes(t2Short.toLowerCase())) {
              t2PPSum += ans;
              t2PPCount++;
            }
          }
        });
      }
    });

    const t1PPAvg = t1PPCount > 0 ? t1PPSum / t1PPCount : 0;
    const t2PPAvg = t2PPCount > 0 ? t2PPSum / t2PPCount : 0;

    let part1 = '';
    if (winnerWinner === t1Short) {
      part1 = `${t1Short} FANS ARE CONFIDENT! ${winnerCount} OUT OF ${total} PREDICT A ${t1Short} WIN`;
    } else if (winnerWinner === t2Short) {
      part1 = `${t2Short} FANS ARE CONFIDENT! ${winnerCount} OUT OF ${total} PREDICT A ${t2Short} WIN`;
    } else {
      part1 = `OPINIONS ARE SPLIT ON THE MATCH OUTCOME`;
    }

    const supportsT1: string[] = [];
    const supportsT2: string[] = [];

    if (sixesWinner === t1Short && sixesCount > total / 2) supportsT1.push('sixes');
    if (sixesWinner === t2Short && sixesCount > total / 2) supportsT2.push('sixes');
    if (foursWinner === t1Short && foursCount > total / 2) supportsT1.push('fours');
    if (foursWinner === t2Short && foursCount > total / 2) supportsT2.push('fours');
    if (t1PPAvg > t2PPAvg + 2) supportsT1.push('power play expectations');
    if (t2PPAvg > t1PPAvg + 2) supportsT2.push('power play expectations');

    let part2 = '';
    if (winnerWinner === t1Short) {
      if (supportsT2.length > 0) {
        part2 = `, BUT ${t2Short} FANS LEAD IN ${supportsT2.join(' & ')}!`;
      } else {
        part2 = `, WITH WIDE SUPPORT FOR ${t1Short} ACROSS OTHER CATEGORIES TOO!`;
      }
    } else if (winnerWinner === t2Short) {
      if (supportsT1.length > 0) {
        part2 = `, BUT ${t1Short} FANS LEAD IN ${supportsT1.join(' & ')}!`;
      } else {
        part2 = `, WITH WIDE SUPPORT FOR ${t2Short} ACROSS OTHER CATEGORIES TOO!`;
      }
    } else {
      part2 = `! SIXES, FOURS AND POWER PLAY PREDICTIONS ARE HIGHLY COMPETITIVE.`;
    }

    return `${part1}${part2}`.toUpperCase();
  };

  const generatePostMatchInsight = (predictions: any[], questionsList: any[], results: any, winnerQId: string | null) => {
    if (!predictions || predictions.length === 0 || !results) return '';

    const total = predictions.length;

    let winnerWinner = '';
    let winnerCount = 0;
    if (winnerQId) {
      const maj = getMajorityGuess(predictions, winnerQId);
      winnerWinner = maj.guess;
      winnerCount = maj.count;
    }

    const actualWinner = results[winnerQId || ''];
    let winnerInsight = '';
    if (actualWinner && winnerWinner) {
      const actualWinnerShort = getTeamShortName(actualWinner);
      const predictedWinnerShort = winnerWinner; // already short
      const percent = Math.round((winnerCount / total) * 100);

      if (actualWinnerShort === predictedWinnerShort) {
        winnerInsight = `THE COMMUNITY GOT IT RIGHT! ${actualWinnerShort} CLINCHED THE VICTORY, JUST AS ${percent}% OF PREDICTORS FORESAW.`;
      } else {
        winnerInsight = `THE COMMUNITY WAS PROVED WRONG! ${actualWinnerShort} DEFIED THE ODDS, STUNNING THE ${percent}% OF PREDICTORS WHO BACKED ${predictedWinnerShort}.`;
      }
    } else if (actualWinner) {
      winnerInsight = `${getTeamShortName(actualWinner)} CLINCHED THE VICTORY IN THIS MATCH.`;
    }

    // Check sixes/fours if they exist in questions and results
    let otherInsights: string[] = [];
    questionsList.forEach((q: any) => {
      const text = q.question_text.toLowerCase();
      const actualVal = results[q.key];
      if (!actualVal) return;

      const maj = getMajorityGuess(predictions, q.key);
      const predictedVal = maj.guess;
      const percent = Math.round((maj.count / total) * 100);

      if (text.includes('sixes')) {
        if (getTeamShortName(actualVal) === predictedVal) { // predictedVal is already short
          otherInsights.push(`THE COMMUNITY ACCURATELY NAILED THE SIXES WINNER WITH ${percent}% PREDICTING ${getTeamShortName(actualVal)}`);
        } else {
          otherInsights.push(`${getTeamShortName(actualVal)} SURPRISED THE ${percent}% WHO EXPECTED ${predictedVal} TO DOMINATE THE SIXES`);
        }
      } else if (text.includes('fours')) {
        if (getTeamShortName(actualVal) === predictedVal) {
          otherInsights.push(`THE COMMUNITY WAS CORRECT ON THE FOURS WINNER WITH ${percent}% PREDICTING ${getTeamShortName(actualVal)}`);
        } else {
          otherInsights.push(`${getTeamShortName(actualVal)} COUNTERED THE ${percent}% OF FOURS PREDICTIONS FOR ${predictedVal}`);
        }
      }
    });

    let finalInsight = winnerInsight;
    if (otherInsights.length > 0) {
      finalInsight += ' ' + otherInsights.join('. ') + '.';
    }
    return finalInsight.toUpperCase();
  };

  return (
    <div className="w-full max-w-full px-2 md:px-6 pb-20 space-y-0 md:space-y-8 max-md:glass-panel max-md:p-2 max-md:border-b-[4px] max-md:border-ipl-gold max-md:rounded-2xl">
      {/* Desktop Match Card Header */}
      <div className="hidden md:block text-center relative overflow-hidden md:glass-panel md:p-8 md:border-b-[4px] md:border-ipl-gold">
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

      {/* Mobile-optimized Compact Match Header */}
      <div className="md:hidden flex flex-col items-center gap-2.5 w-full pb-4 border-b border-white/10">
        {/* Team Matchup Row (Hidden on mobile as it's shown in header title) */}
        <div className="hidden items-center justify-center gap-3 w-full px-2 mt-1">
          {/* Team 1 Logo & Shortname */}
          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
            <span className="text-base font-display font-bold truncate" style={{ color: getTeamColor(match.team1) }}>
              {getTeamShortName(match.team1)}
            </span>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border bg-black/40 p-1 shrink-0"
              style={{ borderColor: `${getTeamColor(match.team1)}40`, boxShadow: `0 0 15px ${getTeamColor(match.team1)}15` }}
            >
              {getTeamLogo(match.team1) ? (
                <img src={getTeamLogo(match.team1)!} alt={match.team1} className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs font-display text-white">{getTeamShortName(match.team1)}</span>
              )}
            </div>
          </div>

          {/* VS Separator */}
          <span className="text-gray-500 font-display text-sm italic tracking-wider opacity-60">VS</span>

          {/* Team 2 Logo & Shortname */}
          <div className="flex items-center gap-2 flex-1 justify-start min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border bg-black/40 p-1 shrink-0"
              style={{ borderColor: `${getTeamColor(match.team2)}40`, boxShadow: `0 0 15px ${getTeamColor(match.team2)}15` }}
            >
              {getTeamLogo(match.team2) ? (
                <img src={getTeamLogo(match.team2)!} alt={match.team2} className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs font-display text-white">{getTeamShortName(match.team2)}</span>
              )}
            </div>
            <span className="text-base font-display font-bold truncate" style={{ color: getTeamColor(match.team2) }}>
              {getTeamShortName(match.team2)}
            </span>
          </div>
        </div>

        {/* Metadata Text Row */}
        <div className="flex items-center justify-center gap-1.5 text-[9px] font-display uppercase tracking-wider text-gray-400 bg-white/5 border border-white/5 py-1 px-3 rounded-full w-fit">
          <span className="font-bold text-white">M{matchNumber}</span>
          <span className="text-white/20">•</span>
          <span className="flex items-center gap-0.5 truncate max-w-[120px]">
            <MapPin className="w-2.5 h-2.5 text-ipl-gold shrink-0" />
            <span className="truncate">{match.venue}</span>
          </span>
          <span className="text-white/20">•</span>
          <span className="flex items-center gap-0.5 text-gray-300">
            ⚡ <span className="font-bold text-white">{powerupsLeft}/{totalPowerups}</span>
          </span>
          <span className="text-white/20">•</span>
          <span className={`font-bold ${isLocked ? 'text-ipl-live' : 'text-ipl-gold'}`}>
            {isLocked ? 'CLOSED' : 'OPEN'}
          </span>
        </div>
      </div>

      {match.status === 'completed' && (
        <div className="md:glass-panel md:p-8 md:border-t-4 md:border-t-ipl-gold md:shadow-[0_20px_50px_rgba(244,196,48,0.1)] md:animate-in md:fade-in md:slide-in-from-top-4 md:duration-1000 max-md:py-6 max-md:border-b max-md:border-white/10">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-ipl-gold/10 rounded-lg">
              <Trophy className="w-6 h-6 text-ipl-gold" />
            </div>
            <h2 className="text-2xl font-display text-white italic tracking-tighter">OFFICIAL MATCH RESULTS</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
            <div
              className="bg-white/5 p-3 md:p-6 border relative overflow-hidden group transition-all col-span-2 md:col-span-1 rounded-2xl"
              style={{
                borderColor: match?.results?.[winnerQId] ? `${getTeamColor(match.results[winnerQId])}40` : 'rgba(255,255,255,0.1)',
                boxShadow: match?.results?.[winnerQId] ? `0 0 20px ${getTeamColor(match.results[winnerQId])}15` : 'none'
              }}
            >
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <CheckCircle2 className="w-24 h-24 text-ipl-gold" />
              </div>
              <label className="block text-[9px] md:text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] mb-2 md:mb-4">Official Winner</label>
              <div className="text-2xl md:text-3xl font-display tracking-widest uppercase flex items-center gap-3 md:gap-4">
                {match?.results?.[winnerQId] && getTeamLogo(match.results[winnerQId]) && (
                  <img src={getTeamLogo(match.results[winnerQId])!} alt="" className="w-8 h-8 md:w-10 md:h-10 object-contain" />
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
              const label = q ? getShortQuestionText(q.question_text) : 'Result';

              const val = match.results[k];
              const teamColorVal = getAccessibleTeamTextColor(val);
              const isTeamMatch = teamColorVal !== '#ffffff';
              const valStyle = isTeamMatch ? { color: teamColorVal } : { color: 'white' };
              const displayVal = getTeamShortName(val);
              const isLongValue = displayVal.length > 8;
              const valFontClass = isLongValue ? "text-[13px] md:text-lg leading-tight" : "text-base md:text-2xl";

              return (
                <div key={k} className="bg-white/5 p-2.5 md:p-5 border border-white/10 relative overflow-hidden group flex flex-col justify-center items-center rounded-2xl">
                  <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Target className="w-24 h-24 text-ipl-gold" />
                  </div>
                  <label className="block text-[7.5px] md:text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] mb-1.5 md:mb-2.5 text-center">{label}</label>
                  <div className={`font-display tracking-wide uppercase text-center ${valFontClass}`} style={valStyle}>
                    {displayVal}
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
        <div className="md:glass-panel md:p-8 max-md:py-6 max-md:border-b max-md:border-white/10">
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
                  {/* <div className="flex items-center gap-3 border-l-4 border-ipl-gold pl-4 mb-4">
                    <h3 className="text-lg font-display text-white tracking-widest uppercase italic">
                      {source === 'IPL Global' ? (
                        <>IPL Global <span className="text-ipl-gold not-italic">Questions</span></>
                      ) : (
                        <><span className="text-ipl-gold not-italic">League:</span> {source}</>
                      )}
                    </h3>
                  </div> */}
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
                <div className={`flex bg-white/5 p-1 rounded-2xl border border-white/10 w-full ${isLocked ? 'pointer-events-none opacity-80' : ''}`}>
                  <label className={`flex-1 cursor-pointer select-none ${(powerupsLeft <= 0 && myPredictions?.use_powerup !== 'Yes') ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                    <input type="radio" value="Yes" {...register('use_powerup', { required: true })} className="peer sr-only" disabled={isLocked || (powerupsLeft <= 0 && myPredictions?.use_powerup !== 'Yes')} />
                    <div className="py-3 rounded-[12px] text-center font-display text-xs font-bold uppercase transition-all peer-checked:bg-ipl-gold peer-checked:text-black text-gray-400 select-none">
                      YES (Booster 2x)
                    </div>
                  </label>
                  <label className="flex-1 cursor-pointer select-none">
                    <input type="radio" value="No" {...register('use_powerup', { required: true })} className="peer sr-only" disabled={isLocked} />
                    <div className="py-3 rounded-[12px] text-center font-display text-xs font-bold uppercase transition-all peer-checked:bg-white/10 peer-checked:text-white text-gray-400 select-none">
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
                  className="w-full bg-white text-ipl-navy rounded-2xl font-display font-bold uppercase tracking-widest py-4 transition-all active:scale-[0.98] disabled:bg-white/10 disabled:text-white/40 disabled:border-white/10 disabled:scale-100 shadow-[0_8px_20px_rgba(255,255,255,0.05)]"
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
      <div className="space-y-6 md:space-y-12 max-md:space-y-0">
        {!leagueSections || leagueSections.length === 0 ? (
          <div className="md:glass-panel md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-md:py-10 max-md:border-b max-md:border-white/10 last:max-md:border-b-0">
            <div className="text-center py-10 text-gray-500 font-display tracking-widest text-[10px] uppercase">
              NO PREDICTIONS FOUND FOR THIS MATCH
            </div>
          </div>
        ) : (
          leagueSections.map((section: any) => {
            const allPredictions = section.predictions;
            const sortedPredictions = getSortedPredictions(allPredictions);

            // Filter relevant questions for this league section (exclude powerup and winner Q since it is shown as badge next to name)
            const relevantQuestions = questions.filter((q: any) =>
              q.key !== 'use_powerup' &&
              q.key !== winnerQId &&
              (!q.league_id || q.league_id === section.league.id)
            );
            // Count predictors for each team
            const t1Predictors = allPredictions.filter((p: any) => winnerQId && p.answers[winnerQId] === match.team1).length;
            const t2Predictors = allPredictions.filter((p: any) => winnerQId && p.answers[winnerQId] === match.team2).length;

            return (
              <div key={section.league.id} className="md:glass-panel md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-2 md:space-y-6 max-md:py-2 max-md:border-b max-md:border-white/10 last:max-md:border-b-0">

                {/* Header */}
                <div className="flex flex-col gap-1.5 md:gap-4">
                  <div className="text-center py-0 md:py-2">
                    <h2 className="text-xs md:text-2xl font-display font-black text-white italic tracking-tighter uppercase">
                      {section.league.name === 'IPL Global' ? (
                        <>GLOBAL <span className="text-ipl-gold">| REVEAL</span></>
                      ) : (
                        <>{section.league.name} <span className="text-ipl-gold">| REVEAL</span></>
                      )}
                    </h2>
                  </div>

                  {/* Team Predictors Count Bar */}
                  <div className="flex items-center justify-between gap-1 md:gap-4 bg-black/40 border border-white/10 rounded-lg md:rounded-2xl p-0.5 md:p-2 select-none">
                    {/* Team 1 Predictors */}
                    <div
                      className="flex-1 flex items-center justify-between px-2 py-1 md:px-6 md:py-3.5 rounded-md md:rounded-xl transition-all duration-300"
                      style={{
                        backgroundColor: `${getTeamColor(match.team1)}15`,
                        border: `1px solid ${getTeamColor(match.team1)}40`
                      }}
                    >
                      <span className="text-[8px] md:text-xs font-display font-bold uppercase tracking-wider" style={{ color: getTeamColor(match.team1) }}>
                        {getTeamShortName(match.team1)} PREDICTORS
                      </span>
                      <span className="text-xs md:text-xl font-display font-black" style={{ color: getTeamColor(match.team1) }}>
                        {isLocked ? t1Predictors : '?'}
                      </span>
                    </div>

                    {/* Live Guesses Pill */}
                    <div className="shrink-0">
                      {isLocked ? (
                        <span className="bg-ipl-gold text-black text-[7px] md:text-[10px] font-display font-bold uppercase tracking-widest px-2 py-1 rounded-full shadow-[0_0_15px_rgba(255,215,0,0.3)] animate-pulse">
                          Live
                        </span>
                      ) : (
                        <span className="bg-white/5 border border-white/10 text-gray-500 text-[7px] md:text-[10px] font-display font-bold uppercase tracking-widest px-2 py-1 rounded-full">
                          Hidden
                        </span>
                      )}
                    </div>

                    {/* Team 2 Predictors */}
                    <div
                      className="flex-1 flex items-center justify-between px-2 py-1 md:px-6 md:py-3.5 rounded-md md:rounded-xl transition-all duration-300"
                      style={{
                        backgroundColor: `${getTeamColor(match.team2)}15`,
                        border: `1px solid ${getTeamColor(match.team2)}40`
                      }}
                    >
                      <span className="text-[8px] md:text-xs font-display font-bold uppercase tracking-wider" style={{ color: getTeamColor(match.team2) }}>
                        {getTeamShortName(match.team2)} PREDICTORS
                      </span>
                      <span className="text-xs md:text-xl font-display font-black" style={{ color: getTeamColor(match.team2) }}>
                        {isLocked ? t2Predictors : '?'}
                      </span>
                    </div>
                  </div>
                </div>

                {!isLocked ? (
                  /* Locked State Placeholder */
                  <div className="flex flex-col items-center justify-center py-16 text-center bg-black/20 rounded-2xl border border-white/5">
                    <div className="p-4 bg-ipl-gold/10 rounded-full border border-ipl-gold/20 mb-4 animate-pulse">
                      <Lock className="w-8 h-8 text-ipl-gold" />
                    </div>
                    <h3 className="text-lg font-display text-white mb-1 uppercase tracking-wider font-bold">Predictions Locked</h3>
                    <p className="text-gray-500 font-display text-[10px] tracking-widest max-w-sm mx-auto leading-relaxed uppercase">
                      Guesses will be revealed 30 minutes before match kickoff.
                    </p>
                  </div>
                ) : !allPredictions || allPredictions.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 font-display tracking-widest text-[10px] uppercase">
                    NO PREDICTIONS FOUND FOR THIS LEAGUE
                  </div>
                ) : (
                  <div className="space-y-4 md:space-y-6">
                    {/* Consensus Stats */}
                    <div className="flex flex-col divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden bg-black/20">
                      {relevantQuestions.map((q: any) => {
                        const stats = getMajorityGuess(allPredictions, q.key);
                        return (
                          <div
                            key={q.key}
                            className="flex items-center gap-2 px-2.5 hover:bg-white/[0.04] transition-colors"
                          >
                            <div className="shrink-0 w-5 flex items-center justify-center">
                              {getQuestionIcon(q.question_text)}
                            </div>
                            <span className="text-[9px] text-gray-400 font-display uppercase tracking-wide font-bold flex-1 min-w-0 truncate">
                              {getShortQuestionText(q.question_text)}
                            </span>
                            <span
                              className="text-[11px] font-display font-extrabold uppercase tracking-wide shrink-0"
                              style={getCellColorByQuestion(stats.guess, q.question_text)}
                            >
                              {stats.guess}
                            </span>
                            <span className="text-[8px] text-gray-500 font-mono font-bold bg-black/40 px-1.5 py-0.5 rounded border border-white/5 shrink-0 leading-none">
                              {stats.countDetails}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Predictors Grid Table */}
                    <div className="border border-white/10 rounded-2xl bg-black/20 overflow-hidden">
                      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#0f1220] border-b border-white/10">
                              <th
                                className="sticky left-0 bg-[#0f1220] z-20 px-1 py-1 md:p-3 text-[10px] md:text-xs font-display font-black text-gray-400 uppercase tracking-normal md:tracking-widest min-w-[60px] max-w-[60px] w-[60px] md:min-w-[200px] md:max-w-[200px] md:w-[200px] border-r border-white/10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]"
                                title="Predictor"
                              ><span className="hidden md:inline">PREDICTOR</span><User className="md:hidden w-4 h-4 mx-auto text-gray-400" /></th>
                              {relevantQuestions.map((q: any) => {
                                const iconImg = getHeaderIcon(q.question_text);
                                const subLabel = getHeaderSubLabel(q.question_text);
                                const style = getHeaderStyle(q.question_text);
                                const isPotm = q.question_text.toLowerCase().includes('player') || q.question_text.toLowerCase().includes('potm') || q.question_text.toLowerCase().includes('man of');
                                const isLongAnswer = q.answer_type === 'player_name' || q.answer_type === 'free_text' || q.answer_type === 'text';
                                const widthClass = isPotm
                                  ? "min-w-[48px] max-w-[48px] w-[48px] md:min-w-[140px] md:max-w-[140px] md:w-[140px]"
                                  : isLongAnswer
                                    ? "min-w-[70px] max-w-[70px] w-[70px] md:min-w-[140px] md:max-w-[140px] md:w-[140px]"
                                    : "min-w-[30px] max-w-[30px] w-[30px] md:min-w-[120px] md:max-w-[120px] md:w-[120px]";
                                return (
                                  <th
                                    key={q.key}
                                    className={`px-0.5 py-1 md:p-3 text-[10px] md:text-xs font-display font-black text-center uppercase tracking-normal md:tracking-widest ${widthClass}`}
                                    title={q.question_text}
                                  ><span className="hidden md:inline" style={style}>{getShortQuestionText(q.question_text)}</span><div className="md:hidden flex flex-col items-center gap-0">{iconImg}{subLabel && (<span className="text-[7px] font-bold tracking-tighter" style={style}>{subLabel}</span>)}</div></th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {sortedPredictions.map((pred: any) => {
                              const isMyRow = pred.user?.id === currentUser?.id;
                              const winnerAns = winnerQId ? pred.answers[winnerQId] : '🔒';
                              const teamWinnerShort = winnerAns === '🔒' ? '🔒' : getTeamShortName(winnerAns);

                              return (
                                <tr
                                  key={pred.user.id}
                                  className={`group border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors ${isMyRow ? 'bg-ipl-gold/5 shadow-[inset_4px_0_0_rgba(244,196,48,0.2)]' : ''
                                    }`}
                                >
                                  {/* Predictor Column */}
                                  <td
                                    className={`sticky left-0 z-10 px-1 py-1.5 md:p-3 border-r border-white/10 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.15)] min-w-[60px] max-w-[60px] w-[60px] md:min-w-[200px] md:max-w-[200px] md:w-[200px] select-none [-webkit-touch-callout:none] ${pred.points_breakdown?.rules ? 'cursor-pointer active:brightness-150' : ''} ${isMyRow
                                      ? 'bg-[#181a24] shadow-[inset_3px_0_0_#F4C430]'
                                      : 'bg-[#0f1220] group-hover:bg-[#141724]'
                                      }`}
                                    title={getUserDisplayName(pred.user)}
                                    onClick={() => {
                                      if (pred.points_breakdown?.rules) {
                                        setSelectedBreakdown({
                                          predictorName: getUserDisplayName(pred.user),
                                          points: pred.points_awarded ?? 0,
                                          rules: pred.points_breakdown.rules,
                                          powerupUsed: pred.points_breakdown?.powerup?.used
                                        });
                                      }
                                    }}
                                  >
                                    <div className="flex items-center justify-center md:justify-between gap-1 md:gap-2 w-full">
                                      <div className="flex items-center gap-1.5 md:gap-2.5 min-w-0 justify-center md:justify-start w-full md:w-auto">
                                        <div className="relative shrink-0">
                                          {(() => {
                                            const borderTeamColor = winnerAns !== '🔒' ? getAccessibleTeamTextColor(winnerAns) : (isMyRow ? '#F4C430' : 'rgba(255,255,255,0.1)');
                                            return (
                                              <img
                                                src={pred.user.avatar_url || `https://ui-avatars.com/api/?name=${pred.user.name}&background=0B0E1A&color=F4C430`}
                                                className="w-6 h-6 md:w-8 md:h-8 rounded-full border-[3px] md:border-[4px] object-cover"
                                                style={{
                                                  borderColor: borderTeamColor,
                                                  boxShadow: winnerAns !== '🔒' ? `0 0 8px ${borderTeamColor}80` : 'none'
                                                }}
                                                alt={getUserDisplayName(pred.user)}
                                              />
                                            );
                                          })()}
                                          {pred.answers.use_powerup === 'Yes' && (
                                            <span
                                              className="absolute -top-1.5 -right-1.5 bg-ipl-gold text-black rounded-full w-3.5 h-3.5 flex items-center justify-center font-black text-[8px] shadow-[0_0_8px_rgba(255,215,0,0.5)] border border-ipl-navy"
                                              title="2X Booster Applied"
                                            >
                                              ⚡
                                            </span>
                                          )}
                                          {pred.is_auto_predicted && (
                                            <span
                                              className="md:hidden absolute -bottom-1 -left-1 bg-[#7B2FF7] text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-black text-[8px] shadow-[0_0_8px_rgba(123,47,247,0.5)] border border-ipl-navy"
                                              title="AI Auto Predicted"
                                            >
                                              <Sparkles className="w-2 h-2 shrink-0" />
                                            </span>
                                          )}

                                          {/* Points Badge Overlay - bottom of avatar */}
                                          {match.status === 'completed' && pred.points_awarded !== undefined && pred.points_awarded !== null && (
                                            <span
                                              className="absolute -bottom-1.5 -left-1 px-1 py-0.5 rounded-full text-[6.5px] font-mono font-black border border-ipl-navy cursor-pointer shadow-md select-none leading-none text-white"
                                              style={{
                                                backgroundColor: pred.points_awarded > 0
                                                  ? '#10B981'
                                                  : pred.points_awarded < 0
                                                    ? '#EF4444'
                                                    : '#4B5563',
                                                borderColor: '#0B0E1A'
                                              }}
                                            >
                                              {pred.points_awarded > 0 ? '+' : ''}{pred.points_awarded}
                                            </span>
                                          )}

                                        </div>
                                        <div className="hidden md:flex flex-col min-w-0">
                                          <span className={`text-[11px] md:text-xs font-bold leading-tight truncate ${isMyRow ? 'text-ipl-gold font-extrabold' : 'text-white'
                                            }`}>
                                            {getUserDisplayName(pred.user)}
                                          </span>
                                          {pred.is_auto_predicted && (
                                            <span className="text-[7px] md:text-[8px] text-[#7B2FF7] font-bold flex items-center gap-0.5 mt-0.5 select-none leading-none">
                                              <Sparkles className="w-1.5 h-1.5 md:w-2 md:h-2 shrink-0" /> AI AUTO
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Right side: Winner Badge & Points Indicator */}
                                      <div className="flex items-center gap-0.5 md:gap-1.5 shrink-0">
                                        {winnerQId && winnerAns !== '🔒' && (
                                          <span
                                            className="hidden md:inline-block px-1.5 py-0.5 rounded text-[7px] md:text-[8px] font-black uppercase tracking-wider border border-white/10 select-none leading-none shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
                                            style={{
                                              backgroundColor: getTeamColor(winnerAns),
                                              color: getContrastColor(getTeamColor(winnerAns))
                                            }}
                                          >
                                            {teamWinnerShort}
                                          </span>
                                        )}


                                      </div>
                                    </div>
                                  </td>

                                  {/* Answer Columns */}
                                  {relevantQuestions.map((q: any) => {
                                    const val = pred.answers[q.key];
                                    const isEditing = editingId === `${pred.prediction_id}:${q.key}`;
                                    const isPotm = q.question_text.toLowerCase().includes('player') || q.question_text.toLowerCase().includes('potm') || q.question_text.toLowerCase().includes('man of');
                                    const isLongAnswer = q.answer_type === 'player_name' || q.answer_type === 'free_text' || q.answer_type === 'text';
                                    const widthClass = isPotm
                                      ? "min-w-[48px] max-w-[48px] w-[48px] md:min-w-[140px] md:max-w-[140px] md:w-[140px]"
                                      : isLongAnswer
                                        ? "min-w-[70px] max-w-[70px] w-[70px] md:min-w-[140px] md:max-w-[140px] md:w-[140px]"
                                        : "min-w-[30px] max-w-[30px] w-[30px] md:min-w-[120px] md:max-w-[120px] md:w-[120px]";
                                    const cellTextClass = isLongAnswer
                                      ? "whitespace-normal break-words text-[7px] md:text-xs leading-tight"
                                      : "whitespace-nowrap text-xs md:text-sm";

                                    return (
                                      <td key={q.key} className={`px-1 py-1.5 md:p-3 text-center border-b border-white/5 ${cellTextClass} ${widthClass}`}>
                                        {isEditing ? (
                                          <div className="flex items-center gap-1 justify-center" onClick={(e) => e.stopPropagation()}>
                                            <input
                                              value={editValue}
                                              onChange={(e) => setEditValue(e.target.value)}
                                              className="bg-black/60 border border-white/20 text-white px-2 py-1 text-xs w-20 focus:border-ipl-gold focus:outline-none font-mono rounded"
                                              autoFocus
                                            />
                                            <button
                                              onClick={() => handleAdminUpdate(pred.prediction_id, q.key)}
                                              className="text-green-500 hover:bg-white/10 rounded p-0.5 shrink-0"
                                            >
                                              <Check className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              onClick={() => setEditingId(null)}
                                              className="text-red-500 hover:bg-white/10 rounded p-0.5 shrink-0"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="group flex items-center justify-center gap-1.5 relative w-full">
                                            <span style={getCellColorByQuestion(val, q.question_text)} className="w-full text-center">
                                              {val !== '🔒' ? getTeamShortName(val) || '-' : '🔒'}
                                            </span>
                                            {currentUser?.is_admin && pred.prediction_id && val !== '🔒' && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setEditingId(`${pred.prediction_id}:${q.key}`);
                                                  setEditValue(val || '');
                                                }}
                                                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-ipl-gold transition-all shrink-0 ml-1 absolute right-0 bg-[#0f1220]/80 p-0.5 rounded"
                                                title="Edit prediction value"
                                              >
                                                <Edit2 className="w-3 h-3" />
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Community or Post-Match Insight */}
                    {match.status === 'completed' ? (
                      generatePostMatchInsight(allPredictions, questions, match.results, winnerQId) && (
                        <div className="glass-panel p-4 bg-gradient-to-r from-ipl-live/5 via-white/5 to-transparent border border-ipl-live/20 rounded-2xl flex items-start gap-4">
                          <div className="p-2.5 bg-ipl-live/10 rounded-xl border border-ipl-live/20 shrink-0">
                            <Trophy className="w-5 h-5 text-ipl-live animate-pulse" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-xs font-display font-black text-ipl-live uppercase tracking-wider">
                              Post-Match Insight
                            </h4>
                            <p className="text-[11px] md:text-xs font-display text-gray-300 font-bold uppercase tracking-wide leading-relaxed">
                              {generatePostMatchInsight(allPredictions, questions, match.results, winnerQId)}
                            </p>
                          </div>
                        </div>
                      )
                    ) : (
                      generateCommunityInsight(allPredictions, questions, match.team1, match.team2) && (
                        <div className="glass-panel p-4 bg-gradient-to-r from-ipl-gold/5 via-white/5 to-transparent border border-ipl-gold/10 rounded-2xl flex items-start gap-4">
                          <div className="p-2.5 bg-ipl-gold/10 rounded-xl border border-ipl-gold/20 shrink-0">
                            <Trophy className="w-5 h-5 text-ipl-gold animate-pulse" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-xs font-display font-black text-ipl-gold uppercase tracking-wider">
                              Community Insight
                            </h4>
                            <p className="text-[11px] md:text-xs font-display text-gray-300 font-bold uppercase tracking-wide leading-relaxed">
                              {generateCommunityInsight(allPredictions, questions, match.team1, match.team2)}
                            </p>
                          </div>
                        </div>
                      )
                    )}
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

      {/* Points Breakdown Bottom Overlay */}
      {selectedBreakdown && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedBreakdown(null)}
          />
          {/* Drawer Panel */}
          <div className="relative w-full max-w-md bg-[#0f172a]/95 backdrop-blur-md border-t border-white/10 rounded-t-3xl shadow-2xl p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Drawer handle pull-bar */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5" />

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <span className="text-[10px] font-display uppercase tracking-widest text-ipl-gold font-bold">
                  Points Breakdown
                </span>
                <h3 className="text-white font-display text-base tracking-tight mt-0.5">
                  {selectedBreakdown.predictorName}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded font-mono font-bold text-sm ${selectedBreakdown.points > 0
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : selectedBreakdown.points < 0
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-white/10 text-gray-400 border border-white/20'
                  }`}>
                  {selectedBreakdown.points > 0 ? '+' : ''}{selectedBreakdown.points} PTS
                </span>
                <button
                  onClick={() => setSelectedBreakdown(null)}
                  className="p-1.5 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Rules Breakdown List */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {selectedBreakdown.rules.map((rule: any, idx: number) => {
                const isRuleCorrect = rule.status === 'correct' || rule.status === 'bingo';
                const isRuleRange = rule.status === 'range';
                return (
                  <div key={idx} className="flex justify-between items-center bg-white/5 border border-white/5 p-3 rounded-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      {rule.was_boosted && <span className="text-ipl-gold shrink-0 text-xs">⚡</span>}
                      <div className="shrink-0">
                        {isRuleCorrect ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : isRuleRange ? (
                          <Target className="w-4 h-4 text-blue-400" />
                        ) : (
                          <X className="w-4 h-4 text-red-400 opacity-60" />
                        )}
                      </div>
                      <span className="text-gray-200 font-display text-xs uppercase tracking-wide truncate">
                        {rule.category}
                      </span>
                    </div>
                    <span className={`font-mono font-bold text-xs ${rule.points > 0 ? 'text-green-400' : rule.points < 0 ? 'text-red-400' : 'text-gray-500'
                      }`}>
                      {rule.points > 0 ? '+' : ''}{rule.points}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Powerup Footer */}
            {selectedBreakdown.powerupUsed && (
              <div className="mt-4 p-3 bg-ipl-gold/10 border border-ipl-gold/20 rounded-xl flex justify-between items-center">
                <span className="text-xs font-display uppercase tracking-widest font-bold text-ipl-gold">
                  ⚡ 2X Booster Active
                </span>
                <span className="bg-ipl-gold text-black font-mono font-black text-xs px-2 py-0.5 rounded">
                  x2 Multiplier
                </span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
