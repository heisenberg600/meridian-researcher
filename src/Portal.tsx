"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

export function Portal() {
  const ensureCurrent = useMutation(api.users.ensureCurrent);
  const createStudy = useMutation(api.studies.create);
  const sendUserMessage = useMutation(api.messages.sendUserMessage);
  const studies = useQuery(api.studies.listMine);
  const current = useQuery(api.users.current);

  const [selectedStudyId, setSelectedStudyId] = useState<Id<"studies"> | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<Id<"chatSessions"> | null>(null);
  const [title, setTitle] = useState("");
  const [businessDecision, setBusinessDecision] = useState("");
  const [messageText, setMessageText] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStudy = useMemo(
    () => studies?.find((study) => study._id === selectedStudyId) ?? studies?.[0] ?? null,
    [selectedStudyId, studies],
  );
  const chatSessions = useQuery(
    api.chatSessions.listForStudy,
    selectedStudy ? { studyId: selectedStudy._id } : "skip",
  );
  const selectedChat = useMemo(
    () => chatSessions?.find((chat) => chat._id === selectedChatId) ?? chatSessions?.[0] ?? null,
    [selectedChatId, chatSessions],
  );
  const messages = useQuery(
    api.messages.listForChat,
    selectedChat ? { chatSessionId: selectedChat._id } : "skip",
  );

  useEffect(() => {
    void ensureCurrent();
  }, [ensureCurrent]);

  async function handleCreateStudy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsCreating(true);
    try {
      const result = await createStudy({ title, businessDecision });
      setTitle("");
      setBusinessDecision("");
      setSelectedStudyId(result.studyId);
      setSelectedChatId(result.chatSessionId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create study");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedChat || !messageText.trim()) return;

    setIsSending(true);
    try {
      await sendUserMessage({
        chatSessionId: selectedChat._id,
        content: messageText,
      });
      setMessageText("");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#20231f]">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-[320px_1fr]">
        <aside className="border-r border-black/10 bg-white px-5 py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#71776b]">
              Hermes
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Research portal</h1>
            <p className="mt-2 text-sm leading-6 text-[#686d63]">
              {current?.organization?.name ?? "Setting up your workspace..."}
            </p>
          </div>

          <form onSubmit={handleCreateStudy} className="mt-8 space-y-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Study title"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#526647]"
            />
            <textarea
              value={businessDecision}
              onChange={(event) => setBusinessDecision(event.target.value)}
              placeholder="What decision should this research inform?"
              rows={4}
              className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#526647]"
            />
            <button
              type="submit"
              disabled={isCreating}
              className="w-full rounded-lg bg-[#46583c] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? "Creating..." : "Create study"}
            </button>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
          </form>

          <div className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#71776b]">
              Studies
            </h2>
            <div className="mt-3 space-y-2">
              {studies === undefined ? (
                <p className="text-sm text-[#686d63]">Loading studies...</p>
              ) : studies.length === 0 ? (
                <p className="text-sm leading-6 text-[#686d63]">
                  Create your first study to start a strategy chat.
                </p>
              ) : (
                studies.map((study) => (
                  <button
                    key={study._id}
                    type="button"
                    onClick={() => setSelectedStudyId(study._id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left text-sm ${
                      selectedStudy?._id === study._id
                        ? "border-[#526647] bg-[#eef2ea]"
                        : "border-black/10 bg-white hover:bg-black/[0.03]"
                    }`}
                  >
                    <span className="block font-medium">{study.title}</span>
                    <span className="mt-1 block text-xs capitalize text-[#686d63]">
                      {study.status.replaceAll("_", " ")}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>

        <section className="px-8 py-7">
          {selectedStudy ? (
            <div>
              <div className="flex items-start justify-between gap-6 border-b border-black/10 pb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#71776b]">
                    Study workspace
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                    {selectedStudy.title}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[#686d63]">
                    {selectedStudy.businessDecision}
                  </p>
                </div>
                <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium capitalize text-[#4e5549]">
                  {selectedStudy.status.replaceAll("_", " ")}
                </span>
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <div>
                  <h3 className="text-sm font-semibold">Chats</h3>
                  <div className="mt-3 space-y-2">
                    {chatSessions?.map((chat) => (
                      <button
                        key={chat._id}
                        type="button"
                        onClick={() => setSelectedChatId(chat._id)}
                        className={`w-full rounded-lg border p-4 text-left ${
                          selectedChat?._id === chat._id
                            ? "border-[#526647] bg-[#eef2ea]"
                            : "border-black/10 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{chat.title}</p>
                          <span className="text-xs capitalize text-[#686d63]">
                            {chat.purpose.replaceAll("_", " ")}
                          </span>
                        </div>
                        <p className="mt-2 text-xs capitalize text-[#686d63]">{chat.status}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-black/10 bg-white p-5">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-sm font-semibold">{selectedChat?.title ?? "Chat"}</h3>
                    <span className="text-xs text-[#686d63]">
                      {messages?.length ?? 0} messages
                    </span>
                  </div>
                  <div className="mt-4 flex h-[420px] flex-col gap-3 overflow-y-auto rounded-lg bg-[#f8f7f3] p-3">
                    {messages === undefined ? (
                      <p className="text-sm text-[#686d63]">Loading messages...</p>
                    ) : messages.length === 0 ? (
                      <p className="text-sm leading-6 text-[#686d63]">
                        Start by telling Hermes what business decision this research needs to
                        inform.
                      </p>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message._id}
                          className={`max-w-[82%] rounded-lg px-3 py-2 text-sm leading-6 ${
                            message.role === "user"
                              ? "ml-auto bg-[#46583c] text-white"
                              : "bg-white text-[#20231f]"
                          }`}
                        >
                          {message.content ??
                            message.parts
                              .filter((part) => part?.type === "text")
                              .map((part) => String(part.text ?? ""))
                              .join("")}
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
                    <input
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                      placeholder="Message Hermes..."
                      className="min-w-0 flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#526647]"
                    />
                    <button
                      type="submit"
                      disabled={!selectedChat || isSending}
                      className="rounded-lg bg-[#20231f] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Send
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[70vh] items-center justify-center">
              <p className="text-sm text-[#686d63]">Create a study to open its workspace.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
