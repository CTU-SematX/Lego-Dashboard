# Lego-Dashboard

<p align="center">
  <em>A modern, low-code dashboard platform for NGSI-LD smart city applications</em>
</p>

<p align="center">
  <a href="https://ctu-sematx.github.io/Lego-Doc/"><img src="https://img.shields.io/badge/docs-Lego--Doc-blue?logo=materialformkdocs&logoColor=fff" alt="Documentation"></a>
  <a href="https://scorecard.dev/viewer/?uri=github.com/CTU-SematX/Lego-Dashboard"><img src="https://api.scorecard.dev/projects/github.com/CTU-SematX/Lego-Dashboard/badge" alt="OpenSSF Scorecard"></a>
  <a href="https://github.com/CTU-SematX/Lego-Dashboard/releases"><img src="https://img.shields.io/github/v/release/CTU-SematX/Lego-Dashboard?label=Version" alt="Version"></a>
  <a href="https://github.com/CTU-SematX/Lego-Dashboard/graphs/commit-activity"><img src="https://img.shields.io/github/commit-activity/m/CTU-SematX/Lego-Dashboard" alt="Commit Activity"></a>
  <a href="https://github.com/CTU-SematX/Lego-Dashboard/graphs/contributors"><img src="https://img.shields.io/github/contributors/CTU-SematX/Lego-Dashboard" alt="Contributors"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License"></a>
</p>

<p align="center">
  <a href="README.vi.md">🇻🇳 Tiếng Việt</a>
</p>

---

Lego-Dashboard is a **modern alternative to WireCloud** (FIWARE), built as a low-code platform on **PayloadCMS** and **Next.js 16**. It provides a flexible, customizable dashboard solution for smart city applications that integrate with **NGSI-LD Context Brokers**.

<!-- TODO: Add screenshots/demo GIF here
![Dashboard Preview](docs/images/dashboard-preview.png)
-->

## ✨ Key Features

