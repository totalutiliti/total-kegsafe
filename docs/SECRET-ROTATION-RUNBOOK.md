# Runbook de Rotacao de Secrets -- KegSafe Tech

> Procedimentos para rotacao de todos os segredos do sistema KegSafe.
> Cada secret tem frequencia de rotacao, procedimento e validacao.

**Ultima atualizacao:** 2026-02-28
**Responsavel:** Equipe de Engenharia / DevOps KegSafe

---

## 1. Inventario de Secrets

| Secret | Localidade | Rotacao | Criticidade |
|--------|-----------|---------|-------------|
| `JWT_SECRET` | Azure Key Vault + App Settings | 90 dias | Alta |
| `JWT_REFRESH_SECRET` | Azure Key Vault + App Settings | 90 dias | Alta |
| `PEPPER_SECRET` | Azure Key Vault + App Settings | Anual | Critica |
| `DATABASE_URL` | Azure Key Vault + App Settings | 90 dias | Alta |
| ACR Credentials | Azure Container Registry | Auto (Azure) | Media |
| `AZURE_CREDENTIALS` | GitHub Secrets | Anual | Alta |

---

## 2. Procedimentos de Rotacao

### 2.1 JWT_SECRET (Rotacao a cada 90 dias)

**O que e:** Chave usada para assinar tokens JWT de acesso (validade: 15min).

**Impacto da rotacao:** Tokens ativos serao invalidados. Usuarios precisarao re-autenticar via refresh token.

**Procedimento:**

```bash
# 1. Gerar novo secret
NEW_SECRET=$(openssl rand -base64 32)
echo "Novo JWT_SECRET gerado (NAO logar este valor)"

# 2. Atualizar no Azure Key Vault
az keyvault secret set \
  --vault-name kv-kegsafe-prod \
  --name jwt-secret \
  --value "$NEW_SECRET"

# 3. Atualizar App Settings do backend
az webapp config appsettings set \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --settings JWT_SECRET="$NEW_SECRET"

# 4. Reiniciar o container para aplicar
az webapp restart \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend

# 5. Validar
curl -s https://kegsafe-backend.azurewebsites.net/health | jq .
```

**Validacao pos-rotacao:**
1. Health check retorna `200 OK`
2. Login funciona normalmente
3. Tokens antigos retornam `401 Unauthorized` (esperado)
4. Refresh token gera novo access token com novo secret

---

### 2.2 JWT_REFRESH_SECRET (Rotacao a cada 90 dias)

**O que e:** Chave usada para assinar refresh tokens (validade: 7 dias).

**Impacto da rotacao:** Todos os refresh tokens ativos serao invalidados. Usuarios precisarao fazer login novamente.

**Procedimento:**

```bash
# 1. Gerar novo secret
NEW_REFRESH_SECRET=$(openssl rand -base64 32)

# 2. Atualizar no Azure Key Vault
az keyvault secret set \
  --vault-name kv-kegsafe-prod \
  --name jwt-refresh-secret \
  --value "$NEW_REFRESH_SECRET"

# 3. Atualizar App Settings
az webapp config appsettings set \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --settings JWT_REFRESH_SECRET="$NEW_REFRESH_SECRET"

# 4. Limpar refresh tokens expirados do banco (opcional, boa pratica)
# Executar via conexao segura ao banco:
# DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = true;

# 5. Reiniciar container
az webapp restart \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend
```

**Janela de manutencao recomendada:** Rotacionar JWT_SECRET e JWT_REFRESH_SECRET juntos, preferencialmente em horario de baixo uso (madrugada, horario de Brasilia).

---

### 2.3 PEPPER_SECRET (Rotacao anual)

> **ATENCAO CRITICA:** A rotacao do PEPPER_SECRET invalida TODAS as senhas no sistema. Todos os usuarios precisarao redefinir suas senhas.

**O que e:** Salt global (pepper) adicionado ao hash Argon2id das senhas.

**Impacto da rotacao:** TODOS os hashes de senha existentes se tornam invalidos. Requer forced password reset para todos os usuarios.

**Procedimento:**

```bash
# 1. ANTES de rotacionar: comunicar todos os tenants sobre janela de manutencao
# Enviar email/notificacao com 7 dias de antecedencia

# 2. Gerar novo pepper
NEW_PEPPER=$(openssl rand -base64 32)

# 3. Atualizar no Azure Key Vault
az keyvault secret set \
  --vault-name kv-kegsafe-prod \
  --name pepper-secret \
  --value "$NEW_PEPPER"

# 4. Atualizar App Settings
az webapp config appsettings set \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --settings PEPPER_SECRET="$NEW_PEPPER"

# 5. Forcar reset de senha para todos os usuarios
# Executar via conexao segura ao banco:
# UPDATE users SET
#   password_hash = NULL,
#   failed_login_attempts = 0,
#   locked_until = NULL
# WHERE deleted_at IS NULL;

# 6. Reiniciar container
az webapp restart \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend

# 7. Enviar email de reset de senha para todos os usuarios ativos
# (via sistema de notificacoes ou script dedicado)
```

**Checklist pos-rotacao:**
- [ ] Todos os usuarios notificados
- [ ] Nenhum login funciona com senha antiga (esperado)
- [ ] Fluxo de reset de senha funciona
- [ ] Novos hashes usam o novo pepper

---

### 2.4 DATABASE_URL (Rotacao a cada 90 dias)

**O que e:** String de conexao com o PostgreSQL incluindo credenciais.

**Impacto da rotacao:** Breve downtime (~30s) durante o restart do container.

