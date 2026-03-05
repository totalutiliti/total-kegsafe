# Matriz RBAC -- KegSafe Tech

> Matriz de controle de acesso baseado em roles (Role-Based Access Control) do sistema KegSafe.

**Ultima atualizacao:** 2026-02-28
**Responsavel:** Equipe de Engenharia KegSafe

---

## 1. Roles do Sistema

| Role | Enum | Descricao | Perfil Tipico |
|------|------|-----------|---------------|
| **LOGISTICS** | `Role.LOGISTICS` | Operador de campo | Motorista, auxiliar de logistica |
| **MAINTENANCE** | `Role.MAINTENANCE` | Tecnico de manutencao | Tecnico de barris, soldador |
| **MANAGER** | `Role.MANAGER` | Gestor operacional | Gerente de operacoes, coordenador |
| **ADMIN** | `Role.ADMIN` | Administrador do sistema | Dono/gerente da cervejaria, TI |

---

## 2. Principio de Design

**Deny-by-default:** Todos os endpoints requerem autenticacao por padrao. Endpoints sem decorador `@Roles()` explicito retornam `403 Forbidden` para qualquer role.

```typescript
// Guard global aplicado em AppModule
@UseGuards(JwtAuthGuard, RolesGuard)
```

**Isolamento multi-tenant:** Alem do RBAC, todas as queries sao filtradas pelo `tenantId` do usuario autenticado via CLS (Continuation Local Storage).

---

## 3. Matriz de Permissoes Completa

### Legenda

| Simbolo | Significado |
|---------|-------------|
| `R` | Read (leitura) |
| `C` | Create (criacao) |
| `U` | Update (atualizacao) |
| `D` | Delete (exclusao/soft-delete) |
| `X` | Execute (acao especifica) |
| `A` | Acknowledge (reconhecimento) |
| `V` | Resolve (resolucao) |
| `-` | Sem acesso |
| `*` | Public (sem autenticacao) |

---

### 3.1 Autenticacao (`/auth`)

| Endpoint | Metodo | LOGISTICS | MAINTENANCE | MANAGER | ADMIN | Notas |
|----------|--------|-----------|-------------|---------|-------|-------|
| `/auth/login` | POST | `X` | `X` | `X` | `X` | Login com email+senha |
| `/auth/refresh` | POST | `X` | `X` | `X` | `X` | Renovacao de token JWT |
| `/auth/logout` | POST | `X` | `X` | `X` | `X` | Revoga refresh token |
| `/auth/me` | GET | `R` (own) | `R` (own) | `R` (own) | `R` (own) | Dados do proprio perfil |

### 3.2 Barris (`/barrels`)

| Endpoint | Metodo | LOGISTICS | MAINTENANCE | MANAGER | ADMIN | Notas |
|----------|--------|-----------|-------------|---------|-------|-------|
| `/barrels` | GET | `R` | `R` | `R` | `R` | Listar barris (filtros) |
| `/barrels/:id` | GET | `R` | `R` | `R` | `R` | Detalhes do barril |
| `/barrels` | POST | `-` | `-` | `C` | `C` | Cadastrar novo barril |
| `/barrels/:id` | PATCH | `-` | `-` | `U` | `U` | Atualizar barril |
| `/barrels/:id` | DELETE | `-` | `-` | `-` | `D` | Soft-delete do barril |
| `/barrels/import` | POST | `-` | `-` | `X` | `X` | Importacao em massa (CSV) |
| `/barrels/quick-register` | POST | `-` | `-` | `X` | `X` | Cadastro rapido por QR |

### 3.3 Logistica (`/logistics`)

| Endpoint | Metodo | LOGISTICS | MAINTENANCE | MANAGER | ADMIN | Notas |
|----------|--------|-----------|-------------|---------|-------|-------|
| `/logistics/expedition` | POST | `X` | `-` | `-` | `X` | Expedicao de barris |
| `/logistics/delivery` | POST | `X` | `-` | `-` | `X` | Entrega ao cliente |
| `/logistics/collection` | POST | `X` | `-` | `-` | `X` | Coleta de barris vazios |
| `/logistics/reception` | POST | `X` | `-` | `-` | `X` | Recebimento na cervejaria |

### 3.4 Manutencao (`/maintenance`)

| Endpoint | Metodo | LOGISTICS | MAINTENANCE | MANAGER | ADMIN | Notas |
|----------|--------|-----------|-------------|---------|-------|-------|
| `/maintenance/orders` | GET | `-` | `R` | `R` | `R` | Listar ordens de servico |
| `/maintenance/orders` | POST | `-` | `C` | `-` | `C` | Criar ordem de servico |
| `/maintenance/orders/:id` | PATCH | `-` | `U` | `-` | `U` | Atualizar ordem |
| `/maintenance/orders/:id/approve` | POST | `-` | `-` | `X` | `X` | Aprovar ordem |
| `/maintenance/checklist` | POST | `-` | `X` | `-` | `X` | Executar checklist |
| `/maintenance/checklist/:id` | GET | `-` | `R` | `R` | `R` | Ver checklist |
| `/maintenance/triage` | POST | `-` | `X` | `-` | `X` | Executar triagem |
| `/maintenance/triage/:id` | GET | `-` | `R` | `R` | `R` | Ver resultado triagem |

