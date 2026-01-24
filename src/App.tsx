import { useState } from "react";
import reactLogo from "./assets/react.svg";
import ThemeSelector from "./components/ThemeSelector/ThemeSelector";
import viteLogo from "/vite.svg";

// Versões dos pacotes
const VERSIONS = {
  vite: "7.2.4",
  react: "19.2.0",
  typescript: "5.9.3",
  tailwind: "4.1.18",
  daisyui: "5.5.14",
  vitest: "4.0.18",
  playwright: "1.58.0",
};

const App = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      {/* Navbar */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl" data-testid="navbar-title">
            Apenas Template
          </a>
        </div>
        <div className="flex-none gap-4">
          <ThemeSelector />
          <button className="btn btn-square btn-ghost">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="inline-block w-5 h-5 stroke-current"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
              ></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="hero flex-1 justify-center">
        <div className="hero-content text-center">
          <div className="max-w-4xl">
            <div className="flex justify-center gap-8 mb-8">
              <a href="https://vite.dev" target="_blank" rel="noreferrer">
                <img
                  src={viteLogo}
                  className="h-24 hover:drop-shadow-[0_0_2em_#646cffaa] transition-all"
                  alt="Vite logo"
                  data-testid="vite-logo"
                />
              </a>
              <a href="https://react.dev" target="_blank" rel="noreferrer">
                <img
                  src={reactLogo}
                  className="h-24 hover:drop-shadow-[0_0_2em_#61dafbaa] transition-all animate-spin-slow"
                  alt="React logo"
                  data-testid="react-logo"
                />
              </a>
            </div>

            <h1 className="text-5xl font-bold mb-4" data-testid="main-title">
              Vite + React + TypeScript
            </h1>
            <p className="text-xl mb-8" data-testid="main-description">
              Template com Tailwind CSS e daisyUI configurados
            </p>

            <div
              className="card bg-base-100 shadow-xl mb-8"
              data-testid="counter-card"
            >
              <div className="card-body items-center text-center">
                <h2 className="card-title">Contador de Exemplo</h2>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => setCount((count) => count + 1)}
                  data-testid="counter-button"
                >
                  Contagem: {count}
                </button>
                <div
                  className="badge badge-secondary"
                  data-testid="counter-hint"
                >
                  Clique no botão para incrementar
                </div>
              </div>
            </div>

            <div
              className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
              data-testid="feature-cards"
            >
              <a
                href="https://vite.dev"
                target="_blank"
                rel="noreferrer"
                className="card bg-primary text-primary-content hover:shadow-lg transition-shadow"
                data-testid="vite-card"
              >
                <div className="card-body items-center text-center">
                  <h2 className="card-title">Vite</h2>
                  <p>Build rápido e HMR instantâneo</p>
                  <div className="divider my-2"></div>
                  <p className="text-sm opacity-90">v{VERSIONS.vite}</p>
                </div>
              </a>

              <a
                href="https://tailwindcss.com"
                target="_blank"
                rel="noreferrer"
                className="card bg-secondary text-secondary-content hover:shadow-lg transition-shadow"
                data-testid="tailwind-card"
              >
                <div className="card-body items-center text-center">
                  <h2 className="card-title">Tailwind CSS</h2>
                  <p>Utility-first CSS framework</p>
                  <div className="divider my-2"></div>
                  <p className="text-sm opacity-90">v{VERSIONS.tailwind}</p>
                </div>
              </a>

              <a
                href="https://daisyui.com"
                target="_blank"
                rel="noreferrer"
                className="card bg-accent text-accent-content hover:shadow-lg transition-shadow"
                data-testid="daisyui-card"
              >
                <div className="card-body items-center text-center">
                  <h2 className="card-title">daisyUI</h2>
                  <p>Componentes prontos para uso</p>
                  <div className="divider my-2"></div>
                  <p className="text-sm opacity-90">v{VERSIONS.daisyui}</p>
                </div>
              </a>
            </div>

            <div className="alert alert-info" data-testid="info-alert">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="stroke-current shrink-0 w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              <span>
                Edite{" "}
                <code className="font-mono bg-base-200 px-2 py-1 rounded">
                  src/App.tsx
                </code>{" "}
                e salve para testar o HMR
              </span>
            </div>

            {/* Other Tools Section */}
            <div className="mt-12 text-left" data-testid="tools-section">
              <h2 className="text-2xl font-bold mb-6 text-center">
                Ferramentas Incluídas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-base-100 rounded-lg">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <p className="font-semibold">React</p>
                    <p className="text-sm opacity-75">v{VERSIONS.react}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-base-100 rounded-lg">
                  <span className="text-2xl">📘</span>
                  <div>
                    <p className="font-semibold">TypeScript</p>
                    <p className="text-sm opacity-75">v{VERSIONS.typescript}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-base-100 rounded-lg">
                  <span className="text-2xl">🧪</span>
                  <div>
                    <p className="font-semibold">Vitest</p>
                    <p className="text-sm opacity-75">v{VERSIONS.vitest}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-base-100 rounded-lg">
                  <span className="text-2xl">🎭</span>
                  <div>
                    <p className="font-semibold">Playwright</p>
                    <p className="text-sm opacity-75">v{VERSIONS.playwright}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer footer-center p-4 bg-base-300 text-base-content">
        <aside>
          <p>Template React + TypeScript + Vite + Tailwind CSS + daisyUI</p>
          <p className="text-sm opacity-75">
            Feito com muito ❤️ e preguiça de fazer tudo do zero por{" "}
            <a
              href="https://github.com/apenasgabs"
              target="_blank"
              rel="noreferrer"
              className="link link-primary"
            >
              ApenasGabs
            </a>
          </p>
        </aside>
      </footer>
    </div>
  );
};

export default App;
