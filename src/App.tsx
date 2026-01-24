import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { Alert } from "./components/Alert/Alert";
import { CounterCard } from "./components/CounterCard/CounterCard";
import { FeatureCard } from "./components/FeatureCard/FeatureCard";
import { Footer } from "./components/Footer/Footer";
import { Logo } from "./components/Logo/Logo";
import { Navbar } from "./components/Navbar/Navbar";
import ThemeSelector from "./components/ThemeSelector/ThemeSelector";
import { ToolItem } from "./components/ToolItem/ToolItem";
import viteLogo from "/vite.svg";

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

  const handleIncrement = (): void => {
    setCount((prevCount) => prevCount + 1);
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <Navbar title="Apenas Template">
        <ThemeSelector />
      </Navbar>

      <div className="hero flex-1 justify-center">
        <div className="hero-content text-center">
          <div className="max-w-4xl">
            <div className="flex justify-center gap-8 mb-8">
              <Logo
                src={viteLogo}
                alt="Vite logo"
                href="https://vite.dev"
                testId="vite-logo"
              />
              <Logo
                src={reactLogo}
                alt="React logo"
                href="https://react.dev"
                testId="react-logo"
                animated
              />
            </div>

            <h1 className="text-5xl font-bold mb-4" data-testid="main-title">
              Vite + React + TypeScript
            </h1>
            <p className="text-xl mb-8" data-testid="main-description">
              Template com Tailwind CSS e daisyUI configurados
            </p>

            <CounterCard count={count} onIncrement={handleIncrement} />

            <div
              className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
              data-testid="feature-cards"
            >
              <FeatureCard
                title="Vite"
                description="Build rápido e HMR instantâneo"
                version={VERSIONS.vite}
                href="https://vite.dev"
                variant="primary"
                testId="vite-card"
              />
              <FeatureCard
                title="Tailwind CSS"
                description="Utility-first CSS framework"
                version={VERSIONS.tailwind}
                href="https://tailwindcss.com"
                variant="secondary"
                testId="tailwind-card"
              />
              <FeatureCard
                title="daisyUI"
                description="Componentes prontos para uso"
                version={VERSIONS.daisyui}
                href="https://daisyui.com"
                variant="accent"
                testId="daisyui-card"
              />
            </div>

            <Alert testId="info-alert">
              Edite{" "}
              <code className="font-mono bg-base-200 px-2 py-1 rounded">
                src/App.tsx
              </code>{" "}
              e salve para testar o HMR
            </Alert>

            <div className="mt-12 text-left" data-testid="tools-section">
              <h2 className="text-2xl font-bold mb-6 text-center">
                Ferramentas Incluídas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ToolItem icon="⚡" name="React" version={VERSIONS.react} />
                <ToolItem
                  icon="📘"
                  name="TypeScript"
                  version={VERSIONS.typescript}
                />
                <ToolItem icon="🧪" name="Vitest" version={VERSIONS.vitest} />
                <ToolItem
                  icon="🎭"
                  name="Playwright"
                  version={VERSIONS.playwright}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default App;
