# Acordo de Tratamento de Dados (DPA) — KegSafe Tech

> ⚠️ **MODELO / RASCUNHO.** Não é aconselhamento jurídico. **Revise com um(a) advogado(a)**
> antes de assinar. Anexo aos Termos de Uso / contrato principal. Base: LGPD (Lei 13.709/2018).
>
> **Versão:** `1.0-rascunho`

## Partes

- **Operador:** `[TotalUtiliti Management Consultoria Ltda]`, CNPJ `[__]` ("Operador").
- **Controlador:** o cliente contratante identificado no contrato principal ("Controlador").

O Controlador determina as finalidades e meios essenciais do tratamento; o Operador trata os
dados pessoais **em nome e sob as instruções** do Controlador, exclusivamente para prestar a
Plataforma KegSafe Tech.

## 1. Objeto e duração

Tratamento de dados pessoais pelo Operador, em nome do Controlador, pelo prazo de vigência do
contrato principal, prorrogável enquanto durar a prestação do serviço.

## 2. Natureza, finalidade e escopo do tratamento

| Item | Descrição |
|---|---|
| **Natureza** | coleta, armazenamento, organização, consulta, uso, eliminação |
| **Finalidade** | operar a Plataforma de gestão de barris em favor do Controlador |
| **Categorias de titulares** | usuários operacionais do Controlador; contatos de clientes/PDVs |
| **Tipos de dados** | nome, e-mail, telefone, endereço, perfil, IP/user-agent, geolocalização |
| **Dados sensíveis** | não previstos; se ocorrerem, exigem instrução e salvaguarda específica |

## 3. Obrigações do Operador

O Operador se compromete a:
1. tratar os dados **apenas conforme instruções documentadas** do Controlador (incluindo este DPA);
2. garantir **confidencialidade** — pessoal autorizado obrigado a sigilo;
3. adotar **medidas de segurança** adequadas (ver Anexo A);
4. **assistir** o Controlador no atendimento aos direitos dos titulares (Art. 18) e a pedidos
   da ANPD, na medida do tecnicamente viável;
5. **notificar** o Controlador sobre incidentes de segurança **sem demora indevida** após
   tomar conhecimento, com as informações disponíveis para eventual comunicação à ANPD/titulares;
6. ao término do contrato, **eliminar ou devolver** os dados pessoais, salvo obrigação legal
   de retenção, no prazo de `[prazo]`;
7. manter **registro** das operações de tratamento que realiza para o Controlador.

## 4. Subprocessadores (suboperadores)

O Controlador autoriza o uso dos suboperadores abaixo. O Operador permanece responsável e
imporá a eles obrigações equivalentes. Alterações relevantes serão comunicadas com
oportunidade de objeção.

| Suboperador | Finalidade | Localização |
|---|---|---|
| Microsoft Azure | hospedagem/infraestrutura/banco | `[Brazil South]` |
| `[SendGrid / e-mail]` | e-mails transacionais | `[__]` |
| `[Application Insights]` | telemetria | `[__]` |

## 5. Transferência internacional

Havendo transferência internacional de dados, o Operador adotará mecanismo legítimo da LGPD
(Art. 33), como cláusulas contratuais adequadas ou país com nível de proteção adequado.
`[Confirmar a realidade da infraestrutura e listar países envolvidos.]`

## 6. Direitos dos titulares e da ANPD

O Operador encaminhará ao Controlador, sem demora, solicitações de titulares recebidas
diretamente, e prestará assistência razoável para o Controlador respondê-las.

## 7. Auditoria

O Operador disponibilizará, mediante solicitação razoável e sob confidencialidade, informações
necessárias para demonstrar conformidade com este DPA, incluindo relatórios/certificações
`[quando aplicável]`.

## 8. Responsabilidade

A responsabilidade de cada parte observa a LGPD e o contrato principal. `[Ajustar cláusula de
responsabilidade/limitação conforme orientação jurídica.]`

## 9. Vigência e término

Este DPA vigora enquanto houver tratamento de dados pelo Operador em nome do Controlador. No
término, aplica-se a cláusula 3.6 (eliminação/devolução).

---

## Anexo A — Medidas técnicas e organizacionais de segurança

- Autenticação com hash **Argon2id + pepper**; tokens de sessão httpOnly/SameSite; rotação e
  revogação de refresh tokens; detecção de reuso de token.
- **Isolamento por tenant** na aplicação; controle de acesso por perfil (RBAC, deny-by-default).
- **HTTPS/HSTS**, cabeçalhos de segurança (CSP, nosniff), rate limiting.
- **Criptografia em repouso** da infraestrutura (Azure SSE/AES-256); backups com PITR.
- **Trilha de auditoria** de operações sensíveis; logs com mascaramento de dados sensíveis.
- Validação de upload por assinatura (magic bytes) e servação como download (anti-XSS).
- Processo de **backup/DR** documentado; plano de resposta a incidentes.

> Roadmap de segurança recomendado (ver relatório de validação): RLS no banco (defesa em
> profundidade), Managed Identity/Key Vault, endpoints LGPD self-service, scan de imagem no CI.

---
*Rascunho técnico. Revisão jurídica obrigatória antes da assinatura.*
