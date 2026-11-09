import { Router } from 'express'
import { openApiDocument } from './openapi.spec.js'

/**
 * Content Security Policy for the documentation page.
 *
 * The page is intentionally self-contained (no CDN, no extra dependency), so
 * the only relaxation over the Helmet defaults is allowing its inline script
 * and stylesheet. Everything else stays restricted to the same origin.
 */
const DOCS_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
].join('; ')

const DOCS_HTML = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sistema de Control de Acceso - API v1</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --ink: #15202b;
      --muted: #5d6b7a;
      --line: #d9e0e7;
      --brand: #0b6bcb;
      --brand-soft: #e8f1fb;
      --get: #1d7a46;
      --post: #0b6bcb;
      --patch: #9a5b00;
      --delete: #b42318;
      --radius: 10px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--ink);
    }
    header {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      padding: 18px 24px;
      background: #0f2740;
      color: #fff;
    }
    header h1 { margin: 0; font-size: 20px; font-weight: 650; }
    header p { margin: 4px 0 0; color: #b9c9d9; font-size: 13px; }
    .token-box {
      display: flex;
      gap: 8px;
      align-items: center;
      min-width: 320px;
      flex: 0 1 520px;
    }
    .token-box label { font-size: 12px; color: #b9c9d9; white-space: nowrap; }
    .token-box input {
      flex: 1;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid #34506d;
      background: #0b1d2f;
      color: #fff;
      font: inherit;
      font-size: 13px;
    }
    .layout {
      display: grid;
      grid-template-columns: 340px minmax(0, 1fr);
      gap: 20px;
      padding: 20px 24px 48px;
      max-width: 1500px;
      margin: 0 auto;
    }
    .sidebar, .content {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      min-width: 0;
    }
    .sidebar { align-self: start; position: sticky; top: 16px; max-height: calc(100vh - 32px); display: flex; flex-direction: column; }
    .search { padding: 14px; border-bottom: 1px solid var(--line); }
    .search input {
      width: 100%;
      padding: 9px 11px;
      border: 1px solid var(--line);
      border-radius: 8px;
      font: inherit;
      font-size: 13px;
    }
    .nav { overflow: auto; padding: 8px 0 14px; }
    .nav-group { padding: 10px 14px 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
    .nav-item {
      display: flex;
      gap: 8px;
      align-items: center;
      width: 100%;
      border: 0;
      background: transparent;
      padding: 7px 14px;
      cursor: pointer;
      text-align: left;
      font: inherit;
      font-size: 12.5px;
      color: var(--ink);
      border-left: 3px solid transparent;
    }
    .nav-item:hover { background: #f2f6fa; }
    .nav-item.active { background: var(--brand-soft); border-left-color: var(--brand); }
    .nav-item code { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .method {
      flex: none;
      display: inline-block;
      min-width: 50px;
      padding: 2px 7px;
      border-radius: 999px;
      color: #fff;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: .04em;
      text-align: center;
      text-transform: uppercase;
    }
    .method.get { background: var(--get); }
    .method.post { background: var(--post); }
    .method.patch { background: var(--patch); }
    .method.put { background: var(--patch); }
    .method.delete { background: var(--delete); }
    .content { padding: 22px 26px 30px; min-height: 560px; }
    .welcome h2 { margin-top: 0; }
    .welcome p { color: var(--muted); line-height: 1.55; max-width: 760px; }
    .welcome ul { color: var(--muted); line-height: 1.7; }
    .crumb { color: var(--muted); font-size: 12px; margin-bottom: 6px; }
    .op-title { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 0 0 6px; font-size: 20px; }
    .op-title code { font-size: 19px; word-break: break-word; }
    .op-description { color: var(--muted); line-height: 1.55; margin: 8px 0 18px; white-space: pre-line; }
    h3 { font-size: 14px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 24px 0 10px; }
    .security { display: inline-block; background: #eef4ea; color: #315c22; border: 1px solid #c9dfbe; border-radius: 999px; padding: 3px 10px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid var(--line); }
    th { color: var(--muted); font-size: 11.5px; text-transform: uppercase; letter-spacing: .05em; }
    td code { font-size: 12px; }
    .field { margin-bottom: 12px; }
    .field label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
    .field input, .field textarea, .field select {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      font: inherit;
      font-size: 13px;
      background: #fbfcfd;
    }
    .field textarea { min-height: 150px; font-family: Consolas, "Cascadia Mono", monospace; resize: vertical; }
    .field .hint { font-size: 11.5px; color: var(--muted); margin-top: 3px; }
    .try-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 16px; }
    button.primary {
      border: 0;
      border-radius: 8px;
      background: var(--brand);
      color: #fff;
      font: inherit;
      font-weight: 600;
      font-size: 13px;
      padding: 9px 18px;
      cursor: pointer;
    }
    button.primary:hover { background: #095bb0; }
    button.primary:disabled { opacity: .6; cursor: wait; }
    .status { font-size: 13px; font-weight: 600; }
    .status.ok { color: var(--get); }
    .status.bad { color: var(--delete); }
    pre {
      background: #101c28;
      color: #e5edf5;
      border-radius: 8px;
      padding: 14px 16px;
      overflow: auto;
      font-size: 12.5px;
      line-height: 1.5;
      max-height: 460px;
      margin: 10px 0 0;
    }
    .empty { color: var(--muted); font-size: 13px; }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { position: static; max-height: 420px; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1 id="doc-title">Sistema de Control de Acceso API</h1>
      <p id="doc-subtitle">Cargando especificacion OpenAPI...</p>
    </div>
    <div class="token-box">
      <label for="token">Token Bearer</label>
      <input id="token" type="password" autocomplete="off" placeholder="JWT de Supabase o <tokenId>.<secret>">
    </div>
  </header>
  <div class="layout">
    <aside class="sidebar">
      <div class="search">
        <input id="search" type="search" placeholder="Filtrar por ruta o resumen..." aria-label="Filtrar endpoints">
      </div>
      <nav class="nav" id="nav"></nav>
    </aside>
    <main class="content" id="content">
      <div class="welcome">
        <h2>Documentacion interactiva</h2>
        <p>
          Esta pagina lee la especificacion OpenAPI 3.1 desde
          <code>/api/v1/openapi.json</code> y permite probar los endpoints
          directamente desde el navegador.
        </p>
        <ul>
          <li>Selecciona un endpoint en la barra lateral.</li>
          <li>Introduce un token Bearer para los endpoints protegidos.</li>
          <li>Completa parametros y cuerpo, y pulsa <strong>Enviar solicitud</strong>.</li>
        </ul>
        <p class="empty" id="spec-meta"></p>
      </div>
    </main>
  </div>
  <script>
    (function () {
      'use strict';

      var METHODS = ['get', 'post', 'put', 'patch', 'delete'];
      var spec = null;
      var operations = [];
      var current = null;

      var nav = document.getElementById('nav');
      var content = document.getElementById('content');
      var search = document.getElementById('search');
      var tokenInput = document.getElementById('token');

      tokenInput.value = sessionStorage.getItem('scaccess.token') || '';
      tokenInput.addEventListener('input', function () {
        sessionStorage.setItem('scaccess.token', tokenInput.value);
      });

      function resolveRef(ref) {
        if (!ref || ref.indexOf('#/') !== 0) return null;
        var parts = ref.slice(2).split('/');
        var node = spec;
        for (var i = 0; i < parts.length; i += 1) {
          if (!node) return null;
          node = node[parts[i]];
        }
        return node || null;
      }

      function deref(value) {
        if (value && value.$ref) return resolveRef(value.$ref) || value;
        return value;
      }

      function methodClass(method) {
        return METHODS.indexOf(method) >= 0 ? method : 'get';
      }

      function collectOperations() {
        var list = [];
        var paths = spec.paths || {};
        Object.keys(paths).sort().forEach(function (path) {
          METHODS.forEach(function (method) {
            var op = paths[path][method];
            if (!op) return;
            list.push({ method: method, path: path, op: op });
          });
        });
        return list;
      }

      function matchesQuery(item, query) {
        if (!query) return true;
        var haystack = (item.path + ' ' + item.method + ' ' + (item.op.summary || '')).toLowerCase();
        return haystack.indexOf(query.toLowerCase()) >= 0;
      }

      function renderNav() {
        var query = search.value.trim();
        nav.textContent = '';
        var groups = {};
        operations.forEach(function (item) {
          if (!matchesQuery(item, query)) return;
          var tag = (item.op.tags && item.op.tags[0]) || 'General';
          if (!groups[tag]) groups[tag] = [];
          groups[tag].push(item);
        });
        var tags = Object.keys(groups).sort();
        if (tags.length === 0) {
          var empty = document.createElement('div');
          empty.className = 'nav-group';
          empty.textContent = 'Sin resultados';
          nav.appendChild(empty);
          return;
        }
        tags.forEach(function (tag) {
          var group = document.createElement('div');
          group.className = 'nav-group';
          group.textContent = tag;
          nav.appendChild(group);
          groups[tag].forEach(function (item) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'nav-item' + (current === item ? ' active' : '');
            var badge = document.createElement('span');
            badge.className = 'method ' + methodClass(item.method);
            badge.textContent = item.method;
            var code = document.createElement('code');
            code.textContent = item.path;
            button.appendChild(badge);
            button.appendChild(code);
            button.addEventListener('click', function () {
              current = item;
              renderNav();
              renderOperation(item);
            });
            nav.appendChild(button);
          });
        });
      }

      function textBlock(tagName, className, text) {
        var node = document.createElement(tagName);
        if (className) node.className = className;
        node.textContent = text;
        return node;
      }

      function sectionTitle(text) {
        return textBlock('h3', '', text);
      }

      function securityLabel(item) {
        var security = item.op.security;
        if (security && security.length === 0) return 'Sin autenticacion';
        if (!security || security.length === 0) return 'Sin autenticacion';
        var first = security[0];
        var key = Object.keys(first)[0];
        if (key === 'deviceBearer') return 'Dispositivo: Bearer <tokenId>.<secret>';
        if (key === 'supabaseBearer') return 'Usuario: Bearer JWT de Supabase';
        return 'Bearer ' + key;
      }

      function schemaTypeLabel(schema) {
        var resolved = deref(schema);
        if (!resolved) return 'any';
        if (resolved.type) {
          if (Array.isArray(resolved.type)) return resolved.type.join(' | ');
          return resolved.type;
        }
        if (resolved.oneOf) return 'oneOf';
        if (resolved.anyOf) return 'anyOf';
        if (resolved.enum) return 'enum';
        return 'object';
      }

      function exampleFor(schema, depth) {
        var level = depth || 0;
        if (!schema || level > 6) return null;
        var resolved = deref(schema);
        if (!resolved) return null;
        if (resolved.example !== undefined) return resolved.example;
        if (resolved.examples && resolved.examples.length > 0) return resolved.examples[0];
        if (resolved['const'] !== undefined) return resolved['const'];
        if (resolved['default'] !== undefined) return resolved['default'];
        if (resolved.enum && resolved.enum.length > 0) return resolved.enum[0];
        var type = resolved.type;
        if (Array.isArray(type)) type = type[0];
        if (resolved.oneOf && resolved.oneOf.length > 0) return exampleFor(resolved.oneOf[0], level + 1);
        if (resolved.anyOf && resolved.anyOf.length > 0) return exampleFor(resolved.anyOf[0], level + 1);
        if (type === 'object' || resolved.properties) {
          var result = {};
          var props = resolved.properties || {};
          Object.keys(props).forEach(function (name) {
            result[name] = exampleFor(props[name], level + 1);
          });
          return result;
        }
        if (type === 'array') {
          return resolved.items ? [exampleFor(resolved.items, level + 1)] : [];
        }
        if (type === 'integer' || type === 'number') return 0;
        if (type === 'boolean') return false;
        if (type === 'string') {
          var format = resolved.format;
          if (format === 'date-time') return '2026-01-01T12:00:00.000Z';
          if (format === 'date') return '2026-01-01';
          if (format === 'uuid') return '00000000-0000-4000-8000-000000000000';
          if (format === 'email') return 'usuario@example.com';
          return 'string';
        }
        return null;
      }

      function requestBodyContent(item) {
        var body = item.op.requestBody;
        if (!body) return null;
        var contentMap = body.content || {};
        return contentMap['application/json'] || null;
      }

      function buildParameters(item) {
        var list = [];
        (item.op.parameters || []).forEach(function (raw) {
          var param = deref(raw);
          if (param && param.name) list.push(param);
        });
        return list;
      }

      function renderOperation(item) {
        content.textContent = '';
        var crumb = textBlock('div', 'crumb', item.op.tags ? item.op.tags.join(' / ') : 'General');
        content.appendChild(crumb);

        var title = document.createElement('h2');
        title.className = 'op-title';
        var badge = document.createElement('span');
        badge.className = 'method ' + methodClass(item.method);
        badge.textContent = item.method;
        var code = document.createElement('code');
        code.textContent = item.path;
        title.appendChild(badge);
        title.appendChild(code);
        content.appendChild(title);

        if (item.op.summary) {
          content.appendChild(textBlock('div', 'op-description', item.op.summary));
        }
        if (item.op.description) {
          content.appendChild(textBlock('div', 'op-description', item.op.description));
        }

        var security = document.createElement('span');
        security.className = 'security';
        security.textContent = securityLabel(item);
        content.appendChild(security);

        var params = buildParameters(item);
        var inputs = [];

        if (params.length > 0) {
          content.appendChild(sectionTitle('Parametros'));
          params.forEach(function (param, index) {
            var field = document.createElement('div');
            field.className = 'field';
            var label = document.createElement('label');
            label.setAttribute('for', 'param-' + index);
            label.textContent = param.name + ' (' + param.in + ')' + (param.required ? ' *' : '');
            field.appendChild(label);
            var input = document.createElement('input');
            input.id = 'param-' + index;
            input.type = 'text';
            input.placeholder = schemaTypeLabel(param.schema);
            if (param.description) input.placeholder = param.description;
            field.appendChild(input);
            inputs.push({ param: param, input: input });
            content.appendChild(field);
          });
        }

        var bodyContent = requestBodyContent(item);
        var bodyInput = null;
        if (bodyContent) {
          content.appendChild(sectionTitle('Cuerpo de la solicitud'));
          var bodyField = document.createElement('div');
          bodyField.className = 'field';
          var bodyLabel = document.createElement('label');
          bodyLabel.setAttribute('for', 'request-body');
          bodyLabel.textContent = 'application/json';
          bodyField.appendChild(bodyLabel);
          bodyInput = document.createElement('textarea');
          bodyInput.id = 'request-body';
          bodyInput.spellcheck = false;
          var example = exampleFor(bodyContent.schema, 0);
          bodyInput.value = JSON.stringify(example === null ? {} : example, null, 2);
          bodyField.appendChild(bodyInput);
          var hint = textBlock('div', 'hint', 'Edita el JSON de ejemplo antes de enviar la solicitud.');
          bodyField.appendChild(hint);
          content.appendChild(bodyField);
        }

        content.appendChild(sectionTitle('Respuestas'));
        var table = document.createElement('table');
        var thead = document.createElement('thead');
        var headRow = document.createElement('tr');
        headRow.appendChild(textBlock('th', '', 'Codigo'));
        headRow.appendChild(textBlock('th', '', 'Descripcion'));
        thead.appendChild(headRow);
        table.appendChild(thead);
        var tbody = document.createElement('tbody');
        var responses = item.op.responses || {};
        Object.keys(responses).sort().forEach(function (status) {
          var response = deref(responses[status]);
          var row = document.createElement('tr');
          row.appendChild(textBlock('td', '', status));
          row.appendChild(textBlock('td', '', (response && response.description) || ''));
          tbody.appendChild(row);
        });
        table.appendChild(tbody);
        content.appendChild(table);

        var bar = document.createElement('div');
        bar.className = 'try-bar';
        var send = document.createElement('button');
        send.type = 'button';
        send.className = 'primary';
        send.textContent = 'Enviar solicitud';
        var statusLabel = document.createElement('span');
        statusLabel.className = 'status';
        bar.appendChild(send);
        bar.appendChild(statusLabel);
        content.appendChild(bar);

        var pre = document.createElement('pre');
        pre.textContent = 'La respuesta aparecera aqui.';
        content.appendChild(pre);

        send.addEventListener('click', function () {
          send.disabled = true;
          statusLabel.textContent = 'Enviando...';
          statusLabel.className = 'status';
          pre.textContent = '';

          var path = item.path;
          var query = [];
          var headers = {};
          var token = tokenInput.value.trim();
          if (token) headers.Authorization = 'Bearer ' + token;

          inputs.forEach(function (entry) {
            var value = entry.input.value.trim();
            if (!value) return;
            if (entry.param.in === 'path') {
              path = path.split('{' + entry.param.name + '}').join(encodeURIComponent(value));
            } else if (entry.param.in === 'query') {
              query.push(encodeURIComponent(entry.param.name) + '=' + encodeURIComponent(value));
            } else if (entry.param.in === 'header') {
              headers[entry.param.name] = value;
            }
          });

          var options = { method: item.method.toUpperCase(), headers: headers };
          if (bodyInput && item.method !== 'get' && item.method !== 'delete') {
            try {
              JSON.parse(bodyInput.value);
            } catch (error) {
              send.disabled = false;
              statusLabel.textContent = 'JSON invalido en el cuerpo';
              statusLabel.className = 'status bad';
              return;
            }
            headers['Content-Type'] = 'application/json';
            options.body = bodyInput.value;
          }

          var url = '/api/v1' + path + (query.length > 0 ? '?' + query.join('&') : '');

          fetch(url, options)
            .then(function (response) {
              var ok = response.status >= 200 && response.status < 300;
              statusLabel.textContent = response.status + ' ' + response.statusText;
              statusLabel.className = 'status ' + (ok ? 'ok' : 'bad');
              if (response.status === 204) return '(sin contenido)';
              var type = response.headers.get('content-type') || '';
              if (type.indexOf('application/json') >= 0) {
                return response.json().then(function (payload) {
                  return JSON.stringify(payload, null, 2);
                });
              }
              return response.text();
            })
            .then(function (text) {
              pre.textContent = text;
            })
            .catch(function (error) {
              statusLabel.textContent = 'Error de red';
              statusLabel.className = 'status bad';
              pre.textContent = String(error);
            })
            .then(function () {
              send.disabled = false;
            });
        });
      }

      function updateMeta() {
        var info = spec.info || {};
        document.getElementById('doc-title').textContent = info.title || 'API';
        document.getElementById('doc-subtitle').textContent =
          'OpenAPI ' + spec.openapi + ' / version ' + (info.version || '-') + ' / ' + (info.description || '');
        document.getElementById('spec-meta').textContent =
          operations.length + ' operaciones documentadas en ' + Object.keys(spec.paths || {}).length + ' rutas.';
      }

      search.addEventListener('input', renderNav);

      fetch('/api/v1/openapi.json')
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then(function (document) {
          spec = document;
          operations = collectOperations();
          updateMeta();
          renderNav();
        })
        .catch(function (error) {
          content.textContent = '';
          content.appendChild(textBlock('h2', '', 'No se pudo cargar la especificacion'));
          content.appendChild(textBlock('p', 'empty', String(error)));
        });
    })();
  </script>
</body>
</html>`

export const openApiRouter = Router()

openApiRouter.get('/openapi.json', (_req, res) => {
  res.status(200).json(openApiDocument)
})

openApiRouter.get('/docs', (_req, res) => {
  res.setHeader('Content-Security-Policy', DOCS_CONTENT_SECURITY_POLICY)
  res.type('html').status(200).send(DOCS_HTML)
})