### 🔗 NGSI-LD Integration
- **Context Broker Connection** — Connect to any NGSI-LD compatible broker (Orion-LD, Scorpio, Stellio)
- **Multi-tenancy Support** — Fiware-Service and ServicePath headers for tenant isolation
- **Smart Data Models** — Import from [FIWARE Smart Data Models](https://smartdatamodels.org/) repository
- **Entity Management** — Create, sync, and manage NGSI-LD entities with automatic broker synchronization

### 🧩 Dashboard Blocks
- **Content Blocks** — Rich text, media, banners, code snippets with syntax highlighting
- **Archive & Collections** — Display and filter content collections
- **Forms** — Drag-and-drop form builder
- **Call-to-Action** — Customizable CTA sections

### 📝 Content Management (PayloadCMS)
- **Admin Panel** — Full-featured admin at `/admin` with live preview
- **SEO Optimization** — Built-in SEO plugin with meta management
- **Media Library** — Image optimization with Sharp
- **Internationalization** — English and Vietnamese support

### 🤖 AI-Powered Content
- **OpenRouter Integration** — Generate content with LLaMA, GPT-4o, Claude, Gemini
- **AI Writing Assistant** — Integrated in the admin panel

> 📖 For detailed documentation, visit [Lego-Doc](https://ctu-sematx.github.io/Lego-Doc/)

## 🛠️ Tech Stack

| Category | Technologies |
|----------|-------------|
| **Framework** | Next.js 16, React 19, TypeScript 5.7 |
| **CMS** | PayloadCMS 3.66 |
| **Database** | MongoDB (also supports PostgreSQL, SQLite) |
| **Styling** | Tailwind CSS 3.4, Radix UI |
| **NGSI-LD** | Custom client library with full API support |
| **Testing** | Vitest (unit/integration), Playwright (E2E) |
| **Package Manager** | pnpm 9+ |

## 📦 Installation

### Prerequisites

- **Node.js** 18.20.2+ or 20.9.0+
- **pnpm** 9+ or 10+
- **MongoDB** database (or PostgreSQL/SQLite)
- **Docker** (optional, for containerized deployment)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/CTU-SematX/Lego-Dashboard.git
cd Lego-Dashboard

# Install dependencies
pnpm install

# Set up environment variables
cp test.env .env
```

Configure your `.env` file:

```env
# Required
PAYLOAD_SECRET=your-secret-key-here
DATABASE_URI=mongodb://localhost:27017/lego-dashboard

# Optional
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
PREVIEW_SECRET=your-preview-secret
```

```bash
# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — Frontend  
Open [http://localhost:3000/admin](http://localhost:3000/admin) — Admin Panel

### 🐳 Docker Deployment

```bash
docker-compose up -d
```

This starts:
- **Next.js app** on port `3000`
- **MongoDB** on port `27017`

## 🚀 Usage

### Connecting to NGSI-LD Context Broker

1. Navigate to **Admin Panel** → **Data Connections** → **NGSI Sources**
2. Add your context broker URL (e.g., `http://orion-ld:1026`)
3. Configure multi-tenancy headers if needed
4. Use **Health Check** to verify connection

### Managing NGSI Entities

1. Go to **NGSI Data Models** to import Smart Data Models
2. Create or discover entities from your context broker
3. Entities sync automatically with the broker

### Building Dashboard Pages

1. Create a new **Page** in the admin panel
2. Add blocks: Content, Media, Archive, Forms, etc.
3. Use **Live Preview** to see changes in real-time

## 🗺️ Roadmap

- [x] **v0.3.0-alpha** — Complete NGSI-LD flow on dashboard
- [ ] **v0.4.0-alpha** — UI rendering from NGSI entities *(current)*
- [ ] **v0.5.0-alpha** — User permissions & roles (Data management, web design management)
- [ ] **v0.6.0-beta** — Improve NGSI source connection (Proxy connection with authorization, API keys)
- [ ] **v0.7.0-beta** — Map page integration (intergated with Mapbox)
- [ ] **v0.8.0-beta** — Additional widgets (VR, charts, gauges)
- [ ] **v0.9.0-rc** — Error handling, performance & security
- [ ] **v1.0.0** — Stable release

## 🐛 Known Issues

See the [Issues](https://github.com/CTU-SematX/Lego-Dashboard/issues) page for current known issues and feature requests.

## 💬 Support

If you have questions, concerns, or bug reports, please file an issue in this repository's [Issue Tracker](https://github.com/CTU-SematX/Lego-Dashboard/issues).

## 🤝 Contributing

We welcome contributions to Lego-Dashboard! Key areas we're focusing on:

- 🔌 NGSI-LD data model support and widgets
- 📊 Dashboard visualizations (charts, maps, gauges)
- 🏙️ Smart city use cases and templates
- 📖 Documentation improvements

General instructions on _how_ to contribute can be found in [CONTRIBUTING](CONTRIBUTING.md).

## 👨‍💻 Development

```bash
# Development server
pnpm dev

# Linting
pnpm lint

# Run all tests
pnpm test

# Run integration tests only
pnpm test:int

# Run E2E tests only
pnpm test:e2e

# Production build
pnpm build
```

### Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── (frontend)/         # Public-facing pages
│   └── (payload)/          # Admin panel & API
├── blocks/                 # Dashboard block components
├── collections/            # PayloadCMS collections
│   ├── NgsiDataModels/     # Smart Data Models
│   ├── NgsiDomains/        # Domain categories
│   ├── NgsiEntities/       # NGSI-LD entities
│   └── NgsiSources/        # Context broker connections
├── components/             # React components
└── lib/
    └── ngsi-ld/            # NGSI-LD client library
```

For more details, see the development section in [CONTRIBUTING](CONTRIBUTING.md).

## 📄 License

This project is licensed under the **Apache License 2.0** — see the [LICENSE](LICENSE) file for details.

## 👥 Maintainers

**CTU-SematX Team**

## 🙏 Credits and References

- [PayloadCMS](https://payloadcms.com/) — The headless CMS powering this dashboard
- [Next.js](https://nextjs.org/) — React framework for production
- [FIWARE](https://www.fiware.org/) — Smart city platform and NGSI-LD specifications
- [Smart Data Models](https://smartdatamodels.org/) — NGSI-LD data model repository
- [WireCloud](https://wirecloud.readthedocs.io/) — The original dashboard solution this project provides an alternative for

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/CTU-SematX">CTU-SematX</a>
</p>
