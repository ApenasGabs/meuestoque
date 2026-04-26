# 📝 Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.7.0](https://github.com/ApenasGabs/meuestoque/compare/v1.6.1...v1.7.0) (2026-04-26)

### ✨ Features

* :boom:  enhance stock item details with batch cost analysis, pack size conversions, and inventory auto-consumption configuration. ([83bf2eb](https://github.com/ApenasGabs/meuestoque/commit/83bf2eb42f3cde1f5130bb9dda723e3651687182))

### 📚 Documentation

* :books: standardize component JSDoc comments, update project documentation, and add comprehensive QA test assets. ([184dd5c](https://github.com/ApenasGabs/meuestoque/commit/184dd5cec86cdb94218915ea89c3dbee73a87aae))

## [1.6.1](https://github.com/ApenasGabs/meuestoque/compare/v1.6.0...v1.6.1) (2026-04-24)

### ♻️ Refactoring

* :broom: migrate and consolidate stock inventory components, update domain logic, and clean up project documentation ([2ba6967](https://github.com/ApenasGabs/meuestoque/commit/2ba69672d516697c71b8662e86020f6fd10e2ad5))

## [1.6.0](https://github.com/ApenasGabs/meuestoque/compare/v1.5.0...v1.6.0) (2026-04-24)

### ✨ Features

* :wrench: refactor product cards for improved UI, add unit select input, include shopping list totals ([c971774](https://github.com/ApenasGabs/meuestoque/commit/c971774e1a4f579f72353c781207ff5a91dc8c57))

### 🧱 CI/CD

* :wrench: trigger vercel deploy via webhook after semantic-release ([3a0d2bd](https://github.com/ApenasGabs/meuestoque/commit/3a0d2bd062fc73958f5bffc15d7be647821c744e))

## [1.5.0](https://github.com/ApenasGabs/meuestoque/compare/v1.4.0...v1.5.0) (2026-04-24)

### ✨ Features

* :sparkles: rebrand application as Meu Estoque, implement login redirect, and integrate Vercel Analytics ([ba5f115](https://github.com/ApenasGabs/meuestoque/commit/ba5f115491838a32ca93099f7d331f7222a9f049))

### 🐛 Bug Fixes

* :wrench:  Vercel deployment configuration, add analytics, and update app branding and routing logic ([4373eef](https://github.com/ApenasGabs/meuestoque/commit/4373eef6e2d84358c45039cdd2dfdfe03f4a7980))

### ♻️ Refactoring

* :broom: replace legacy documentation with organized AI knowledge base and add database migration scripts for shopping list finalization. ([471d3b7](https://github.com/ApenasGabs/meuestoque/commit/471d3b75622d894193ad6abe4a54ab9b8801abad))

## [1.4.0](https://github.com/ApenasGabs/meuestoque/compare/v1.3.0...v1.4.0) (2026-04-24)

### ✨ Features

* :boom: :sparkles: add end-to-end tests for authentication and core flow ([2d0b49f](https://github.com/ApenasGabs/meuestoque/commit/2d0b49fd104ff9a6c4546c0de74cd9e025f764cd))
* **inventory:** :wrench: enhance inventory management with new features and UI improvements ([acc6e79](https://github.com/ApenasGabs/meuestoque/commit/acc6e794510f9b4ecc8b04c9f2e71a8ef896c842))

## [1.3.0](https://github.com/ApenasGabs/meuestoque/compare/v1.2.0...v1.3.0) (2026-04-23)

### ✨ Features

* :boom: Implement UI/UX restructuring for inventory management ([a3574a9](https://github.com/ApenasGabs/meuestoque/commit/a3574a9bbd5daa82c2c6e0fbb4b09ba391cee33b))
* :sparkles: add forced failure test for remote E2E flows and update scripts for execution ([63608d5](https://github.com/ApenasGabs/meuestoque/commit/63608d55d286d956ea3453c50947a71705cd7e5d))
* :sparkles: add Inventory management components including StockView, ShoppingListView, CategorySection, ProductCard, and ProductFormModal ([aa1e188](https://github.com/ApenasGabs/meuestoque/commit/aa1e1887aedd20d9193f4a49b1c13ecf429ed9e5))
* :sparkles: enhance application structure with routing, add new E2E scripts, and update dependencies ([f38b438](https://github.com/ApenasGabs/meuestoque/commit/f38b438386a9e91924d6133d9513d9a412700232))
* :sparkles: implement remote E2E testing for tablet with Playwright, including login, logout, and theme management flows ([a55cee7](https://github.com/ApenasGabs/meuestoque/commit/a55cee7a16058c0ddf197b41956b957848f8b55f))
* :sparkles: implement remote E2E testing setup with Playwright and enhance theme management ([d5be620](https://github.com/ApenasGabs/meuestoque/commit/d5be620804fe1215e0f2bd01ca5d9779bd74c451))
* :sparkles: refactor theme management and update ShoppingList components for consistency ([84acabc](https://github.com/ApenasGabs/meuestoque/commit/84acabc00acc282e23be3d3a196f3eeb925969a4))
* :wrench: :sparkles: add registration and stock management pages with state management ([d80aac5](https://github.com/ApenasGabs/meuestoque/commit/d80aac5c74155241828f3bb46e98d3d35dfb5012))

## [1.2.0](https://github.com/ApenasGabs/meuestoque/compare/v1.1.0...v1.2.0) (2026-04-22)

### ✨ Features

* :sparkles: add AppHeader and AppBottomNav components for navigation and synchronization status ([79eacfc](https://github.com/ApenasGabs/meuestoque/commit/79eacfca982ed19d3686224224059825429579a3))
* :sparkles: enhance InventoryFeatureApp with settings view and refactor App component ([7f8697e](https://github.com/ApenasGabs/meuestoque/commit/7f8697e5584b01cf652fb233eaaa3959c2ab2732))
* :sparkles: implement InventoryApp component and refactor App to use it ([703a64f](https://github.com/ApenasGabs/meuestoque/commit/703a64f6020cde70e788d5b31b458d1abd552771))
* :sparkles: update ProductCard layout and enhance accessibility with aria-labels ([5184139](https://github.com/ApenasGabs/meuestoque/commit/5184139ce253162f36b2656d4304f8b35c1fe8bd))

### 🔧 Chores

* :sparkles: implemented new structure and features ([42bcbe5](https://github.com/ApenasGabs/meuestoque/commit/42bcbe51a90828b81aa05710e26c2c7e7dde012b))

## [1.1.0](https://github.com/ApenasGabs/meuestoque/compare/v1.0.0...v1.1.0) (2026-04-17)

### ✨ Features

* refactor App component and implement shopping list functionality ([6603920](https://github.com/ApenasGabs/meuestoque/commit/66039200f702972e3b6ef00141a8b30dc2894128))

## 1.0.0 (2026-04-17)

### ✨ Features

* ✨ adiciona sistema de release automática com Semantic Release ([210df0d](https://github.com/ApenasGabs/meuestoque/commit/210df0df678597c026300275c7f7159054566898))
* ✨ adicionar novos componentes e melhorias ([9acec7e](https://github.com/ApenasGabs/meuestoque/commit/9acec7e2c4e0d959f341d83ac3a10308121d48a8))
* ✨ adicionar testes, lint do Tailwind e diretrizes de qualidade ([0ed0e81](https://github.com/ApenasGabs/meuestoque/commit/0ed0e815796d72b0c0a9112fae77fa6a69e3bb17))
* ✨ melhora destaque do repositório GitHub e adiciona regra de validação de commits ([9925038](https://github.com/ApenasGabs/meuestoque/commit/9925038e7d7d6286f19f7bd659f153ec5644fe53))
* 🐙 adicionar link para repositório GitHub na página inicial ([d8a2c4b](https://github.com/ApenasGabs/meuestoque/commit/d8a2c4bedb92a7d79249546024181369d7179322))
* adiciona documentacao e instalador de extensoes do vs code ([0be58ad](https://github.com/ApenasGabs/meuestoque/commit/0be58ad4bdc3ee3fd04fb47a93726dc10310a6d1))

### 🐛 Bug Fixes

* 🐛 adiciona --legacy-peer-deps ao workflow de release ([54147f8](https://github.com/ApenasGabs/meuestoque/commit/54147f8771377b7066806763c04dd47188f2d068))
* converte script para ES modules ([e9ff6a7](https://github.com/ApenasGabs/meuestoque/commit/e9ff6a7a596824d6e3dc51a7b9fb5a39c4af9445))

### 📚 Documentation

* 📚 adiciona guia de arquiteturas para web scraping ([d520b71](https://github.com/ApenasGabs/meuestoque/commit/d520b713a01945f01574bf1afbc5f624c84bcb40))
* 📚 adicionar priorização de componentes daisyUI nas diretrizes ([6ff3903](https://github.com/ApenasGabs/meuestoque/commit/6ff39034c087b17cb03316b97dda913f6eabee03))
* 📚 atualiza padrão de commits para usar imperativo/presente ([6ac3d97](https://github.com/ApenasGabs/meuestoque/commit/6ac3d9702f378626c96eb1b207ef3a1089e2b34a))
* 📚 atualiza workflow de git para trabalhar com branches ([829d6e0](https://github.com/ApenasGabs/meuestoque/commit/829d6e0173a8136f1ca72757da922611b9952134))
* 📚 reforçar ordem de uso de componentes ([451c908](https://github.com/ApenasGabs/meuestoque/commit/451c908580f1bf6aeef417d2c423577dd4618c64))

### ♻️ Refactoring

* ♻️ padronizar uso de ReactElement em todos os componentes ([a1da4d5](https://github.com/ApenasGabs/meuestoque/commit/a1da4d53f5c511f28c3c4a6367c7db6b9515a7ad))

### 🧪 Tests

* 🧪 cobrir componentes base e ajustar tipagem do Card ([fe24cae](https://github.com/ApenasGabs/meuestoque/commit/fe24cae0bc9084758a9503d5ae4ce97056de4b66))

### 🔧 Chores

* 🔧 adiciona EditorConfig e configurações do VS Code ([095eeb6](https://github.com/ApenasGabs/meuestoque/commit/095eeb6993467824e7e8f5c04aba2a00ac3ac57c))
* 🔧 reexecuta pipeline de release\n\n- Força nova execução com workflow atualizado\n- Evita re-run de job antigo ([0a33ac3](https://github.com/ApenasGabs/meuestoque/commit/0a33ac3ea3c4308e0faf7bdfad94f04d09d1fc44))
* **release:** 0.1.1 [skip ci] ([0558851](https://github.com/ApenasGabs/meuestoque/commit/0558851a9b4f915be7e4322f028d6000c9614b22))
* **release:** 0.2.0 [skip ci] ([8aa534c](https://github.com/ApenasGabs/meuestoque/commit/8aa534c8ccfb7865d67513dc93fea1f084efb9a4))

## [0.2.0](https://github.com/ApenasGabs/meuestoque/compare/v0.1.1...v0.2.0) (2026-01-25)

### ✨ Features

* adiciona documentacao e instalador de extensoes do vs code ([0be58ad](https://github.com/ApenasGabs/meuestoque/commit/0be58ad4bdc3ee3fd04fb47a93726dc10310a6d1))

### 🐛 Bug Fixes

* converte script para ES modules ([e9ff6a7](https://github.com/ApenasGabs/meuestoque/commit/e9ff6a7a596824d6e3dc51a7b9fb5a39c4af9445))

### 🔧 Chores

* 🔧 adiciona EditorConfig e configurações do VS Code ([095eeb6](https://github.com/ApenasGabs/meuestoque/commit/095eeb6993467824e7e8f5c04aba2a00ac3ac57c))

## [0.1.1](https://github.com/ApenasGabs/meuestoque/compare/v0.1.0...v0.1.1) (2026-01-24)

### 🐛 Bug Fixes

* 🐛 adiciona --legacy-peer-deps ao workflow de release ([54147f8](https://github.com/ApenasGabs/meuestoque/commit/54147f8771377b7066806763c04dd47188f2d068))

### 🔧 Chores

* 🔧 reexecuta pipeline de release\n\n- Força nova execução com workflow atualizado\n- Evita re-run de job antigo ([0a33ac3](https://github.com/ApenasGabs/meuestoque/commit/0a33ac3ea3c4308e0faf7bdfad94f04d09d1fc44))
