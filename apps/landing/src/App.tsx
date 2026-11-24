import { Footer } from './components/Footer'
import { Navbar } from './components/Navbar'
import { RouterProvider, useRouter } from './lib/router'
import { ContactPage } from './pages/ContactPage'
import { HomePage } from './pages/HomePage'

function AppLayout() {
  const { route } = useRouter()

  return (
    <>
      <a href="#contenido-principal" className="skip-link">
        Saltar al contenido principal
      </a>
      <Navbar />
      <main id="contenido-principal">
        {route === '/contacto' ? <ContactPage /> : <HomePage />}
      </main>
      <Footer />
    </>
  )
}

interface AppProps {
  initialPath?: string
}

export function App({ initialPath }: AppProps) {
  return (
    <RouterProvider initialPath={initialPath}>
      <AppLayout />
    </RouterProvider>
  )
}

export default App
