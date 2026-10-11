import { FORMATS } from '@designhub/shared';

/** Platzhalter für Etappe (a). Routing, Auth und Dashboard folgen in den nächsten Etappen. */
export function App() {
  return (
    <main className="min-h-screen grid place-items-center">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold bg-brand bg-clip-text text-transparent">DesignHub</h1>
        <p className="text-muted-foreground">Setup steht. {Object.keys(FORMATS).length} Formate im Shared-Paket geladen.</p>
      </div>
    </main>
  );
}
