# Política de Privacidade — KegSafe Tech

> ⚠️ **MODELO / RASCUNHO.** Não é aconselhamento jurídico. **Revise com um(a) advogado(a)/DPO**
> e preencha os campos entre `[colchetes]` antes de publicar. Baseado na LGPD (Lei 13.709/2018).
>
> **Última atualização:** `[DATA]` · **Versão:** `1.0-rascunho`

## 1. Quem somos e papéis (LGPD)

Esta Política descreve como a plataforma **KegSafe Tech**, operada por
**`[TotalUtiliti Management Consultoria Ltda]`** (CNPJ `[__]`) ("nós"), trata dados pessoais.

- **Dados dos clientes contratantes** (cadastro do contratante, faturamento, contatos
  administrativos): tratados por nós como **Controlador**.
- **Dados operacionais inseridos pelos clientes na Plataforma** (usuários operacionais,
  contatos de PDVs/clientes finais, geolocalização de barris): tratados por nós como
  **Operador**, em nome do cliente contratante (que é o **Controlador**). Nesse caso, esta
  Política é complementada pelo **DPA**.

## 2. Dados pessoais que tratamos

| Categoria | Exemplos | Origem |
|---|---|---|
| Identificação/contato de usuários | nome, e-mail, telefone, perfil de acesso | cadastro pelo cliente |
| Credenciais | hash de senha (Argon2id + pepper), tokens de sessão | login |
| Contatos de clientes/PDVs | nome, e-mail, telefone, endereço | cadastro pelo cliente |
| Dados de uso e segurança | endereço IP, user-agent, logs de acesso e auditoria | uso da Plataforma |
| Geolocalização | latitude/longitude de barris e eventos logísticos | operação em campo |

> Não tratamos, por padrão, **dados sensíveis** (LGPD Art. 5º, II) nem **CPF** dos titulares.
> Se o cliente inserir tais dados, aplicam-se salvaguardas adicionais.

## 3. Finalidades e bases legais (LGPD Art. 7º/10)

| Finalidade | Base legal |
|---|---|
| Prestar e operar a Plataforma (autenticação, gestão de ativos, logística, manutenção) | Execução de contrato (Art. 7º, V) |
| Segurança da informação, prevenção a fraude, logs e auditoria | Legítimo interesse (Art. 7º, IX) |
| Cumprimento de obrigações legais/regulatórias | Obrigação legal (Art. 7º, II) |
| Suporte e comunicação sobre o serviço | Execução de contrato (Art. 7º, V) |

`[Ajustar conforme cada tratamento efetivo; documentar em ROPA.]`

## 4. Compartilhamento e operadores (subprocessadores)

Compartilhamos dados apenas com prestadores necessários à operação, sob contrato e
salvaguardas:
- **Microsoft Azure** — hospedagem/infraestrutura (região `[Brazil South]`);
- **`[SendGrid / provedor de e-mail]`** — envio de e-mails transacionais/alertas;
- **`[Application Insights / monitoramento]`** — telemetria operacional.

Não vendemos dados pessoais.

## 5. Transferência internacional

Buscamos manter os dados hospedados no Brasil (`[Azure Brazil South]`). Havendo transferência
internacional (ex.: subprocessador fora do país), adotaremos as salvaguardas da LGPD
(Art. 33), como cláusulas contratuais adequadas. `[Confirmar a realidade da infra.]`

## 6. Retenção e eliminação

Mantemos os dados pelo tempo necessário às finalidades e obrigações legais. Encerrado o
contrato, os dados operacionais são eliminados ou devolvidos conforme o DPA e o prazo de
`[prazo]`. Logs de segurança seguem política de retenção própria `[definir]`.

## 7. Direitos do titular (LGPD Art. 18)

O titular pode solicitar: confirmação de tratamento, acesso, correção, anonimização/bloqueio/
eliminação, portabilidade, informação sobre compartilhamentos e revogação de consentimento
(quando aplicável). Para dados operacionais de um cliente, direcionamos o pedido ao respectivo
**Controlador**. Canal: **`[e-mail do Encarregado/DPO]`**.

> Nota técnica: a Plataforma ainda **não** possui endpoints self-service de exportação/
> exclusão de dados do titular — recomenda-se implementá-los (ver relatório de validação).

## 8. Segurança

Adotamos medidas técnicas e organizacionais, incluindo: senhas com Argon2id + pepper,
cookies httpOnly/SameSite, HTTPS/HSTS, CSP, isolamento por tenant, rate limiting, controle de
acesso por perfil (RBAC), criptografia em repouso da infraestrutura e trilha de auditoria.

## 9. Cookies

Utilizamos cookies estritamente necessários para autenticação (`accessToken`/`refreshToken`,
httpOnly). `[Se houver cookies analíticos, listar e obter base legal adequada.]`

## 10. Encarregado (DPO) e contato

Encarregado pelo Tratamento de Dados Pessoais: **`[Nome]`** — **`[e-mail]`**.
`[A LGPD exige a indicação de um Encarregado.]`

## 11. Alterações

Podemos atualizar esta Política; alterações relevantes serão comunicadas. A data de "última
atualização" indica a versão vigente.

---
*Rascunho técnico. Revisão por advogado/DPO obrigatória antes da publicação.*
