"use client";

import { UserButton, useUser } from "@clerk/react";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import { Component, useEffect, useMemo, useReducer, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import {
  BrainIcon,
  ArchiveIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  DatabaseIcon,
  FileTextIcon,
  Globe2Icon,
  HistoryIcon,
  ListChecksIcon,
  LoaderCircleIcon,
  MailIcon,
  MessageSquareIcon,
  PencilIcon,
  PhoneCallIcon,
  PlusIcon,
  Trash2Icon,
  UserPlusIcon,
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
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SectionHeader,
  TextInput,
  Textarea,
  cx,
} from "./components/meridian";
import { getUserFacingConvexError } from "./lib/utils";
import { ParticipantImportWizard } from "./features/participants/import/ParticipantImportWizard";
import { createImportReviewState, importReviewReducer } from "./features/participants/import/reviewState";
import { parseParticipantWorkbook } from "./features/participants/import/workbook";
import { runParticipantQuickOutreach, type QuickOutreachChannel } from "./features/participants/quickOutreach";

type MainView = "studies" | "activity" | "settings";
type StudyTab =
  | "overview"
  | "chat"
  | "plan"
  | "interview-guide"
  | "participants"
  | "calls"
  | "feedback"
  | "artifacts";
type CurrentUserQuery =
  | {
      user?: { name?: string; email?: string } | null;
      organization?: { name: string } | null;
    }
  | null
  | undefined;
type StudyFormErrors = {
  businessDecision?: string;
  title?: string;
};

const studyTabs: Array<{ id: StudyTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "chat", label: "Chat" },
  { id: "plan", label: "Plan" },
  { id: "interview-guide", label: "Interview guide" },
  { id: "participants", label: "Participants" },
  { id: "calls", label: "Calls" },
  { id: "feedback", label: "Feedback" },
  { id: "artifacts", label: "Artifacts" },
];

const studyTabIds = new Set<StudyTab>(studyTabs.map((tab) => tab.id));

type PortalRoute = {
  mainView: MainView;
  selectedChatId: Id<"chatSessions"> | null;
  selectedStudyId: Id<"studies"> | null;
  studyTab: StudyTab;
};

function readPortalRoute(): PortalRoute {
  const segments = window.location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [, section, studyId, tabId, chatId] = segments;

  if (section === "activity") {
    return {
      mainView: "activity",
      selectedChatId: null,
      selectedStudyId: null,
      studyTab: "overview",
    };
  }

  if (section === "settings") {
    return {
      mainView: "settings",
      selectedChatId: null,
      selectedStudyId: null,
      studyTab: "overview",
    };
  }

  if (section === "studies" && studyId) {
    const studyTab = studyTabIds.has(tabId as StudyTab) ? (tabId as StudyTab) : "overview";
    return {
      mainView: "studies",
      selectedChatId: studyTab === "chat" && chatId ? (chatId as Id<"chatSessions">) : null,
      selectedStudyId: studyId as Id<"studies">,
      studyTab,
    };
  }

  return {
    mainView: "studies",
    selectedChatId: null,
    selectedStudyId: null,
    studyTab: "overview",
  };
}

