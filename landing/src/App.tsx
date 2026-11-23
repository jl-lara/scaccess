import { AboutSection } from './components/AboutSection'
import { ContactSection } from './components/ContactSection'
import { EcosystemSection } from './components/EcosystemSection'
import { Footer } from './components/Footer'
import { HardwareSection } from './components/HardwareSection'
import { HeroSection } from './components/HeroSection'
import { Navbar } from './components/Navbar'
import { WorkflowSection } from './components/WorkflowSection'

export function App() {
  return (
    <>
      <a href="#contenido-principal" className="skip-link">
        Saltar al contenido principal
      </a>
      <Navbar />
      <main id="contenido-principal">
        <HeroSection />
        <HardwareSection />
        <EcosystemSection />
        <WorkflowSection />
        <AboutSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  )
}
export default App
