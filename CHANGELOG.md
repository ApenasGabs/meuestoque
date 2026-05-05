# 📝 Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.13.0](https://github.com/ApenasGabs/meuestoque/compare/v1.12.0...v1.13.0) (2026-05-05)

### ✨ Features

* ✨ adiciona exclusão em massa na barra de operações do estoque ([7547783](https://github.com/ApenasGabs/meuestoque/commit/7547783db143e2411e502c0c01933ab97fa606d8))
* ✨ adiciona exclusão em massa na lista de compras ([28277fc](https://github.com/ApenasGabs/meuestoque/commit/28277fca3458fee37cc34a96f8f2330d0bc455bd))
* add ability to update units directly in shopping list items ([4297d34](https://github.com/ApenasGabs/meuestoque/commit/4297d34aa435b9df2b51a2342d79554d35cf221d))

### 🐛 Bug Fixes

* :wrench: refactor based on code review ([5a7bac8](https://github.com/ApenasGabs/meuestoque/commit/5a7bac8b36cc9bd9c12c248194ac20122f12e6a2))
* 🐛 melhora lógica de backfill do dono do grupo ([c13fe7f](https://github.com/ApenasGabs/meuestoque/commit/c13fe7f8572ea85d3d4fc85e71b41d4787cc5c00))
* 🐛 oculta excluir grupo para não-donos e valida deleção no banco ([be637f9](https://github.com/ApenasGabs/meuestoque/commit/be637f9b49f11725540a2150f1bf808b34acb073))

### 👌 Styles

* 💄 move porcentagem de estoque para frente da barra de progresso ([be8cf18](https://github.com/ApenasGabs/meuestoque/commit/be8cf18645f50b70f565fef3f5f84e52cd3f2231))

## [1.12.0](https://github.com/ApenasGabs/meuestoque/compare/v1.11.0...v1.12.0) (2026-05-03)

### ✨ Features

* :wrench: Implement expiration date bulk actions and related API updates ([857d776](https://github.com/ApenasGabs/meuestoque/commit/857d7761cc7963158c51efaa403cd41ef5d5e487))

### 🐛 Bug Fixes

* 🐛 Add null guard for validity date in bulk update function ([eec39bd](https://github.com/ApenasGabs/meuestoque/commit/eec39bd8a0481aeb72c93a2a350ab0458d176f17))
* 🐛 Remove unnecessary null guard for validity date in bulk expiration migration ([4ebffe2](https://github.com/ApenasGabs/meuestoque/commit/4ebffe2e95e9e1e32662e6567d61c4c8edb24175))

### ♻️ Refactoring

* :broom: consolidate multiple historical migrations into a single initial schema definition ([de04dc7](https://github.com/ApenasGabs/meuestoque/commit/de04dc7b2eedcbf9ecee17a0887e302afb21b1a7))

## [1.11.0](https://github.com/ApenasGabs/meuestoque/compare/v1.10.0...v1.11.0) (2026-05-03)

### ✨ Features

* **migrations:** add baseline migrations for core tables, rate limits, group RPCs, stock sync triggers, FIFO consumption, and cleanup tasks ([fd51fd6](https://github.com/ApenasGabs/meuestoque/commit/fd51fd6255bae9425bc8c249fa122055a78a7672))

### 🐛 Bug Fixes

* 🐛 arruma erros de JSX e limpa lints de tipagem e hooks ([7fef6d8](https://github.com/ApenasGabs/meuestoque/commit/7fef6d8b07e1336be4869e7615e16f4daba9e1a6))
* 🐛 update Card component props and enhance type definitions for better flexibility ([2072353](https://github.com/ApenasGabs/meuestoque/commit/2072353d27d9bf6d8f4923ba21e93ac26ad81efc))

### 📚 Documentation

* :books: adiciona auditoria de código e pre-checks para migrations de 20260502 ([6e2d5b8](https://github.com/ApenasGabs/meuestoque/commit/6e2d5b87b6901f3c8a322cd12d291cc717a18c1d))
* :books: atualiza mapa do banco com detalhes de reconciliação e limpeza de campos legados ([b30509b](https://github.com/ApenasGabs/meuestoque/commit/b30509b060dd9213d3a2d89ac8167e169113a407))
* atualiza mapa do banco com inspeção real e drift de migrations ([82fa2f4](https://github.com/ApenasGabs/meuestoque/commit/82fa2f44108769069c712001b43696cc9139bb3f))
* reestrutura documentação e adiciona ADRs, glossário e contratos de RPC ([85be7d8](https://github.com/ApenasGabs/meuestoque/commit/85be7d891b06b027d747c04d57c65f684b4e731d))

### 🔧 Chores

* **release:** 1.10.0 [skip ci] ([3f47899](https://github.com/ApenasGabs/meuestoque/commit/3f478991f758783c368b1f30c66c0e540369e035))

## [1.10.0](https://github.com/ApenasGabs/meuestoque/compare/v1.9.0...v1.10.0) (2026-05-02)

### ✨ Features

* :sparkles: implement bulk expiration management, non-perishable item support, and database schema updates for inventory tracking. ([bf0ccf7](https://github.com/ApenasGabs/meuestoque/commit/bf0ccf7b5c1e84b56df218331f24fa6656211ff0))
* add shopping list bulk action bar and non-perishable undo ([9d0575e](https://github.com/ApenasGabs/meuestoque/commit/9d0575e34e38a6956d270d1b4d964cb814e4c97f))
* address remaining spec gaps for bulk expiration ([e6279b5](https://github.com/ApenasGabs/meuestoque/commit/e6279b5e681446921ae8330a53e0ee8fe79c5608))

### 🐛 Bug Fixes

* corrige bugs bloqueadores e melhorias no bulk expiration ([d070189](https://github.com/ApenasGabs/meuestoque/commit/d070189956a1518e66c5481f6a2b6189f14ece86))

## [1.9.0](https://github.com/ApenasGabs/meuestoque/compare/v1.8.0...v1.9.0) (2026-05-01)

### ✨ Features

* :sparkles: add .codelinterrules file with initial rules and guidelines ([e6b3600](https://github.com/ApenasGabs/meuestoque/commit/e6b3600a6d3a2008373f27213d04e9fe13a7248f))

### 🐛 Bug Fixes

* :bug: correct file name in .clinerules for codelinter reference ([462633c](https://github.com/ApenasGabs/meuestoque/commit/462633c2b852263c110b23979a6691a3a8669115))

### 🔧 Chores

* :books: add .clinerules configuration for standardized agent behavior ([260cc88](https://github.com/ApenasGabs/meuestoque/commit/260cc8828c4cedcf0368d88a972492e254fdfd43))
* :books: format .codelinterrules for consistency and clarity ([68bc9d1](https://github.com/ApenasGabs/meuestoque/commit/68bc9d160ecec47db7f60d8fe7a36d52c027a2aa))

## [1.8.0](https://github.com/ApenasGabs/meuestoque/compare/v1.7.0...v1.8.0) (2026-04-26)

### ✨ Features

* :sparkles: enhance Vercel deployment step with logging and environment variable usage ([f62ebc5](https://github.com/ApenasGabs/meuestoque/commit/f62ebc5a70177ca95fcb2e30154970526f763cc1))

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
