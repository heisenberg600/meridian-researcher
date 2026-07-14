"use client";

import { UserButton, useUser } from "@clerk/react";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import {
  BrainIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  DatabaseIcon,
  FileTextIcon,
  Globe2Icon,
  HistoryIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import "streamdown/styles.css";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "./components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "./components/ai-elements/message";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "./components/ai-elements/prompt-input";
import { Badge, Button, Card, SectionHeader, TextInput, Textarea, cx } from "./components/meridian";

type MainView = "studies" | "activity" | "settings";
type StudyTab = "overview" | "chat" | "plan" | "calls" | "feedback" | "artifacts";
type CurrentUserQuery =
  | {
      user?: { name?: string; email?: string } | null;
      organization?: { name: string } | null;
    }
  | null
  | undefined;

const studyTabs: Array<{ id: StudyTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "chat", label: "Chat" },
  { id: "plan", label: "Plan" },
  { id: "calls", label: "Calls" },
  { id: "feedback", label: "Feedback" },
  { id: "artifacts", label: "Artifacts" },
];

export function Portal() {
  const { user } = useUser();
  const ensureCurrent = useMutation(api.users.ensureCurrent);
  const createStudy = useMutation(api.studies.create);
  const createChatSession = useMutation(api.chatSessions.create);
  const sendUserMessage = useMutation(api.messages.sendUserMessage);
  const archiveMemory = useMutation(api.organizationMemories.archive);
  const studies = useQuery(api.studies.listMine);
  const current = useQuery(api.users.current);
  const memories = useQuery(api.organizationMemories.listMine, { includeArchived: false });

  const [mainView, setMainView] = useState<MainView>("studies");
  const [studyTab, setStudyTab] = useState<StudyTab>("overview");
  const [selectedStudyId, setSelectedStudyId] = useState<Id<"studies"> | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<Id<"chatSessions"> | null>(null);
  const [title, setTitle] = useState("");
  const [businessDecision, setBusinessDecision] = useState("");
  const [messageText, setMessageText] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStudy = useMemo(
    () => (selectedStudyId ? studies?.find((study) => study._id === selectedStudyId) ?? null : null),
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
      setMainView("studies");
      setStudyTab("chat");
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

  async function handleCreateChat() {
    if (!selectedStudy || isCreatingChat) return;

    setIsCreatingChat(true);
    setError(null);
    try {
      const chatSessionId = await createChatSession({
        studyId: selectedStudy._id,
        title: `Discussion ${(chatSessions?.length ?? 0) + 1}`,
        purpose: "general",
      });
      setSelectedChatId(chatSessionId);
      setMessageText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create chat");
    } finally {
      setIsCreatingChat(false);
    }
  }

  function openStudy(studyId: Id<"studies">, tab: StudyTab = "overview") {
    setSelectedStudyId(studyId);
    setMainView("studies");
    setStudyTab(tab);
  }

  return (
    <main className="h-screen overflow-hidden bg-[var(--bg-page)] text-[var(--ink-700)]">
      <div className="grid h-full min-h-0 grid-cols-[240px_minmax(0,1fr)]">
        {selectedStudy && mainView === "studies" ? (
          <StudySidebar
            current={current}
            selectedStudy={selectedStudy}
            setSelectedStudyId={setSelectedStudyId}
            setStudyTab={setStudyTab}
            studyTab={studyTab}
            user={user}
          />
        ) : (
          <WorkspaceSidebar
            current={current}
            mainView={mainView}
            openStudy={openStudy}
            selectedStudy={selectedStudy}
            setMainView={setMainView}
            setSelectedStudyId={setSelectedStudyId}
            setStudyTab={setStudyTab}
            studies={studies}
            user={user}
          />
        )}

        <section
          className={cx(
            "h-full min-h-0 min-w-0",
            selectedStudy && mainView === "studies" && studyTab === "chat"
              ? "overflow-hidden p-0"
              : "overflow-y-auto px-8 py-7",
          )}
        >
          {mainView === "studies" ? (
            selectedStudy ? (
              <StudyDetail
                chatSessions={chatSessions}
                isCreatingChat={isCreatingChat}
                messages={messages}
                onCreateChat={handleCreateChat}
                onSendMessage={handleSendMessage}
                selectedChat={selectedChat}
                selectedStudy={selectedStudy}
                setMessageText={setMessageText}
                setSelectedChatId={setSelectedChatId}
                setStudyTab={setStudyTab}
                studyTab={studyTab}
                messageText={messageText}
                isSending={isSending}
              />
            ) : (
              <StudiesHome
                businessDecision={businessDecision}
                error={error}
                isCreating={isCreating}
                onCreateStudy={handleCreateStudy}
                openStudy={openStudy}
                setBusinessDecision={setBusinessDecision}
                setTitle={setTitle}
                studies={studies}
                title={title}
              />
            )
          ) : null}
          {mainView === "activity" ? <ActivitySkeleton studies={studies} /> : null}
          {mainView === "settings" ? (
            <OrgSettings memories={memories} archiveMemory={archiveMemory} current={current} />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function StudiesHome({
  businessDecision,
  error,
  isCreating,
  onCreateStudy,
  openStudy,
  setBusinessDecision,
  setTitle,
  studies,
  title,
}: {
  businessDecision: string;
  error: string | null;
  isCreating: boolean;
  onCreateStudy: (event: React.FormEvent<HTMLFormElement>) => void;
  openStudy: (studyId: Id<"studies">, tab?: StudyTab) => void;
  setBusinessDecision: (value: string) => void;
  setTitle: (value: string) => void;
  studies: Array<Doc<"studies">> | undefined;
  title: string;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <SectionHeader
        eyebrow="Workspace"
        title="Studies"
        description="Create a research study, brief Meridian, and move from strategy to calls, feedback, and evidence-backed artifacts."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="p-5">
          <h2 className="[font:var(--text-heading-sm)] text-[var(--text-heading)]">
            Create study
          </h2>
          <form onSubmit={onCreateStudy} className="mt-4 space-y-3">
            <TextInput
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Study title"
            />
            <Textarea
              value={businessDecision}
              onChange={(event) => setBusinessDecision(event.target.value)}
              placeholder="What decision should this research inform?"
              rows={5}
            />
            <Button type="submit" disabled={isCreating} className="w-full">
              {isCreating ? "Creating..." : "Create study"}
            </Button>
            {error ? <p className="[font:var(--text-body-sm)] text-[var(--status-danger)]">{error}</p> : null}
          </form>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {studies === undefined ? (
            <Card className="p-5">
              <p className="[font:var(--text-body)] text-[var(--text-muted)]">Loading studies...</p>
            </Card>
          ) : studies.length === 0 ? (
            <Card className="p-5">
              <p className="[font:var(--text-body)] text-[var(--text-muted)]">
                No studies yet. Create one to open the study workspace.
              </p>
            </Card>
          ) : (
            studies.map((study) => (
              <button key={study._id} type="button" onClick={() => openStudy(study._id)} className="text-left">
                <Card className="h-full p-5 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--ivory-50)]">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="[font:var(--text-heading-sm)] text-[var(--text-heading)]">
                      {study.title}
                    </h2>
                    <Badge>{formatStatus(study.status)}</Badge>
                  </div>
                  <p className="mt-3 line-clamp-3 [font:var(--text-body-sm)] text-[var(--text-secondary)]">
                    {study.businessDecision}
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-[var(--border-default)] pt-3 [font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
                    <span>Updated {formatDate(study.updatedAt)}</span>
                    <span>Open</span>
                  </div>
                </Card>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function WorkspaceSidebar({
  current,
  mainView,
  openStudy,
  selectedStudy,
  setMainView,
  setSelectedStudyId,
  setStudyTab,
  studies,
  user,
}: {
  current: CurrentUserQuery;
  mainView: MainView;
  openStudy: (studyId: Id<"studies">, tab?: StudyTab) => void;
  selectedStudy: Doc<"studies"> | null;
  setMainView: (view: MainView) => void;
  setSelectedStudyId: (studyId: Id<"studies"> | null) => void;
  setStudyTab: (tab: StudyTab) => void;
  studies: Array<Doc<"studies">> | undefined;
  user: ReturnType<typeof useUser>["user"];
}) {
  return (
    <aside className="flex min-h-screen flex-col border-r border-[var(--border-default)] bg-[var(--surface-card)]">
      <div className="px-5 pb-4 pt-6">
        <button
          type="button"
          onClick={() => {
            setMainView("studies");
            setSelectedStudyId(null);
            setStudyTab("overview");
          }}
          className="[font:var(--text-display-md)] tracking-[var(--tracking-display)] text-[var(--text-heading)]"
        >
          Meridian
        </button>
        <p className="mt-1 [font:var(--text-body-sm)] text-[var(--text-muted)]">
          {current?.organization?.name ?? "Setting up workspace"}
        </p>
      </div>

      <nav className="space-y-1 px-3">
        <SidebarButton
          active={mainView === "studies"}
          label="Studies"
          onClick={() => {
            setMainView("studies");
            setSelectedStudyId(null);
          }}
        />
        <SidebarButton
          active={mainView === "activity"}
          label="Activity"
          onClick={() => setMainView("activity")}
        />
        <SidebarButton
          active={mainView === "settings"}
          label="Org settings"
          onClick={() => setMainView("settings")}
        />
      </nav>

      <div className="mt-6 border-t border-[var(--border-default)] px-5 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
            Recent studies
          </p>
          <span className="[font:var(--text-body-sm)] text-[var(--text-muted)]">
            {studies?.length ?? 0}
          </span>
        </div>
        <div className="space-y-2">
          {studies === undefined ? (
            <p className="[font:var(--text-body-sm)] text-[var(--text-muted)]">Loading...</p>
          ) : studies.length === 0 ? (
            <p className="[font:var(--text-body-sm)] text-[var(--text-muted)]">No studies yet.</p>
          ) : (
            studies.slice(0, 5).map((study) => (
              <button
                key={study._id}
                type="button"
                onClick={() => openStudy(study._id)}
                className={cx(
                  "w-full rounded-[var(--radius-md)] px-3 py-2 text-left transition-colors",
                  selectedStudy?._id === study._id && mainView === "studies"
                    ? "bg-[var(--accent-softer)] text-[var(--text-heading)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--ivory-200)]",
                )}
              >
                <span className="block truncate [font:var(--text-body-sm)] font-semibold">
                  {study.title}
                </span>
                <span className="mt-0.5 block capitalize [font:var(--text-caption)] text-[var(--text-muted)]">
                  {formatStatus(study.status)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <UserFooter user={user} fallbackName={current?.user?.name ?? current?.user?.email} />
    </aside>
  );
}

function StudySidebar({
  current,
  selectedStudy,
  setSelectedStudyId,
  setStudyTab,
  studyTab,
  user,
}: {
  current: CurrentUserQuery;
  selectedStudy: Doc<"studies">;
  setSelectedStudyId: (studyId: Id<"studies"> | null) => void;
  setStudyTab: (tab: StudyTab) => void;
  studyTab: StudyTab;
  user: ReturnType<typeof useUser>["user"];
}) {
  return (
    <aside className="flex min-h-screen flex-col border-r border-[var(--border-default)] bg-[var(--surface-card)]">
      <div className="border-b border-[var(--border-default)] px-5 py-5">
        <button
          type="button"
          onClick={() => {
            setSelectedStudyId(null);
            setStudyTab("overview");
          }}
          className="[font:var(--text-body-sm)] text-[var(--text-muted)] hover:text-[var(--text-heading)]"
        >
          Back to studies
        </button>
        <h1 className="mt-4 line-clamp-3 [font:var(--text-heading-sm)] text-[var(--text-heading)]">
          {selectedStudy.title}
        </h1>
        <p className="mt-2 line-clamp-4 [font:var(--text-body-sm)] text-[var(--text-secondary)]">
          {selectedStudy.businessDecision}
        </p>
        <Badge tone="info" className="mt-4">
          {formatStatus(selectedStudy.status)}
        </Badge>
      </div>

      <nav className="mt-4 space-y-1 px-3">
        {studyTabs.map((tab) => (
          <SidebarButton
            key={tab.id}
            active={studyTab === tab.id}
            label={tab.label}
            onClick={() => setStudyTab(tab.id)}
          />
        ))}
      </nav>

      <div className="mt-auto border-t border-[var(--border-default)] px-5 py-4">
        <p className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
          Workspace
        </p>
        <p className="mt-1 truncate [font:var(--text-body-sm)] text-[var(--text-secondary)]">
          {current?.organization?.name ?? "Meridian"}
        </p>
      </div>
      <UserFooter user={user} fallbackName={current?.user?.name ?? current?.user?.email} />
    </aside>
  );
}

function StudyDetail({
  chatSessions,
  isCreatingChat,
  isSending,
  messageText,
  messages,
  onCreateChat,
  onSendMessage,
  selectedChat,
  selectedStudy,
  setMessageText,
  setSelectedChatId,
  setStudyTab,
  studyTab,
}: {
  chatSessions: Array<Doc<"chatSessions">> | undefined;
  isCreatingChat: boolean;
  isSending: boolean;
  messageText: string;
  messages: Array<Doc<"messages">> | undefined;
  onCreateChat: () => void;
  onSendMessage: (event: React.FormEvent<HTMLFormElement>) => void;
  selectedChat: Doc<"chatSessions"> | null;
  selectedStudy: Doc<"studies">;
  setMessageText: (value: string) => void;
  setSelectedChatId: (id: Id<"chatSessions">) => void;
  setStudyTab: (tab: StudyTab) => void;
  studyTab: StudyTab;
}) {
  return (
    <div className={cx(studyTab === "chat" ? "h-full min-h-0" : "mx-auto w-full max-w-7xl")}>
      <div className={cx(studyTab === "chat" && "h-full min-h-0")}>
        {studyTab === "overview" ? <StudyOverview selectedStudy={selectedStudy} /> : null}
        {studyTab === "chat" ? (
          <StudyChat
            chatSessions={chatSessions}
            isCreatingChat={isCreatingChat}
            isSending={isSending}
            messageText={messageText}
            messages={messages}
            onCreateChat={onCreateChat}
            onSendMessage={onSendMessage}
            selectedChat={selectedChat}
            setMessageText={setMessageText}
            setSelectedChatId={setSelectedChatId}
          />
        ) : null}
        {studyTab === "plan" ? (
          <StudyPlan selectedStudy={selectedStudy} onOpenChat={() => setStudyTab("chat")} />
        ) : null}
        {studyTab === "calls" ? <CallsSkeleton /> : null}
        {studyTab === "feedback" ? <FeedbackSkeleton /> : null}
        {studyTab === "artifacts" ? <ArtifactsSkeleton /> : null}
      </div>
    </div>
  );
}

function StudyOverview({ selectedStudy }: { selectedStudy: Doc<"studies"> }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
      <Card className="p-5">
        <h2 className="[font:var(--text-heading-sm)] text-[var(--text-heading)]">Research brief</h2>
        <p className="mt-3 [font:var(--text-body)] text-[var(--text-secondary)]">
          {selectedStudy.businessDecision}
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Metric label="Status" value={formatStatus(selectedStudy.status)} />
          <Metric label="Created" value={formatDate(selectedStudy.createdAt)} />
          <Metric label="Updated" value={formatDate(selectedStudy.updatedAt)} />
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="[font:var(--text-heading-sm)] text-[var(--text-heading)]">Next action</h2>
        <p className="mt-3 [font:var(--text-body-sm)] text-[var(--text-secondary)]">
          Use chat to brief Meridian. The plan, calls, feedback, and artifacts tabs are ready for the
          next backend tables.
        </p>
        <div className="mt-5 rounded-[var(--radius-md)] bg-[var(--accent-softer)] p-4 [font:var(--text-body-sm)] text-[var(--clay-800)]">
          Single-agent UX now, skill-driven behavior underneath.
        </div>
      </Card>
    </div>
  );
}

function StudyChat({
  chatSessions,
  isCreatingChat,
  isSending,
  messageText,
  messages,
  onCreateChat,
  onSendMessage,
  selectedChat,
  setMessageText,
  setSelectedChatId,
}: {
  chatSessions: Array<Doc<"chatSessions">> | undefined;
  isCreatingChat: boolean;
  isSending: boolean;
  messageText: string;
  messages: Array<Doc<"messages">> | undefined;
  onCreateChat: () => void;
  onSendMessage: (event: React.FormEvent<HTMLFormElement>) => void;
  selectedChat: Doc<"chatSessions"> | null;
  setMessageText: (value: string) => void;
  setSelectedChatId: (id: Id<"chatSessions">) => void;
}) {
  const toolEvents = useQuery(
    api.agentToolEvents.listForChat,
    selectedChat ? { chatSessionId: selectedChat._id } : "skip",
  );

  return (
    <div className="grid h-full min-h-0 grid-cols-[220px_minmax(0,1fr)] bg-[var(--bg-page)]">
      <aside className="flex min-h-0 flex-col border-r border-[var(--border-default)] bg-[var(--surface-card)]">
        <div className="flex items-center gap-2 border-b border-[var(--border-default)] px-4 py-3">
          <HistoryIcon className="size-4 shrink-0 text-[var(--text-muted)]" />
          <h2 className="min-w-0 flex-1 [font:var(--text-body-sm)] font-semibold text-[var(--text-heading)]">
            Chats
          </h2>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 shrink-0"
            onClick={onCreateChat}
            disabled={isCreatingChat}
            aria-label="Start new chat"
            title="Start new chat"
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {chatSessions === undefined ? (
            <p className="px-2 py-3 [font:var(--text-body-sm)] text-[var(--text-muted)]">
              Loading chats...
            </p>
          ) : chatSessions.length === 0 ? (
            <p className="px-2 py-3 [font:var(--text-body-sm)] text-[var(--text-muted)]">
              No previous chats
            </p>
          ) : (
            <div className="space-y-1">
              {chatSessions.map((chat) => {
                const active = selectedChat?._id === chat._id;
                return (
                  <button
                    key={chat._id}
                    type="button"
                    onClick={() => setSelectedChatId(chat._id)}
                    className={cx(
                      "w-full px-3 py-3 text-left transition-colors",
                      active
                        ? "bg-[var(--accent-softer)] text-[var(--text-heading)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)]",
                    )}
                  >
                    <span className="block truncate [font:var(--text-body-sm)] font-semibold">
                      {chat.title}
                    </span>
                    <span className="mt-1 block [font:var(--text-caption)] text-[var(--text-muted)]">
                      {formatDate(chat.updatedAt)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex h-0 min-h-0 flex-1 bg-[var(--bg-page)]">
          <Conversation className="h-full min-h-0 w-full">
            <ConversationContent className="mx-auto w-full max-w-4xl gap-6 px-8 py-10">
              {messages === undefined ? (
                <p className="[font:var(--text-body)] text-[var(--text-muted)]">Loading messages...</p>
              ) : messages.length === 0 ? (
                <ConversationEmptyState
                  title="Brief Meridian"
                  description="Start with the business decision, what you already know, and what evidence would make the decision easier."
                  icon={<MessageSquareIcon className="size-5" />}
                  className="min-h-[60vh]"
                />
              ) : (
                messages.map((message) => (
                  <ChatBubble
                    key={message._id}
                    message={message}
                    toolEvents={
                      message.agentRunId
                        ? (toolEvents ?? []).filter(
                            (event) => event.agentRunId === message.agentRunId,
                          )
                        : []
                    }
                  />
                ))
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </div>
        <div className="border-t border-[var(--border-default)] bg-[color-mix(in_srgb,var(--surface-card)_94%,transparent)] px-8 py-4">
          <PromptInput onSubmit={onSendMessage} className="mx-auto max-w-4xl shadow-none">
            <PromptInputTextarea
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              placeholder="Message Meridian..."
              disabled={!selectedChat || isSending}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <PromptInputToolbar>
              <PromptInputTools>
                {selectedChat?.activeAgentRunId ? (
                  <AgentRunPill active />
                ) : (
                  <span className="[font:var(--text-caption)] text-[var(--text-muted)]">
                    Shift + Enter for a new line
                  </span>
                )}
              </PromptInputTools>
              <PromptInputSubmit
                disabled={!selectedChat || isSending || !messageText.trim()}
                status={selectedChat?.activeAgentRunId ? "streaming" : "ready"}
              />
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

function OrgSettings({
  archiveMemory,
  current,
  memories,
}: {
  archiveMemory: (args: { memoryId: Id<"organizationMemories"> }) => Promise<null>;
  current:
    | {
        organization?: { name: string } | null;
      }
    | null
    | undefined;
  memories: Array<Doc<"organizationMemories">> | undefined;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <SectionHeader
        eyebrow="Organization"
        title="Org settings"
        description="Manage the shared context and operating defaults Meridian can use across studies."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="p-5">
          <h2 className="[font:var(--text-heading-sm)] text-[var(--text-heading)]">
            {current?.organization?.name ?? "Workspace"}
          </h2>
          <div className="mt-5 space-y-2">
            {["Memories", "Skills", "Integrations", "Usage", "Members"].map((item, index) => (
              <button
                key={item}
                type="button"
                className={cx(
                  "w-full rounded-[var(--radius-md)] px-3 py-2 text-left [font:var(--text-body-sm)]",
                  index === 0
                    ? "bg-[var(--accent-softer)] font-semibold text-[var(--text-heading)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--ivory-200)]",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="[font:var(--text-heading-sm)] text-[var(--text-heading)]">
                Organization memories
              </h2>
              <p className="mt-1 [font:var(--text-body-sm)] text-[var(--text-secondary)]">
                Durable context Meridian can recall across studies. For now, the agent can write
                memories and you can archive them here.
              </p>
            </div>
            <Badge tone="info">{memories?.length ?? 0} active</Badge>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {memories === undefined ? (
              <p className="[font:var(--text-body)] text-[var(--text-muted)]">Loading memories...</p>
            ) : memories.length === 0 ? (
              <div className="rounded-[var(--radius-md)] bg-[var(--ivory-100)] p-4 [font:var(--text-body-sm)] text-[var(--text-muted)]">
                No organization memories yet. Meridian will save stable context when it helps future
                research.
              </div>
            ) : (
              memories.map((memory) => (
                <div
                  key={memory._id}
                  className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--ivory-50)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
                        {memory.category}
                      </p>
                      <h3 className="mt-1 [font:var(--text-body)] font-semibold text-[var(--text-heading)]">
                        {memory.key}
                      </h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void archiveMemory({ memoryId: memory._id })}
                    >
                      Archive
                    </Button>
                  </div>
                  <p className="mt-3 [font:var(--text-body-sm)] text-[var(--text-secondary)]">
                    {memory.value}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Badge>Importance {Math.round(memory.importance * 100)}%</Badge>
                    <Badge>Confidence {Math.round(memory.confidence * 100)}%</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ActivitySkeleton({ studies }: { studies: Array<Doc<"studies">> | undefined }) {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <SectionHeader
        eyebrow="Workspace"
        title="Activity"
        description="A cross-study feed for responses, approvals, calls, completed research, and agent work that needs you."
      />
      <Card className="mt-8 divide-y divide-[var(--border-default)]">
        {(studies ?? []).slice(0, 4).map((study) => (
          <div key={study._id} className="flex items-center justify-between gap-4 p-5">
            <div>
              <h2 className="[font:var(--text-body)] font-semibold text-[var(--text-heading)]">
                {study.title}
              </h2>
              <p className="mt-1 [font:var(--text-body-sm)] text-[var(--text-secondary)]">
                Study updated {formatDate(study.updatedAt)}
              </p>
            </div>
            <Badge>{formatStatus(study.status)}</Badge>
          </div>
        ))}
        {studies?.length === 0 ? (
          <p className="p-5 [font:var(--text-body)] text-[var(--text-muted)]">
            No activity yet.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

function StudyPlan({
  selectedStudy,
  onOpenChat,
}: {
  selectedStudy: Doc<"studies">;
  onOpenChat: () => void;
}) {
  const currentPlan = useQuery(api.studyPlans.currentForStudy, { studyId: selectedStudy._id });
  const versions = useQuery(api.studyPlans.listVersions, { studyId: selectedStudy._id });
  const [selectedVersionId, setSelectedVersionId] = useState<Id<"studyPlanVersions"> | null>(null);
  const displayedPlan = useMemo(
    () =>
      (selectedVersionId
        ? versions?.find((version) => version._id === selectedVersionId)
        : currentPlan) ?? null,
    [currentPlan, selectedVersionId, versions],
  );

  if (currentPlan === undefined || versions === undefined) {
    return <p className="[font:var(--text-body)] text-[var(--text-muted)]">Loading Study Plan...</p>;
  }

  if (!currentPlan) {
    return (
      <div className="flex min-h-[520px] items-center justify-center border border-dashed border-[var(--border-strong)] bg-[var(--surface-card)] px-8 text-center">
        <div className="max-w-md">
          <FileTextIcon className="mx-auto size-6 text-[var(--text-muted)]" />
          <h1 className="mt-4 [font:var(--text-heading-sm)] text-[var(--text-heading)]">
            No Study Plan yet
          </h1>
          <p className="mt-2 [font:var(--text-body)] text-[var(--text-secondary)]">
            Continue the strategy conversation. Meridian will save the plan here once there is
            enough context, while keeping assumptions and open questions visible.
          </p>
          <Button type="button" onClick={onOpenChat} className="mt-5">
            <MessageSquareIcon className="size-4" />
            Continue in chat
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
      <article className="min-w-0 border border-[var(--border-default)] bg-[var(--surface-card)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-default)] px-7 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="[font:var(--text-heading-sm)] text-[var(--text-heading)]">
                Study Plan
              </h1>
              {displayedPlan ? <Badge tone="info">Version {displayedPlan.version}</Badge> : null}
              {displayedPlan ? <Badge>{formatStatus(displayedPlan.status)}</Badge> : null}
            </div>
            <p className="mt-2 [font:var(--text-body-sm)] text-[var(--text-muted)]">
              {displayedPlan
                ? `Created ${formatDate(displayedPlan.createdAt)}`
                : "Select a version to inspect it."}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onOpenChat}>
            <MessageSquareIcon className="size-4" />
            Update in chat
          </Button>
        </div>
        <div className="px-7 py-7">
          {displayedPlan ? (
            <MessageResponse className="mx-auto max-w-3xl">{displayedPlan.markdown}</MessageResponse>
          ) : null}
        </div>
      </article>

      <aside className="border border-[var(--border-default)] bg-[var(--surface-card)]">
        <div className="border-b border-[var(--border-default)] px-4 py-3">
          <h2 className="[font:var(--text-body-sm)] font-semibold text-[var(--text-heading)]">
            Version history
          </h2>
        </div>
        <div className="p-2">
          {versions.map((version) => {
            const active = (selectedVersionId ?? currentPlan._id) === version._id;
            return (
              <button
                key={version._id}
                type="button"
                onClick={() => setSelectedVersionId(version._id)}
                className={cx(
                  "w-full px-3 py-3 text-left transition-colors",
                  active
                    ? "bg-[var(--accent-softer)]"
                    : "hover:bg-[var(--bg-sunken)]",
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="[font:var(--text-body-sm)] font-semibold text-[var(--text-heading)]">
                    Version {version.version}
                  </span>
                  {version._id === currentPlan._id ? (
                    <span className="[font:var(--text-caption)] text-[var(--accent-active)]">
                      Current
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block [font:var(--text-caption)] text-[var(--text-muted)]">
                  {formatDate(version.createdAt)} · {formatStatus(version.status)}
                </span>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function CallsSkeleton() {
  return (
    <SkeletonGrid
      title="Calls"
      description="This surface will track scheduled, live, and completed interviews with transcripts, recordings, costs, and summaries."
      items={["Scheduled", "Live call", "Transcript", "Cost breakdown"]}
    />
  );
}

function FeedbackSkeleton() {
  return (
    <SkeletonGrid
      title="Feedback"
      description="Tagged respondent evidence, objections, quotes, and synthesis-ready observations will live here."
      items={["Quotes", "Themes", "Objections", "Evidence tags"]}
    />
  );
}

function ArtifactsSkeleton() {
  return (
    <SkeletonGrid
      title="Artifacts"
      description="Reports, briefs, exports, source files, and generated research assets will collect here."
      items={["Reports", "Briefs", "Exports", "Sources"]}
    />
  );
}

function SkeletonGrid({
  description,
  items,
  title,
}: {
  description: string;
  items: string[];
  title: string;
}) {
  return (
    <div>
      <SectionHeader title={title} description={description} />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <Card key={item} className="p-5">
            <h2 className="[font:var(--text-heading-sm)] text-[var(--text-heading)]">{item}</h2>
            <p className="mt-3 [font:var(--text-body-sm)] text-[var(--text-muted)]">
              Skeleton ready for the next Convex model.
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SidebarButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex h-9 w-full items-center rounded-[var(--radius-md)] px-3 text-left [font:var(--text-body-sm)] transition-colors",
        active
          ? "bg-[var(--ivory-200)] font-semibold text-[var(--text-heading)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--ivory-200)] hover:text-[var(--text-heading)]",
      )}
    >
      {label}
    </button>
  );
}

function UserFooter({
  fallbackName,
  user,
}: {
  fallbackName?: string;
  user: ReturnType<typeof useUser>["user"];
}) {
  const displayName = user?.fullName ?? fallbackName ?? "Meridian user";
  const email = user?.primaryEmailAddress?.emailAddress ?? undefined;
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mt-auto border-t border-[var(--border-default)] px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-full)] bg-[var(--accent-soft)] [font:var(--text-body-sm)] font-semibold text-[var(--clay-800)]">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate [font:var(--text-body-sm)] font-semibold text-[var(--text-heading)]">
            {displayName}
          </p>
          {email ? (
            <p className="truncate [font:var(--text-caption)] text-[var(--text-muted)]">{email}</p>
          ) : (
            <p className="truncate [font:var(--text-caption)] text-[var(--text-muted)]">
              Account options
            </p>
          )}
        </div>
        <UserButton
          appearance={{
            elements: {
              userButtonAvatarBox: "h-8 w-8",
            },
          }}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--ivory-50)] p-3">
      <p className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-1 [font:var(--text-body)] font-semibold capitalize text-[var(--text-heading)]">
        {value}
      </p>
    </div>
  );
}

function ChatBubble({
  message,
  toolEvents,
}: {
  message: Doc<"messages">;
  toolEvents: Array<Doc<"agentToolEvents">>;
}) {
  const text = renderMessageText(message);
  const isUser = message.role === "user";
  return (
    <Message from={message.role}>
      <MessageContent>
        {!isUser ? (
          <p className="mb-2 [font:var(--text-body-sm)] font-semibold text-[var(--text-heading)]">
            Meridian
          </p>
        ) : null}
        {!isUser ? (
          <AgentActivity events={toolEvents} isThinking={message.status === "streaming"} />
        ) : null}
        {isUser ? (
          <span className="whitespace-pre-wrap">{text}</span>
        ) : text ? (
          <MessageResponse>{text}</MessageResponse>
        ) : null}
      </MessageContent>
    </Message>
  );
}

const toolDisplay = {
  web_search: {
    running: "Searching the web",
    done: "Searched the web",
    icon: Globe2Icon,
  },
  remember_organization_context: {
    running: "Saving organization context",
    done: "Saved organization context",
    icon: DatabaseIcon,
  },
  forget_organization_memory: {
    running: "Removing outdated context",
    done: "Removed outdated context",
    icon: Trash2Icon,
  },
  update_study_plan: {
    running: "Updating the Study Plan",
    done: "Updated the Study Plan",
    icon: FileTextIcon,
  },
} as const;

function AgentActivity({
  events,
  isThinking,
}: {
  events: Array<Doc<"agentToolEvents">>;
  isThinking: boolean;
}) {
  if (events.length === 0 && !isThinking) return null;

  return (
    <div className="mb-3 space-y-1.5" aria-live="polite">
      {events.map((event) => {
        const display = toolDisplay[event.toolName as keyof typeof toolDisplay];
        const ToolIcon = display?.icon ?? DatabaseIcon;
        const running = event.status === "started";
        const failed = event.status === "failed";
        const label = failed
          ? `${display?.running ?? humanizeToolName(event.toolName)} failed`
          : running
            ? (display?.running ?? humanizeToolName(event.toolName))
            : (display?.done ?? `Used ${humanizeToolName(event.toolName)}`);
        const detail = formatToolEventDetail(event);

        return (
          <details key={event._id} className="group/activity text-[var(--text-muted)]">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-2 py-0.5 [font:var(--text-body-sm)] hover:text-[var(--text-heading)]">
              <span className="flex size-5 items-center justify-center">
                <ToolIcon className="size-3.5" />
              </span>
              <span className={cx(running && "italic text-[var(--text-secondary)]")}>
                {label}{running ? "..." : ""}
              </span>
              {running ? (
                <LoaderCircleIcon className="size-3.5 animate-spin" />
              ) : failed ? (
                <CircleAlertIcon className="size-3.5 text-[var(--status-danger)]" />
              ) : (
                <CheckCircle2Icon className="size-3.5 text-[var(--status-success)]" />
              )}
            </summary>
            {detail ? (
              <div className="ml-7 mt-1 max-w-2xl border-l border-[var(--border-default)] pl-3 [font:var(--text-caption)] text-[var(--text-muted)]">
                {detail}
              </div>
            ) : null}
          </details>
        );
      })}
      {isThinking ? (
        <div className="flex items-center gap-2 py-0.5 [font:var(--text-body-sm)] italic text-[var(--text-secondary)]">
          <span className="flex size-5 items-center justify-center">
            <BrainIcon className="size-3.5" />
          </span>
          <span className="animate-pulse">Thinking through the next step...</span>
        </div>
      ) : null}
    </div>
  );
}

function humanizeToolName(name: string) {
  return name.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function formatToolEventDetail(event: Doc<"agentToolEvents">) {
  const input = event.input as Record<string, unknown> | undefined;
  if (event.error) return event.error;
  if (event.toolName === "web_search" && typeof input?.query === "string") {
    const output = event.output as { results?: unknown[] } | undefined;
    const resultCount = output?.results?.length;
    return resultCount === undefined
      ? `Query: ${input.query}`
      : `Query: ${input.query} · ${resultCount} source${resultCount === 1 ? "" : "s"}`;
  }
  if (typeof input?.key === "string") return `Memory: ${input.key}`;
  if (event.toolName === "update_study_plan") {
    const output = event.output as
      | { version?: number; changeSummary?: string; status?: string }
      | undefined;
    if (output?.changeSummary) {
      return `Version ${output.version ?? "new"} · ${output.changeSummary}`;
    }
  }
  return null;
}

function AgentRunPill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-2 rounded-[var(--radius-full)] bg-[var(--accent-softer)] px-3 py-1 [font:var(--text-body-sm)] text-[var(--clay-800)]">
      <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
      Meridian working
    </span>
  ) : (
    <Badge tone="success">Ready</Badge>
  );
}

function renderMessageText(message: Doc<"messages">) {
  const text =
    message.content ??
    message.parts
      .filter((part) => part?.type === "text")
      .map((part) => String(part.text ?? ""))
      .join("");

  if (text) return text;
  return "";
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}
