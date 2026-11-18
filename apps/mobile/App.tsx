import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AuthProvider } from './src/context/AuthContext'
import { AppNavigator } from './src/navigation/AppNavigator'
import { colors } from './src/theme/colors'

/**
 * Componente raiz de la app movil.
 * Envuelve la navegacion con el proveedor de area segura y el de autenticacion.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <StatusBar style="dark" />
          <AppNavigator />
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
