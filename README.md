# PCM Talent AI

Sistema de apoio ao recrutamento e seleção industrial, com vagas, candidatos,
avaliações por etapa, trilha de auditoria e integração opcional com Gemini.

## Segurança do Firebase

O aplicativo usa Firebase Authentication e documentos em `users/{uid}` para
autorizar o acesso. O navegador nunca pode decidir sozinho a função do usuário:
as permissões efetivas são aplicadas por `firestore.rules`.

Regras principais:

- visitante e conta sem perfil ativo não acessam dados;
- Observador lê vagas, mas não currículos;
- RH, Gestor e Diretoria alteram apenas sua parte da avaliação;
- somente administradores listam usuários e logs;
- somente administradores excluem candidatos;
- logs aceitam somente inclusão e validam autor, função e horário do servidor;
- qualquer coleção não declarada é bloqueada por padrão.

Novos usuários devem ser criados primeiro no Firebase Authentication. Em
seguida, deve ser criado `users/{uid}` com o mesmo UID, e-mail, uma função válida
e `status: "Ativo"`. O aplicativo não realiza autocadastro.

## Teste local das regras

Pré-requisitos gratuitos: Node.js 20+ e Java 21+.

```bash
pnpm install
pnpm test:rules
```

Os testes usam o Firestore Emulator e somente dados fictícios. Eles não acessam
nem alteram o banco de produção.

## Publicação

### Firestore

```bash
firebase login
firebase deploy --only firestore:rules --project pcm-talent-ai
```

### Vercel

O repositório está ligado ao projeto `pcm-talent-ai`. Um push para a branch
`main` dispara a implantação de produção. O `vercel.json` aplica cabeçalhos de
segurança e impede cache persistente do HTML principal.

## Segredos e dados pessoais

- Não salve senhas, tokens ou chaves privadas no repositório.
- A configuração pública do SDK Web do Firebase identifica o projeto, mas não
  substitui autenticação nem regras de acesso.
- A chave Gemini permanece somente no navegador do usuário. Para uso
  corporativo, a evolução recomendada é mover chamadas de IA para um backend,
  limitar a chave e definir política de retenção/consentimento para currículos.
- Não use currículos ou dados pessoais reais em testes.
