# KegSafe — Ambiente de Demonstração (Azure)

Ambiente **dev** em **Azure Container Apps** (escala a zero → paga só quando usa) +
PostgreSQL gerenciado. Região **Brazil South**. Resource group: `rg-kegsafe-dev`.

## 🔗 Acesso
- **App (frontend):** https://ca-kegsafe-frontend.agreeablecoast-02056331.brazilsouth.azurecontainerapps.io
- **API (backend):** https://ca-kegsafe-backend.agreeablecoast-02056331.brazilsouth.azurecontainerapps.io
- **Login:** `admin@kegsafe.com.br` / `Admin@123` · **Super Admin:** `superadmin@kegsafe.com.br` / `SuperAdmin@123`

> ⏱️ Ao abrir após ficar parado, aguarde **~20-30s** (o app "acorda" do zero na 1ª visita).

## 💰 Custo
| Situação | Custo aprox. |
|---|---|
| **Parado, banco DESLIGADO** | **~R$45/mês** (ACR + storage do banco; apps a zero) |
| Banco LIGADO | + ~R$80/mês proporcional às horas ligado |

O **banco é o maior custo e NÃO desliga sozinho** — desligue-o quando não estiver demonstrando.

## ▶️ Antes de um demo — LIGAR o banco (~1-2 min)
```bash
az postgres flexible-server start -g rg-kegsafe-dev -n pg-kegsafe-dev
```
Opcional (para não ter "cold start" no meio do demo — mantém 1 réplica quente):
```bash
az containerapp update -n ca-kegsafe-backend  -g rg-kegsafe-dev --min-replicas 1
az containerapp update -n ca-kegsafe-frontend -g rg-kegsafe-dev --min-replicas 1
```

## ⏹️ Depois do demo — DESLIGAR para economizar
```bash
az postgres flexible-server stop -g rg-kegsafe-dev -n pg-kegsafe-dev
# se tinha deixado réplicas quentes, volte a escalar a zero:
az containerapp update -n ca-kegsafe-backend  -g rg-kegsafe-dev --min-replicas 0
az containerapp update -n ca-kegsafe-frontend -g rg-kegsafe-dev --min-replicas 0
```

## 🗑️ Desligar TUDO (fim do projeto) — apaga o ambiente inteiro
```bash
az group delete -n rg-kegsafe-dev --yes
```

## 🔄 Publicar mudanças de código
```bash
# Backend
az acr build --registry acrkegsafedev --image kegsafe-backend:dev ./backend
az containerapp update -n ca-kegsafe-backend -g rg-kegsafe-dev \
  --image acrkegsafedev.azurecr.io/kegsafe-backend:dev --revision-suffix r$(date +%s)

# Frontend (rebuild com a URL do backend)
az acr build --registry acrkegsafedev --image kegsafe-frontend:dev-ca \
  --build-arg NEXT_PUBLIC_API_URL=https://ca-kegsafe-backend.agreeablecoast-02056331.brazilsouth.azurecontainerapps.io ./frontend
az containerapp update -n ca-kegsafe-frontend -g rg-kegsafe-dev \
  --image acrkegsafedev.azurecr.io/kegsafe-frontend:dev-ca --revision-suffix r$(date +%s)
```

> Estas são credenciais de **seed/demo** (conhecidas). Antes de produção, trocar por
> senhas próprias e não expor usuários de exemplo. Ver `RELATORIO-VALIDACAO-KEGSAFE.md`.
