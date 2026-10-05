# Expenses UI

Frontend React com TypeScript e Vite. A interface atual é o template inicial.

## Executar em container

Partindo da raiz do repositório:

```bash
cd expenses-infrastructure
docker --context desktop-linux compose up -d --build --wait
```

Acesse <http://localhost:5173>. O Dockerfile executa `npm ci` e `npm run build`
com Node 24. A imagem final usa Nginx sem root na porta interna 8080 e serve
somente os arquivos compilados de `dist`.

O Nginx encaminha `/api/` para o backend na rede do Compose. Por exemplo,
`/api/health/db` acessa `/health/db` da API. Use esse prefixo em chamadas HTTP
do React para manter a mesma origem. Valores `VITE_*` usados pelo Vite fazem
parte dos arquivos públicos; configure somente dados públicos nesse formato.

Rotas da aplicação têm fallback para `index.html`. Assets com nomes gerados pelo
Vite recebem cache longo; o HTML deve ser revalidado. Para atualizar o container
após alterações, execute novamente o comando com `--build`.

Consulte portas, configuração, logs e encerramento no [guia de infraestrutura](../expenses-infrastructure/README.md).

## Desenvolvimento com Vite

Dentro de `expenses-ui`, com Node 24 instalado:

```bash
npm ci
npm run dev
```

O proxy `/api/` descrito acima pertence ao Nginx do container. O servidor Vite
ainda usa a configuração original, sem proxy de API. Pare o container frontend
antes de usar a porta 5173 com Vite.

Para gerar os arquivos estáticos e verificar o código:

```bash
npm run build
npm run lint
```

## Template React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
