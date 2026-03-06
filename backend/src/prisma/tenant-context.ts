import { ClsService } from 'nestjs-cls';

/**
 * Interface para o contexto do tenant armazenado no CLS
 */
export interface TenantContext {
  tenantId: string;
  userId: string;
  userRole: string;
}

/**
 * Helper functions para acessar o contexto do tenant
 */
export const getTenantId = (cls: ClsService): string | undefined => {
  return cls.get('tenantId');
};

export const getUserId = (cls: ClsService): string | undefined => {
  return cls.get('userId');
};

export const setTenantContext = (
  cls: ClsService,
  context: Partial<TenantContext>,
): void => {
  if (context.tenantId) cls.set('tenantId', context.tenantId);
  if (context.userId) cls.set('userId', context.userId);
  if (context.userRole) cls.set('userRole', context.userRole);
};
