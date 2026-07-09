/**
 * Wrapper do sonner toast com feedback sonoro automático.
 * Substitui `import { toast } from 'sonner'` em todos os arquivos.
 */
import { toast as sonnerToast, type ExternalToast } from 'sonner';
import { playSuccess, playError, playWarning } from '@/lib/sounds';

export const toast = {
  success: (message: string | React.ReactNode, options?: ExternalToast) => {
    playSuccess();
    return sonnerToast.success(message, options);
  },
  error: (message: string | React.ReactNode, options?: ExternalToast) => {
    playError();
    return sonnerToast.error(message, options);
  },
  warning: (message: string | React.ReactNode, options?: ExternalToast) => {
    playWarning();
    return sonnerToast.warning(message, options);
  },
  // Pass-through — sem som
  info: sonnerToast.info,
  message: sonnerToast.message,
  loading: sonnerToast.loading,
  dismiss: sonnerToast.dismiss,
  promise: sonnerToast.promise,
  custom: sonnerToast.custom,
};
