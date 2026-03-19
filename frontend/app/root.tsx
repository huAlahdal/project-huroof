import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap",
  },
];

// Inline script to set theme before first render (prevents flash)
const themeScript = `
  try {
    var t = localStorage.getItem('huroof_theme');
    if (t === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch(e) {}
`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>حروف مع كشمير — لعبة ثقافية تفاعلية</title>
        <meta name="description" content="لعبة حروف مع كشمير التفاعلية — تحدي ثقافي للفرق" />
        <Meta />
        <Links />
        {/* Inject theme before paint to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "خطأ!";
  let details = "حدث خطأ غير متوقع.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "خطأ";
    details =
      error.status === 404
        ? "الصفحة المطلوبة غير موجودة."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="game-bg min-h-screen flex items-center justify-center p-4">
      <div className="glass-card p-8 text-center max-w-md">
        <h1 className="text-4xl font-black mb-4" style={{ color: "var(--text-1)" }}>{message}</h1>
        <p style={{ color: "var(--text-2)" }}>{details}</p>
        {stack && (
          <pre className="mt-4 text-xs overflow-x-auto text-left" dir="ltr" style={{ color: "var(--text-3)" }}>
            <code>{stack}</code>
          </pre>
        )}
      </div>
    </main>
  );
}
