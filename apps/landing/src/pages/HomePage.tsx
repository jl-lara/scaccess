import { AboutSection } from '../components/AboutSection'
import { CtaBanner } from '../components/CtaBanner'
import { EcosystemSection } from '../components/EcosystemSection'
import { FaqSection } from '../components/FaqSection'
import { HardwareSection } from '../components/HardwareSection'
import { HeroSection } from '../components/HeroSection'
import { RolesSection } from '../components/RolesSection'
import { ScenariosSection } from '../components/ScenariosSection'
import { WorkflowSection } from '../components/WorkflowSection'

export function HomePage() {
  return (
    <>
      <HeroSection />
      <HardwareSection />
      <EcosystemSection />
      <RolesSection />
      <ScenariosSection />
      <WorkflowSection />
      <AboutSection />
      <FaqSection />
      <CtaBanner />
    </>
  )
}
