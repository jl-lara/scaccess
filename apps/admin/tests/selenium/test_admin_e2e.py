"""
Pruebas E2E con Selenium WebDriver para la consola web administrativa (@scaccess/admin).

Variables de entorno opcionales:
  ADMIN_URL         URL base de la app web (default: http://localhost:5173)
  ADMIN_EMAIL       Correo administrativo QA (default: admin.qa@scaccess.local)
  ADMIN_PASSWORD    Contrasena QA (default: QaAccess!2026#Admin)
  SELENIUM_BROWSER  edge | chrome | firefox (default: edge)
  HEADLESS          1 para ejecutar sin ventana, 0 para ver el navegador (default: 0)
"""

from __future__ import annotations

import os
from pathlib import Path
import unittest

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

ADMIN_URL = os.getenv("ADMIN_URL", "http://localhost:5173").rstrip("/")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin.qa@scaccess.local")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "QaAccess!2026#Admin")
BROWSER = os.getenv("SELENIUM_BROWSER", "edge").strip().lower()
HEADLESS = os.getenv("HEADLESS", "0") == "1"

SCREENSHOTS_DIR = Path(__file__).resolve().parent / "screenshots"


def build_driver() -> webdriver.Remote:
    if BROWSER == "firefox":
        options = webdriver.FirefoxOptions()
        if HEADLESS:
            options.add_argument("-headless")
        driver = webdriver.Firefox(options=options)
        driver.set_window_size(1366, 768)
        return driver

    if BROWSER == "chrome":
        options = webdriver.ChromeOptions()
        if HEADLESS:
            options.add_argument("--headless=new")
        options.add_argument("--window-size=1366,768")
        return webdriver.Chrome(options=options)

    options = webdriver.EdgeOptions()
    if HEADLESS:
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1366,768")
    return webdriver.Edge(options=options)


class AdminWebSeleniumTests(unittest.TestCase):
    driver: webdriver.Remote

    @classmethod
    def setUpClass(cls) -> None:
        SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
        cls.driver = build_driver()
        cls.driver.implicitly_wait(3)

    @classmethod
    def tearDownClass(cls) -> None:
        if getattr(cls, "driver", None) is not None:
            cls.driver.quit()

    def wait(self, timeout: int = 20) -> WebDriverWait:
        return WebDriverWait(self.driver, timeout)

    def login_as_admin(self) -> None:
        self.driver.get(f"{ADMIN_URL}/login")
        email_input = self.wait().until(
            EC.visibility_of_element_located((By.ID, "login-email"))
        )
        password_input = self.driver.find_element(By.ID, "login-password")
        submit_btn = self.driver.find_element(
            By.CSS_SELECTOR, "button[type='submit']"
        )

        email_input.clear()
        email_input.send_keys(ADMIN_EMAIL)
        password_input.clear()
        password_input.send_keys(ADMIN_PASSWORD)
        submit_btn.click()

        # Render Free puede tardar hasta ~60 s en despertar si estuvo inactivo
        self.wait(65).until(
            EC.presence_of_element_located((By.ID, "main-content"))
        )

    def test_01_login_invalid_credentials_shows_alert(self) -> None:
        """Escenario invalido: credenciales incorrectas muestran alerta y permanecen en /login."""
        self.driver.get(f"{ADMIN_URL}/login")
        email_input = self.wait().until(
            EC.visibility_of_element_located((By.ID, "login-email"))
        )
        password_input = self.driver.find_element(By.ID, "login-password")
        submit_btn = self.driver.find_element(
            By.CSS_SELECTOR, "button[type='submit']"
        )

        email_input.clear()
        email_input.send_keys("invalido@scaccess.local")
        password_input.clear()
        password_input.send_keys("ClaveIncorrecta123!")
        submit_btn.click()

        alert = self.wait(25).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "[role='alert']"))
        )
        self.assertTrue(alert.text.strip())
        self.assertIn("/login", self.driver.current_url)
        self.driver.save_screenshot(
            str(SCREENSHOTS_DIR / "01-login-error.png")
        )

    def test_02_login_valid_and_navigate_modules(self) -> None:
        """Escenario valido: login administrativo, carga del Dashboard y navegacion SPA."""
        self.login_as_admin()
        self.driver.save_screenshot(
            str(SCREENSHOTS_DIR / "02-dashboard.png")
        )

        for route in ["/employees", "/credentials", "/access-events", "/areas"]:
            self.driver.find_element(
                By.CSS_SELECTOR, f"a[href='{route}']"
            ).click()
            self.wait(15).until(EC.url_contains(route))
            heading = self.wait(15).until(
                EC.visibility_of_element_located((By.TAG_NAME, "h1"))
            )
            self.assertTrue(heading.text.strip())

    def test_03_credentials_rejects_invalid_uid_filter(self) -> None:
        """Escenario invalido en catalogo: UID no hexadecimal bloqueado en cliente."""
        if "/login" in self.driver.current_url or not self.driver.find_elements(
            By.ID, "main-content"
        ):
            self.login_as_admin()

        self.driver.find_element(
            By.CSS_SELECTOR, "a[href='/credentials']"
        ).click()
        uid_input = self.wait(15).until(
            EC.visibility_of_element_located((By.ID, "credential-uid-filter"))
        )
        uid_input.clear()
        uid_input.send_keys("ZZZZ-NO-HEX")
        uid_input.submit()

        error_msg = self.wait(10).until(
            EC.visibility_of_element_located((By.ID, "credential-filter-error"))
        )
        self.assertTrue(error_msg.text.strip())
        self.driver.save_screenshot(
            str(SCREENSHOTS_DIR / "03-credentials-uid-validation.png")
        )

    def test_04_responsive_mobile_viewport(self) -> None:
        """Verificacion multidispositivo (Smartphone 390x844) sin desbordamiento horizontal."""
        if "/login" in self.driver.current_url or not self.driver.find_elements(
            By.ID, "main-content"
        ):
            self.login_as_admin()

        self.driver.set_window_size(390, 844)
        self.driver.get(f"{ADMIN_URL}/")
        self.wait(15).until(
            EC.visibility_of_element_located((By.ID, "main-content"))
        )
        overflow = self.driver.execute_script(
            "return document.documentElement.scrollWidth > window.innerWidth;"
        )
        self.driver.save_screenshot(
            str(SCREENSHOTS_DIR / "04-responsive-mobile.png")
        )
        self.assertFalse(
            overflow,
            "La vista movil (390x844) presenta desbordamiento horizontal.",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
