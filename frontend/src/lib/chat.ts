export interface ChatSender {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;   // JSON has no Date type — this arrives as an ISO string
  alertId: string;     // which conversation this belongs to (needed for real-time)
  sender: ChatSender;
}
