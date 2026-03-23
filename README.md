# Data Processing App

A modern React application for processing CSV files with field mapping capabilities, built with React, TypeScript, Tailwind CSS, and shadcn/ui components.

## Features

- 🔐 **Authentication** - Login page with mock authentication
- 📤 **CSV Upload** - Upload and preview CSV files
- 🔄 **Field Mapping** - Auto-map fields with drag-and-drop adjustment
- 👁️ **Data Preview** - Review mapped data before processing
- ✅ **Processing Complete** - Confirmation of successful data processing
- 🎨 **Theme Toggle** - Switch between light and dark themes
- 🔒 **Protected Routes** - Secure routing with authentication
- 📱 **Responsive Design** - Works on all device sizes

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Routing
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **@dnd-kit** - Drag and drop functionality
- **PapaParse** - CSV parsing
- **Lucide React** - Icons

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Navigate to the project directory:
```bash
cd data-processing-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Usage

### 1. Login
- Use any email and password to login (mock authentication)
- Example: `user@example.com` / `password123`

### 2. Upload CSV
- Click "Choose CSV File" to select a CSV file
- Preview the first 10 rows of your data
- Click "Next" to proceed

### 3. Field Mapping
- Review auto-mapped fields
- Drag and drop to reorder mappings
- Change target fields using dropdown menus
- Click "Next" when satisfied with mappings

### 4. Data Preview
- Review the mapped data (first 10 rows)
- Click "Back" to adjust mappings
- Click "Process Data" to continue

### 5. Complete
- View confirmation message
- Process another file

## API Integration

The app is structured with a mock API service (`src/services/api.ts`) that simulates backend calls with delays. To integrate with a real backend:

1. Replace the mock functions in `src/services/api.ts` with actual API calls
2. Update the endpoints and request/response formats as needed
3. The app already handles loading states and error handling

### API Functions to Replace:

- `api.login(credentials)` - User authentication
- `api.uploadCSV(file)` - Upload CSV file
- `api.autoMapFields(headers)` - Get auto-mapped fields
- `api.processMappedData(mappings, data)` - Process mapped data
- `api.loadData(data)` - Final data load

## Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── theme-provider.tsx
│   ├── ThemeToggle.tsx
│   └── ProtectedRoute.tsx
├── contexts/
│   └── AuthContext.tsx  # Authentication context
├── lib/
│   └── utils.ts         # Utility functions
├── pages/
│   ├── LoginPage.tsx
│   ├── UploadPage.tsx
│   ├── FieldMappingPage.tsx
│   ├── DataPreviewPage.tsx
│   └── CompletePage.tsx
├── services/
│   └── api.ts           # API service (mock)
├── App.tsx              # Main app component
├── main.tsx            # Entry point
└── index.css           # Global styles
```

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Sample CSV

A sample CSV file is included in `public/sample.csv` for testing purposes.

## Features in Detail

### Theme Support
- Light and dark mode
- Persists user preference
- Toggle button in the navigation bar

### Protected Routes
- Redirects to login if not authenticated
- Preserves session state
- Auto-logout functionality

### Field Mapping
- Drag and drop to reorder
- Multiple target field options
- Visual feedback during drag
- Support for unmapped fields

### Responsive Design
- Mobile-friendly interface
- Adaptive layouts
- Touch-friendly controls

## License

MIT

## Support

For issues and feature requests, please create an issue in the repository.
