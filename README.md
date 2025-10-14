# Font Scanner

A comprehensive web application that analyzes websites for fonts, font display properties, font loading performance, and typography best practices.

## Features

- **Font Discovery**: Identifies all fonts used on a webpage
- **Font Display Analysis**: Analyzes font-display properties and loading strategies
- **Performance Metrics**: Measures font loading times and impact on page performance
- **Best Practices Audit**: Checks compliance with font loading best practices
- **Visual Analysis**: Screenshots and visual comparison of font rendering
- **Detailed Reports**: Comprehensive reports with actionable recommendations

## Technology Stack

- **Backend**: Node.js, Express
- **Web Scraping**: Puppeteer
- **Frontend**: HTML, CSS, JavaScript
- **Analysis**: Custom font analysis algorithms

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd font-scanner
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Enter a website URL to analyze
3. Click "Scan Fonts" to start the analysis
4. Review the comprehensive font analysis report

## API Endpoints

- `POST /api/scan` - Analyze a website for fonts
- `GET /api/health` - Health check endpoint

## Project Structure

```
font-scanner/
├── src/
│   ├── server.js           # Express server setup
│   ├── controllers/        # Request handlers
│   ├── services/           # Business logic
│   ├── utils/              # Utility functions
│   └── public/             # Static assets
├── tests/                  # Test files
├── docs/                   # Documentation
└── package.json           # Dependencies and scripts
```

## Development

- `npm run dev` - Start development server with auto-reload
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## License

MIT