**Procedimento:**

```bash
# 1. Alterar senha no PostgreSQL PRIMEIRO
az postgres flexible-server update \
  --resource-group rg-kegsafe-prod \
  --name pg-kegsafe-prod \
  --admin-password "$(openssl rand -base64 24)"

# 2. Construir nova DATABASE_URL
# Formato: postgresql://USER:NOVA_SENHA@HOST:5432/kegsafe_prod?sslmode=require
NEW_DB_URL="postgresql://kegsafe_admin:NOVA_SENHA@pg-kegsafe-prod.postgres.database.azure.com:5432/kegsafe_prod?sslmode=require"

# 3. Atualizar no Azure Key Vault
az keyvault secret set \
  --vault-name kv-kegsafe-prod \
  --name database-url \
  --value "$NEW_DB_URL"

# 4. Atualizar App Settings
az webapp config appsettings set \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend \
  --settings DATABASE_URL="$NEW_DB_URL"

# 5. Reiniciar container
az webapp restart \
  --resource-group rg-kegsafe-prod \
  --name kegsafe-backend

# 6. Validar conectividade
curl -s https://kegsafe-backend.azurewebsites.net/health | jq .
```

**Ordem critica:** SEMPRE alterar a senha no PostgreSQL ANTES de atualizar a DATABASE_URL na aplicacao. Caso contrario, a aplicacao tera a senha nova mas o banco ainda espera a antiga.

---

### 2.5 ACR Credentials (Gerenciado pelo Azure)

**O que e:** Credenciais do Azure Container Registry para pull de imagens.

**Rotacao:** Automatica quando habilitado no ACR.

```bash
# Verificar se auto-rotation esta habilitada
az acr credential show --name kegsafeacr

# Se necessario rotacionar manualmente
az acr credential renew --name kegsafeacr --password-name password

# Atualizar GitHub Secrets apos rotacao manual:
# Settings > Secrets > ACR_USERNAME
# Settings > Secrets > ACR_PASSWORD
```

---

### 2.6 AZURE_CREDENTIALS (Rotacao anual)

**O que e:** Service principal usado pelo GitHub Actions para deploy no Azure.

**Procedimento:**

```bash
# 1. Criar novo secret para o service principal existente
az ad sp credential reset \
  --id <SERVICE_PRINCIPAL_APP_ID> \
  --years 1

# 2. O output sera um JSON como:
# {
#   "appId": "...",
#   "password": "...",
#   "tenant": "..."
# }

# 3. Atualizar no GitHub:
# Repository > Settings > Secrets > AZURE_CREDENTIALS
# Colar o JSON completo

# 4. Validar: executar workflow manualmente
# GitHub > Actions > Deploy to Azure > Run workflow
```

---

## 3. Politica de Rotacao no Azure Key Vault

### 3.1 Configurar Politica Automatica

```bash
# Configurar politica de rotacao para JWT_SECRET (90 dias)
az keyvault secret rotation-policy update \
  --vault-name kv-kegsafe-prod \
  --name jwt-secret \
  --value '{
    "lifetimeActions": [
      {
        "trigger": {
          "timeBeforeExpiry": "P30D"
        },
        "action": {
          "type": "Notify"
        }
      }
    ],
    "attributes": {
      "expiryTime": "P90D"
    }
  }'

# Repetir para jwt-refresh-secret com mesmos parametros

# Configurar politica para database-url (90 dias)
az keyvault secret rotation-policy update \
  --vault-name kv-kegsafe-prod \
  --name database-url \
  --value '{
    "lifetimeActions": [
      {
        "trigger": {
          "timeBeforeExpiry": "P30D"
        },
        "action": {
          "type": "Notify"
        }
      }
    ],
    "attributes": {
      "expiryTime": "P90D"
    }
  }'
```

### 3.2 Configurar Alertas

```bash
# Configurar alerta no Azure Monitor para expiracao de secrets
az monitor action-group create \
  --resource-group rg-kegsafe-prod \
  --name ag-kegsafe-secrets \
  --short-name SecretAlert \
  --email-receiver name=DevOps email=devops@kegsafe.com.br
```

---

## 4. Calendario de Rotacao

| Mes | Acao |
|-----|------|
| Janeiro | Rotacao DATABASE_URL + JWT secrets |
| Fevereiro | -- |
| Marco | -- |
| Abril | Rotacao DATABASE_URL + JWT secrets |
| Maio | -- |
| Junho | -- |
| Julho | Rotacao DATABASE_URL + JWT secrets |
| Agosto | -- |
| Setembro | -- |
| Outubro | Rotacao DATABASE_URL + JWT secrets |
| Novembro | -- |
| Dezembro | Rotacao PEPPER_SECRET (anual) + AZURE_CREDENTIALS (anual) |

---

## 5. Checklist de Emergencia (Vazamento de Secret)

Se um secret for comprometido:

1. **Rotacionar imediatamente** seguindo o procedimento acima
2. **Revogar todos os tokens ativos** (limpar tabela `refresh_tokens`)
3. **Analisar logs de auditoria** para identificar acessos suspeitos
4. **Notificar a equipe** via canal de incidentes
5. **Documentar o incidente** com timeline e acoes tomadas
6. **Avaliar impacto** em dados de tenants

```bash
# Revogar todos os refresh tokens (emergencia)
# Via conexao segura ao banco:
# UPDATE refresh_tokens SET revoked = true WHERE revoked = false;
```

---

*Documento mantido pela equipe de DevOps. Revisao obrigatoria apos cada rotacao e a cada 6 meses.*