### 3.5 Componentes (`/components`)

| Endpoint | Metodo | LOGISTICS | MAINTENANCE | MANAGER | ADMIN | Notas |
|----------|--------|-----------|-------------|---------|-------|-------|
| `/components` | GET | `-` | `R` | `R` | `R` | Listar configuracoes |
| `/components` | POST | `-` | `-` | `-` | `C` | Criar componente |
| `/components/:id` | PATCH | `-` | `-` | `-` | `U` | Atualizar componente |
| `/components/:id` | DELETE | `-` | `-` | `-` | `D` | Remover componente |

### 3.6 Clientes (`/clients`)

| Endpoint | Metodo | LOGISTICS | MAINTENANCE | MANAGER | ADMIN | Notas |
|----------|--------|-----------|-------------|---------|-------|-------|
| `/clients` | GET | `R` | `-` | `R` | `R` | Listar clientes |
| `/clients/:id` | GET | `R` | `-` | `R` | `R` | Detalhes do cliente |
| `/clients` | POST | `-` | `-` | `C` | `C` | Cadastrar cliente |
| `/clients/:id` | PATCH | `-` | `-` | `-` | `U` | Atualizar cliente |
| `/clients/:id` | DELETE | `-` | `-` | `-` | `D` | Soft-delete cliente |

### 3.7 Fornecedores (`/suppliers`)

| Endpoint | Metodo | LOGISTICS | MAINTENANCE | MANAGER | ADMIN | Notas |
|----------|--------|-----------|-------------|---------|-------|-------|
| `/suppliers` | GET | `-` | `-` | `R` | `R` | Listar fornecedores |
| `/suppliers/:id` | GET | `-` | `-` | `R` | `R` | Detalhes |
| `/suppliers` | POST | `-` | `-` | `-` | `C` | Cadastrar fornecedor |
| `/suppliers/:id` | PATCH | `-` | `-` | `-` | `U` | Atualizar |
| `/suppliers/:id` | DELETE | `-` | `-` | `-` | `D` | Soft-delete |

### 3.8 Prestadores de Servico (`/service-providers`)

| Endpoint | Metodo | LOGISTICS | MAINTENANCE | MANAGER | ADMIN | Notas |
|----------|--------|-----------|-------------|---------|-------|-------|
| `/service-providers` | GET | `-` | `-` | `R` | `R` | Listar prestadores |
| `/service-providers/:id` | GET | `-` | `-` | `R` | `R` | Detalhes |
| `/service-providers` | POST | `-` | `-` | `-` | `C` | Cadastrar |
| `/service-providers/:id` | PATCH | `-` | `-` | `-` | `U` | Atualizar |
| `/service-providers/:id` | DELETE | `-` | `-` | `-` | `D` | Soft-delete |

### 3.9 Geofences (`/geofences`)

| Endpoint | Metodo | LOGISTICS | MAINTENANCE | MANAGER | ADMIN | Notas |
|----------|--------|-----------|-------------|---------|-------|-------|
| `/geofences` | GET | `R` | `-` | `R` | `R` | Listar geofences |
| `/geofences/:id` | GET | `R` | `-` | `R` | `R` | Detalhes |
| `/geofences` | POST | `-` | `-` | `C` | `C` | Criar geofence |
| `/geofences/:id` | PATCH | `-` | `-` | `-` | `U` | Atualizar |
| `/geofences/:id` | DELETE | `-` | `-` | `-` | `D` | Remover |

### 3.10 Alertas (`/alerts`)

| Endpoint | Metodo | LOGISTICS | MAINTENANCE | MANAGER | ADMIN | Notas |
|----------|--------|-----------|-------------|---------|-------|-------|
| `/alerts` | GET | `-` | `R` | `R` | `R` | Listar alertas |
| `/alerts/:id` | GET | `-` | `R` | `R` | `R` | Detalhes |
| `/alerts/:id/acknowledge` | POST | `-` | `-` | `A` | `A` | Reconhecer alerta |
| `/alerts/:id/resolve` | POST | `-` | `-` | `-` | `V` | Resolver alerta |
| `/alerts` | POST | `-` | `-` | `-` | `C` | Criar alerta manual |
| `/alerts/:id` | DELETE | `-` | `-` | `-` | `D` | Remover alerta |

### 3.11 Dashboard (`/dashboard`)

