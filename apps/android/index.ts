import { registerRootComponent } from 'expo'
import { registerWidgetTaskHandler } from 'react-native-android-widget'
import App from './src/App'
import { widgetTaskHandler } from './src/widget/taskHandler'

// Registers the root component as 'main' in both Expo Go and native builds.
registerRootComponent(App)
// The home-screen widget draws from a headless task, so it updates with the app closed.
registerWidgetTaskHandler(widgetTaskHandler)
