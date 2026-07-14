import { useConvex } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { BrandPage } from "@/features/brand/BrandPage";
import {
  createBrandAdapter,
  createKnowledgeAdapter,
  createMemoryAdapter,
} from "@/features/context/convexAdapters";
import { KnowledgePage } from "@/features/knowledge/KnowledgePage";
import { CompanyMemoryPage } from "@/features/memory/CompanyMemoryPage";
import { PortalApp } from "./PortalApp";

export function FeaturePortal({ page, pathname }: { page: "knowledge" | "memory" | "brand"; pathname: string }) {
  const convex = useConvex();
  const adapters = useMemo(() => {
    const knowledge = createKnowledgeAdapter({
      list: (args) => convex.query(api.knowledge.list, { studyId: args.studyId as Id<"studies"> | undefined }),
      generateUploadUrl: (args) => convex.mutation(api.knowledge.generateUploadUrl, { studyId: args.studyId as Id<"studies"> | undefined }),
      async uploadFile(uploadUrl, file) {
        const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
        if (!response.ok) throw new Error("The file upload failed");
        return await response.json() as { storageId: string };
      },
      submitLink: (args) => convex.mutation(api.knowledge.submitLink, { ...args, studyId: args.studyId as Id<"studies"> | undefined }),
      submitUpload: (args) => convex.mutation(api.knowledge.submitUpload, { ...args, studyId: args.studyId as Id<"studies"> | undefined, storageId: args.storageId as Id<"_storage"> }),
      retry: async (args) => { await convex.mutation(api.knowledge.retry, { sourceId: args.sourceId as Id<"knowledgeSources"> }); },
      remove: async (args) => { await convex.mutation(api.knowledge.remove, { sourceId: args.sourceId as Id<"knowledgeSources"> }); },
    });
    const memory = createMemoryAdapter({
      listCompany: () => convex.query(api.companyMemory.list, {}),
      listStudy: (args) => convex.query(api.studyMemory.list, { studyId: args.studyId as Id<"studies"> }),
      createCompany: (args) => convex.mutation(api.companyMemory.create, args),
      createStudy: (args) => convex.mutation(api.studyMemory.create, { ...args, studyId: args.studyId as Id<"studies"> }),
      updateCompany: async (args) => { await convex.mutation(api.companyMemory.update, { ...args, memoryId: args.memoryId as Id<"organizationMemories"> }); },
      updateStudy: async (args) => { await convex.mutation(api.studyMemory.update, { ...args, memoryId: args.memoryId as Id<"studyMemories"> }); },
      archiveCompany: async (args) => { await convex.mutation(api.companyMemory.archive, { memoryId: args.memoryId as Id<"organizationMemories"> }); },
      archiveStudy: async (args) => { await convex.mutation(api.studyMemory.archive, { memoryId: args.memoryId as Id<"studyMemories"> }); },
    });
    const brand = createBrandAdapter({
      getProfile: () => convex.query(api.brandProfiles.getProfile, {}),
      updateProfile: async (profile) => { await convex.mutation(api.brandProfiles.updateProfile, profile); },
      generateLogoUploadUrl: () => convex.mutation(api.brandProfiles.generateLogoUploadUrl, {}),
      async uploadFile(uploadUrl, file) {
        const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
        if (!response.ok) throw new Error("The logo upload failed");
        return await response.json() as { storageId: string };
      },
      setLogo: async (args) => { await convex.mutation(api.brandProfiles.setLogo, { storageId: args.storageId as Id<"_storage">, logoName: args.logoName }); },
      removeLogo: async () => { await convex.mutation(api.brandProfiles.removeLogo, {}); },
    });
    return { brand, knowledge, memory };
  }, [convex]);

  return (
    <PortalApp currentPath={pathname} workspaceName="Company workspace">
      {page === "knowledge" ? <KnowledgePage adapter={adapters.knowledge} scope={{ kind: "company" }} /> : null}
      {page === "memory" ? <CompanyMemoryPage adapter={adapters.memory} /> : null}
      {page === "brand" ? <BrandPage adapter={adapters.brand} /> : null}
    </PortalApp>
  );
}
