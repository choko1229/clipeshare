import type { LiveChatMessage } from "@/components/live/use-live-socket";

type LiveChatListProps = {
  messages: LiveChatMessage[];
  emptyText?: string;
};

export function LiveChatList({ messages, emptyText = "まだコメントはありません。" }: LiveChatListProps) {
  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {messages.map((message) => (
        <p className="text-sm leading-relaxed" key={message.id}>
          <span className="font-semibold text-primary">{message.username}</span>{" "}
          <span className="break-words text-foreground/90">{message.body}</span>
        </p>
      ))}
    </div>
  );
}
