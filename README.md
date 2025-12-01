# DOrSU Connect

A comprehensive mobile application for Davao Oriental State University (DOrSU) that provides students, faculty, and administrators with easy access to school updates, AI-powered assistance, calendar management, and more.

## 📱 Features

### For All Users
- **School Updates**: Stay informed with the latest news and announcements from DOrSU
- **AI Chat Assistant**: Get instant answers to your questions about DOrSU using our RAG-powered AI chatbot
- **Calendar**: View and manage important school events and schedules
- **Authentication**: Secure login with email/password or Google Sign-In
- **Theme Support**: Light and dark mode for comfortable viewing
- **Network Status**: Real-time connection monitoring

### For Administrators
- **Admin Dashboard**: Comprehensive overview of app usage and statistics
- **Post Management**: Create, update, and manage school announcements
- **Advanced Settings**: Configure app-wide settings and preferences
- **Admin Calendar**: Manage institutional events and schedules

## 🚀 Installation

### Installing the APK (Android)

1. **Download the APK**
   - Download the latest APK file from [Google Drive](YOUR_GOOGLE_DRIVE_LINK_HERE)
   - Or scan the QR code if provided

2. **Enable Unknown Sources**
   - Go to **Settings** > **Security** (or **Settings** > **Apps** > **Special Access** on newer Android versions)
   - Enable **"Install Unknown Apps"** or **"Unknown Sources"**
   - Select your browser or file manager app and toggle the permission ON

3. **Install the APK**
   - Open the downloaded APK file from your device's Downloads folder
   - Tap **"Install"** when prompted
   - Wait for the installation to complete
   - Tap **"Open"** to launch the app

4. **First Launch**
   - The app will guide you through the initial setup
   - Create an account or sign in with your existing credentials
   - Grant necessary permissions when prompted

### System Requirements

- **Android**: Android 6.0 (API level 23) or higher
- **Storage**: At least 50 MB of free space
- **Internet**: Required for most features
- **Permissions**: 
  - Internet access
  - Network state (for connection monitoring)
  - Notifications (optional, for updates)

## 🛠️ Development Setup

If you want to build the app from source or contribute to development:

### Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm** or **yarn**: Package manager
- **Expo CLI**: For React Native development
- **Android Studio**: For Android development (optional, for native builds)
- **MongoDB**: For backend services (local or remote)

### Frontend Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DOrSU-Connect-Clean
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development server**
   ```bash
   npm start
   # Or for specific environments:
   npm run start:local    # For localhost backend
   npm run start:render   # For Render backend
   ```

5. **Run on Android**
   ```bash
   npm run android
   # Or:
   npm run android:local
   npm run android:render
   ```

### Backend Setup

See the [Backend README](./backend/README.md) for detailed backend setup instructions.

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env.example .env
   # Edit .env with your MongoDB URI, API keys, etc.
   ```

4. **Start the server**
   ```bash
   npm start
   # Or for development with auto-reload:
   npm run dev
   ```

## 📁 Project Structure

```
DOrSU-Connect-Clean/
├── android/              # Android native code and configuration
├── assets/               # App icons, images, and static assets
├── backend/              # Node.js backend server
│   ├── src/
│   │   ├── config/      # Configuration files
│   │   ├── data/        # Knowledge base data
│   │   ├── services/    # Backend services (RAG, auth, etc.)
│   │   └── utils/       # Utility functions
│   └── scripts/         # Utility scripts
├── frontend/             # React Native frontend
│   └── src/
│       ├── components/  # Reusable UI components
│       ├── screens/     # App screens (auth, user, admin)
│       ├── navigation/  # Navigation configuration
│       ├── services/    # API services
│       ├── contexts/    # React contexts (Auth, Theme, etc.)
│       ├── modals/      # Modal components
│       └── utils/       # Utility functions
├── App.tsx              # Main app entry point
├── app.json             # Expo configuration
└── package.json         # Frontend dependencies
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory (see `env.example`):

```env
# API Configuration
EXPO_PUBLIC_API_ENV=localhost  # or 'render' for production

# Firebase Configuration (if using Firebase)
# Add your Firebase config here
```

### Backend Configuration

See [backend/README.md](./backend/README.md) for detailed backend configuration including:
- MongoDB setup
- Groq API keys for AI features
- Email service configuration
- Knowledge base management

## 🧪 Testing

Run tests with:

```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## 📦 Building for Production

### Android APK

1. **Build the APK**
   ```bash
   npm run android:build
   ```

2. **Find the APK**
   - The APK will be located in `android/app/build/outputs/apk/`

### Using EAS Build (Recommended)

1. **Install EAS CLI**
   ```bash
   npm install -g eas-cli
   ```

2. **Configure EAS**
   ```bash
   eas build:configure
   ```

3. **Build for Android**
   ```bash
   eas build --platform android
   ```

## 🔐 Security

- All API communications use HTTPS
- Authentication tokens are securely stored
- User data is encrypted in transit
- Firebase Authentication for secure user management

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For issues, questions, or support:
- Check the [Backend README](./backend/README.md) for backend-specific issues
- Review the [Frontend README](./frontend/README.md) for frontend structure
- Contact the development team

## 🙏 Acknowledgments

- Davao Oriental State University
- React Native and Expo communities
- All contributors and testers

---

**Note**: Replace `YOUR_GOOGLE_DRIVE_LINK_HERE` in the Installation section with your actual Google Drive link to the APK file.

