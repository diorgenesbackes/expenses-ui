# Expenses UI

React/TypeScript/Vite, Node 24. Interface de autenticação do Contas da Casa: `/login`, `/cadastro` e `/` com identidade e saída da conta. Cadastro não autentica automaticamente. Household, recuperação de senha, MFA e login social estão fora desta entrega.

## Segurança e sessão

A API é acessada na mesma origem, pelo prefixo `/api/`. Cookies de autenticação são HttpOnly/Secure/SameSite Strict; tokens não são lidos pelo React. O token CSRF fica apenas em memória. Somente o e-mail é salvo em localStorage mediante opção; desmarcar remove a preferência. Senha e credenciais não são persistidas pelo aplicativo.

A sessão é consultada na abertura, ao retomar a aba e após a expiração do acesso. Falhas encerram a visão autenticada; conflito de renovação preserva a sessão e apresenta mensagem. Não há repetição automática de login/cadastro. Uma repetição manual de cadastro no mesmo formulário/e-mail reutiliza a chave de idempotência. Alterar a senha nessa repetição não altera a credencial do cadastro original. Sair atualiza as demais abas via BroadcastChannel; autorização/revogação continuam sendo responsabilidade do backend. Sem BroadcastChannel, a aba consulta a sessão ao recuperar foco.

## Verificar localmente

```bash
npm ci
npm run lint
npm test
npm run build
```

Só testes unitários ficam neste projeto. Para jornadas reais no navegador com banco descartável, Liquibase, HTTPS e identidade simulada, executar em [expenses-tests](../expenses-tests/README.md):

```bash
python3 scripts/lab.py all
```

O laboratório não usa AWS, não altera o banco de desenvolvimento e destrói seus recursos ao terminar. Ele não homologa latência do Cognito.

## Desenvolvimento com HTTPS e API real

O Vite tem proxy `/api` para `https://localhost:7285` por padrão, configurável por `EXPENSES_API_URL`. A verificação do certificado da API permanece habilitada. Antes de autenticar:

1. Disponibilizar certificados locais para localhost, confiáveis no navegador e no processo Node (CA privada via `NODE_EXTRA_CA_CERTS` quando necessário). Nunca versionar chaves privadas.
2. Configurar os caminhos `EXPENSES_TLS_CERT` e `EXPENSES_TLS_KEY` no processo do Vite; ambos habilitam HTTPS. São configuração do servidor, não variáveis `VITE_*`.
3. Iniciar API no perfil `https`, com banco migrado, configuração Cognito privada e chaves de sessão. Consultar a [operação da FDD](../expenses-docs/fdd/FDD-Criacao-Usuario-Autenticacao/4-operacao.md).
4. Executar `npm run dev` e abrir a origem HTTPS exibida. O proxy preserva o Host para a verificação de mesma origem; não desabilitar CSRF/TLS.

Sem certificados, Vite pode exibir a interface por HTTP, mas não é um ambiente válido para autenticação. `VITE_*` sempre é público; nunca colocar segredos ali.

## Container existente

O Dockerfile compila com Node 24 e publica com Nginx sem root. O Nginx já suporta as rotas React e o proxy `/api/`. Reconstruir a imagem para incorporar mudanças. **O Compose atual publica HTTP e não injeta a configuração privada Cognito do host:** a tela pode ser visualizada, mas autenticação real exige concluir HTTPS/configuração de execução. Não confundir isso com o laboratório HTTPS validado.

Consulte o [guia de infraestrutura](../expenses-infrastructure/README.md). Os serviços de desenvolvimento foram parados para esta entrega; o banco foi preservado.
