"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

export type LiveChatMessage = {
  id: string;
  userId: string;
  username: string;
  body: string;
  createdAt: string;
};

type LiveSocketState = {
  connected: boolean;
  live: boolean;
  viewerCount: number;
  likeCount: number;
  liked: boolean;
  messages: LiveChatMessage[];
  error: string | null;
};

const initialState: LiveSocketState = {
  connected: false,
  live: false,
  viewerCount: 0,
  likeCount: 0,
  liked: false,
  messages: [],
  error: null,
};

export function useLiveSocket(viewToken: string, chatToken: string | null) {
  const [state, setState] = useState<LiveSocketState>(initialState);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_LIVE_WS_URL;
    if (!base) {
      return;
    }

    const url = new URL(`${base.replace(/\/$/, "")}/${viewToken}`);
    if (chatToken) {
      url.searchParams.set("token", chatToken);
    }

    const socket = new WebSocket(url.toString());
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setState((current) => ({ ...current, connected: true }));
    });

    socket.addEventListener("close", () => {
      setState((current) => ({ ...current, connected: false }));
    });

    socket.addEventListener("message", (event) => {
      try {
        applyMessage(JSON.parse(event.data), setState);
      } catch {
        // 不正なメッセージは無視する
      }
    });

    return () => {
      socket.close();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [viewToken, chatToken]);

  const sendChat = useCallback((body: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "chat", body }));
    }
  }, []);

  const sendLike = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "like" }));
    }
  }, []);

  return { ...state, sendChat, sendLike };
}

function applyMessage(data: Record<string, unknown>, setState: Dispatch<SetStateAction<LiveSocketState>>) {
  switch (data.type) {
    case "init":
      setState((current) => ({
        ...current,
        live: Boolean(data.live),
        viewerCount: Number(data.viewerCount) || 0,
        likeCount: Number(data.likeCount) || 0,
        liked: Boolean(data.liked),
        messages: Array.isArray(data.messages) ? (data.messages as LiveChatMessage[]) : [],
      }));
      return;
    case "like_state":
      setState((current) => ({ ...current, liked: Boolean(data.liked) }));
      return;
    case "live_state":
      setState((current) => ({ ...current, live: Boolean(data.live) }));
      return;
    case "viewer_count":
      setState((current) => ({ ...current, viewerCount: Number(data.count) || 0 }));
      return;
    case "like_count":
      setState((current) => ({ ...current, likeCount: Number(data.count) || 0 }));
      return;
    case "chat":
      setState((current) => ({
        ...current,
        messages: [...current.messages, data.message as LiveChatMessage].slice(-200),
      }));
      return;
    case "error":
      setState((current) => ({ ...current, error: String(data.message ?? "エラーが発生しました") }));
      return;
    default:
      return;
  }
}
