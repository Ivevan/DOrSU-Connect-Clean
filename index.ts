import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

// Initialize Firebase early to ensure it's ready before any components use it
import './frontend/src/config/firebase';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
