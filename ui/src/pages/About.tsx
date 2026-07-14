import { ShieldCheck, Zap, Server } from 'lucide-react';

export default function About() {
  return (
    <div className="flex h-full flex-col relative animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="p-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">About</h1>
          <p className="text-muted-foreground mt-1 text-sm">Information about Kamna Event Gateway.</p>
        </div>
      </div>

      <div className="flex-1 p-8 pt-0 overflow-auto">
        <div className="max-w-3xl space-y-8">
          
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background p-8 border-b">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-primary text-primary-foreground rounded-xl shadow-lg">
                  <Zap className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Kamna Event Gateway</h2>
                  <p className="text-muted-foreground font-mono text-sm">v0.0.1-mvp</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed max-w-xl">
                A high-performance, stateless fan-out proxy engineered to safely ingest HTTP webhooks, 
                persist domain events securely to SQLite, and dispatch them synchronously to multiple downstream 
                destinations with robust delivery guarantees.
              </p>
            </div>

            <div className="p-8 grid gap-6 md:grid-cols-2 bg-muted/10">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <ShieldCheck className="w-5 h-5" /> Enterprise Grade
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Engineered with strict TypeScript configurations, payload validation, HMAC signature verification, 
                  and granular delivery tracking to ensure absolute transparency and security in data flows.
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <Server className="w-5 h-5" /> High Performance
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Built on top of Fastify and Drizzle ORM to process thousands of inbound HTTP requests rapidly 
                  while managing background I/O operations elegantly without blocking the main event loop.
                </p>
              </div>
            </div>
          </div>
          
          <div className="text-center text-xs text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Kamna. All rights reserved.</p>
            <p className="mt-1">Built with React, Vite, Tailwind CSS, and TanStack Query.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
