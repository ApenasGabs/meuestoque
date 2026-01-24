import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-base-200">
      {/* Navbar */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl">Apenas Template</a>
        </div>
        <div className="flex-none">
          <button className="btn btn-square btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-5 h-5 stroke-current">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="hero min-h-[80vh]">
        <div className="hero-content text-center">
          <div className="max-w-4xl">
            <div className="flex justify-center gap-8 mb-8">
              <a href="https://vite.dev" target="_blank" rel="noreferrer">
                <img src={viteLogo} className="h-24 hover:drop-shadow-[0_0_2em_#646cffaa] transition-all" alt="Vite logo" />
              </a>
              <a href="https://react.dev" target="_blank" rel="noreferrer">
                <img src={reactLogo} className="h-24 hover:drop-shadow-[0_0_2em_#61dafbaa] transition-all animate-spin-slow" alt="React logo" />
              </a>
            </div>
            
            <h1 className="text-5xl font-bold mb-4">Vite + React + TypeScript</h1>
            <p className="text-xl mb-8">Template com Tailwind CSS e daisyUI configurados</p>
            
            <div className="card bg-base-100 shadow-xl mb-8">
              <div className="card-body">
                <h2 className="card-title justify-center">Contador de Exemplo</h2>
                <div className="flex flex-col gap-4 items-center">
                  <button 
                    className="btn btn-primary btn-lg"
                    onClick={() => setCount((count) => count + 1)}
                  >
                    Contagem: {count}
                  </button>
                  <div className="badge badge-secondary">
                    Clique no botão para incrementar
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="card bg-primary text-primary-content">
                <div className="card-body">
                  <h2 className="card-title">Vite</h2>
                  <p>Build rápido e HMR instantâneo</p>
                </div>
              </div>
              <div className="card bg-secondary text-secondary-content">
                <div className="card-body">
                  <h2 className="card-title">Tailwind CSS</h2>
                  <p>Utility-first CSS framework</p>
                </div>
              </div>
              <div className="card bg-accent text-accent-content">
                <div className="card-body">
                  <h2 className="card-title">daisyUI</h2>
                  <p>Componentes prontos para uso</p>
                </div>
              </div>
            </div>

            <div className="alert alert-info">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>Edite <code className="font-mono bg-base-200 px-2 py-1 rounded">src/App.tsx</code> e salve para testar o HMR</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer footer-center p-4 bg-base-300 text-base-content">
        <aside>
          <p>Template React + TypeScript + Vite + Tailwind CSS + daisyUI</p>
        </aside>
      </footer>
    </div>
  )
}

export default App
