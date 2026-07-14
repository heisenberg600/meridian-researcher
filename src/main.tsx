import { ClerkProvider } from "@clerk/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ConfigurationError, ConvexClientProvider } from "./components/convex-client-provider";
import "./index.css";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function Root() {
  if (!clerkPublishableKey) {
    return <ConfigurationError missing="VITE_CLERK_PUBLISHABLE_KEY" />;
  }
  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ConvexClientProvider>
        <App />
      </ConvexClientProvider>
    </ClerkProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
