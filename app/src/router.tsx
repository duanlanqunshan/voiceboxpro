import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { Suspense, lazy } from 'react';
import { AppFrame } from '@/components/AppFrame/AppFrame';
import { MainEditor } from '@/components/MainEditor/MainEditor';
import { Sidebar } from '@/components/Sidebar';
import { Toaster } from '@/components/ui/toaster';
import { useGenerationProgress } from '@/lib/hooks/useGenerationProgress';
import { useModelDownloadToast } from '@/lib/hooks/useModelDownloadToast';
import { MODEL_DISPLAY_NAMES, useRestoreActiveTasks } from '@/lib/hooks/useRestoreActiveTasks';

const StoriesTab = lazy(() => import('@/components/StoriesTab/StoriesTab').then((m) => ({ default: m.StoriesTab })));
const VoicesTab = lazy(() => import('@/components/VoicesTab/VoicesTab').then((m) => ({ default: m.VoicesTab })));
const CapturesTab = lazy(() => import('@/components/CapturesTab/CapturesTab').then((m) => ({ default: m.CapturesTab })));
const EffectsTab = lazy(() => import('@/components/EffectsTab/EffectsTab').then((m) => ({ default: m.EffectsTab })));
const SRTTab = lazy(() => import('@/components/SRTTab/SRTTab').then((m) => ({ default: m.SRTTab })));
const ModelsTab = lazy(() => import('@/components/ModelsTab/ModelsTab').then((m) => ({ default: m.ModelsTab })));
const SettingsLayout = lazy(() => import('@/components/ServerTab/ServerTab').then((m) => ({ default: m.SettingsLayout })));
const GeneralPage = lazy(() => import('@/components/ServerTab/GeneralPage').then((m) => ({ default: m.GeneralPage })));
const GenerationPage = lazy(() => import('@/components/ServerTab/GenerationPage').then((m) => ({ default: m.GenerationPage })));
const CapturesPage = lazy(() => import('@/components/ServerTab/CapturesPage').then((m) => ({ default: m.CapturesPage })));
const MCPPage = lazy(() => import('@/components/ServerTab/MCPPage').then((m) => ({ default: m.MCPPage })));
const GpuPage = lazy(() => import('@/components/ServerTab/GpuPage').then((m) => ({ default: m.GpuPage })));
const LogsPage = lazy(() => import('@/components/ServerTab/LogsPage').then((m) => ({ default: m.LogsPage })));
const ChangelogPage = lazy(() => import('@/components/ServerTab/ChangelogPage').then((m) => ({ default: m.ChangelogPage })));
const AboutPage = lazy(() => import('@/components/ServerTab/AboutPage').then((m) => ({ default: m.AboutPage })));

function RouteSkeleton() {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <div className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin" />
        正在加载页面...
      </div>
    </div>
  );
}

function withSuspense(Component: React.ComponentType) {
  return function SuspendedRouteComponent() {
    return (
      <Suspense fallback={<RouteSkeleton />}>
        <Component />
      </Suspense>
    );
  };
}

// Simple platform check that works in both web and Tauri
const isMacOS = () => navigator.platform.toLowerCase().includes('mac');

// Root layout component
function RootLayout() {
  // Monitor active downloads/generations and show toasts for them
  const activeDownloads = useRestoreActiveTasks();

  // Subscribe to SSE for pending generations — handles completion, auto-play, and history refresh
  useGenerationProgress();

  return (
    <AppFrame>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar isMacOS={isMacOS()} />

        <main className="flex-1 ml-20 overflow-hidden flex flex-col">
          <div className="container mx-auto px-8 max-w-[1800px] h-full overflow-hidden flex flex-col">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Show download toasts for any active downloads (from anywhere) */}
      {activeDownloads.map((download) => {
        const displayName = MODEL_DISPLAY_NAMES[download.model_name] || download.model_name;
        return (
          <DownloadToastRestorer
            key={download.model_name}
            modelName={download.model_name}
            displayName={displayName}
          />
        );
      })}

      <Toaster />
    </AppFrame>
  );
}

/**
 * Component that restores a download toast for a specific model.
 */
function DownloadToastRestorer({
  modelName,
  displayName,
}: {
  modelName: string;
  displayName: string;
}) {
  // Use the download toast hook to restore the toast
  useModelDownloadToast({
    modelName,
    displayName,
    enabled: true,
  });

  return null;
}

// Root route with layout
const rootRoute = createRootRoute({
  component: RootLayout,
});

// Index route (main/generate)
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: MainEditor,
});

// Stories route
const storiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stories',
  component: withSuspense(StoriesTab),
});

// Voices route
const voicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/voices',
  component: withSuspense(VoicesTab),
});

// Captures route (prototype — will replace AudioTab once the new flow is ready)
const capturesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/captures',
  component: withSuspense(CapturesTab),
});

// Effects route
const effectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/effects',
  component: withSuspense(EffectsTab),
});

const srtRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/srt',
  component: withSuspense(SRTTab),
});

const modelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/models',
  component: withSuspense(ModelsTab),
});

// Settings layout route (parent for sub-tabs)
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: withSuspense(SettingsLayout),
});

// Settings sub-routes
const settingsGeneralRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/',
  component: withSuspense(GeneralPage),
});

const settingsGenerationRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/generation',
  component: withSuspense(GenerationPage),
});

const settingsCapturesRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/captures',
  component: withSuspense(CapturesPage),
});

const settingsMCPRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/mcp',
  component: withSuspense(MCPPage),
});

const settingsGpuRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/gpu',
  component: withSuspense(GpuPage),
});

const settingsChangelogRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/changelog',
  component: withSuspense(ChangelogPage),
});

const settingsLogsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/logs',
  component: withSuspense(LogsPage),
});

const settingsAboutRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/about',
  component: withSuspense(AboutPage),
});

// Redirect old /server path to /settings
const serverRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/server',
  beforeLoad: () => {
    throw redirect({ to: '/settings' });
  },
});

// Route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  storiesRoute,
  capturesRoute,
  voicesRoute,
  effectsRoute,
  srtRoute,
  modelsRoute,
  settingsRoute.addChildren([
    settingsGeneralRoute,
    settingsGenerationRoute,
    settingsCapturesRoute,
    settingsMCPRoute,
    settingsGpuRoute,
    settingsLogsRoute,
    settingsChangelogRoute,
    settingsAboutRoute,
  ]),
  serverRedirectRoute,
]);

// Create router
export const router = createRouter({ routeTree });

// Register router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
