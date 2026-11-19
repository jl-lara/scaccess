# Pruebas E2E con Selenium (`@scaccess/admin`)

Este directorio contiene las pruebas funcionales de navegador real con
**Selenium WebDriver** para la consola web administrativa.

## Requisitos

- Python 3.10+
- Microsoft Edge, Google Chrome o Mozilla Firefox instalado (Selenium 4 descarga el driver
  automaticamente mediante Selenium Manager).
- Instalar dependencia:

```bash
pip install -r apps/admin/tests/selenium/requirements.txt
```

## Ejecucion

1. Inicia la web administrativa en otra terminal (o apunta `ADMIN_URL` a tu sitio
   desplegado):

```bash
npm run dev:admin
```

2. Ejecuta la suite de Selenium:

```bash
python apps/admin/tests/selenium/test_admin_e2e.py
```

Variables opcionales:

- `ADMIN_URL`: URL de la app web (por defecto `http://localhost:5173`).
- `SELENIUM_BROWSER`: `edge` (por defecto), `chrome` o `firefox`.
- `HEADLESS`: `1` para ejecutar sin interfaz grafica, `0` para ver el navegador.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: credenciales QA (por defecto `admin.qa@scaccess.local`).

Al finalizar, las capturas de evidencia se guardan automaticamente en
`apps/admin/tests/selenium/screenshots/`.