function portalPath(route: PortalRoute) {
  if (route.mainView === "activity") return "/portal/activity";
  if (route.mainView === "settings") return "/portal/settings";
  if (!route.selectedStudyId) return "/portal";

  const studyId = encodeURIComponent(route.selectedStudyId);
  const tab = encodeURIComponent(route.studyTab);
  if (route.studyTab === "chat" && route.selectedChatId) {
    return `/portal/studies/${studyId}/chat/${encodeURIComponent(route.selectedChatId)}`;
  }
  return `/portal/studies/${studyId}/${tab}`;
}

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
  const activityEvents = useQuery(api.activity.listMine);
  const initialRoute = useMemo(readPortalRoute, []);

  const [mainView, setMainView] = useState<MainView>(initialRoute.mainView);
  const [studyTab, setStudyTab] = useState<StudyTab>(initialRoute.studyTab);
  const [selectedStudyId, setSelectedStudyId] = useState<Id<"studies"> | null>(
    initialRoute.selectedStudyId,
  );
  const [selectedChatId, setSelectedChatId] = useState<Id<"chatSessions"> | null>(
    initialRoute.selectedChatId,
  );
  const [title, setTitle] = useState("");
  const [businessDecision, setBusinessDecision] = useState("");
  const [messageText, setMessageText] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studyFormErrors, setStudyFormErrors] = useState<StudyFormErrors>({});

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

  function applyRoute(route: PortalRoute) {
    setMainView(route.mainView);
    setSelectedStudyId(route.selectedStudyId);
    setStudyTab(route.studyTab);
    setSelectedChatId(route.selectedChatId);
  }

  function navigatePortal(route: PortalRoute, options?: { replace?: boolean }) {
    const path = portalPath(route);
    if (window.location.pathname !== path) {
      if (options?.replace) {
        window.history.replaceState({}, "", path);
      } else {
        window.history.pushState({}, "", path);
      }
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
    applyRoute(route);
  }

  useEffect(() => {
    const onPopState = () => applyRoute(readPortalRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  async function handleCreateStudy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const nextErrors: StudyFormErrors = {};
    if (!title.trim()) nextErrors.title = "Enter a study title.";
    if (!businessDecision.trim()) {
      nextErrors.businessDecision = "Describe the decision this study should inform.";
    }
    setStudyFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsCreating(true);
    try {
      const result = await createStudy({ title, businessDecision });
      setTitle("");
      setBusinessDecision("");
      setStudyFormErrors({});
      navigatePortal({
        mainView: "studies",
        selectedChatId: result.chatSessionId,
        selectedStudyId: result.studyId,
        studyTab: "chat",
      });
    } catch (cause) {
      setError(cause instanceof Error ? safeMutationError(cause.message) : "Could not create study.");
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
      navigatePortal({
        mainView: "studies",
        selectedChatId: chatSessionId,
        selectedStudyId: selectedStudy._id,
        studyTab: "chat",
      });
      setMessageText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create chat");
    } finally {
      setIsCreatingChat(false);
    }
  }

  function openStudy(studyId: Id<"studies">, tab: StudyTab = "overview") {
    navigatePortal({
      mainView: "studies",
      selectedChatId: null,
      selectedStudyId: studyId,
      studyTab: tab,
    });
  }

  function openPortalHome() {
    navigatePortal({
      mainView: "studies",
      selectedChatId: null,
      selectedStudyId: null,
      studyTab: "overview",
    });
  }

  function openMainView(view: MainView) {
    navigatePortal({
      mainView: view,
      selectedChatId: null,
      selectedStudyId: null,
      studyTab: "overview",
    });
  }

  function openStudyTab(tab: StudyTab) {
    if (!selectedStudy) return;
    navigatePortal({
      mainView: "studies",
      selectedChatId: tab === "chat" ? selectedChat?._id ?? selectedChatId : null,
      selectedStudyId: selectedStudy._id,
      studyTab: tab,
    });
  }

  function openChat(chatSessionId: Id<"chatSessions">) {
    if (!selectedStudy) return;
    navigatePortal({
      mainView: "studies",
      selectedChatId: chatSessionId,
      selectedStudyId: selectedStudy._id,
      studyTab: "chat",
    });
  }

  return (
    <main className="h-screen overflow-hidden bg-[var(--bg-page)] text-[var(--ink-700)]">
      <div className="grid h-full min-h-0 grid-cols-[240px_minmax(0,1fr)]">
        {selectedStudy && mainView === "studies" ? (
          <StudySidebar
            current={current}
            selectedStudy={selectedStudy}
            openPortalHome={openPortalHome}
            openStudyTab={openStudyTab}
            studyTab={studyTab}
            user={user}
          />
        ) : (
          <WorkspaceSidebar
            current={current}
            mainView={mainView}
            openMainView={openMainView}
            openPortalHome={openPortalHome}
            openStudy={openStudy}
            selectedStudy={selectedStudy}
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
                openChat={openChat}
                openStudyTab={openStudyTab}
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
                studyFormErrors={studyFormErrors}
                studies={studies}
                title={title}
              />
            )
          ) : null}
          {mainView === "activity" ? (
            <ActivityFeed activityEvents={activityEvents} studies={studies} />
          ) : null}
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
  studyFormErrors,
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
  studyFormErrors: StudyFormErrors;
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
            {studyFormErrors.title ? (
              <p className="[font:var(--text-caption)] text-[var(--status-danger)]">
                {studyFormErrors.title}
              </p>
            ) : null}
            <Textarea
              value={businessDecision}
              onChange={(event) => setBusinessDecision(event.target.value)}
              placeholder="What decision should this research inform?"
              rows={5}
            />
            {studyFormErrors.businessDecision ? (
              <p className="[font:var(--text-caption)] text-[var(--status-danger)]">
                {studyFormErrors.businessDecision}
              </p>
            ) : null}
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
  openMainView,
  openPortalHome,
  openStudy,
  selectedStudy,
  studies,
  user,
}: {
  current: CurrentUserQuery;
  mainView: MainView;
  openMainView: (view: MainView) => void;
  openPortalHome: () => void;
  openStudy: (studyId: Id<"studies">, tab?: StudyTab) => void;
  selectedStudy: Doc<"studies"> | null;
  studies: Array<Doc<"studies">> | undefined;
  user: ReturnType<typeof useUser>["user"];
}) {
  return (
    <aside className="flex min-h-screen flex-col border-r border-[var(--border-default)] bg-[var(--surface-card)]">
      <div className="px-5 pb-4 pt-6">
        <button
          type="button"
          onClick={openPortalHome}
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
          active={mainView === "studies" && !selectedStudy}
          label="Studies"
          onClick={openPortalHome}
        />
        <SidebarButton
          active={mainView === "activity"}
          label="Activity"
          onClick={() => openMainView("activity")}
        />
        <SidebarButton
          active={mainView === "settings"}
          label="Org settings"
          onClick={() => openMainView("settings")}
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
  openPortalHome,
  openStudyTab,
  selectedStudy,
  studyTab,
  user,
}: {
  current: CurrentUserQuery;
  openPortalHome: () => void;
  openStudyTab: (tab: StudyTab) => void;
  selectedStudy: Doc<"studies">;
  studyTab: StudyTab;
  user: ReturnType<typeof useUser>["user"];
}) {
  return (
    <aside className="flex min-h-screen flex-col border-r border-[var(--border-default)] bg-[var(--surface-card)]">
      <div className="border-b border-[var(--border-default)] px-5 py-5">
        <button
          type="button"
          onClick={openPortalHome}
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
            onClick={() => openStudyTab(tab.id)}
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
  openChat,
  openStudyTab,
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
  openChat: (id: Id<"chatSessions">) => void;
  openStudyTab: (tab: StudyTab) => void;
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
            openChat={openChat}
          />
        ) : null}
        {studyTab === "plan" ? (
          <StudyPlan selectedStudy={selectedStudy} onOpenChat={() => openStudyTab("chat")} />
        ) : null}
        {studyTab === "interview-guide" ? (
          <InterviewGuideErrorBoundary>
            <InterviewGuide selectedStudy={selectedStudy} />
          </InterviewGuideErrorBoundary>
        ) : null}
        {studyTab === "participants" ? <StudyParticipants selectedStudy={selectedStudy} /> : null}
        {studyTab === "calls" ? <StudyCalls selectedStudy={selectedStudy} /> : null}
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
  openChat,
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
  openChat: (id: Id<"chatSessions">) => void;
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
                    onClick={() => openChat(chat._id)}
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
                disabled={index !== 0}
                className={cx(
                  "flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left [font:var(--text-body-sm)]",
                  index === 0
                    ? "bg-[var(--accent-softer)] font-semibold text-[var(--text-heading)]"
                    : "cursor-not-allowed text-[var(--text-muted)] opacity-60",
                )}
              >
                <span>{item}</span>
                {index !== 0 ? (
                  <span className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)]">
                    Soon
                  </span>
                ) : null}
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
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ActivityFeed({
  activityEvents,
  studies,
}: {
  activityEvents: Array<Doc<"auditEvents">> | undefined;
  studies: Array<Doc<"studies">> | undefined;
}) {
  const studyById = new Map((studies ?? []).map((study) => [study._id, study]));

  return (
    <div className="mx-auto w-full max-w-7xl">
      <SectionHeader
        eyebrow="Workspace"
        title="Activity"
        description="Recent persisted workspace events from studies, plans, memories, and agent work."
      />
      <Card className="mt-8 divide-y divide-[var(--border-default)]">
        {activityEvents === undefined ? (
          <p className="p-5 [font:var(--text-body)] text-[var(--text-muted)]">
            Loading activity...
          </p>
        ) : activityEvents.length === 0 ? (
          <p className="p-5 [font:var(--text-body)] text-[var(--text-muted)]">
            No activity yet.
          </p>
        ) : (
          activityEvents.map((event) => (
            <div key={event._id} className="flex items-center justify-between gap-4 p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="[font:var(--text-body)] font-semibold text-[var(--text-heading)]">
                    {event.summary}
                  </h2>
                  <Badge>{formatStatus(event.eventType)}</Badge>
                </div>
                <p className="mt-1 [font:var(--text-body-sm)] text-[var(--text-secondary)]">
                  {event.studyId && studyById.has(event.studyId)
                    ? `${studyById.get(event.studyId)?.title} · `
                    : ""}
                  {formatDate(event.createdAt)}
                </p>
              </div>
              <Badge tone={event.actorType === "agent" ? "info" : "neutral"}>
                {event.actorType}
              </Badge>
            </div>
          ))
        )}
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

class InterviewGuideErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Interview guide failed to render", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="border border-[var(--status-danger)] bg-[var(--surface-card)] p-6">
          <h1 className="[font:var(--text-heading-sm)] text-[var(--text-heading)]">
            Interview guide could not load
          </h1>
          <p className="mt-2 [font:var(--text-body-sm)] text-[var(--text-secondary)]">
            {this.state.error.message}
          </p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function InterviewGuide({ selectedStudy }: { selectedStudy: Doc<"studies"> }) {
  const currentGuide = useQuery(api.interviewBriefs.currentForStudy, { studyId: selectedStudy._id });
  const versions = useQuery(api.interviewBriefs.listVersions, { studyId: selectedStudy._id });
  const generateGuide = useAction(api.interviewBriefs.generateFromPlan);
  const approveGuide = useMutation(api.interviewBriefs.approve);
  const [selectedVersionId, setSelectedVersionId] = useState<Id<"interviewBriefVersions"> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const displayedGuide = useMemo(
    () =>
      (selectedVersionId
        ? versions?.find((version) => version._id === selectedVersionId)
        : currentGuide) ?? null,
    [currentGuide, selectedVersionId, versions],
  );

  async function handleGenerate() {
    setIsGenerating(true);
    setGuideError(null);
    try {
      await generateGuide({ studyId: selectedStudy._id });
      setSelectedVersionId(null);
    } catch (cause) {
      setGuideError(cause instanceof Error ? cause.message : "Could not generate interview guide");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleApprove() {
    if (!currentGuide) return;
    setIsApproving(true);
    setGuideError(null);
    try {
      await approveGuide({ briefId: currentGuide._id });
    } catch (cause) {
      setGuideError(cause instanceof Error ? cause.message : "Could not approve interview guide");
    } finally {
      setIsApproving(false);
    }
  }

  if (currentGuide === undefined || versions === undefined) {
    return <p className="[font:var(--text-body)] text-[var(--text-muted)]">Loading interview guide...</p>;
  }

  if (!currentGuide) {
    return (
      <div className="flex min-h-[520px] items-center justify-center border border-dashed border-[var(--border-strong)] bg-[var(--surface-card)] px-8 text-center">
        <div className="max-w-md">
          <ListChecksIcon className="mx-auto size-6 text-[var(--text-muted)]" />
          <h1 className="mt-4 [font:var(--text-heading-sm)] text-[var(--text-heading)]">
            Build the interview guide
          </h1>
          <p className="mt-2 [font:var(--text-body)] text-[var(--text-secondary)]">
            Meridian will turn the current Study Plan into one adaptive guide for form and voice interviews.
          </p>
          {guideError ? (
            <p className="mt-3 [font:var(--text-body-sm)] text-[var(--status-danger)]">{guideError}</p>
          ) : null}
          <Button type="button" onClick={() => void handleGenerate()} disabled={isGenerating} className="mt-5">
            {isGenerating ? <LoaderCircleIcon className="size-4 animate-spin" /> : <ListChecksIcon className="size-4" />}
            {isGenerating ? "Generating..." : "Generate from Study Plan"}
          </Button>
        </div>
      </div>
    );
  }

  const brief = displayedGuide?.brief;
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
      <article className="min-w-0 border border-[var(--border-default)] bg-[var(--surface-card)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-default)] px-7 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="[font:var(--text-heading-sm)] text-[var(--text-heading)]">Interview guide</h1>
              {displayedGuide ? <Badge tone="info">Version {displayedGuide.version}</Badge> : null}
              {displayedGuide ? <Badge>{formatStatus(displayedGuide.status)}</Badge> : null}
            </div>
            {brief ? (
              <p className="mt-2 [font:var(--text-body-sm)] text-[var(--text-muted)]">
                {brief.estimatedMinutes} minutes · {brief.respondentProfile}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void handleGenerate()} disabled={isGenerating}>
              {isGenerating ? <LoaderCircleIcon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
              New version
            </Button>
            {currentGuide.status !== "approved" && displayedGuide?._id === currentGuide._id ? (
              <Button type="button" onClick={() => void handleApprove()} disabled={isApproving}>
                <CheckCircle2Icon className="size-4" />
                {isApproving ? "Approving..." : "Approve guide"}
              </Button>
            ) : null}
          </div>
        </div>

        {guideError ? (
          <p className="border-b border-[var(--border-default)] px-7 py-3 [font:var(--text-body-sm)] text-[var(--status-danger)]">
            {guideError}
          </p>
        ) : null}
        {brief ? (
          <div className="mx-auto max-w-3xl space-y-8 px-7 py-8">
            <section>
              <p className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">Research objective</p>
              <h2 className="mt-2 [font:var(--text-heading-sm)] text-[var(--text-heading)]">{brief.title}</h2>
              <p className="mt-2 [font:var(--text-body)] text-[var(--text-secondary)]">{brief.researchObjective}</p>
            </section>
            <GuideScript label="Opening" text={brief.openingScript} />
            <div className="space-y-6">
              {brief.topics.map((topic, index) => (
                <section key={topic.id} className="border-t border-[var(--border-default)] pt-6">
                  <p className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">Topic {index + 1}</p>
                  <h2 className="mt-1 [font:var(--text-heading-sm)] text-[var(--text-heading)]">{topic.title}</h2>
                  <p className="mt-1 [font:var(--text-body-sm)] text-[var(--text-muted)]">{topic.objective}</p>
                  <ol className="mt-4 space-y-3">
                    {topic.questions.map((question, questionIndex) => (
                      <li key={`${topic.id}-${questionIndex}`} className="flex gap-3 [font:var(--text-body)] text-[var(--text-heading)]">
                        <span className="text-[var(--text-muted)]">{questionIndex + 1}.</span>
                        <span>{question}</span>
                      </li>
                    ))}
                  </ol>
                  {topic.probes.length > 0 ? (
                    <div className="mt-4 bg-[var(--bg-sunken)] px-4 py-3">
                      <p className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">Optional probes</p>
                      <p className="mt-2 [font:var(--text-body-sm)] text-[var(--text-secondary)]">{topic.probes.join(" · ")}</p>
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
            <GuideScript label="Closing" text={brief.closingScript} />
            {brief.guardrails.length > 0 ? (
              <section className="border-t border-[var(--border-default)] pt-6">
                <h2 className="[font:var(--text-body)] font-semibold text-[var(--text-heading)]">Interviewer guardrails</h2>
                <ul className="mt-3 space-y-2 [font:var(--text-body-sm)] text-[var(--text-secondary)]">
                  {brief.guardrails.map((guardrail) => <li key={guardrail}>• {guardrail}</li>)}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </article>

      <aside className="border border-[var(--border-default)] bg-[var(--surface-card)]">
        <div className="border-b border-[var(--border-default)] px-4 py-3">
          <h2 className="[font:var(--text-body-sm)] font-semibold text-[var(--text-heading)]">Version history</h2>
        </div>
        <div className="p-2">
          {versions.map((version) => {
            const active = (selectedVersionId ?? currentGuide._id) === version._id;
            return (
              <button key={version._id} type="button" onClick={() => setSelectedVersionId(version._id)} className={cx("w-full px-3 py-3 text-left transition-colors", active ? "bg-[var(--accent-softer)]" : "hover:bg-[var(--bg-sunken)]")}>
                <span className="flex items-center justify-between gap-3">
                  <span className="[font:var(--text-body-sm)] font-semibold text-[var(--text-heading)]">Version {version.version}</span>
                  {version._id === currentGuide._id ? <span className="[font:var(--text-caption)] text-[var(--accent-active)]">Current</span> : null}
                </span>
                <span className="mt-1 block [font:var(--text-caption)] text-[var(--text-muted)]">{formatDate(version.createdAt)} · {formatStatus(version.status)}</span>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function GuideScript({ label, text }: { label: string; text: string }) {
  return (
    <section className="border-l-2 border-[var(--accent-active)] pl-4">
      <p className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 [font:var(--text-body)] text-[var(--text-secondary)]">{text}</p>
    </section>
  );
}

type ParticipantFormState = {
  name: string;
  email: string;
  phone: string;
  segment: string;
  preferredMode: "form" | "voice" | "either";
  notes: string;
};

const emptyParticipantForm: ParticipantFormState = {
  name: "",
  email: "",
  phone: "",
  segment: "",
  preferredMode: "either",
  notes: "",
};

function StudyParticipants({ selectedStudy }: { selectedStudy: Doc<"studies"> }) {
  const convex = useConvex();
  const participants = useQuery(api.studyParticipants.listForStudy, {
    studyId: selectedStudy._id,
  });
  const createParticipant = useMutation(api.studyParticipants.create);
  const updateParticipant = useMutation(api.studyParticipants.update);
  const archiveParticipant = useMutation(api.studyParticipants.archive);
  const createImport = useMutation(api.participantImports.createImport);
  const updateImportRow = useMutation(api.participantImports.updateRow);
  const approveImport = useMutation(api.participantImports.approveImport);
  const prepareOutreach = useMutation(api.outreachBatches.prepareSingleParticipant);
  const sendParticipantEmail = useAction(api.participantInvites.sendEmail);
  const callParticipant = useAction(api.participantInvites.sendCall);
  const [importState, dispatchImport] = useReducer(importReviewReducer, undefined, createImportReviewState);
  const [importBusy, setImportBusy] = useState(false);
  const [form, setForm] = useState<ParticipantFormState>(emptyParticipantForm);
  const [editingId, setEditingId] = useState<Id<"studyParticipants"> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [pendingOutreach, setPendingOutreach] = useState<{
    participant: Doc<"studyParticipants">;
    channel: QuickOutreachChannel;
  } | null>(null);
  const [sendingInviteId, setSendingInviteId] = useState<Id<"studyParticipants"> | null>(null);
  const [outreachNotice, setOutreachNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const setField = <Key extends keyof ParticipantFormState>(
    key: Key,
    value: ParticipantFormState[Key],
  ) => setForm((current) => ({ ...current, [key]: value }));

  async function handleSaveParticipant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setParticipantError(null);
    setIsSaving(true);
    try {
      const values = {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        segment: form.segment || undefined,
        preferredMode: form.preferredMode,
        notes: form.notes || undefined,
      };
      if (editingId) {
        await updateParticipant({ participantId: editingId, ...values });
      } else {
        await createParticipant({ studyId: selectedStudy._id, ...values });
      }
      setEditingId(null);
      setForm(emptyParticipantForm);
    } catch (cause) {
      setParticipantError(getUserFacingConvexError(cause, "Could not save participant"));
    } finally {
      setIsSaving(false);
    }
  }

  function beginEdit(participant: Doc<"studyParticipants">) {
    setEditingId(participant._id);
    setParticipantError(null);
    setForm({
      name: participant.name,
      email: participant.email ?? "",
      phone: participant.phone ?? "",
      segment: participant.segment ?? "",
      preferredMode: participant.preferredMode,
      notes: participant.notes ?? "",
    });
  }

  async function runImport(action: () => Promise<void>) {
    setImportBusy(true);
    try { await action(); }
    catch (error) { dispatchImport({ type: "failed", message: error instanceof Error ? error.message : "Participant import failed" }); }
    finally { setImportBusy(false); }
  }

  async function confirmOutreach() {
    if (!pendingOutreach) return;
    const { participant, channel } = pendingOutreach;
    setSendingInviteId(participant._id);
    setOutreachNotice(null);
    try {
      const result = await runParticipantQuickOutreach({
        participantId: participant._id,
        channel,
        prepare: (args) => prepareOutreach({
          participantId: args.participantId as Id<"studyParticipants">,
          channel: args.channel,
          confirmed: args.confirmed,
        }).then(({ outreachBatchId, reused }) => ({ outreachBatchId, reused })),
        sendEmail: (args) => sendParticipantEmail({
          participantId: args.participantId as Id<"studyParticipants">,
          outreachBatchId: args.outreachBatchId as Id<"outreachBatches">,
        }),
        sendCall: (args) => callParticipant({
          participantId: args.participantId as Id<"studyParticipants">,
          outreachBatchId: args.outreachBatchId as Id<"outreachBatches">,
        }),
      });
      setOutreachNotice({ tone: "success", message: `${result.message} ${participant.name}` });
      setPendingOutreach(null);
    } catch (cause) {
      setOutreachNotice({
        tone: "error",
        message: getUserFacingConvexError(
          cause,
          `Could not start ${channel === "email" ? "email" : "call"} outreach. Check the approved Plan, interview guide, participant details, and provider configuration.`,
        ),
      });
    } finally {
      setSendingInviteId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="[font:var(--text-heading-sm)] text-[var(--text-heading)]">Participants</h1>
          <p className="mt-1 [font:var(--text-body-sm)] text-[var(--text-secondary)]">
            People recruited specifically for this study.
          </p>
        </div>
        <Badge tone="info">{participants?.length ?? 0} active</Badge>
      </div>

      <div className="mt-6">
        <ParticipantImportWizard
          state={importState}
          busy={importBusy}
          onFileSelected={(file) => runImport(async () => {
            const workbook = parseParticipantWorkbook(await file.arrayBuffer(), { filename: file.name });
            const inferred = await convex.query(api.participantImports.inferMapping, { studyId: selectedStudy._id, headers: workbook.headers, sampleRows: workbook.rows.slice(0, 10) });
            dispatchImport({ type: "workbook_parsed", workbook: { ...workbook, filename: file.name }, mapping: inferred.mapping });
          })}
          onMappingChange={(field, columns) => dispatchImport({ type: "mapping_changed", field, columns })}
          onCreateImport={() => runImport(async () => {
            if (!importState.workbook) throw new Error("Choose a workbook first");
            const result = await createImport({ studyId: selectedStudy._id, filename: importState.workbook.filename, mapping: importState.mapping, rows: importState.workbook.rows });
            dispatchImport({ type: "import_created", batchId: result.batchId, rows: result.rows });
          })}
          onUpdateRow={(rowId, normalized, exclude) => runImport(async () => {
            const row = await updateImportRow({ rowId: rowId as Id<"participantImportRows">, normalized, exclude });
            dispatchImport({ type: "row_updated", row });
          })}
          onRequestApproval={() => dispatchImport({ type: "approval_requested" })}
          onApprove={() => runImport(async () => {
            if (!importState.batchId) throw new Error("Create an import review first");
            const result = await approveImport({ batchId: importState.batchId as Id<"participantImportBatches"> });
            dispatchImport({ type: "import_approved", participantCount: result.participantIds.length });
          })}
          onManualAdd={() => document.getElementById("manual-participant-form")?.scrollIntoView({ behavior: "smooth" })}
        />
      </div>

      {outreachNotice ? (
        <p
          role={outreachNotice.tone === "error" ? "alert" : "status"}
          className={cx(
            "mt-4 border px-4 py-3 [font:var(--text-body-sm)]",
            outreachNotice.tone === "error"
              ? "border-[var(--status-danger)] text-[var(--status-danger)]"
              : "border-[var(--status-success)] text-[var(--status-success)]",
          )}
        >
          {outreachNotice.message}
        </p>
      ) : null}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <UserPlusIcon className="size-4 text-[var(--text-muted)]" />
            <h2 className="[font:var(--text-body)] font-semibold text-[var(--text-heading)]">
              {editingId ? "Edit participant" : "Add participant"}
            </h2>
          </div>
          <form id="manual-participant-form" onSubmit={handleSaveParticipant} className="mt-4 space-y-3">
            <TextInput
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              placeholder="Full name"
              aria-label="Full name"
            />
            <TextInput
              type="email"
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              placeholder="Email address"
              aria-label="Email address"
            />
            <TextInput
              type="tel"
              value={form.phone}
              onChange={(event) => setField("phone", event.target.value)}
              placeholder="Phone number"
              aria-label="Phone number"
            />
            <TextInput
              value={form.segment}
              onChange={(event) => setField("segment", event.target.value)}
              placeholder="Segment (optional)"
              aria-label="Segment"
            />
            <label className="block">
              <span className="mb-1.5 block [font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
                Interview mode
              </span>
              <select
                value={form.preferredMode}
                onChange={(event) =>
                  setField("preferredMode", event.target.value as ParticipantFormState["preferredMode"])
                }
                className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 [font:var(--text-body-sm)] outline-none focus:border-[var(--border-focus)] focus:shadow-[var(--focus-ring)]"
              >
                <option value="either">Form or voice</option>
                <option value="form">Form</option>
                <option value="voice">Voice</option>
              </select>
            </label>
            <Textarea
              value={form.notes}
              onChange={(event) => setField("notes", event.target.value)}
              placeholder="Recruitment notes (optional)"
              rows={3}
            />
            {participantError ? (
              <p className="[font:var(--text-body-sm)] text-[var(--status-danger)]">
                {participantError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={isSaving} className="flex-1">
                {isSaving ? "Saving..." : editingId ? "Save changes" : "Add participant"}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyParticipantForm);
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </Card>

        <div className="overflow-hidden border border-[var(--border-default)] bg-[var(--surface-card)]">
          <div className="grid grid-cols-[minmax(160px,1.2fr)_minmax(140px,1fr)_100px_220px] gap-4 border-b border-[var(--border-default)] bg-[var(--bg-sunken)] px-4 py-2.5 [font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
            <span>Participant</span>
            <span>Segment</span>
            <span>Mode</span>
            <span className="text-right">Actions</span>
          </div>
          {participants === undefined ? (
            <p className="p-5 [font:var(--text-body)] text-[var(--text-muted)]">
              Loading participants...
            </p>
          ) : participants.length === 0 ? (
            <div className="p-8 text-center">
              <UserPlusIcon className="mx-auto size-5 text-[var(--text-muted)]" />
              <p className="mt-3 [font:var(--text-body)] font-semibold text-[var(--text-heading)]">
                No participants yet
              </p>
              <p className="mt-1 [font:var(--text-body-sm)] text-[var(--text-muted)]">
                Add an internal test participant before connecting outreach.
              </p>
            </div>
          ) : (
            participants.map((participant) => (
              <div
                key={participant._id}
                className="grid grid-cols-[minmax(160px,1.2fr)_minmax(140px,1fr)_100px_220px] items-center gap-4 border-b border-[var(--border-default)] px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate [font:var(--text-body-sm)] font-semibold text-[var(--text-heading)]">
                    {participant.name}
                  </p>
                  <p className="truncate [font:var(--text-caption)] text-[var(--text-muted)]">
                    {participant.email ?? participant.phone}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="truncate [font:var(--text-body-sm)] text-[var(--text-secondary)]">
                    {participant.segment ?? "Unassigned"}
                  </p>
                  <Badge className="mt-1">{formatStatus(participant.status)}</Badge>
                </div>
                <span className="[font:var(--text-body-sm)] capitalize text-[var(--text-secondary)]">
                  {participant.preferredMode === "either" ? "Either" : participant.preferredMode}
                </span>
                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!participant.email || sendingInviteId === participant._id}
                    title={participant.email ? "Send interview invitation" : "Add an email first"}
                    aria-label={`Email ${participant.name}`}
                    onClick={() => setPendingOutreach({ participant, channel: "email" })}
                  >
                    {sendingInviteId === participant._id ? <LoaderCircleIcon className="size-4 animate-spin" /> : <MailIcon className="size-4" />}
                    Email
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!participant.phone || sendingInviteId === participant._id}
                    title={participant.phone ? "Start outbound interview call" : "Add a phone first"}
                    aria-label={`Call ${participant.name}`}
                    onClick={() => setPendingOutreach({ participant, channel: "call" })}
                  >
                    {sendingInviteId === participant._id ? <LoaderCircleIcon className="size-4 animate-spin" /> : <PhoneCallIcon className="size-4" />}
                    Call
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Edit participant"
                    aria-label={`Edit ${participant.name}`}
                    onClick={() => beginEdit(participant)}
                  >
                    <PencilIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Archive participant"
                    aria-label={`Archive ${participant.name}`}
                    onClick={() => void archiveParticipant({ participantId: participant._id })}
                  >
                    <ArchiveIcon className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={Boolean(pendingOutreach)} onOpenChange={(open) => { if (!open && !sendingInviteId) setPendingOutreach(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingOutreach?.channel === "call" ? "Start Outbound Call?" : "Send Invitation Email?"}
            </DialogTitle>
            <DialogDescription>
              Meridian will approve this participant for the current interview guide and contact {pendingOutreach?.participant.name ?? "this participant"} through {pendingOutreach?.channel === "call" ? "ElevenLabs" : "Resend"}. This is an external action.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingOutreach(null)} disabled={Boolean(sendingInviteId)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void confirmOutreach()} disabled={Boolean(sendingInviteId)}>
              {sendingInviteId ? <LoaderCircleIcon className="size-4 animate-spin" /> : pendingOutreach?.channel === "call" ? <PhoneCallIcon className="size-4" /> : <MailIcon className="size-4" />}
              {sendingInviteId ? "Starting…" : pendingOutreach?.channel === "call" ? "Approve & Start Call" : "Approve & Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudyCalls({ selectedStudy }: { selectedStudy: Doc<"studies"> }) {
  const calls = useQuery(api.callRecords.listForStudy, { studyId: selectedStudy._id });
  const analytics = useQuery(api.callRecords.analyticsForStudy, { studyId: selectedStudy._id });
  const [selectedCallId, setSelectedCallId] = useState<Id<"interviewCallRecords"> | null>(null);
  const selectedCall = calls?.find((call) => call._id === selectedCallId) ?? calls?.[0] ?? null;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="[font:var(--text-heading-sm)] text-[var(--text-heading)]">Calls</h1>
          <p className="mt-1 [font:var(--text-body-sm)] text-[var(--text-secondary)]">
            ElevenLabs transcripts are pulled and analyzed five minutes after each call starts.
          </p>
        </div>
        <Badge tone="info">{calls?.length ?? 0} calls</Badge>
      </div>

      {analytics?.analyzedCalls ? (
        <section className="mt-6 border border-[var(--border-default)] bg-[var(--surface-card)]">
          <div className="grid divide-y divide-[var(--border-default)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
            <CallMetric label="Analyzed" value={`${analytics.analyzedCalls}/${analytics.totalCalls}`} />
            <CallMetric label="Call score" value={`${analytics.averageScores.overall}`} suffix="/100" />
            <CallMetric label="Goal coverage" value={`${analytics.averageScores.goalCoverage}`} suffix="/100" />
            <CallMetric label="Response depth" value={`${analytics.averageScores.responseDepth}`} suffix="/100" />
            <CallMetric label="Avg. participant words" value={`${analytics.averageParticipantWords}`} />
          </div>
          <div className="grid border-t border-[var(--border-default)] xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="border-b border-[var(--border-default)] px-5 py-5 xl:border-b-0 xl:border-r">
              <p className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--accent-active)]">Directional insight summary</p>
              <h2 className="mt-2 [font:var(--text-heading-sm)] text-[var(--text-heading)]">
                {buildCallInsightHeadline(analytics)}
              </h2>
              <p className="mt-2 max-w-3xl [font:var(--text-body-sm)] text-[var(--text-secondary)]">
                {buildCallInsightSummary(analytics)}
              </p>
              <p className="mt-3 [font:var(--text-caption)] text-[var(--text-muted)]">
                Based on {analytics.analyzedCalls} analyzed {analytics.analyzedCalls === 1 ? "call" : "calls"}; treat patterns as directional until the sample grows.
              </p>
            </div>
            <div className="px-5 py-5">
              <p className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">Sentiment mix</p>
              <SentimentBar items={analytics.sentiment} total={analytics.analyzedCalls} />
            </div>
          </div>
          <div className="grid gap-0 border-t border-[var(--border-default)] xl:grid-cols-3">
            <div className="border-b border-[var(--border-default)] px-5 py-5 xl:border-b-0 xl:border-r">
              <ScoreProfile scores={analytics.averageScores} />
            </div>
            <div className="border-b border-[var(--border-default)] px-5 py-5 xl:border-b-0 xl:border-r">
              <CallScoreChart calls={calls ?? []} />
            </div>
            <div className="px-5 py-5">
              <SignalBars items={[...analytics.painPoints, ...analytics.needs, ...analytics.opportunities]} />
            </div>
          </div>
        </section>
      ) : null}

      <div className="mt-6">
        {calls === undefined ? (
          <p className="[font:var(--text-body)] text-[var(--text-muted)]">Loading calls...</p>
        ) : calls.length === 0 ? (
          <div className="border border-dashed border-[var(--border-strong)] bg-[var(--surface-card)] p-10 text-center">
            <PhoneCallIcon className="mx-auto size-5 text-[var(--text-muted)]" />
            <h2 className="mt-3 [font:var(--text-body)] font-semibold text-[var(--text-heading)]">No calls yet</h2>
            <p className="mt-1 [font:var(--text-body-sm)] text-[var(--text-muted)]">Start a call from the Participants tab.</p>
          </div>
        ) : selectedCall ? (
          <div className="grid min-h-[620px] border border-[var(--border-default)] bg-[var(--surface-card)] lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="border-b border-[var(--border-default)] lg:border-b-0 lg:border-r">
              <div className="border-b border-[var(--border-default)] px-4 py-3 [font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">
                Call history
              </div>
              <div className="divide-y divide-[var(--border-default)]">
                {calls.map((call) => (
                  <button
                    key={call._id}
                    type="button"
                    onClick={() => setSelectedCallId(call._id)}
                    className={cx(
                      "w-full px-4 py-4 text-left transition-colors",
                      selectedCall._id === call._id ? "bg-[var(--accent-softer)]" : "hover:bg-[var(--bg-sunken)]",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate [font:var(--text-body-sm)] font-semibold text-[var(--text-heading)]">
                          {call.participant?.name ?? "Participant call"}
                        </span>
                        <span className="mt-1 block [font:var(--text-caption)] text-[var(--text-muted)]">
                          {formatDate(call.createdAt)}{call.durationSeconds ? ` · ${Math.ceil(call.durationSeconds / 60)} min` : ""}
                        </span>
                      </span>
                      <Badge tone={call.status === "completed" ? "success" : call.status === "failed" ? "danger" : "info"}>
                        {formatStatus(call.status)}
                      </Badge>
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <article className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-default)] px-6 py-5">
                <div>
                  <h2 className="[font:var(--text-heading-sm)] text-[var(--text-heading)]">
                    {selectedCall.participant?.name ?? "Participant call"}
                  </h2>
                  <p className="mt-1 [font:var(--text-caption)] text-[var(--text-muted)]">
                    {formatDate(selectedCall.createdAt)}
                    {selectedCall.durationSeconds ? ` · ${Math.ceil(selectedCall.durationSeconds / 60)} min` : ""}
                    {selectedCall.terminationReason ? ` · ${selectedCall.terminationReason}` : ""}
                  </p>
                </div>
                <Badge tone={selectedCall.status === "completed" ? "success" : selectedCall.status === "failed" ? "danger" : "info"}>
                  {formatStatus(selectedCall.status)}
                </Badge>
              </div>
              {selectedCall.status === "scheduled" || selectedCall.status === "processing" ? (
                <div className="flex items-center gap-3 px-6 py-6 [font:var(--text-body-sm)] text-[var(--text-secondary)]">
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  Transcript ingestion scheduled{selectedCall.attempts ? ` · retry ${selectedCall.attempts}` : ""}
                </div>
              ) : selectedCall.status === "failed" ? (
                <p className="px-6 py-6 [font:var(--text-body-sm)] text-[var(--status-danger)]">{selectedCall.error}</p>
              ) : (
                <div className="grid gap-8 px-6 py-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <section>
                    <h3 className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">Transcript</h3>
                    <div className="mt-4 space-y-4">
                      {(selectedCall.transcript ?? []).map((turn, index) => (
                        <div key={`${turn.timeInCallSeconds ?? index}-${index}`}>
                          <p className="[font:var(--text-caption)] uppercase text-[var(--text-muted)]">{turn.role}</p>
                          <p className="mt-1 [font:var(--text-body-sm)] text-[var(--text-secondary)]">{turn.message}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="bg-[var(--bg-sunken)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="[font:var(--text-body)] font-semibold text-[var(--text-heading)]">Analysis</h3>
                      {selectedCall.qualityScores ? (
                        <span className="[font:var(--text-heading-sm)] text-[var(--accent-active)]">
                          {selectedCall.qualityScores.overall}<span className="[font:var(--text-caption)] text-[var(--text-muted)]">/100</span>
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 [font:var(--text-body-sm)] text-[var(--text-secondary)]">{selectedCall.analysis?.summary}</p>
                    {selectedCall.qualityScores ? (
                      <div className="mt-4 space-y-2 border-t border-[var(--border-default)] pt-4">
                        <ScoreRow label="Goal coverage" value={selectedCall.qualityScores.goalCoverage} />
                        <ScoreRow label="Response depth" value={selectedCall.qualityScores.responseDepth} />
                        <ScoreRow label="Specificity" value={selectedCall.qualityScores.specificity} />
                        <ScoreRow label="Engagement" value={selectedCall.qualityScores.engagement} />
                        <ScoreRow label="Interviewer" value={selectedCall.qualityScores.interviewerQuality} />
                      </div>
                    ) : null}
                    {selectedCall.analysis?.themes.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">{selectedCall.analysis.themes.map((theme) => <Badge key={theme}>{theme}</Badge>)}</div>
                    ) : null}
                    <p className="mt-4 [font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">{selectedCall.analysis?.completionAssessment}</p>
                  </section>
                </div>
              )}
            </article>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CallMetric({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="px-5 py-4">
      <p className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 [font:var(--text-heading-sm)] text-[var(--text-heading)]">
        {value}{suffix ? <span className="ml-1 [font:var(--text-caption)] text-[var(--text-muted)]">{suffix}</span> : null}
      </p>
    </div>
  );
}

type CallAnalyticsSummary = {
  analyzedCalls: number;
  averageScores: {
    overall: number;
    goalCoverage: number;
    responseDepth: number;
    specificity: number;
    engagement: number;
    interviewerQuality: number;
  };
  sentiment: Array<{ label: string; count: number }>;
  themes: Array<{ label: string; count: number }>;
  painPoints: Array<{ label: string; count: number }>;
  needs: Array<{ label: string; count: number }>;
  opportunities: Array<{ label: string; count: number }>;
};

function buildCallInsightHeadline(analytics: CallAnalyticsSummary) {
  const pain = analytics.painPoints[0]?.label;
  const need = analytics.needs[0]?.label;
  if (pain && need) return `${pain} is the clearest friction, while ${need} is the strongest expressed need.`;
  if (pain) return `${pain} is the most repeated friction across current interviews.`;
  if (need) return `${need} is the strongest need emerging from current interviews.`;
  return "Early interviews are producing usable signal, with more calls needed for stable patterns.";
}

function buildCallInsightSummary(analytics: CallAnalyticsSummary) {
  const theme = analytics.themes[0]?.label;
  const opportunity = analytics.opportunities[0]?.label;
  const parts = [
    theme ? `The leading theme is ${theme}.` : null,
    opportunity ? `The clearest opportunity is ${opportunity}.` : null,
    `Average research value is ${analytics.averageScores.overall}/100, with ${analytics.averageScores.goalCoverage}/100 goal coverage.`,
  ];
  return parts.filter(Boolean).join(" ");
}

function ScoreProfile({ scores }: { scores: CallAnalyticsSummary["averageScores"] }) {
  const rows = [
    ["Goal coverage", scores.goalCoverage],
    ["Response depth", scores.responseDepth],
    ["Specificity", scores.specificity],
    ["Engagement", scores.engagement],
    ["Interviewer", scores.interviewerQuality],
  ] as const;
  return (
    <div>
      <p className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">Score profile</p>
      <div className="mt-4 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between gap-3 [font:var(--text-caption)] text-[var(--text-secondary)]">
              <span>{label}</span><span>{value}</span>
            </div>
            <div className="h-2 bg-[var(--ivory-300)]">
              <div className="h-full bg-[var(--accent)]" style={{ width: `${value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SentimentBar({ items, total }: { items: Array<{ label: string; count: number }>; total: number }) {
  const colors: Record<string, string> = {
    positive: "#4f7d61",
    neutral: "#a9a397",
    negative: "#b94f45",
    mixed: "#c28a3b",
  };
  return (
    <div className="mt-4">
      <div className="flex h-3 overflow-hidden bg-[var(--ivory-300)]">
        {items.map((item) => (
          <span key={item.label} style={{ width: `${(item.count / total) * 100}%`, background: colors[item.label] ?? "#777" }} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 [font:var(--text-body-sm)] text-[var(--text-secondary)]">
            <span className="flex items-center gap-2 capitalize"><span className="size-2" style={{ background: colors[item.label] ?? "#777" }} />{item.label}</span>
            <span>{Math.round((item.count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CallScoreChart({ calls }: { calls: Array<{ _id: string; participant?: { name: string } | null; qualityScores?: { overall: number } }> }) {
  const scored = calls.filter((call) => call.qualityScores).slice(0, 8).reverse();
  return (
    <div>
      <p className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">Call quality</p>
      <div className="mt-4 flex h-36 items-end gap-3 border-b border-[var(--border-default)] pb-1">
        {scored.map((call, index) => (
          <div key={call._id} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <span className="[font:var(--text-caption)] text-[var(--text-secondary)]">{call.qualityScores?.overall}</span>
            <span className="w-full max-w-8 bg-[var(--accent)]" style={{ height: `${call.qualityScores?.overall ?? 0}%` }} />
            <span className="w-full truncate text-center [font:var(--text-caption)] text-[var(--text-muted)]" title={call.participant?.name}>
              {call.participant?.name?.split(" ")[0] ?? `C${index + 1}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignalBars({ items }: { items: Array<{ label: string; count: number }> }) {
  const ranked = [...items.reduce((counts, item) => {
    counts.set(item.label, (counts.get(item.label) ?? 0) + item.count);
    return counts;
  }, new Map<string, number>()).entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const max = Math.max(...ranked.map((item) => item.count), 1);
  return (
    <div>
      <p className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">Recurring signals</p>
      <div className="mt-4 space-y-3">
        {ranked.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between gap-3 [font:var(--text-caption)] text-[var(--text-secondary)]">
              <span className="truncate">{item.label}</span><span>{item.count}</span>
            </div>
            <div className="h-2 bg-[var(--ivory-300)]"><div className="h-full bg-[#4f756b]" style={{ width: `${(item.count / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)_28px] items-center gap-2">
      <span className="[font:var(--text-caption)] text-[var(--text-muted)]">{label}</span>
      <span className="h-1.5 overflow-hidden bg-[var(--ivory-300)]">
        <span className="block h-full bg-[var(--accent)]" style={{ width: `${value}%` }} />
      </span>
      <span className="text-right [font:var(--text-caption)] text-[var(--text-secondary)]">{value}</span>
    </div>
  );
}

function FeedbackSkeleton() {
  return (
    <SkeletonGrid
      title="Feedback"
      description="Respondent evidence will appear here after interviews produce persisted answers, quotes, and themes."
      items={["Quotes", "Themes", "Objections", "Evidence tags"]}
    />
  );
}

function ArtifactsSkeleton() {
  return (
    <SkeletonGrid
      title="Artifacts"
      description="Generated reports, exports, and source files will collect here after the study has evidence to synthesize."
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
              Not active for this study yet.
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

function safeMutationError(message: string) {
  if (message.includes("Title and business decision are required")) {
    return "Enter a study title and describe the decision this study should inform.";
  }
  if (message.includes("[CONVEX")) {
    return "Meridian could not save that change. Please try again.";
  }
  return message || "Meridian could not save that change. Please try again.";
}
