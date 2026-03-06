# Classificacao de Dados -- KegSafe Tech

> Documento de classificacao de dados sensiveis do sistema KegSafe.
> Baseado no schema Prisma v2 e nos requisitos de conformidade LGPD.

**Ultima atualizacao:** 2026-02-28
**Responsavel:** Equipe de Engenharia KegSafe

---

## 1. Categorias de Classificacao

| Categoria | Codigo | Descricao |
|-----------|--------|-----------|
| Dados Pessoais Identificaveis | **PII** | Dados que identificam diretamente uma pessoa fisica (nome, email, telefone, IP) |
| Dados Pessoais Sensiveis de Negocio | **SPI** | Dados empresariais protegidos (CNPJ, razao social) |
| Dados Financeiros | **Financial** | Valores monetarios, custos, taxas |
| Credenciais | **Credential** | Segredos de autenticacao (hashes, tokens) |
| Dados Internos | **Internal** | Dados operacionais sem restricao especial |

---

## 2. Inventario de Campos Sensiveis por Model

### 2.1 User (`users`)

| Campo | Tipo DB | Classificacao | Justificativa |
|-------|---------|---------------|---------------|
| `email` | VarChar(255) | **PII** | Identifica pessoa fisica, usado para login |
| `name` | VarChar(150) | **PII** | Nome completo do usuario |
| `phone` | VarChar(20) | **PII** | Telefone pessoal, formato E.164 |
| `passwordHash` | VarChar(255) | **Credential** | Hash Argon2id da senha do usuario |

### 2.2 Tenant (`tenants`)

| Campo | Tipo DB | Classificacao | Justificativa |
|-------|---------|---------------|---------------|
| `cnpj` | VarChar(14) | **SPI** | Cadastro Nacional de Pessoa Juridica |
| `name` | VarChar(200) | **SPI** | Razao social da cervejaria |
| `settings` | Json | **Internal** | Configuracoes operacionais do tenant |

### 2.3 Client (`clients`)

| Campo | Tipo DB | Classificacao | Justificativa |
|-------|---------|---------------|---------------|
| `cnpj` | VarChar(14) | **SPI** | CNPJ do cliente (bar, restaurante) |
| `name` | VarChar(200) | **PII** | Nome/razao social do cliente |
| `email` | VarChar(255) | **PII** | Email de contato do cliente |
| `phone` | VarChar(20) | **PII** | Telefone de contato |

### 2.4 RefreshToken (`refresh_tokens`)

| Campo | Tipo DB | Classificacao | Justificativa |
|-------|---------|---------------|---------------|
| `token` | VarChar(255) | **Credential** | Hash SHA-256 do token de refresh |
| `ipAddress` | VarChar(45) | **PII** | Endereco IP do dispositivo (IPv4/IPv6) |
| `userAgent` | VarChar(500) | **PII** | Identificador do navegador/dispositivo |

### 2.5 Barrel (`barrels`)

| Campo | Tipo DB | Classificacao | Justificativa |
|-------|---------|---------------|---------------|
| `acquisitionCost` | Decimal(10,2) | **Financial** | Custo de aquisicao do barril |
| `currentLatitude` | Decimal(10,7) | **Internal** | Latitude atual do barril (rastreamento) |
| `currentLongitude` | Decimal(10,7) | **Internal** | Longitude atual do barril (rastreamento) |

### 2.6 AuditLog (`audit_logs`)

| Campo | Tipo DB | Classificacao | Justificativa |
|-------|---------|---------------|---------------|
| `ipAddress` | VarChar(45) | **PII** | IP de quem executou a acao |
| `userAgent` | VarChar(500) | **PII** | User-Agent de quem executou a acao |

### 2.7 Supplier (`suppliers`)

| Campo | Tipo DB | Classificacao | Justificativa |
|-------|---------|---------------|---------------|
| `cnpj` | VarChar(14) | **SPI** | CNPJ do fornecedor |

### 2.8 ServiceProvider (`service_providers`)

| Campo | Tipo DB | Classificacao | Justificativa |
|-------|---------|---------------|---------------|
| `hourlyRate` | Decimal(10,2) | **Financial** | Valor/hora do prestador |
| `serviceRate` | Decimal(10,2) | **Financial** | Taxa de servico do prestador |

### 2.9 Disposal (`disposals`)

| Campo | Tipo DB | Classificacao | Justificativa |
|-------|---------|---------------|---------------|
| `tcoAccumulated` | Decimal(12,2) | **Financial** | TCO acumulado do barril ate o descarte |
| `replacementCost` | Decimal(10,2) | **Financial** | Custo estimado de reposicao |
| `scrapValue` | Decimal(10,2) | **Financial** | Valor de sucata/reciclagem |

---

## 3. Regras de Tratamento por Classificacao

### 3.1 PII -- Dados Pessoais Identificaveis

| Aspecto | Regra |
|---------|-------|
| **Logging** | Mascarar SEMPRE em logs. Exemplo: `email = j***@email.com`, `phone = +55***9999` |
| **Retencao** | 5 anos apos inativacao do registro, conforme LGPD |
| **Criptografia** | Encrypt at rest (Azure PostgreSQL TDE habilitado) |
| **Acesso** | Role-based access -- somente usuarios autenticados do mesmo tenant |
| **Exportacao** | Sujeito a consentimento do titular (LGPD Art. 18) |
| **Anonimizacao** | Obrigatoria em ambientes de desenvolvimento e staging |

