# Lego-Dashboard

<a href="https://ctu-sematx.github.io/Lego-Doc/"><img src="https://img.shields.io/badge/docs-Lego--Doc-blue?logo=materialformkdocs&amp;logoColor=fff"></a>
<a href="https://scorecard.dev/viewer/?uri=github.com/CTU-SematX/Lego-Dashboard"><img src="https://api.scorecard.dev/projects/github.com/CTU-SematX/Lego-Dashboard/badge"></a>
<a href="https://github.com/CTU-SematX/Lego-Dashboard/releases"><img src="https://img.shields.io/github/v/release/CTU-SematX/Lego-Dashboard?label=Version"></a>
<a href="https://github.com/CTU-SematX/Lego-Dashboard/graphs/commit-activity"><img src="https://img.shields.io/github/commit-activity/m/CTU-SematX/Lego-Dashboard"></a>
<a href="https://github.com/CTU-SematX/Lego-Dashboard/graphs/contributors"><img src="https://img.shields.io/github/contributors/CTU-SematX/Lego-Dashboard"></a>
<a><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg"></a>

**Description**: An alternative for WireCloud (FIWARE). A PayloadCMS template adapted for NGSI-LD using in smart city applications.

Lego-Dashboard provides a modern, flexible dashboard solution for smart city applications that need to work with NGSI-LD data models. Built on PayloadCMS and Next.js, it offers a customizable platform for visualizing and managing context information from NGSI-LD compatible data sources.

## Table of Contents

- [Installation and Requirements](#installation-and-requirements)
- [Quickstart Instructions](#quick-start-instructions)
- [Usage](#usage)
- [Known Issues](#known-issues)
- [Support](#support)
- [Contributing](#contributing)
- [Development](#development)
- [License](#license)
- [Maintainers](#maintainers)
- [Credits and References](#credits-and-references)

## Installation and Requirements

### Prerequisites

- Node.js 22+
- pnpm package manager
- MongoDB database
- Docker (optional, for containerized deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/CTU-SematX/Lego-Dashboard.git
cd Lego-Dashboard

# Install dependencies
pnpm install

# Set up environment variables
cp test.env .env
# Edit .env with your configuration

# Run development server
pnpm dev
```

### Docker Deployment

```bash
docker-compose up -d
```

## Quick start instructions

1. Clone and install dependencies:
   ```bash
   pnpm install
   ```

2. Configure environment variables in `.env`

3. Start the development server:
   ```bash
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### NGSI-LD Integration

The dashboard integrates with NGSI-LD context brokers to:
- Connect to NGSI data sources
- Manage NGSI entities and data models
- Visualize smart city data

### Content Management

Built on PayloadCMS, the dashboard provides:
- Admin panel at `/admin`
- Customizable pages and posts
- Media management
- Form builder

## Known issues

See the [Issues](https://github.com/CTU-SematX/Lego-Dashboard/issues) page for current known issues and feature requests.

## Support

If you have questions, concerns, bug reports, etc., please file an issue in this repository's [Issue Tracker](https://github.com/CTU-SematX/Lego-Dashboard/issues).

## Contributing

We welcome contributions to Lego-Dashboard! Key areas we're focusing on:
- NGSI-LD data model support
- Dashboard widgets and visualizations
- Smart city use cases
- Documentation improvements

General instructions on _how_ to contribute can be found in [CONTRIBUTING](CONTRIBUTING.md).

## Development

```bash
# Run development server
pnpm dev

# Run linting
pnpm lint

# Run tests
pnpm test

# Build for production
pnpm build
```

For more details, see the development section in [CONTRIBUTING](CONTRIBUTING.md).

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

---

## Maintainers

CTU-SematX Team

## Credits and References

- [PayloadCMS](https://payloadcms.com/) - The headless CMS powering this dashboard
- [Next.js](https://nextjs.org/) - React framework for production
- [FIWARE](https://www.fiware.org/) - Smart city platform and NGSI-LD specifications
- [WireCloud](https://wirecloud.readthedocs.io/) - The original dashboard solution this project aims to provide an alternative for
