export type Profile = {
  id: string;
  auth_user_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
};

export type SessionStatus = "active" | "finished";

export type NegotiationSession = {
  id: string;
  user_id: string;
  scenario_slug: string;
  status: SessionStatus;
  started_at: string;
  finished_at: string | null;
};

export type MessageRole = "user" | "opponent";

export type NegotiationMessage = {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
};

export type CriterionScore = {
  criterion: string;
  label: string;
  score: number; // 0-100
  comment: string;
};

export type Outcome = "win" | "draw" | "lose";

export type KeyMoment = {
  quote: string; // дословная цитата реплики игрока из диалога
  verdict: "good" | "bad";
  comment: string; // почему это сработало/не сработало, со ссылкой на технику
};

export type SessionResult = {
  id: string;
  session_id: string;
  outcome: Outcome;
  score: number;
  criteria_breakdown: CriterionScore[];
  feedback_text: string;
  key_moments?: KeyMoment[];
  created_at: string;
};