**Implementacao no KegSafe:**
```typescript
// Exemplo de mascaramento em logs (LoggingInterceptor)
function maskPII(field: string, value: string): string {
  if (field === 'email') return value.replace(/(.{2}).*(@.*)/, '$1***$2');
  if (field === 'phone') return value.replace(/(.{4}).*(.{4})/, '$1***$2');
  if (field === 'name') return value.substring(0, 2) + '***';
  return '***';
}
```

### 3.2 SPI -- Dados Sensiveis de Negocio

| Aspecto | Regra |
|---------|-------|
| **Logging** | Mascarar em ambientes non-prod. Prod pode logar para auditoria |
| **Retencao** | 10 anos (requisito fiscal/contabil brasileiro) |
| **Criptografia** | Encrypt at rest (Azure PostgreSQL TDE habilitado) |
| **Acesso** | Restrito a roles ADMIN e MANAGER do tenant |
| **Exportacao** | Disponivel via relatorios com controle de acesso |

**Implementacao no KegSafe:**
```typescript
// Mascaramento de CNPJ em logs non-prod
function maskCNPJ(cnpj: string): string {
  return cnpj.substring(0, 2) + '.***.***/' + cnpj.substring(8, 12) + '-**';
}
// Resultado: "12.***.***//0001-**"
```

### 3.3 Financial -- Dados Financeiros

| Aspecto | Regra |
|---------|-------|
| **Logging** | NUNCA expor valores em logs. Logar apenas identificador do registro |
| **Retencao** | 10 anos (requisito fiscal/contabil brasileiro, Lei 10.406/2002) |
| **Criptografia** | Encrypt at rest (Azure PostgreSQL TDE habilitado) |
| **Acesso** | Restrito a roles MANAGER e ADMIN do tenant |
| **Exportacao** | Disponivel via relatorios financeiros com auditoria |

**Implementacao no KegSafe:**
```typescript
// NUNCA logar valores financeiros
logger.log(`Barrel ${barrelId} disposal processed`); // CORRETO
logger.log(`Barrel ${barrelId} cost: R$ ${cost}`);    // PROIBIDO
```

### 3.4 Credential -- Credenciais

| Aspecto | Regra |
|---------|-------|
| **Logging** | **NUNCA** logar sob nenhuma circunstancia. Nem mascarado |
| **Retencao** | Rotacao periodica obrigatoria (ver SECRET-ROTATION-RUNBOOK.md) |
| **Hashing** | Argon2id com parametros: memoryCost=65536, timeCost=3, parallelism=4 |
| **Acesso** | Nenhum acesso humano direto. Apenas processos automatizados |
| **Armazenamento** | passwordHash: no banco. Tokens JWT: Azure Key Vault |
| **Transmissao** | Apenas via HTTPS/TLS 1.2+. Nunca em query strings |

**Implementacao no KegSafe:**
```typescript
// Argon2id hashing (auth.service.ts)
import * as argon2 from 'argon2';

const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536,   // 64 MB
  timeCost: 3,
  parallelism: 4,
});

// NUNCA logar tokens ou hashes
logger.log(`User ${userId} authenticated`);        // CORRETO
logger.log(`Token: ${token}`);                      // PROIBIDO
logger.log(`Hash: ${passwordHash}`);                // PROIBIDO
```

---

## 4. Matriz Resumo

| Classificacao | Logging | Retencao | Encrypt at Rest | Acesso Minimo |
|---------------|---------|----------|-----------------|---------------|
| **PII** | Mascarar sempre | 5 anos | Sim (TDE) | Role-based (tenant) |
| **SPI** | Mascarar non-prod | 10 anos | Sim (TDE) | ADMIN/MANAGER |
| **Financial** | Nunca expor | 10 anos | Sim (TDE) | MANAGER+ |
| **Credential** | NUNCA logar | Rotacao periodica | Sim (Argon2id/Vault) | Nenhum humano |

---

## 5. Conformidade e Auditoria

### 5.1 LGPD (Lei Geral de Protecao de Dados)

- **Base legal:** Execucao de contrato (Art. 7, V) para dados de usuarios do sistema
- **Direitos do titular:** Implementar endpoints para acesso, correcao e exclusao de PII
- **Encarregado (DPO):** Definir responsavel por tenant ou centralizado
- **Relatorio de impacto:** Recomendado para processamento de dados de localizacao

### 5.2 Auditoria

Todas as operacoes em dados classificados como PII, SPI e Financial sao registradas na tabela `audit_logs` com:
- `userId`: quem executou a acao
- `action`: tipo de operacao (CREATE, UPDATE, DELETE, READ)
- `tableName`: tabela afetada
- `recordId`: registro afetado
- `ipAddress`: IP de origem (mascarado em exports)
- `changes`: diff de campos alterados (valores sensiveis mascarados)

---

## 6. Checklist de Implementacao

- [x] TDE habilitado no Azure Database for PostgreSQL
- [x] Argon2id implementado para hashing de senhas
- [x] Mascaramento de PII no LoggingInterceptor
- [ ] Endpoint de exportacao de dados pessoais (LGPD Art. 18)
- [ ] Politica automatica de retencao e exclusao de dados
- [ ] Anonimizacao automatica em ambientes non-prod
- [ ] Relatorio de impacto a protecao de dados (RIPD)

---

*Documento mantido pela equipe de engenharia. Revisao obrigatoria a cada 6 meses ou quando houver alteracao no schema Prisma.*
