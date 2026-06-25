import React, { useState } from "react";
import toast from "react-hot-toast";
import { Cpu } from "lucide-react";
import { useMatches } from "../../api/hooks/useMatches";
import { 
  useTournamentQuestionBank, 
  useTournamentMatchAnswers, 
  useUpdateTournamentMatchAnswers,
  useTriggerSingleMatchAIGrading 
} from "../../api/hooks/useAdmin";

export function TournamentMatchGrading({ tournamentId, matchId, onClose }: { tournamentId: string, matchId: string, onClose: () => void }) {
  const { data: matches } = useMatches(tournamentId);
  const currentMatch = matches?.find((m: any) => m.id === matchId);

  const { data: questionBank } = useTournamentQuestionBank(tournamentId);
  const { data: answers, isLoading } = useTournamentMatchAnswers(tournamentId, matchId);
  const { mutate: updateAnswers, isPending } = useUpdateTournamentMatchAnswers();
  const { mutate: triggerAiGrading, isPending: isAiPending } = useTriggerSingleMatchAIGrading();
  const [correctAnswers, setCorrectAnswers] = useState<Record<string, any>>({});

  React.useEffect(() => {
    if (answers?.correct_answers) {
      setCorrectAnswers(answers.correct_answers);
    } else {
      setCorrectAnswers({});
    }
  }, [answers]);

  const handleSave = () => {
    updateAnswers({
      tournamentId,
      matchId,
      correct_answers: correctAnswers
    }, {
      onSuccess: () => {
        toast.success("Grading complete. Scores triggered globally and per league!");
        onClose();
      },
      onError: () => toast.error("Failed to save results")
    });
  };

  const handleAiAutofill = () => {
    const loadingToast = toast.loading("AI is gathering match facts...");
    triggerAiGrading(matchId, {
      onSuccess: (data) => {
        toast.dismiss(loadingToast);
        if (data?.result) {
          setCorrectAnswers(data.result);
          toast.success("Autofill complete! Review answers and click Release Scores.");
        } else {
          toast.error("AI returned no results");
        }
      },
      onError: (err: any) => {
        toast.dismiss(loadingToast);
        toast.error(err?.response?.data?.detail || "AI Autofill failed");
      }
    });
  };

  if (isLoading) return <div className="text-center py-10 animate-pulse font-display text-gray-600 text-xs">Loading keys...</div>;
  if (!questionBank?.questions || questionBank.questions.length === 0) {
    return <div className="text-center py-10 text-gray-500 font-display text-[10px] uppercase tracking-widest">No questions in the tournament bank.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-xl font-display text-white italic uppercase tracking-tight">Match Results</h3>
          <p className="text-[10px] text-gray-400 uppercase font-display tracking-widest mt-1">Set correct answers for the entire tournament for this match</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto font-display">
          <button
            onClick={onClose}
            className="flex-1 md:flex-none px-6 py-3 border border-white/10 text-gray-400 active:text-white font-display text-xs uppercase tracking-[0.2em] rounded-xl active:bg-white/5 transition-all active:scale-95 text-center min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleAiAutofill}
            disabled={isAiPending || isPending}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-display text-xs uppercase tracking-[0.2em] font-bold rounded-xl transition-all disabled:opacity-30 active:scale-95 min-h-[44px]"
          >
            <Cpu className="w-4 h-4 text-ipl-gold" />
            {isAiPending ? "AI Thinking..." : "AI Autofill"}
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || isAiPending}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-ipl-gold text-black font-display text-xs uppercase tracking-[0.2em] font-bold rounded-xl hover:bg-white transition-all disabled:opacity-30 active:scale-95 shadow-[0_0_20px_rgba(244,196,48,0.2)] min-h-[44px]"
          >
            {isPending ? "Propagating..." : "Release Scores"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 mt-6">
        {questionBank.questions.map((q: any) => {
          const replacedText = q.question_text
            .replace(/\{\{Team1\}\}/gi, currentMatch?.team1 || "Team 1")
            .replace(/\{\{Team2\}\}/gi, currentMatch?.team2 || "Team 2");

          const choiceTypes = ["toggle", "multiple_choice", "dropdown"];
          const isChoice = choiceTypes.includes(q.question_type);

          const replacedOptions = q.options?.map((opt: string) =>
            opt.replace(/\{\{Team1\}\}/gi, currentMatch?.team1 || "Team 1")
              .replace(/\{\{Team2\}\}/gi, currentMatch?.team2 || "Team 2")
          );

          return (
            <div key={q.id} className="p-5 border-l-4 border-white/10 hover:border-ipl-gold transition-all bg-white/5 rounded-r-2xl rounded-l-md">
              <h4 className="text-xs font-display text-white tracking-widest uppercase mb-4 leading-relaxed">{replacedText}</h4>
              {isChoice && replacedOptions ? (
                <div className="flex flex-wrap gap-2.5">
                  {replacedOptions.map((opt: string) => (
                    <button
                      key={opt}
                      onClick={() => setCorrectAnswers(prev => ({ ...prev, [q.key]: opt }))}
                      className={`px-4 py-2.5 font-display text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95 min-h-[44px] ${correctAnswers[q.key] === opt
                        ? "bg-ipl-gold text-ipl-navy font-bold"
                        : "bg-white/5 text-gray-400 active:bg-white/10"
                        }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type={q.question_type === "free_number" ? "number" : "text"}
                  value={correctAnswers[q.key] || ""}
                  onChange={(e) => setCorrectAnswers(prev => ({ ...prev, [q.key]: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 p-3.5 rounded-2xl text-white font-display text-[17px] md:text-xs focus:border-ipl-gold focus:outline-none transition-all h-11"
                  placeholder={`Enter correct ${q.question_type.replace("free_", "")}...`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