| Endpoint | Metodo | LOGISTICS | MAINTENANCE | MANAGER | ADMIN | Notas |
|----------|--------|-----------|-------------|---------|-------|-------|
| `/dashboard/summary` | GET | `-` | `-` | `R` | `R` | Resumo geral |
| `/dashboard/kpis` | GET | `-` | `-` | `R` | `R` | KPIs operacionais |
| `/dashboard/charts` | GET | `-` | `-` | `R` | `R` | Dados para graficos |

### 3.12 Descarte (`/disposals`)

| Endpoint | Metodo | LOGISTICS | MAINTENANCE | MANAGER | ADMIN | Notas |
|----------|--------|-----------|-------------|---------|-------|-------|
| `/disposals` | GET | `-` | `-` | `R` | `R` | Listar descartes |
| `/disposals` | POST | `-` | `-` | `C` | `C` | Solicitar descarte |
| `/disposals/:id/approve` | POST | `-` | `-` | `X` | `X` | Aprovar descarte |
| `/disposals/:id` | PATCH | `-` | `-` | `-` | `U` | Atualizar |
| `/disposals/:id` | DELETE | `-` | `-` | `-` | `D` | Cancelar descarte |

### 3.13 Configuracoes do Tenant (`/tenant-settings`)

| Endpoint | Metodo | LOGISTICS | MAINTENANCE | MANAGER | ADMIN | Notas |
|----------|--------|-----------|-------------|---------|-------|-------|
| `/tenant-settings` | GET | `-` | `-` | `R` | `R` | Ver configuracoes |
| `/tenant-settings` | PATCH | `-` | `-` | `-` | `U` | Atualizar configuracoes |

### 3.14 Gestao de Usuarios (`/users`)

| Endpoint | Metodo | LOGISTICS | MAINTENANCE | MANAGER | ADMIN | Notas |
|----------|--------|-----------|-------------|---------|-------|-------|
| `/users` | GET | `-` | `-` | `-` | `R` | Listar usuarios |
| `/users/:id` | GET | `-` | `-` | `-` | `R` | Detalhes do usuario |
| `/users` | POST | `-` | `-` | `-` | `C` | Criar usuario |
| `/users/:id` | PATCH | `-` | `-` | `-` | `U` | Atualizar usuario |
| `/users/:id` | DELETE | `-` | `-` | `-` | `D` | Desativar usuario |

### 3.15 Health Check (`/health`)

| Endpoint | Metodo | LOGISTICS | MAINTENANCE | MANAGER | ADMIN | Notas |
|----------|--------|-----------|-------------|---------|-------|-------|
| `/health` | GET | `*` | `*` | `*` | `*` | Public, sem auth |

---

## 4. Implementacao Tecnica

### 4.1 Guards NestJS

```typescript
// roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

```typescript
// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Se nao ha @Roles() decorador, requer autenticacao mas nega acesso
    if (!requiredRoles) {
      return false; // deny-by-default
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}
```

### 4.2 Exemplo de Uso em Controller

```typescript
@Controller('barrels')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BarrelsController {

  @Get()
  @Roles(Role.LOGISTICS, Role.MAINTENANCE, Role.MANAGER, Role.ADMIN)
  findAll() { /* ... */ }

  @Post()
  @Roles(Role.MANAGER, Role.ADMIN)
  create() { /* ... */ }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove() { /* ... */ }
}
```

### 4.3 Endpoint Publico

```typescript
@Controller('health')
export class HealthController {
  @Get()
  @Public() // Decorador que bypassa JwtAuthGuard
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

---

## 5. Regras de Negocio Adicionais

1. **LOGISTICS so pode ver barris do proprio tenant** -- garantido pelo filtro CLS de tenantId.
2. **MANAGER pode aprovar descartes e ordens de servico**, mas nao pode criar ordens diretamente (quem cria e MAINTENANCE).
3. **ADMIN e o unico role que pode gerenciar usuarios** -- inclusive alterar roles de outros usuarios.
4. **Nenhum usuario pode escalar o proprio role** -- validacao explicita no endpoint de update de usuario.
5. **Soft-delete vs Hard-delete** -- todas as operacoes DELETE sao soft-delete (set `deletedAt`). Hard-delete so via migracao de banco.

---

## 6. Checklist de Seguranca

- [x] Guards globais `JwtAuthGuard` e `RolesGuard` aplicados
- [x] Principio deny-by-default implementado
- [x] Isolamento multi-tenant via CLS + Prisma middleware
- [ ] Testes automatizados para cada combinacao role/endpoint
- [ ] Rate limiting por role (LOGISTICS com limite maior para operacoes de campo)
- [ ] Logs de auditoria para todas as operacoes de escrita

---

*Documento mantido pela equipe de engenharia. Revisao obrigatoria a cada novo modulo ou endpoint adicionado.*
